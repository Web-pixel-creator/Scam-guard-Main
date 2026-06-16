import { checkSharedRateLimit } from "@/lib/risk/shared-rate-limit.server";
import type { InputType } from "@/lib/risk/detect";
import type { ReasonCode } from "@/lib/risk/rules";
import type { Lang } from "@/lib/i18n";
import {
  escapeMarkdownV2,
  sendAudioFile,
  sendMessage,
  type InlineKeyboard,
} from "@/lib/telegram/api.server";

export const VOICE_OUT_CB = {
  panic: "voiceout:panic",
  guardian: "voiceout:guardian",
} as const;

export type VoiceOutAction = (typeof VOICE_OUT_CB)[keyof typeof VOICE_OUT_CB];

type PanicScenarioId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export interface VoiceOutGuardianSnapshot {
  level: "high_risk";
  type: InputType;
  reasons: ReasonCode[];
  at: string;
}

type VoiceOutResult =
  | { ok: true; bytes: Uint8Array; mimeType: string; filename: string }
  | {
      ok: false;
      reason: "not_configured" | "rate_limited" | "provider_error" | "unsafe_text";
      retryAfterSec?: number;
    };

type TtsConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  voice: string;
};

const VOICE_OUT_DAILY_LIMIT = 5;
const VOICE_OUT_WINDOW_MS = 24 * 60 * 60 * 1000;
const VOICE_OUT_TIMEOUT_MS = 12_000;
const MAX_TTS_CHARS = 520;
const MAX_AUDIO_BYTES = 1_500_000;
const DEFAULT_TTS_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_TTS_VOICE = "alloy";

export function parseVoiceOutCallback(data: string): VoiceOutAction | null {
  return Object.values(VOICE_OUT_CB).includes(data as VoiceOutAction)
    ? (data as VoiceOutAction)
    : null;
}

function textByLang<T>(lang: Lang, values: Record<Lang, T>): T {
  return values[lang];
}

export function buildPanicVoiceOutText(panicId: PanicScenarioId, lang: Lang): string {
  const ru: Record<PanicScenarioId, string> = {
    1: "Я рядом. Сейчас позвоните в банк по официальному номеру и скажите: я сообщил SMS-код, заблокируйте карту и онлайн-банк. После звонка смените пароли с другого устройства.",
    2: "Я рядом. Включите авиарежим прямо сейчас. Удалите подозрительное приложение, а банк проверьте с другого телефона. Если приложение просило доступ к SMS, считайте риск высоким.",
    3: "Я рядом. Позвоните в банк и попросите заморозить или оспорить перевод. Не делайте возвратный перевод. Сохраните чек, чат и время операции.",
    4: "Я рядом. Заблокируйте карту немедленно, даже если списаний пока нет. Проверьте операции и смените пароль банка с другого устройства.",
    5: "Я рядом. Зайдите в Telegram с другого устройства, завершите неизвестные сеансы и включите двухэтапный пароль. Предупредите близких, что от вашего имени могут просить деньги.",
    6: "Я рядом. Завершите звонок одной фразой: я сам перезвоню по официальному номеру. Не называйте код, PIN, CVV, пароль или данные карты.",
    7: "Я рядом. Не платите и не отправляйте новые фото или видео. Сохраните доказательства, заблокируйте угрожающего и позовите взрослого или близкого человека.",
    8: "Я рядом. Остановите переводы и не берите кредиты в переписке. Попросите близкого посмотреть переписку со стороны и проверьте фото через обратный поиск.",
    9: "Я рядом. Не платите за удаление публикации: это часто приводит к новым требованиям. Сохраните доказательства, заблокируйте угрожающего и обратитесь в поддержку платформы.",
    10: "Я рядом. Ты не виноват или не виновата. Ничего не отправляй и не плати. Покажи переписку взрослому, которому доверяешь.",
    11: "Я рядом. Не отправляйте деньги только потому, что голос похож на близкого. Завершите звонок и перезвоните человеку по сохранённому номеру.",
    12: "Я рядом. Не платите за трудоустройство, форму, обучение или активацию. Не отправляйте паспорт и карту. Сохраните переписку и проверьте работодателя отдельно.",
    13: "Я рядом. Не оплачивайте доставку или пополнение по ссылке из сообщения. Откройте сервис вручную через официальное приложение или сайт.",
    14: "Я рядом. Не подключайте кошелёк, не вводите seed-фразу и не платите комиссию за подарок или вывод. Закройте страницу и сохраните скрин.",
    15: "Я рядом. Госвыплаты и гранты не оформляют через случайные чаты. Не вводите карту, паспорт или код. Проверяйте только через официальный сайт или приложение.",
  };

  const uz: Record<PanicScenarioId, string> = {
    1: "Men yoningizdaman. Bankka rasmiy raqam orqali qo'ng'iroq qiling: SMS-kod berdim, karta va onlayn-bankni bloklang. Keyin parollarni boshqa qurilmadan almashtiring.",
    2: "Men yoningizdaman. Hozir aviаrejimni yoqing. Shubhali ilovani o'chiring va bankni boshqa telefondan tekshiring.",
    3: "Men yoningizdaman. Bankka qo'ng'iroq qilib o'tkazmani muzlatish yoki qaytarishni so'rang. Qaytarish uchun yana pul yubormang.",
    4: "Men yoningizdaman. Kartani darhol bloklang. Operatsiyalarni tekshiring va bank parolini boshqa qurilmadan almashtiring.",
    5: "Men yoningizdaman. Telegramga boshqa qurilmadan kiring, noma'lum seanslarni tugating va ikki bosqichli parolni yoqing.",
    6: "Men yoningizdaman. Qo'ng'iroqni tugating: men o'zim rasmiy raqamga qayta qo'ng'iroq qilaman. Kod, PIN, CVV yoki karta ma'lumotini aytmang.",
    7: "Men yoningizdaman. Pul to'lamang va yangi foto yoki video yubormang. Dalillarni saqlang va ishonchli kattani chaqiring.",
    8: "Men yoningizdaman. Pul yuborishni to'xtating va kredit olmang. Yaqiningizdan yozishmani chetdan ko'rib berishni so'rang.",
    9: "Men yoningizdaman. Nashrni o'chirish uchun pul to'lamang. Dalillarni saqlang, tahdid qiluvchini bloklang va platforma yordamiga yozing.",
    10: "Men yoningizdaman. Sen aybdor emassan. Hech narsa yuborma va to'lama. Yozishmani ishonchli kattaga ko'rsat.",
    11: "Men yoningizdaman. Ovoz yaqin insonnikiga o'xshasa ham, pul yubormang. Qo'ng'iroqni tugating va saqlangan raqamga qayta qo'ng'iroq qiling.",
    12: "Men yoningizdaman. Ishga kirish, forma, o'qish yoki aktivatsiya uchun pul to'lamang. Pasport va karta yubormang.",
    13: "Men yoningizdaman. Yetkazib berish yoki to'ldirishni xabardagi havola orqali to'lamang. Servisni rasmiy ilova yoki sayt orqali oching.",
    14: "Men yoningizdaman. Wallet ulamang, seed-frazani kiritmang va sovg'a yoki yechish uchun komissiya to'lamang.",
    15: "Men yoningizdaman. Davlat to'lovi yoki grant tasodifiy chat orqali rasmiylashtirilmaydi. Karta, pasport yoki kod kiritmang.",
  };

  const en: Record<PanicScenarioId, string> = {
    1: "I am with you. Call the bank on an official number and say: I shared an SMS code, please block my card and online banking. Then change passwords from another device.",
    2: "I am with you. Turn on airplane mode now. Remove the suspicious app and check the bank from another phone. Treat SMS access as high risk.",
    3: "I am with you. Call the bank and ask to freeze or dispute the transfer. Do not make a return transfer. Save the receipt and chat.",
    4: "I am with you. Block the card immediately, even if no money is gone yet. Check transactions and change the bank password from another device.",
    5: "I am with you. Open Telegram from another device, terminate unknown sessions and enable two-step verification. Warn close contacts.",
    6: "I am with you. End the call with one phrase: I will call back using the official number. Do not say codes, PIN, CVV, password or card data.",
    7: "I am with you. Do not pay and do not send new photos or videos. Save evidence, block the threat, and call a trusted adult or close person.",
    8: "I am with you. Stop transfers and do not take loans in chat. Ask someone trusted to review the conversation and check photos separately.",
    9: "I am with you. Do not pay to remove a publication; that often leads to more demands. Save evidence, block the threat and contact platform support.",
    10: "I am with you. You are not at fault. Send nothing and pay nothing. Show the conversation to a trusted adult.",
    11: "I am with you. Do not send money just because the voice sounds familiar. End the call and call the person back using a saved number.",
    12: "I am with you. Do not pay for a job, uniform, training or activation. Do not send passport or card data. Verify the employer separately.",
    13: "I am with you. Do not pay delivery or top-up through a message link. Open the service manually through the official app or website.",
    14: "I am with you. Do not connect a wallet, enter a seed phrase, or pay a fee for a gift or withdrawal. Close the page and save a screenshot.",
    15: "I am with you. Government benefits and grants are not arranged through random chats. Do not enter card, passport or code data.",
  };

  return textByLang(lang, { ru, uz, en })[panicId];
}

export function buildGuardianVoiceOutText(
  snapshot: VoiceOutGuardianSnapshot | undefined,
  lang: Lang,
): string | null {
  if (!snapshot) return null;
  const reasons = new Set(snapshot.reasons);
  if (
    snapshot.type === "apk" ||
    reasons.has("asks_to_install_apk") ||
    reasons.has("apk_download_link")
  ) {
    return textByLang(lang, {
      ru: "Я рядом. Сначала изолируйте телефон: включите авиарежим. Затем с другого устройства проверьте банк и смените пароли.",
      uz: "Men yoningizdaman. Avval telefonni ajrating: aviаrejimni yoqing. Keyin bankni boshqa qurilmadan tekshiring va parollarni almashtiring.",
      en: "I am with you. First isolate the phone: turn on airplane mode. Then check the bank and change passwords from another device.",
    });
  }
  if (
    reasons.has("asks_for_sms_code") ||
    reasons.has("asks_for_otp") ||
    reasons.has("impersonates_bank")
  ) {
    return textByLang(lang, {
      ru: "Я рядом. Не называйте код. Завершите разговор и перезвоните в банк только по номеру из приложения, карты или официального сайта.",
      uz: "Men yoningizdaman. Kod aytmang. Suhbatni tugating va bankka faqat ilova, karta yoki rasmiy saytdagi raqam orqali qo'ng'iroq qiling.",
      en: "I am with you. Do not say the code. End the conversation and call the bank only through the app, card, or official website.",
    });
  }
  if (snapshot.type === "payment" || reasons.has("payment_before_service")) {
    return textByLang(lang, {
      ru: "Я рядом. Остановите перевод и не отправляйте деньги повторно. Позвоните в банк по официальному номеру и сохраните доказательства.",
      uz: "Men yoningizdaman. O'tkazmani to'xtating va qayta pul yubormang. Bankka rasmiy raqam orqali qo'ng'iroq qiling va dalillarni saqlang.",
      en: "I am with you. Stop the transfer and do not send money again. Call the bank on an official number and save evidence.",
    });
  }
  return textByLang(lang, {
    ru: "Я рядом. Остановитесь на минуту: не отправляйте код, карту, деньги, файлы или пароль. Сохраните переписку и выберите один безопасный шаг.",
    uz: "Men yoningizdaman. Bir daqiqaga to'xtang: kod, karta, pul, fayl yoki parol yubormang. Yozishmani saqlang va bitta xavfsiz qadamni tanlang.",
    en: "I am with you. Pause for a minute: do not send codes, card data, money, files, or passwords. Save the chat and take one safe step.",
  });
}

function isGeminiLikeBaseUrl(baseUrl: string): boolean {
  return /generativelanguage\.googleapis\.com|googleapis\.com\/.*\/openai/i.test(baseUrl);
}

function resolveTtsConfig(): TtsConfig | null {
  const explicitKey = process.env.OPENAI_TTS_API_KEY?.trim();
  if (explicitKey) {
    return {
      apiKey: explicitKey,
      baseUrl: (process.env.OPENAI_TTS_BASE_URL ?? DEFAULT_TTS_BASE_URL).replace(/\/+$/, ""),
      model: process.env.OPENAI_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL,
      voice: process.env.OPENAI_TTS_VOICE?.trim() || DEFAULT_TTS_VOICE,
    };
  }

  const sharedKey = process.env.OPENAI_API_KEY?.trim();
  const sharedBase = (process.env.OPENAI_BASE_URL ?? DEFAULT_TTS_BASE_URL).replace(/\/+$/, "");
  if (!sharedKey || isGeminiLikeBaseUrl(sharedBase)) return null;

  return {
    apiKey: sharedKey,
    baseUrl: sharedBase,
    model: process.env.OPENAI_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL,
    voice: process.env.OPENAI_TTS_VOICE?.trim() || DEFAULT_TTS_VOICE,
  };
}

function safeSpeechInput(text: string): string | null {
  const cleaned = text
    .normalize("NFKC")
    .replace(/https?:\/\/\S+|www\.\S+/gi, "ссылка скрыта")
    .replace(/@[A-Za-z0-9_]{3,}/g, "аккаунт скрыт")
    .replace(/\b(?:\d[\s-]?){4,}\b/g, "номер скрыт")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TTS_CHARS);

  if (!cleaned) return null;
  if (/(sms|смс|код|code|pin|cvv|парол|password).{0,20}\d{3,}/i.test(cleaned)) return null;
  return cleaned;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: init.signal ?? controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function claimVoiceOutBudget(userId: number): Promise<VoiceOutResult | null> {
  const result = await checkSharedRateLimit(
    "check",
    `voice-out:tg:${userId}`,
    VOICE_OUT_DAILY_LIMIT,
    VOICE_OUT_WINDOW_MS,
  );
  if (result.ok) return null;
  return { ok: false, reason: "rate_limited", retryAfterSec: result.retryAfterSec };
}

export async function synthesizeVoiceOut(text: string, userId: number): Promise<VoiceOutResult> {
  const budget = await claimVoiceOutBudget(userId);
  if (budget) return budget;

  const input = safeSpeechInput(text);
  if (!input) return { ok: false, reason: "unsafe_text" };

  const cfg = resolveTtsConfig();
  if (!cfg) return { ok: false, reason: "not_configured" };

  try {
    const res = await fetchWithTimeout(
      `${cfg.baseUrl}/audio/speech`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: cfg.model,
          voice: cfg.voice,
          input,
          response_format: "mp3",
        }),
      },
      VOICE_OUT_TIMEOUT_MS,
    );
    if (!res.ok) {
      console.error("voice-out TTS provider non-ok", res.status);
      return { ok: false, reason: "provider_error" };
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_AUDIO_BYTES) {
      return { ok: false, reason: "provider_error" };
    }
    return {
      ok: true,
      bytes: new Uint8Array(buffer),
      mimeType: "audio/mpeg",
      filename: "ishonch-guard-voice.mp3",
    };
  } catch (error) {
    console.error("voice-out TTS failed", error instanceof Error ? error.message : "unknown");
    return { ok: false, reason: "provider_error" };
  }
}

export function buildVoiceOutFallbackText(
  lang: Lang,
  result: Exclude<VoiceOutResult, { ok: true }>,
): string {
  if (result.reason === "rate_limited") {
    return textByLang(lang, {
      ru: "🔊 Голосовые подсказки на сегодня закончились. Я всё равно рядом: читайте короткий текст и нажимайте кнопки ниже.",
      uz: "🔊 Bugungi ovozli maslahatlar limiti tugadi. Men baribir yoningizdaman: qisqa matnni o'qing va pastdagi tugmalarni bosing.",
      en: "🔊 Voice tips are used up for today. I am still here: read the short text and use the buttons below.",
    });
  }
  if (result.reason === "not_configured") {
    return textByLang(lang, {
      ru: "🔊 Голосовой ответ пока не подключён на сервере. Текстовая подсказка выше остаётся безопасной и актуальной.",
      uz: "🔊 Serverda ovozli javob hali ulanmagan. Yuqoridagi matnli maslahat xavfsiz va dolzarb.",
      en: "🔊 Voice reply is not enabled on the server yet. The text guidance above is still safe and current.",
    });
  }
  return textByLang(lang, {
    ru: "🔊 Сейчас не удалось отправить голосовой ответ. Не ждите: выполните безопасный шаг из текста выше.",
    uz: "🔊 Hozir ovozli javob yuborilmadi. Kutmang: yuqoridagi xavfsiz qadamni bajaring.",
    en: "🔊 I could not send the voice reply right now. Do not wait: follow the safe step above.",
  });
}

export async function sendVoiceOutResponse(args: {
  chatId: number;
  userId: number;
  lang: Lang;
  text: string | null;
  keyboard?: InlineKeyboard;
}): Promise<void> {
  if (!args.text) {
    await sendMessage({
      chatId: args.chatId,
      text: escapeMarkdownV2(
        textByLang(args.lang, {
          ru: "Сейчас нет безопасного контекста для голосовой подсказки. Откройте /panic или пришлите сообщение на проверку.",
          uz: "Hozir ovozli maslahat uchun xavfsiz kontekst yo'q. /panic ni oching yoki xabar yuboring.",
          en: "There is no safe context for a voice tip right now. Open /panic or send a message to check.",
        }),
      ),
    });
    return;
  }

  const result = await synthesizeVoiceOut(args.text, args.userId);
  if (result.ok) {
    const sent = await sendAudioFile({
      chatId: args.chatId,
      audio: result.bytes,
      filename: result.filename,
      mimeType: result.mimeType,
      title: "Ishonch Guard",
      performer: "Ishonch Guard",
      caption: escapeMarkdownV2(
        textByLang(args.lang, {
          ru: "🔊 Короткая голосовая подсказка. Коды, карты и пароли я не озвучиваю.",
          uz: "🔊 Qisqa ovozli maslahat. Kod, karta va parollarni ovozda aytmayman.",
          en: "🔊 Short voice tip. I do not read codes, cards, or passwords aloud.",
        }),
      ),
      keyboard: args.keyboard,
    });
    if (sent.ok) return;
  }

  await sendMessage({
    chatId: args.chatId,
    text: escapeMarkdownV2(buildVoiceOutFallbackText(args.lang, result)),
    keyboard: args.keyboard,
  });
}
