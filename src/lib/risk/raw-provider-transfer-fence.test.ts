import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  checkSharedRateLimit: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      insert: async () => ({ data: null, error: null }),
    }),
  },
}));

vi.mock("./shared-rate-limit.server", () => ({
  checkSharedRateLimit: h.checkSharedRateLimit,
}));

import { __resetAiCircuitBreakerForTests, analyzeImageCore } from "./check-core";

beforeEach(() => {
  h.checkSharedRateLimit.mockReset();
  __resetAiCircuitBreakerForTests();
  vi.stubEnv("OPENAI_API_KEY", "test-primary-key");
  vi.stubEnv("OPENAI_BASE_URL", "https://primary.example/v1");
  vi.stubEnv("OPENAI_FALLBACK_API_KEY", "test-fallback-key");
  vi.stubEnv("OPENAI_FALLBACK_BASE_URL", "https://fallback.example/v1");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("raw image provider transport fence", () => {
  it("rechecks after delayed admission and propagates a lost-lease error before fetch", async () => {
    let releaseAdmission!: (value: { ok: true; remaining: number; retryAfterSec: number }) => void;
    let markAdmissionStarted!: () => void;
    const admissionStarted = new Promise<void>((resolve) => {
      markAdmissionStarted = resolve;
    });
    const delayedAdmission = new Promise<{
      ok: true;
      remaining: number;
      retryAfterSec: number;
    }>((resolve) => {
      releaseAdmission = resolve;
    });
    h.checkSharedRateLimit.mockImplementationOnce(async () => {
      markAdmissionStarted();
      return delayedAdmission;
    });

    let leaseCurrent = true;
    const beforeProviderTransfer = vi.fn(async () => {
      if (!leaseCurrent) throw new Error("stale_update_lease");
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const analysis = analyzeImageCore("data:image/png;base64,AAAA", "ru", "tg:42", {
      maxAttempts: 1,
      allowFallback: false,
      beforeProviderTransfer,
    });

    await admissionStarted;
    leaseCurrent = false;
    releaseAdmission({ ok: true, remaining: 9, retryAfterSec: 0 });

    await expect(analysis).rejects.toThrow("stale_update_lease");
    expect(beforeProviderTransfer).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
