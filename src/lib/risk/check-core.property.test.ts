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

import { analyzeImageCore, ocrExtractCore, runCheck } from "./check-core";

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
  vi.unstubAllEnvs();
});

// Longest run of consecutive digits in a string (0 if none).
const maxDigitRun = (s: string): number =>
  Math.max(0, ...(s.match(/\d+/g) ?? []).map((r) => r.length));

const digitsOnly = (s: string): string => s.replace(/\D/g, "");

describe("check-core property tests (telegram-bot-mvp)", () => {
  it("does not persist checks when persist=false", async () => {
    const result = await runCheck({
      input: "Срочно назовите SMS код из банка",
      type: "text",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
      skipAi: true,
      persist: false,
    });

    expect(result.level).toBe("high_risk");
    expect(hoisted.insertCalls).toHaveLength(0);
  });

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
    vi.stubEnv("OPENAI_API_KEY", "test-openai-api-key");
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

  it("rejects invalid image data URLs before any AI provider call", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-api-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      ocrExtractCore("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==", "ru", nextKey()),
    ).resolves.toEqual({ text: null });
    await expect(
      analyzeImageCore("data:image/svg+xml;base64,PHN2Zy8+", "ru", nextKey()),
    ).resolves.toBeNull();
    await expect(
      ocrExtractCore("data:image/png;base64,not valid base64 ***", "ru", nextKey()),
    ).resolves.toEqual({ text: null });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps Telegram invite surrounding text as scoring evidence", async () => {
    const result = await runCheck({
      input:
        "СЕГОДНЯ СТАВЛЮ НА МАТЧ США - ГЕРМАНИЯ. Прогноз бесплатно: https://t.me/+fdOETKx56pozNTBi",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
      skipAi: true,
    });

    expect(result.type).toBe("telegram");
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "unknown_sender",
        "suspicious_invite_link",
        "gambling_prediction_promo",
      ]),
    );
    expect(result.level).toBe("high_risk");
    expect(result.display).toContain("@+f");
    expect(hoisted.insertCalls.at(-1)?.reason_codes).toEqual(
      expect.arrayContaining(["suspicious_invite_link", "gambling_prediction_promo"]),
    );
  });

  it("does not turn a delivery card-only voice transcript into a betting scheme", async () => {
    const result = await runCheck({
      input:
        "Ссылку скинул, если вдруг там только по карте, то не проблема, я тебе переведу за дорогу сразу же. Вот, потому что, по-моему, доставка они там только по карте.",
      type: "text",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
      skipAi: true,
      persist: false,
    });

    expect(result.level).toBe("suspicious");
    expect(result.reasons).toContain("fake_delivery_payment");
    expect(result.reasons).not.toContain("gambling_prediction_promo");
    expect(result.reasons).not.toContain("suspicious_invite_link");
    expect(result.reasons).not.toContain("crypto_casino_bonus_funnel");
  });

  it("keeps full embedded URL paths for local rules while provider URLs are minimized", async () => {
    const result = await runCheck({
      input: "Скачайте обновление https://files.example.test/private/update.apk",
      type: "text",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
      skipAi: true,
      skipUrlReputation: true,
      persist: false,
    });

    expect(result.reasons).toContain("apk_download_link");
    expect(result.level).not.toBe("safe");
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
    expect(result.phoneReputation).toMatchObject({
      source: "ishonch_guard_moderated_reports",
      confirmedReportCount: 7,
      confidence: "high",
      publicScope: "confirmed_moderated_reports_only",
    });
    expect(result.reasons).toContain("known_reported");
    expect(result.reasons).not.toContain("asks_to_install_apk");
    expect(result.level).toBe("high_risk");
  });

  it("localizes verified official contact metadata", async () => {
    const cases = [
      ["ru", "Национальный банк Узбекистана"],
      ["uz", "O'zbekiston Milliy banki"],
      ["en", "National Bank of Uzbekistan"],
    ] as const;

    for (const [lang, expectedName] of cases) {
      const result = await runCheck({
        input: "1344",
        lang,
        rateLimitKey: nextKey(),
        channel: "telegram",
        skipAi: true,
      });

      expect(result.level).toBe("safe");
      expect(result.verifiedContact).not.toBeNull();
      expect(result.verifiedContact!.orgName).toContain(expectedName);
      expect(result.verifiedContact!.display).toBe("1344");
      expect(result.verifiedContact!.verificationLevel).toBe("high");
      expect(result.verifiedContact!.description.length).toBeGreaterThan(0);
    }
  });

  it("dangerous requests override a verified official-looking contact", async () => {
    const result = await runCheck({
      input: "Позвоните 1344 и срочно скажите SMS-код 123456",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
      skipAi: true,
    });

    expect(result.verifiedContact).not.toBeNull();
    expect(result.verifiedContact!.orgName).toContain("Национальный банк");
    expect(result.reasons).toContain("asks_for_sms_code");
    expect(result.level).toBe("high_risk");
  });

  it("does not let an unlisted risk reason become Safe through a verified contact", async () => {
    const result = await runCheck({
      input: "Позвоните 1344: я сотрудник банка, срочно выполните инструкции",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
      skipAi: true,
      persist: false,
    });

    expect(result.verifiedContact).not.toBeNull();
    expect(result.reasons).toEqual(expect.arrayContaining(["impersonates_bank", "uses_urgency"]));
    expect(result.level).not.toBe("safe");
  });

  it("confirmed reports override a verified official-looking contact", async () => {
    hoisted.entityRow = {
      report_count: 3,
      moderation_status: "confirmed",
      risk_level: "high_risk",
    };

    const result = await runCheck({
      input: "+998712000044",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
      skipAi: true,
    });

    expect(result.verifiedContact).not.toBeNull();
    expect(result.knownReports).toBe(3);
    expect(result.reasons).toContain("known_reported");
    expect(result.level).toBe("high_risk");
  });

  it("enriches official-number near misses without changing risk scoring", async () => {
    const result = await runCheck({
      input: "1258",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
      skipAi: true,
    });

    expect(result.verifiedContact).toBeNull();
    expect(result.phoneIntelligence?.kind).toBe("short_code");
    expect(result.phoneIntelligence?.officialDirectoryStatus).toBe("not_found");
    expect(result.phoneIntelligence?.officialLookalike).toMatchObject({
      display: "1257",
      reason: "short_code_near_miss",
      confidence: "medium",
    });
    expect(result.level).toBe("unknown");
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it("does not verify country-code-prefixed short codes as official contacts", async () => {
    const result = await runCheck({
      input: "+9981340",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
      skipAi: true,
    });

    expect(result.verifiedContact).toBeNull();
    expect(result.phoneIntelligence?.officialDirectoryStatus).not.toBe("matched");
    expect(result.reasons).not.toContain("valid_uz_phone");
    expect(result.level).toBe("unknown");
    expect(result.score).toBe(0);
  });

  it("card and remote-access requests also override official contact matches", async () => {
    const cases = [
      ["Позвоните 1344 и назовите CVV карты", "asks_for_card_cvv"],
      ["Позвоните 1344 и включите демонстрацию экрана AnyDesk", "asks_to_share_screen"],
      ["Позвоните 1344 и переведите деньги на безопасный счёт", "asks_to_transfer_to_safe_account"],
    ] as const;

    for (const [input, code] of cases) {
      const result = await runCheck({
        input,
        lang: "ru",
        rateLimitKey: nextKey(),
        channel: "telegram",
        skipAi: true,
      });

      expect(result.verifiedContact).not.toBeNull();
      expect(result.reasons).toContain(code);
      expect(result.level).not.toBe("safe");
    }
  });
});
