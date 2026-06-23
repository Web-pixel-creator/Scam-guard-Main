import { describe, expect, it, vi } from "vitest";
import { checkUrlReputation } from "./url-reputation.server";

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

describe("checkUrlReputation", () => {
  it("does not call providers when no reputation provider is configured", async () => {
    const fetchImpl = vi.fn();

    const result = await checkUrlReputation(["https://example.com"], {
      env: {},
      fetchImpl: fetchImpl as unknown as typeof fetch,
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
    });

    expect(result.reasonCodes).toEqual(["external_phishing_url"]);
    expect(result.providersChecked).toEqual(["phishtank"]);
  });

  it("returns no reason codes when a provider errors", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false));

    const result = await checkUrlReputation(["https://example.com"], {
      env: { GOOGLE_SAFE_BROWSING_KEY: "test-key" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.reasonCodes).toEqual([]);
    expect(result.providersChecked).toEqual(["google_safe_browsing"]);
  });
});
