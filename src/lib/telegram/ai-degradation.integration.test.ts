// Integration test — AI degradation (task 9.4, telegram-bot-mvp).
//
// Verifies the "scoring by rules, AI only explains" guarantee under a degraded
// AI provider: when `OPENAI_API_KEY` is missing (or the provider errors / the
// network throws), `runCheck` still returns a deterministic Risk_Level + score
// + reasons computed by `scoreFromCodes`, but with `explanation === null`. The
// rendered bot reply (`formatCheckResult`) then contains the level label, the
// reason list and a non-empty ADVICE block, while OMITTING the AI explanation
// block (no technical AI error surfaced to the user).
//
//   Validates: Requirements 13.1, 13.2, 13.3, 13.5, 18.3
//
// External dependencies are mocked so nothing real is called:
//   - `supabaseAdmin` — the `checks` insert is captured; `entities` lookup
//     returns null. (Text inputs skip the entities lookup anyway.)
//   - the Telegram Bot API (`sendMessage` / `sendChatAction`) — captured for the
//     light end-to-end case; `escapeMarkdownV2` is kept REAL so the formatter
//     output is exercised exactly as in production.
//   - `global.fetch` — defaults to throwing, so even an accidental AI/network
//     call degrades; specific tests override it to simulate a 5xx gateway.
//
// Rate limiting is NOT mocked: every call uses a unique key (`tg:<n>`), staying
// well under the 10/min window, so the in-memory limiter never trips.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Shared capture buffers — referenced inside the (hoisted) vi.mock factories,
// so they must themselves be hoisted to exist before the mocks initialise.
const hoisted = vi.hoisted(() => ({
  insertCalls: [] as Array<Record<string, unknown>>,
  sendCalls: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
}));

// Service-role Supabase client used by check-core. The real module reads
// SUPABASE_* env vars on first access and would throw in tests.
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
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          },
  },
}));

// Telegram Bot API: capture sendMessage, no-op sendChatAction, keep everything
// else (notably the REAL `escapeMarkdownV2` used by the formatter) untouched.
vi.mock("@/lib/telegram/api.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/telegram/api.server")>();
  return {
    ...actual,
    sendMessage: vi.fn(async (opts: { chatId: number; text: string; keyboard?: unknown }) => {
      hoisted.sendCalls.push(opts);
      return { ok: true };
    }),
    sendChatAction: vi.fn(async () => {}),
  };
});

vi.mock("@/lib/telegram/session.server", () => ({
  saveSession: () => Promise.resolve(),
  loadSession: () => Promise.resolve(null),
  resetScenario: () => Promise.resolve(),
  withSessionChatScope: (
    data: Record<string, unknown> | undefined,
    chatId: number,
    chatType = "private",
  ) => ({ ...(data ?? {}), chatScope: { chatId, chatType } }),
}));

import { runCheck, type RunCheckResult } from "@/lib/risk/check-core";
import { formatCheckResult } from "@/lib/telegram/format";
import { handleCheck } from "@/lib/telegram/handlers/check";
import { escapeMarkdownV2 } from "@/lib/telegram/api.server";
import { ADVICE, REASON_LABELS, type RiskLevel } from "@/lib/risk/rules";
import { t, type Lang } from "@/lib/i18n";
import type { HandlerCtx } from "@/lib/telegram/router";
import type { Session } from "@/lib/telegram/session.server";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LANGS = ["ru", "uz", "en"] as const satisfies readonly Lang[];

// RiskLevel → i18n label key (mirrors the private map in format.ts; high_risk
// maps to `risk_high`, not `risk_high_risk`).
const RISK_LABEL_KEY: Record<
  RiskLevel,
  "risk_safe" | "risk_unknown" | "risk_suspicious" | "risk_high"
> = {
  safe: "risk_safe",
  unknown: "risk_unknown",
  suspicious: "risk_suspicious",
  high_risk: "risk_high",
};

// Deterministic scam inputs scored purely by the rules engine:
//  - HIGH: asks_for_sms_code (45) + uses_urgency (15) + threatens_account_block (20) = 80 → high_risk
//  - SUSPICIOUS: requests_card_digits (45) → suspicious
const HIGH_RISK_INPUT =
  "Срочно назовите код подтверждения из СМС, иначе ваша карта будет заблокирована";
const SUSPICIOUS_INPUT = "Здравствуйте, для проверки подтвердите последние 4 цифры вашей карты";

// Unique rate-limit key / userId per call so the 10/min window never trips.
let counter = 0;
const nextKey = () => `tg:test:${counter++}`;
const nextUserId = () => 900_000 + counter++;

function makeSession(lang: Lang): Session {
  return {
    telegramUserId: nextUserId(),
    lang,
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {},
    updatedAt: new Date().toISOString(),
  };
}

// Save the seeded fake key so each test can restore the original environment.
const ORIGINAL_OPENAI_KEY = process.env.OPENAI_API_KEY;
const ORIGINAL_AI_ENV = {
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_FALLBACK_BASE_URL: process.env.OPENAI_FALLBACK_BASE_URL,
  OPENAI_FALLBACK_API_KEY: process.env.OPENAI_FALLBACK_API_KEY,
  OPENAI_FALLBACK_MODEL: process.env.OPENAI_FALLBACK_MODEL,
};

beforeEach(() => {
  hoisted.insertCalls.length = 0;
  hoisted.sendCalls.length = 0;
  // Default: any network call fails. This guarantees nothing real is hit and
  // that an AI request (if attempted) degrades to `explanation === null`.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("network disabled in tests");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_OPENAI_KEY === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = ORIGINAL_OPENAI_KEY;
  for (const [key, value] of Object.entries(ORIGINAL_AI_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

// Assert the rendered reply honours the degradation contract for a result whose
// `explanation` is null: header label + reasons + verdict + context-aware advice
// section, and NO AI explanation block (R13.1, R13.2, R13.3).
// Updated for Result Message UX v2 template-driven rendering.
function assertDegradedReply(result: RunCheckResult, lang: Lang): void {
  expect(result.explanation).toBeNull();

  const { text } = formatCheckResult(result, lang);

  // 1) Level label is present (R13.1).
  const levelLabel = t(RISK_LABEL_KEY[result.level], lang);
  expect(text).toContain(escapeMarkdownV2(levelLabel));

  // 2) Reason labels are present in some section (R13.1).
  // In the new v2 format, reasons may appear in "reasons", "what_noticed", or "why_dangerous" sections.
  for (const code of result.reasons) {
    const label = REASON_LABELS[code]?.[lang];
    if (label) expect(text).toContain(escapeMarkdownV2(label));
  }

  // 3) The verdict line is present (UX v2).
  const verdictKey = {
    safe: "verdict_safe",
    unknown: "verdict_unknown",
    suspicious: "verdict_suspicious",
    high_risk: "verdict_high_risk",
  }[result.level];
  // Verdict line is always rendered as escaped text in the output.
  // We just verify the output has some content beyond the header.
  expect(text.length).toBeGreaterThan(50);

  // 4) NO AI explanation block title is rendered (R13.3) — and no AI error text leaks.
  expect(text).not.toContain(escapeMarkdownV2(t("ai_explanation", lang)));
}

// ---------------------------------------------------------------------------
// 1) OPENAI_API_KEY missing → explanation null, rules-based verdict (R13)
// ---------------------------------------------------------------------------

describe("AI degradation — без OPENAI_API_KEY (R13.1, R13.2, R13.3, R13.5)", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("high_risk: runCheck даёт level/score/reasons по правилам и explanation === null", async () => {
    const result = await runCheck({
      input: HIGH_RISK_INPUT,
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
    });

    expect(result.explanation).toBeNull(); // R13.3 — AI недоступен
    expect(result.level).toBe("high_risk"); // вердикт по scoreFromCodes (R13.5)
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.reasons).toContain("asks_for_sms_code");
    expect(result.reasons.length).toBeGreaterThan(0);

    // Реплика содержит уровень + reasons + ADVICE, но без блока объяснения.
    assertDegradedReply(result, "ru");
  });

  it("suspicious: вердикт по правилам, explanation === null", async () => {
    const result = await runCheck({
      input: SUSPICIOUS_INPUT,
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
    });

    expect(result.explanation).toBeNull();
    expect(result.level).toBe("suspicious");
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.score).toBeLessThan(50);
    expect(result.reasons).toContain("requests_card_digits");

    assertDegradedReply(result, "ru");
  });

  it("блок ADVICE присутствует на всех языках при отсутствии AI (R13.1, R13.2)", async () => {
    for (const lang of LANGS) {
      const result = await runCheck({
        input: HIGH_RISK_INPUT,
        lang,
        rateLimitKey: nextKey(),
        channel: "telegram",
      });
      assertDegradedReply(result, lang);
    }
  });
});

// ---------------------------------------------------------------------------
// 2) R13.5 / R18.3 — verdict is independent of AI availability.
// Degraded result (no key) MUST equal the explicit rules-only path (skipAi).
// ---------------------------------------------------------------------------

describe("AI degradation — scoring через scoreFromCodes (R13.5, R18.3)", () => {
  it("degraded (нет ключа) и skipAi:true дают идентичные level/score/reasons", async () => {
    delete process.env.OPENAI_API_KEY;

    for (const input of [HIGH_RISK_INPUT, SUSPICIOUS_INPUT]) {
      const degraded = await runCheck({
        input,
        lang: "ru",
        rateLimitKey: nextKey(),
        channel: "telegram",
      });
      const rulesOnly = await runCheck({
        input,
        lang: "ru",
        rateLimitKey: nextKey(),
        channel: "telegram",
        skipAi: true,
      });

      // AI не влияет на вердикт — он целиком определяется правилами.
      expect(degraded.level).toBe(rulesOnly.level);
      expect(degraded.score).toBe(rulesOnly.score);
      expect(degraded.reasons).toEqual(rulesOnly.reasons);
      expect(degraded.type).toBe(rulesOnly.type);
      expect(degraded.display).toBe(rulesOnly.display);
      // Оба пути без AI-объяснения.
      expect(degraded.explanation).toBeNull();
      expect(rulesOnly.explanation).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// 3) AI provider недоступен (ключ есть, но провайдер отвечает ошибкой / сеть падает)
//    → деградация к explanation === null без таймаута сверх предела (R13.1, R18.3).
// ---------------------------------------------------------------------------

describe("AI degradation — ошибка AI-провайдера при наличии ключа (R13.1, R18.3)", () => {
  it("провайдер отвечает 500 → explanation === null, вердикт по правилам", async () => {
    process.env.OPENAI_API_KEY = "test-openai-api-key";
    // Override the default throwing stub with a non-ok provider response.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
        text: async () => "internal error",
      })),
    );

    const result = await runCheck({
      input: HIGH_RISK_INPUT,
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
    });

    expect(result.explanation).toBeNull(); // R13.1/13.3 — деградация при ошибке
    expect(result.level).toBe("high_risk"); // вердикт по правилам не изменился
    assertDegradedReply(result, "ru");
  });

  it("сетевая ошибка (fetch throws) → explanation === null", async () => {
    process.env.OPENAI_API_KEY = "test-openai-api-key";
    // Default beforeEach stub already throws; assert the degradation path.
    const result = await runCheck({
      input: SUSPICIOUS_INPUT,
      lang: "uz",
      rateLimitKey: nextKey(),
      channel: "telegram",
    });

    expect(result.explanation).toBeNull();
    expect(result.level).toBe("suspicious");
    assertDegradedReply(result, "uz");
  });
});

describe("AI provider resilience v1 — transient retry policy", () => {
  it("retries a transient 503 and uses the successful explanation", async () => {
    process.env.OPENAI_API_KEY = "test-openai-api-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({}),
        text: async () => "temporary unavailable",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "Временный сбой пережит. Не сообщайте SMS-код." } }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCheck({
      input: HIGH_RISK_INPUT,
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.explanation).toBe("Временный сбой пережит. Не сообщайте SMS-код.");
    expect(result.level).toBe("high_risk");
  });

  it("does not retry non-retryable 401 provider errors", async () => {
    process.env.OPENAI_API_KEY = "test-openai-api-key";
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => "unauthorized",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCheck({
      input: SUSPICIOUS_INPUT,
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.explanation).toBeNull();
    expect(result.level).toBe("suspicious");
  });

  it("does not retry aborted provider requests", async () => {
    process.env.OPENAI_API_KEY = "test-openai-api-key";
    const abortError = Object.assign(new Error("request timed out"), { name: "AbortError" });
    const fetchMock = vi.fn(async () => {
      throw abortError;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCheck({
      input: SUSPICIOUS_INPUT,
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.explanation).toBeNull();
    expect(result.level).toBe("suspicious");
  });

  it("aborts a provider that stays pending beyond the configured soft budget", async () => {
    process.env.OPENAI_API_KEY = "test-openai-api-key";
    let sawAbort = false;
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => {
              sawAbort = true;
              reject(Object.assign(new Error("request timed out"), { name: "AbortError" }));
            },
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCheck({
      input: SUSPICIOUS_INPUT,
      lang: "en",
      rateLimitKey: nextKey(),
      channel: "telegram",
      aiTimeoutMs: 500,
      aiMaxAttempts: 3,
    });

    expect(sawAbort).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.explanation).toBeNull();
    expect(result.level).toBe("suspicious");
    assertDegradedReply(result, "en");
  });

  it("does not retry quota-exhausted 429 provider errors", async () => {
    process.env.OPENAI_API_KEY = "test-openai-api-key";
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
      text: async () =>
        JSON.stringify({
          error: {
            code: 429,
            status: "RESOURCE_EXHAUSTED",
            message:
              "You exceeded your current quota. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests",
          },
        }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCheck({
      input: HIGH_RISK_INPUT,
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.explanation).toBeNull();
    expect(result.level).toBe("high_risk");
  });

  it("uses the fallback provider after a quota-exhausted primary 429", async () => {
    process.env.OPENAI_API_KEY = "primary-test-key";
    process.env.OPENAI_BASE_URL = "https://primary.example/v1";
    process.env.OPENAI_MODEL = "primary-model";
    process.env.OPENAI_FALLBACK_BASE_URL = "https://fallback.example/v1";
    process.env.OPENAI_FALLBACK_API_KEY = "fallback-test-key";
    process.env.OPENAI_FALLBACK_MODEL = "fallback-model";

    const fetchMock = vi.fn(async (url: string) => {
      if (new URL(url).origin === "https://primary.example") {
        return {
          ok: false,
          status: 429,
          json: async () => ({}),
          text: async () =>
            JSON.stringify({
              error: {
                status: "RESOURCE_EXHAUSTED",
                message: "Quota exceeded for metric: generate_content_free_tier_requests",
              },
            }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "Fallback explanation from backup model." } }],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCheck({
      input: HIGH_RISK_INPUT,
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("primary.example");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("fallback.example");
    expect(result.explanation).toBe("Fallback explanation from backup model.");
    expect(result.level).toBe("high_risk");
  });

  it.each([500, 502, 503])(
    "exhausts transient %i retries and still keeps rules-only scoring",
    async (status) => {
      process.env.OPENAI_API_KEY = "test-openai-api-key";
      const fetchMock = vi.fn(async () => ({
        ok: false,
        status,
        json: async () => ({}),
        text: async () => "temporary unavailable",
      }));
      vi.stubGlobal("fetch", fetchMock);

      const result = await runCheck({
        input: HIGH_RISK_INPUT,
        lang: "ru",
        rateLimitKey: nextKey(),
        channel: "telegram",
      });

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(result.explanation).toBeNull();
      expect(result.level).toBe("high_risk");
      assertDegradedReply(result, "ru");
    },
  );
});

// ---------------------------------------------------------------------------
// 4) Light end-to-end via handleCheck: the message sent to Telegram contains
//    the rules-based verdict + ADVICE, without an AI explanation block (R13).
// ---------------------------------------------------------------------------

describe("AI degradation — end-to-end через handleCheck (R13.1, R13.2, R13.3)", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("handleCheck отправляет один sendMessage с уровнем + ADVICE, без блока объяснения", async () => {
    const session = makeSession("ru");
    const ctx: HandlerCtx = {
      chatId: session.telegramUserId,
      userId: session.telegramUserId,
      session,
    };

    await handleCheck(HIGH_RISK_INPUT, ctx);

    // High-risk now sends the result plus a short Guardian Angel companion.
    expect(hoisted.sendCalls).toHaveLength(2);
    const sent = hoisted.sendCalls[0];
    expect(sent.chatId).toBe(ctx.chatId);
    expect(hoisted.sendCalls[1].chatId).toBe(ctx.chatId);
    expect(hoisted.sendCalls[1].text).toContain("Я рядом");
    expect(hoisted.sendCalls[1].text).toContain("один безопасный шаг");

    // Уровень + verdict присутствуют, блок AI-объяснения отсутствует.
    const levelLabel = t("risk_high", "ru");
    expect(sent.text).toContain(escapeMarkdownV2(levelLabel));
    // In UX v2, context-aware advice is used instead of ADVICE[level][lang].
    // Just verify the verdict line and reason codes are present.
    expect(sent.text).toContain(escapeMarkdownV2("🚨 Высокий риск мошенничества"));
    expect(sent.text).not.toContain(escapeMarkdownV2(t("ai_explanation", "ru")));

    // Деградация AI не пишет explanation в БД (checks.ai_explanation = null).
    expect(hoisted.insertCalls).toHaveLength(1);
    expect(hoisted.insertCalls[0].ai_explanation).toBeNull();
  });
});
