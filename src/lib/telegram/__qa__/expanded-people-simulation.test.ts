// Permanent offline-only semantic QA harness. It drives the repository's
// real webhook/router/handler/rules pipeline while keeping every external
// boundary deny-closed.
// Telegram, Supabase, AI, reputation and all network boundaries are mocked or
// deny-closed. Synthetic secrets below are test fixtures, never real secrets.

import process from "node:process";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const HARNESS_ENV = Object.freeze({
  OPENAI_API_KEY: "",
  OPENAI_TTS_API_KEY: "",
  GEMINI_TTS_API_KEY: "",
  SUPABASE_URL: "https://expanded-people.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "expanded-people-synthetic-service-key",
});
const ORIGINAL_ENV = new Map(
  Object.keys(HARNESS_ENV).map((key) => [key, process.env[key]] as const),
);
// These authored sessions do not test elapsed wall time. A real-clock ISO
// millisecond suffix can accidentally equal a short synthetic CVV (e.g. 614),
// making the strict string oracle report a leak in enum-only metadata. Keep
// Date deterministic, not the oracle permissive; timers/performance stay real.
const HARNESS_TIME = "2026-10-09T00:00:00.000Z";
const REAL_SET_TIMEOUT = globalThis.setTimeout;
const REAL_PERFORMANCE_NOW = performance.now;

function installHarnessEnvironment(): void {
  for (const [key, value] of Object.entries(HARNESS_ENV)) process.env[key] = value;
}

function restoreHarnessEnvironment(): void {
  for (const [key, value] of ORIGINAL_ENV) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const h = vi.hoisted(() => ({
  sent: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
  inline: [] as Array<{
    inlineQueryId: string;
    results: unknown[];
    cacheTime?: number;
    isPersonal?: boolean;
  }>,
  sessions: new Map<number, Record<string, unknown>>(),
  runChecks: [] as Array<Record<string, unknown>>,
  mockDbCalls: [] as string[],
  externalFetchAttempts: 0,
}));

vi.mock("@/lib/telegram/api.server", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/telegram/api.server")>();
  return {
    ...actual,
    sendMessage: async (options: { chatId: number; text: string; keyboard?: unknown }) => {
      h.sent.push(options);
      return { ok: true as const, messageId: 900_000 + h.sent.length };
    },
    editMessageText: async (options: { chatId: number; text: string; keyboard?: unknown }) => {
      h.sent.push(options);
      return { ok: true as const };
    },
    answerInlineQuery: async (options: {
      inlineQueryId: string;
      results: unknown[];
      cacheTime?: number;
      isPersonal?: boolean;
    }) => {
      h.inline.push(options);
      return { ok: true as const };
    },
    sendChatAction: async () => ({ ok: true as const }),
    answerCallbackQuery: async () => ({ ok: true as const }),
    sendAudioFile: async () => ({ ok: true as const }),
    getChatInfo: async () => ({ kind: "unavailable" as const }),
    getFile: async () => null,
    downloadFileAsDataUrl: async () => null,
  };
});

vi.mock("@/integrations/supabase/client.server", () => {
  type Builder = Record<string, (...args: unknown[]) => unknown>;
  function builder(table: string): Builder {
    const b: Builder = {};
    for (const name of ["select", "eq", "gte", "gt", "in", "limit", "order", "not", "is"]) {
      b[name] = () => b;
    }
    b.maybeSingle = async () => ({ data: null, error: null });
    b.single = async () => ({ data: null, error: null });
    b.insert = async () => {
      h.mockDbCalls.push(`${table}:insert`);
      return { data: null, error: null };
    };
    b.upsert = async () => {
      h.mockDbCalls.push(`${table}:upsert`);
      return { data: null, error: null };
    };
    b.update = () => {
      h.mockDbCalls.push(`${table}:update`);
      return b;
    };
    b.delete = () => {
      h.mockDbCalls.push(`${table}:delete`);
      return b;
    };
    return b;
  }

  return {
    supabaseAdmin: {
      from: (table: string) => builder(table),
      rpc: async (name: string, args: Record<string, unknown> = {}) => {
        h.mockDbCalls.push(`rpc:${name}`);
        if (name === "begin_telegram_update") {
          return {
            data: [
              {
                decision: "acquired",
                processing_fence: 1,
                retry_after_sec: 0,
                lease_expires_at: "2099-01-01T00:00:00.000Z",
                attempt_count: 1,
              },
            ],
            error: null,
          };
        }
        if (name === "complete_telegram_update" || name === "mark_telegram_update_failure") {
          return { data: true, error: null };
        }
        if (name === "claim_rate_limit") {
          return {
            data: [{ allowed: true, remaining: 99, retry_after_sec: 0, current_count: 1 }],
            error: null,
          };
        }
        if (name === "load_telegram_session_fenced") {
          const userId = Number(args.p_telegram_user_id);
          return {
            data: { lease_valid: true, session: h.sessions.get(userId) ?? null },
            error: null,
          };
        }
        if (name === "save_telegram_session_sequenced" || name === "save_telegram_session_fenced") {
          const userId = Number(args.p_telegram_user_id);
          h.sessions.set(userId, {
            ...(h.sessions.get(userId) ?? {}),
            ...((args.p_patch as Record<string, unknown> | undefined) ?? {}),
          });
          return { data: [{ applied: true, lease_valid: true }], error: null };
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
      h.runChecks.push(options);
      return actual.runCheck({
        ...(options as unknown as Parameters<typeof actual.runCheck>[0]),
        skipAi: true,
        skipUrlReputation: true,
        persist: false,
      });
    },
    analyzeImageCore: async () => null,
    transcribeVoiceCore: async () => ({ text: "" }),
  };
});

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
vi.mock("@/lib/telegram/family-shield.server", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/telegram/family-shield.server")>();
  const denyUnexpectedFamilyAction = async (): Promise<never> => {
    throw new Error("expanded people harness denied an unexpected family action");
  };
  return {
    // The callback router reads the pure action table before dispatching the
    // offered hang-up button. Keep that contract real; family effects remain
    // explicit mocks or fail closed, never accidentally reach their provider.
    FAMILY_CB: actual.FAMILY_CB,
    familyIdFromCallback: actual.familyIdFromCallback,
    parseFamilyCallback: actual.parseFamilyCallback,
    notifyTrustedContact: async () => ({ ok: false as const, reason: "not_linked" as const }),
    getFamilyShieldStatus: async () => ({ kind: "none" as const }),
    createFamilyInvite: denyUnexpectedFamilyAction,
    revokeFamilyShield: denyUnexpectedFamilyAction,
    revokeFamilyShieldForTrusted: denyUnexpectedFamilyAction,
    setFamilyAutoAlertsConsent: denyUnexpectedFamilyAction,
  };
});
vi.mock("@/lib/report.functions", () => ({
  submitReport: async () => ({ ok: true as const }),
  prepareReportIdentifier: async (value: string) => ({
    type: "text",
    hash: `synthetic:${value.length}`,
    display: "[synthetic text]",
    incidentOnly: false,
  }),
  prepareIncidentOnlyReportTarget: async (value: string) => ({
    type: "text",
    hash: `synthetic-incident:${value.length}`,
    display: "[synthetic incident]",
    incidentOnly: true,
  }),
  submitPreparedReportCore: async () => ({ ok: true as const }),
  reportRateLimitKeyForTelegram: (userId: number) => `synthetic:${userId}`,
}));

import type { Lang } from "@/lib/i18n";
import { evaluateText, type ReasonCode } from "@/lib/risk/rules";
import type { SensitiveSecretClass } from "@/lib/risk/sensitive-text";
import {
  ADVERSARIAL_HUMAN_EXPECTED_CASE_COUNT,
  ADVERSARIAL_HUMAN_SCENARIO_CORPUS,
  type AdversarialHumanScenario,
} from "@/lib/telegram/adversarial-human-scenario-corpus";
import { detectTelegramSensitiveSecret } from "@/lib/telegram/sensitive-secret-input";
import {
  classifyVictimIntent,
  type VictimIntentKind,
  type VictimScenario,
} from "@/lib/telegram/victim-intent";

type Mode = "direct" | "inline";
type Group = "documented" | "blind-spot" | "new-wave" | "secret-followup" | "benign";

interface PersonCase {
  id: string;
  group: Group;
  mode: Mode;
  lang: Lang;
  profileLang: Lang;
  query: string;
  topic: RegExp;
  safety?: RegExp;
  safetyTerms?: readonly string[];
  forbidden?: RegExp;
  secrets?: readonly string[];
  followup?: string;
  benign?: boolean;
  behaviorContract?: "independent-employer-verification";
  semanticFamily?: string;
  provenance?: "authored-phrase" | "generated-mutation";
}

const TOPIC: Readonly<Record<string, RegExp>> = Object.freeze({
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
    /(?:подж|заправ|опасн\p{L}*\s+(?:задан|действ|требован)|o['’]?t\s+qo['’]?y|yoqilg['’]?i|xavfli\s+topshiriq|(?:xavfli|noqonuniy).{0,40}(?:ish|topshiriq|harakat).{0,40}(?:majburl|buyur)|fire|burn|gas station|dangerous\s+(?:task|act|demand))/iu,
  "neighbor-video-malware":
    /(?=.*(?:видео|video))(?=.*(?:сосед|знаком|подъезд|камер|файл|apk|плеер|qo['’]?shni|tanish|kirish|kamera|fayl|ilova|player|neighbor|acquaint|contact|entrance|camera|file|viewer))/iu,
  "fake-fine-cashback-app":
    /(?=.*(?:штраф|jarima|fine))(?=.*(?:apk|прилож|ilova|app|файл|file|вред|zarar|malware))/iu,
  "penalty-points-cancellation":
    /(?:штрафн\p{L}*\s+балл|балл\p{L}*\s+(?:аннулир|спис|удал|обнул)|(?:аннулир|спис|удал|обнул).{0,60}(?:штрафн\p{L}*\s+)?балл|jarima\s+ball|ball\p{L}*\s+(?:bekor|o['’]?chir|nol)|penalty\s+point|points?\s+(?:delet|erase|cancel|remove))/iu,
  "known-contact-prize-link":
    /(?=.*(?:знаком|друг|аккаунт|tanish|do['’]?st|akkaunt|friend|contact|account))(?=.*(?:приз|подар|банк|sovg['’]?a|mukofot|bank|prize|gift))/iu,
});

interface DirectSemanticContract {
  intentKind?: VictimIntentKind;
  scenario?: VictimScenario;
  reasonAny?: readonly ReasonCode[];
  secretClass?: SensitiveSecretClass;
}

// Concrete deterministic signals behind each authored adversarial family.
// The visible-topic oracle remains required as well, so a generic cautious
// answer cannot pass merely because one low-level detector fired.
const DIRECT_SEMANTIC_CONTRACT: Readonly<Record<string, DirectSemanticContract>> = Object.freeze({
  "sms-code-request": { secretClass: "code" },
  "password-request": { secretClass: "password" },
  "recovery-phrase-request": { secretClass: "recovery_phrase" },
  "card-cvv-request": { reasonAny: ["asks_for_card_cvv"] },
  "passport-request": { intentKind: "personal_data_request" },
  "passport-already-shared": { scenario: "passport_already_shared" },
  "bank-impersonation": { reasonAny: ["impersonates_bank"] },
  "government-code-request": {
    reasonAny: ["oneid_government_phishing", "asks_for_sms_code"],
  },
  "police-impersonation": { scenario: "police_impersonation" },
  "sim-swap": { scenario: "sim_swap" },
  "remote-access": { scenario: "remote_access" },
  "apk-install": { intentKind: "file_received" },
  "vote-link": { scenario: "vote_link" },
  "fake-tax-payment": { scenario: "fake_tax_payment" },
  "safe-account-transfer": { reasonAny: ["asks_to_transfer_to_safe_account"] },
  "family-emergency": { intentKind: "friend_money" },
  "job-training-fee": { intentKind: "job_offer" },
  "earning-channel": { intentKind: "earning_channel" },
  "crypto-investment": { scenario: "investment_offer" },
  "romance-money": { scenario: "romance_money" },
  "photo-extortion": { scenario: "photo_extortion" },
  "parcel-fee": { scenario: "parcel_fee" },
  "marketplace-delivery": { scenario: "marketplace_delivery" },
  "loan-advance-fee": { scenario: "loan_advance_fee" },
  "charity-pressure": { scenario: "charity_pressure" },
  "qr-login": { scenario: "qr_login" },
  "telegram-channel-invite": { scenario: "telegram_channel_invite" },
  "unknown-stranger-request": { scenario: "unknown_stranger_request" },
  "fake-support": { scenario: "fake_support" },
  "bank-contact-from-message": { scenario: "bank_contact_from_message" },
  "authority-physical-coercion": {
    scenario: "authority_physical_coercion",
    reasonAny: ["authority_coerced_dangerous_act"],
  },
  "neighbor-video-malware": { scenario: "neighbor_video_malware" },
  "fake-fine-cashback-app": { scenario: "fake_fine_cashback_app" },
  "penalty-points-cancellation": {
    scenario: "penalty_points_cancellation",
    reasonAny: ["fake_penalty_points_erasure"],
  },
  "known-contact-prize-link": {
    scenario: "known_contact_prize_link",
    reasonAny: ["giveaway_engagement_bait"],
  },
});

const INLINE_SEMANTIC: Readonly<Record<string, string>> = Object.freeze({
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

const SAFETY: Readonly<Record<Lang, RegExp>> = Object.freeze({
  ru: /(?:не |нельзя|опас|риск|осторож|проверь|никому|заблок|позвон)/iu,
  uz: /(?:xavf|ehtiyot|tekshir|aytmang|yubormang|o['’]?tkazmang|ishonmang|to['’]?lamang|bermang|ochmang|kiritmang|o['’]?rnatmang|qilmang|blok)/iu,
  en: /(?:do not|don't|never|risk|careful|verify|check|suspicious|avoid|stop|contact|block)/iu,
});

const PROFILE_MISMATCH: Readonly<Record<Lang, Lang>> = Object.freeze({
  ru: "uz",
  uz: "en",
  en: "ru",
});

function documentedCases(): PersonCase[] {
  if (ADVERSARIAL_HUMAN_SCENARIO_CORPUS.length !== ADVERSARIAL_HUMAN_EXPECTED_CASE_COUNT) {
    throw new Error(
      `expected ${ADVERSARIAL_HUMAN_EXPECTED_CASE_COUNT} documented rows, got ${ADVERSARIAL_HUMAN_SCENARIO_CORPUS.length}`,
    );
  }
  return ADVERSARIAL_HUMAN_SCENARIO_CORPUS.map(
    (row: AdversarialHumanScenario, index): PersonCase => ({
      id: `documented-${row.id}`,
      group: "documented",
      mode: index % 2 === 0 ? "direct" : "inline",
      lang: row.lang,
      profileLang: PROFILE_MISMATCH[row.lang],
      query: row.query,
      topic: TOPIC[row.family],
      safetyTerms: row.expectedSafetyTerms,
      secrets: row.secrets,
      semanticFamily: row.family,
      provenance: row.mutation === "plain" ? "authored-phrase" : "generated-mutation",
    }),
  );
}

const BLIND_SPOTS: PersonCase[] = [
  {
    id: "blind-ru-rental-deposit",
    group: "blind-spot",
    mode: "direct",
    lang: "ru",
    profileLang: "uz",
    query: "На OLX просят внести депозит на карту, чтобы забронировать просмотр квартиры",
    topic: /(?:olx|аренд|квартир|депозит|брон|просмотр)/iu,
    safety: SAFETY.ru,
  },
  {
    id: "blind-ru-installment-otp",
    group: "blind-spot",
    mode: "inline",
    lang: "ru",
    profileLang: "uz",
    query: "В магазине оформляю рассрочку на телефон, продавец просит SMS-код для подтверждения",
    topic: /(?:рассроч|магазин|sms|код)/iu,
    safety: SAFETY.ru,
    forbidden: /(?:водоканал|suvsoz|water utility)/iu,
  },
  {
    id: "blind-ru-taxi-card",
    group: "blind-spot",
    mode: "direct",
    lang: "ru",
    profileLang: "uz",
    query: "Таксист говорит, что терминал сломан, и просит перевести оплату на личную карту",
    topic: /(?:такси|водител|терминал|личн|перевод|карт)/iu,
    safety: SAFETY.ru,
  },
  {
    id: "blind-ru-vote-fee",
    group: "blind-spot",
    mode: "inline",
    lang: "ru",
    profileLang: "uz",
    query: "Просят голосовать за ребёнка по ссылке, а потом оплатить организационный взнос",
    topic: /(?:голос|ссыл|взнос|конкурс)/iu,
    safety: SAFETY.ru,
  },
  {
    id: "blind-uz-customs-duty",
    group: "blind-spot",
    mode: "direct",
    lang: "uz",
    profileLang: "en",
    query:
      "Posilka bojxonada to'xtabdi, uni olish uchun shaxsiy kartaga boj to'lashimni aytishyapti",
    topic: /(?:posilka|bojxona|boj|karta|to['’]?lov)/iu,
    safety: SAFETY.uz,
    forbidden: /(?:telegramda|@username|\bapk\b|«kuryer»|yuborilgan\s+havola)/iu,
  },
  {
    id: "blind-uz-game-escrow",
    group: "blind-spot",
    mode: "inline",
    lang: "uz",
    profileLang: "en",
    query: "O'yindagi akkauntimni sotib olmoqchi, vositachiga oldindan komissiya yuboring deyapti",
    topic: /(?:o['’]?yin|akkaunt|vositachi|komissiya)/iu,
    safety: SAFETY.uz,
  },
  {
    id: "blind-uz-recovery-lawyer",
    group: "blind-spot",
    mode: "direct",
    lang: "uz",
    profileLang: "en",
    query:
      "Oldin firibgarga pul yo'qotdim, endi yurist pulni qaytarish uchun oldindan haq so'rayapti",
    topic: /(?:yurist|qaytar|oldindan|firib|pul)/iu,
    safety: SAFETY.uz,
    forbidden: /(?:pul\s+[«"]?xato|boshqa\s+hisob|jarima|tahdid\s+matni|xavfsiz\s+hisob)/iu,
  },
  {
    id: "blind-uz-fake-antiscam",
    group: "blind-spot",
    mode: "inline",
    lang: "uz",
    profileLang: "en",
    query: "Firibgarlikdan himoya boti deb yozib, xavfsizlik tekshiruvi uchun SMS kodni so'rayapti",
    topic: /(?:himoya|xavfsiz|bot|sms|kod)/iu,
    safety: SAFETY.uz,
  },
  {
    id: "blind-en-deepfake-boss",
    group: "blind-spot",
    mode: "direct",
    lang: "en",
    profileLang: "ru",
    query:
      "My boss looked strange on a video call and ordered an urgent transfer to a partner account",
    topic: /(?:boss|employer|video|identity|transfer|partner)/iu,
    safety: SAFETY.en,
    behaviorContract: "independent-employer-verification",
  },
  {
    id: "blind-en-video-passport",
    group: "blind-spot",
    mode: "inline",
    lang: "en",
    profileLang: "ru",
    query: "During a remote job interview they ask me to hold my passport up to the camera",
    topic: /(?:job|interview|passport|document|camera)/iu,
    safety: SAFETY.en,
  },
  {
    id: "blind-en-romance-investment",
    group: "blind-spot",
    mode: "direct",
    lang: "en",
    profileLang: "ru",
    query:
      "Someone I met on a dating app built trust for weeks and now wants me to invest in crypto",
    topic: /(?:dating|relationship|trust|invest|crypto|romance)/iu,
    safety: SAFETY.en,
  },
  {
    id: "blind-en-task-scam",
    group: "blind-spot",
    mode: "inline",
    lang: "en",
    profileLang: "ru",
    query: "A task platform shows earnings but requires a deposit to unlock my withdrawal",
    topic: /(?:task|earning|deposit|withdraw|job)/iu,
    safety: SAFETY.en,
  },
];

// These cases deliberately use conversational wording that is different from
// the generated corpus seeds. They encode the current real-world scam wave and
// one neutral banking-support request that must not be turned into a scam alert.
const NEW_SCAM_WAVE: PersonCase[] = [
  {
    id: "new-ru-mistaken-outgoing-transfer",
    group: "new-wave",
    mode: "direct",
    lang: "ru",
    profileLang: "uz",
    query: "Я по ошибке перевела деньги не тому человеку на карту. Как отменить перевод?",
    topic:
      /(?:ошибочн\w*\s+перевод|не\s+тому\s+получател|ошиб(?:ся|лась|лись)\s+получател\p{L}*|отозв|оспор|возврат\w*\s+перевод)/iu,
    safety: SAFETY.ru,
    forbidden: /(?:это|точно)\s+(?:мошеннич|обман)/iu,
    benign: true,
  },
  {
    id: "new-ru-authority-dangerous-act",
    group: "new-wave",
    mode: "inline",
    lang: "ru",
    profileLang: "uz",
    query:
      "Мне 15. В мессенджере человек из налоговой угрожает уголовным делом и велит поджечь заправку. Что делать?",
    topic: /(?:подж|заправ|опасн\w*\s+(?:задан|действ)|уголовн\w*\s+угроз|102)/iu,
    safety: SAFETY.ru,
  },
  {
    id: "new-ru-neighbor-camera-video",
    group: "new-wave",
    mode: "direct",
    lang: "ru",
    profileLang: "uz",
    query:
      "Сосед пишет: «глянь видео с камеры у подъезда» — прислал странный файл и отдельный просмотрщик",
    topic: /(?:сосед|подъезд|камер\w*\s+видео|видео\w*\s+(?:от\s+сосед|с\s+камер)|просмотрщик)/iu,
    safety: SAFETY.ru,
  },
  {
    id: "new-ru-road24-fine-apk",
    group: "new-wave",
    mode: "inline",
    lang: "ru",
    profileLang: "uz",
    query:
      "Прислали ROAD24.apk: обещают 100% кешбэк при оплате штрафа, просят установить файл не из магазина",
    topic: /(?=.*(?:штраф|дорожн))(?=.*(?:apk|прилож|файл|вредонос))/iu,
    safety: SAFETY.ru,
  },
  {
    id: "new-ru-paid-penalty-points-erasure",
    group: "new-wave",
    mode: "direct",
    lang: "ru",
    profileLang: "uz",
    query:
      "Посредник в Telegram предлагает за 800 тысяч сумов обнулить штрафные баллы и просит перевод на личную карту",
    topic:
      /(?:штрафн\p{L}*\s+балл|балл\p{L}*\s+(?:обнул|удал|аннулир|спис)|(?:обнул|удал|аннулир|спис).{0,60}(?:штрафн\p{L}*\s+)?балл)/iu,
    safety: SAFETY.ru,
  },
  {
    id: "new-ru-friend-bank-gift",
    group: "new-wave",
    mode: "inline",
    lang: "ru",
    profileLang: "uz",
    query:
      "Знакомый прислал ссылку на подарок 70 000 сумов от банка: «я уже получил, забирай тоже»",
    topic: /(?=.*(?:знаком|друг|аккаунт))(?=.*(?:подар|приз|банк|взлом|скомпрометир))/iu,
    safety: SAFETY.ru,
  },
  {
    id: "new-uz-mistaken-outgoing-transfer",
    group: "new-wave",
    mode: "inline",
    lang: "uz",
    profileLang: "en",
    query:
      "Pulni adashib boshqa odamning kartasiga o'tkazib yubordim. O'tkazmani bekor qilsam bo'ladimi?",
    topic:
      /(?:xato\s+(?:o['’]?tkazma|odam|oluv|hisob|karta)|adashib\s+(?:boshqa|noto['’]?g['’]?ri)|o['’]?tkazma\p{L}*\s+(?:bekor|qaytar)|bank\p{L}*\s+murojaat)/iu,
    safety: SAFETY.uz,
    forbidden: /(?:bu|aniq)\s+firibgar/iu,
    benign: true,
  },
  {
    id: "new-uz-authority-dangerous-act",
    group: "new-wave",
    mode: "direct",
    lang: "uz",
    profileLang: "en",
    query:
      "Men 15 yoshdaman. Soliqdanman degan odam qamash bilan qo'rqitib, benzin shoxobchasiga o't qo'yishni buyuryapti",
    topic: /(?:o['’]?t\s+qo['’]?y|benzin|yoqilg['’]?i|xavfli\s+(?:topshiriq|harakat)|102)/iu,
    safety: SAFETY.uz,
  },
  {
    id: "new-uz-neighbor-camera-video",
    group: "new-wave",
    mode: "inline",
    lang: "uz",
    profileLang: "en",
    query:
      "Qo'shnim «kirish kamerasi videosini ko'r» deb noma'lum fayl va uni ochadigan ilova yubordi",
    topic: TOPIC["neighbor-video-malware"],
    safety: SAFETY.uz,
  },
  {
    id: "new-uz-road24-fine-apk",
    group: "new-wave",
    mode: "direct",
    lang: "uz",
    profileLang: "en",
    query:
      "Jarimani 100% keshbek bilan to'lash uchun ROAD24 APKni Telegramdan o'rnatishimni aytishyapti",
    topic: /(?=.*(?:jarima|yo['’]?l))(?=.*(?:apk|ilova|fayl|zararli))/iu,
    safety: SAFETY.uz,
  },
  {
    id: "new-uz-paid-penalty-points-erasure",
    group: "new-wave",
    mode: "inline",
    lang: "uz",
    profileLang: "en",
    query:
      "Telegramdagi vositachi 800 ming so'mga jarima ballarimni nol qilib, shaxsiy kartasiga pul o'tkazishni so'radi",
    topic: /(?:jarima\s+ball|ball\w*\s+(?:nol|o['’]?chir|bekor))/iu,
    safety: SAFETY.uz,
  },
  {
    id: "new-uz-friend-bank-gift",
    group: "new-wave",
    mode: "direct",
    lang: "uz",
    profileLang: "en",
    query:
      "Tanishim bankdan 70 ming so'm sovg'a havolasini yuborib, «men oldim, sen ham ol» deb yozdi",
    topic:
      /(?=.*(?:tanish|do['’]?st|akkaunt))(?=.*(?:sovg['’]?a|mukofot|bank|buzil|o['’]?g['’]?irla))/iu,
    safety: SAFETY.uz,
  },
  {
    id: "new-en-mistaken-outgoing-transfer",
    group: "new-wave",
    mode: "direct",
    lang: "en",
    profileLang: "ru",
    query:
      "I accidentally sent money to the wrong recipient. How can I cancel or reverse the transfer?",
    topic:
      /(?:wrong\s+(?:person|recipient|account)|(?:recall|reverse|cancel|dispute)\w*(?:\s+the)?\s+transfer)/iu,
    safety: SAFETY.en,
    forbidden: /(?:this is|definitely)\s+(?:a\s+)?scam/iu,
    benign: true,
  },
  {
    id: "new-en-authority-dangerous-act",
    group: "new-wave",
    mode: "inline",
    lang: "en",
    profileLang: "ru",
    query:
      "I am 15. Someone claiming to be from the tax office threatens charges and orders me to set fire to a gas station",
    topic: /(?:set\s+fire|burn|gas\s+station|dangerous\s+(?:task|act)|criminal\s+threat|police)/iu,
    safety: SAFETY.en,
  },
  {
    id: "new-en-neighbor-camera-video",
    group: "new-wave",
    mode: "direct",
    lang: "en",
    profileLang: "ru",
    query:
      "A neighbor says this is video from our entrance camera, but sent an odd file and a separate viewer to install",
    topic: /(?:neighbor|entrance\s+camera|camera\s+video|doorbell|viewer)/iu,
    safety: SAFETY.en,
  },
  {
    id: "new-en-road24-fine-apk",
    group: "new-wave",
    mode: "inline",
    lang: "en",
    profileLang: "ru",
    query:
      "They sent ROAD24.apk outside the app store and promise 100% cashback when I pay a traffic fine",
    topic: /(?=.*(?:fine|traffic))(?=.*(?:apk|app|file|malware|malicious))/iu,
    safety: SAFETY.en,
  },
  {
    id: "new-en-paid-penalty-points-erasure",
    group: "new-wave",
    mode: "direct",
    lang: "en",
    profileLang: "ru",
    query:
      "A Telegram fixer offers to erase my penalty points for cash and wants payment to a personal card",
    topic: /(?:penalty\s+point|points?\s+(?:erase|delete|cancel|remove))/iu,
    safety: SAFETY.en,
  },
  {
    id: "new-en-friend-bank-gift",
    group: "new-wave",
    mode: "inline",
    lang: "en",
    profileLang: "ru",
    query:
      "A friend sent a bank link for a 70,000 cash gift and says: ‘I claimed it, you should too’",
    topic: /(?=.*(?:friend|contact|account))(?=.*(?:gift|prize|bank|hacked|compromised))/iu,
    safety: SAFETY.en,
  },
];

const SECRET_FOLLOWUPS: PersonCase[] = [
  {
    id: "secret-ru-otp",
    group: "secret-followup",
    mode: "direct",
    lang: "ru",
    profileLang: "uz",
    query: "Сотрудник просит продиктовать одноразовый SMS-код 481927",
    topic: TOPIC["sms-code-request"],
    safety: SAFETY.ru,
    secrets: ["481927"],
    followup: "Почему это опасно и что делать дальше?",
  },
  {
    id: "secret-ru-password",
    group: "secret-followup",
    mode: "direct",
    lang: "ru",
    profileLang: "uz",
    query: "Поддержка просит мой пароль Vesna2026!X",
    topic: TOPIC["password-request"],
    safety: SAFETY.ru,
    secrets: ["Vesna2026!X"],
    followup: "Почему им нельзя доверять?",
  },
  {
    id: "secret-ru-seed",
    group: "secret-followup",
    mode: "direct",
    lang: "ru",
    profileLang: "uz",
    query:
      "Для возврата крипты требуют seed phrase river apple stone cloud eagle mint ocean book lamp train gold moon",
    topic: TOPIC["recovery-phrase-request"],
    safety: SAFETY.ru,
    secrets: ["river apple stone cloud eagle mint ocean book lamp train gold moon"],
    followup: "Что мне теперь делать?",
  },
  {
    id: "secret-uz-otp",
    group: "secret-followup",
    mode: "direct",
    lang: "uz",
    profileLang: "en",
    query: "Xodim mendan SMS kod 592814 ni aytishni so'rayapti",
    topic: TOPIC["sms-code-request"],
    safety: SAFETY.uz,
    secrets: ["592814"],
    followup: "Nega bu xavfli va keyin nima qilay?",
  },
  {
    id: "secret-uz-password",
    group: "secret-followup",
    mode: "direct",
    lang: "uz",
    profileLang: "en",
    query: "Yordam xizmati parolim Bahor2026!Z ni yuborishni so'radi",
    topic: TOPIC["password-request"],
    safety: SAFETY.uz,
    secrets: ["Bahor2026!Z"],
    followup: "Nega ularga ishonmasligim kerak?",
  },
  {
    id: "secret-uz-seed",
    group: "secret-followup",
    mode: "direct",
    lang: "uz",
    profileLang: "en",
    query:
      "Kripto yordamchisi seed phrase river apple stone cloud eagle mint ocean book lamp train gold moon ni so'radi",
    topic: TOPIC["recovery-phrase-request"],
    safety: SAFETY.uz,
    secrets: ["river apple stone cloud eagle mint ocean book lamp train gold moon"],
    followup: "Endi nima qilishim kerak?",
  },
  {
    id: "secret-en-otp",
    group: "secret-followup",
    mode: "direct",
    lang: "en",
    profileLang: "ru",
    query: "A caller asks me to read one-time SMS code 735190",
    topic: TOPIC["sms-code-request"],
    safety: SAFETY.en,
    secrets: ["735190"],
    followup: "Why is that dangerous and what should I do next?",
  },
  {
    id: "secret-en-password",
    group: "secret-followup",
    mode: "direct",
    lang: "en",
    profileLang: "ru",
    query: "Support asks me to send password Summer2026!Q",
    topic: TOPIC["password-request"],
    safety: SAFETY.en,
    secrets: ["Summer2026!Q"],
    followup: "Why should I not trust them?",
  },
  {
    id: "secret-en-seed",
    group: "secret-followup",
    mode: "direct",
    lang: "en",
    profileLang: "ru",
    query:
      "A recovery agent asks for seed phrase river apple stone cloud eagle mint ocean book lamp train gold moon",
    topic: TOPIC["recovery-phrase-request"],
    safety: SAFETY.en,
    secrets: ["river apple stone cloud eagle mint ocean book lamp train gold moon"],
    followup: "What should I do now?",
  },
];

const BENIGN: PersonCase[] = [
  {
    id: "benign-ru-greeting-mismatch",
    group: "benign",
    mode: "direct",
    lang: "ru",
    profileLang: "uz",
    query: "Привет",
    topic: /(?:привет|здравств|помог|провер|данн|пришлите|текст)/iu,
    benign: true,
  },
  {
    id: "benign-uz-greeting-mismatch",
    group: "benign",
    mode: "direct",
    lang: "uz",
    profileLang: "en",
    query: "Salom",
    topic: /(?:salom|yordam|tekshir|yubor|ma['’]?lumot|matn)/iu,
    benign: true,
  },
  {
    id: "benign-en-greeting-mismatch",
    group: "benign",
    mode: "direct",
    lang: "en",
    profileLang: "ru",
    query: "Hello",
    topic: /(?:hello|help|check|send|information|text)/iu,
    benign: true,
  },
  {
    id: "benign-ru-family-plan",
    group: "benign",
    mode: "inline",
    lang: "ru",
    profileLang: "uz",
    query: "Завтра встречаюсь с дочерью в кафе в пять часов",
    topic: /(?:контекст|данн|провер|сообщен|текст)/iu,
    benign: true,
  },
  {
    id: "benign-ru-store-receipt",
    group: "benign",
    mode: "inline",
    lang: "ru",
    profileLang: "uz",
    query: "Купил хлеб в магазине и получил обычный бумажный чек",
    topic: /(?:контекст|данн|провер|сообщен|текст)/iu,
    benign: true,
  },
  {
    id: "benign-uz-family-plan",
    group: "benign",
    mode: "inline",
    lang: "uz",
    profileLang: "en",
    query: "Ertaga qizim bilan kafeda soat beshda uchrashaman",
    topic: /(?:kontekst|ma['’]?lumot|tekshir|xabar|matn)/iu,
    benign: true,
  },
  {
    id: "benign-uz-home-help",
    group: "benign",
    mode: "inline",
    lang: "uz",
    profileLang: "en",
    query: "Onam uyda choy damlashga yordam berishimni so'radi",
    topic: /(?:kontekst|ma['’]?lumot|tekshir|xabar|matn)/iu,
    benign: true,
  },
  {
    id: "benign-en-family-plan",
    group: "benign",
    mode: "inline",
    lang: "en",
    profileLang: "ru",
    query: "I am meeting my daughter at the cafe tomorrow at five",
    topic: /(?:context|information|check|message|text)/iu,
    benign: true,
  },
  {
    id: "benign-en-bank-hours",
    group: "benign",
    mode: "inline",
    lang: "en",
    profileLang: "ru",
    query: "The official bank branch opens at nine and I will visit it in person",
    topic: /(?:context|information|check|message|official|text)/iu,
    benign: true,
  },
];

const PEOPLE: PersonCase[] = [
  ...documentedCases(),
  ...BLIND_SPOTS,
  ...NEW_SCAM_WAVE,
  ...SECRET_FOLLOWUPS,
  ...BENIGN,
];
const EXPECTED_SURFACE_CASE_COUNT = ADVERSARIAL_HUMAN_EXPECTED_CASE_COUNT + 48;
const EXPECTED_AUTHORED_PHRASE_COUNT = 35 * 3 + 48;
const EXPECTED_GENERATED_MUTATION_COUNT = 35 * 3 * 11;

// Additional audit, not 5,244 independent human-authored threats or load users.
// Reuse strict family/topic/safety oracles; every generated session has its own
// user id. Message style, language/profile mismatch and surface vary; I/O stays
// deny-closed. Failures are reported, never converted into expected success.
function auditStyle(query: string, lang: Lang, index: number): string {
  const prefixes: Record<Lang, readonly string[]> = {
    ru: [
      "",
      "Мне пишут такое: ",
      "Подскажите пожалуйста. ",
      "Вот что прислали мне — ",
      "Посмотри: ",
      "Не понимаю, что делать. ",
    ],
    uz: [
      "",
      "Menga shunday yozishdi: ",
      "Iltimos maslahat bering. ",
      "Mana yuborgan xabari — ",
      "Shuni tekshirib bering: ",
      "Nima qilishni bilmay qoldim. ",
    ],
    en: [
      "",
      "They sent me this: ",
      "Please help me understand. ",
      "Here is what they wrote — ",
      "Can you check this: ",
      "I do not know what to do. ",
    ],
  };
  if (index === 0) return query;
  if (index === 1) return query.toLocaleLowerCase(lang === "ru" ? "ru" : "en");
  if (index === 2) return query.replace(/ /gu, "  ");
  if (index === 3) return `\n${query}\n`;
  if (index === 4) return query.replace(/ /u, "\n");
  if (index === 5) return query.replace(/['’‘]/gu, "ʻ");
  const prefix = prefixes[lang][1 + ((index - 6) % 5)];
  const decoration = index < 11 ? "" : index < 16 ? "\n" : " … ";
  const body = index < 16 ? query : query.toLocaleLowerCase(lang === "ru" ? "ru" : "en");
  return `${prefix}${decoration}${body}${index === 21 ? " ?" : ""}`;
}

function buildLargeAudit(): PersonCase[] {
  const authored = PEOPLE.filter((person) => provenanceOf(person) === "authored-phrase");
  return authored.flatMap((person) => {
    const modes: Mode[] = person.group === "documented" ? ["direct", "inline"] : [person.mode];
    const styles = person.group === "documented" ? 22 : 13;
    return modes.flatMap((mode) =>
      Array.from({ length: styles }, (_, style) => ({
        ...person,
        id: `audit-${person.id}-${mode}-${style}`,
        mode,
        query: auditStyle(person.query, person.lang, style),
        provenance: style === 0 ? ("authored-phrase" as const) : ("generated-mutation" as const),
      })),
    );
  });
}

function provenanceOf(person: PersonCase): NonNullable<PersonCase["provenance"]> {
  return person.provenance ?? "authored-phrase";
}

interface ReplyLikeConversation {
  id: string;
  lang: Lang;
  profileLang: Lang;
  initial: string;
  followup: string;
  topic: RegExp;
  safety: RegExp;
  secrets?: readonly string[];
}

const REPLY_LIKE_CONVERSATIONS: readonly ReplyLikeConversation[] = [
  {
    id: "reply-secret-ru-password",
    lang: "ru",
    profileLang: "uz",
    initial: "Поддержка просит: Пароль🟠Vesna2026!X",
    followup: "Почему это опасно?",
    topic: /(?:парол|уч[её]тн\p{L}*\s+запис|доступ)/iu,
    safety: /(?:не\s+сообщ|смените|официальн|завершите\s+.*сесс)/iu,
    secrets: ["Vesna2026!X"],
  },
  {
    id: "reply-secret-uz-code",
    lang: "uz",
    profileLang: "en",
    initial: "Bank xodimi SMS kodi 👉 592814 ni aytishimni so'rayapti",
    followup: "Nega bu xavfli?",
    topic: /(?:sms[- ]?kod|otp|pin|akkaunt|operatsiya)/iu,
    safety: /(?:aytmang|rasmiy|tekshiring|murojaat)/iu,
    secrets: ["592814"],
  },
  {
    id: "reply-context-uzc-authority",
    lang: "uz",
    profileLang: "en",
    initial: "ИИБданман деган одам жиноий иш билан қўрқитиб, камера кабелини узишимни буюряпти",
    followup: "Уларга нима деб жавоб берай?",
    topic: /(?:талаб|алоқа|102|xavfli|talab|aloqa)/iu,
    safety: /(?:бажармайман|тугат|қўнғироқ|bajarmayman|tugat|qo['’]?ng['’]?iroq)/iu,
  },
  {
    id: "reply-context-en-neighbor-file",
    lang: "en",
    profileLang: "ru",
    initial:
      "A neighbor sent a separate viewer for a building-camera video and insists I install it now",
    followup: "What should I do next?",
    topic: /(?:neighbor|camera|viewer|file|app|attachment|device)/iu,
    safety: /(?:do not|don['’]?t|verify|call|remove|block|official)/iu,
  },
];

function unescapeMarkdown(value: string): string {
  return value.replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/gu, "$1");
}

function normalize(value: string): string {
  return unescapeMarkdown(value)
    .normalize("NFKC")
    .replace(/[\u200b-\u200f\u2060\ufeff]/gu, "")
    .toLocaleLowerCase("ru")
    .replace(/\s+/gu, " ")
    .trim();
}

function assertNoSecret(value: string, secrets: readonly string[]): void {
  const normalized = normalize(value);
  for (const secret of secrets) {
    if (normalized.includes(normalize(secret))) throw new Error("synthetic secret was echoed");
  }
}

function assertNoStructuredSecret(value: unknown, secrets: readonly string[]): void {
  if (typeof value === "string") {
    assertNoSecret(value, secrets);
  } else if (typeof value === "number") {
    // A short CVV can occur inside an unrelated timestamp/user id. Still
    // reject a numeric field equal to the secret, and scan all text verbatim.
    if (secrets.some((secret) => String(value) === normalize(secret))) {
      throw new Error("synthetic numeric secret was persisted");
    }
  } else if (Array.isArray(value)) {
    for (const item of value) assertNoStructuredSecret(item, secrets);
  } else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      assertNoSecret(key, secrets);
      assertNoStructuredSecret(item, secrets);
    }
  }
}

function hasSafetyTerm(value: string, terms: readonly string[]): boolean {
  const visible = normalize(value);
  return terms.some((term) => visible.includes(normalize(term)));
}

function isHighRisk(value: string, articleId = ""): boolean {
  return /(?:high[_ -]?risk|высок\p{L}*\s+риск|yuqori\s+xavf|🔴)/iu.test(`${articleId}\n${value}`);
}

// Authored response-language evidence, independent of the runtime language
// detector. A Russian request for more context is still Russian even if it
// contains none of the old greeting-only words. Require multiple distinct
// markers and dominance over other languages; a lone quoted greeting cannot
// make an otherwise English answer pass as Uzbek.
const REPLY_LANGUAGE_MARKERS: Readonly<Record<Lang, readonly RegExp[]>> = {
  ru: [
    /(?:привет|здравств)/iu,
    /(?:помо[гщ]|провер)/iu,
    /(?:данн|оценк)/iu,
    /(?:пришл|отправ)/iu,
    /(?:сообщен|переписк)/iu,
    /(?:ссылк|номер|текст)/iu,
    /(?:нужно|нужен|можно|делать)/iu,
  ],
  uz: [
    /\bsalom\b/iu,
    /\b(?:yordam|tekshir)\p{L}*/iu,
    /\bma['’ʻ]?lumot\b/iu,
    /\b(?:yubor|qo['’ʻ]?sh)\p{L}*/iu,
    /\b(?:xabar|matn|havola|raqam)\p{L}*/iu,
    /\b(?:kerak|qadam|aytaman|baholash)\b/iu,
    /\b(?:qiling|qilmang|nima|aniq|xavfsiz)\b/iu,
    /\b(?:murojaat|rasmiy|mumkinligini|so['’ʻ]?rang)\b/iu,
    /\b(?:bankingiz|bankka|o['’ʻ]?tkazma\p{L}*|qaytarib)\b/iu,
  ],
  en: [
    /\bhello\b/iu,
    /\b(?:help|check|verify)\b/iu,
    /\b(?:data|information|assessment)\b/iu,
    /\b(?:send|add)\b/iu,
    /\b(?:message|text|link|number)\b/iu,
    /\b(?:need|can|will|what)\b/iu,
    /\b(?:safe|step|please|enough)\b/iu,
  ],
};

function hasReplyLanguage(value: string, lang: Lang): boolean {
  const text = normalize(value);
  const counts = Object.fromEntries(
    (Object.keys(REPLY_LANGUAGE_MARKERS) as Lang[]).map((candidate) => [
      candidate,
      REPLY_LANGUAGE_MARKERS[candidate].filter((marker) => marker.test(text)).length,
    ]),
  ) as Record<Lang, number>;
  return (
    counts[lang] >= 2 &&
    (Object.keys(counts) as Lang[]).every(
      (candidate) => candidate === lang || counts[lang] > counts[candidate],
    )
  );
}

// An authority-impersonation route is an acceptable tax-payment explanation
// only when it protects the actual payment action and verifies independently.
// Recognizing an authority token or emitting generic caution is insufficient.
function hasProtectiveTaxAdvice(value: string, lang: Lang): boolean {
  const text = normalize(value);
  const requirements: Record<Lang, readonly RegExp[]> = {
    ru: [
      /налог/iu,
      /не\s+(?:платите|оплачивайте|переводите).{0,65}(?:ссылк|деньг)|(?:ссылк).{0,40}не\s+(?:платите|оплачивайте)/iu,
      /(?:официальн|официал).{0,65}(?:номер|канал|сайт)|(?:номер|канал|сайт).{0,40}официал/iu,
      /(?:проверьте|проверяйте|перезвоните|позвоните)/iu,
    ],
    uz: [
      /\bsoliq\b/iu,
      /\bhavola.{0,40}to['’ʻ]?lamang\b/iu,
      /\brasmiy\s+(?:raqam|kanal|sayt)\b/iu,
      /\b(?:tekshiring|qo['’ʻ]?ng['’ʻ]?iroq\s+qiling)\b/iu,
    ],
    en: [
      /\btax\b/iu,
      /\b(?:do not|don't|never)\s+pay.{0,65}\blink\b/iu,
      /\b(?:official|independently verified)\s+(?:number|channel|website)\b/iu,
      /\b(?:verify|check|call)\b/iu,
    ],
  };
  return requirements[lang].every((requirement) => requirement.test(text));
}

function hasIndependentEmployerVerification(value: string): boolean {
  const text = normalize(value);
  return (
    /\b(?:boss|employer|organization|company|identity)\b/iu.test(text) &&
    text
      .split(/[.!?\n]/u)
      .some(
        (sentence) =>
          /\b(?:call|contact|verify|confirm)\b.{0,110}\b(?:official|known|independent|trusted)\b/iu.test(
            sentence,
          ) &&
          !/\b(?:do not|don't|never|no need to)\s+(?:call|contact|verify|confirm)\b/iu.test(
            sentence,
          ),
      )
  );
}

function assertDocumentedDirectSemanticContract(person: PersonCase, captured: Captured): void {
  if (!person.semanticFamily || person.mode !== "direct") return;
  const contract = DIRECT_SEMANTIC_CONTRACT[person.semanticFamily];
  if (!contract) throw new Error(`missing Direct semantic contract: ${person.semanticFamily}`);

  const match = classifyVictimIntent(person.query);
  const reasons = evaluateText(person.query);
  const secret = detectTelegramSensitiveSecret(person.query);

  const exactSignals: boolean[] = [];
  const expected: string[] = [];
  if (contract.intentKind) {
    expected.push(`intent:${contract.intentKind}`);
    exactSignals.push(match?.kind === contract.intentKind);
  }
  if (contract.scenario) {
    expected.push(`scenario:${contract.scenario}`);
    exactSignals.push(
      match?.scenario === contract.scenario ||
        (person.semanticFamily === "fake-tax-payment" &&
          match?.kind === "authority_impersonation" &&
          hasProtectiveTaxAdvice(captured.topicVisible, person.lang)),
    );
  }
  if (contract.reasonAny) {
    expected.push(`reasons:${contract.reasonAny.join("|")}`);
    exactSignals.push(
      contract.reasonAny.some((expectedReason) => reasons.includes(expectedReason)),
    );
  }
  if (contract.secretClass) {
    expected.push(`secret:${contract.secretClass}`);
    exactSignals.push(secret?.classes.includes(contract.secretClass) ?? false);
  }
  if (exactSignals.length === 0 || !exactSignals.some(Boolean)) {
    throw new Error(
      `Direct semantic mismatch: expected one of ${expected.join(",")}; actual=intent:${match?.kind ?? "none"},scenario:${match?.scenario ?? "none"},reasons:${reasons.join("|") || "none"},secret:${secret?.classes.join("|") || "none"}`,
    );
  }
}

function assertDocumentedInlineSemanticContract(person: PersonCase, articleId: string): void {
  if (!person.semanticFamily || person.mode !== "inline") return;
  const semantic = INLINE_SEMANTIC[person.semanticFamily];
  if (!semantic) throw new Error(`missing Inline semantic contract: ${person.semanticFamily}`);
  const prefix = semantic.startsWith("private-")
    ? semantic
    : `check-(?:unknown|suspicious|high_risk)-${semantic}`;
  if (!new RegExp(`^${prefix}-[A-Za-z0-9_-]{16}$`, "u").test(articleId)) {
    throw new Error(
      `Inline semantic mismatch: expected=${semantic}; actual=${articleId || "none"}`,
    );
  }
}

interface CapturedSegment {
  visible: string;
  topicVisible: string;
  messages: number;
}

interface Captured extends CapturedSegment {
  articleId: string;
  followup?: CapturedSegment;
  liveCallContinuation?: CapturedSegment;
}

let handleTelegramWebhook!: (request: Request) => Promise<Response>;
let resetDedupe!: () => void;
let resetQueues!: () => void;
let updateId = 12_000_000;
let fetchBeforeSuite: typeof globalThis.fetch | undefined;
let fetchGuardInstalled = false;

function installDenyClosedFetchGuard(): void {
  fetchBeforeSuite = globalThis.fetch;
  globalThis.fetch = (async () => {
    h.externalFetchAttempts += 1;
    throw new Error("expanded people harness denied an external network call");
  }) as typeof fetch;
  fetchGuardInstalled = true;
}

function restoreFetchAfterSuite(): void {
  if (!fetchGuardInstalled) return;
  if (fetchBeforeSuite === undefined) delete (globalThis as { fetch?: typeof fetch }).fetch;
  else globalThis.fetch = fetchBeforeSuite;
  fetchBeforeSuite = undefined;
  fetchGuardInstalled = false;
}

function withoutExactQueryEcho(value: string, queries: readonly string[]): string {
  let visible = normalize(value);
  for (const query of queries) {
    const normalizedQuery = normalize(query);
    if (normalizedQuery) visible = visible.replaceAll(normalizedQuery, " ");
  }
  return visible.replace(/\s+/gu, " ").trim();
}

async function postUpdate(body: Record<string, unknown>): Promise<void> {
  const response = await handleTelegramWebhook(
    new Request("https://expanded-people.invalid/api/telegram/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "test-telegram-webhook-secret",
      },
      body: JSON.stringify({ update_id: (updateId += 1), ...body }),
    }),
  );
  if (response.status !== 200) throw new Error(`webhook status ${response.status}`);
}

async function runDirect(person: PersonCase, userId: number): Promise<Captured> {
  const start = h.sent.length;
  await postUpdate({
    message: {
      message_id: updateId,
      date: 1_790_000_000,
      text: person.query,
      chat: { id: userId, type: "private" },
      from: { id: userId, language_code: person.profileLang, first_name: "Synthetic" },
    },
  });
  const messages = h.sent.slice(start).filter((call) => call.chatId === userId);
  const visible = messages.map((call) => call.text).join("\n");
  const captured: Captured = {
    visible,
    topicVisible: messages
      .map((call) => withoutExactQueryEcho(call.text, [person.query]))
      .join("\n"),
    articleId: "",
    messages: messages.length,
  };
  // This case describes a call in progress. Follow the actual offered
  // "I hung up" button through the real callback router before judging the
  // later payment advice. No invented callback and no automatic provider I/O.
  const liveCallPrompt = messages.find((message) => {
    if (person.semanticFamily !== "safe-account-transfer" || person.lang !== "uz") return false;
    if (!Array.isArray(message.keyboard)) return false;
    return message.keyboard.some(
      (row: unknown) =>
        Array.isArray(row) &&
        row.some(
          (button: unknown) =>
            typeof button === "object" &&
            button !== null &&
            "callback_data" in button &&
            button.callback_data === "livecall:hangup",
        ),
    );
  });
  if (liveCallPrompt) {
    const continuationStart = h.sent.length;
    await postUpdate({
      callback_query: {
        id: `audit-hangup-${userId}`,
        from: { id: userId, language_code: person.profileLang, first_name: "Synthetic" },
        data: "livecall:hangup",
        message: {
          message_id: 900_000 + h.sent.indexOf(liveCallPrompt) + 1,
          date: 1_790_000_001,
          text: liveCallPrompt.text,
          chat: { id: userId, type: "private" },
          from: { id: 777_000, is_bot: true, first_name: "Ishonch Guard" },
        },
      },
    });
    const continuationMessages = h.sent
      .slice(continuationStart)
      .filter((call) => call.chatId === userId);
    captured.liveCallContinuation = {
      visible: continuationMessages.map((call) => call.text).join("\n"),
      topicVisible: continuationMessages
        .map((call) => withoutExactQueryEcho(call.text, [person.query]))
        .join("\n"),
      messages: continuationMessages.length,
    };
  }
  if (person.followup) {
    const followupStart = h.sent.length;
    await postUpdate({
      message: {
        message_id: updateId,
        date: 1_790_000_001,
        text: person.followup,
        chat: { id: userId, type: "private" },
        from: { id: userId, language_code: person.profileLang, first_name: "Synthetic" },
      },
    });
    const followupMessages = h.sent.slice(followupStart).filter((call) => call.chatId === userId);
    captured.followup = {
      visible: followupMessages.map((call) => call.text).join("\n"),
      topicVisible: followupMessages
        .map((call) => withoutExactQueryEcho(call.text, [person.query, person.followup!]))
        .join("\n"),
      messages: followupMessages.length,
    };
  }
  return captured;
}

async function runInline(person: PersonCase, userId: number): Promise<Captured> {
  const inlineQueryId = `expanded-${userId}`;
  const start = h.inline.length;
  await postUpdate({
    inline_query: {
      id: inlineQueryId,
      from: { id: userId, language_code: person.profileLang, first_name: "Synthetic" },
      query: person.query,
      offset: "",
    },
  });
  const calls = h.inline.slice(start).filter((call) => call.inlineQueryId === inlineQueryId);
  if (calls.length !== 1) throw new Error(`expected one inline answer, got ${calls.length}`);
  const call = calls[0];
  if (call.results.length !== 1)
    throw new Error(`expected one inline result, got ${call.results.length}`);
  const article = call.results[0] as {
    id?: string;
    title?: string;
    description?: string;
    input_message_content?: { message_text?: string };
  };
  const topicVisible = `${article.title ?? ""}\n${article.description ?? ""}`;
  const visible = `${topicVisible}\n${article.input_message_content?.message_text ?? ""}`;
  return { visible, topicVisible, articleId: article.id ?? "", messages: 1 };
}

async function runReplyLikeConversation(
  conversation: ReplyLikeConversation,
  ordinal: number,
): Promise<{ initial: string; followup: string; session: string }> {
  const userId = 99_500_000 + ordinal;
  const chatId = userId;
  await postUpdate({
    message: {
      message_id: updateId,
      date: 1_790_100_000,
      text: conversation.initial,
      chat: { id: chatId, type: "private" },
      from: {
        id: userId,
        language_code: conversation.profileLang,
        first_name: "Synthetic",
      },
    },
  });
  const initialCalls = h.sent.filter((call) => call.chatId === chatId);
  if (initialCalls.length < 1) throw new Error("reply-like initial turn produced no reply");
  const initial = initialCalls.map(({ text }) => text).join("\n");
  const repliedBotText = initialCalls.at(-1)?.text ?? "";
  const repliedBotMessageId = 900_000 + h.sent.length;

  const followupStart = h.sent.length;
  await postUpdate({
    message: {
      message_id: updateId,
      date: 1_790_100_001,
      text: conversation.followup,
      chat: { id: chatId, type: "private" },
      from: {
        id: userId,
        language_code: conversation.profileLang,
        first_name: "Synthetic",
      },
      reply_to_message: {
        message_id: repliedBotMessageId,
        date: 1_790_100_000,
        text: repliedBotText,
        chat: { id: chatId, type: "private" },
        from: { id: 777_000, is_bot: true, first_name: "Ishonch Guard" },
      },
    },
  });
  const followupCalls = h.sent.slice(followupStart).filter((call) => call.chatId === chatId);
  if (followupCalls.length < 1) throw new Error("reply-like follow-up produced no reply");
  return {
    initial,
    followup: followupCalls.map(({ text }) => text).join("\n"),
    session: JSON.stringify(h.sessions.get(userId) ?? {}),
  };
}

function oracleSegment(
  person: PersonCase,
  captured: CapturedSegment,
  turn: "initial" | "follow-up",
  articleId = "",
  liveCallFirstTurn = false,
): void {
  const prefix = `${turn}: `;
  if (captured.messages < 1 || normalize(captured.visible).length < 8) {
    throw new Error(`${prefix}no meaningful reply`);
  }
  if (person.benign && !hasReplyLanguage(captured.topicVisible, person.lang)) {
    throw new Error(`${prefix}profile/message language mismatch was not resolved from message`);
  }
  if (!liveCallFirstTurn && !person.topic.test(normalize(captured.topicVisible))) {
    throw new Error(`${prefix}expected topic missing after removing the echoed query`);
  }
  if (person.safety && !person.safety.test(normalize(captured.visible))) {
    throw new Error(`${prefix}safety instruction missing or wrong response language`);
  }
  if (person.safetyTerms && !hasSafetyTerm(captured.visible, person.safetyTerms)) {
    throw new Error(`${prefix}documented safety language missing`);
  }
  if (person.forbidden?.test(normalize(captured.visible))) {
    throw new Error(`${prefix}known wrong-topic marker present`);
  }
  if (
    person.behaviorContract === "independent-employer-verification" &&
    !hasIndependentEmployerVerification(captured.topicVisible)
  ) {
    throw new Error(`${prefix}independent employer verification action missing`);
  }
  assertNoSecret(captured.visible, person.secrets ?? []);
  if (person.benign && isHighRisk(captured.visible, articleId)) {
    throw new Error(`${prefix}benign input was labelled high risk`);
  }
  if (
    /\b(?:intent[_ -]?id|reason[_ -]?code|classifier|routing table|deterministic)\b/iu.test(
      captured.visible,
    )
  ) {
    throw new Error(`${prefix}internal classifier detail leaked`);
  }
}

function assertLiveCallFirstTurn(person: PersonCase, captured: Captured): void {
  if (
    person.semanticFamily !== "safe-account-transfer" ||
    person.lang !== "uz" ||
    person.mode !== "direct"
  ) {
    throw new Error("unexpected live-call continuation");
  }
  const first = normalize(captured.topicVisible);
  if (
    !/qo['’ʻ]?ng['’ʻ]?iroqni\s+tugating/iu.test(first) ||
    !/rasmiy\s+raqam/iu.test(first) ||
    !/(?:sms|pin|cvv).{0,150}aytmang/iu.test(first)
  ) {
    throw new Error("live-call first turn must stop contact and protect credentials");
  }
}

function oracle(person: PersonCase, captured: Captured): void {
  assertDocumentedDirectSemanticContract(person, captured);
  assertDocumentedInlineSemanticContract(person, captured.articleId);
  if (captured.liveCallContinuation) {
    assertLiveCallFirstTurn(person, captured);
    oracleSegment(person, captured, "initial", captured.articleId, true);
    oracleSegment(person, captured.liveCallContinuation, "follow-up");
  } else {
    oracleSegment(person, captured, "initial", captured.articleId);
  }
  if (person.followup) {
    if (!captured.followup) throw new Error("follow-up: no captured reply");
    oracleSegment(person, captured.followup, "follow-up");
  } else if (captured.followup) {
    throw new Error("unexpected follow-up capture for a one-turn case");
  }
}

describe("expanded offline simulation: 1,308 deterministic surface cases", () => {
  beforeAll(async () => {
    h.externalFetchAttempts = 0;
    installDenyClosedFetchGuard();
    try {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(HARNESS_TIME));
      installHarnessEnvironment();
      const webhook = await import("@/lib/telegram/webhook.server");
      handleTelegramWebhook = webhook.handleTelegramWebhook;
      resetDedupe = webhook.__resetTelegramWebhookDedupeForTests;
      const queues = await import("@/lib/telegram/update-serialization.server");
      resetQueues = queues.__resetTelegramUserUpdateQueuesForTests;
      expect(
        h.externalFetchAttempts,
        "zero external network calls during webhook module initialization",
      ).toBe(0);
    } catch (error) {
      restoreHarnessEnvironment();
      restoreFetchAfterSuite();
      vi.useRealTimers();
      throw error;
    }
  }, 30_000);

  afterAll(() => {
    try {
      restoreHarnessEnvironment();
    } finally {
      try {
        restoreFetchAfterSuite();
      } finally {
        vi.useRealTimers();
      }
    }
  });

  beforeEach(() => {
    vi.setSystemTime(new Date(HARNESS_TIME));
    h.sent.length = 0;
    h.inline.length = 0;
    h.sessions.clear();
    h.runChecks.length = 0;
    h.mockDbCalls.length = 0;
    h.externalFetchAttempts = 0;
    resetDedupe();
    resetQueues();
  });

  it("separates authored phrases from mutations and runs every surface case through the pipeline", async () => {
    expect(EXPECTED_SURFACE_CASE_COUNT).toBe(1308);
    expect(EXPECTED_AUTHORED_PHRASE_COUNT).toBe(153);
    expect(EXPECTED_GENERATED_MUTATION_COUNT).toBe(1155);
    expect(PEOPLE).toHaveLength(EXPECTED_SURFACE_CASE_COUNT);
    expect(new Set(PEOPLE.map((person) => person.id)).size).toBe(EXPECTED_SURFACE_CASE_COUNT);
    expect(new Set(PEOPLE.map((person) => `${person.lang}\0${person.query}`)).size).toBe(
      EXPECTED_SURFACE_CASE_COUNT,
    );
    expect(PEOPLE.filter((person) => provenanceOf(person) === "authored-phrase")).toHaveLength(
      EXPECTED_AUTHORED_PHRASE_COUNT,
    );
    expect(PEOPLE.filter((person) => provenanceOf(person) === "generated-mutation")).toHaveLength(
      EXPECTED_GENERATED_MUTATION_COUNT,
    );
    expect(PEOPLE.filter((person) => person.mode === "direct").length).toBeGreaterThanOrEqual(600);
    expect(PEOPLE.filter((person) => person.mode === "inline").length).toBeGreaterThanOrEqual(600);
    expect(PEOPLE.every((person) => person.lang !== person.profileLang)).toBe(true);
    expect(PEOPLE.filter((person) => person.group === "documented")).toHaveLength(1260);
    expect(PEOPLE.filter((person) => person.group === "new-wave")).toHaveLength(18);
    expect(PEOPLE.filter((person) => person.followup)).toHaveLength(9);
    expect(REPLY_LIKE_CONVERSATIONS).toHaveLength(4);
    for (const lang of ["ru", "uz", "en"] as const) {
      expect(
        PEOPLE.filter((person) => person.lang === lang),
        lang,
      ).toHaveLength(436);
    }

    const results: Array<PersonCase & { passed: boolean; error?: string; sample?: string }> = [];
    for (let index = 0; index < PEOPLE.length; index += 1) {
      const person = PEOPLE[index];
      const userId = 98_000_001 + index;
      let captured: Captured | undefined;
      try {
        captured =
          person.mode === "direct"
            ? await runDirect(person, userId)
            : await runInline(person, userId);
        oracle(person, captured);
        results.push({ ...person, passed: true });
      } catch (error) {
        results.push({
          ...person,
          passed: false,
          error: error instanceof Error ? error.message : String(error),
          sample: captured
            ? (person.secrets ?? [])
                .reduce(
                  (value, secret) => value.replaceAll(normalize(secret), "[redacted]"),
                  normalize(
                    captured.followup
                      ? `${captured.visible}\n[follow-up]\n${captured.followup.visible}`
                      : captured.visible,
                  ),
                )
                .slice(0, 280)
            : undefined,
        });
      }
    }

    const matrix: Record<string, { passed: number; failed: number; total: number }> = {};
    for (const result of results) {
      for (const key of [
        `group:${result.group}`,
        `provenance:${provenanceOf(result)}`,
        `mode:${result.mode}`,
        `lang:${result.lang}`,
        `group-mode-lang:${result.group}/${result.mode}/${result.lang}`,
      ]) {
        matrix[key] ??= { passed: 0, failed: 0, total: 0 };
        matrix[key].total += 1;
        if (result.passed) matrix[key].passed += 1;
        else matrix[key].failed += 1;
      }
    }
    const failures = results
      .filter((result) => !result.passed)
      .map((result) => ({
        id: result.id,
        group: result.group,
        mode: result.mode,
        lang: result.lang,
        error: result.error,
        sample: result.sample,
      }));
    const totalPassed = results.filter((result) => result.passed).length;

    console.log(
      `EXPANDED_SURFACE_SUMMARY=${JSON.stringify({ surfaceCases: EXPECTED_SURFACE_CASE_COUNT, authoredPhrases: EXPECTED_AUTHORED_PHRASE_COUNT, generatedMutations: EXPECTED_GENERATED_MUTATION_COUNT, passed: totalPassed, failed: failures.length })}`,
    );
    console.log(`EXPANDED_SURFACE_MATRIX=${JSON.stringify(matrix)}`);
    console.log(`EXPANDED_SURFACE_FAILURES=${JSON.stringify(failures)}`);
    console.log(
      `EXPANDED_SURFACE_ISOLATION=${JSON.stringify({ externalFetchAttempts: h.externalFetchAttempts, mockedDbCalls: h.mockDbCalls.length, runChecks: h.runChecks.length })}`,
    );

    expect(h.externalFetchAttempts, "zero external Telegram/Supabase/AI/network calls").toBe(0);
    for (const failure of failures) {
      expect
        .soft(
          false,
          `[${failure.id}] ${failure.error ?? "unknown semantic failure"}${failure.sample ? ` | ${failure.sample}` : ""}`,
        )
        .toBe(true);
    }
  }, 240_000);

  it("distinguishes numeric metadata from persisted secrets without relaxing text checks", () => {
    expect(() =>
      assertNoStructuredSecret({ updatedAt: 1_794_974_970_000, userId: 110_000_497 }, ["497"]),
    ).not.toThrow();
    expect(() => assertNoStructuredSecret({ input: "CVV 497" }, ["497"])).toThrow();
    expect(() => assertNoStructuredSecret({ nested: [{ cvv: 497 }] }, ["497"])).toThrow();
    expect(() => assertNoStructuredSecret({ input: "Summer2026!Q" }, ["Summer2026!Q"])).toThrow();
  });

  it("uses a Date-only fixed clock containing none of the corpus synthetic secrets", () => {
    const secrets = [
      ...new Set([
        ...PEOPLE.flatMap((person) => person.secrets ?? []),
        ...REPLY_LIKE_CONVERSATIONS.flatMap((conversation) => conversation.secrets ?? []),
      ]),
    ];
    expect(secrets.length).toBeGreaterThan(0);
    expect(new Date().toISOString()).toBe(HARNESS_TIME);
    expect(Date.now()).toBe(Date.parse(HARNESS_TIME));
    expect(globalThis.setTimeout).toBe(REAL_SET_TIMEOUT);
    expect(performance.now).toBe(REAL_PERFORMANCE_NOW);
    expect(() => assertNoSecret(HARNESS_TIME, secrets)).not.toThrow();
  });

  it("still rejects a coincidental timestamp substring and actual textual or numeric secret leaks", () => {
    // This reproduces the old false alarm without exempting timestamps or
    // changing either privacy oracle: every persisted string remains scanned.
    expect(() => assertNoStructuredSecret({ at: "2026-10-09T07:40:20.614Z" }, ["614"])).toThrow(
      "synthetic secret was echoed",
    );
    expect(() => assertNoStructuredSecret({ input: "CVV 614" }, ["614"])).toThrow(
      "synthetic secret was echoed",
    );
    expect(() => assertNoStructuredSecret({ nested: [{ cvv: 614 }] }, ["614"])).toThrow(
      "synthetic numeric secret was persisted",
    );
  });

  it("reproduces the real CVV handler timestamp collision and restores the stable fixture clock", async () => {
    const authored = documentedCases().find(
      (person) =>
        person.semanticFamily === "card-cvv-request" &&
        person.lang === "uz" &&
        provenanceOf(person) === "authored-phrase",
    );
    expect(authored).toBeDefined();
    const person: PersonCase = {
      ...authored!,
      mode: "direct",
      query: auditStyle(authored!.query, "uz", 2),
    };
    const secrets = person.secrets ?? [];
    expect(secrets).toContain("614");
    try {
      vi.setSystemTime(new Date("2026-10-09T07:40:20.614Z"));
      const colliding = await runDirect(person, 119_999_997);
      expect(() => assertNoSecret(colliding.visible, secrets)).not.toThrow();
      expect(h.sessions.get(119_999_997)).toMatchObject({
        scenario_data: { lastSensitiveSecret: { at: "2026-10-09T07:40:20.614Z" } },
      });
      expect(() => assertNoStructuredSecret(h.sessions.get(119_999_997), secrets)).toThrow(
        "synthetic secret was echoed",
      );
      vi.setSystemTime(new Date(HARNESS_TIME));
      const stable = await runDirect(person, 119_999_998);
      expect(stable.visible).toBe(colliding.visible);
      expect(h.sessions.get(119_999_998)).toMatchObject({
        scenario_data: { lastSensitiveSecret: { at: HARNESS_TIME } },
      });
      expect(() => assertNoStructuredSecret(h.sessions.get(119_999_998), secrets)).not.toThrow();
      expect(h.externalFetchAttempts).toBe(0);
    } finally {
      vi.setSystemTime(new Date(HARNESS_TIME));
    }
  });

  it.each([
    ["ru", "Пришлите полный текст сообщения: для оценки нужно больше данных."],
    ["ru", "Я помогу. Добавьте текст, ссылку или номер для проверки."],
    ["uz", "Aniq baholash uchun ma'lumot kerak. Xabar matnini yuboring."],
    ["uz", "Salom! Matn yoki havolani yuboring, xavfsiz qadamni aytaman."],
    [
      "uz",
      "Xato o'tkazma: bankingizga murojaat qiling. Bankning rasmiy kanalidan qaytarib chaqirishni so'rang.",
    ],
    ["en", "I need more information. Please send the full message text."],
    ["en", "Hello! I can help you check a link or message."],
  ] as const)("oracle language evidence accepts a neutral %s response: %s", (lang, text) => {
    expect(hasReplyLanguage(text, lang)).toBe(true);
    for (const other of ["ru", "uz", "en"] as const) {
      if (other !== lang) expect(hasReplyLanguage(text, other)).toBe(false);
    }
  });

  it("oracle rejects an English answer carrying only a quoted Uzbek greeting", () => {
    expect(
      hasReplyLanguage('You wrote "Salom". I need more data. Send the full message text.', "uz"),
    ).toBe(false);
  });

  it("oracle benign help allows neutral context requests but keeps risk and language controls", () => {
    const benign = BENIGN.find((person) => person.id === "benign-ru-greeting-mismatch")!;
    const visible = "Для точной оценки нужно больше данных. Пришлите полный текст сообщения.";
    const captured: CapturedSegment = { visible, topicVisible: visible, messages: 1 };
    expect(() => oracleSegment(benign, captured, "initial")).not.toThrow();
    expect(() =>
      oracleSegment(benign, { ...captured, visible: `${visible} 🔴 Высокий риск.` }, "initial"),
    ).toThrow(/benign input was labelled high risk/u);
    expect(() =>
      oracleSegment(benign, { ...captured, visible: `${visible} Высокий риск.` }, "initial"),
    ).toThrow(/benign input was labelled high risk/u);
    for (const label of ["High risk", "Yuqori xavf", "Высокий риск"]) {
      expect(isHighRisk(label)).toBe(true);
    }
    expect(() =>
      oracleSegment(
        benign,
        {
          visible: "Send the full message text. I need more information.",
          topicVisible: "Send the full message text. I need more information.",
          messages: 1,
        },
        "initial",
      ),
    ).toThrow(/language mismatch/u);
  });

  it("oracle still rejects generic help when a concrete scam needs a topical action", () => {
    const person = documentedCases().find(
      (candidate) => candidate.semanticFamily === "passport-request" && candidate.lang === "en",
    )!;
    const visible = "Please send the text or link. I can check it. Do not send anything yet.";
    expect(() =>
      oracleSegment(person, { visible, topicVisible: visible, messages: 1 }, "initial"),
    ).toThrow(/expected topic missing/u);
  });

  it("oracle tax-route equivalence requires refusal of the payment and independent verification", () => {
    const safe =
      "Soliq nomidan yozishyapti. Havola orqali to'lamang. Rasmiy raqam orqali tekshiring.";
    expect(hasProtectiveTaxAdvice(safe, "uz")).toBe(true);
    expect(hasProtectiveTaxAdvice(safe.replace("to'lamang", "to'lang"), "uz")).toBe(false);
    expect(
      hasProtectiveTaxAdvice(
        safe.replace("Rasmiy raqam orqali tekshiring.", "SMS kodni aytmang."),
        "uz",
      ),
    ).toBe(false);
    expect(
      hasProtectiveTaxAdvice("Soliq xabari xavfli bo'lishi mumkin. Ehtiyot bo'ling.", "uz"),
    ).toBe(false);
  });

  it("oracle accepts conservative employer advice only with an independent identity check", () => {
    const safe =
      "Suspicious request claiming employer authority. Call the organization back on the official number.";
    expect(hasIndependentEmployerVerification(safe)).toBe(true);
    expect(
      hasIndependentEmployerVerification("Your boss requested an urgent transfer. Be careful."),
    ).toBe(false);
    expect(
      hasIndependentEmployerVerification("Your employer is trusted. Transfer the money now."),
    ).toBe(false);
    expect(
      hasIndependentEmployerVerification(
        "Do not call the employer on the official number. Transfer the money now.",
      ),
    ).toBe(false);
  });

  it("oracle live-call continuation cannot bypass the initial protective action or later topic", () => {
    const person = documentedCases().find(
      (candidate) =>
        candidate.semanticFamily === "safe-account-transfer" && candidate.lang === "uz",
    )!;
    const initial =
      "Qo'ng'iroqni tugating. Rasmiy raqam orqali tekshiring. SMS, PIN, CVV yoki parolni aytmang.";
    const final = "Pulni xavfsiz hisobga o'tkazmang. Rasmiy bank raqamiga qo'ng'iroq qiling.";
    const captured: Captured = {
      visible: initial,
      topicVisible: initial,
      messages: 1,
      articleId: "",
      liveCallContinuation: { visible: final, topicVisible: final, messages: 1 },
    };
    expect(() => assertLiveCallFirstTurn({ ...person, mode: "direct" }, captured)).not.toThrow();
    expect(() =>
      assertLiveCallFirstTurn(
        { ...person, mode: "direct" },
        {
          ...captured,
          topicVisible: initial.replace("Qo'ng'iroqni tugating.", "Suhbatni davom ettiring."),
        },
      ),
    ).toThrow(/must stop contact/u);
    expect(() =>
      oracleSegment(
        person,
        {
          visible: "Xavf bor, ehtiyot bo'ling. Matnni yuboring.",
          topicVisible: "Xavf bor, ehtiyot bo'ling. Matnni yuboring.",
          messages: 1,
        },
        "follow-up",
      ),
    ).toThrow(/expected topic missing/u);
  });

  it("follows the actually offered hang-up action before checking the safe-account continuation", async () => {
    const authored = documentedCases().find(
      (person) =>
        person.semanticFamily === "safe-account-transfer" &&
        person.lang === "uz" &&
        provenanceOf(person) === "authored-phrase",
    )!;
    const person: PersonCase = {
      ...authored,
      mode: "direct",
      query: auditStyle(authored.query, authored.lang, 6),
    };
    const captured = await runDirect(person, 119_999_999);
    expect(captured.liveCallContinuation).toBeDefined();
    expect(captured.liveCallContinuation?.visible).toMatch(/(?:xavfsiz|tekshir)/iu);
    oracle(person, captured);
    expect(h.externalFetchAttempts).toBe(0);
  });

  it("audits 5,244 isolated virtual sessions with strict semantic/privacy oracles", async () => {
    const people = buildLargeAudit();
    expect(people).toHaveLength(5244);
    expect(new Set(people.map((person) => person.id)).size).toBe(5244);
    const matrix: Record<string, { passed: number; failed: number }> = {};
    const failures: Array<{
      id: string;
      lang: Lang;
      mode: Mode;
      error: string;
      sample: string;
      input: string;
      topicVisible: string;
    }> = [];
    const latencies: number[] = [];
    const updatesBefore = updateId;
    let followups = 0;
    let liveCallContinuations = 0;
    let benignHighRiskSessions = 0;
    for (const [index, person] of people.entries()) {
      const started = performance.now();
      const userId = 110_000_000 + index;
      const checksBefore = h.runChecks.length;
      let captured: Captured | undefined;
      let failure: string | undefined;
      try {
        captured =
          person.mode === "direct"
            ? await runDirect(person, userId)
            : await runInline(person, userId);
        assertNoSecret(captured.visible, person.secrets ?? []);
        if (captured.followup) assertNoSecret(captured.followup.visible, person.secrets ?? []);
        if (captured.liveCallContinuation) {
          liveCallContinuations += 1;
          assertNoSecret(captured.liveCallContinuation.visible, person.secrets ?? []);
        }
        assertNoStructuredSecret(h.sessions.get(userId) ?? {}, person.secrets ?? []);
        assertNoStructuredSecret(h.runChecks.slice(checksBefore), person.secrets ?? []);
        if (h.externalFetchAttempts !== 0) throw new Error("denied external request attempted");
        // Record this independently: a topic/language oracle can fail before
        // oracleSegment reaches the benign-risk assertion.
        if (person.benign && isHighRisk(captured.visible, captured.articleId)) {
          benignHighRiskSessions += 1;
        }
        oracle(person, captured);
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
      }
      latencies.push(performance.now() - started);
      if (person.followup) followups += 1;
      for (const key of [
        `lang:${person.lang}`,
        `mode:${person.mode}`,
        `group:${person.group}`,
        `family:${person.semanticFamily ?? person.id.split("-").slice(0, 3).join("-")}`,
      ]) {
        matrix[key] ??= { passed: 0, failed: 0 };
        matrix[key][failure ? "failed" : "passed"] += 1;
      }
      if (failure) {
        const sample = (person.secrets ?? [])
          .reduce(
            (value, secret) => value.replaceAll(normalize(secret), "[redacted]"),
            normalize(
              [captured?.visible, captured?.liveCallContinuation?.visible]
                .filter(Boolean)
                .join("\n[after hangup]\n"),
            ),
          )
          .slice(0, 700);
        const redactAuditText = (value: string): string =>
          (person.secrets ?? []).reduce(
            (text, secret) => text.replaceAll(normalize(secret), "[redacted]"),
            normalize(value),
          );
        failures.push({
          id: person.id,
          lang: person.lang,
          mode: person.mode,
          error: failure,
          sample,
          input: redactAuditText(person.query).slice(0, 500),
          topicVisible: redactAuditText(captured?.topicVisible ?? "").slice(0, 400),
        });
      }
    }
    latencies.sort((a, b) => a - b);
    const percentile = (p: number): number => latencies[Math.ceil(p * latencies.length) - 1];
    console.log(
      `LARGE_AUDIT_SUMMARY=${JSON.stringify({ sessions: people.length, authoredSeeds: 153, documentedFamilies: 35, passed: people.length - failures.length, failed: failures.length, followups, liveCallContinuations, updates: updateId - updatesBefore, benignHighRiskSessions, externalFetchAttempts: h.externalFetchAttempts, inProcessMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: latencies.at(-1) } })}`,
    );
    console.log(`LARGE_AUDIT_MATRIX=${JSON.stringify(matrix)}`);
    console.log(`LARGE_AUDIT_FAILURES=${JSON.stringify(failures)}`);
    expect(h.externalFetchAttempts, "strictly offline, even on failure").toBe(0);
    expect(
      failures.length,
      `semantic/privacy audit failed; first=${JSON.stringify(failures.slice(0, 8))}`,
    ).toBe(0);
  }, 240_000);

  it.each(REPLY_LIKE_CONVERSATIONS)(
    "keeps enum-only context across a reply-like multi-turn flow: $id",
    async (conversation) => {
      expect(conversation.lang).not.toBe(conversation.profileLang);
      const captured = await runReplyLikeConversation(
        conversation,
        REPLY_LIKE_CONVERSATIONS.indexOf(conversation),
      );

      expect(normalize(captured.initial).length).toBeGreaterThan(20);
      expect(normalize(captured.followup).length).toBeGreaterThan(20);
      expect(captured.followup).toMatch(conversation.topic);
      expect(captured.followup).toMatch(conversation.safety);
      expect(captured.followup).not.toMatch(
        /(?:недостаточно\s+данных|kontekst\s+kerak|not\s+enough\s+(?:data|context))/iu,
      );
      assertNoSecret(captured.initial, conversation.secrets ?? []);
      assertNoSecret(captured.followup, conversation.secrets ?? []);
      assertNoSecret(captured.session, conversation.secrets ?? []);
      expect(h.externalFetchAttempts, "reply-like flow stayed fully offline").toBe(0);
    },
  );
});
