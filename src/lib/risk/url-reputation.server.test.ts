import { describe, expect, it, vi } from "vitest";
import { checkUrlReputation, normalizeUrlForReputationProvider } from "./url-reputation.server";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as unknown as Response;
}

function firstFetchUrl(fetchImpl: ReturnType<typeof vi.fn>): string {
  return String((fetchImpl.mock.calls as unknown[][])[0]?.[0]);
}

function firstFetchBody(fetchImpl: ReturnType<typeof vi.fn>): string {
  const init = (fetchImpl.mock.calls as Array<[unknown, RequestInit | undefined]>)[0]?.[1];
  return String(init?.body);
}

describe("checkUrlReputation", () => {
  it("does not call providers when no reputation provider is configured", async () => {
    const fetchImpl = vi.fn();

    const result = await checkUrlReputation(["https://example.com"], {
      env: {},
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: false,
    });

    expect(result).toEqual({ reasonCodes: [], providersChecked: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps Google Safe Browsing social engineering matches to phishing reason codes", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ matches: [{ threatType: "SOCIAL_ENGINEERING" }] }),
    );

    const result = await checkUrlReputation(["https://phish.test/login"], {
      env: { GOOGLE_SAFE_BROWSING_KEY: "test-key" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: false,
    });

    expect(result.reasonCodes).toEqual(["external_phishing_url"]);
    expect(result.providersChecked).toEqual(["google_safe_browsing"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(firstFetchUrl(fetchImpl)).toContain("safebrowsing.googleapis.com/v4/threatMatches:find");
  });

  it("maps Google Safe Browsing malware matches to malware reason codes", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ matches: [{ threatType: "MALWARE" }] }));

    const result = await checkUrlReputation(["https://malware.test/app.apk"], {
      env: { GOOGLE_SAFE_BROWSING_API_KEY: "test-key" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: false,
    });

    expect(result.reasonCodes).toEqual(["external_malware_url"]);
    expect(result.providersChecked).toEqual(["google_safe_browsing"]);
  });

  it("treats URLhaus online malware entries as malware signals", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ query_status: "ok", url_status: "online", threat: "malware_download" }),
    );

    const result = await checkUrlReputation(["https://payload.test/dropper"], {
      env: { URLHAUS_ENABLED: "true" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: false,
    });

    expect(result.reasonCodes).toEqual(["external_malware_url"]);
    expect(result.providersChecked).toEqual(["urlhaus"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(firstFetchUrl(fetchImpl)).toBe("https://urlhaus-api.abuse.ch/v1/url/");
  });

  it("treats verified PhishTank matches as phishing signals", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ results: { in_database: true, verified: true, valid: "true" } }),
    );

    const result = await checkUrlReputation(["https://phish.test"], {
      env: { PHISHTANK_API_KEY: "test-key" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: false,
    });

    expect(result.reasonCodes).toEqual(["external_phishing_url"]);
    expect(result.providersChecked).toEqual(["phishtank"]);
  });

  it("returns no reason codes when a provider errors", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false));

    const result = await checkUrlReputation(["https://example.com"], {
      env: { GOOGLE_SAFE_BROWSING_KEY: "test-key" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: false,
    });

    expect(result.reasonCodes).toEqual([]);
    expect(result.providersChecked).toEqual([]);
  });

  it("strips credentials, query and fragment before provider calls", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));

    await checkUrlReputation(["https://user:pass@example.test/reset?token=secret#frag"], {
      env: { GOOGLE_SAFE_BROWSING_KEY: "test-key" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: false,
    });

    const body = firstFetchBody(fetchImpl);
    expect(body).toContain("https://example.test/");
    expect(body).not.toContain("/reset");
    expect(body).not.toContain("user");
    expect(body).not.toContain("pass");
    expect(body).not.toContain("token=secret");
    expect(body).not.toContain("#frag");
  });

  it("does not disclose path-embedded bearer material to providers", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));

    await checkUrlReputation(
      ["https://files.example.test/share/bearer-secret-7f0c1a/document.pdf"],
      {
        env: { GOOGLE_SAFE_BROWSING_KEY: "test-key" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
        cache: false,
      },
    );

    const body = firstFetchBody(fetchImpl);
    expect(body).toContain("https://files.example.test/");
    expect(body).not.toContain("bearer-secret-7f0c1a");
    expect(body).not.toContain("document.pdf");
  });

  it("reuses cached reputation results for repeated URL checks", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ matches: [{ threatType: "SOCIAL_ENGINEERING" }] }),
    );

    const options = {
      env: { GOOGLE_SAFE_BROWSING_KEY: "test-key" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cacheTtlMs: 60_000,
    };

    const first = await checkUrlReputation(["https://cache-hit.example/login"], options);
    const second = await checkUrlReputation(
      ["https://cache-hit.example/login?otp=123456"],
      options,
    );

    expect(first).toEqual(second);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not cache unavailable provider responses as clean results", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, false))
      .mockResolvedValueOnce(jsonResponse({ matches: [{ threatType: "SOCIAL_ENGINEERING" }] }));

    const options = {
      env: { GOOGLE_SAFE_BROWSING_KEY: "test-key" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cacheTtlMs: 60_000,
    };

    const first = await checkUrlReputation(["https://provider-flake.example/login"], options);
    const second = await checkUrlReputation(["https://provider-flake.example/login"], options);

    expect(first).toEqual({ reasonCodes: [], providersChecked: [] });
    expect(second).toEqual({
      reasonCodes: ["external_phishing_url"],
      providersChecked: ["google_safe_browsing"],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent in-flight checks for the same provider URL", async () => {
    let resolveResponse!: (value: Response) => void;
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );

    const options = {
      env: { GOOGLE_SAFE_BROWSING_KEY: "test-key" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cacheTtlMs: 60_000,
    };

    const first = checkUrlReputation(["https://in-flight.example/login"], options);
    const second = checkUrlReputation(["https://in-flight.example/login?session=secret"], options);
    resolveResponse(jsonResponse({ matches: [{ threatType: "MALWARE" }] }));

    await expect(Promise.all([first, second])).resolves.toEqual([
      { reasonCodes: ["external_malware_url"], providersChecked: ["google_safe_browsing"] },
      { reasonCodes: ["external_malware_url"], providersChecked: ["google_safe_browsing"] },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("normalizes reputation URLs without preserving sensitive URL components", () => {
    expect(normalizeUrlForReputationProvider("example.test/path?code=123456#fragment")).toBe(
      "https://example.test/",
    );
    expect(normalizeUrlForReputationProvider("ftp://example.test/file")).toBeNull();
  });
});
