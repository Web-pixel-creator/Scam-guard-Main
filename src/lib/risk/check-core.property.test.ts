// Property-based tests for the transport-independent risk-check core.
//
// Task 2.2 — "Property-тесты ядра: детерминизм и приватность".
// Two named properties from design.md "Correctness Properties":
//   Property 1: scoring is deterministic and independent of the AI layer.
//   Property 2: Sensitive_Data never reaches the DB in raw form.
//
// External dependencies are mocked so no real network / DB calls happen:
//   - `supabaseAdmin` (the `checks` insert is intercepted; `entities` lookup
//     returns null) — see the vi.mock below.
//   - the OpenAI-compatible AI provider `fetch` — stubbed to a deterministic response.
//   - the in-memory rate limiter — stubbed to always allow, and every run also
//     uses a unique rateLimitKey, so the 10/60s window never fails the test.
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `insertCalls` is referenced inside the (hoisted) vi.mock factory, so it must
// itself be hoisted to be initialised before the mock runs.
const hoisted = vi.hoisted(() => ({
  insertCalls: [] as Array<Record<string, unknown>>,
  entityRow: null as null | {
    report_count: number;
    moderation_status: string;
    risk_level: string;
  },
}));

// Mock the service-role Supabase client used by check-core. The real module
// reads SUPABASE_* env vars at first access and would throw in tests.
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
            // entities lookup: .select(...).eq(...).maybeSingle()
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: hoisted.entityRow, error: null }),
              }),
            }),
          },
  },
}));

// Stub the rate limiter to never throttle (the window/state are irrelevant to
// these properties). Belt-and-suspenders: tests also use unique keys per run.
// `./rate-limit` is the exact specifier check-core.ts imports.
vi.mock("./rate-limit", () => ({
  checkRateLimit: () => ({ ok: true, remaining: 10, retryAfterSec: 0 }),
}));

import { ocrExtractCore, runCheck } from "./check-core";

// Unique rate-limit key per run (defensive, in case the mock above is bypassed).
let keyCounter = 0;
const nextKey = () => `tg:test:${keyCounter++}`;

const LANGS = ["ru", "uz", "en"] as const;

beforeEach(() => {
  hoisted.insertCalls.length = 0;
  hoisted.entityRow = null;
  // Deterministic, non-empty AI response so the skipAi:false path yields a
  // string explanation (and never performs a real network request).
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

// Longest run of consecutive digits in a string (0 if none).
const maxDigitRun = (s: string): number =>
  Math.max(0, ...(s.match(/\d+/g) ?? []).map((r) => r.length));

const digitsOnly = (s: string): string => s.replace(/\D/g, "");

describe("check-core property tests (telegram-bot-mvp)", () => {
  // Feature: telegram-bot-mvp, Property 1: Детерминизм scoring, независимость от AI.
  // For any input, runCheck with skipAi:true and with the AI available returns
  // the same level/score/reasons; AI only influences `explanation`.
  // Validates: Requirements 13.5, 4.2
  it("Property 1: scoring is deterministic and independent of AI", async () => {
    const scamPhrases = [
      "Срочно назовите код подтверждения из СМС",
      "Bu bank xavfsizlik xizmati, kodni ayting",
      "Установите apk по ссылке для проверки аккаунта",
      "Переведите деньги на безопасный счёт прямо сейчас",
      "Отсканируйте QR-код для входа в аккаунт",
      "Подтвердите последние 4 цифры карты",
      "Ваша карта будет заблокирована через 24 часа",
      "Друг попал в аварию, срочно нужны деньги на лечение",
    ];
    const inputArb = fc.oneof(
      fc.string(),
      fc.constantFrom(...scamPhrases),
      fc.constantFrom("@scammerbot", "@fakebank_support", "+998901234567"),
      fc.webUrl(),
    );
    const typeArb = fc.option(
      fc.constantFrom("phone", "telegram", "url", "text", "payment", "apk", "unknown"),
      { nil: undefined },
    ) as fc.Arbitrary<
      undefined | "phone" | "telegram" | "url" | "text" | "payment" | "apk" | "unknown"
    >;

    await fc.assert(
      fc.asyncProperty(inputArb, fc.constantFrom(...LANGS), typeArb, async (input, lang, type) => {
        const rateLimitKey = nextKey();
        const params = { input, type, lang, rateLimitKey, channel: "telegram" as const };

        const withoutAi = await runCheck({ ...params, skipAi: true });
        const withAi = await runCheck({ ...params, skipAi: false });

        // Scoring is identical regardless of AI availability.
        expect(withAi.level).toBe(withoutAi.level);
        expect(withAi.score).toBe(withoutAi.score);
        expect(withAi.reasons).toEqual(withoutAi.reasons);
        expect(withAi.type).toBe(withoutAi.type);
        expect(withAi.display).toBe(withoutAi.display);

        // AI affects ONLY the explanation. Most skipAi runs yield null, but
        // brand impersonation can append a deterministic local explanation even
        // when AI is skipped; that still does not affect scoring.
        // Exception: when shouldSkipAi triggers deterministically (URL with
        // unknown level and no reason codes), both runs yield null — this is
        // correct because we intentionally avoid AI hallucination for such inputs.
        if (withoutAi.explanation !== null) {
          expect(withoutAi.reasons).toContain("brand_impersonation");
          expect(typeof withoutAi.explanation).toBe("string");
        }
        if (withAi.explanation !== null) {
          expect(typeof withAi.explanation).toBe("string");
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: telegram-bot-mvp, Property 2: Sensitive_Data никогда не попадает в БД в сыром виде.
  // For any input containing an OTP / card number / phone, the string written to
  // checks.insert (redacted_input) contains no surviving raw OTP/card/phone digit
  // sequence; the identifier is persisted only as input_hash (never the raw value).
  // Validates: Requirements 7.1, 7.2, 7.3
  it("Property 2: Sensitive_Data is never written to the DB in raw form", async () => {
    const digitsArb = (min: number, max: number) =>
      fc
        .array(fc.integer({ min: 0, max: 9 }), { minLength: min, maxLength: max })
        .map((a) => a.join(""));

    await fc.assert(
      fc.asyncProperty(
        digitsArb(4, 8), // OTP / SMS code
        digitsArb(16, 16), // full card number
        digitsArb(9, 9), // UZ subscriber digits
        fc.constantFrom(...LANGS),
        async (otp, card16, sub9, lang) => {
          const cardSpaced = `${card16.slice(0, 4)} ${card16.slice(4, 8)} ${card16.slice(8, 12)} ${card16.slice(12, 16)}`;
          const phone = `+998${sub9}`;
          // A clearly-text message (Cyrillic) embedding all three secrets.
          const input = `Здравствуйте! Назовите код ${otp}. Номер карты ${cardSpaced}. Перезвоните по номеру ${phone}.`;

          hoisted.insertCalls.length = 0;
          const result = await runCheck({
            input,
            lang,
            rateLimitKey: nextKey(),
            channel: "telegram",
            skipAi: true, // AI does not affect what is written as redacted_input
          });

          // Exactly one row inserted into `checks`.
          expect(hoisted.insertCalls).toHaveLength(1);
          const row = hoisted.insertCalls[0];
          const redacted = String(row.redacted_input);

          // redacted_input matches the safe-for-display value returned to caller.
          expect(redacted).toBe(result.display);

          // No raw OTP / card / phone survives. OTP and full card are fully
          // removed; the phone is masked (design keeps country code + last 2),
          // so the strongest invariant is: no contiguous digit run >= 4 remains,
          // which kills any OTP (>=4), card (16) or full phone (>=7) sequence.
          expect(maxDigitRun(redacted)).toBeLessThanOrEqual(3);
          expect(redacted).not.toContain(otp);
          expect(redacted).not.toContain(card16);
          expect(redacted).not.toContain(cardSpaced);
          expect(redacted).not.toContain(phone);
          expect(digitsOnly(redacted)).not.toContain(card16);
          expect(digitsOnly(redacted)).not.toContain(digitsOnly(phone));

          // The identifier is persisted only as a non-empty hash, not raw.
          expect(typeof row.input_hash).toBe("string");
          expect((row.input_hash as string).length).toBeGreaterThan(0);
          expect(row.input_hash).not.toBe(input);
          expect(row.input_hash).not.toBe(phone);
          expect(row.input_hash).not.toBe(card16);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("OCR output is deterministically redacted after the AI provider response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Kod 123456. Karta 8600 1234 5678 9012. Telefon +998901234567.",
              },
            },
          ],
        }),
        text: async () => "",
      })),
    );

    const result = await ocrExtractCore("data:image/png;base64,AAAA", "ru", nextKey());
    const text = result.text ?? "";

    expect(text).not.toContain("123456");
    expect(text).not.toContain("8600 1234 5678 9012");
    expect(text).not.toContain("+998901234567");
    expect(maxDigitRun(text)).toBeLessThanOrEqual(3);
  });

  it("confirmed high-risk entities use the dedicated known_reported reason code", async () => {
    hoisted.entityRow = {
      report_count: 7,
      moderation_status: "confirmed",
      risk_level: "high_risk",
    };

    const result = await runCheck({
      input: "+998901234567",
      type: "phone",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "web",
      skipAi: true,
    });

    expect(result.knownReports).toBe(7);
    expect(result.reasons).toContain("known_reported");
    expect(result.reasons).not.toContain("asks_to_install_apk");
    expect(result.level).toBe("high_risk");
  });
});
