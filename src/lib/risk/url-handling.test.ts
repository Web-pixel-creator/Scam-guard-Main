// Tests for URL handling: hosted app platforms, APK detection, and AI skip behavior.
// Validates the fix: deterministic unknown handling for hosted app domains.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evaluateUrl, scoreFromCodes } from "./rules";

// Mock supabase + rate-limit for runCheck tests
const hoisted = vi.hoisted(() => ({
  insertCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) =>
      table === "checks"
        ? {
            insert: (arg: Record<string, unknown>) => {
              hoisted.insertCalls.push(arg);
              return Promise.resolve({ data: null, error: null });
            },
          }
        : {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          },
  },
}));

vi.mock("./rate-limit", () => ({
  checkRateLimit: () => ({ ok: true, remaining: 10, retryAfterSec: 0 }),
}));

import { runCheck } from "./check-core";

let keyCounter = 0;
const nextKey = () => `test:url:${keyCounter++}`;
const URL_REPUTATION_ENV_KEYS = [
  "GOOGLE_SAFE_BROWSING_KEY",
  "GOOGLE_SAFE_BROWSING_API_KEY",
  "URL_REPUTATION_PROVIDERS",
  "URLHAUS_ENABLED",
  "URLHAUS_AUTH_KEY",
  "PHISHTANK_API_KEY",
] as const;
const originalUrlReputationEnv = Object.fromEntries(
  URL_REPUTATION_ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof URL_REPUTATION_ENV_KEYS)[number], string | undefined>;

beforeEach(() => {
  hoisted.insertCalls.length = 0;
  for (const key of URL_REPUTATION_ENV_KEYS) {
    delete process.env[key];
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "AI explanation text" } }] }),
      text: async () => "",
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of URL_REPUTATION_ENV_KEYS) {
    const original = originalUrlReputationEnv[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

describe("evaluateUrl — hosted app platform detection", () => {
  const hostedDomains = [
    "panel-polish-studio.lovable.app",
    "https://myapp.vercel.app/dashboard",
    "https://project.netlify.app",
    "https://site.pages.dev",
    "https://app.web.app",
    "https://user.github.io/repo",
    "https://project.replit.app",
    "https://app.glitch.me",
    "https://myapp.railway.app",
    "https://safe-service.onrender.com",
  ];

  it.each(hostedDomains)("detects hosted_app_platform for %s", (url) => {
    const codes = evaluateUrl(url);
    expect(codes).toContain("hosted_app_platform");
  });

  it("does NOT detect hosted_app_platform for regular domains", () => {
    const normalUrls = [
      "https://google.com",
      "https://bank.uz",
      "https://example.com/page",
      "http://192.168.1.1",
      "https://example.com/redirect/lovable.app",
      "https://example.com/?next=https%3A%2F%2Ffoo.lovable.app",
    ];
    for (const url of normalUrls) {
      const codes = evaluateUrl(url);
      expect(codes).not.toContain("hosted_app_platform");
    }
  });

  it("hosted_app_platform has weight 0 (informational only)", () => {
    const { score, level } = scoreFromCodes(["hosted_app_platform"]);
    expect(score).toBe(0);
    expect(level).toBe("unknown");
  });
});

describe("evaluateUrl — APK detection", () => {
  it("detects apk_download_link for .apk URLs", () => {
    const codes = evaluateUrl("https://example.com/app.apk");
    expect(codes).toContain("apk_download_link");
  });

  it("APK URL reaches at least suspicious level", () => {
    const codes = evaluateUrl("https://example.com/bank-update.apk");
    expect(codes).toContain("apk_download_link");
    const { score, level } = scoreFromCodes(codes);
    // apk_download_link = 45 → suspicious (≥20)
    expect(score).toBeGreaterThanOrEqual(20);
    expect(["suspicious", "high_risk"]).toContain(level);
  });
});

describe("runCheck — deterministic unknown for hosted URLs (no AI hallucination)", () => {
  it("lovable.app URL without suspicious path → unknown + no AI call", async () => {
    const result = await runCheck({
      input: "https://panel-polish-studio.lovable.app/",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "web",
      skipAi: false, // AI is available but should be skipped
    });

    expect(result.level).toBe("unknown");
    expect(result.reasons).toContain("hosted_app_platform");
    // AI should NOT have been called (explanation is null)
    expect(result.explanation).toBeNull();
    // fetch should NOT have been called for AI
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("unknown URL with no reasons → no AI hallucination", async () => {
    const result = await runCheck({
      input: "https://totally-random-domain.example/path",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
      skipAi: false,
    });

    expect(result.level).toBe("unknown");
    // No reasons triggered at all for a generic domain
    expect(result.reasons).toHaveLength(0);
    // AI should NOT be called
    expect(result.explanation).toBeNull();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("unknown Telegram username passport skips AI to stay fast and honest", async () => {
    const result = await runCheck({
      input: "@UiWebWeb",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
      skipAi: false,
    });

    expect(result.type).toBe("telegram");
    expect(result.level).toBe("unknown");
    expect(result.reasons).toEqual(["unknown_sender"]);
    expect(result.explanation).toBeNull();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("valid phone passport skips AI when there are no risk signals", async () => {
    const result = await runCheck({
      input: "+998712008727",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
      skipAi: false,
    });

    expect(result.type).toBe("phone");
    expect(result.level).toBe("unknown");
    expect(result.reasons).toEqual(["valid_uz_phone"]);
    expect(result.explanation).toBeNull();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("suspicious URL (short link) DOES call AI", async () => {
    const result = await runCheck({
      input: "https://bit.ly/abc123",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
      skipAi: false,
    });

    expect(result.level).toBe("suspicious");
    expect(result.reasons).toContain("suspicious_short_link");
    // AI SHOULD have been called
    expect(result.explanation).toBe("AI explanation text");
    expect(vi.mocked(fetch)).toHaveBeenCalled();
  });

  it("APK download link → high_risk, AI called", async () => {
    const result = await runCheck({
      input: "https://fake-bank.xyz/update.apk",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
      skipAi: false,
    });

    expect(result.level).toBe("high_risk");
    expect(result.reasons).toContain("apk_download_link");
    // AI SHOULD have been called
    expect(result.explanation).toBe("AI explanation text");
    expect(vi.mocked(fetch)).toHaveBeenCalled();
  });

  it("hosted URL with additional suspicious signals DOES call AI", async () => {
    const result = await runCheck({
      input: "https://fake-bank.lovable.app/update.apk",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
      skipAi: false,
    });

    expect(result.reasons).toContain("hosted_app_platform");
    expect(result.reasons).toContain("apk_download_link");
    expect(result.level).toBe("suspicious");
    expect(result.explanation).toBe("AI explanation text");
    expect(vi.mocked(fetch)).toHaveBeenCalled();
  });

  it("external phishing feed match escalates an otherwise generic URL", async () => {
    process.env.GOOGLE_SAFE_BROWSING_KEY = "test-key";
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ matches: [{ threatType: "SOCIAL_ENGINEERING" }] }),
      text: async () => "",
    } as unknown as Response);

    const result = await runCheck({
      input: "https://ordinary-looking-site.example/login",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
      skipAi: true,
    });

    expect(result.level).toBe("high_risk");
    expect(result.reasons).toContain("external_phishing_url");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("sends only sanitized extracted URL tokens to reputation providers for mixed URL text", async () => {
    process.env.GOOGLE_SAFE_BROWSING_KEY = "test-key";
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "",
    } as unknown as Response);

    await runCheck({
      input: "They sent OTP 123456 and reset link https://evil.example/reset?token=secret",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "web",
      skipAi: true,
    });

    const body = String(vi.mocked(fetch).mock.calls[0]?.[1]?.body);
    expect(body).toContain("https://evil.example/reset");
    expect(body).not.toContain("token=secret");
    expect(body).not.toContain("They sent OTP");
    expect(body).not.toContain("123456");
  });

  it("checks embedded payment URLs without sending the payment message or URL secrets", async () => {
    process.env.GOOGLE_SAFE_BROWSING_KEY = "test-key";
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "",
    } as unknown as Response);

    await runCheck({
      input: "Оплатите доставку 25000 сум по ссылке https://pay.example/invoice?order=secret123",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "web",
      skipAi: true,
    });

    const body = String(vi.mocked(fetch).mock.calls[0]?.[1]?.body);
    expect(body).toContain("https://pay.example/invoice");
    expect(body).not.toContain("Оплатите доставку");
    expect(body).not.toContain("25000");
    expect(body).not.toContain("secret123");
  });
});
