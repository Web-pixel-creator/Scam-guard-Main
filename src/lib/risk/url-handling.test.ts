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

beforeEach(() => {
  hoisted.insertCalls.length = 0;
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
});
