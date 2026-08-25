import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REASON_LABELS, type ReasonCode } from "@/lib/risk/rules";
import type { Session } from "@/lib/telegram/session.server";

const hoisted = vi.hoisted(() => ({
  runCheckCalls: [] as Array<Record<string, unknown>>,
  answerCalls: [] as Array<{
    inlineQueryId: string;
    results: unknown[];
    cacheTime?: number;
    isPersonal?: boolean;
  }>,
  nextResult: null as null | Record<string, unknown>,
  nextError: null as null | Error,
  nextAnswerResult: null as null | {
    ok: boolean;
    errorCode?: number;
    description?: string;
    retryAfterSec?: number;
  },
  answerResults: [] as Array<{
    ok: boolean;
    errorCode?: number;
    description?: string;
    retryAfterSec?: number;
  }>,
  sessionWriteCalls: [] as Array<unknown>,
  escapeMarkdown: false,
}));

vi.mock("@/lib/risk/check-core", () => ({
  runCheck: vi.fn(async (params: Record<string, unknown>) => {
    hoisted.runCheckCalls.push(params);
    if (hoisted.nextError) throw hoisted.nextError;
    return (
      hoisted.nextResult ?? {
        type: "telegram",
        display: "@lu•••mo",
        level: "suspicious",
        score: 25,
        reasons: ["suspicious_invite_link"],
        explanation: null,
        knownReports: 0,
        verifiedContact: null,
        brandEvidence: [],
      }
    );
  }),
}));

vi.mock("@/lib/telegram/api.server", () => ({
  answerInlineQuery: vi.fn(
    async (opts: {
      inlineQueryId: string;
      results: unknown[];
      cacheTime?: number;
      isPersonal?: boolean;
    }) => {
      hoisted.answerCalls.push(opts);
      return hoisted.answerResults.shift() ?? hoisted.nextAnswerResult ?? { ok: true };
    },
  ),
  escapeMarkdownV2: (value: string) =>
    hoisted.escapeMarkdown
      ? [...value]
          .map((character) =>
            "_*[]()~`>#+-=|{}.!".includes(character) ? `\\${character}` : character,
          )
          .join("")
      : value,
}));

vi.mock("@/lib/telegram/session.server", () => ({
  saveSession: vi.fn(async (...args: unknown[]) => {
    hoisted.sessionWriteCalls.push(args);
  }),
}));

import { handleInlineQuery } from "@/lib/telegram/handlers/inline";

const session: Session = {
  telegramUserId: 42,
  lang: "ru",
  scenario: "none",
  scenarioStep: 0,
  scenarioData: {},
  updatedAt: new Date(0).toISOString(),
};

const SCOPED_ARTICLE_ID_SUFFIX = /^[A-Za-z0-9_-]{16}$/u;

function scopedArticleSemanticId(actual: string, label?: string): string {
  expect(
    [...actual].every((character) => (character.codePointAt(0) ?? 128) <= 127),
    label,
  ).toBe(true);
  expect(new TextEncoder().encode(actual).length, label).toBeLessThanOrEqual(64);
  expect(actual.length, label).toBeGreaterThan(17);
  expect(actual.at(-17), label).toBe("-");

  const semanticId = actual.slice(0, -17);
  const suffix = actual.slice(-16);
  expect(semanticId, label).toMatch(/^[A-Za-z0-9_-]{1,47}$/u);
  expect(suffix, label).toMatch(SCOPED_ARTICLE_ID_SUFFIX);
  return semanticId;
}

function expectScopedArticleId(actual: string, expectedSemanticId: string, label?: string): void {
  expect(scopedArticleSemanticId(actual, label), label).toBe(expectedSemanticId);
}

describe("handleInlineQuery", () => {
  beforeEach(() => {
    hoisted.runCheckCalls.length = 0;
    hoisted.answerCalls.length = 0;
    hoisted.nextResult = null;
    hoisted.nextError = null;
    hoisted.nextAnswerResult = null;
    hoisted.answerResults.length = 0;
    hoisted.sessionWriteCalls.length = 0;
    hoisted.escapeMarkdown = false;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a help article for an empty inline query", async () => {
    await handleInlineQuery("   ", { userId: 42, session }, "iq-help");

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.answerCalls).toHaveLength(1);
    expect(hoisted.answerCalls[0]).toMatchObject({
      inlineQueryId: "iq-help",
      cacheTime: 10,
      isPersonal: true,
    });
    const article = hoisted.answerCalls[0].results[0] as { type: string; id: string };
    expect(article.type).toBe("article");
    expectScopedArticleId(article.id, "help");
  });

  it("uses a validated configured bot username in Inline copy and the continue button", async () => {
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "@custom_guard_bot");

    await handleInlineQuery("   ", { userId: 42, session }, "iq-custom-bot");

    const article = hoisted.answerCalls[0].results[0] as {
      input_message_content: { message_text: string };
      reply_markup: { inline_keyboard: Array<Array<{ url?: string }>> };
    };
    expect(article.input_message_content.message_text).toContain("@custom_guard_bot");
    expect(article.input_message_content.message_text).not.toContain("@scamguard_bot");
    expect(article.reply_markup.inline_keyboard[0][0].url).toBe("https://t.me/custom_guard_bot");
  });

  it("falls back to the canonical bot when the configured username is not a Telegram username", async () => {
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "bad/name?next=https://evil.example");

    await handleInlineQuery("   ", { userId: 42, session }, "iq-invalid-bot");

    const article = hoisted.answerCalls[0].results[0] as {
      input_message_content: { message_text: string };
      reply_markup: { inline_keyboard: Array<Array<{ url?: string }>> };
    };
    expect(article.input_message_content.message_text).toContain("@scamguard_bot");
    expect(article.reply_markup.inline_keyboard[0][0].url).toBe("https://t.me/scamguard_bot");
    expect(JSON.stringify(article)).not.toContain("evil.example");
  });

  it("redacts an unlabeled numeric value from a preflight article", async () => {
    await handleInlineQuery(
      "мне пишет какой то незнакомый человек 123456",
      { userId: 42, session },
      "iq-preflight-secret",
    );

    expect(hoisted.runCheckCalls).toHaveLength(0);
    const articleJson = JSON.stringify(hoisted.answerCalls[0].results[0]);
    expect(articleJson).not.toContain("123456");
    expect(articleJson).toContain("••••");
  });

  it.each([
    {
      name: "text secrets",
      type: "text",
      display: "код 123456 карта 8600123412341234 email alice@example.com",
      forbidden: ["123456", "8600123412341234", "alice@example.com"],
    },
    {
      name: "URL path token",
      type: "url",
      display: "https://evil.example/reset/SECRET-TOKEN",
      forbidden: ["SECRET-TOKEN", "/reset/"],
    },
    {
      name: "malformed URL path token",
      type: "url",
      display: "https://%zz/reset/SECRET-TOKEN",
      forbidden: ["SECRET-TOKEN", "/reset/", "%zz"],
    },
  ])(
    "sanitizes $name even if an upstream result exposes raw display",
    async ({ type, display, forbidden }) => {
      hoisted.nextResult = {
        type,
        display,
        level: "suspicious",
        score: 25,
        reasons: ["weird_domain"],
        explanation: null,
        knownReports: 0,
        verifiedContact: null,
        brandEvidence: [],
      };

      await handleInlineQuery("https://example.com/check", { userId: 42, session }, "iq-display");

      const articleJson = JSON.stringify(hoisted.answerCalls[0].results[0]);
      for (const secret of forbidden) expect(articleJson).not.toContain(secret);
    },
  );

  it("rejects synthetic inline queries above the Bot API 256-character boundary", async () => {
    await handleInlineQuery("x".repeat(257), { userId: 42, session }, "iq-too-long");

    expect(hoisted.runCheckCalls).toHaveLength(0);
    const article = hoisted.answerCalls[0].results[0] as { id: string };
    expectScopedArticleId(article.id, "too-long");
  });

  it("preserves a 256-character inline query at the Bot API boundary", async () => {
    await handleInlineQuery("x".repeat(256), { userId: 42, session }, "iq-max-length");

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0]).toMatchObject({ input: "x".repeat(256) });
  });

  it.each([1, 255])("preserves a %i-character inline query below the boundary", async (length) => {
    const query = "я".repeat(length);

    await handleInlineQuery(query, { userId: 42, session }, `iq-length-${length}`);

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0]).toMatchObject({ input: query });
  });

  it("counts astral Unicode input as characters instead of UTF-16 code units", async () => {
    const accepted = "🙂".repeat(256);

    await handleInlineQuery(accepted, { userId: 42, session }, "iq-unicode-max");

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0]).toMatchObject({ input: accepted });

    hoisted.runCheckCalls.length = 0;
    hoisted.answerCalls.length = 0;
    await handleInlineQuery("🙂".repeat(257), { userId: 42, session }, "iq-unicode-too-long");

    expect(hoisted.runCheckCalls).toHaveLength(0);
    const article = hoisted.answerCalls[0].results[0] as { id: string };
    expectScopedArticleId(article.id, "too-long");
  });

  it("reports a Bot API answer failure without logging the query or result", async () => {
    hoisted.nextAnswerResult = {
      ok: false,
      errorCode: 400,
      description: "Bad Request: query is too old",
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await handleInlineQuery("что мне делать дальше?", { userId: 42, session }, "iq-failed");

    expect(errorSpy).toHaveBeenCalledWith("telegram inline answer failed", 400);
    expect(errorSpy.mock.calls.flat().join(" ")).not.toContain("что мне делать");
  });

  it("retries one transient Bot API failure and delivers the original result", async () => {
    hoisted.answerResults.push({ ok: false, errorCode: 502 }, { ok: true });

    await handleInlineQuery("что мне делать дальше?", { userId: 42, session }, "iq-retry-502");

    expect(hoisted.answerCalls).toHaveLength(2);
    expect(hoisted.answerCalls[0]).toEqual(hoisted.answerCalls[1]);
    expect(hoisted.answerCalls[0].cacheTime).toBe(10);
  });

  it.each([
    [{ ok: false }, { ok: false }],
    [
      { ok: false, errorCode: 500, description: "Internal Server Error" },
      { ok: false, errorCode: 503, description: "Service Unavailable" },
    ],
  ])(
    "propagates exhausted transient delivery so polling can retry the update",
    async (first, second) => {
      hoisted.answerResults.push(first, second);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(
        handleInlineQuery(
          "уникальный секретный текст пользователя",
          { userId: 42, session },
          "iq-transient-failure",
        ),
      ).rejects.toMatchObject({
        name: "TelegramInlineAnswerDeliveryError",
        message: "telegram_inline_answer_transient",
      });

      expect(hoisted.answerCalls).toHaveLength(2);
      expect(errorSpy).toHaveBeenCalledWith(
        "telegram inline answer transient",
        "errorCode" in second ? (second.errorCode ?? "network") : "network",
      );
      expect(errorSpy.mock.calls.flat().join(" ")).not.toContain("уникальный секретный");
    },
  );

  it("does not immediately retry a 429 and propagates Telegram's bounded retry_after", async () => {
    hoisted.nextAnswerResult = {
      ok: false,
      errorCode: 429,
      description: "Too Many Requests",
      retryAfterSec: 17,
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      handleInlineQuery(
        "уникальный секретный текст пользователя",
        { userId: 42, session },
        "iq-retry-after",
      ),
    ).rejects.toMatchObject({
      name: "TelegramInlineAnswerDeliveryError",
      message: "telegram_inline_answer_transient",
      retryAfterMs: 17_000,
    });

    expect(hoisted.answerCalls).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalledWith("telegram inline answer transient", 429);
    expect(errorSpy.mock.calls.flat().join(" ")).not.toContain("уникальный секретный");
  });

  it("caps an excessive Telegram retry_after before lifecycle replay", async () => {
    hoisted.nextAnswerResult = {
      ok: false,
      errorCode: 429,
      description: "Too Many Requests",
      retryAfterSec: 86_400,
    };
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      handleInlineQuery("проверьте ссылку", { userId: 42, session }, "iq-retry-cap"),
    ).rejects.toMatchObject({ retryAfterMs: 60_000 });

    expect(hoisted.answerCalls).toHaveLength(1);
  });

  it("uses retry_after when an immediate 5xx retry is then rate-limited", async () => {
    hoisted.answerResults.push(
      { ok: false, errorCode: 502, description: "Bad Gateway" },
      {
        ok: false,
        errorCode: 429,
        description: "Too Many Requests",
        retryAfterSec: 9,
      },
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      handleInlineQuery("проверьте ссылку", { userId: 42, session }, "iq-502-429"),
    ).rejects.toMatchObject({ retryAfterMs: 9_000 });

    expect(hoisted.answerCalls).toHaveLength(2);
  });

  it("does not retry a permanent forbidden/expired Inline query failure", async () => {
    hoisted.nextAnswerResult = {
      ok: false,
      errorCode: 403,
      description: "Forbidden",
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await handleInlineQuery("что мне делать дальше?", { userId: 42, session }, "iq-forbidden");

    expect(hoisted.answerCalls).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalledWith("telegram inline answer failed", 403);
  });

  it("retries a Telegram entity-parse failure once without parse_mode", async () => {
    hoisted.nextResult = {
      type: "text",
      display: "SMS code request",
      level: "high_risk",
      score: 60,
      reasons: ["asks_for_sms_code"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };
    hoisted.escapeMarkdown = true;
    hoisted.answerResults.push(
      {
        ok: false,
        errorCode: 400,
        description: "Bad Request: can't parse entities",
      },
      { ok: true },
    );

    await handleInlineQuery("скажите код из SMS", { userId: 42, session }, "iq-parse");

    expect(hoisted.answerCalls).toHaveLength(2);
    const first = hoisted.answerCalls[0].results[0] as {
      id: string;
      input_message_content: { message_text: string; parse_mode?: string };
    };
    const retry = hoisted.answerCalls[1].results[0] as {
      id: string;
      input_message_content: { message_text: string; parse_mode?: string };
    };
    expectScopedArticleId(first.id, "check-high_risk-code-request");
    expect(retry.id).toBe(first.id);
    expect(first.input_message_content.message_text).toContain("\\");
    expect(retry.input_message_content.parse_mode).toBeUndefined();
    expect(retry.input_message_content.message_text).not.toContain("\\");
    expect(retry.input_message_content.message_text).toContain("@scamguard_bot");
    expect(retry.input_message_content.message_text.split("\n").slice(0, 2)).toEqual([
      expect.stringContaining("Высокий риск"),
      "Безопасный шаг: Не сообщайте SMS-код или PIN.",
    ]);
  });

  it("keeps scoped article IDs deterministic for the same content and fresh for an edited query", async () => {
    const firstQuery = "спасибо";
    const changedQuery = "спасибо!";

    await handleInlineQuery(firstQuery, { userId: 42, session }, "iq-id-first");
    await handleInlineQuery(firstQuery, { userId: 42, session }, "iq-id-repeat");
    await handleInlineQuery(changedQuery, { userId: 42, session }, "iq-id-changed");

    const [first, repeat, changed] = hoisted.answerCalls.map(
      (call) => call.results[0] as { id: string },
    );
    expectScopedArticleId(first.id, "small-talk-thanks");
    expectScopedArticleId(repeat.id, "small-talk-thanks");
    expectScopedArticleId(changed.id, "small-talk-thanks");
    expect(repeat.id).toBe(first.id);
    expect(changed.id).not.toBe(first.id);
  });

  it("propagates a transient failure of the plaintext entity fallback", async () => {
    hoisted.answerResults.push(
      { ok: false, errorCode: 400, description: "Bad Request: can't parse entities" },
      { ok: false, errorCode: 503, description: "Service Unavailable" },
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      handleInlineQuery("скажите код из SMS", { userId: 42, session }, "iq-parse-transient"),
    ).rejects.toMatchObject({ name: "TelegramInlineAnswerDeliveryError" });

    expect(hoisted.answerCalls).toHaveLength(2);
    expect(errorSpy).toHaveBeenCalledWith("telegram inline answer transient", 503);
  });

  it("does not republish credential classes in Markdown or plaintext retry messages", async () => {
    const markers = [
      "Correct-Horse-Battery-Staple",
      "12 34 56",
      "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
    ];
    hoisted.nextResult = {
      type: "text",
      display: `password = ${markers[0]}; OTP: ${markers[1]}; ` + `seed phrase: ${markers[2]}`,
      level: "suspicious",
      score: 25,
      reasons: ["asks_for_password"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };
    hoisted.escapeMarkdown = true;
    hoisted.answerResults.push(
      { ok: false, errorCode: 400, description: "Bad Request: can't parse entities" },
      { ok: true },
    );

    await handleInlineQuery("ordinary check payload", { userId: 42, session }, "iq-secrets");

    expect(hoisted.answerCalls).toHaveLength(2);
    for (const call of hoisted.answerCalls) {
      const article = call.results[0] as {
        input_message_content: { message_text: string };
      };
      for (const marker of markers) {
        expect(article.input_message_content.message_text).not.toContain(marker);
      }
    }
  });

  it("runs a non-persistent rules-only check for a non-empty query", async () => {
    await handleInlineQuery("https://t.me/+abcdef", { userId: 42, session }, "iq-check");

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0]).toMatchObject({
      input: "https://t.me/+abcdef",
      lang: "ru",
      rateLimitKey: "tg:inline:42",
      channel: "telegram",
      skipAi: true,
      skipUrlReputation: true,
      persist: false,
      rateLimitProfile: "telegram_inline_preview",
    });
    expect(hoisted.answerCalls).toHaveLength(1);
    const article = hoisted.answerCalls[0].results[0] as {
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expect(article.title).toContain("Требуется осторожность");
    expect(article.description).toContain("invite");
    expect(article.input_message_content.message_text).toContain("@scamguard_bot");
  });

  it.each([
    {
      lang: "ru" as const,
      query: "назовите SMS-код",
      title: "Высокий риск",
      stepLabel: "Безопасный шаг",
      step: "Не сообщайте SMS-код или PIN.",
      checkedBy: "Проверено через Ishonch Guard",
      reasonLabel: "Что заметил",
    },
    {
      lang: "uz" as const,
      query: "SMS-kodni ayting",
      title: "Yuqori xavf",
      stepLabel: "Xavfsiz qadam",
      step: "SMS-kod yoki PIN-ni aytmang.",
      checkedBy: "Ishonch Guard orqali tekshirildi",
      reasonLabel: "Nima ko'rindi",
    },
    {
      lang: "en" as const,
      query: "send the SMS code",
      title: "High risk",
      stepLabel: "Safe step",
      step: "Do not share your SMS code or PIN.",
      checkedBy: "Checked by Ishonch Guard",
      reasonLabel: "What I noticed",
    },
  ])(
    "leads with the full safe action in $lang high-risk preview and inserted message",
    async ({ lang, query, title, stepLabel, step, checkedBy, reasonLabel }) => {
      hoisted.nextResult = {
        type: "text",
        display: "SMS code request",
        level: "high_risk",
        score: 60,
        reasons: ["asks_to_scan_qr", "asks_for_sms_code"],
        explanation: null,
        knownReports: 0,
        verifiedContact: null,
        brandEvidence: [],
      };

      await handleInlineQuery(
        query,
        { userId: 42, session: { ...session, lang } },
        `iq-high-${lang}`,
      );

      const article = hoisted.answerCalls[0].results[0] as {
        title: string;
        description: string;
        input_message_content: { message_text: string };
      };
      expect(article.title).toContain(title);
      expect(article.description.startsWith(step)).toBe(true);
      expect(article.description).toContain(REASON_LABELS.asks_for_sms_code[lang]);
      expect(article.description.length).toBeLessThanOrEqual(120);

      const message = article.input_message_content.message_text;
      expect(message.split("\n").slice(0, 2)).toEqual([
        expect.stringContaining(title),
        `${stepLabel}: ${step}`,
      ]);
      expect(message.indexOf(stepLabel)).toBeLessThan(message.indexOf(checkedBy));
      expect(message.indexOf(stepLabel)).toBeLessThan(message.indexOf(reasonLabel));
    },
  );

  it("renders the actual weird-domain heuristic and limitation", async () => {
    hoisted.nextResult = {
      type: "url",
      display: "https://paypa1.example",
      level: "suspicious",
      score: 30,
      reasons: ["weird_domain"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };

    await handleInlineQuery(
      "https://paypa1.example",
      { userId: 42, session: { ...session, lang: "en" } },
      "iq-domain-method",
    );

    const article = hoisted.answerCalls[0].results[0] as {
      input_message_content: { message_text: string };
    };
    const message = article.input_message_content.message_text;
    expect(message).toContain("Suspicious domain");
    expect(message).toMatch(/unusual domain ending|IP address|invalid URL\/domain format/i);
    expect(message).not.toContain("known brand variants");
    expect(message).toContain("do not prove ownership");
  });

  it("presents an official-directory match even when scoring reasons are empty", async () => {
    hoisted.nextResult = {
      type: "text",
      display: "1340",
      level: "safe",
      score: 0,
      reasons: [],
      explanation: null,
      knownReports: 0,
      verifiedContact: {
        orgName: "Example Bank",
        orgType: "bank",
        source: "https://example.test",
        display: "1340",
        contactType: "short_code",
        verificationLevel: "high",
        description: "Test fixture",
      },
      brandEvidence: [],
    };

    await handleInlineQuery(
      // The explicit phone marker disambiguates the public short code from a
      // bare four-digit OTP/PIN, which must stay on the private Inline card.
      "+1340",
      { userId: 42, session: { ...session, lang: "en" } },
      "iq-official-method",
    );

    const article = hoisted.answerCalls[0].results[0] as {
      input_message_content: { message_text: string };
    };
    expect(article.input_message_content.message_text).toContain(
      "exact match in the verified official directory",
    );
  });

  it("uses explicit evidence priority when several reasons are returned", async () => {
    hoisted.nextResult = {
      type: "url",
      display: "https://danger.example",
      level: "high_risk",
      score: 80,
      reasons: ["valid_uz_phone", "weird_domain", "external_phishing_url"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };

    await handleInlineQuery(
      "https://danger.example",
      { userId: 42, session: { ...session, lang: "en" } },
      "iq-reason-priority",
    );

    const article = hoisted.answerCalls[0].results[0] as {
      input_message_content: { message_text: string };
    };
    expect(article.input_message_content.message_text).toContain(
      "configured external reputation source",
    );
    expect(article.input_message_content.message_text).not.toContain("phone format");
  });

  it("renders every reason through suspicious and action-first high-risk Inline paths", async () => {
    const allReasons = Object.keys(REASON_LABELS) as ReasonCode[];
    const stepLabels = {
      ru: "Безопасный шаг:",
      uz: "Xavfsiz qadam:",
      en: "Safe step:",
    } as const;

    for (const lang of ["ru", "uz", "en"] as const) {
      for (const level of ["suspicious", "high_risk"] as const) {
        for (const [index, reason] of allReasons.entries()) {
          hoisted.answerCalls.length = 0;
          hoisted.nextResult = {
            type: "text",
            display: "bounded test value",
            level,
            score: level === "high_risk" ? 60 : 30,
            reasons: [reason],
            explanation: null,
            knownReports: 0,
            verifiedContact: null,
            brandEvidence: [],
          };

          await handleInlineQuery(
            `https://example.com/inline-${index}`,
            { userId: 42, session: { ...session, lang } },
            `iq-all-reasons-${lang}-${level}-${index}`,
          );

          const article = hoisted.answerCalls[0].results[0] as {
            description: string;
            input_message_content: { message_text: string };
          };
          const message = article.input_message_content.message_text;
          expect(message, `${reason}:${lang}:${level}`).toContain(REASON_LABELS[reason][lang]);
          expect(message, `${reason}:${lang}:${level}`).not.toContain("undefined");
          expect(message.length, `${reason}:${lang}:${level}:message length`).toBeLessThanOrEqual(
            4096,
          );
          expect(
            article.description.length,
            `${reason}:${lang}:${level}:description length`,
          ).toBeLessThanOrEqual(120);

          if (level === "high_risk" || reason !== "requests_personal_data") {
            const actionLine = message.split("\n")[1] ?? "";
            expect(actionLine, `${reason}:${lang}:action line`).toMatch(
              new RegExp(`^${stepLabels[lang]}\\s+`, "u"),
            );
            const action = actionLine.slice(stepLabels[lang].length).trim();
            expect(action.length, `${reason}:${lang}:action`).toBeGreaterThan(0);
            expect(article.description.startsWith(action), `${reason}:${lang}:preview action`).toBe(
              true,
            );
          }
        }
      }
    }
  });

  it("shows retry seconds for rate-limited inline checks", async () => {
    hoisted.nextError = Object.assign(new Error("rate_limited"), {
      status: 429,
      retryAfter: 17,
    });

    await handleInlineQuery("проверить номер", { userId: 42, session }, "iq-rate");

    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expectScopedArticleId(article.id, "rate-limited");
    expect(article.title).toBe("Слишком много проверок");
    expect(article.description).toContain("17 сек");
    expect(article.input_message_content.message_text).toContain("17 сек");
    expect(hoisted.answerCalls[0].cacheTime).toBe(0);
  });

  it("does not cache a transient Inline failure", async () => {
    hoisted.nextError = new Error("temporary failure");

    await handleInlineQuery("неизвестный запрос", { userId: 42, session }, "iq-error");

    const article = hoisted.answerCalls[0].results[0] as { id: string };
    expectScopedArticleId(article.id, "error");
    expect(hoisted.answerCalls[0].cacheTime).toBe(0);
  });

  it.each([
    ["ru", "12345678", "Код или неполный номер"],
    ["uz", "12 34 56", "Kod yoki to'liq bo'lmagan raqam"],
    ["en", "123-4567", "Code or incomplete number"],
    ["ru", "4821", "Код или неполный номер"],
    ["uz", "48 392", "Kod yoki to'liq bo'lmagan raqam"],
    ["en", "4222 2222 2222 2", "Code or incomplete number"],
    ["ru", "4111 1111 1111 1111", "Код или неполный номер"],
    ["uz", "4000 0000 0000 0000 006", "Kod yoki to'liq bo'lmagan raqam"],
  ] as const)(
    "keeps an ambiguous short numeric %s query out of phone passports and visible output",
    async (lang, query, expectedTitle) => {
      await handleInlineQuery(
        query,
        { userId: 42, session: { ...session, lang } },
        `iq-ambiguous-${lang}`,
      );

      expect(hoisted.runCheckCalls).toHaveLength(0);
      const article = hoisted.answerCalls[0].results[0] as {
        id: string;
        title: string;
        description: string;
        input_message_content: { message_text: string };
      };
      expectScopedArticleId(article.id, "ambiguous-numeric");
      expect(article.title).toBe(expectedTitle);
      expect(article.description).toMatch(/(?:код|kod|code|number|raqam|номер)/iu);
      expect(JSON.stringify(article)).not.toContain(query.replace(/\D/gu, ""));
      expect(article.input_message_content.message_text).toContain("@scamguard_bot");
    },
  );

  it("keeps a nine-digit Uzbekistan local number on the phone-check path", async () => {
    await handleInlineQuery("901234567", { userId: 42, session }, "iq-nine-digit-phone");

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0]).toMatchObject({ input: "901234567" });
  });

  it.each(["901234567", "123456789012", "4111111111111112", "в 2026 году", "цена 15000 сум"])(
    "does not broadly classify an ordinary numeric query as a private value: %s",
    async (query) => {
      await handleInlineQuery(query, { userId: 42, session }, `iq-ordinary-number-${query.length}`);

      const article = hoisted.answerCalls[0].results[0] as { id: string };
      expect(scopedArticleSemanticId(article.id)).not.toMatch(/^(?:ambiguous-numeric|private-)/u);
    },
  );

  it("treats a standalone three-digit value as a private potential CVV", async () => {
    await handleInlineQuery("123", { userId: 42, session }, "iq-private-three-digit");

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sessionWriteCalls).toHaveLength(0);
    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      input_message_content: { message_text: string };
    };
    expectScopedArticleId(article.id, "private-code");
    expect(JSON.stringify(article)).not.toContain("123");
  });

  it.each([
    {
      text: "работодатель просит оплатить обучение перед работой",
      id: "check-unknown-job-offer",
      title: "Работа: не платите взнос",
    },
    {
      text: "агентство обещает визу в Корею но просит предоплату",
      id: "check-unknown-travel-migration-prepayment",
      title: "Виза/тур: не платите заранее",
    },
    {
      text: "турфирма просит оплатить хадж заранее",
      id: "check-unknown-travel-migration-prepayment",
      title: "Виза/тур: не платите заранее",
    },
    {
      text: "девушка из интернета просит деньги на билет",
      id: "check-unknown-romance-money",
      title: "Отношения: деньги не отправляйте",
    },
  ])("preflights social/economic inline phrase '$text'", async ({ text, id, title }) => {
    hoisted.nextError = Object.assign(new Error("rate_limited"), {
      status: 429,
      retryAfter: 17,
    });

    await handleInlineQuery(text, { userId: 42, session }, `iq-preflight-${id}`);

    expect(hoisted.runCheckCalls).toHaveLength(0);
    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expectScopedArticleId(article.id, id);
    expect(article.title).toBe(title);
    expect(article.description).not.toContain("Подождите");
    expect(article.input_message_content.message_text).toContain(title);
  });

  it("renders low-signal phone inline checks as a number passport", async () => {
    hoisted.nextResult = {
      type: "phone",
      display: "+998 90 *** ** 67",
      level: "unknown",
      score: 0,
      reasons: ["valid_uz_phone"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
      phoneIntelligence: {
        digits: "998901234567",
        normalized: "+998901234567",
        kind: "uz_mobile",
        isValidFormat: true,
        isUzbekistan: true,
        country: {
          iso: "UZ",
          callingCode: "998",
          name: { ru: "Узбекистан", uz: "O'zbekiston", en: "Uzbekistan" },
        },
        uzPrefix: "90",
        uzOperator: {
          ru: "Beeline по префиксу 90",
          uz: "90 prefiksi bo'yicha Beeline",
          en: "Beeline by prefix 90",
        },
        officialDirectoryStatus: "not_found",
      },
    };

    await handleInlineQuery("+998901234567", { userId: 42, session }, "iq-phone");

    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expectScopedArticleId(article.id, "passport-phone");
    expect(article.title).toBe("Номер: жалоб не найдено");
    expect(article.description).toContain("это не гарантия");
    expect(article.description).toContain("В этом же запросе");
    expect(article.description).toContain("не вставляйте настоящий код");
    expect(article.input_message_content.message_text).toContain("Номер: Узбекистан (+998)");
    expect(article.input_message_content.message_text).toContain("Beeline по префиксу 90");
    expect(article.input_message_content.message_text).toContain(
      "Подтверждённых модерированных жалоб в Ishonch Guard не найдено.",
    );
    expect(article.input_message_content.message_text).toContain("не гарантия безопасности");
    expect(article.input_message_content.message_text).toContain("непроверенные жалобы");
    expect(article.input_message_content.message_text).toContain(
      "В @scamguard_bot опишите словами",
    );
    expect(article.input_message_content.message_text).toContain("Не присылайте сами SMS-коды");
    expect(article.input_message_content.message_text).not.toContain("Недостаточно данных");
  });

  it("renders low-signal Telegram username inline checks as a Telegram passport", async () => {
    hoisted.nextResult = {
      type: "telegram",
      display: "@lu•••mo",
      level: "unknown",
      score: 0,
      reasons: ["unknown_sender"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };

    await handleInlineQuery("@lucky_promo", { userId: 42, session }, "iq-telegram");

    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expectScopedArticleId(article.id, "passport-telegram");
    expect(article.title).toBe("Telegram: нужен контекст");
    expect(article.description).toContain("Username сам не доказывает риск");
    expect(article.description).toContain("текст просьбы");
    expect(article.input_message_content.message_text).toContain(
      "Можно оценить только публично видимые признаки",
    );
    expect(article.input_message_content.message_text).toContain(
      "Bot API не показывает возраст аккаунта",
    );
    expect(article.input_message_content.message_text).toContain(
      "Username сам по себе не доказывает",
    );
    expect(article.input_message_content.message_text).toContain("Пришлите текст сообщения");
    expect(article.input_message_content.message_text).not.toContain("Недостаточно данных");
  });

  it("keeps phone reputation source and scope visible in inline passport checks", async () => {
    hoisted.nextResult = {
      type: "phone",
      display: "+998 90 *** ** 67",
      level: "unknown",
      score: 0,
      reasons: ["valid_uz_phone"],
      explanation: null,
      knownReports: 3,
      verifiedContact: null,
      brandEvidence: [],
      phoneIntelligence: {
        digits: "998901234567",
        normalized: "+998901234567",
        kind: "uz_mobile",
        isValidFormat: true,
        isUzbekistan: true,
        country: {
          iso: "UZ",
          callingCode: "998",
          name: { ru: "Узбекистан", uz: "O'zbekiston", en: "Uzbekistan" },
        },
        uzPrefix: "90",
        uzOperator: {
          ru: "Beeline по префиксу 90",
          uz: "90 prefiksi bo'yicha Beeline",
          en: "Beeline by prefix 90",
        },
        officialDirectoryStatus: "not_found",
      },
      phoneReputation: {
        source: "ishonch_guard_moderated_reports",
        confirmedReportCount: 3,
        confidence: "medium",
        riskLevel: "suspicious",
        publicScope: "confirmed_moderated_reports_only",
      },
    };

    await handleInlineQuery("+998901234567", { userId: 42, session }, "iq-phone-reputation");

    const article = hoisted.answerCalls[0].results[0] as {
      description: string;
      input_message_content: { message_text: string };
    };
    expect(article.description).toContain("Есть подтверждённые жалобы Ishonch Guard");
    expect(article.description).toContain("Не отправляйте код, карту или деньги");
    expect(article.input_message_content.message_text).toContain(
      "Источник: подтверждённые модераторами жалобы Ishonch Guard",
    );
    expect(article.input_message_content.message_text).toContain("3 подтверждённых жалоб");
    expect(article.input_message_content.message_text).toContain("Уверенность: средняя");
    expect(article.input_message_content.message_text).toContain("непроверенные жалобы");
    expect(article.input_message_content.message_text).toContain("данные оператора");
    expect(article.input_message_content.message_text).not.toContain("998901234567");
  });

  it("turns low-signal free text into an actionable inline prompt", async () => {
    hoisted.nextResult = {
      type: "text",
      display: "Мне пишет мошенник",
      level: "unknown",
      score: 0,
      reasons: ["unknown_sender"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };

    await handleInlineQuery("Мне пишет мошенник", { userId: 42, session }, "iq-text");

    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expectScopedArticleId(article.id, "check-unknown-general-scam-concern");
    expect(article.title).toBe("Подозреваете обман: пришлите просьбу");
    expect(article.description).toContain("Хорошо, что решили проверить");
    expect(article.input_message_content.message_text).toContain(
      "Что проверяли: Мне пишет мошенник",
    );
  });

  it("turns bare link requests into a send-the-url inline prompt", async () => {
    hoisted.nextResult = {
      type: "text",
      display: "у меня просят перейти по ссылке",
      level: "unknown",
      score: 0,
      reasons: ["unknown_sender"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };

    await handleInlineQuery("у меня просят перейти по ссылке", { userId: 42, session }, "iq-link");

    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expectScopedArticleId(article.id, "check-unknown-link-request");
    expect(article.title).toBe("Ссылка: сначала проверим");
    expect(article.description).toContain("Вы упомянули ссылку");
    expect(article.description).toContain("в этот же запрос");
    expect(article.input_message_content.message_text).toContain(
      "Что проверяли: у меня просят перейти по ссылке",
    );
    expect(article.input_message_content.message_text).toContain("её адреса в запросе нет");
    expect(article.input_message_content.message_text).toContain("без паролей и кодов");
  });

  it("uses the added line of a multiline link request instead of repeating the generic scam card", async () => {
    const query = "Мне пишет мошенник\nСпрашивает ссылку, которую он мне отправил";

    await handleInlineQuery(query, { userId: 42, session }, "iq-link-multiline");

    expect(hoisted.runCheckCalls).toHaveLength(0);
    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expectScopedArticleId(article.id, "check-unknown-link-request");
    expect(article.description).toContain("адреса здесь нет");
    expect(article.input_message_content.message_text).toContain("Спрашивает ссылку");
    expect(article.input_message_content.message_text).toContain("сам URL или полный текст");
  });

  it.each([
    {
      text: "Просят перейти по ссылке и назвать SMS-код",
      expectedId: "check-unknown-code-request",
      expectedRunChecks: 1,
    },
    {
      text: "Просят открыть ссылку и отправить данные карты",
      expectedId: "check-unknown-card-request",
      expectedRunChecks: 1,
    },
    {
      text: "Просят перейти по ссылке и перевести деньги на карту",
      expectedId: "check-unknown-transfer-request",
      expectedRunChecks: 0,
    },
    {
      text: "Перейдите по ссылке и пришлите фото паспорта",
      expectedId: "check-unknown-personal-data",
      expectedRunChecks: 1,
    },
    {
      text: "They ask me to follow a link and install AnyDesk",
      expectedId: "check-unknown-app-request",
      expectedRunChecks: 0,
    },
    {
      text: "Havolani ochib SMS kodni ayt deyapti",
      expectedId: "check-unknown-code-request",
      expectedRunChecks: 1,
    },
  ])(
    "lets the explicit danger win over a bare-link preflight: $text",
    async ({ text, expectedId, expectedRunChecks }) => {
      hoisted.nextResult = {
        type: "text",
        display: text,
        level: "unknown",
        score: 0,
        reasons: ["unknown_sender"],
        explanation: null,
        knownReports: 0,
        verifiedContact: null,
        brandEvidence: [],
      };

      await handleInlineQuery(text, { userId: 42, session }, `iq-priority-${expectedId}`);

      expect(hoisted.runCheckCalls).toHaveLength(expectedRunChecks);
      const article = hoisted.answerCalls[0].results[0] as { id: string };
      expectScopedArticleId(article.id, expectedId);
      expect(scopedArticleSemanticId(article.id)).not.toBe("check-unknown-link-request");
    },
  );

  it.each([
    {
      text: "Что мне отправить, если просят данные карты?",
      expectedId: "check-unknown-card-request",
      expectedRunChecks: 1,
    },
    {
      text: "Что мне написать, если просят перевести деньги?",
      expectedId: "check-unknown-transfer-request",
      expectedRunChecks: 0,
    },
    {
      text: "Что мне прислать, если просят фото паспорта?",
      expectedId: "check-unknown-personal-data",
      expectedRunChecks: 1,
    },
    {
      text: "Bu yerga nima yozay, karta CVV sini so'rashyapti?",
      expectedId: "check-unknown-card-request",
      expectedRunChecks: 1,
    },
    {
      text: "What should I reply if they ask for a passport photo?",
      expectedId: "check-unknown-personal-data",
      expectedRunChecks: 1,
    },
  ])(
    "does not let reply-safety wording hide the dangerous request: $text",
    async ({ text, expectedId, expectedRunChecks }) => {
      hoisted.nextResult = {
        type: "text",
        display: text,
        level: "unknown",
        score: 0,
        reasons: ["unknown_sender"],
        explanation: null,
        knownReports: 0,
        verifiedContact: null,
        brandEvidence: [],
      };

      await handleInlineQuery(text, { userId: 42, session }, `iq-reply-priority-${expectedId}`);

      expect(hoisted.runCheckCalls).toHaveLength(expectedRunChecks);
      const article = hoisted.answerCalls[0].results[0] as { id: string };
      expectScopedArticleId(article.id, expectedId);
      expect(scopedArticleSemanticId(article.id)).not.toBe("check-unknown-reply-safety");
    },
  );

  it.each([
    {
      text: "Как связаться с банком?\nСотрудник просит назвать SMS-код",
      profileLang: "uz" as const,
      expectedId: "check-unknown-code-request",
      expectedRunChecks: 1,
      safety: /не сообщайте sms-код/iu,
    },
    {
      text: "Bank bilan qanday bog'lansam bo'ladi?\nXodim CVVni yuborishni so'rayapti",
      profileLang: "en" as const,
      expectedId: "check-unknown-card-request",
      expectedRunChecks: 1,
      safety: /karta (?:raqami|ma'lumot).{0,80}yubormang/iu,
    },
    {
      text: "How do I contact the bank?\nThey ask me to install an APK",
      profileLang: "ru" as const,
      expectedId: "check-unknown-malicious-file",
      expectedRunChecks: 0,
      safety: /do not (?:open|download|install|grant)/iu,
    },
  ])(
    "keeps the priority danger above a bank-contact question: $text",
    async ({ text, profileLang, expectedId, expectedRunChecks, safety }) => {
      hoisted.nextResult = {
        type: "text",
        display: text,
        level: "unknown",
        score: 0,
        reasons: ["unknown_sender"],
        explanation: null,
        knownReports: 0,
        verifiedContact: null,
        brandEvidence: [],
      };

      await handleInlineQuery(
        text,
        { userId: 42, session: { ...session, lang: profileLang } },
        `iq-bank-danger-${expectedId}`,
      );

      expect(hoisted.runCheckCalls).toHaveLength(expectedRunChecks);
      const article = hoisted.answerCalls[0].results[0] as {
        id: string;
        input_message_content: { message_text: string };
      };
      expectScopedArticleId(article.id, expectedId);
      expect(article.input_message_content.message_text).toMatch(safety);
    },
  );

  it("explains what may be added to Inline without inviting real secrets", async () => {
    await handleInlineQuery("Мне ничего не присылать?", { userId: 42, session }, "iq-reply-safety");

    expect(hoisted.runCheckCalls).toHaveLength(0);
    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expectScopedArticleId(article.id, "check-unknown-reply-safety");
    expect(article.description).toContain("только текст просьбы");
    expect(article.description).toContain("Не вставляйте настоящий SMS-код");
    expect(article.input_message_content.message_text).toContain("В этот запрос добавьте");
    expect(article.input_message_content.message_text).toContain("фото документов не вставляйте");
  });

  it("uses a document-specific complete response for an imperative passport request", async () => {
    const query = "Пришлите фото паспорта для подтверждения личности";
    hoisted.nextResult = {
      type: "text",
      display: query,
      level: "suspicious",
      score: 30,
      reasons: ["requests_personal_data"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };

    await handleInlineQuery(query, { userId: 42, session }, "iq-passport-request");

    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expectScopedArticleId(article.id, "check-suspicious-personal-data");
    expect(article.title).toBe("Документы: не отправляйте фото");
    expect(article.description).toContain("Не отправляйте паспорт");
    expect(article.description).not.toContain("или...");
    expect(article.input_message_content.message_text).toContain("Запрашивают личные данные");
    expect(article.input_message_content.message_text).toContain("Не отправляйте фото паспорта");
    expect(article.input_message_content.message_text).not.toContain("Не вводите код/карту");
  });

  it("keeps job preview concise but inserts fuller next-step guidance", async () => {
    const query = "предлагают работу но просят оплатить обучение";

    await handleInlineQuery(query, { userId: 42, session }, "iq-job-copy");

    expect(hoisted.runCheckCalls).toHaveLength(0);
    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expectScopedArticleId(article.id, "check-unknown-job-offer");
    expect(article.description).toContain("до договора опасно");
    expect(article.input_message_content.message_text).toContain(
      "независимой проверки работодателя",
    );
    expect(article.input_message_content.message_text).toContain("название компании");
    expect(article.input_message_content.message_text).not.toContain("срочный перевод");
  });

  it("does not override concrete URL checks with the bare-link fallback", async () => {
    const checkedUrlRequest = "просят перейти по ссылке https://example.test/pay";
    hoisted.nextResult = {
      type: "url",
      display: checkedUrlRequest,
      level: "unknown",
      score: 0,
      reasons: ["hosted_app_platform"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };

    await handleInlineQuery(checkedUrlRequest, { userId: 42, session }, "iq-url");

    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      title: string;
      description: string;
    };
    expectScopedArticleId(article.id, "check-unknown");
    expect(article.title).toBe("Нужно больше контекста");
    expect(article.description).not.toContain("Пока не открывайте");
    expect(article.description).not.toContain("адреса здесь нет");
  });

  it.each([
    {
      text: "мне скинули ссылку",
      id: "check-unknown-link-request",
      title: "Ссылка: сначала проверим",
    },
    {
      text: "пришел код и просят его сказать",
      id: "check-unknown-code-request",
      title: "Код: никому не называйте",
    },
    {
      text: "я только что передал код из СМС",
      id: "check-unknown-sent-code",
      title: "Код уже отправлен: действуйте срочно",
    },
    {
      text: "просят подтвердить операцию",
      id: "check-unknown-confirm-request",
      title: "Подтверждение: осторожно",
    },
    {
      text: "просят данные карты",
      id: "check-unknown-card-request",
      title: "Карта: не отправляйте данные",
    },
    {
      text: "просят перевести деньги",
      id: "check-unknown-transfer-request",
      title: "Перевод: нужна причина",
    },
    {
      text: "мне сказали сделать перевод на карту",
      id: "check-unknown-transfer-request",
      title: "Перевод: нужна причина",
    },
    {
      text: "просят установить приложение для защиты",
      id: "check-unknown-app-request",
      title: "Приложение: не устанавливайте",
    },
    {
      text: "я установил приложение и дал доступ к смс",
      id: "check-unknown-app-request",
      title: "Приложение: не устанавливайте",
    },
    {
      text: "мне звонят из банка",
      id: "check-unknown-bank-call",
      title: "Звонок из банка: перезвоните сами",
    },
    {
      text: "мне звонит директор билайна",
      id: "check-unknown-operator-call",
      title: "Оператор связи: перезвоните сами",
    },
    {
      text: "звонят из Uztelecom говорят договор истекает просят код",
      id: "check-unknown-operator-call",
      title: "Оператор связи: перезвоните сами",
    },
    {
      text: "мне звонят с другой страны\nПросто звонок с другой страны, брать трубку?",
      id: "check-unknown-foreign-call",
      title: "Иностранный звонок: не продолжайте под давлением",
    },
    {
      text: "просят фото паспорта",
      id: "check-unknown-personal-data",
      title: "Документы: не отправляйте фото",
    },
    {
      text: "нужно оплатить доставку",
      id: "check-unknown-delivery-payment",
      title: "Посылка/таможня: проверьте оплату",
    },
    {
      text: "я выиграл приз, просят оплатить налог",
      id: "check-unknown-prize-fee",
      title: "Приз: не платите сбор",
    },
    {
      text: "просят войти в OneID и сказать SMS код",
      id: "check-unknown-gov-service",
      title: "OneID/госуслуги: не вводите код",
    },
    {
      text: "menga soliqdan qongiroq qilishdi va OneID kodini sorashdi",
      id: "check-unknown-gov-service",
      title: "OneID/davlat xizmati: kod kiritmang",
    },
    {
      text: "оператор просит код для замены SIM карты",
      id: "check-unknown-sim-swap",
      title: "SIM/оператор: осторожно",
    },
    {
      text: "мне пишет сын попал в аварию срочно перевести деньги",
      id: "check-unknown-relative-distress",
      title: "Близкий в беде: перезвоните",
    },
    {
      text: "моей бабушке звонил мошенник\nОн просил срочно прислать деньги на помощь",
      id: "check-unknown-relative-distress",
      title: "Близкий в беде: перезвоните",
    },
    {
      text: "мне звонит сестра\nПросит срочно перевести деньги, так как у нее случилась проблема с машиной",
      id: "check-unknown-relative-distress",
      title: "Близкий в беде: перезвоните",
    },
    {
      text: "знакомый пишет срочно одолжи деньги верну через пару часов",
      id: "check-unknown-relative-distress",
      title: "Близкий в беде: перезвоните",
    },
    {
      text: "мне звонят из Нигерии",
      id: "check-unknown-foreign-call",
      title: "Иностранный звонок: не продолжайте под давлением",
    },
    {
      text: "звонят с номера +98 из Ирана",
      id: "check-unknown-foreign-call",
      title: "Иностранный звонок: не продолжайте под давлением",
    },
    {
      text: "мне пишут от имени Telegram с галочкой",
      id: "check-unknown-telegram-takeover",
      title: "Telegram: не входите по ссылке",
    },
    {
      text: "официальный Telegram просит пройти проверку иначе аккаунт удалят",
      id: "check-unknown-telegram-takeover",
      title: "Telegram: не входите по ссылке",
    },
    {
      text: "Одноклассник просит перейти по ссылке проголосовать за конкурс",
      id: "check-unknown-voting-link",
      title: "Голосование/канал: сначала проверим",
    },
    {
      text: "мне прислали ссылку проголосовать за лучшую мамочку",
      id: "check-unknown-voting-link",
      title: "Голосование/канал: сначала проверим",
    },
    {
      text: "мне прислали APK я ухожу из этого мира",
      id: "check-unknown-malicious-file",
      title: "Файл/вирус: не открывайте",
    },
    {
      text: "в телеграм пришел файл повестка.pdf.apk",
      id: "check-unknown-malicious-file",
      title: "Файл/вирус: не открывайте",
    },
    {
      text: "оповещение безопасности Apple iOS повреждена на 72 установить программу",
      id: "check-unknown-apple-security",
      title: "Apple/iOS: не устанавливайте «защиту»",
    },
    {
      text: "айфон просит установить защиту от вирусов",
      id: "check-unknown-apple-security",
      title: "Apple/iOS: не устанавливайте «защиту»",
    },
    {
      text: "звонят из водоканала про счетчик просят паспорт",
      id: "check-unknown-utility-impersonation",
      title: "Коммунальная служба: перезвоните сами",
    },
    {
      text: "пенсионный фонд обещает повысить пенсию просит код",
      id: "check-unknown-pension-benefit",
      title: "Пенсия/выплата: не называйте данные",
    },
    {
      text: "незнакомец просит телефон на минуту позвонить",
      id: "check-unknown-phone-borrowing",
      title: "Просят телефон: не отдавайте разблокированный",
    },
    {
      text: "На улице просят телефон позвонить на минуту",
      id: "check-unknown-phone-borrowing",
      title: "Просят телефон: не отдавайте разблокированный",
    },
    {
      text: "деньги пришли по ошибке просят вернуть на другой счет",
      id: "check-unknown-money-mule",
      title: "Чужие деньги: не переводите дальше",
    },
    {
      text: "покупают голос Open Budget и просят SMS код",
      id: "check-unknown-open-budget",
      title: "Open Budget/голос: код не отдавайте",
    },
    {
      text: "врач DMED просит SMS код",
      id: "check-unknown-medical-code",
      title: "Врач/DMED: код не диктуйте",
    },
    {
      text: "ребенку предлагают бесплатные бонусы в игре просят код",
      id: "check-unknown-child-game-bonus",
      title: "Игровые бонусы: не вводите код",
    },
    {
      text: "ребёнку обещают робуксы и просят код",
      id: "check-unknown-child-game-bonus",
      title: "Игровые бонусы: не вводите код",
    },
    {
      text: "звонят и молчат чтобы записать голос",
      id: "check-unknown-silent-call",
      title: "Молчаливый звонок: сбросьте",
    },
    {
      text: "инспектор МИБ требует наличные за списание долга",
      id: "check-unknown-official-impersonation",
      title: "Госорган/инспектор: проверьте официально",
    },
    {
      text: "предлагают работу но просят оплатить обучение",
      id: "check-unknown-job-offer",
      title: "Работа: не платите взнос",
    },
    {
      text: "просят инвестировать в TON wallet с гарантированной прибылью",
      id: "check-unknown-investment-offer",
      title: "Инвестиции/крипта: осторожно",
    },
    {
      text: "новый знакомый говорит любит и просит деньги на билет",
      id: "check-unknown-romance-money",
      title: "Отношения: деньги не отправляйте",
    },
    {
      text: "мне пишет какой то незнакомый человек",
      id: "check-unknown-unknown-contact",
      title: "Незнакомец: нужен текст просьбы",
    },
    {
      text: "мне пишет одноклассник, но я не уверен что это он",
      id: "check-unknown-identity-uncertain",
      title: "Личность не ясна: перезвоните",
    },
    {
      text: "меня приглашают в канал для заработка",
      id: "check-unknown-earning-channel",
      title: "Канал заработка: осторожно",
    },
    {
      text: "агентство обещает визу в Корею но просит предоплату",
      id: "check-unknown-travel-migration-prepayment",
      title: "Виза/тур: не платите заранее",
    },
    {
      text: "турфирма просит оплатить хадж заранее",
      id: "check-unknown-travel-migration-prepayment",
      title: "Виза/тур: не платите заранее",
    },
    {
      text: "у меня просят ссылку",
      id: "check-unknown-link-request",
      title: "Ссылка: сначала проверим",
    },
    {
      text: "как мне связаться с банком?",
      id: "check-unknown-bank-contact",
      title: "Связаться с банком: только официальный номер",
    },
    {
      text: "агентство Хотели в Soliq войти",
      id: "check-unknown-gov-service",
      title: "OneID/госуслуги: не вводите код",
    },
    {
      text: "Хотели в Soliq войти",
      id: "check-unknown-gov-service",
      title: "OneID/госуслуги: не вводите код",
    },
    {
      text: "мне звонили из солик",
      id: "check-unknown-gov-service",
      title: "OneID/госуслуги: не вводите код",
    },
    {
      text: "мне звонят из Солик и просят данные",
      id: "check-unknown-gov-service",
      title: "OneID/госуслуги: не вводите код",
    },
    {
      text: "меня пытаются обмануть",
      id: "check-unknown-general-scam-concern",
      title: "Подозреваете обман: пришлите просьбу",
    },
    {
      text: "звонил мошенник",
      id: "check-unknown-general-scam-concern",
      title: "Подозреваете обман: пришлите просьбу",
    },
    {
      text: "меня просят проголосовать на канале и перейти по ссылке",
      id: "check-unknown-voting-link",
      title: "Голосование/канал: сначала проверим",
    },
    {
      text: "мне пишет незнакомый человек\nОн хочет смс код",
      id: "check-unknown-code-request",
      title: "Код: никому не называйте",
    },
    {
      text: "мне пишет администратор канала\nон просит прислать ему смс",
      id: "check-unknown-code-request",
      title: "Код: никому не называйте",
    },
    {
      text: "незнакомец кинул ссылку",
      id: "check-unknown-link-request",
      title: "Ссылка: сначала проверим",
    },
    {
      text: "мне пишет незнакомец, он скинул линк",
      id: "check-unknown-link-request",
      title: "Ссылка: сначала проверим",
    },
    {
      text: "спросили cvv",
      id: "check-unknown-card-request",
      title: "Карта: не отправляйте данные",
    },
    {
      text: "спрашивает реквизиты карты",
      id: "check-unknown-card-request",
      title: "Карта: не отправляйте данные",
    },
    {
      text: "код подтверждения надо переслать в чат",
      id: "check-unknown-code-request",
      title: "Код: никому не называйте",
    },
    {
      text: "kodni ayt deyapti",
      id: "check-unknown-code-request",
      title: "Код: никому не называйте",
    },
    {
      text: "sms kodni aytishim kerakmi?",
      id: "check-unknown-code-request",
      title: "Код: никому не называйте",
    },
    {
      text: "I got a code should I tell him?",
      id: "check-unknown-code-request",
      title: "Code: do not share it with anyone",
    },
    {
      text: "men kodni yubordim endi nima qilay",
      id: "check-unknown-sent-code",
      title: "Kod yuborilgan: tez harakat qiling",
    },
    {
      text: "что мне делать дальше?",
      id: "check-unknown-next-step",
      title: "Что делать: пока ничего не отправляйте",
    },
    {
      text: "можно ли ему отвечать?",
      id: "check-unknown-reply-safety",
      title: "Ответ: не раскрывайте данные",
    },
    {
      text: "это безопасно или мошенники?",
      id: "check-unknown-safety-question",
      title: "Безопасно ли: проверим по фактам",
    },
    {
      text: "мне пишут в телеграме",
      id: "check-unknown-safety-question",
      title: "Безопасно ли: проверим по фактам",
    },
    {
      text: "мне пишет нотариус и требует оплатить штраф",
      id: "check-unknown-official-impersonation",
      title: "Госорган/инспектор: проверьте официально",
    },
    {
      text: "меня зовут вступить в какой то канал",
      id: "check-unknown-chat-invite",
      title: "Канал/чат: сначала проверим",
    },
    {
      text: "мне звонят и торопят",
      id: "check-unknown-unknown-call",
      title: "Неизвестный звонок: лучше перезвонить",
    },
    {
      text: "мне звонят и угрожают",
      id: "check-unknown-unknown-call",
      title: "Неизвестный звонок: лучше перезвонить",
    },
    {
      text: "someone is calling me",
      id: "check-unknown-unknown-call",
      title: "Unknown call: call back safely",
    },
    {
      text: "мне звонит фейковый майор",
      id: "check-unknown-official-impersonation",
      title: "Госорган/инспектор: проверьте официально",
    },
    {
      text: "мне пишет криптоинвестор",
      id: "check-unknown-investment-offer",
      title: "Инвестиции/крипта: осторожно",
    },
    {
      text: "мне пишет кто-то и шлёт ссылку",
      id: "check-unknown-link-request",
      title: "Ссылка: сначала проверим",
    },
    {
      text: "мне пишет и шлёт файл",
      id: "check-unknown-malicious-file",
      title: "Файл/вирус: не открывайте",
    },
    {
      text: "у меня плохое предчувствие",
      id: "check-unknown-general-scam-concern",
      title: "Подозреваете обман: пришлите просьбу",
    },
    {
      text: "как проверить номер",
      id: "meta-how-do-you-check",
      title: "Проверить через Ishonch Guard",
    },
    {
      text: "какой номер полиции",
      id: "check-unknown-general-scam-concern",
      title: "Подозреваете обман: пришлите просьбу",
    },
    {
      text: "я уже перевёл деньги",
      id: "check-unknown-sent-money",
      title: "Деньги уже переведены: срочно в банк",
    },
    {
      text: "как вернуть деньги после мошенника",
      id: "check-unknown-sent-money",
      title: "Деньги уже переведены: срочно в банк",
    },
    {
      text: "я уже дал номер карты",
      id: "check-unknown-card-request",
      title: "Карта: не отправляйте данные",
    },
    {
      text: "я уже перешёл по ссылке",
      id: "check-unknown-link-request",
      title: "Ссылка: сначала проверим",
    },
    {
      text: "привет",
      id: "meta-greeting",
      title: "Проверить через Ishonch Guard",
    },
    {
      text: "спасибо",
      id: "small-talk-thanks",
      title: "Пожалуйста",
    },
    {
      text: "а вы кто",
      id: "small-talk-identity",
      title: "Я — Ishonch Guard",
    },
  ])("maps everyday inline phrase '$text' to a useful preview", async ({ text, id, title }) => {
    hoisted.nextResult = {
      type: "text",
      display: text,
      level: "unknown",
      score: 0,
      reasons: ["unknown_sender"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };

    await handleInlineQuery(text, { userId: 42, session }, `iq-${id}`);

    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expectScopedArticleId(article.id, id);
    expect(article.title).toBe(title);
    expect(article.description).not.toContain("Вставьте полное сообщение");
    expect(article.input_message_content.message_text).toContain(title);
    expect(article.input_message_content.message_text).not.toContain("Недостаточно данных");
    expect(article.input_message_content.message_text).not.toContain(
      "Одного значения мало для уверенного вывода",
    );
  });

  it.each([
    {
      text: "мне прислали ссылку https://digital-quik.com/gallery/kalice",
      title: "Ссылка: сначала проверим",
      forbidden: "Пришлите саму ссылку",
    },
    {
      text: "мне ссылку прислали проголосовать\nhttps://www.flaticon.com/search?author_id=1&style_id=1299&type=standard&word=game",
      title: "Голосование/канал: сначала проверим",
      forbidden: "Пришлите ссылку",
    },
    {
      text: "мне пишет администратор канала\nон просит прислать ему смс",
      title: "Код: никому не называйте",
      forbidden: "Пришлите полный текст",
    },
  ])(
    "does not ask for already supplied inline details in '$text'",
    async ({ text, title, forbidden }) => {
      hoisted.nextResult = {
        type: "text",
        display: text,
        level: "unknown",
        score: 0,
        reasons: ["unknown_sender"],
        explanation: null,
        knownReports: 0,
        verifiedContact: null,
        brandEvidence: [],
      };

      await handleInlineQuery(text, { userId: 42, session }, `iq-copy-${title}`);

      const article = hoisted.answerCalls[0].results[0] as {
        title: string;
        description: string;
        input_message_content: { message_text: string };
      };
      expect(article.title).toBe(title);
      expect(article.description).not.toContain(forbidden);
      expect(article.input_message_content.message_text).not.toContain(forbidden);
      expect(article.input_message_content.message_text).not.toContain("Недостаточно данных");
    },
  );

  it.each([
    {
      text: "просят инвестировать в TON wallet с гарантированной прибылью",
      id: "check-suspicious-investment-offer",
      title: "Инвестиции/крипта: осторожно",
    },
    {
      text: "я только что передал код из СМС",
      id: "check-suspicious-sent-code",
      title: "Код уже отправлен: действуйте срочно",
    },
  ])(
    "keeps suspicious risk level but uses a specific inline preview for '$text'",
    async ({ text, id, title }) => {
      hoisted.nextResult = {
        type: "text",
        display: text,
        level: "suspicious",
        score: 20,
        reasons: ["pressure_urgency"],
        explanation: null,
        knownReports: 0,
        verifiedContact: null,
        brandEvidence: [],
      };

      await handleInlineQuery(text, { userId: 42, session }, `iq-${id}`);

      const article = hoisted.answerCalls[0].results[0] as {
        id: string;
        title: string;
        description: string;
        input_message_content: { message_text: string };
      };
      expectScopedArticleId(article.id, id);
      expect(article.title).toBe(title);
      expect(article.description).not.toContain("Есть подозрительные признаки");
      expect(article.description.length).toBeGreaterThan(0);
      expect(article.input_message_content.message_text).toContain("Требуется осторожность");
      expect(article.input_message_content.message_text).toContain(title);
      expect(article.input_message_content.message_text).not.toContain("Одного значения мало");
    },
  );

  it.each([
    {
      text: "Ставьте лайки, для вывода пополните баланс",
      title: "Задания/заработок: не пополняйте",
      topic: "Лайки",
    },
    {
      text: "Layk bosing, pulni yechish uchun balansni to'ldiring",
      title: "Topshiriq/daromad: balans to'ldirmang",
      topic: "Layk",
    },
    {
      text: "Like videos and top up your balance to withdraw your earnings",
      title: "Tasks/earnings: do not top up",
      topic: "Likes",
    },
    {
      text: "На ваше имя оформили рассрочку в Uzum Nasiya",
      title: "Кредит/рассрочка не ваша: действуйте",
      topic: "официальному номеру",
    },
    {
      text: "Sizga Uzum Nasiya dan qarz rasmiylashtirildi",
      title: "Kredit/nasiya sizniki emas: harakat qiling",
      topic: "rasmiy raqam",
    },
    {
      text: "A buy-now-pay-later loan was opened in your name",
      title: "Loan/BNPL not yours: act now",
      topic: "official number",
    },
    {
      text: "A Klarna installment appeared in my name. I did not open it.",
      title: "Loan/BNPL not yours: act now",
      topic: "official number",
    },
    {
      text: "Никому не говорите, это операция МВД",
      title: "Госорган/инспектор: проверьте официально",
      topic: "скрывать",
    },
    {
      text: "Hech kimga aytmang, bu IIB maxsus operatsiyasi",
      title: "Davlat organi/inspektor: rasmiy tekshiring",
      topic: "sir saqlashni",
    },
    {
      text: "Do not tell anyone, this is a police operation",
      title: "Government/inspector: verify officially",
      topic: "secrecy",
    },
    {
      text: "Мне сказали скрыть этот перевод от банка",
      title: "Скрыть перевод: это давление",
      topic: "красный флаг",
    },
    {
      text: "O'tkazmani bankdan yashirishni aytishdi",
      title: "O'tkazmani yashirish: bu bosim",
      topic: "xavf belgisi",
    },
    {
      text: "They told me to hide this transfer from the bank",
      title: "Hide the transfer: red flag",
      topic: "coercive isolation",
    },
    {
      text: "Vazifalarni bajardim, ish haqini olish uchun komissiya to'lashni so'rashyapti",
      title: "Topshiriq/daromad: balans to'ldirmang",
      topic: "topshiriq",
    },
    {
      text: "Пришёл кредит, которого я не брал",
      title: "Кредит/рассрочка не ваша: действуйте",
      topic: "официальному номеру",
    },
    {
      text: "Tell the bank the payment is for family",
      title: "Hide the transfer: red flag",
      topic: "coercive isolation",
    },
  ])(
    "keeps the P1 topic and language in Inline preview and inserted text: $text",
    async ({ text, title, topic }) => {
      hoisted.nextResult = {
        type: "text",
        display: text,
        level: "suspicious",
        score: 40,
        reasons: ["task_reward_engagement_bait"],
        explanation: null,
        knownReports: 0,
        verifiedContact: null,
        brandEvidence: [],
      };

      await handleInlineQuery(text, { userId: 42, session }, `iq-p1-${title}`);

      const article = hoisted.answerCalls[0].results[0] as {
        title: string;
        description: string;
        input_message_content: { message_text: string };
      };
      expect(article.title).toBe(title);
      expect(article.description).toContain(topic);
      expect(article.input_message_content.message_text).toContain(title);
      expect(article.input_message_content.message_text).not.toContain("Недостаточно данных");
    },
  );
});

describe("handleInlineQuery — researched scam-wave regressions", () => {
  beforeEach(() => {
    hoisted.runCheckCalls.length = 0;
    hoisted.answerCalls.length = 0;
    hoisted.nextResult = null;
    hoisted.nextError = null;
    hoisted.nextAnswerResult = null;
    hoisted.answerResults.length = 0;
    hoisted.escapeMarkdown = false;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    [
      "я перевела деньги не тому человеку, можно отменить перевод?",
      "check-unknown-mistaken-transfer",
      /ошибочн|банк/iu,
    ],
    [
      "The payment already settled to the wrong account; I shared no codes. How do I start a bank dispute?",
      "check-unknown-mistaken-transfer",
      /wrong|bank|transfer/iu,
    ],
    [
      "налоговая угрожает делом и заставляет поджечь заправку",
      "check-unknown-dangerous-task",
      /опасн|102/iu,
    ],
    [
      "угрожают приехать домой и избить меня, если не заплачу",
      "check-unknown-violence-threat",
      /угроз|расправ|безопасн|102/iu,
    ],
    [
      "сосед прислал это ты на видео и просит открыть файл",
      "check-unknown-neighbor-video",
      /видео|файл|apk/iu,
    ],
    [
      "Сосед написал «это ты на видео?» и прислал camera_video.zip, просит открыть.",
      "check-unknown-neighbor-video",
      /видео|файл|apk/iu,
    ],
    [
      "Qo'shnim «bu senmi?» deb camera_video.zip yubordi, ochishni so'rayapti.",
      "check-unknown-neighbor-video",
      /video|fayl|apk/iu,
    ],
    [
      "Қўшним «бу сенми?» деб camera_video.zip юборди, очишни сўраяпти.",
      "check-unknown-neighbor-video",
      /video|fayl|apk/iu,
    ],
    [
      "A resident asks “is this you?” and sent camera_video.zip for me to open.",
      "check-unknown-neighbor-video",
      /video|file|apk/iu,
    ],
    [
      "Сосед прислал camera_video.rar и просит распаковать архив.",
      "check-unknown-neighbor-video",
      /видео|файл|apk/iu,
    ],
    [
      "Qo'shnim camera_video.7z yubordi, arxivni ochishni so'rayapti.",
      "check-unknown-neighbor-video",
      /video|fayl|apk/iu,
    ],
    [
      "прислали приложение для оплаты штрафа с кешбэком, просят установить",
      "check-unknown-fake-fine-apk",
      /штраф|apk|кешб/iu,
    ],
    [
      "ROAD24 ilovasini chatdan o'rnatsam, jarima pulining hammasini qaytarishar ekan.",
      "check-unknown-fake-fine-apk",
      /jarima|apk|keshbek/iu,
    ],
    [
      "ROAD24 иловасини чатдан ўрнатсам, жарима пулининг ҳаммасини қайтаришар экан.",
      "check-unknown-fake-fine-apk",
      /jarima|apk|keshbek/iu,
    ],
    [
      "В чате прислали ROAD24.apk и обещают вернуть весь штраф, если установлю.",
      "check-suspicious-fake-fine-apk",
      /штраф|apk|кешб/iu,
    ],
    [
      "They sent ROAD24.apk in a chat and promise to refund the full fine if I install it.",
      "check-suspicious-fake-fine-apk",
      /fine|apk|cashback/iu,
    ],
    [
      "предлагают за деньги обнулить штрафные баллы через знакомого в ГАИ",
      "check-unknown-penalty-points-fee",
      /балл|посредник|гаи/iu,
    ],
    [
      "Telegramdagi vositachi 800 ming so'mga jarima ballarimni nol qilib, shaxsiy kartasiga pul o'tkazishni so'radi",
      "check-unknown-penalty-points-fee",
      /jarima|ball|vositachi/iu,
    ],
    [
      "Tanishim jarima ballarini olib tashlab beradi, buning uchun pul so'radi.",
      "check-unknown-penalty-points-fee",
      /jarima|ball|vositachi/iu,
    ],
    [
      "Танишим жарима балларини олиб ташлаб беради, бунинг учун пул сўради.",
      "check-unknown-penalty-points-fee",
      /jarima|ball|vositachi/iu,
    ],
    [
      "A fixer says he can wipe my driving penalty points for a cash fee.",
      "check-unknown-penalty-points-fee",
      /penalty|points|cash/iu,
    ],
    [
      "A traffic officer contact will take my violation points off for cash.",
      "check-unknown-penalty-points-fee",
      /penalty|points|cash/iu,
    ],
    [
      "Знакомый в ГАИ якобы спишет штрафные баллы за комиссию.",
      "check-unknown-penalty-points-fee",
      /балл|посредник|гаи/iu,
    ],
    [
      "знакомый прислал: я получил подарок банка, забирай по ссылке тоже",
      "check-unknown-known-contact-prize",
      /знаком|приз|подар|банк/iu,
    ],
    [
      "Брат прислал ссылку на подарок банка и пишет, что уже получил 70000 сум.",
      "check-unknown-known-contact-prize",
      /брат|подар|банк/iu,
    ],
    [
      "Акам банк совғасига ҳавола юборди ва 70000 сўм олганини ёзди.",
      "check-unknown-known-contact-prize",
      /aka|sovg|bank/iu,
    ],
    [
      "My brother sent a bank gift link and says he already received 70000 soum.",
      "check-unknown-known-contact-prize",
      /brother|gift|bank/iu,
    ],
    [
      "I accidentally transferred money to the wrong person. Can my bank recall it?",
      "check-unknown-mistaken-transfer",
      /wrong|bank|transfer/iu,
    ],
    [
      "По ошибке оплатила чужой номер телефона вместо своего. Можно отменить?",
      "check-unknown-mistaken-transfer",
      /ошиб|банк|плат/iu,
    ],
    [
      "Adashib o'zimnikining o'rniga boshqa odamning telefon raqamiga to'lov qildim. Bekor qilsa bo'ladimi?",
      "check-unknown-mistaken-transfer",
      /xato|bank|to'lov/iu,
    ],
    [
      "Адашиб ўзимникининг ўрнига бошқа одамнинг телефон рақамига тўлов қилдим. Бекор қилса бўладими?",
      "check-unknown-mistaken-transfer",
      /xato|bank|to'lov/iu,
    ],
    [
      "Оплатила чужой телефон по ошибке — что теперь нажать, чтобы отменить?",
      "check-unknown-mistaken-transfer",
      /ошиб|банк|плат/iu,
    ],
    [
      "Boshqa telefon raqamiga xato to'ladim — bekor qilish mumkinmi?",
      "check-unknown-mistaken-transfer",
      /xato|bank|to'lov/iu,
    ],
    [
      "Бошқа телефон рақамига хато тўладим — бекор қилиш мумкинми?",
      "check-unknown-mistaken-transfer",
      /xato|bank|to'lov/iu,
    ],
    [
      "I topped up someone else's phone by mistake—how can I cancel it?",
      "check-unknown-mistaken-transfer",
      /wrong|bank|transfer/iu,
    ],
    [
      "Я по ошибке перевела деньги не тому человеку. Можно отменить перевод?",
      "check-unknown-mistaken-transfer",
      /ошиб|банк|перевод/iu,
    ],
    [
      "Adashib pulni boshqa odamga o'tkazdim. Bank qaytara oladimi?",
      "check-unknown-mistaken-transfer",
      /xato|bank|o'tkazma/iu,
    ],
    [
      "Адашиб пулни бошқа одамга ўтказдим. Банк қайтара оладими?",
      "check-unknown-mistaken-transfer",
      /xato|bank|o'tkazma/iu,
    ],
    [
      "I transferred money to the wrong person by mistake. Can my bank recall it?",
      "check-unknown-mistaken-transfer",
      /wrong|bank|transfer/iu,
    ],
  ])("keeps a concrete semantic article for %s", async (text, semanticId, topic) => {
    await handleInlineQuery(text, { userId: 42, session }, `iq-wave-${semanticId}`);

    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expectScopedArticleId(article.id, semanticId);
    expect(
      `${article.title} ${article.description} ${article.input_message_content.message_text}`,
    ).toMatch(topic);
  });

  it.each([
    [
      "МВД заставляет поджечь заправку, иначе заведёт уголовное дело",
      "check-unknown-dangerous-task",
      /опасн|102/iu,
    ],
    [
      "IIB yoqilg'i shoxobchasiga o't qo'yishni talab qilyapti, bajarmasang jinoyat ishi ochadi",
      "check-unknown-dangerous-task",
      /xavf|102/iu,
    ],
    [
      "Police ordered me to set fire to a gas station or face a criminal case",
      "check-unknown-dangerous-task",
      /danger|102/iu,
    ],
    [
      "A detective ordered me to set fire to a car or I would be arrested.",
      "check-unknown-dangerous-task",
      /danger|102/iu,
    ],
    [
      "Прокурорман деган одам камера симини узишимни талаб қиляпти.",
      "check-unknown-dangerous-task",
      /xavf|102/iu,
    ],
    [
      "Пишет оперативник: подожги склад, иначе посадим.",
      "check-unknown-dangerous-task",
      /опасн|102/iu,
    ],
    [
      "Profilaktika inspektoriman, kamerani buzmasang seni qamayman.",
      "check-unknown-dangerous-task",
      /xavf|102/iu,
    ],
    [
      "Профилактика инспекториман, камерани бузмасанг сени қамайман.",
      "check-unknown-dangerous-task",
      /xavf|102/iu,
    ],
    [
      "A federal agent told me to leave a backpack at the station or face arrest.",
      "check-unknown-dangerous-task",
      /danger|102/iu,
    ],
    [
      "A law-enforcement detective says I must destroy a camera or go to jail.",
      "check-unknown-dangerous-task",
      /danger|102/iu,
    ],
    [
      "Prokuraturadanmiz deganlar qutini maktab yoniga qoldirishga majburladi; men hali bormadim.",
      "check-unknown-dangerous-task",
      /xavf|102/iu,
    ],
    [
      "Прокуратураданмиз деганлар қутини мактаб ёнига қолдиришга мажбурлади; мен ҳали бормадим.",
      "check-unknown-dangerous-task",
      /xavf|102/iu,
    ],
    ["Я тебя застрелю.", "check-unknown-violence-threat", /угроз|безопасн|102/iu],
    ["Я сломаю тебе шею.", "check-unknown-violence-threat", /угроз|безопасн|102/iu],
    ["Мы тебя закопаем.", "check-unknown-violence-threat", /угроз|безопасн|102/iu],
    ["Seni otib tashlayman.", "check-unknown-violence-threat", /tahdid|xavfsiz|102/iu],
    ["Seni yo'q qilaman.", "check-unknown-violence-threat", /tahdid|xavfsiz|102/iu],
    ["Сени отиб ташлайман.", "check-unknown-violence-threat", /tahdid|xavfsiz|102/iu],
    ["Сени йўқ қиламан.", "check-unknown-violence-threat", /tahdid|xavfsiz|102/iu],
    ["I'll shoot you.", "check-unknown-violence-threat", /threat|safe|102/iu],
    ["I'll break your neck.", "check-unknown-violence-threat", /threat|safe|102/iu],
    ["We will make you disappear.", "check-unknown-violence-threat", /threat|safe|102/iu],
    [
      "Полиция обвиняет меня. Следователь угрожает: я приеду домой и убью тебя",
      "check-unknown-violence-threat",
      /угроз|безопасн|102/iu,
    ],
    [
      "IIB meni jinoyatda gumon qilyapti. Tergovchi tahdid qildi: uyingga boramiz va seni o'ldiramiz",
      "check-unknown-violence-threat",
      /tahdid|xavfsiz|102/iu,
    ],
    [
      "Police say I am accused. An investigator threatens: we will come to your house and kill you",
      "check-unknown-violence-threat",
      /threat|safe|102/iu,
    ],
    [
      "Pul bermasang, seni urib tashlaymiz.",
      "check-unknown-violence-threat",
      /tahdid|xavfsiz|102/iu,
    ],
    [
      "Пул бермасанг, сени уриб ташлаймиз.",
      "check-unknown-violence-threat",
      /tahdid|xavfsiz|102/iu,
    ],
  ])(
    "keeps physical-safety priority above broad authority routing: %s",
    async (text, semanticId, topic) => {
      await handleInlineQuery(text, { userId: 42, session }, `iq-physical-${semanticId}`);

      const article = hoisted.answerCalls[0].results[0] as {
        id: string;
        title: string;
        description: string;
        input_message_content: { message_text: string };
      };
      expectScopedArticleId(article.id, semanticId);
      expect(
        `${article.title} ${article.description} ${article.input_message_content.message_text}`,
      ).toMatch(topic);
    },
  );

  it.each([
    "Полиция предупреждает: не выполняйте опасные задания и ничего не поджигайте",
    "IIB ogohlantiradi: xavfli topshiriqni bajarmang va hech narsaga o't qo'ymang",
    "Police warning: do not carry out dangerous tasks and do not set fire to anything",
    "I will come, but I won't hurt or kill you.",
    "Я приеду. Но не убью тебя.",
  ])("keeps a protective authority warning out of physical-incident cards: %s", async (text) => {
    await handleInlineQuery(text, { userId: 42, session }, `iq-physical-safe-${text.length}`);

    const article = hoisted.answerCalls[0].results[0] as { id: string };
    expect(article.id).not.toMatch(/dangerous-task|violence-threat/iu);
  });

  it.each([
    [
      "Я оплатил дорожный штраф в официальном приложении банка, APK мне никто не присылал",
      /fake-fine-apk/iu,
    ],
    [
      "Jarimani bankning rasmiy ilovasida o'zim to'ladim, chatdan APK kelmagan.",
      /fake-fine-apk|malicious-file|file-received/iu,
    ],
    [
      "Жаримани банкнинг расмий иловасида ўзим тўладим, чатдан APK келмаган.",
      /fake-fine-apk|malicious-file|file-received/iu,
    ],
    [
      "Я сам нашёл ROAD24 в Google Play и оплатил штраф через официальное приложение; из чата APK не присылали.",
      /fake-fine-apk|malicious-file|file-received|app-request/iu,
    ],
    [
      "ROAD24 ilovasini Google Play'dan o'zim topdim va jarimani rasmiy ilovada to'ladim; chatdan APK kelmagan.",
      /fake-fine-apk|malicious-file|file-received|app-request/iu,
    ],
    [
      "ROAD24 иловасини Google Play'дан ўзим топдим ва жаримани расмий иловада тўладим; чатдан APK келмаган.",
      /fake-fine-apk|malicious-file|file-received|app-request/iu,
    ],
    [
      "I found ROAD24 myself on Google Play and paid the fine in the official app; no APK came from a chat.",
      /fake-fine-apk|malicious-file|file-received|app-request/iu,
    ],
    [
      "Я лично подарила брату новый телефон на день рождения; он уже получил подарок, никаких ссылок или файлов не было.",
      /malicious-file|file-received|link-request|known-contact-prize|prize/iu,
    ],
    [
      "Men akamga tug'ilgan kunida yangi telefonni shaxsan sovg'a qildim; u sovg'ani oldi, hech qanday havola yoki fayl bo'lmagan.",
      /malicious-file|file-received|link-request|known-contact-prize|prize/iu,
    ],
    [
      "Мен акамга туғилган кунида янги телефонни шахсан совға қилдим; у совғани олди, ҳеч қандай ҳавола ёки файл бўлмаган.",
      /malicious-file|file-received|link-request|known-contact-prize|prize/iu,
    ],
    [
      "I personally gave my brother a new phone for his birthday; he received the gift, and there were no links or files.",
      /malicious-file|file-received|link-request|known-contact-prize|prize/iu,
    ],
    [
      "Подарок уже получил. Брат лично вручил мне телефон на день рождения, ссылок не было.",
      /malicious-file|file-received|link-request|known-contact-prize|prize/iu,
    ],
    [
      "Sovg'ani oldim. Akam tug'ilgan kunimga telefonni shaxsan berdi, havola yo'q.",
      /malicious-file|file-received|link-request|known-contact-prize|prize/iu,
    ],
    [
      "Совғани олдим. Акам туғилган кунимга телефонни шахсан берди, ҳавола йўқ.",
      /malicious-file|file-received|link-request|known-contact-prize|prize/iu,
    ],
    [
      "I received the gift. My brother handed me a phone for my birthday; there was no link.",
      /malicious-file|file-received|link-request|known-contact-prize|prize/iu,
    ],
    [
      "В новости написано: при опасности звоните в полицию по номеру 102.",
      /report-request|report-question|official-impersonation|dangerous-task/iu,
    ],
    [
      "Yangilikda xavf bo'lsa politsiyaga 102 raqami orqali qo'ng'iroq qilish kerakligi yozilgan.",
      /report-request|report-question|official-impersonation|dangerous-task/iu,
    ],
    [
      "Янгиликда хавф бўлса полицияга 102 рақами орқали қўнғироқ қилиш кераклиги ёзилган.",
      /report-request|report-question|official-impersonation|dangerous-task/iu,
    ],
    [
      "The news says to call police on emergency number 102 if there is danger.",
      /report-request|report-question|official-impersonation|dangerous-task/iu,
    ],
    [
      "The police emergency number is 102.",
      /report-request|report-question|official-impersonation|dangerous-task/iu,
    ],
    [
      "Полиция рақами 102.",
      /report-request|report-question|official-impersonation|dangerous-task/iu,
    ],
    ["Adashib boshqa raqamga to'ladim.", /sent-money/iu],
    [
      "Qo'shnim oddiy videoni Telegram ichida yubordi, hech qanday fayl yoki ilova o'rnatish kerak emas",
      /neighbor-video/iu,
    ],
    [
      "Полиция предупреждает: не выполняйте опасные задания и ничего не поджигайте",
      /dangerous-task/iu,
    ],
    [
      "Jarima ballarini pulga o'chirish mumkin emas, vositachiga pul bermang",
      /penalty-points-fee/iu,
    ],
    [
      "Official bank giveaway results are published on the bank website; do not open other links",
      /known-contact-prize/iu,
    ],
    [
      "Я сделал запланированный перевод знакомому поставщику по официальному счёту; получатель и сумма подтверждены",
      /sent-money/iu,
    ],
    [
      "Rejalashtirilgan to'lovni tanish yetkazib beruvchiga rasmiy hisob bo'yicha yubordim; oluvchi va summa to'g'ri",
      /sent-money|delivery|marketplace/iu,
    ],
    [
      "Режалаштирилган тўловни таниш етказиб берувчига расмий ҳисоб бўйича юбордим; олувчи ва сумма тўғри",
      /sent-money|delivery|marketplace/iu,
    ],
    [
      "Tanish yetkazib beruvchi uchun rejalashtirilgan to'lovni rasmiy hisob bo'yicha yubordim; oluvchi va summa to'g'ri",
      /sent-money|delivery|marketplace/iu,
    ],
    [
      "Таниш етказиб берувчи учун режалаштирилган тўловни расмий ҳисоб бўйича юбордим; олувчи ва сумма тўғри",
      /sent-money|delivery|marketplace/iu,
    ],
    [
      "Yetkazib beruvchiga to'lov rejalashtirilgan edi, oluvchi va summa tasdiqlangan.",
      /sent-money|delivery|marketplace/iu,
    ],
  ])("does not invent a live scam family for a safe control: %s", async (text, forbiddenId) => {
    await handleInlineQuery(text, { userId: 42, session }, `iq-wave-safe-${text.length}`);

    const article = hoisted.answerCalls[0].results[0] as { id: string };
    expect(article.id).not.toMatch(forbiddenId);
  });

  it("never interpolates undefined and keeps a URL follow-up question", async () => {
    hoisted.nextResult = {
      type: "url",
      display: "https://soliq-check.example/pay",
      level: "suspicious",
      score: 35,
      reasons: ["weird_domain"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };

    await handleInlineQuery(
      "налоговая просит оплатить по ссылке\nпочему?\nhttps://soliq-check.example/pay",
      { userId: 42, session },
      "iq-tax-url-why",
    );

    const article = hoisted.answerCalls[0].results[0] as {
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    const copy = `${article.title}\n${article.description}\n${article.input_message_content.message_text}`;
    expect(copy).not.toContain("undefined");
    expect(copy).toMatch(/почему|рискован/iu);
    expect(copy).toContain("soliq-check.example");
  });

  it.each([
    {
      text: "Просят проголосовать по ссылке\nКак понять, что ссылка подставная?\nhttps://vote-check.example/path",
      profileLang: "uz" as const,
      present: /адрес в запросе есть|url найден/iu,
      missing: /без самого url|добавьте адрес целиком/iu,
    },
    {
      text: "Ovoz berish havolasini ochishni so'rashyapti\nHavola soxta ekanini qanday bilaman?\nhttps://vote-check.example/path",
      profileLang: "en" as const,
      present: /manzil topildi|url topildi/iu,
      missing: /urlning o'zi bo'lmasa|manzilni to'liq qo'shing/iu,
    },
    {
      text: "They ask me to vote through a link\nHow do I know whether the link is fake?\nhttps://vote-check.example/path",
      profileLang: "ru" as const,
      present: /address is present|url found/iu,
      missing: /without the actual url|add the complete address/iu,
    },
  ])(
    "uses an actual third-line URL while answering its follow-up: $text",
    async ({ text, profileLang, present, missing }) => {
      hoisted.nextResult = {
        type: "url",
        display: "https://vote-check.example/path",
        level: "suspicious",
        score: 35,
        reasons: ["weird_domain"],
        explanation: null,
        knownReports: 0,
        verifiedContact: null,
        brandEvidence: [],
      };

      await handleInlineQuery(
        text,
        { userId: 42, session: { ...session, lang: profileLang } },
        `iq-link-url-follow-up-${profileLang}`,
      );

      const article = hoisted.answerCalls[0].results[0] as {
        title: string;
        description: string;
        input_message_content: { message_text: string };
      };
      const copy = `${article.title}\n${article.description}\n${article.input_message_content.message_text}`;
      expect(copy).toContain("vote-check.example");
      expect(copy).toMatch(present);
      expect(copy).not.toMatch(missing);
    },
  );

  it("does not derive visible article IDs from the value of a pasted OTP", async () => {
    await handleInlineQuery("SMS код 481927", { userId: 42, session }, "iq-secret-a");
    await handleInlineQuery("SMS код 592814", { userId: 42, session }, "iq-secret-b");

    const [first, second] = hoisted.answerCalls.map(
      (call) => call.results[0] as { id: string; input_message_content: { message_text: string } },
    );
    expect(first.id).toBe(second.id);
    expect(first.input_message_content.message_text).not.toContain("481927");
    expect(second.input_message_content.message_text).not.toContain("592814");
  });

  it("does not derive a visible article ID from a labelled card number", async () => {
    const queries = [
      "They ask for card number 4111 1111 1111 1111",
      "They ask for card number 5555 5555 5555 4444",
    ] as const;

    for (const [index, query] of queries.entries()) {
      hoisted.nextResult = {
        type: "text",
        display: query,
        level: "unknown",
        score: 0,
        reasons: ["unknown_sender"],
        explanation: null,
        knownReports: 0,
        verifiedContact: null,
        brandEvidence: [],
      };
      await handleInlineQuery(query, { userId: 42, session }, `iq-labelled-pan-${index}`);
    }

    const articles = hoisted.answerCalls.map(
      (call) => call.results[0] as { id: string; input_message_content: { message_text: string } },
    );
    expect(articles[0].id).toBe(articles[1].id);
    expectScopedArticleId(articles[0].id, "check-unknown-card-request");
    for (const query of queries) expect(JSON.stringify(articles)).not.toContain(query);
    expect(JSON.stringify(articles)).not.toMatch(/4111 1111 1111 1111|5555 5555 5555 4444/u);
  });

  it("keeps private code IDs invariant across NFKC, zero-width and confusable inputs", async () => {
    const queries = [
      "S\u200BMS code: 481927",
      "ＳＭＳ ｃｏｄｅ：５９２８１４",
      "SМS cоde: 731904",
    ] as const;

    for (const [index, query] of queries.entries()) {
      await handleInlineQuery(query, { userId: 42, session }, `iq-obfuscated-secret-${index}`);
    }

    const articles = hoisted.answerCalls.map(
      (call) => call.results[0] as { id: string; input_message_content: { message_text: string } },
    );
    expect(new Set(articles.map((article) => article.id)).size).toBe(1);
    expectScopedArticleId(articles[0].id, "private-code");
    expect(JSON.stringify(articles)).not.toMatch(/481927|592814|731904/u);
  });

  it("keeps ambiguous bare-code IDs invariant across values", async () => {
    const values = [
      "4821",
      "59372",
      "４８２１",
      "5\u200B9372",
      "481927",
      "592814",
      "4222222222222",
      "4111111111111111",
      "4000000000000000006",
    ] as const;

    for (const [index, value] of values.entries()) {
      await handleInlineQuery(value, { userId: 42, session }, `iq-bare-code-${index}`);
    }

    const articles = hoisted.answerCalls.map(
      (call) => call.results[0] as { id: string; input_message_content: { message_text: string } },
    );
    expect(new Set(articles.map((article) => article.id)).size).toBe(1);
    expectScopedArticleId(articles[0].id, "ambiguous-numeric");
    for (const value of values) expect(JSON.stringify(articles)).not.toContain(value);
  });

  it("keeps private password IDs invariant for zero-width and confusable labels", async () => {
    const cases = [
      ["p\u200Bassword: AlphaSecret42", "AlphaSecret42"],
      ["pаsswоrd: BetaSecret84", "BetaSecret84"],
    ] as const;

    for (const [index, [query]] of cases.entries()) {
      await handleInlineQuery(query, { userId: 42, session }, `iq-private-password-${index}`);
    }

    const articles = hoisted.answerCalls.map(
      (call) => call.results[0] as { id: string; input_message_content: { message_text: string } },
    );
    expect(new Set(articles.map((article) => article.id)).size).toBe(1);
    expectScopedArticleId(articles[0].id, "private-password");
    for (const [, secret] of cases) expect(JSON.stringify(articles)).not.toContain(secret);
  });

  it("keeps access-token IDs invariant across provider token values and formats", async () => {
    const cases = [
      ["API_KEY=sk-proj-InlineOnly1234567890abcdef", "sk-proj-InlineOnly1234567890abcdef"],
      ["access token abcdefgh1234567890abcd", "abcdefgh1234567890abcd"],
      [
        "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.InlineOnly1234567890.signatureABC123",
        "eyJhbGciOiJIUzI1NiJ9.InlineOnly1234567890.signatureABC123",
      ],
      [
        "bot token: 123456789:AAExampleInlineToken1234567890abcdefghi",
        "123456789:AAExampleInlineToken1234567890abcdefghi",
      ],
      [
        "ghp_InlineOnlyToken1234567890ABCDEFGHIJ12345",
        "ghp_InlineOnlyToken1234567890ABCDEFGHIJ12345",
      ],
      [
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.InlineOnlySignature1234567890abcdef",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.InlineOnlySignature1234567890abcdef",
      ],
      [
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ODc2NTQzMjEwIn0.InlineOnlySignature9876543210abcdef",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ODc2NTQzMjEwIn0.InlineOnlySignature9876543210abcdef",
      ],
      ["AIzaABCDEFGHIJKLMNOPQRSTUVWXY1234567890", "AIzaABCDEFGHIJKLMNOPQRSTUVWXY1234567890"],
      ["AKIATESTONLY12345678", "AKIATESTONLY12345678"],
      ["ASIATESTONLY87654321", "ASIATESTONLY87654321"],
    ] as const;

    for (const [index, [query]] of cases.entries()) {
      await handleInlineQuery(query, { userId: 42, session }, `iq-private-access-token-${index}`);
    }

    const articles = hoisted.answerCalls.map(
      (call) => call.results[0] as { id: string; input_message_content: { message_text: string } },
    );
    expect(new Set(articles.map((article) => article.id)).size).toBe(1);
    expectScopedArticleId(articles[0].id, "private-access-token");
    for (const [, token] of cases) expect(JSON.stringify(articles)).not.toContain(token);
  });

  it("does not hash secret-bearing input on the too-long branch", async () => {
    const padding = `${"ordinary context ".repeat(20)} `;
    const cases = [
      [`${padding}password: AlphaSecret42`, "AlphaSecret42"],
      [`${padding}pаsswоrd: BetaSecret84`, "BetaSecret84"],
    ] as const;

    for (const [index, [query]] of cases.entries()) {
      await handleInlineQuery(query, { userId: 42, session }, `iq-too-long-secret-${index}`);
    }

    const articles = hoisted.answerCalls.map(
      (call) => call.results[0] as { id: string; input_message_content: { message_text: string } },
    );
    expect(new Set(articles.map((article) => article.id)).size).toBe(1);
    expectScopedArticleId(articles[0].id, "too-long");
    for (const [, secret] of cases) expect(JSON.stringify(articles)).not.toContain(secret);
  });

  it("does not repeat the same first safety sentence in an elevated inserted result", async () => {
    hoisted.nextResult = {
      type: "text",
      display: "штрафные баллы",
      level: "high_risk",
      score: 70,
      reasons: ["fake_penalty_points_erasure"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };
    const text = "предлагают за деньги обнулить штрафные баллы через знакомого в ГАИ";

    await handleInlineQuery(text, { userId: 42, session }, "iq-no-repeat");

    const article = hoisted.answerCalls[0].results[0] as {
      input_message_content: { message_text: string };
    };
    const inserted = article.input_message_content.message_text;
    const firstAction = "Проверка штрафных баллов на my.gov.uz бесплатна.";
    expect(inserted.split(firstAction)).toHaveLength(2);
  });
});
