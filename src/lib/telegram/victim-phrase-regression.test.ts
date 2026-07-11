// Regression corpus: realistic first-contact victim phrases must never fall
// into the generic "not enough data" card. Born from a 2026-07-09 live QA
// probe where 23 of 58 realistic phrases (including «меня обманули» and
// «meni aldashdi») got the generic card.
//
// The harness mirrors webhook.integration.test.ts: the REAL chain
// webhook.server → router → handlers → victim-intent/panic → runCheck runs,
// only the external boundaries (Bot API, Supabase, AI fetch) are mocked.
import process from "node:process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  sendCalls: [] as { chatId: number; text: string; keyboard?: unknown }[],
  entityRow: null as unknown,
  sessionRow: null as unknown,
}));

vi.mock("@/lib/telegram/api.server", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/telegram/api.server")>();
  return {
    ...actual,
    sendMessage: vi.fn(async (opts: { chatId: number; text: string; keyboard?: unknown }) => {
      h.sendCalls.push(opts);
      return { ok: true };
    }),
    sendChatAction: vi.fn(async () => {}),
    answerCallbackQuery: vi.fn(async () => {}),
    answerInlineQuery: vi.fn(async () => ({ ok: true })),
    getFile: vi.fn(async () => ({ filePath: "x.jpg", fileSize: 10 })),
    downloadFileAsDataUrl: vi.fn(async () => "data:image/jpeg;base64,AA=="),
  };
});

vi.mock("@/integrations/supabase/client.server", () => {
  function builder(table: string) {
    const b = {
      select: () => b,
      eq: () => b,
      maybeSingle: async () => {
        if (table === "entities") return { data: h.entityRow, error: null };
        if (table === "telegram_sessions") return { data: h.sessionRow, error: null };
        return { data: null, error: null };
      },
      insert: async () => ({ error: null }),
      upsert: async () => ({ error: null }),
      update: () => b,
    };
    return b;
  }
  return {
    supabaseAdmin: {
      from: (table: string) => builder(table),
      rpc: async (name: string, args: Record<string, unknown>) => {
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
        if (name === "load_telegram_session_fenced") {
          return { data: { lease_valid: true, session: h.sessionRow }, error: null };
        }
        if (name === "save_telegram_session_fenced") {
          return {
            data: [{ lease_valid: true, applied: true, current_update_id: args.p_update_id }],
            error: null,
          };
        }
        if (name === "save_telegram_session_sequenced") {
          return {
            data: [{ applied: true, current_update_id: args.p_update_id }],
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
    analyzeImageCore: vi.fn(async () => null),
    transcribeVoiceCore: vi.fn(async () => ({ text: "" })),
  };
});

vi.mock("@/lib/report.functions", () => ({
  submitReport: vi.fn(async () => ({ ok: true })),
  prepareReportIdentifier: vi.fn(async (value: string) => ({
    type: "text",
    hash: `hash:${value.length}`,
    display: "[redacted]",
    incidentOnly: false,
  })),
  prepareIncidentOnlyReportTarget: vi.fn(async (description: string) => ({
    type: "text",
    hash: `hash:${description.length}`,
    display: "__ishonch_guard_incident_only__",
    incidentOnly: true,
  })),
  submitPreparedReportCore: vi.fn(async () => ({ ok: true })),
  reportRateLimitKeyForTelegram: (userId: number) => `report:tg:${userId}`,
}));

import { __resetTelegramWebhookDedupeForTests, handleTelegramWebhook } from "./webhook.server";

const WEBHOOK_URL = "https://app.example/api/telegram/webhook";
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const SECRET = "corpus-secret";
let updateId = 90_000;
let userId = 800_000;

// verdict_unknown card markers per language (bot-i18n.ts). A victim phrase
// answered with one of these means the bot failed to understand the person.
const GENERIC_CARD_MARKERS = [
  "Недостаточно данных для точной оценки",
  "ma'lumot yetarli emas",
  "Not enough data for a precise assessment",
];

function webhookRequest(update: unknown): Request {
  const headers = new Headers({ "content-type": "application/json" });
  headers.set(SECRET_HEADER, SECRET);
  return new Request(WEBHOOK_URL, { method: "POST", headers, body: JSON.stringify(update) });
}

async function sendText(text: string, languageCode: string): Promise<string[]> {
  h.sendCalls.length = 0;
  userId += 1;
  const res = await handleTelegramWebhook(
    webhookRequest({
      update_id: updateId++,
      message: {
        message_id: 1,
        from: { id: userId, language_code: languageCode },
        chat: { id: userId },
        text,
      },
    }),
  );
  expect(res.status).toBe(200);
  return h.sendCalls.map((c) => c.text);
}

interface CorpusCase {
  text: string;
  /** Telegram client language_code (also drives the first-contact reply language). */
  lang?: string;
  /** Substring the (possibly MarkdownV2-escaped) reply must contain. */
  replyIncludes?: string;
}

// prettier-ignore
const MUST_NOT_BE_GENERIC: CorpusCase[] = [
  // A. Ультракороткие крики о помощи (RU)
  { text: "меня обманули", replyIncludes: "банк" },
  { text: "помогите", replyIncludes: "Я рядом" },
  { text: "я перевел деньги мошенникам" },
  { text: "у меня украли деньги с карты", replyIncludes: "банк" },
  { text: "что делать" },
  { text: "меня развели на деньги", replyIncludes: "банк" },
  { text: "отправил код" },
  { text: "я дал код из смс" },
  { text: "взломали телеграм" },
  { text: "мошенники" },
  { text: "деньги ушли", replyIncludes: "банк" },
  { text: "обманули помогите" },
  // B. Опечатки / транслит
  { text: "памагите миня абманули", replyIncludes: "Я рядом" },
  { text: "мошеники сняли денги с карты", replyIncludes: "банк" },
  { text: "menya obmanuli chto delat" },
  { text: "kak vernut dengi" },
  // C. Узбекский (латиница) — первый контакт должен отвечать по-узбекски.
  { text: "meni aldashdi", lang: "uz", replyIncludes: "avval bank" },
  { text: "pul o'tkazib yubordim", lang: "uz" },
  { text: "kod yubordim nima qilay", lang: "uz" },
  { text: "yordam bering", lang: "uz", replyIncludes: "yoningizdaman" },
  { text: "kartamdan pul yechib olishdi", lang: "uz", replyIncludes: "bank" },
  // D. Узбекский (кириллица)
  { text: "мени алдашди", lang: "uz", replyIncludes: "avval bank" },
  { text: "ёрдам беринг пул ўтказдим", lang: "uz" },
  // E. Живые описания ситуаций
  { text: "мне звонят из банка говорят карта заблокирована" },
  { text: "але мне сказали я выиграл айфон надо оплатить доставку" },
  { text: "пишут что мой сын попал в аварию нужны деньги срочно" },
  { text: "мама скинула ссылку говорит от налоговой проверь пожалуйста", replyIncludes: "ссылк" },
  { text: "незнакомый номер просит проголосовать за племянницу в конкурсе", replyIncludes: "Telegram" },
  { text: "мне предлагают работу на дому 500$ в день только надо внести залог", replyIncludes: "Не платите заранее" },
  { text: "человек с сайта знакомств просит помочь с инвестициями" },
  { text: "требуют деньги иначе опубликуют мои фото", replyIncludes: "вымогательство" },
  { text: "звонит милиция говорит на меня уголовное дело" },
  { text: "просят оплатить растаможку посылки" },
  { text: "в группе пишут раздают криптовалюту от Дурова" },
  { text: "бабушке звонят мошенники что делать" },
  // F. Вопросы о доверии без объекта
  { text: "это скам?" },
  { text: "можно ли доверять?" },
  { text: "правда или обман" },
  { text: "это безопасно" },
  // G. Мета / разговорные
  { text: "привет" },
  { text: "спасибо" },
  { text: "ты кто" },
  { text: "ты бот?", replyIncludes: "Ishonch Guard" },
  { text: "как ты работаешь" },
  // H. После обмана — практические вопросы
  { text: "как вернуть деньги", replyIncludes: "банк" },
  { text: "куда звонить если обманули" },
  { text: "как заблокировать карту", replyIncludes: "заблокировать" },
  { text: "нужно ли идти в милицию", replyIncludes: "банк" },
  { text: "поможет ли банк вернуть перевод", replyIncludes: "банк" },
  // J. Крайние / эмоциональные
  { text: "мне страшно", replyIncludes: "Я рядом" },
  { text: "они опять звонят" },
  { text: "не понимаю что происходит объясни", replyIncludes: "Я рядом" },
  { text: "my mom sent money to a scammer what now", lang: "en" },
  // K. Вторая волна (gap probe 2026-07-10): вывод средств, кредиты на имя,
  // списания, взлом соцсетей, угрозы, повторный контакт, приватность, близкие.
  { text: "не могу вывести деньги с платформы", replyIncludes: "ловушку с выводом" },
  { text: "требуют налог чтобы вывести мой выигрыш", replyIncludes: "не платите" },
  { text: "вложился через наставника а вывод заблокировали", replyIncludes: "наставника" },
  { text: "pulimni qaytarib bo'lmayapti", lang: "uz", replyIncludes: "to'lamang" },
  { text: "на меня оформили кредит", replyIncludes: "милицию" },
  { text: "взяли микрозайм на мое имя", replyIncludes: "кредитную историю" },
  { text: "kredit rasmiylashtirishibdi ustimga", lang: "uz", replyIncludes: "Militsiyaga" },
  { text: "пришло смс о списании которое я не делал", replyIncludes: "оспорьте" },
  { text: "подписали на платные смс списывают деньги", replyIncludes: "оператор" },
  { text: "взломали инстаграм", replyIncludes: "двухфакторную" },
  { text: "взломали почту", replyIncludes: "Забыли пароль" },
  { text: "он пишет мне с нового номера опять", replyIncludes: "Заблокируйте" },
  { text: "это анонимно?", replyIncludes: "хеша" },
  { text: "ты не сольешь мои данные?", replyIncludes: "не храню" },
  { text: "угрожают приехать домой если не заплачу", replyIncludes: "102" },
  { text: "бабушка перевела деньги мошенникам", replyIncludes: "заморозить" },
  { text: "onam firibgarga pul o'tkazib yubordi", lang: "uz", replyIncludes: "bankiga" },
  // L. Транслит-раскладка и растянутые буквы.
  { text: "menya razveli na dengi", replyIncludes: "банк" },
  { text: "ya perevel dengi moshennikam" },
  { text: "vzlomali telegram" },
  { text: "pomogite", replyIncludes: "Я рядом" },
  { text: "памагитеееее", replyIncludes: "Я рядом" },
];

beforeEach(() => {
  __resetTelegramWebhookDedupeForTests();
  h.sendCalls.length = 0;
  h.entityRow = null;
  h.sessionRow = null;
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
  process.env.TELEGRAM_BOT_TOKEN = "corpus-token";
  // AI gateway degraded on purpose: replies must be useful rules-only.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("err", { status: 500 })),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("victim phrase corpus — no generic card on realistic first contact", () => {
  it.each(MUST_NOT_BE_GENERIC.map((c) => [c.text, c] as const))(
    "answers usefully: %s",
    async (_text, c) => {
      const replies = await sendText(c.text, c.lang ?? "ru");
      expect(replies.length).toBeGreaterThan(0);
      const joined = replies.join("\n---\n").replace(/\\/g, "");
      for (const marker of GENERIC_CARD_MARKERS) {
        expect(joined).not.toContain(marker);
      }
      if (c.replyIncludes) {
        expect(joined).toContain(c.replyIncludes);
      }
    },
  );

  it("still runs the risk pipeline for concrete artifacts", async () => {
    const replies = await sendText("http://kapitalbank-uz.top/login", "ru");
    const joined = replies.join("\n").replace(/\\/g, "");
    expect(joined).toContain("Высокий риск");
  });

  it("keeps the imperative scam payload out of the victim funnel", async () => {
    // A forwarded scammer instruction must not be mistaken for a done-report.
    const replies = await sendText("Ваша карта заблокирована, срочно сообщите код из СМС", "ru");
    const joined = replies.join("\n").replace(/\\/g, "");
    expect(joined).toContain("Высокий риск");
  });
});
