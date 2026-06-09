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

import { checkInput, ocrExtract } from "./check.functions";

beforeEach(() => {
  hoisted.headers = {};
  hoisted.requestIp = undefined;
  hoisted.runCheckCalls.length = 0;
  hoisted.ocrCalls.length = 0;
});

describe("checkInput web contract (telegram-bot-mvp Task 2.3)", () => {
  it("builds the rate-limit key from cf-connecting-ip in `check:<ip>` form", async () => {
    hoisted.headers["cf-connecting-ip"] = "203.0.113.7";
    // Other sources also set, to prove cf-connecting-ip wins (priority unchanged).
    hoisted.headers["x-real-ip"] = "198.51.100.9";
    hoisted.requestIp = "192.0.2.1";

    await checkInput({ data: { input: "+998901234567", lang: "ru" } });

    expect(hoisted.runCheckCalls).toHaveLength(1);
    const params = hoisted.runCheckCalls[0];
    expect(params.rateLimitKey).toBe("check:203.0.113.7");
    expect(params.channel).toBe("web");
  });

  it("falls back x-real-ip → getRequestIP → 'unknown' (IP-based, not user-based)", async () => {
    // 1) cf missing → x-real-ip
    hoisted.headers["x-real-ip"] = "198.51.100.9";
    hoisted.requestIp = "192.0.2.1";
    await checkInput({ data: { input: "test", lang: "ru" } });
    expect(hoisted.runCheckCalls[0].rateLimitKey).toBe("check:198.51.100.9");

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

  it("forwards input/type/lang unchanged and defaults lang to 'ru'", async () => {
    hoisted.requestIp = "192.0.2.1";

    // explicit type + lang preserved
    await checkInput({ data: { input: "@scammer", type: "telegram", lang: "uz" } });
    expect(hoisted.runCheckCalls[0]).toMatchObject({
      input: "@scammer",
      type: "telegram",
      lang: "uz",
    });

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

    await ocrExtract({ data: { image: "data:image/png;base64,AAAA", lang: "en" } });

    expect(hoisted.ocrCalls).toHaveLength(1);
    const [image, lang, rateLimitKey] = hoisted.ocrCalls[0];
    expect(image).toBe("data:image/png;base64,AAAA");
    expect(lang).toBe("en");
    expect(rateLimitKey).toBe("check:203.0.113.7");
  });

  it("defaults lang to 'ru' and reuses the IP-based key (unknown when no IP)", async () => {
    await ocrExtract({ data: { image: "data:image/png;base64,BBBB" } });

    const [, lang, rateLimitKey] = hoisted.ocrCalls[0];
    expect(lang).toBe("ru");
    expect(rateLimitKey).toBe("check:unknown");
  });
});
