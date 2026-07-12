// Regression test for the WEB contract of the thin `checkInput` / `ocrExtract`
// server-function wrappers after the `check-core.ts` refactor (Task 2.3).
//
// Goal: prove the web contract did NOT change once the pipeline moved into
// `runCheck`/`ocrExtractCore`:
//   - the rate-limit key is still IP-based, in the exact `check:<ip>` form
//     (cf-connecting-ip → x-real-ip → getRequestIP → "unknown"), never tg:/user-based;
//   - `channel: "web"` is forwarded to the core;
//   - the response is the core's `RunCheckResult` passed through verbatim
//     (same keys, same values) — identical to the pre-refactor shape.
//
// Isolation (no server runtime, no network, no DB):
//   - `@tanstack/react-start` `createServerFn` is mocked with a tiny builder that
//     captures the real `inputValidator` + `handler` and lets us invoke them
//     directly with `{ data }` (the real runtime needs AsyncLocalStorage context).
//   - `@tanstack/react-start/server` request helpers are mocked so we control the IP.
//   - `./risk/check-core` is mocked so we capture the params the wrapper builds
//     and return a fixed `RunCheckResult`.
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { RunCheckResult } from "./risk/check-core";

// ---- Hoisted, controllable mock state (referenced inside vi.mock factories) ----
const hoisted = vi.hoisted(() => ({
  // header name -> value (undefined = header absent)
  headers: {} as Record<string, string | undefined>,
  // value returned by getRequestIP({ xForwardedFor: true })
  requestIp: undefined as string | undefined,
  // captured calls into the core
  runCheckCalls: [] as Array<Record<string, unknown>>,
  ocrCalls: [] as unknown[][],
  stats: {
    rpcCalls: [] as string[],
    checkCountQueries: [] as string[],
    reportCountQueries: 0,
    reportLossCountQueries: 0,
    reportAmountSelects: 0,
    reportCountStatuses: [] as Array<unknown>,
    reportLossStatuses: [] as Array<unknown>,
    reportAmountSelectStatuses: [] as Array<unknown>,
    rpcRow: {
      total: 10,
      today: 2,
      confirmed_entities: 3,
      high_risk: 0,
      suspicious: 0,
      reports_total: 0,
      reports_with_loss_amount: 1,
      reported_loss_uzs: 0,
    },
    amountRows: [{ amount_lost_uzs: 250_000 }, { amount_lost_uzs: 125_000 }],
  },
  embedEvents: [] as unknown[],
  sharedRateLimitCalls: [] as Array<{
    scope: string;
    key: string;
    limit: number;
    windowMs: number;
  }>,
  sharedRateLimitResults: [] as Array<{
    ok: boolean;
    remaining?: number;
    retryAfterSec: number;
  }>,
}));

// Fixed core result with EVERY documented RunCheckResult field. The wrapper must
// return this object verbatim (no added/removed/renamed keys) — that is the
// "response format identical to pre-refactor" guarantee.
const CORE_RESULT: RunCheckResult = {
  type: "phone",
  display: "+998 •••••••67",
  level: "suspicious",
  score: 25,
  reasons: ["uses_urgency"],
  explanation: "AI explanation text",
  knownReports: 0,
  verifiedContact: null,
  brandEvidence: [],
};

// Mock createServerFn: capture the real validator + handler, expose a callable
// that mimics a client invocation: validate `data`, then run the handler.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: ((d: unknown) => unknown) | undefined;
    const builder = {
      inputValidator(fn: (d: unknown) => unknown) {
        validator = fn;
        return builder;
      },
      handler(h: (opts: { data: unknown }) => unknown) {
        return async (opts: { data: unknown }) => {
          const data = validator ? validator(opts?.data) : opts?.data;
          return h({ data });
        };
      },
    };
    return builder;
  },
}));

// Mock the request-context helpers so the wrapper resolves a deterministic IP.
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: vi.fn((name: string) => hoisted.headers[name]),
  getRequestIP: vi.fn(() => hoisted.requestIp),
}));

// Mock the transport-independent core: capture what the wrapper passes in.
vi.mock("./risk/check-core", () => ({
  runCheck: vi.fn(async (params: Record<string, unknown>) => {
    hoisted.runCheckCalls.push(params);
    return CORE_RESULT;
  }),
  ocrExtractCore: vi.fn(async (...args: unknown[]) => {
    hoisted.ocrCalls.push(args);
    return { text: "extracted text" };
  }),
}));

vi.mock("./risk/shared-rate-limit.server", () => ({
  checkSharedRateLimit: vi.fn(
    async (scope: string, key: string, limit: number, windowMs: number) => {
      hoisted.sharedRateLimitCalls.push({ scope, key, limit, windowMs });
      return (
        hoisted.sharedRateLimitResults.shift() ?? {
          ok: true,
          remaining: 9,
          retryAfterSec: 0,
        }
      );
    },
  ),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: async (name: string) => {
      hoisted.stats.rpcCalls.push(name);
      return { data: [hoisted.stats.rpcRow], error: null };
    },
    from: (table: string) => {
      if (table === "embed_origin_events") {
        return {
          insert: async (row: unknown) => {
            hoisted.embedEvents.push(row);
            return { error: null };
          },
        };
      }

      return {
        select: (columns: string) => {
          const filters: Array<{ column: string; value: unknown }> = [];
          const resolve = async () => {
            if (table === "checks") {
              const riskLevel = String(
                filters.find((filter) => filter.column === "risk_level")?.value,
              );
              hoisted.stats.checkCountQueries.push(riskLevel);
              return {
                count: riskLevel === "high_risk" ? 4 : riskLevel === "suspicious" ? 5 : 0,
                error: null,
              };
            }

            if (table === "reports" && columns === "id") {
              const hasLossFilter = filters.some((filter) => filter.column === "amount_lost_uzs");
              const status = filters.find((filter) => filter.column === "status")?.value;
              if (hasLossFilter) {
                hoisted.stats.reportLossCountQueries += 1;
                hoisted.stats.reportLossStatuses.push(status);
                return { count: 2, error: null };
              }
              hoisted.stats.reportCountQueries += 1;
              hoisted.stats.reportCountStatuses.push(status);
              return { count: 6, error: null };
            }

            if (table === "reports" && columns === "amount_lost_uzs") {
              const status = filters.find((filter) => filter.column === "status")?.value;
              hoisted.stats.reportAmountSelects += 1;
              hoisted.stats.reportAmountSelectStatuses.push(status);
              return { data: hoisted.stats.amountRows, error: null };
            }

            throw new Error(`unexpected public stats query: ${table}.${columns}`);
          };

          const chain = {
            eq(column: string, value: unknown) {
              filters.push({ column, value });
              return chain;
            },
            gt(column: string, value: unknown) {
              filters.push({ column, value });
              return chain;
            },
            limit: async () => resolve(),
            then: (onFulfilled: unknown, onRejected: unknown) =>
              resolve().then(onFulfilled as never, onRejected as never),
          };

          return chain;
        },
      };
    },
  },
}));

import { checkInput, getPublicStats, ocrExtract } from "./check.functions";

beforeEach(() => {
  hoisted.headers = {};
  hoisted.requestIp = undefined;
  hoisted.runCheckCalls.length = 0;
  hoisted.ocrCalls.length = 0;
  hoisted.stats.rpcCalls.length = 0;
  hoisted.stats.checkCountQueries.length = 0;
  hoisted.stats.reportCountQueries = 0;
  hoisted.stats.reportLossCountQueries = 0;
  hoisted.stats.reportAmountSelects = 0;
  hoisted.stats.reportCountStatuses.length = 0;
  hoisted.stats.reportLossStatuses.length = 0;
  hoisted.stats.reportAmountSelectStatuses.length = 0;
  hoisted.embedEvents.length = 0;
  hoisted.sharedRateLimitCalls.length = 0;
  hoisted.sharedRateLimitResults.length = 0;
  delete process.env.TRUST_PROXY_IP_HEADERS;
});

describe("checkInput web contract (telegram-bot-mvp Task 2.3)", () => {
  it("ignores spoofable forwarding headers by default when building the rate-limit key", async () => {
    hoisted.headers["cf-connecting-ip"] = "203.0.113.7";
    // Other sources also set, to prove cf-connecting-ip wins (priority unchanged).
    hoisted.headers["x-real-ip"] = "198.51.100.9";
    hoisted.requestIp = "192.0.2.1";

    await checkInput({ data: { input: "+998901234567", lang: "ru" } });

    expect(hoisted.runCheckCalls).toHaveLength(1);
    const params = hoisted.runCheckCalls[0];
    expect(params.rateLimitKey).toBe("check:192.0.2.1");
    expect(params.channel).toBe("web");
  });

  it("uses trusted proxy headers only when explicitly enabled", async () => {
    process.env.TRUST_PROXY_IP_HEADERS = "true";
    hoisted.headers["cf-connecting-ip"] = "203.0.113.7";
    hoisted.headers["x-real-ip"] = "198.51.100.9";
    hoisted.requestIp = "192.0.2.1";

    await checkInput({ data: { input: "+998901234567", lang: "ru" } });

    expect(hoisted.runCheckCalls[0].rateLimitKey).toBe("check:203.0.113.7");
  });

  it("falls back x-real-ip → getRequestIP → 'unknown' (IP-based, not user-based)", async () => {
    // 1) cf missing → x-real-ip
    hoisted.headers["x-real-ip"] = "198.51.100.9";
    hoisted.requestIp = "192.0.2.1";
    await checkInput({ data: { input: "test", lang: "ru" } });
    expect(hoisted.runCheckCalls[0].rateLimitKey).toBe("check:192.0.2.1");

    // 2) headers missing → getRequestIP
    hoisted.headers = {};
    hoisted.requestIp = "192.0.2.1";
    await checkInput({ data: { input: "test", lang: "ru" } });
    expect(hoisted.runCheckCalls[1].rateLimitKey).toBe("check:192.0.2.1");

    // 3) everything missing → "unknown"
    hoisted.headers = {};
    hoisted.requestIp = undefined;
    await checkInput({ data: { input: "test", lang: "ru" } });
    expect(hoisted.runCheckCalls[2].rateLimitKey).toBe("check:unknown");

    // Every key is the IP-based `check:` form — never the bot's `tg:` form.
    for (const c of hoisted.runCheckCalls) {
      expect(String(c.rateLimitKey)).toMatch(/^check:/);
      expect(String(c.rateLimitKey)).not.toMatch(/^tg:/);
    }
  });

  it("forwards input/lang but does not trust client-supplied type", async () => {
    hoisted.requestIp = "192.0.2.1";

    await checkInput({ data: { input: "@scammer", type: "telegram", lang: "uz" } });
    expect(hoisted.runCheckCalls[0]).toMatchObject({
      input: "@scammer",
      lang: "uz",
    });
    expect(hoisted.runCheckCalls[0]).not.toHaveProperty("type");

    // lang omitted → schema default "ru"
    await checkInput({ data: { input: "hello" } });
    expect(hoisted.runCheckCalls[1].lang).toBe("ru");
  });

  it("returns the core RunCheckResult verbatim (including brand evidence)", async () => {
    hoisted.requestIp = "192.0.2.1";

    const result = await checkInput({ data: { input: "+998901234567", lang: "ru" } });

    // Same value …
    expect(result).toEqual(CORE_RESULT);
    // … and the EXACT same key set as the documented web response shape:
    // no fields added, removed or renamed by the wrapper.
    expect(Object.keys(result).sort()).toEqual(
      [
        "brandEvidence",
        "display",
        "explanation",
        "knownReports",
        "level",
        "reasons",
        "score",
        "type",
        "verifiedContact",
      ].sort(),
    );
    expect(hoisted.embedEvents).toEqual([]);
  });

  it("records privacy-safe aggregate telemetry only for embed check calls", async () => {
    hoisted.requestIp = "192.0.2.1";

    await checkInput({
      data: {
        input: "+998901234567",
        lang: "en",
        embed: {
          partner: "Trusted Site",
          referrer: "https://trusted.example/path?phone=998901234567#raw",
        },
      },
    });

    expect(hoisted.embedEvents).toEqual([
      {
        event_type: "check_result",
        partner: "Trusted Site",
        referrer_origin: "https://trusted.example",
        referrer_host: "trusted.example",
        language: "en",
        input_type: "phone",
        risk_level: "suspicious",
        reason_count: 1,
      },
    ]);
    expect(JSON.stringify(hoisted.embedEvents)).not.toContain("998901234567");
    expect(JSON.stringify(hoisted.embedEvents)).not.toContain("phone=");
    expect(JSON.stringify(hoisted.embedEvents)).not.toContain("/path");
  });

  it("returns a meta-intent response for questions to the bot without calling runCheck", async () => {
    hoisted.requestIp = "192.0.2.1";

    const result = await checkInput({
      data: { input: "Почему ты не смог проанализировать картинку?", lang: "ru" },
    });

    expect(result).toMatchObject({
      metaIntent: "why_failed",
      response: expect.stringContaining("изображение"),
    });
    expect(hoisted.runCheckCalls).toHaveLength(0);
  });

  it("strips referrer query data when embed text routes to a check", async () => {
    hoisted.requestIp = "192.0.2.1";

    await checkInput({
      data: {
        input: "please check this suspicious payment request",
        lang: "ru",
        embed: {
          partner: "Trusted Site",
          referrer: "https://trusted.example/support?secret=998901234567",
        },
      },
    });

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.embedEvents).toEqual([
      {
        event_type: "check_result",
        partner: "Trusted Site",
        referrer_origin: "https://trusted.example",
        referrer_host: "trusted.example",
        language: "ru",
        input_type: "phone",
        risk_level: "suspicious",
        reason_count: 1,
      },
    ]);
    expect(JSON.stringify(hoisted.embedEvents)).not.toContain("998901234567");
    expect(JSON.stringify(hoisted.embedEvents)).not.toContain("secret=");
  });

  it("records embed meta-intent usage without result fields", async () => {
    hoisted.requestIp = "192.0.2.1";

    await checkInput({
      data: {
        input: "why could not analyze the image",
        lang: "ru",
        embed: {
          partner: "Trusted Site",
          referrer: "https://trusted.example/support?secret=998901234567",
        },
      },
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.embedEvents).toEqual([
      {
        event_type: "meta_intent",
        partner: "Trusted Site",
        referrer_origin: "https://trusted.example",
        referrer_host: "trusted.example",
        language: "ru",
        input_type: null,
        risk_level: null,
        reason_count: 0,
      },
    ]);
    expect(JSON.stringify(hoisted.embedEvents)).not.toContain("998901234567");
    expect(JSON.stringify(hoisted.embedEvents)).not.toContain("secret=");
  });

  it("rejects the 11th meta-intent before analytics using the shared check bucket", async () => {
    hoisted.requestIp = "192.0.2.55";
    hoisted.sharedRateLimitResults.push(
      ...Array.from({ length: 10 }, (_, index) => ({
        ok: true,
        remaining: 9 - index,
        retryAfterSec: 0,
      })),
      { ok: false, remaining: 0, retryAfterSec: 42 },
    );

    const request = {
      data: {
        input: "why could not analyze the image",
        lang: "en" as const,
        embed: { partner: "Rate Limited Partner", referrer: "https://partner.example" },
      },
    };

    for (let index = 0; index < 10; index += 1) {
      await expect(checkInput(request)).resolves.toMatchObject({ metaIntent: "why_failed" });
    }
    await expect(checkInput(request)).rejects.toMatchObject({
      message: "rate_limited",
      status: 429,
      retryAfter: 42,
    });

    expect(hoisted.sharedRateLimitCalls).toHaveLength(11);
    expect(new Set(hoisted.sharedRateLimitCalls.map((call) => call.key))).toEqual(
      new Set(["check:192.0.2.55"]),
    );
    expect(hoisted.sharedRateLimitCalls[0]).toMatchObject({
      scope: "check",
      limit: 10,
      windowMs: 60_000,
    });
    expect(hoisted.embedEvents).toHaveLength(10);
    expect(hoisted.runCheckCalls).toHaveLength(0);
  });

  it("returns Telegram-account capability help without pretending to inspect hidden data", async () => {
    hoisted.requestIp = "192.0.2.1";

    const result = await checkInput({
      data: { input: "ты видишь scam метку и возраст Telegram аккаунта?", lang: "ru" },
    });

    expect(result).toMatchObject({
      metaIntent: "telegram_account_limits",
      response: expect.stringContaining("скрытую метку SCAM"),
    });
    expect(JSON.stringify(result)).toContain("возраст аккаунта");
    expect(hoisted.runCheckCalls).toHaveLength(0);
  });

  it("still routes URL/phone/scam-context text to runCheck even with help wording", async () => {
    hoisted.requestIp = "192.0.2.1";

    const result = await checkInput({
      data: { input: "помогите, мне прислали ссылку https://example.com", lang: "ru" },
    });

    expect(result).toEqual(CORE_RESULT);
    expect(hoisted.runCheckCalls).toHaveLength(1);
  });

  it("rejects invalid input via the unchanged schema (min length / unknown type)", async () => {
    hoisted.requestIp = "192.0.2.1";

    await expect(checkInput({ data: { input: "" } })).rejects.toBeDefined();
    await expect(checkInput({ data: { input: "x", type: "not-a-type" } })).rejects.toBeDefined();
    // No call reached the core for invalid inputs.
    expect(hoisted.runCheckCalls).toHaveLength(0);
  });
});

describe("ocrExtract web contract (telegram-bot-mvp Task 2.3)", () => {
  it("delegates to ocrExtractCore with image, lang and the same `check:<ip>` key", async () => {
    hoisted.headers["cf-connecting-ip"] = "203.0.113.7";
    hoisted.requestIp = "192.0.2.1";

    await ocrExtract({ data: { image: "data:image/png;base64,AAAA", lang: "en" } });

    expect(hoisted.ocrCalls).toHaveLength(1);
    const [image, lang, rateLimitKey] = hoisted.ocrCalls[0];
    expect(image).toBe("data:image/png;base64,AAAA");
    expect(lang).toBe("en");
    expect(rateLimitKey).toBe("check:192.0.2.1");
  });

  it("rejects non-image or malformed data URLs before the OCR core", async () => {
    const invalidImages = [
      "https://example.com/not-a-data-url.png",
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "data:image/svg+xml;base64,PHN2Zy8+",
      "data:image/png,AAAA",
      "data:image/png;base64,not valid base64 ***",
    ];

    for (const image of invalidImages) {
      await expect(ocrExtract({ data: { image, lang: "ru" } })).rejects.toBeDefined();
    }

    expect(hoisted.ocrCalls).toHaveLength(0);
  });

  it("rejects decoded images larger than the web screenshot byte limit", async () => {
    const oversized = `data:image/png;base64,${"A".repeat(5_600_000)}`;

    await expect(ocrExtract({ data: { image: oversized, lang: "ru" } })).rejects.toBeDefined();
    expect(hoisted.ocrCalls).toHaveLength(0);
  });

  it("allows png, jpeg and webp data URLs after validation", async () => {
    await ocrExtract({ data: { image: "data:image/png;base64,AAAA", lang: "ru" } });
    await ocrExtract({ data: { image: "data:image/jpeg;base64,BBBB", lang: "ru" } });
    await ocrExtract({ data: { image: "data:image/webp;base64,CCCC", lang: "ru" } });

    expect(hoisted.ocrCalls.map(([image]) => image)).toEqual([
      "data:image/png;base64,AAAA",
      "data:image/jpeg;base64,BBBB",
      "data:image/webp;base64,CCCC",
    ]);
  });

  it("defaults lang to 'ru' and reuses the IP-based key (unknown when no IP)", async () => {
    await ocrExtract({ data: { image: "data:image/png;base64,BBBB" } });

    const [, lang, rateLimitKey] = hoisted.ocrCalls[0];
    expect(lang).toBe("ru");
    expect(rateLimitKey).toBe("check:unknown");
  });
});

describe("getPublicStats public aggregate guard", () => {
  it("serves repeated public stats requests from a short cache instead of repeating service-role aggregates", async () => {
    const first = await getPublicStats({ data: undefined as never });
    const second = await getPublicStats({ data: undefined as never });

    expect(second).toEqual(first);
    expect(hoisted.stats.rpcCalls).toEqual(["get_check_stats"]);
    expect(hoisted.stats.checkCountQueries).toEqual(["high_risk", "suspicious"]);
    expect(hoisted.stats.reportCountQueries).toBe(1);
    expect(hoisted.stats.reportLossCountQueries).toBe(1);
    expect(hoisted.stats.reportAmountSelects).toBe(1);
    expect(hoisted.stats.reportCountStatuses).toEqual(["confirmed"]);
    expect(hoisted.stats.reportLossStatuses).toEqual(["confirmed"]);
    expect(hoisted.stats.reportAmountSelectStatuses).toEqual(["confirmed"]);
  });
});
