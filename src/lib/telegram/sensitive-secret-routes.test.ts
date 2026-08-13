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
    async ({ name, input, lang, leakMarkers, index }) => {
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
      expectNoRawSecret(JSON.stringify(article), leakMarkers, `${name}: serialized article`);

      expect(h.runCheckCalls, `${name}: runCheck/AI`).toEqual([]);
      expect(h.sharedRateLimitCalls, `${name}: rate limit storage`).toEqual([]);
      expect(h.sessionWrites, `${name}: session persistence`).toEqual([]);
      expect(fetchGuard, `${name}: network`).not.toHaveBeenCalled();
    },
  );
});
