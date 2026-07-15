import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  claims: [] as Array<{
    scope: string;
    key: string;
    limit: number;
    windowMs: number;
  }>,
  counts: new Map<string, number>(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) =>
      table === "checks"
        ? {
            insert: () => Promise.resolve({ data: null, error: null }),
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

vi.mock("./shared-rate-limit.server", () => ({
  checkSharedRateLimit: vi.fn(
    async (scope: string, key: string, limit: number, windowMs: number) => {
      hoisted.claims.push({ scope, key, limit, windowMs });
      const bucket = `${scope}:${key}:${limit}:${windowMs}`;
      const count = (hoisted.counts.get(bucket) ?? 0) + 1;
      hoisted.counts.set(bucket, count);
      return count <= limit
        ? { ok: true, remaining: limit - count, retryAfterSec: 0 }
        : { ok: false, remaining: 0, retryAfterSec: 23 };
    },
  ),
}));

import { runCheck, type RunCheckParams } from "./check-core";

function guardedPreviewParams(key: string): RunCheckParams {
  return {
    input: "ordinary inline preview text",
    type: "text",
    lang: "en",
    rateLimitKey: key,
    rateLimitProfile: "telegram_inline_preview",
    channel: "telegram",
    persist: false,
    skipAi: true,
    skipUrlReputation: true,
  };
}

async function expectAllowanceThenBlock(params: RunCheckParams, allowance: number): Promise<void> {
  for (let index = 0; index < allowance; index += 1) {
    await expect(runCheck(params)).resolves.toMatchObject({ type: "text" });
  }

  await expect(runCheck(params)).rejects.toMatchObject({
    status: 429,
    retryAfter: 23,
  });
}

describe("runCheck rate-limit profiles", () => {
  beforeEach(() => {
    hoisted.claims.length = 0;
    hoisted.counts.clear();
    vi.stubEnv("HASH_PEPPER_SECRET", "check-core-rate-limit-test-pepper");
    vi.stubEnv("OPENAI_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows 60 guarded Telegram Inline previews and blocks the 61st", async () => {
    const params = guardedPreviewParams("tg:inline:42");

    await expectAllowanceThenBlock(params, 60);

    expect(hoisted.claims).toHaveLength(61);
    expect(hoisted.claims).toEqual(
      expect.arrayContaining([
        { scope: "check", key: "tg:inline:42", limit: 60, windowMs: 60_000 },
      ]),
    );
    expect(hoisted.claims.every((claim) => claim.limit === 60)).toBe(true);
  });

  it("keeps the default/direct profile at 10 checks per minute", async () => {
    const params: RunCheckParams = {
      ...guardedPreviewParams("tg:42"),
      rateLimitProfile: "default",
    };

    await expectAllowanceThenBlock(params, 10);

    expect(hoisted.claims).toHaveLength(11);
    expect(hoisted.claims.every((claim) => claim.limit === 10)).toBe(true);
    expect(hoisted.claims.every((claim) => claim.windowMs === 60_000)).toBe(true);
  });

  it.each([
    ["profile omitted", { rateLimitProfile: undefined }],
    ["non-Telegram channel", { channel: "web" as const }],
    ["persistence enabled", { persist: true }],
    ["AI enabled", { skipAi: false }],
    ["URL reputation enabled", { skipUrlReputation: false }],
    ["non-Inline key", { rateLimitKey: "tg:42" }],
  ])("fails closed to 10/min when %s", async (_name, override) => {
    const keySuffix = hoisted.claims.length + hoisted.counts.size + 100;
    const params: RunCheckParams = {
      ...guardedPreviewParams(`tg:inline:${keySuffix}`),
      ...override,
    };

    await expectAllowanceThenBlock(params, 10);

    expect(hoisted.claims).toHaveLength(11);
    expect(hoisted.claims.every((claim) => claim.limit === 10)).toBe(true);
    expect(hoisted.claims.every((claim) => claim.windowMs === 60_000)).toBe(true);
  });
});
