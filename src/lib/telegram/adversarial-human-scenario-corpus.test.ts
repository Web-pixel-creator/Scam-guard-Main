import process from "node:process";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  answerCalls: [] as Array<{
    inlineQueryId: string;
    results: unknown[];
    cacheTime?: number;
    isPersonal?: boolean;
  }>,
  sentMessages: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
  runCheckCalls: [] as Array<Record<string, unknown>>,
  dbMutations: [] as Array<{ table: string; operation: string }>,
  rpcCalls: [] as string[],
  sessionWrites: [] as Array<{ userId: number; patch: unknown }>,
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

vi.mock("@/integrations/supabase/client.server", () => {
  type FakeBuilder = {
    select: () => FakeBuilder;
    eq: () => FakeBuilder;
    gte: () => FakeBuilder;
    gt: () => FakeBuilder;
    in: () => FakeBuilder;
    limit: () => FakeBuilder;
    order: () => FakeBuilder;
    maybeSingle: () => Promise<{ data: null; error: null }>;
    single: () => Promise<{ data: null; error: null }>;
    insert: () => Promise<{ error: null }>;
    upsert: () => Promise<{ error: null }>;
    update: () => FakeBuilder;
    delete: () => FakeBuilder;
  };

  function builder(table: string): FakeBuilder {
    const value: FakeBuilder = {
      select: () => value,
      eq: () => value,
      gte: () => value,
      gt: () => value,
      in: () => value,
      limit: () => value,
      order: () => value,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
      insert: async () => {
        h.dbMutations.push({ table, operation: "insert" });
        return { error: null };
      },
      upsert: async () => {
        h.dbMutations.push({ table, operation: "upsert" });
        return { error: null };
      },
      update: () => {
        h.dbMutations.push({ table, operation: "update" });
        return value;
      },
      delete: () => {
        h.dbMutations.push({ table, operation: "delete" });
        return value;
      },
    };
    return value;
  }

  return {
    supabaseAdmin: {
      from: (table: string) => builder(table),
      rpc: async (name: string) => {
        h.rpcCalls.push(name);
        if (name === "claim_rate_limit") {
          return {
            data: [
              {
                allowed: true,
                remaining: 99,
                retry_after_sec: 0,
                current_count: 1,
              },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      },
    },
  };
});

vi.mock("@/lib/risk/check-core", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/risk/check-core")>();
  return {
    ...actual,
    runCheck: async (options: Record<string, unknown>) => {
      h.runCheckCalls.push(options);
      // Exercise the real deterministic checker for both Inline and direct
      // bot routes while explicitly disabling AI, persistence and reputation
      // network calls. A fixed SMS-code result would make unrelated job,
      // charity or parcel scenarios look green with the wrong response.
      return actual.runCheck({
        ...(options as unknown as Parameters<typeof actual.runCheck>[0]),
        skipAi: true,
        skipUrlReputation: true,
        persist: false,
        rateLimitProfile: "telegram_inline_preview",
      });
    },
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
import {
  ADVERSARIAL_HUMAN_EXPECTED_CASE_COUNT,
  ADVERSARIAL_HUMAN_FAMILY_COUNT,
  ADVERSARIAL_HUMAN_LANGUAGE_COUNT,
  ADVERSARIAL_HUMAN_MUTATION_COUNT,
  ADVERSARIAL_HUMAN_SCENARIO_CORPUS,
  type AdversarialHumanScenario,
} from "@/lib/telegram/adversarial-human-scenario-corpus";
import { validateMarkdownV2 } from "@/lib/telegram/__tests__/markdown-v2-validator";
import { handleCheck } from "@/lib/telegram/handlers/check";
import { handleInlineQuery } from "@/lib/telegram/handlers/inline";
import type { Session } from "@/lib/telegram/session.server";

const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let fetchGuard: ReturnType<typeof vi.fn>;
let sequence = 0;

function sessionFor(lang: Lang, userId: number): Session {
  return {
    telegramUserId: userId,
    lang,
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {},
    updatedAt: "2026-07-16T00:00:00.000Z",
  };
}

function mismatchedProfileLanguage(lang: Lang): Lang {
  return lang === "ru" ? "en" : "ru";
}

function markdownV2ToPlainText(value: string): string {
  const escapable = new Set("_*[]()~`>#+-=|{}.!\\");
  return value.replace(/\\(.)/gu, (match, escaped: string) =>
    escapable.has(escaped) ? escaped : match,
  );
}

function normalizeVisible(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200b-\u200f\u2060\ufeff]/gu, "")
    .toLocaleLowerCase("ru")
    .replace(/\s+/gu, " ")
    .trim();
}

function hasExpectedSafetyLanguage(visible: string, testCase: AdversarialHumanScenario): boolean {
  const normalized = normalizeVisible(visible);
  return testCase.expectedSafetyTerms.some((term) => normalized.includes(normalizeVisible(term)));
}

function expectNoSyntheticSecretLeak(visible: string, testCase: AdversarialHumanScenario): void {
  for (const secret of testCase.secrets) {
    expect(visible, testCase.id).not.toContain(secret);
  }
}

function removeUserEcho(visible: string, query: string): string {
  let withoutEcho = visible.replaceAll(query, " ");
  for (const line of query.split(/\r?\n/u).map((value) => value.trim())) {
    if (line.length >= 8) withoutEcho = withoutEcho.replaceAll(line, " ");
  }
  return withoutEcho.replace(/\s+/gu, " ").trim();
}

// Unlike the broad language-safety assertion, this oracle examines only the
// preview title/description (never the echoed user input). It prevents a
// semantically wrong but vaguely cautious answer from passing the 1,260-case
// corpus, e.g. job fraud receiving generic OTP or link advice.
const FAMILY_PREVIEW_TOPIC: Readonly<Record<string, RegExp>> = Object.freeze({
  "sms-code-request": /(?:sms|otp|код|kod|code)/iu,
  "password-request": /(?:парол|parol|password)/iu,
  "recovery-phrase-request": /(?:сид|seed|recovery|tiklash)/iu,
  "card-cvv-request": /(?:cvv|карт|karta|card|код|kod|code)/iu,
  "passport-request": /(?:документ|паспорт|pasport|document|passport)/iu,
  "passport-already-shared":
    /(?:паспорт|pasport|passport|документ|document|отправ|yubor|sent|shared)/iu,
  "bank-impersonation": /(?:банк|bank|подтверж|tasdiq|confirm)/iu,
  "government-code-request": /(?:гос|oneid|davlat|government|код|kod|code)/iu,
  "police-impersonation": /(?:поли|госорган|давлат|davlat|iib|iiv|organ|polits|police|inspector)/iu,
  "sim-swap": /(?:sim|оператор|operator)/iu,
  "remote-access": /(?:anydesk|удал|remote|экран|ekran|screen|прилож|ilova|app)/iu,
  "apk-install": /(?:apk|файл|file|прилож|ilova|app)/iu,
  "vote-link": /(?:голос|ovoz|vot|telegram|ссыл|havola|link)/iu,
  "fake-tax-payment": /(?:налог|soliq|tax|сбор|fee|ссыл|havola|link)/iu,
  "safe-account-transfer": /(?:перевод|деньг|o['’]?tkaz|pul|transfer|money)/iu,
  "family-emergency": /(?:близк|сын|yaqin|o['’]?g['’]?l|relative|son|перезвон|qayta|call)/iu,
  "job-training-fee": /(?:работ|обуч|ish|o['’]?qish|job|training)/iu,
  "earning-channel": /(?:заработ|канал|daromad|kanal|earning|channel)/iu,
  "crypto-investment": /(?:инвест|крип|ton|usdt|депозит|depozit|investment|deposit)/iu,
  "romance-money": /(?:отнош|знаком|билет|tanish|chipta|romance|ticket)/iu,
  "photo-extortion": /(?:шантаж|вымог|фото|shantaj|tovlam|surat|blackmail|extortion|photo)/iu,
  "parcel-fee": /(?:достав|посыл|курьер|posilka|kuryer|delivery|parcel|courier)/iu,
  "marketplace-delivery": /(?:достав|курьер|карт|kuryer|karta|delivery|courier|card)/iu,
  "loan-advance-fee": /(?:кредит|комисс|kredit|komiss|loan|commission|fee)/iu,
  "charity-pressure": /(?:фонд|пожертв|jamg['’]?arma|charity|личн|shaxsiy|personal)/iu,
  "qr-login": /(?:qr|telegram|вход|kirish|login|sign)/iu,
  "telegram-channel-invite": /(?:telegram|канал|чат|kanal|channel|chat)/iu,
  "unknown-stranger-request": /(?:незнаком|просьб|notanish|so['’]?rov|stranger|request)/iu,
  "fake-support": /(?:поддерж|защит|yordam|himoya|qo['’]?llab|quvvat|xavfsiz|support|protection)/iu,
  "bank-contact-from-message": /(?:банк|номер|официал|bank|raqam|rasmiy|number|official)/iu,
  "authority-physical-coercion":
    /(?:подж|заправ|опасн\p{L}*\s+(?:задан|действ|требован)|o['’]?t\s+qo['’]?y|yoqilg['’]?i|xavfli\s+(?:topshiriq|harakat)|fire|burn|gas station|dangerous\s+(?:task|act|demand))/iu,
  "neighbor-video-malware":
    /(?=.*(?:видео|video))(?=.*(?:сосед|знаком|подъезд|камер|файл|apk|плеер|qo['’]?shni|tanish|kirish|kamera|fayl|ilova|player|neighbor|acquaint|contact|entrance|camera|file|viewer))/iu,
  "fake-fine-cashback-app":
    /(?=.*(?:штраф|jarima|fine))(?=.*(?:apk|прилож|ilova|app|файл|file|вред|zarar|malware))/iu,
  "penalty-points-cancellation":
    /(?:штрафн\p{L}*\s+балл|балл\p{L}*\s+(?:аннулир|спис|удал)|jarima\s+ball|ball\p{L}*\s+(?:bekor|o['’]?chir|nol)|penalty\s+point|points?\s+(?:delet|erase|cancel|remove))/iu,
  "known-contact-prize-link":
    /(?=[\s\S]*(?:знаком|друг|аккаунт|tanish|do['’]?st|akkaunt|friend|contact|account))(?=[\s\S]*(?:приз|подар|банк|yutuq|sovg['’]?a|mukofot|bank|prize|gift))/iu,
});

const FAMILY_INLINE_SEMANTIC: Readonly<Record<string, string>> = Object.freeze({
  "sms-code-request": "private-code",
  "password-request": "private-password",
  "recovery-phrase-request": "private-recovery-secret",
  "card-cvv-request": "private-code",
  "passport-request": "personal-data",
  "passport-already-shared": "personal-data-aftercare",
  "bank-impersonation": "bank-impersonation",
  "government-code-request": "gov-service",
  "police-impersonation": "official-impersonation",
  "sim-swap": "sim-swap",
  "remote-access": "app-request",
  "apk-install": "malicious-file",
  "vote-link": "voting-link",
  "fake-tax-payment": "tax-payment",
  "safe-account-transfer": "safe-account-transfer",
  "family-emergency": "relative-distress",
  "job-training-fee": "job-offer",
  "earning-channel": "earning-channel",
  "crypto-investment": "investment-offer",
  "romance-money": "romance-money",
  "photo-extortion": "blackmail-threat",
  "parcel-fee": "delivery-payment",
  "marketplace-delivery": "marketplace-delivery",
  "loan-advance-fee": "loan-advance-fee",
  "charity-pressure": "charity-pressure",
  "qr-login": "qr-login",
  "telegram-channel-invite": "chat-invite",
  "unknown-stranger-request": "unknown-contact",
  "fake-support": "support-impersonation",
  "bank-contact-from-message": "bank-contact",
  "authority-physical-coercion": "dangerous-task",
  "neighbor-video-malware": "neighbor-video",
  "fake-fine-cashback-app": "fake-fine-apk",
  "penalty-points-cancellation": "penalty-points-fee",
  "known-contact-prize-link": "known-contact-prize",
});

function expectInlineSemanticId(
  article: InlineQueryResultArticle,
  testCase: AdversarialHumanScenario,
): void {
  const semantic = FAMILY_INLINE_SEMANTIC[testCase.family];
  expect(semantic, testCase.id).toBeTruthy();
  const prefix = semantic.startsWith("private-")
    ? semantic
    : `check-(?:unknown|suspicious|high_risk)-${semantic}`;
  expect(article.id, testCase.id).toMatch(new RegExp(`^${prefix}-[A-Za-z0-9_-]{16}$`, "u"));
  expect(article.id, testCase.id).not.toMatch(/^check-safe(?:-|$)/u);
}

function expectBoundedInlineArticle(
  article: InlineQueryResultArticle,
  testCase: AdversarialHumanScenario,
): void {
  expect(article.type, testCase.id).toBe("article");
  expect(article.id.length, testCase.id).toBeGreaterThan(0);
  expect(new TextEncoder().encode(article.id).length, testCase.id).toBeLessThanOrEqual(64);
  expect(article.title.trim().length, testCase.id).toBeGreaterThan(0);
  expect(article.title.length, testCase.id).toBeLessThanOrEqual(256);
  expect(article.description?.trim().length ?? 0, testCase.id).toBeGreaterThan(0);
  expect(article.description?.length ?? 0, testCase.id).toBeLessThanOrEqual(512);
  expect(article.input_message_content.message_text.trim().length, testCase.id).toBeGreaterThan(0);
  expect(article.input_message_content.message_text.length, testCase.id).toBeLessThanOrEqual(4096);
  expect(article.input_message_content.parse_mode, testCase.id).toBe("MarkdownV2");
  expect(validateMarkdownV2(article.input_message_content.message_text), testCase.id).toMatchObject(
    {
      valid: true,
      errors: [],
    },
  );
  expect(JSON.stringify(article), testCase.id).not.toContain("undefined");
}

describe("offline 1,260-scenario adversarial human-language corpus", () => {
  beforeAll(() => {
    process.env.SUPABASE_URL = "https://offline-adversarial-corpus.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "offline-adversarial-corpus-service-key";
    fetchGuard = vi.fn(() => {
      throw new Error("adversarial human corpus must not access Telegram, AI, DB, or network");
    });
    vi.stubGlobal("fetch", fetchGuard);
  });

  beforeEach(() => {
    h.answerCalls.length = 0;
    h.sentMessages.length = 0;
    h.runCheckCalls.length = 0;
    h.dbMutations.length = 0;
    h.rpcCalls.length = 0;
    h.sessionWrites.length = 0;
  });

  afterEach(() => {
    expect(fetchGuard).not.toHaveBeenCalled();
    expect(h.dbMutations).toEqual([]);
  });

  afterAll(() => {
    expect(fetchGuard).not.toHaveBeenCalled();
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;
    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
    vi.unstubAllGlobals();
  });

  it("has the exact deterministic 35 x 3 x 12 shape and independent metadata", () => {
    expect(ADVERSARIAL_HUMAN_FAMILY_COUNT).toBe(35);
    expect(ADVERSARIAL_HUMAN_LANGUAGE_COUNT).toBe(3);
    expect(ADVERSARIAL_HUMAN_MUTATION_COUNT).toBe(12);
    expect(ADVERSARIAL_HUMAN_EXPECTED_CASE_COUNT).toBe(1260);
    expect(ADVERSARIAL_HUMAN_SCENARIO_CORPUS).toHaveLength(1260);

    const ids = ADVERSARIAL_HUMAN_SCENARIO_CORPUS.map(({ id }) => id);
    const queries = ADVERSARIAL_HUMAN_SCENARIO_CORPUS.map(({ lang, query }) => `${lang}\0${query}`);
    expect(new Set(ids).size).toBe(1260);
    expect(new Set(queries).size).toBe(1260);

    const familyCounts = new Map<string, number>();
    const languageCounts = new Map<Lang, number>();
    const mutationCounts = new Map<string, number>();
    for (const testCase of ADVERSARIAL_HUMAN_SCENARIO_CORPUS) {
      familyCounts.set(testCase.family, (familyCounts.get(testCase.family) ?? 0) + 1);
      languageCounts.set(testCase.lang, (languageCounts.get(testCase.lang) ?? 0) + 1);
      mutationCounts.set(testCase.mutation, (mutationCounts.get(testCase.mutation) ?? 0) + 1);
      expect(testCase.query.trim().length, testCase.id).toBeGreaterThan(0);
      expect([...testCase.query].length, testCase.id).toBeLessThanOrEqual(512);
      expect(testCase.expectedSafetyTerms.length, testCase.id).toBeGreaterThan(0);
    }

    expect([...familyCounts.values()].every((count) => count === 36)).toBe(true);
    expect(Object.fromEntries(languageCounts)).toEqual({ ru: 420, uz: 420, en: 420 });
    expect([...mutationCounts.values()].every((count) => count === 105)).toBe(true);
  });

  it.each(ADVERSARIAL_HUMAN_SCENARIO_CORPUS)(
    "$id produces a private, bounded, localized Inline answer without suppressing the risk tail",
    async (testCase) => {
      sequence += 1;
      const userId = 9_160_000 + sequence;
      const profileLang = mismatchedProfileLanguage(testCase.lang);
      const inlineQueryId = `adversarial-inline-${sequence}`;

      await handleInlineQuery(
        testCase.query,
        {
          userId,
          languageCode: profileLang,
          session: sessionFor(profileLang, userId),
        },
        inlineQueryId,
      );

      expect(h.answerCalls, testCase.id).toHaveLength(1);
      const answer = h.answerCalls[0];
      expect(answer, testCase.id).toMatchObject({ inlineQueryId, cacheTime: 10, isPersonal: true });
      expect(answer.results, testCase.id).toHaveLength(1);
      expect(h.sessionWrites, testCase.id).toEqual([]);
      const article = answer.results[0] as InlineQueryResultArticle;
      expectBoundedInlineArticle(article, testCase);
      expectInlineSemanticId(article, testCase);
      const previewCopy = `${article.title}\n${article.description ?? ""}`;
      expect(previewCopy, `${testCase.id}\n${previewCopy}`).toMatch(
        FAMILY_PREVIEW_TOPIC[testCase.family],
      );

      const plainMessage = markdownV2ToPlainText(article.input_message_content.message_text);
      const visible = [article.title, article.description ?? "", plainMessage].join("\n");
      expectNoSyntheticSecretLeak(visible, testCase);
      expect(
        hasExpectedSafetyLanguage(previewCopy, testCase),
        `${testCase.id}\n${previewCopy}`,
      ).toBe(true);
      expect(article.id, testCase.id).not.toMatch(/^(?:help|small-talk|too-long|error)-/u);
      expect(visible, testCase.id).not.toMatch(
        /\b(?:intent[_ -]?id|reason[_ -]?code|classifier|routing\s+table|deterministic)\b/iu,
      );

      for (const options of h.runCheckCalls) {
        expect(options, testCase.id).toMatchObject({
          channel: "telegram",
          skipAi: true,
          skipUrlReputation: true,
          persist: false,
          rateLimitProfile: "telegram_inline_preview",
        });
      }
    },
  );

  it.each(ADVERSARIAL_HUMAN_SCENARIO_CORPUS)(
    "$id produces a bounded direct-bot reply or sends the complete dangerous text to the checker",
    async (testCase) => {
      sequence += 1;
      const userId = 9_260_000 + sequence;
      const profileLang = mismatchedProfileLanguage(testCase.lang);
      await handleCheck(testCase.query, {
        chatId: 9_360_000 + sequence,
        userId,
        session: sessionFor(profileLang, userId),
      });

      expect(h.sentMessages.length, testCase.id).toBeGreaterThan(0);
      expect(h.sentMessages.length, testCase.id).toBeLessThanOrEqual(2);
      const visible = h.sentMessages.map(({ text }) => markdownV2ToPlainText(text)).join("\n");
      const nonEchoVisible = removeUserEcho(visible, testCase.query);
      expect(visible.trim().length, testCase.id).toBeGreaterThan(20);
      expect(visible.length, testCase.id).toBeLessThanOrEqual(8192);
      expectNoSyntheticSecretLeak(visible, testCase);
      expect(nonEchoVisible, `${testCase.id}\n${nonEchoVisible}`).toMatch(
        FAMILY_PREVIEW_TOPIC[testCase.family],
      );
      expect(
        hasExpectedSafetyLanguage(nonEchoVisible, testCase),
        `${testCase.id}\n${nonEchoVisible}`,
      ).toBe(true);
      expect(visible, testCase.id).not.toMatch(
        /\b(?:intent[_ -]?id|reason[_ -]?code|classifier|routing\s+table|deterministic)\b/iu,
      );

      if (h.runCheckCalls.length > 0) {
        expect(h.runCheckCalls, testCase.id).toHaveLength(1);
        expect(h.runCheckCalls[0], testCase.id).toMatchObject({
          input: testCase.query,
          lang: testCase.lang,
          channel: "telegram",
        });
      }
    },
  );
});
