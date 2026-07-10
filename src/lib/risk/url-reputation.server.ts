import type { ReasonCode } from "./rules";

type FetchLike = typeof fetch;

export interface UrlReputationOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  maxUrls?: number;
  cache?: boolean;
  cacheTtlMs?: number;
}

export interface UrlReputationResult {
  reasonCodes: ReasonCode[];
  providersChecked: string[];
}

interface ProviderLookupResult {
  checked: boolean;
  codes: ReasonCode[];
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
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const GOOGLE_PROVIDER = "google_safe_browsing";
const URLHAUS_PROVIDER = "urlhaus";
const PHISHTANK_PROVIDER = "phishtank";

const resultCache = new Map<string, { expiresAt: number; result: UrlReputationResult }>();
const inFlight = new Map<string, Promise<UrlReputationResult>>();

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

export function normalizeUrlForReputationProvider(raw: string): string | null {
  const cleaned = raw.trim().replace(/[.,!?;:)\]}>"'`]+$/g, "");
  if (!cleaned) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned) && !/^https?:\/\//i.test(cleaned)) return null;

  const candidate = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeUrls(urls: string[], maxUrls: number): string[] {
  const result = new Set<string>();
  for (const raw of urls) {
    const value = normalizeUrlForReputationProvider(raw);
    if (!value) continue;
    result.add(value);
    if (result.size >= maxUrls) break;
  }
  return [...result];
}

function activeProviderNames(env: Record<string, string | undefined>): string[] {
  const enabled = providerList(env);
  const providers: string[] = [];
  const googleKey =
    envValue(env, "GOOGLE_SAFE_BROWSING_KEY") ?? envValue(env, "GOOGLE_SAFE_BROWSING_API_KEY");
  if (googleKey) providers.push(GOOGLE_PROVIDER);
  if (boolEnv(env, "URLHAUS_ENABLED") || enabled.has(URLHAUS_PROVIDER)) {
    providers.push(URLHAUS_PROVIDER);
  }
  if (envValue(env, "PHISHTANK_API_KEY")) providers.push(PHISHTANK_PROVIDER);
  return providers;
}

function cacheKey(providers: string[], urls: string[]): string {
  return `${providers.sort().join(",")}|${urls.join("\n")}`;
}

function getCachedResult(key: string, now: number): UrlReputationResult | null {
  const cached = resultCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    resultCache.delete(key);
    return null;
  }
  return {
    reasonCodes: [...cached.result.reasonCodes],
    providersChecked: [...cached.result.providersChecked],
  };
}

function rememberResult(
  key: string,
  result: UrlReputationResult,
  ttlMs: number,
  now: number,
): void {
  if (resultCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = resultCache.keys().next().value as string | undefined;
    if (oldest) resultCache.delete(oldest);
  }
  resultCache.set(key, {
    expiresAt: now + ttlMs,
    result: {
      reasonCodes: [...result.reasonCodes],
      providersChecked: [...result.providersChecked],
    },
  });
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
): Promise<ProviderLookupResult> {
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
  return { checked: json !== null, codes: json ? googleReasonCodes(json) : [] };
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
): Promise<ProviderLookupResult> {
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
  return { checked: json !== null, codes: json ? urlhausReasonCodes(json) : [] };
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
): Promise<ProviderLookupResult> {
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
  return { checked: json !== null, codes: json ? phishTankReasonCodes(json) : [] };
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
  const providers = activeProviderNames(env);
  const cacheEnabled = options.cache !== false;
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const now = Date.now();

  if (!fetchImpl || normalizedUrls.length === 0) {
    return { reasonCodes: [], providersChecked: [] };
  }

  if (providers.length === 0) {
    return { reasonCodes: [], providersChecked: [] };
  }

  const key = cacheKey(providers, normalizedUrls);
  if (cacheEnabled && cacheTtlMs > 0) {
    const cached = getCachedResult(key, now);
    if (cached) return cached;
    const pending = inFlight.get(key);
    if (pending) return pending;
  }

  const googleKey =
    envValue(env, "GOOGLE_SAFE_BROWSING_KEY") ?? envValue(env, "GOOGLE_SAFE_BROWSING_API_KEY");
  const urlhausEnabled = boolEnv(env, "URLHAUS_ENABLED") || enabled.has(URLHAUS_PROVIDER);
  const urlhausAuthKey = envValue(env, "URLHAUS_AUTH_KEY");
  const phishTankKey = envValue(env, "PHISHTANK_API_KEY");

  const providerCalls: Array<Promise<{ provider: string } & ProviderLookupResult>> = [];

  if (googleKey) {
    providerCalls.push(
      checkGoogleSafeBrowsing(fetchImpl, normalizedUrls, googleKey, timeoutMs).then((lookup) => ({
        provider: GOOGLE_PROVIDER,
        ...lookup,
      })),
    );
  }

  if (urlhausEnabled) {
    for (const url of normalizedUrls) {
      providerCalls.push(
        checkUrlhaus(fetchImpl, url, timeoutMs, urlhausAuthKey).then((lookup) => ({
          provider: URLHAUS_PROVIDER,
          ...lookup,
        })),
      );
    }
  }

  if (phishTankKey) {
    for (const url of normalizedUrls) {
      providerCalls.push(
        checkPhishTank(fetchImpl, url, phishTankKey, timeoutMs).then((lookup) => ({
          provider: PHISHTANK_PROVIDER,
          ...lookup,
        })),
      );
    }
  }

  if (providerCalls.length === 0) return { reasonCodes: [], providersChecked: [] };

  const checkWork = (async (): Promise<{
    complete: boolean;
    result: UrlReputationResult;
  }> => {
    const settled = await Promise.allSettled(providerCalls);
    const providersChecked = new Set<string>();
    const reasonCodes = new Set<ReasonCode>();
    let complete = true;

    for (const result of settled) {
      if (result.status !== "fulfilled" || !result.value.checked) {
        complete = false;
        continue;
      }
      providersChecked.add(result.value.provider);
      for (const code of result.value.codes) reasonCodes.add(code);
    }

    return {
      complete,
      result: {
        reasonCodes: [...reasonCodes],
        providersChecked: [...providersChecked],
      },
    };
  })();

  if (!cacheEnabled || cacheTtlMs <= 0) return (await checkWork).result;

  inFlight.set(
    key,
    checkWork.then(({ result }) => result),
  );
  try {
    const { complete, result } = await checkWork;
    if (complete) rememberResult(key, result, cacheTtlMs, now);
    return result;
  } finally {
    inFlight.delete(key);
  }
}
