// МАССОВЫЙ прогон inline-фраз @scamguard_bot <ситуация>.
// e2e через handleTelegramWebhook. Цель: проверить покрытие ВСЕХ типов живых фраз.
import process from "node:process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  inlineCalls: [] as Array<{ id: string; results: unknown[] }>,
}));

vi.mock("@/lib/telegram/api.server", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/telegram/api.server")>();
  return {
    ...actual,
    sendMessage: async () => ({ ok: true }),
    sendChatAction: async () => {},
    answerCallbackQuery: async () => ({ ok: true }),
    answerInlineQuery: async (opts: { inlineQueryId: string; results: unknown[] }) => {
      h.inlineCalls.push({ id: opts.inlineQueryId, results: opts.results });
      return { ok: true };
    },
    getFile: async () => ({ filePath: "p.jpg", fileSize: 2048 }),
    downloadFileAsDataUrl: async () => "data:image/jpeg;base64,AA==",
  };
});

vi.mock("@/integrations/supabase/client.server", () => {
  const noop = async () => ({ data: null, error: null });
  function builder(table: string) {
    const b: any = {
      select: () => b, eq: () => { b.__r = null; return b; },
      maybeSingle: async () => ({ data: b.__r ?? null, error: null }),
      single: async () => ({ data: b.__r ?? null, error: null }),
      insert: async () => ({ error: null }), upsert: async () => ({ error: null }),
      update: () => b, gte: () => b, limit: () => b, order: () => b, in: () => b, gt: () => b,
    };
    return b;
  }
  return {
    supabaseAdmin: {
      from: (t: string) => builder(t),
      rpc: async () => ({ data: { allowed: true, remaining: 99, retry_after_sec: 0 }, error: null }),
    },
  };
});

vi.mock("@/lib/risk/check-core", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/risk/check-core")>();
  return { ...actual, analyzeImageCore: async () => null, transcribeVoiceCore: async () => ({ text: null }), ocrExtractCore: async () => ({ text: null }) };
});

vi.mock("@/lib/report.functions", () => {
  const target = (v: string, io = false) => ({ type: v.startsWith("@") || v.includes("t.me") ? "telegram" : v.startsWith("http") ? "url" : v.replace(/\D/g, "").length >= 7 ? "phone" : "text", hash: `h:${v.length}`, display: io ? "__inc__" : "[redacted]", incidentOnly: io });
  return {
    submitReport: async () => ({ ok: true }),
    prepareReportIdentifier: (v: string) => Promise.resolve(target(v)),
    prepareIncidentOnlyReportTarget: (d: string) => Promise.resolve(target(d, true)),
    submitPreparedReportCore: async () => ({ ok: true }),
    reportRateLimitKeyForTelegram: (u: number) => `report:tg:${u}`,
  };
});

vi.mock("@/lib/telegram/session.server", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/telegram/session.server")>();
  return {
    ...actual,
    loadSession: async (userId: number) => ({ telegramUserId: userId, lang: "ru", scenario: "none", scenarioStep: 0, scenarioData: {}, updatedAt: new Date().toISOString() }),
    saveSession: async () => ({ ok: true }),
  };
});

import { __resetTelegramWebhookDedupeForTests, handleTelegramWebhook } from "./webhook.server";

const SECRET = "test-secret";
let updateId = 10_000;

function inlineReq(query: string, userId = 42): Request {
  return new Request("https://app.example/api/telegram/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Telegram-Bot-Api-Secret-Token": SECRET },
    body: JSON.stringify({
      update_id: updateId++,
      inline_query: { id: `iq-${updateId}`, from: { id: userId, language_code: "ru" }, query, offset: "" },
    }),
  });
}

async function run(label: string, query: string, idx: number): Promise<{ title: string; desc: string }> {
  // Каждый запрос от нового userId → свежий rate-limit бакет (10/мин на user).
  const userId = 1000 + idx;
  await handleTelegramWebhook(inlineReq(query, userId));
  const r = h.inlineCalls[h.inlineCalls.length - 1]?.results?.[0] as
    | { title?: string; description?: string }
    | undefined;
  const title = r?.title ?? "(нет результата)";
  const desc = (r?.description ?? "").slice(0, 80);
  const cold = /нужно больше контекста|недостаточно данных/i.test(title);
  const limited = /слишком много проверок/i.test(title);
  const mark = cold ? "❌" : limited ? "⏳" : "✅";
  console.log(`  ${mark} ${label}\n     "${query}"\n     → ${title} | ${desc}\n`);
  return { title, desc };
}

const PHRASES: Array<[string, string]> = [
  // Звонки (массово)
  ["зв1: мне звонит незнакомый номер", "мне звонит незнакомый номер"],
  ["зв2: мне звонит фейковый майор", "мне звонит фейковый майор"],
  ["зв3: мне звонят с незнакомого", "мне звонят с незнакомого номера"],
  ["зв4: звонит неизвестный номер", "звонит неизвестный номер"],
  ["зв5: мне звонят прямо сейчас", "мне звонят прямо сейчас"],
  ["зв6: мне звонят из банка", "мне звонят из банка"],
  ["зв7: мне звонят из полиции", "мне звонят из полиции"],
  ["зв8: мне звонят из следственного", "мне звонят из следственного комитета"],
  ["зв9: мне звонит служба безопасности", "мне звонит служба безопасности"],
  ["зв10: мне звонят и просят код", "мне звонят и просят код"],
  ["зв11: мне звонят и торопят", "мне звонят и торопят"],
  ["зв12: мне звонят и угрожают", "мне звонят и угрожают"],
  ["зв13: мне звонят рано утром", "мне звонят рано утром"],
  ["зв14: оператор звонит", "мне звонят от оператора"],
  ["зв15: зарубежный номер звонит", "мне звонит зарубежный номер"],
  // Переписка
  ["п1: мне пишет незнакомый человек", "мне пишет незнакомый человек"],
  ["п2: мне пишет мошенник", "мне пишет мошенник"],
  ["п3: мне пишет майор", "мне пишет майор полиции"],
  ["п4: мне пишет поддержка телеграм", "мне пишет поддержка телеграм"],
  ["п5: мне пишет иностранка", "мне пишет девушка из интернета"],
  ["п6: мне пишет работодатель", "мне пишет работодатель"],
  ["п7: мне пишет одноклассник", "мне пишет одноклассник но я не уверен"],
  ["п8: мне пишет друг и просит деньги", "мне пишет друг и просит деньги"],
  ["п9: мне пишет криптоинвестор", "мне пишет криптоинвестор"],
  ["п10: мне пишет служба безопасности", "мне пишет служба безопасности"],
  ["п11: мне пишет кто-то и шлёт ссылку", "мне пишет кто-то и шлёт ссылку"],
  ["п12: мне пишет и шлёт файл", "мне пишет и шлёт файл"],
  // Просьбы (у меня просят)
  ["пр1: у меня просят код", "у меня просят код"],
  ["пр2: у меня просят ссылку", "у меня просят ссылку"],
  ["пр3: у меня просят карту", "у меня просят карту"],
  ["пр4: у меня просят cvv", "у меня просят cvv"],
  ["пр5: у меня просят pin", "у меня просят pin"],
  ["пр6: у меня просят смс", "у меня просят смс"],
  ["пр7: у меня просят перевод", "у меня просят перевод"],
  ["пр8: у меня просят деньги", "у меня просят деньги"],
  ["пр9: у меня просят паспорт", "у меня просят паспорт"],
  ["пр10: у меня просят пинфл", "у меня просят пинфл"],
  ["пр11: у меня просят установить приложение", "у меня просят установить приложение"],
  ["пр12: у меня просят anydesk", "у меня просят установить anydesk"],
  ["пр13: у меня просят последние цифры карты", "у меня просят последние цифры карты"],
  ["пр14: у меня просят код из приложения", "у меня просят код из приложения"],
  // Эмоция / крик о помощи
  ["э1: помогите", "помогите"],
  ["э2: меня обманывают", "меня обманывают"],
  ["э3: меня пытаются обмануть", "меня пытаются обмануть"],
  ["э4: я боюсь", "я боюсь"],
  ["э5: мне страшно", "мне страшно"],
  ["э6: я не знаю что делать", "я не знаю что делать"],
  ["э7: срочно помогите", "срочно помогите"],
  ["э8: я думаю это мошенники", "я думаю это мошенники"],
  ["э9: похоже это скам", "похоже это скам"],
  ["э10: у меня плохое предчувствие", "у меня плохое предчувствие"],
  // Вопрос за советом
  ["в1: что мне делать", "что мне делать"],
  ["в2: что делать если меня обманули", "что делать если меня обманули"],
  ["в3: как проверить номер", "как проверить номер"],
  ["в4: как связаться с банком", "как связаться с банком"],
  ["в5: какой номер банка", "какой номер банка"],
  ["в6: какой номер полиции", "какой номер полиции"],
  ["в7: куда обращаться если обманули", "куда обращаться если обманули"],
  ["в8: как вернуть деньги", "как вернуть деньги после мошенника"],
  ["в9: можно ли давать код", "можно ли давать код"],
  ["в10: что отвечать мошеннику", "что отвечать мошеннику"],
  // Я уже сделал (panic)
  ["я1: я уже перевёл деньги", "я уже перевёл деньги"],
  ["я2: я уже отправил код", "я уже отправил код"],
  ["я3: я уже назвал код из смс", "я уже назвал код из смс"],
  ["я4: я уже установил apk", "я уже установил apk"],
  ["я5: я уже дал номер карты", "я уже дал номер карты"],
  ["я6: я уже перешёл по ссылке", "я уже перешёл по ссылке"],
  // Новостные UZ-сценарии и реальные короткие формулировки
  ["n1: +988 банк просит карту и SMS", "мне звонят с +988 и представляются сотрудником банка, просят данные карты и SMS"],
  ["n2: +98 Uzmobile код", "мне звонят с +98 говорят Uzmobile и просят код для защиты номера от блокировки"],
  ["n3: много иностранных звонков", "мне звонят по 15 раз с иностранного номера и просят карту и код из SMS"],
  ["n4: Uztelecom +996", "мне звонит Uztelecom с +996 договор истекает и просят SMS код"],
  ["n5: Telegram удаление Отмена", "мне пришло сообщение от Telegram аккаунт удален нажмите Отмена чтобы спасти профиль"],
  ["n6: Telegram Premium подарок", "мне пришел подарок Telegram Premium надо активировать по ссылке"],
  ["n7: знакомый голосование", "мне пишет знакомый и просит проголосовать в конкурсе по ссылке"],
  ["n8: лучшая мамочка", "просят проголосовать за лучшую мамочку по ссылке"],
  ["n9: APK повестка", "прислали APK повестка в суд"],
  ["n10: голосовое как файл", "мне прислали голосовое сообщение как файл и говорят открыть"],
  ["n11: gif pptx открытка", "прислали GIF открытку с новым годом и файл pptx"],
  ["n12: Apple ID пароль", "всплывающее окно Apple ID просит пароль для проверки аккаунта"],
  ["n13: банкомат снять деньги", "у банкомата незнакомец просит снять деньги с моей карты"],
  ["n14: газ нулевой баланс", "пишут что нулевой баланс за газ и нужно перейти по ссылке для проверки"],
  ["n15: госорганы ФИО ПИНФЛ", "мне звонят из госорганов знают ФИО и ПИНФЛ просят код"],
  ["n16: три цифры карты", "у меня спрашивают три цифры на обороте карты"],
  ["n17: DMED поликлиника", "поликлиника просит SMS код для записи в DMED"],
  ["n18: знакомый одолжи", "знакомый пишет срочно одолжи деньги верну через пару часов"],
  ["n19: игровые бонусы", "ребенку обещают бесплатные бонусы в игре и просят код"],
  ["n20: бот заработок", "мне предлагают бот для заработка 500 тысяч сум в день по нажатию кнопки"],
  ["n21: почта посылка SMS", "звонят из почты для получения посылки нужно продиктовать SMS код"],
  ["n22: водоканал паспорт", "звонят из водоканала и просят паспорт для умного счетчика"],
  ["n23: Open Budget голос", "покупают голос Open Budget и просят SMS код"],
  ["n24: молчащий звонок", "звонят и молчат чтобы записать голос"],
  // UZ / EN / смешанное
  ["u1: meni aldayapti", "meni aldayapti"],
  ["u2: menga kod so'rashyapti", "menga kod so'rashyapti"],
  ["u3: menga noma'lum odam yozdi", "menga noma'lum odam yozdi"],
  ["u4: yordam kerak", "yordam kerak"],
  ["u5: qo'rqyapman", "qo'rqyapman"],
  ["e1: I think this is a scam", "I think this is a scam"],
  ["e2: someone is calling me", "someone is calling me"],
  ["e3: help me", "help me"],
  ["m1: Salom", "Salom"],
  ["m2: привет", "привет"],
  ["m3: спасибо", "спасибо"],
  ["m4: а вы кто", "а вы кто"],
];

describe("QA INLINE MASS — все типы фраз", () => {
  beforeEach(() => {
    h.inlineCalls.length = 0;
    __resetTelegramWebhookDedupeForTests();
    process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
    process.env.TELEGRAM_BOT_TOKEN = "tok";
    process.env.HASH_PEPPER_SECRET = "test-pepper-for-qa-mass";
  });
  afterEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = undefined;
    process.env.TELEGRAM_BOT_TOKEN = undefined;
    process.env.HASH_PEPPER_SECRET = undefined;
  });

  it("МАССОВЫЙ ПРОГОН", async () => {
    console.log("\n═══ INLINE MASS: 100+ ФРАЗ ═══\n");
    let cold = 0;
    let ok = 0;
    let limited = 0;
    for (let idx = 0; idx < PHRASES.length; idx++) {
      const [label, query] = PHRASES[idx];
      const r = await run(label, query, idx);
      if (/нужно больше контекста|недостаточно данных/i.test(r.title)) cold++;
      else if (/слишком много проверок/i.test(r.title)) limited++;
      else ok++;
    }
    console.log(`\n═══ ИТОГ: осмысленных ${ok}/${PHRASES.length}, холодных ${cold}, rate-limited ${limited} ═══\n`);
    expect(PHRASES.length).toBeGreaterThan(0);
    expect(cold).toBe(0);
    expect(limited).toBe(0);
    expect(ok).toBe(PHRASES.length);
  });
});
