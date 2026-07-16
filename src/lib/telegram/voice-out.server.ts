import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { checkSharedRateLimit } from "@/lib/risk/shared-rate-limit.server";
import type { InputType } from "@/lib/risk/detect";
import type { ReasonCode } from "@/lib/risk/rules";
import type { Lang } from "@/lib/i18n";
import {
  answerCallbackQuery,
  escapeMarkdownV2,
  sendAudioFile,
  sendChatAction,
  sendMessage,
  type InlineKeyboard,
} from "@/lib/telegram/api.server";
import type { EmergencyFollowUpAction } from "@/lib/telegram/emergency";

export const VOICE_OUT_CB = {
  panic: "voiceout:panic",
  guardian: "voiceout:guardian",
} as const;

export type VoiceOutAction = (typeof VOICE_OUT_CB)[keyof typeof VOICE_OUT_CB];

type PanicScenarioId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export interface ParsedVoiceOutPanicCallback {
  panicId: PanicScenarioId | null;
  action: EmergencyFollowUpAction | null;
}

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

type OpenAiTtsConfig = {
  provider: "openai";
  apiKey: string;
  baseUrl: string;
  model: string;
  voice: string;
};

type GeminiTtsConfig = {
  provider: "gemini";
  apiKey: string;
  model: string;
  voice: string;
};

type TtsConfig = OpenAiTtsConfig | GeminiTtsConfig;

export type VoiceOutPrerecordedRef = {
  kind: "panic";
  panicId: PanicScenarioId;
};

const VOICE_OUT_DAILY_LIMIT = 5;
const VOICE_OUT_WINDOW_MS = 24 * 60 * 60 * 1000;
const VOICE_OUT_TIMEOUT_MS = 12_000;
const VOICE_OUT_DUPLICATE_WINDOW_MS = 10 * 60_000;
const MAX_TTS_CHARS = 520;
const MAX_AUDIO_BYTES = 1_500_000;
const DEFAULT_TTS_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_TTS_VOICE = "alloy";
const DEFAULT_GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
const DEFAULT_GEMINI_TTS_VOICE = "Kore";
const DEFAULT_PRERECORDED_VOICE_OUT_DIR = path.join("public", "audio", "voice-out");
const PRERECORDED_VOICE_EXTENSIONS = [
  { ext: "ogg", mimeType: "audio/ogg" },
  { ext: "oga", mimeType: "audio/ogg" },
  { ext: "mp3", mimeType: "audio/mpeg" },
  { ext: "wav", mimeType: "audio/wav" },
] as const;
const recentVoiceOutRequests = new Map<string, number>();
const VOICE_OUT_PANIC_ACTIONS: readonly EmergencyFollowUpAction[] = [
  "more",
  "contacts",
  "script",
  "trusted_person",
  "full",
];

export function parseVoiceOutCallback(data: string): VoiceOutAction | null {
  if (data === VOICE_OUT_CB.guardian) return VOICE_OUT_CB.guardian;
  if (parseVoiceOutPanicCallback(data) !== null) return VOICE_OUT_CB.panic;
  return null;
}

export function parseVoiceOutPanicCallback(data: string): ParsedVoiceOutPanicCallback | null {
  if (data === VOICE_OUT_CB.panic) return { panicId: null, action: null };

  const prefix = `${VOICE_OUT_CB.panic}:`;
  if (!data.startsWith(prefix)) return null;

  const parts = data.slice(prefix.length).split(":");
  if (parts.length < 1 || parts.length > 2) return null;

  const n = Number(parts[0]);
  const panicId = Number.isInteger(n) && n >= 1 && n <= 15 ? (n as PanicScenarioId) : null;
  if (panicId === null) return null;

  if (parts.length === 1) return { panicId, action: null };

  const action = parts[1] as EmergencyFollowUpAction;
  return VOICE_OUT_PANIC_ACTIONS.includes(action) ? { panicId, action } : null;
}

export function parseVoiceOutPanicId(data: string): PanicScenarioId | null {
  return parseVoiceOutPanicCallback(data)?.panicId ?? null;
}

export function parseVoiceOutPanicAction(data: string): EmergencyFollowUpAction | null {
  return parseVoiceOutPanicCallback(data)?.action ?? null;
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

function resolveTtsConfigs(): TtsConfig[] {
  const configs: TtsConfig[] = [];
  const geminiKey =
    process.env.GEMINI_TTS_API_KEY?.trim() ||
    process.env.GOOGLE_TTS_API_KEY?.trim() ||
    process.env["Gemini TTS"]?.trim();
  if (geminiKey) {
    configs.push({
      provider: "gemini",
      apiKey: geminiKey,
      model: process.env.GEMINI_TTS_MODEL?.trim() || DEFAULT_GEMINI_TTS_MODEL,
      voice: process.env.GEMINI_TTS_VOICE?.trim() || DEFAULT_GEMINI_TTS_VOICE,
    });
  }

  const explicitKey = process.env.OPENAI_TTS_API_KEY?.trim();
  if (explicitKey) {
    configs.push({
      provider: "openai",
      apiKey: explicitKey,
      baseUrl: (process.env.OPENAI_TTS_BASE_URL ?? DEFAULT_TTS_BASE_URL).replace(/\/+$/, ""),
      model: process.env.OPENAI_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL,
      voice: process.env.OPENAI_TTS_VOICE?.trim() || DEFAULT_TTS_VOICE,
    });
    return orderTtsConfigs(configs);
  }

  const sharedKey = process.env.OPENAI_API_KEY?.trim();
  const sharedBase = (process.env.OPENAI_BASE_URL ?? DEFAULT_TTS_BASE_URL).replace(/\/+$/, "");
  if (!sharedKey || isGeminiLikeBaseUrl(sharedBase)) return orderTtsConfigs(configs);

  configs.push({
    provider: "openai",
    apiKey: sharedKey,
    baseUrl: sharedBase,
    model: process.env.OPENAI_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL,
    voice: process.env.OPENAI_TTS_VOICE?.trim() || DEFAULT_TTS_VOICE,
  });

  return orderTtsConfigs(configs);
}

function orderTtsConfigs(configs: TtsConfig[]): TtsConfig[] {
  const preferred = (process.env.TTS_PROVIDER || process.env.VOICE_OUT_TTS_PROVIDER || "")
    .trim()
    .toLowerCase();
  if (preferred === "openai") {
    return [...configs].sort(
      (a, b) => Number(b.provider === "openai") - Number(a.provider === "openai"),
    );
  }
  if (preferred === "gemini") {
    return [...configs].sort(
      (a, b) => Number(b.provider === "gemini") - Number(a.provider === "gemini"),
    );
  }
  return configs;
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

function voiceOutRequestKey(chatId: number, userId: number, text: string): string {
  const normalized = (safeSpeechInput(text) ?? text).normalize("NFKC").slice(0, MAX_TTS_CHARS);
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (Math.imul(hash, 31) + normalized.charCodeAt(i)) | 0;
  }
  return `${chatId}:${userId}:${hash}`;
}

function isDuplicateVoiceOutRequest(key: string, now = Date.now()): boolean {
  for (const [candidate, timestamp] of recentVoiceOutRequests) {
    if (now - timestamp > VOICE_OUT_DUPLICATE_WINDOW_MS) recentVoiceOutRequests.delete(candidate);
  }

  const previous = recentVoiceOutRequests.get(key);
  if (previous !== undefined && now - previous <= VOICE_OUT_DUPLICATE_WINDOW_MS) {
    return true;
  }
  recentVoiceOutRequests.set(key, now);
  return false;
}

function releaseVoiceOutRequest(key: string): void {
  recentVoiceOutRequests.delete(key);
}

function prerecordedVoiceOutBaseDir(): string {
  const configured = process.env.VOICE_OUT_PRERECORDED_DIR?.trim();
  return configured ? configured : path.join(process.cwd(), DEFAULT_PRERECORDED_VOICE_OUT_DIR);
}

async function loadPrerecordedVoiceOut(
  ref: VoiceOutPrerecordedRef | undefined,
  lang: Lang,
): Promise<VoiceOutResult | null> {
  if (!ref) return null;

  for (const candidate of PRERECORDED_VOICE_EXTENSIONS) {
    const filename = `${ref.kind}-${ref.panicId}-${lang}.${candidate.ext}`;
    const filePath = path.join(prerecordedVoiceOutBaseDir(), filename);
    try {
      const info = await stat(filePath);
      if (!info.isFile() || info.size <= 0 || info.size > MAX_AUDIO_BYTES) continue;

      const bytes = await readFile(filePath);
      return {
        ok: true,
        bytes: new Uint8Array(bytes),
        mimeType: candidate.mimeType,
        filename,
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") continue;
      console.error("voice-out prerecorded load failed", filename, code ?? "unknown");
    }
  }

  return null;
}

function buildVoiceOutPreparingText(lang: Lang): string {
  return textByLang(lang, {
    ru: "Готовлю короткую голосовую подсказку...",
    uz: "Qisqa ovozli maslahat tayyorlanmoqda...",
    en: "Preparing a short voice tip...",
  });
}

function buildVoiceOutDuplicateText(lang: Lang): string {
  return textByLang(lang, {
    ru: "Голосовая подсказка уже готовится или недавно отправлена.",
    uz: "Ovozli maslahat allaqachon tayyorlanmoqda yoki yaqinda yuborilgan.",
    en: "The voice tip is already being prepared or was sent recently.",
  });
}

async function sendVoiceOutChatAction(chatId: number): Promise<void> {
  try {
    await sendChatAction(chatId, "upload_voice");
  } catch {
    // Best-effort UX hint only; voice generation should continue if Telegram ignores it.
  }
}

function buildVoiceOutCaption(lang: Lang, text: string): string {
  const preview = safeSpeechInput(text);
  if (!preview) {
    return textByLang(lang, {
      ru: "🔊 Короткая голосовая подсказка. Коды, карты и пароли я не озвучиваю.",
      uz: "🔊 Qisqa ovozli maslahat. Kod, karta va parollarni ovozda aytmayman.",
      en: "🔊 Short voice tip. I do not read codes, cards, or passwords aloud.",
    });
  }

  const clipped = preview.length > 220 ? `${preview.slice(0, 217)}...` : preview;
  return textByLang(lang, {
    ru: `🔊 Голосом: «${clipped}»\n\nКоды, карты и пароли я не озвучиваю.`,
    uz: `🔊 Ovozda: «${clipped}»\n\nKod, karta va parollarni ovozda aytmayman.`,
    en: `🔊 Voice tip: "${clipped}"\n\nI do not read codes, cards, or passwords aloud.`,
  });
}

function isProviderOnlyVoiceOutCallback(callbackData: string | undefined): boolean {
  if (!callbackData) return false;
  if (callbackData === VOICE_OUT_CB.guardian) return true;
  const panicCallback = parseVoiceOutPanicCallback(callbackData);
  return panicCallback !== null && panicCallback.action !== null;
}

function withoutProviderOnlyVoiceOutButtons(
  keyboard: InlineKeyboard | undefined,
): InlineKeyboard | undefined {
  if (!keyboard) return undefined;
  const filtered = keyboard
    .map((row) => row.filter((button) => !isProviderOnlyVoiceOutCallback(button.callback_data)))
    .filter((row) => row.length > 0);
  return filtered.length > 0 ? filtered : undefined;
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

async function synthesizeOpenAiSpeech(
  cfg: OpenAiTtsConfig,
  input: string,
): Promise<VoiceOutResult> {
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
      console.error("voice-out TTS provider non-ok", cfg.provider, res.status);
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
  } catch {
    console.error("voice-out TTS failed", cfg.provider, "provider_exception");
    return { ok: false, reason: "provider_error" };
  }
}

function parseGeminiPcmMime(mimeType: string): { sampleRate: number; channels: number } {
  const rate = Number(mimeType.match(/\brate=(\d+)/i)?.[1] || 24_000);
  const channels = Number(mimeType.match(/\bchannels=(\d+)/i)?.[1] || 1);
  return {
    sampleRate: Number.isFinite(rate) && rate > 0 ? rate : 24_000,
    channels: Number.isFinite(channels) && channels > 0 ? channels : 1,
  };
}

function pcm16ToWav(pcm: Uint8Array, sampleRate: number, channels: number): Uint8Array {
  const headerSize = 44;
  const bytesPerSample = 2;
  const wav = new Uint8Array(headerSize + pcm.byteLength);
  const view = new DataView(wav.buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) wav[offset + i] = value.charCodeAt(i);
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  wav.set(pcm, headerSize);
  return wav;
}

async function synthesizeGeminiSpeech(
  cfg: GeminiTtsConfig,
  input: string,
): Promise<VoiceOutResult> {
  try {
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        cfg.model,
      )}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": cfg.apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: input }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: cfg.voice,
                },
              },
            },
          },
        }),
      },
      VOICE_OUT_TIMEOUT_MS,
    );
    if (!res.ok) {
      console.error("voice-out TTS provider non-ok", cfg.provider, res.status);
      return { ok: false, reason: "provider_error" };
    }

    const json = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { data?: string; mimeType?: string };
            inline_data?: { data?: string; mime_type?: string };
          }>;
        };
      }>;
    };
    const part = json.candidates?.[0]?.content?.parts?.find(
      (candidate) => candidate.inlineData?.data || candidate.inline_data?.data,
    );
    const encoded = part?.inlineData?.data || part?.inline_data?.data;
    const mimeType = part?.inlineData?.mimeType || part?.inline_data?.mime_type || "";
    if (!encoded || !mimeType.includes("audio")) return { ok: false, reason: "provider_error" };

    const raw = new Uint8Array(Buffer.from(encoded, "base64"));
    if (raw.byteLength === 0 || raw.byteLength > MAX_AUDIO_BYTES) {
      return { ok: false, reason: "provider_error" };
    }

    if (/audio\/l16/i.test(mimeType)) {
      const { sampleRate, channels } = parseGeminiPcmMime(mimeType);
      const wav = pcm16ToWav(raw, sampleRate, channels);
      if (wav.byteLength > MAX_AUDIO_BYTES) return { ok: false, reason: "provider_error" };
      return {
        ok: true,
        bytes: wav,
        mimeType: "audio/wav",
        filename: "ishonch-guard-voice.wav",
      };
    }

    return {
      ok: true,
      bytes: raw,
      mimeType,
      filename: "ishonch-guard-voice.audio",
    };
  } catch {
    console.error("voice-out TTS failed", cfg.provider, "provider_exception");
    return { ok: false, reason: "provider_error" };
  }
}

async function synthesizeWithConfig(cfg: TtsConfig, input: string): Promise<VoiceOutResult> {
  if (cfg.provider === "gemini") return synthesizeGeminiSpeech(cfg, input);
  return synthesizeOpenAiSpeech(cfg, input);
}

export async function synthesizeVoiceOut(text: string, userId: number): Promise<VoiceOutResult> {
  const input = safeSpeechInput(text);
  if (!input) return { ok: false, reason: "unsafe_text" };

  const budget = await claimVoiceOutBudget(userId);
  if (budget) return budget;

  const configs = resolveTtsConfigs();
  if (configs.length === 0) return { ok: false, reason: "not_configured" };

  for (const cfg of configs) {
    const result = await synthesizeWithConfig(cfg, input);
    if (result.ok) return result;
  }

  return { ok: false, reason: "provider_error" };
}

export function buildVoiceOutFallbackText(
  lang: Lang,
  result: Exclude<VoiceOutResult, { ok: true }>,
): string {
  if (result.reason === "rate_limited") {
    return textByLang(lang, {
      ru: "🔊 На сегодня голосовые подсказки закончились. Это не страшно — главное уже в тексте выше. Спокойно выполните первый шаг.",
      uz: "🔊 Bugungi ovozli maslahatlar tugadi. Bu qo'rqinchli emas — eng muhimi yuqoridagi matnda. Birinchi qadamni xotirjam bajaring.",
      en: "🔊 Voice tips are used up for today. That's okay — the key part is already in the text above. Calmly do the first step.",
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
    ru: "🔊 Голос сейчас недоступен. Это не страшно — главное уже в тексте выше. Спокойно выполните первый шаг.",
    uz: "🔊 Ovoz hozir mavjud emas. Bu qo'rqinchli emas — eng muhimi yuqoridagi matnda. Birinchi qadamni xotirjam bajaring.",
    en: "🔊 Voice is unavailable right now. That's okay — the key part is already in the text above. Calmly do the first step.",
  });
}

export async function sendVoiceOutResponse(args: {
  chatId: number;
  userId: number;
  lang: Lang;
  text: string | null;
  keyboard?: InlineKeyboard;
  callbackQueryId?: string;
  prerecorded?: VoiceOutPrerecordedRef;
}): Promise<{ messageId?: number }> {
  if (!args.text) {
    if (args.callbackQueryId !== undefined) {
      await answerCallbackQuery(args.callbackQueryId);
    }
    const delivery = await sendMessage({
      chatId: args.chatId,
      text: escapeMarkdownV2(
        textByLang(args.lang, {
          ru: "Сейчас нет безопасного контекста для голосовой подсказки. Откройте /panic или пришлите сообщение на проверку.",
          uz: "Hozir ovozli maslahat uchun xavfsiz kontekst yo'q. /panic ni oching yoki xabar yuboring.",
          en: "There is no safe context for a voice tip right now. Open /panic or send a message to check.",
        }),
      ),
    });
    return delivery.messageId === undefined ? {} : { messageId: delivery.messageId };
  }

  const duplicateKey = voiceOutRequestKey(args.chatId, args.userId, args.text);
  if (isDuplicateVoiceOutRequest(duplicateKey)) {
    if (args.callbackQueryId !== undefined) {
      await answerCallbackQuery(args.callbackQueryId, buildVoiceOutDuplicateText(args.lang));
    }
    return {};
  }

  if (args.callbackQueryId !== undefined) {
    await answerCallbackQuery(args.callbackQueryId, buildVoiceOutPreparingText(args.lang));
  }

  await sendVoiceOutChatAction(args.chatId);

  let result = await loadPrerecordedVoiceOut(args.prerecorded, args.lang);
  result ??= await synthesizeVoiceOut(args.text, args.userId);
  if (result.ok) {
    const sent = await sendAudioFile({
      chatId: args.chatId,
      audio: result.bytes,
      filename: result.filename,
      mimeType: result.mimeType,
      title: "Ishonch Guard",
      performer: "Ishonch Guard",
      caption: escapeMarkdownV2(buildVoiceOutCaption(args.lang, args.text)),
      keyboard: args.keyboard,
    });
    if (sent.ok) return sent.messageId === undefined ? {} : { messageId: sent.messageId };
  }

  releaseVoiceOutRequest(duplicateKey);

  const fallbackResult: Exclude<VoiceOutResult, { ok: true }> = result.ok
    ? { ok: false, reason: "provider_error" }
    : result;

  const fallbackDelivery = await sendMessage({
    chatId: args.chatId,
    text: escapeMarkdownV2(buildVoiceOutFallbackText(args.lang, fallbackResult)),
    keyboard:
      fallbackResult.reason === "rate_limited"
        ? withoutProviderOnlyVoiceOutButtons(args.keyboard)
        : args.keyboard,
  });
  return fallbackDelivery.messageId === undefined ? {} : { messageId: fallbackDelivery.messageId };
}
