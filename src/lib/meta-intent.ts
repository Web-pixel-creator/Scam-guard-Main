import type { Lang } from "@/lib/i18n";
import { bt } from "@/lib/telegram/bot-i18n";

export type MetaIntent =
  | "how_to_use"
  | "what_can_you_do"
  | "how_do_you_check"
  | "why_failed"
  | "explain_risk"
  | "help";

export interface ClassifyMetaIntentOptions {
  isForwarded?: boolean;
}

type IntentPattern = {
  intent: MetaIntent;
  patterns: RegExp[];
};

export const ALL_META_INTENTS: readonly MetaIntent[] = [
  "how_to_use",
  "what_can_you_do",
  "how_do_you_check",
  "why_failed",
  "explain_risk",
  "help",
] as const;

export const CANONICAL_META_PHRASES: ReadonlyArray<{ intent: MetaIntent; text: string }> = [
  { intent: "how_to_use", text: "как пользоваться ботом" },
  { intent: "how_to_use", text: "как отправить скриншот" },
  { intent: "how_to_use", text: "how to use this bot" },
  { intent: "how_to_use", text: "qanday foydalanaman" },
  { intent: "what_can_you_do", text: "что ты умеешь" },
  { intent: "what_can_you_do", text: "какие функции есть" },
  { intent: "what_can_you_do", text: "what can you do" },
  { intent: "what_can_you_do", text: "nima qila olasan" },
  { intent: "how_do_you_check", text: "как проверить номер" },
  { intent: "how_do_you_check", text: "как ты решаешь" },
  { intent: "how_do_you_check", text: "how do you check" },
  { intent: "how_do_you_check", text: "qanday tekshirasan" },
  { intent: "why_failed", text: "почему ты не смог проанализировать картинку" },
  { intent: "why_failed", text: "почему не распознал фото" },
  { intent: "why_failed", text: "why could not analyze the image" },
  { intent: "why_failed", text: "nega rasmni o'qiy olmading" },
  { intent: "explain_risk", text: "почему это опасно" },
  { intent: "explain_risk", text: "почему высокий риск" },
  { intent: "explain_risk", text: "why is it dangerous" },
  { intent: "explain_risk", text: "nega bu xavfli" },
  { intent: "help", text: "помощь" },
  { intent: "help", text: "help" },
  { intent: "help", text: "yordam" },
] as const;

const URL_RE =
  /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:uz|com|net|org|ru|io|app|site|info|me|online|xyz|top|shop|click|bank)\b)/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/;
const TELEGRAM_RE = /(?:t\.me\/|telegram\.me\/|@[a-zA-Z0-9_]{3,})/i;
const APK_RE = /(?:apk|android package|андроид\s*прилож|приложени[ея]|ilova|dastur)/i;
const BANK_PAYMENT_RE =
  /(?:банк|банка|bank|karta|карта|plastik|cvv|cvc|pin|пин|otp|sms[\s-]?(?:код|kod)|смс[\s-]?код|код\s+из\s+смс|парол[ья]|password|перевод|перевести|pul|to'?lov|o'?tkazma|transfer|payme|click|uzcard|humo|kapitalbank|ipoteka|hamkorbank|xavfsizlik|безопасн)/i;
const LONG_TEXT_LIMIT = 200;

const SCAM_WORDING_PATTERNS: readonly RegExp[] = [
  /безопасн[а-яё]*\s+сч[её]т/i,
  /не\s+кладите\s+трубку/i,
  /не\s+отключайтесь/i,
  /служб[аы]\s+безопасности/i,
  /xavfsiz\s+hisob/i,
  /go['‘’`]?shakni\s+qo['‘’`]?ymang/i,
  /safe\s+account/i,
  /do\s+not\s+hang\s+up/i,
];

const INTENT_PATTERNS: readonly IntentPattern[] = [
  {
    intent: "why_failed",
    patterns: [
      /почему\s+(?:ты\s+)?не\s+смог/i,
      /(?:не\s+смог|не\s+смогла|не\s+получилось)\s+.*(?:проанализ|распозна|прочита|картин|фото|скрин|qr)/i,
      /почему\s+.*(?:картин|фото|скрин|qr)\s+.*(?:не\s+понял|не\s+прочитал|не\s+распознал)/i,
      /почему\s+.*(?:не\s+понял|не\s+прочитал|не\s+распознал)\s+.*(?:картин|фото|скрин|qr)/i,
      /why\s+(?:could(?:n'?t| not)|did(?:n'?t| not))\s+.*(?:analy[sz]e|read|recognize|understand)/i,
      /(?:ocr|image|photo|screenshot|qr)\s+.*(?:failed|not\s+read|not\s+recognized)/i,
      /nega\s+.*(?:rasm[a-z']*|skrinshot[a-z']*|qr)\s+.*(?:o['‘’`]?qiy|tushun|aniqla).*olmad/i,
    ],
  },
  {
    intent: "explain_risk",
    patterns: [
      /почему\s+(?:это\s+)?(?:опасно|риск|подозрительно)/i,
      /почему\s+(?:такой|высокий)\s+риск/i,
      /объясни\s+(?:риск|результат|оценку)/i,
      /почему\s+ты\s+так\s+(?:решил|считаешь)/i,
      /why\s+(?:is\s+it|is|it'?s|this)\s+(?:dangerous|risky|suspicious)/i,
      /why\s+(?:high\s+)?risk/i,
      /explain\s+(?:risk|result|verdict)/i,
      /nega\s+(?:bu\s+)?xavfli/i,
      /nima\s+uchun\s+(?:xavf|shubha|yuqori)/i,
    ],
  },
  {
    intent: "how_do_you_check",
    patterns: [
      /как\s+(?:ты\s+)?(?:проверяешь|решаешь|определяешь|анализируешь)/i,
      /как\s+проверить\s+(?:номер|ссылку|сообщение|telegram|юзер|username)/i,
      /по\s+каким\s+признакам/i,
      /how\s+do\s+you\s+(?:check|decide|detect|analy[sz]e)/i,
      /how\s+to\s+check\s+(?:a\s+)?(?:number|link|message|username)/i,
      /qanday\s+(?:tekshirasan|aniqlaysan|qaror)/i,
      /qanday\s+tekshirish/i,
    ],
  },
  {
    intent: "what_can_you_do",
    patterns: [
      /что\s+ты\s+умеешь/i,
      /что\s+(?:можешь|умеет\s+бот)/i,
      /какие\s+(?:функции|возможности)/i,
      /what\s+can\s+you\s+do/i,
      /what\s+do\s+you\s+do/i,
      /your\s+features/i,
      /nima\s+qila\s+olasan/i,
      /bot\s+nima\s+qiladi/i,
    ],
  },
  {
    intent: "how_to_use",
    patterns: [
      /как\s+(?:пользоваться|использовать|начать|отправить)/i,
      /как\s+работает\s+(?:бот|сервис)/i,
      /что\s+отправить/i,
      /how\s+to\s+use/i,
      /how\s+do\s+i\s+use/i,
      /how\s+to\s+send/i,
      /how\s+does\s+(?:the\s+)?bot\s+work/i,
      /qanday\s+(?:foydalan|ishlat|boshlash)/i,
      /nima\s+yuborish/i,
    ],
  },
  {
    intent: "help",
    patterns: [
      /^(?:помощь|help|yordam)$/i,
      /(?:нужна|нужен|нуждаюсь)\s+помощ/i,
      /(?:need|want)\s+help/i,
      /yordam\s+kerak/i,
    ],
  },
];

function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[’‘`]/g, "'")
    .replace(/ё/g, "е")
    .replace(/Ё/g, "Е")
    .toLocaleLowerCase("ru")
    .trim()
    .replace(/\s+/g, " ");
}

export function hasScamWordingPattern(text: string): boolean {
  return SCAM_WORDING_PATTERNS.some((pattern) => pattern.test(text));
}

export function hasScamContextSignal(text: string): boolean {
  const normalized = normalizeText(text);
  if (normalized.length > LONG_TEXT_LIMIT) return true;
  return (
    URL_RE.test(normalized) ||
    PHONE_RE.test(normalized) ||
    TELEGRAM_RE.test(normalized) ||
    APK_RE.test(normalized) ||
    BANK_PAYMENT_RE.test(normalized) ||
    hasScamWordingPattern(normalized)
  );
}

export function classifyMetaIntent(
  text: string,
  options: ClassifyMetaIntentOptions = {},
): MetaIntent | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  if (options.isForwarded) return null;
  if (hasScamContextSignal(normalized)) return null;

  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      return intent;
    }
  }
  return null;
}

export function getMetaIntentResponse(intent: MetaIntent, lang: Lang): string {
  return bt(`meta_${intent}`, lang);
}
