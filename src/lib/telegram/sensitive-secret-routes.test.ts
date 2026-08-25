import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  answerCalls: [] as Array<{
    inlineQueryId: string;
    results: unknown[];
    cacheTime?: number;
    isPersonal?: boolean;
  }>,
  sentMessages: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
  runCheckCalls: [] as unknown[],
  sharedRateLimitCalls: [] as unknown[],
  sessionWrites: [] as unknown[],
}));

vi.mock("@/lib/risk/check-core", () => ({
  runCheck: async (options: unknown) => {
    h.runCheckCalls.push(options);
    throw new Error("secret preflight must bypass runCheck and AI");
  },
  analyzeImageCore: async () => null,
  transcribeVoiceCore: async () => null,
}));

vi.mock("@/lib/risk/shared-rate-limit.server", () => ({
  checkSharedRateLimit: async (options: unknown) => {
    h.sharedRateLimitCalls.push(options);
    throw new Error("secret preflight must bypass shared rate limiting");
  },
}));

vi.mock("@/lib/telegram/api.server", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/telegram/api.server")>();
  return {
    ...actual,
    answerInlineQuery: async (options: {
      inlineQueryId: string;
      results: unknown[];
      cacheTime?: number;
      isPersonal?: boolean;
    }) => {
      h.answerCalls.push(options);
      return { ok: true as const };
    },
    sendMessage: async (options: { chatId: number; text: string; keyboard?: unknown }) => {
      h.sentMessages.push(options);
      return { ok: true as const };
    },
    sendChatAction: async () => ({ ok: true as const }),
    getFile: async () => null,
    downloadFileAsDataUrl: async () => null,
  };
});

vi.mock("@/lib/telegram/session.server", () => ({
  saveSession: async (userId: number, patch: unknown) => {
    h.sessionWrites.push({ userId, patch });
    return { ok: true as const };
  },
  withSessionChatScope: (
    data: Record<string, unknown> | undefined,
    chatId: number,
    chatType = "private",
  ) => ({ ...(data ?? {}), chatScope: { chatId, chatType } }),
}));

vi.mock("@/lib/telegram/family-shield.server", () => ({
  notifyTrustedContact: async () => ({ ok: false as const, reason: "not_linked" as const }),
}));

vi.mock("@/lib/telegram/public-post.server", () => ({
  buildTelegramPublicPostCheckEvidence: async () => null,
  enrichTelegramPublicPostResult: (result: unknown) => result,
}));

vi.mock("@/lib/telegram/public-metadata.server", () => ({
  enrichTelegramPublicMetadata: async (_input: string, result: unknown) => result,
}));

vi.mock("@/lib/telegram/reputation.server", () => ({
  enrichTelegramReputation: async (_input: string, result: unknown) => result,
}));

import type { Lang } from "@/lib/i18n";
import type { SensitiveSecretClass } from "@/lib/risk/sensitive-text";
import type { InlineQueryResultArticle } from "@/lib/telegram/api.server";
import { handleCheck } from "@/lib/telegram/handlers/check";
import { handleInlineQuery } from "@/lib/telegram/handlers/inline";
import type { Session } from "@/lib/telegram/session.server";

const SEED_WORDS = [
  "saffronalpha",
  "birchbravo",
  "cedarcharlie",
  "dahliadelta",
  "elmeka",
  "firfoxtrot",
  "gingergolf",
  "hazelhotel",
  "indigoindia",
  "juniperjuliet",
  "kiwokilo",
  "lavenderlima",
] as const;
const SINGLE_LINE_SEED = SEED_WORDS.join(" ");
const MULTILINE_SEED = SEED_WORDS.join("\n");
const NUMBERED_DOT_SEED = SEED_WORDS.map((word, index) => `${index + 1}. ${word}`).join("\n");
const NUMBERED_PAREN_SEED_CRLF = SEED_WORDS.map((word, index) => `${index + 1}) ${word}`).join(
  "\r\n",
);
const BULLETED_SEED = SEED_WORDS.map((word) => `• ${word}`).join("\n");

interface SecretRouteCase {
  name: string;
  input: string;
  lang: Lang;
  leakMarkers: readonly string[];
  expectedClass?: SensitiveSecretClass;
}

const SECRET_ROUTE_CASES: readonly SecretRouteCase[] = [
  {
    name: "UZ Cyrillic recovery label",
    input: `тиклаш ибораси: ${SINGLE_LINE_SEED}`,
    lang: "uz",
    leakMarkers: [SINGLE_LINE_SEED, SEED_WORDS[0], SEED_WORDS.at(-1)!],
  },
  {
    name: "UZ Cyrillic private-key label",
    input: "махфий калит: UZPRIVATEKEYABCDEF1234567890",
    lang: "uz",
    leakMarkers: ["UZPRIVATEKEYABCDEF1234567890"],
  },
  {
    name: "fully spaced password label",
    input: "p a s s w o r d: CorrectHorse42Zebra",
    lang: "en",
    leakMarkers: ["CorrectHorse42Zebra"],
  },
  {
    name: "fully spaced seed-phrase label",
    input: `s e e d p h r a s e: ${SINGLE_LINE_SEED}`,
    lang: "en",
    leakMarkers: [SINGLE_LINE_SEED, SEED_WORDS[0], SEED_WORDS.at(-1)!],
  },
  {
    name: "fully spaced private-key label",
    input: "p r i v a t e k e y: SPACEDPRIVATEKEY1234567890",
    lang: "en",
    leakMarkers: ["SPACEDPRIVATEKEY1234567890"],
  },
  {
    name: "multiline seed phrase",
    input: `seed phrase:\n${MULTILINE_SEED}`,
    lang: "en",
    leakMarkers: [MULTILINE_SEED, SEED_WORDS[0], SEED_WORDS.at(-1)!],
  },
  {
    name: "numbered multiline seed phrase",
    input: `seed phrase:\n${NUMBERED_DOT_SEED}\nPlease help.`,
    lang: "en",
    leakMarkers: [NUMBERED_DOT_SEED, SEED_WORDS[0], SEED_WORDS.at(-1)!],
  },
  {
    name: "UZ Cyrillic recovery-words label on one line",
    input: `тиклаш сўзлари: ${SINGLE_LINE_SEED}`,
    lang: "uz",
    leakMarkers: [SINGLE_LINE_SEED, SEED_WORDS[0], SEED_WORDS.at(-1)!],
  },
  {
    name: "UZ Cyrillic recovery-words label with numbered CRLF lines",
    input: `тиклаш сузлари:\r\n${NUMBERED_PAREN_SEED_CRLF}\r\nYordam kerak.`,
    lang: "uz",
    leakMarkers: [NUMBERED_PAREN_SEED_CRLF, SEED_WORDS[0], SEED_WORDS.at(-1)!],
  },
  {
    name: "UZ Cyrillic recovery-words label with bullet lines",
    input: `тиклаш сўзлари:\n${BULLETED_SEED}\nYordam kerak.`,
    lang: "uz",
    leakMarkers: [BULLETED_SEED, SEED_WORDS[0], SEED_WORDS.at(-1)!],
  },
  {
    name: "explicitly labeled alphanumeric verification code",
    input: "verification code: AB12CD",
    lang: "en",
    leakMarkers: ["AB12CD"],
  },
  {
    name: "bounded password-label typo",
    input: "pasword: AlphaSecret42",
    lang: "en",
    leakMarkers: ["AlphaSecret42"],
  },
  {
    name: "EN alphabetic password without punctuation separator",
    input: "password huntertwo",
    lang: "en",
    leakMarkers: ["huntertwo"],
  },
  {
    name: "RU alphabetic password without punctuation separator",
    input: "пароль секретный",
    lang: "ru",
    leakMarkers: ["секретный"],
  },
  {
    name: "UZ alphabetic password without punctuation separator",
    input: "parol maxfiysir",
    lang: "uz",
    leakMarkers: ["maxfiysir"],
  },
  {
    name: "EN multiword alphabetic passphrase after label",
    input: "passphrase correct horse battery staple",
    lang: "en",
    leakMarkers: ["correct horse battery staple", "correct", "staple"],
  },
  {
    name: "RU multiword alphabetic password after label",
    input: "пароль очень секретная фраза",
    lang: "ru",
    leakMarkers: ["очень секретная фраза", "секретная"],
  },
  {
    name: "UZ multiword alphabetic password after label",
    input: "parol juda maxfiy uzun soz",
    lang: "uz",
    leakMarkers: ["juda maxfiy uzun soz", "maxfiy"],
  },
  {
    name: "bounded recovery-label typo",
    input: `seed phrse: ${SINGLE_LINE_SEED}`,
    lang: "en",
    leakMarkers: [SINGLE_LINE_SEED, SEED_WORDS[0], SEED_WORDS.at(-1)!],
  },
  {
    name: "bounded verification-label typo",
    input: "verificaton code: ZX90QW",
    lang: "en",
    leakMarkers: ["ZX90QW"],
  },
  {
    name: "formatted alphanumeric SMS code",
    input: "SMS code: AB-12-CD",
    lang: "en",
    leakMarkers: ["AB-12-CD"],
  },
  {
    name: "value-first alphanumeric verification code",
    input: "AB12CD — verification code",
    lang: "en",
    leakMarkers: ["AB12CD"],
  },
  {
    name: "unquoted value-first multiword passphrase",
    input: "correct horse battery staple — passphrase",
    lang: "en",
    leakMarkers: ["correct horse battery staple"],
  },
  {
    name: "value-first password with final marker",
    input: "AlphaSecret! password",
    lang: "en",
    leakMarkers: ["AlphaSecret!"],
  },
  {
    name: "opposite mixed-script password labels in Latin-first order",
    input: "pаsswоrd: AlphaSecret42. пaрoль: BetaSecret84.",
    lang: "en",
    leakMarkers: [
      "AlphaSecret42",
      "BetaSecret84",
      "pаsswоrd: AlphaSecret42. пaрoль: BetaSecret84.",
    ],
  },
  {
    name: "opposite mixed-script password labels in Cyrillic-first order",
    input: "пaрoль: BetaSecret84. pаsswоrd: AlphaSecret42.",
    lang: "ru",
    leakMarkers: [
      "AlphaSecret42",
      "BetaSecret84",
      "пaрoль: BetaSecret84. pаsswоrd: AlphaSecret42.",
    ],
  },
  {
    name: "labeled API access token",
    input: "API_KEY=sk-proj-RouteOnly1234567890abcdef",
    lang: "en",
    leakMarkers: ["sk-proj-RouteOnly1234567890abcdef"],
    expectedClass: "access_token",
  },
  {
    name: "space-separated generic access token",
    input: "access token abcdefgh1234567890abcd",
    lang: "en",
    leakMarkers: ["abcdefgh1234567890abcd"],
    expectedClass: "access_token",
  },
  {
    name: "Authorization bearer token",
    input: "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.RouteOnly1234567890.signatureABC123",
    lang: "en",
    leakMarkers: ["eyJhbGciOiJIUzI1NiJ9.RouteOnly1234567890.signatureABC123"],
    expectedClass: "access_token",
  },
  {
    name: "Telegram bot token",
    input: "bot token: 123456789:AAExampleRouteToken1234567890abcdefghi",
    lang: "en",
    leakMarkers: ["123456789:AAExampleRouteToken1234567890abcdefghi"],
    expectedClass: "access_token",
  },
  {
    name: "GitHub personal access token",
    input: "ghp_RouteOnlyToken1234567890ABCDEFGHIJ12345",
    lang: "en",
    leakMarkers: ["ghp_RouteOnlyToken1234567890ABCDEFGHIJ12345"],
    expectedClass: "access_token",
  },
  {
    name: "raw JWT access token",
    input:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.RouteOnlySignature1234567890abcdef",
    lang: "en",
    leakMarkers: [
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.RouteOnlySignature1234567890abcdef",
    ],
    expectedClass: "access_token",
  },
  {
    name: "bare Bearer JWT access token",
    input:
      "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ODc2NTQzMjEwIn0.RouteOnlySignature9876543210abcdef",
    lang: "en",
    leakMarkers: [
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ODc2NTQzMjEwIn0.RouteOnlySignature9876543210abcdef",
    ],
    expectedClass: "access_token",
  },
  {
    name: "Google API key",
    input: "AIzaABCDEFGHIJKLMNOPQRSTUVWXY1234567890",
    lang: "en",
    leakMarkers: ["AIzaABCDEFGHIJKLMNOPQRSTUVWXY1234567890"],
    expectedClass: "access_token",
  },
  {
    name: "AWS long-term access-key id",
    input: "AKIATESTONLY12345678",
    lang: "en",
    leakMarkers: ["AKIATESTONLY12345678"],
    expectedClass: "access_token",
  },
  {
    name: "AWS temporary access-key id",
    input: "ASIATESTONLY87654321",
    lang: "en",
    leakMarkers: ["ASIATESTONLY87654321"],
    expectedClass: "access_token",
  },
  {
    name: "0x-prefixed raw private key",
    input: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    lang: "en",
    leakMarkers: ["0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"],
    expectedClass: "private_key",
  },
  {
    name: "punctuated standalone potential CVV",
    input: "123?",
    lang: "ru",
    leakMarkers: ["123"],
    expectedClass: "code",
  },
  {
    name: "Uzbek Latin possessive password label",
    input: "parolim: UzunMaxfiyParol",
    lang: "uz",
    leakMarkers: ["UzunMaxfiyParol"],
    expectedClass: "password",
  },
  {
    name: "Uzbek Cyrillic possessive password label",
    input: "паролим: UzunMaxfiyParol",
    lang: "uz",
    leakMarkers: ["UzunMaxfiyParol"],
    expectedClass: "password",
  },
  {
    name: "Uzbek possessive code label",
    input: "kodim: 4821",
    lang: "uz",
    leakMarkers: ["4821"],
    expectedClass: "code",
  },
  {
    name: "short explicit Bearer credential",
    input: "Bearer abcdefghijklmnop",
    lang: "en",
    leakMarkers: ["abcdefghijklmnop"],
    expectedClass: "access_token",
  },
  {
    name: "emoji-separated Cyrillic password",
    input: "Пароль🟠UzunMaxfiyParol",
    lang: "ru",
    leakMarkers: ["UzunMaxfiyParol"],
    expectedClass: "password",
  },
  {
    name: "arrow-separated Uzbek SMS code",
    input: "SMS kodi 👉 592814",
    lang: "uz",
    leakMarkers: ["592814"],
    expectedClass: "code",
  },
  {
    name: "colon-separated short Bearer credential",
    input: "Bearer: abcdefghijklmnop",
    lang: "en",
    leakMarkers: ["abcdefghijklmnop"],
    expectedClass: "access_token",
  },
];
const INDEXED_SECRET_ROUTE_CASES = SECRET_ROUTE_CASES.map((testCase, index) => ({
  ...testCase,
  index,
}));

function sessionFor(lang: Lang, userId: number): Session {
  return {
    telegramUserId: userId,
    lang,
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {},
    updatedAt: "2026-08-13T00:00:00.000Z",
  };
}

function expectNoRawSecret(visible: string, leakMarkers: readonly string[], label: string): void {
  for (const marker of leakMarkers) {
    expect(visible, `${label}: leaked ${marker}`).not.toContain(marker);
  }
}

describe("sensitive-secret Direct and Inline route preflight", () => {
  let fetchGuard: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    h.answerCalls.length = 0;
    h.sentMessages.length = 0;
    h.runCheckCalls.length = 0;
    h.sharedRateLimitCalls.length = 0;
    h.sessionWrites.length = 0;
    fetchGuard = vi.fn(async () => {
      throw new Error("network is disabled in sensitive-secret route tests");
    });
    vi.stubGlobal("fetch", fetchGuard);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(INDEXED_SECRET_ROUTE_CASES)(
    "$name never echoes the raw secret through Direct reply or Inline preview/insert",
    async ({ name, input, lang, leakMarkers, expectedClass, index }) => {
      const userId = 9_810_000 + index;
      const session = sessionFor(lang, userId);

      await handleCheck(input, {
        chatId: 9_820_000 + index,
        userId,
        session,
      });

      expect(h.sentMessages, `${name}: direct replies`).toHaveLength(1);
      const directReply = h.sentMessages[0].text;
      expectNoRawSecret(directReply, leakMarkers, `${name}: direct reply`);
      expect(h.sessionWrites, `${name}: Direct sanitized context`).toHaveLength(1);
      const directWrite = h.sessionWrites[0] as {
        userId: number;
        patch: {
          scenarioData?: {
            chatScope?: unknown;
            lastSensitiveSecret?: Record<string, unknown>;
          };
        };
      };
      const persistedContext = directWrite.patch.scenarioData?.lastSensitiveSecret;
      expect(persistedContext, `${name}: bounded Direct context`).toBeDefined();
      expect(Object.keys(persistedContext ?? {}).sort()).toEqual(["at", "classes", "lang"]);
      expect(persistedContext?.lang).toMatch(/^(?:ru|uz|en)$/u);
      expect(persistedContext?.classes).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^(?:password|code|recovery_phrase|private_key|access_token)$/u),
        ]),
      );
      if (expectedClass) expect(persistedContext?.classes).toContain(expectedClass);
      expect(Number.isFinite(Date.parse(String(persistedContext?.at)))).toBe(true);
      expect(directWrite.patch.scenarioData?.chatScope).toEqual({
        chatId: 9_820_000 + index,
        chatType: "private",
      });
      expect(JSON.stringify(directWrite)).not.toContain(input);
      expectNoRawSecret(
        JSON.stringify(directWrite),
        leakMarkers,
        `${name}: Direct session context`,
      );

      h.sessionWrites.length = 0;

      await handleInlineQuery(
        input,
        { userId, languageCode: lang, session },
        `secret-route-${index}`,
      );

      expect(h.answerCalls, `${name}: inline answers`).toHaveLength(1);
      expect(h.answerCalls[0]).toMatchObject({
        inlineQueryId: `secret-route-${index}`,
        cacheTime: 10,
        isPersonal: true,
      });
      expect(h.answerCalls[0].results).toHaveLength(1);
      const article = h.answerCalls[0].results[0] as InlineQueryResultArticle;
      const preview = `${article.title}\n${article.description ?? ""}`;
      const inserted = article.input_message_content.message_text;

      expectNoRawSecret(preview, leakMarkers, `${name}: inline preview`);
      expectNoRawSecret(inserted, leakMarkers, `${name}: inserted result`);
      expect(preview, `${name}: preview must be a static private card`).not.toContain(input);
      expect(inserted, `${name}: inserted result must be a static private card`).not.toContain(
        input,
      );
      expect(article.id, `${name}: private-card semantic id`).toMatch(/^private-/u);
      if (expectedClass === "access_token") {
        expect(article.id, `${name}: access-token semantic id`).toMatch(/^private-access-token-/u);
      }
      expectNoRawSecret(JSON.stringify(article), leakMarkers, `${name}: serialized article`);

      expect(h.runCheckCalls, `${name}: runCheck/AI`).toEqual([]);
      expect(h.sharedRateLimitCalls, `${name}: rate limit storage`).toEqual([]);
      expect(h.sessionWrites, `${name}: Inline session persistence`).toEqual([]);
      expect(fetchGuard, `${name}: network`).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      name: "RU seed next steps",
      input:
        "Для возврата крипты требуют seed phrase river apple stone cloud eagle mint ocean book lamp train gold moon",
      followUp: "Что мне теперь делать?",
      lang: "ru" as const,
      profileLang: "uz" as const,
      secret: "river apple stone cloud eagle mint ocean book lamp train gold moon",
      topic: /сид\\?-фраз/iu,
      safety: /не сообщайте|официальном приложении/iu,
    },
    {
      name: "UZ OTP why and next steps",
      input: "Xodim mendan SMS kod 592814 ni aytishni so'rayapti",
      followUp: "Nega bu xavfli va keyin nima qilay?",
      lang: "uz" as const,
      profileLang: "en" as const,
      secret: "592814",
      topic: /sms-kod|otp|pin/iu,
      safety: /kodni aytmang|rasmiy ilovani/iu,
    },
    {
      name: "UZ password trust question",
      input: "Yordam xizmati parolim Bahor2026!Z ni yuborishni so'radi",
      followUp: "Nega ularga ishonmasligim kerak?",
      lang: "uz" as const,
      profileLang: "en" as const,
      secret: "Bahor2026!Z",
      topic: /parol/iu,
      safety: /parolni aytmang|rasmiy sayt/iu,
    },
    {
      name: "UZ seed next steps",
      input:
        "Kripto yordamchisi seed phrase river apple stone cloud eagle mint ocean book lamp train gold moon ni so'radi",
      followUp: "Endi nima qilishim kerak?",
      lang: "uz" as const,
      profileLang: "en" as const,
      secret: "river apple stone cloud eagle mint ocean book lamp train gold moon",
      topic: /seed phrase/iu,
      safety: /yubormang|rasmiy ilova/iu,
    },
    {
      name: "EN seed next steps",
      input:
        "A recovery agent asks for seed phrase river apple stone cloud eagle mint ocean book lamp train gold moon",
      followUp: "What should I do now?",
      lang: "en" as const,
      profileLang: "ru" as const,
      secret: "river apple stone cloud eagle mint ocean book lamp train gold moon",
      topic: /seed phrase/iu,
      safety: /do not share|official app/iu,
    },
    {
      name: "RU access-token next steps",
      input: "В поддержку отправили API_KEY=sk-proj-FollowUpOnly1234567890abcdef",
      followUp: "Что дальше?",
      lang: "ru" as const,
      profileLang: "uz" as const,
      secret: "sk-proj-FollowUpOnly1234567890abcdef",
      topic: /токен доступа/iu,
      safety: /отзовите|создайте новый/iu,
    },
  ])(
    "$name keeps only bounded topic/language context and never the secret value",
    async ({ input, followUp, lang, profileLang, secret, topic, safety }) => {
      const userId = 9_900_000;
      await handleCheck(input, {
        chatId: userId,
        userId,
        session: sessionFor(profileLang, userId),
      });

      expect(h.sessionWrites).toHaveLength(1);
      const initialWrite = h.sessionWrites[0] as {
        patch: { scenarioData: Session["scenarioData"] };
      };
      expect(initialWrite.patch.scenarioData.lastSensitiveSecret?.lang).toBe(lang);
      expect(JSON.stringify(initialWrite)).not.toContain(input);
      expect(JSON.stringify(initialWrite)).not.toContain(secret);

      h.sentMessages.length = 0;
      h.sessionWrites.length = 0;
      await handleCheck(followUp, {
        chatId: userId,
        userId,
        session: {
          ...sessionFor(profileLang, userId),
          scenarioData: initialWrite.patch.scenarioData,
        },
      });

      expect(h.sentMessages).toHaveLength(1);
      const reply = h.sentMessages[0].text;
      expect(reply).toMatch(topic);
      expect(reply).toMatch(safety);
      expect(reply).not.toContain(secret);
      expect(h.sessionWrites, "follow-up must not persist any new text").toEqual([]);
      expect(h.runCheckCalls, "follow-up must bypass runCheck/AI").toEqual([]);
      expect(h.sharedRateLimitCalls, "follow-up must bypass storage rate limiting").toEqual([]);
      expect(fetchGuard, "follow-up network").not.toHaveBeenCalled();
    },
  );

  it("keeps bare OTP/PIN and valid PAN values out of every Inline sink", async () => {
    const values = [
      "4821",
      "59372",
      "４８２１",
      "5\u200B9372",
      "4111 1111 1111 1111",
      "4000 0000 0000 0000 006",
    ] as const;
    const session = sessionFor("en", 9_880_000);

    for (const [index, value] of values.entries()) {
      await handleInlineQuery(
        value,
        { userId: session.telegramUserId, languageCode: "en", session },
        `private-numeric-${index}`,
      );
    }

    const articles = h.answerCalls.map((call) => call.results[0] as InlineQueryResultArticle);
    expect(new Set(articles.map((article) => article.id)).size).toBe(1);
    expect(articles[0].id).toMatch(/^ambiguous-numeric-/u);
    for (const value of values) {
      expect(JSON.stringify(articles)).not.toContain(value);
      const asciiDigits = value.replace(/\D/gu, "");
      if (asciiDigits) expect(JSON.stringify(articles)).not.toContain(asciiDigits);
    }
    expect(h.runCheckCalls, "numeric private path must bypass runCheck/AI").toEqual([]);
    expect(
      h.sharedRateLimitCalls,
      "numeric private path must bypass storage rate limiting",
    ).toEqual([]);
    expect(h.sessionWrites, "numeric Inline path must stay stateless").toEqual([]);
    expect(fetchGuard, "numeric private path network").not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "English follow-up overrides a saved Russian secret language",
      input: "Сотрудник просит SMS код 481927",
      followUp: "Why is this dangerous?",
      initialLang: "ru" as const,
      profileLang: "uz" as const,
      expected: /an sms code|do not share the code/iu,
      unexpected: /код не сообщайте|kodni aytmang/iu,
    },
    {
      name: "Uzbek follow-up overrides a saved English secret language",
      input: "Support asks for SMS code 592814",
      followUp: "Nega bu xavfli?",
      initialLang: "en" as const,
      profileLang: "ru" as const,
      expected: /sms-kod|kodni aytmang/iu,
      unexpected: /do not share the code|код не сообщайте/iu,
    },
    {
      name: "Russian follow-up overrides a saved Uzbek secret language",
      input: "Xodim mendan SMS kod 731904 ni aytishni so'rayapti",
      followUp: "Почему это опасно?",
      initialLang: "uz" as const,
      profileLang: "en" as const,
      expected: /sms.*код.*код не сообщайте/isu,
      unexpected: /do not share the code|kodni aytmang/iu,
    },
  ])(
    "$name and uses saved language only as the resolver fallback",
    async ({ input, followUp, initialLang, profileLang, expected, unexpected }) => {
      const userId = 9_910_000;
      await handleCheck(input, {
        chatId: userId,
        userId,
        session: sessionFor(profileLang, userId),
      });

      const initialWrite = h.sessionWrites[0] as {
        patch: { scenarioData: Session["scenarioData"] };
      };
      expect(initialWrite.patch.scenarioData.lastSensitiveSecret?.lang).toBe(initialLang);

      h.sentMessages.length = 0;
      h.sessionWrites.length = 0;
      await handleCheck(followUp, {
        chatId: userId,
        userId,
        session: {
          ...sessionFor(profileLang, userId),
          scenarioData: initialWrite.patch.scenarioData,
        },
      });

      expect(h.sentMessages).toHaveLength(1);
      expect(h.sentMessages[0].text).toMatch(expected);
      expect(h.sentMessages[0].text).not.toMatch(unexpected);
      expect(h.sessionWrites).toEqual([]);
      expect(h.runCheckCalls).toEqual([]);
      expect(h.sharedRateLimitCalls).toEqual([]);
      expect(fetchGuard).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["почему?", "ru", /sms.*код.*не сообщайте/isu],
    ["пачему?", "ru", /sms.*код.*не сообщайте/isu],
    ["nega?", "uz", /sms.*kod.*kodni aytmang/isu],
    ["nima uchun?", "uz", /sms.*kod.*kodni aytmang/isu],
    ["why?", "en", /an sms code.*do not share the code/isu],
    ["что дальше?", "ru", /sms.*код.*не сообщайте/isu],
    ["дальше что?", "ru", /sms.*код.*не сообщайте/isu],
    ["what next?", "en", /an sms code.*do not share the code/isu],
    ["now what?", "en", /an sms code.*do not share the code/isu],
    ["keyin nima?", "uz", /sms.*kod.*kodni aytmang/isu],
    ["endi nima?", "uz", /sms.*kod.*kodni aytmang/isu],
  ] as const)(
    "answers the bounded secret follow-up %s without a fresh check",
    async (text, lang, expected) => {
      const userId = 9_920_000;
      await handleCheck(text, {
        chatId: userId,
        userId,
        session: {
          ...sessionFor(lang, userId),
          scenarioData: {
            lastSensitiveSecret: {
              classes: ["code"],
              lang,
              at: new Date().toISOString(),
            },
          },
        },
      });

      expect(h.sentMessages).toHaveLength(1);
      expect(h.sentMessages[0].text).toMatch(expected);
      expect(h.sessionWrites).toEqual([]);
      expect(h.runCheckCalls).toEqual([]);
      expect(h.sharedRateLimitCalls).toEqual([]);
      expect(fetchGuard).not.toHaveBeenCalled();
    },
  );
});
