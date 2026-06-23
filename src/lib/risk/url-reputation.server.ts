import type { ReasonCode } from "./rules";

type FetchLike = typeof fetch;

export interface UrlReputationOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  maxUrls?: number;
}

export interface UrlReputationResult {
  reasonCodes: ReasonCode[];
  providersChecked: string[];
}

interface GoogleThreatMatch {
  threatType?: string;
}

interface GoogleResponse {
  matches?: GoogleThreatMatch[];
}

interface UrlhausResponse {
  query_status?: string;
  url_status?: string;
  threat?: string;
  tags?: string[];
  payloads?: unknown[];
}

interface PhishTankResponse {
  results?: {
    in_database?: boolean;
    verified?: boolean | string;
    valid?: boolean | string;
  };
}

const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_MAX_URLS = 3;
const GOOGLE_PROVIDER = "google_safe_browsing";
const URLHAUS_PROVIDER = "urlhaus";
const PHISHTANK_PROVIDER = "phishtank";

function envValue(env: Record<string, string | undefined>, name: string): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

function providerList(env: Record<string, string | undefined>): Set<string> {
  const raw = envValue(env, "URL_REPUTATION_PROVIDERS");
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );
}

function boolEnv(env: Record<string, string | undefined>, name: string): boolean {
  const value = envValue(env, name)?.toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function toBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function normalizeUrls(urls: string[], maxUrls: number): string[] {
  const result = new Set<string>();
  for (const raw of urls) {
    const value = raw.trim();
    if (!value) continue;
    result.add(value);
    if (result.size >= maxUrls) break;
  }
  return [...result];
}

async function fetchJson(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function googleReasonCodes(json: unknown): ReasonCode[] {
  const data = json as GoogleResponse;
  const matches = Array.isArray(data.matches) ? data.matches : [];
  if (matches.length === 0) return [];

  const threatTypes = new Set(matches.map((match) => match.threatType).filter(Boolean));
  const codes = new Set<ReasonCode>();
  if (threatTypes.has("SOCIAL_ENGINEERING")) codes.add("external_phishing_url");
  if (
    threatTypes.has("MALWARE") ||
    threatTypes.has("UNWANTED_SOFTWARE") ||
    threatTypes.has("POTENTIALLY_HARMFUL_APPLICATION")
  ) {
    codes.add("external_malware_url");
  }
  if (codes.size === 0) codes.add("external_phishing_url");
  return [...codes];
}

async function checkGoogleSafeBrowsing(
  fetchImpl: FetchLike,
  urls: string[],
  apiKey: string,
  timeoutMs: number,
): Promise<ReasonCode[]> {
  const json = await fetchJson(
    fetchImpl,
    `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: {
          clientId: "ishonch-guard",
          clientVersion: "1.0",
        },
        threatInfo: {
          threatTypes: [
            "MALWARE",
            "SOCIAL_ENGINEERING",
            "UNWANTED_SOFTWARE",
            "POTENTIALLY_HARMFUL_APPLICATION",
          ],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: urls.map((url) => ({ url })),
        },
      }),
    },
    timeoutMs,
  );
  return json ? googleReasonCodes(json) : [];
}

function urlhausReasonCodes(json: unknown): ReasonCode[] {
  const data = json as UrlhausResponse;
  if (data.query_status !== "ok") return [];

  const tags = Array.isArray(data.tags) ? data.tags.map((tag) => tag.toLowerCase()) : [];
  const looksMalicious =
    data.url_status === "online" ||
    Boolean(data.threat) ||
    Boolean(data.payloads?.length) ||
    tags.some((tag) => tag.includes("malware") || tag.includes("phish"));

  return looksMalicious ? ["external_malware_url"] : [];
}

async function checkUrlhaus(
  fetchImpl: FetchLike,
  url: string,
  timeoutMs: number,
  authKey: string | null,
): Promise<ReasonCode[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "IshonchGuard/1.0",
  };
  if (authKey) headers["Auth-Key"] = authKey;

  const json = await fetchJson(
    fetchImpl,
    "https://urlhaus-api.abuse.ch/v1/url/",
    {
      method: "POST",
      headers,
      body: new URLSearchParams({ url }).toString(),
    },
    timeoutMs,
  );
  return json ? urlhausReasonCodes(json) : [];
}

function phishTankReasonCodes(json: unknown): ReasonCode[] {
  const data = json as PhishTankResponse;
  const result = data.results;
  if (!result) return [];
  const isVerifiedPhish =
    result.in_database === true && toBoolean(result.verified) && toBoolean(result.valid);
  return isVerifiedPhish ? ["external_phishing_url"] : [];
}

async function checkPhishTank(
  fetchImpl: FetchLike,
  url: string,
  apiKey: string,
  timeoutMs: number,
): Promise<ReasonCode[]> {
  const json = await fetchJson(
    fetchImpl,
    "https://checkurl.phishtank.com/checkurl/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "IshonchGuard/1.0",
      },
      body: new URLSearchParams({
        url,
        format: "json",
        app_key: apiKey,
      }).toString(),
    },
    timeoutMs,
  );
  return json ? phishTankReasonCodes(json) : [];
}

export async function checkUrlReputation(
  urls: string[],
  options: UrlReputationOptions = {},
): Promise<UrlReputationResult> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxUrls = options.maxUrls ?? DEFAULT_MAX_URLS;
  const normalizedUrls = normalizeUrls(urls, maxUrls);
  const enabled = providerList(env);

  if (!fetchImpl || normalizedUrls.length === 0) {
    return { reasonCodes: [], providersChecked: [] };
  }

  const googleKey =
    envValue(env, "GOOGLE_SAFE_BROWSING_KEY") ?? envValue(env, "GOOGLE_SAFE_BROWSING_API_KEY");
  const urlhausEnabled = boolEnv(env, "URLHAUS_ENABLED") || enabled.has(URLHAUS_PROVIDER);
  const urlhausAuthKey = envValue(env, "URLHAUS_AUTH_KEY");
  const phishTankKey = envValue(env, "PHISHTANK_API_KEY");

  const providerCalls: Array<Promise<{ provider: string; codes: ReasonCode[] }>> = [];

  if (googleKey) {
    providerCalls.push(
      checkGoogleSafeBrowsing(fetchImpl, normalizedUrls, googleKey, timeoutMs).then((codes) => ({
        provider: GOOGLE_PROVIDER,
        codes,
      })),
    );
  }

  if (urlhausEnabled) {
    for (const url of normalizedUrls) {
      providerCalls.push(
        checkUrlhaus(fetchImpl, url, timeoutMs, urlhausAuthKey).then((codes) => ({
          provider: URLHAUS_PROVIDER,
          codes,
        })),
      );
    }
  }

  if (phishTankKey) {
    for (const url of normalizedUrls) {
      providerCalls.push(
        checkPhishTank(fetchImpl, url, phishTankKey, timeoutMs).then((codes) => ({
          provider: PHISHTANK_PROVIDER,
          codes,
        })),
      );
    }
  }

  if (providerCalls.length === 0) {
    return { reasonCodes: [], providersChecked: [] };
  }

  const settled = await Promise.allSettled(providerCalls);
  const providersChecked = new Set<string>();
  const reasonCodes = new Set<ReasonCode>();

  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    providersChecked.add(result.value.provider);
    for (const code of result.value.codes) reasonCodes.add(code);
  }

  return {
    reasonCodes: [...reasonCodes],
    providersChecked: [...providersChecked],
  };
}
