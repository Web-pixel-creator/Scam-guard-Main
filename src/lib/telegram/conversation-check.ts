import type { Lang } from "@/lib/i18n";
import type { RiskLevel } from "@/lib/risk/rules";
import { uzbekLatinMatchingVariant } from "@/lib/risk/uz-cyrillic-translit";
import type { InlineKeyboard } from "@/lib/telegram/api.server";
import { bt } from "@/lib/telegram/bot-i18n";
import { CB } from "@/lib/telegram/format";
import { normalizeIntentTextForMatching } from "@/lib/telegram/intent-text-normalization";
import type {
  ConversationDraftSnapshot,
  ConversationPressureFlag,
  ConversationRequestedAction,
  ConversationStage,
  LastCheckContext,
  LastCheckSnapshot,
} from "@/lib/telegram/session.server";

export const CONVERSATION_DRAFT_TTL_MS = 20 * 60 * 1000;
export const MAX_CONVERSATION_MESSAGES = 8;
export const MAX_CONVERSATION_MESSAGE_CHARS = 2_000;
export const MAX_CONVERSATION_TOTAL_CHARS = 6_000;

type AppendFailure = "empty" | "expired" | "too_long" | "too_many" | "too_much_text";

type MessageSignals = {
  level: RiskLevel;
  stages: ConversationStage[];
  requestedActions: ConversationRequestedAction[];
  pressureFlags: ConversationPressureFlag[];
  reasons: string[];
};

const LEVEL_RANK: Record<RiskLevel, number> = {
  safe: 0,
  unknown: 1,
  suspicious: 2,
  high_risk: 3,
};

const ORDERED_STAGES: readonly ConversationStage[] = [
  "opener",
  "trust_building",
  "romance_pivot",
  "authority_claim",
  "investment_pitch",
  "urgency",
  "verification_request",
  "payment_request",
  "apk_install",
  "qr_login",
];

const ORDERED_ACTIONS: readonly ConversationRequestedAction[] = [
  "say_code",
  "send_card",
  "transfer_money",
  "install_app",
  "scan_qr",
  "connect_wallet",
  "send_document",
  "keep_call",
];

const ORDERED_PRESSURE: readonly ConversationPressureFlag[] = [
  "official_impersonation",
  "urgent",
  "fear",
  "secrecy",
  "promised_profit",
  "relationship_trust",
];

const DONE_RE =
  /^(?:готово|все|всё|это\s+всё|проверь|анализируй|done|analyze|check\s+it|tayyor|bo'ldi|boldi|tekshir)[\s.!?]*$/i;
const CANCEL_RE = /^(?:отмена|стоп|cancel|stop|bekor|bekor\s+qil)[\s.!?]*$/i;

const STAGE_PATTERNS: Array<[ConversationStage, RegExp]> = [
  ["opener", /(?:^|\b)(привет|здравствуй|добрый\s+день|hello|hi|salom|assalomu)/i],
  [
    "trust_building",
    /(?:довер|я\s+помогу|мы\s+поможем|не\s+волнуй|ishon|yordam\s+ber|trust|help\s+you)/i,
  ],
  [
    "romance_pivot",
    /(?:люблю|скучаю|будем\s+вместе|отношени|love|miss\s+you|together|sevaman|sog'indim)/i,
  ],
  [
    "authority_claim",
    /(?:банк|служба\s+безопасности|поддержк|налог|soliq|one\s?id|my\.gov|id\.gov|bank|support|government|davlat)/i,
  ],
  [
    "investment_pitch",
    /(?:инвест|крипт|бирж|trading|трейд|доход|прибыл|usdt|wallet|binance|crypto|invest|daromad|foyda)/i,
  ],
  [
    "urgency",
    /(?:срочно|быстро|немедленно|сейчас|последний\s+шанс|не\s+ждите|urgent|now|immediately|tez|hozir|shoshil)/i,
  ],
  [
    "verification_request",
    /(?:sms|смс|otp|код|code|verification|подтвержд|tasdiq|kod|raqamlar|цифр)/i,
  ],
  [
    "payment_request",
    /(?:перевед|перевести|оплат|плат[её]ж|карта|safe\s+account|transfer|payment|to'?lov|pul|o'?tkaz)/i,
  ],
  ["apk_install", /(?:apk|апк|приложени|установ|скачай|install|app|ilova|o'rnat|yukla)/i],
  ["qr_login", /(?:qr|куар|скан|scan|login|вход|подключ|ulanish|kirish)/i],
];

const CODE_TERMS_RE = String.raw`(?:sms|смс|otp|код|code|цифр|raqam|kod|pin|пин|парол)`;
const DIRECT_CODE_ASK_VERBS_RE = String.raw`(?:назов|продикту|скажи|сообщи|пришли|введи|подтверд)`;
const RETOLD_RU_CODE_ASK_VERBS_RE = String.raw`(?:просят|просит|попросил[аи]?|хочет|хотят|нужен|нужна|нужно|надо|требует|требуют|говорит|говорят|сказал[аи]?|спросил[аи]?)`;
const RETOLD_EN_CODE_ASK_VERBS_RE = String.raw`(?:ask|asked|asks|want|wants|need|needs)`;
const RETOLD_UZ_CODE_ASK_VERBS_RE = String.raw`(?:so['’]?ra|so['’]?radi|xohla|kerak|deyapti|dedi)`;
const CODE_REQUEST_RE = new RegExp(
  [
    `${DIRECT_CODE_ASK_VERBS_RE}.{0,50}${CODE_TERMS_RE}`,
    `${CODE_TERMS_RE}.{0,50}${DIRECT_CODE_ASK_VERBS_RE}`,
    `${RETOLD_RU_CODE_ASK_VERBS_RE}.{0,60}${CODE_TERMS_RE}`,
    `${CODE_TERMS_RE}.{0,60}${RETOLD_RU_CODE_ASK_VERBS_RE}`,
    `${RETOLD_EN_CODE_ASK_VERBS_RE}.{0,60}${CODE_TERMS_RE}`,
    `${CODE_TERMS_RE}.{0,60}${RETOLD_EN_CODE_ASK_VERBS_RE}`,
    `${RETOLD_UZ_CODE_ASK_VERBS_RE}.{0,60}${CODE_TERMS_RE}`,
    `${CODE_TERMS_RE}.{0,60}${RETOLD_UZ_CODE_ASK_VERBS_RE}`,
  ].join("|"),
  "i",
);

const TRANSFER_ACTION_RE =
  /(?:(?:перевед|перевести|отправ|оплат|пополни|send|transfer|pay|yubor|o['’]?tkaz|to['’]?la).{0,60}(?:деньг|сум|uzs|карт|счет|сч[её]т|money|funds?|pul|mablag|to['’]?lov)|(?:деньг|сум|uzs|карт|счет|сч[её]т|money|funds?|pul|mablag|to['’]?lov).{0,60}(?:перевед|перевести|отправ|оплат|пополни|send|transfer|pay|yubor|o['’]?tkaz|to['’]?la))/iu;
const CONVERSATION_CLAUSE_BOUNDARY_RE =
  /(?:[.!?;:\n\r]+|\s*[—–]\s*|\s+(?:but|however|whereas|но|однако|lekin|ammo)\s+)/iu;
const TRANSFER_NEGATED_ACTION_RE =
  /(?<![\p{L}\p{N}_])(?:никогда\s+не|не|нельзя|не\s+надо|не\s+следует)\s+(?:перевод|перевест|переводит|отправ|оплач|попол)|(?<![\p{L}\p{N}_])(?:не|никогда\s+не)\s+(?:прос(?:ит|ят)|требу(?:ет|ют)).{0,40}(?:перевод|перевест|отправ|оплач)|(?:never|do\s+not|don['’]?t|must\s+not|should\s+not|avoid)\s+(?:ever\s+)?(?:transfer|send|pay)|(?:(?:never|do(?:es)?\s+not|don['’]?t|doesn['’]?t)\s+ask|(?:asked|told).{0,20}not\s+to).{0,35}(?:transfer|send|pay)|(?:hech\s+qachon|aslo).{0,40}(?:o['’]?tkaz|yubor|to['’]?la)|(?:o['’]?tkazmang|yubormang|to['’]?lamang|so['’]?ramaydi)/iu;

function hasActiveConversationTransfer(text: string): boolean {
  return text
    .split(CONVERSATION_CLAUSE_BOUNDARY_RE)
    .some((clause) => TRANSFER_ACTION_RE.test(clause) && !TRANSFER_NEGATED_ACTION_RE.test(clause));
}

const ACTION_PATTERNS: Array<[ConversationRequestedAction, RegExp, string]> = [
  ["say_code", CODE_REQUEST_RE, "asks_for_sms_code"],
  [
    "send_card",
    /(?:карт[ау]|номер\s+карты|cvv|cvc|срок\s+карты|card).{0,60}(?:пришли|назов|введи|сообщи|send|enter|ayt|yubor)|(?:пришли|назов|введи|сообщи|send|enter|ayt|yubor).{0,60}(?:карт[ау]|номер\s+карты|cvv|cvc|card)/i,
    "asks_for_card_cvv",
  ],
  ["transfer_money", TRANSFER_ACTION_RE, "asks_for_money_transfer"],
  [
    "install_app",
    /(?:установ|скачай|открой|install|download|o'rnat|yukla).{0,60}(?:apk|апк|приложени|app|ilova)/i,
    "asks_to_install_apk",
  ],
  [
    "scan_qr",
    /(?:скан|scan|отскан).{0,40}(?:qr|куар)|(?:qr|куар).{0,40}(?:скан|scan|login|вход)/i,
    "asks_to_scan_qr",
  ],
  [
    "connect_wallet",
    /(?:connect|подключ|соедин).{0,50}(?:wallet|кошел|hamyon)|(?:seed|сид[-\s]?фраз|private\s+key|wallet).{0,60}(?:введ|send|пришли|enter)/i,
    "wallet_seed_phrase",
  ],
  [
    "send_document",
    /(?:паспорт|id|pinfl|пинфл|документ|selfie|селфи).{0,60}(?:фото|пришли|send|yubor|rasm)|(?:пришли|send|yubor).{0,60}(?:паспорт|id|pinfl|пинфл|документ)/i,
    "asks_for_personal_data",
  ],
  [
    "keep_call",
    /(?:не\s+кладите\s+трубку|оставайтесь\s+на\s+линии|don't\s+hang\s+up|stay\s+on\s+the\s+line|go'shakni\s+qo'ymang)/i,
    "keeps_user_on_call",
  ],
];

const SAFE_ACCOUNT_WORDING_RE = /(?:безопасн.{0,15}(?:сч[её]т|карт)|safe account|xavfsiz hisob)/iu;
const SAFE_ACCOUNT_CLAUSE_BOUNDARY_RE = CONVERSATION_CLAUSE_BOUNDARY_RE;
const SAFE_ACCOUNT_TRANSFER_VERB_RE =
  /(?:перевед(?:и|ите)|перевести|отправ(?:ь|ьте|ить)|оплат(?:и|ите|ить)|пополн(?:и|ите|ить)|(?:transfer|send|pay)\b|yubor(?:ing)?|o['’]?tkaz(?:ing)?|to['’]?la(?:ng)?)/iu;
const SAFE_ACCOUNT_TRANSFER_REQUEST_RE =
  /(?:прос(?:ит|ят|ил[аи]?)|требу(?:ет|ют)|сказал[аи]?|вел(?:ит|ят)|asks?|asked|tells?|told|requires?|required|demands?|demanded|says?|said|so['’]?ra(?:yapti|di|shdi)?\b|talab\s+qil(?:yapti|di|ishdi)?\b|ayt(?:di|yapti)\b|deyapti\b)/iu;
const SAFE_ACCOUNT_DIRECT_TRANSFER_RE =
  /(?:перевед(?:и|ите)|отправ(?:ь|ьте)|оплат(?:и|ите)|пополни(?:те)?|(?:^|\s)(?:please\s+)?(?:transfer|send|pay)\b|yubor(?:ing)?\b|o['’]?tkaz(?:ing)?\b|to['’]?la(?:ng)?\b)/iu;
const SAFE_ACCOUNT_NEGATED_TRANSFER_RE = TRANSFER_NEGATED_ACTION_RE;
const SAFE_ACCOUNT_EDUCATIONAL_RE =
  /(?:что\s+такое|как\s+(?:работает|устроен)|банки?\s+не\s+прос)|(?:what\s+(?:is|are)|how\s+(?:does|do|to)|should\s+i|banks?\s+never\s+ask)|(?:xavfsiz\s+hisob\s+nima|banklar?.{0,80}so['’]?ramaydi)/iu;

/**
 * A generic transfer in one clause must not borrow "safe account" wording from
 * a separate warning or question.  Keep the specific reason only when the
 * same bounded clause contains an active transfer instruction or a retold
 * request.  Raw message text is still discarded after signal extraction.
 */
function hasClauseLocalActiveSafeAccountTransfer(text: string): boolean {
  return text.split(SAFE_ACCOUNT_CLAUSE_BOUNDARY_RE).some((clause) => {
    if (!SAFE_ACCOUNT_WORDING_RE.test(clause) || !SAFE_ACCOUNT_TRANSFER_VERB_RE.test(clause)) {
      return false;
    }

    if (SAFE_ACCOUNT_NEGATED_TRANSFER_RE.test(clause) || SAFE_ACCOUNT_EDUCATIONAL_RE.test(clause)) {
      return false;
    }

    return (
      SAFE_ACCOUNT_DIRECT_TRANSFER_RE.test(clause) || SAFE_ACCOUNT_TRANSFER_REQUEST_RE.test(clause)
    );
  });
}

const PRESSURE_PATTERNS: Array<[ConversationPressureFlag, RegExp]> = [
  ["urgent", /(?:срочно|немедленно|сейчас|urgent|immediately|hozir|tez|shoshil)/i],
  ["secrecy", /(?:никому\s+не\s+говор|секрет|confidential|don't\s+tell|hech\s+kimga\s+aytma)/i],
  ["fear", /(?:заблокир|штраф|суд|уголов|blocked|fine|police|jarima|bloklan)/i],
  [
    "promised_profit",
    /(?:гарантированн|доход|прибыл|x2|x3|profit|guaranteed|daromad|foyda|kafolat)/i,
  ],
  ["relationship_trust", /(?:люблю|скучаю|доверяй|love|miss\s+you|trust\s+me|ishon)/i],
  [
    "official_impersonation",
    /(?:банк|служба\s+безопасности|налог|one\s?id|my\.gov|id\.gov|bank|support|government|soliq|davlat)/i,
  ],
];

function maxLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a;
}

function addUnique<T extends string>(items: T[], values: Iterable<T>): T[] {
  const set = new Set(items);
  for (const value of values) set.add(value);
  return [...set];
}

function incrementCounts<T extends string>(counts: Partial<Record<T, number>>, values: T[]): void {
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
}

function extractMessageSignals(text: string): MessageSignals {
  const normalized = normalizeIntentTextForMatching(text);
  const uzbekLatin = uzbekLatinMatchingVariant(normalized);
  const candidates =
    uzbekLatin && uzbekLatin !== normalized ? [normalized, uzbekLatin] : [normalized];
  const matchesAny = (pattern: RegExp): boolean =>
    candidates.some((candidate) => pattern.test(candidate));

  const stages = STAGE_PATTERNS.filter(([, pattern]) => matchesAny(pattern)).map(
    ([stage]) => stage,
  );
  const pressureFlags = PRESSURE_PATTERNS.filter(([, pattern]) => matchesAny(pattern)).map(
    ([flag]) => flag,
  );
  const actionHits = ACTION_PATTERNS.filter(([action, pattern]) =>
    action === "transfer_money"
      ? candidates.some(hasActiveConversationTransfer)
      : matchesAny(pattern),
  );
  const requestedActions = actionHits.map(([action]) => action);
  const reasons = actionHits.map(([, , reason]) =>
    reason === "asks_for_money_transfer" && candidates.some(hasClauseLocalActiveSafeAccountTransfer)
      ? "asks_to_transfer_to_safe_account"
      : reason,
  );

  let level: RiskLevel = "unknown";
  if (requestedActions.length > 0) {
    level = "high_risk";
  } else if (
    stages.some((stage) => stage !== "opener" && stage !== "trust_building") ||
    pressureFlags.length > 0
  ) {
    level = "suspicious";
  }

  return { level, stages, requestedActions, pressureFlags, reasons };
}

export function createConversationDraft(now = new Date()): ConversationDraftSnapshot {
  const iso = now.toISOString();
  return {
    startedAt: iso,
    updatedAt: iso,
    messageCount: 0,
    totalChars: 0,
    strongestLevel: "unknown",
    stageCounts: {},
    reasonCounts: {},
    requestedActions: [],
    pressureFlags: [],
  };
}

export function isConversationDraftExpired(
  draft: ConversationDraftSnapshot | undefined,
  now = new Date(),
): boolean {
  if (!draft) return true;
  const updatedAt = Date.parse(draft.updatedAt);
  return !Number.isFinite(updatedAt) || now.getTime() - updatedAt > CONVERSATION_DRAFT_TTL_MS;
}

export function appendConversationMessage(
  draft: ConversationDraftSnapshot,
  text: string,
  now = new Date(),
):
  | { ok: true; draft: ConversationDraftSnapshot }
  | { ok: false; reason: AppendFailure; draft: ConversationDraftSnapshot } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "empty", draft };
  if (isConversationDraftExpired(draft, now)) return { ok: false, reason: "expired", draft };
  if (trimmed.length > MAX_CONVERSATION_MESSAGE_CHARS) {
    return { ok: false, reason: "too_long", draft };
  }
  if (draft.messageCount >= MAX_CONVERSATION_MESSAGES) {
    return { ok: false, reason: "too_many", draft };
  }
  if (draft.totalChars + trimmed.length > MAX_CONVERSATION_TOTAL_CHARS) {
    return { ok: false, reason: "too_much_text", draft };
  }

  const signals = extractMessageSignals(trimmed);
  const next: ConversationDraftSnapshot = {
    ...draft,
    updatedAt: now.toISOString(),
    messageCount: draft.messageCount + 1,
    totalChars: draft.totalChars + trimmed.length,
    strongestLevel: maxLevel(draft.strongestLevel, signals.level),
    stageCounts: { ...draft.stageCounts },
    reasonCounts: { ...draft.reasonCounts },
    requestedActions: addUnique(draft.requestedActions, signals.requestedActions),
    pressureFlags: addUnique(draft.pressureFlags, signals.pressureFlags),
  };
  incrementCounts(next.stageCounts, signals.stages);
  incrementCounts(next.reasonCounts, signals.reasons);
  return { ok: true, draft: next };
}

export function isConversationDonePhrase(text: string): boolean {
  return DONE_RE.test(text.trim());
}

export function isConversationCancelPhrase(text: string): boolean {
  return CANCEL_RE.test(text.trim());
}

export function removeConversationDraft<T extends { conversation?: ConversationDraftSnapshot }>(
  data: T | undefined,
): Omit<T, "conversation"> {
  const { conversation: _conversation, ...rest } = data ?? ({} as T);
  return rest;
}

export function buildConversationCollectKeyboard(lang: Lang): InlineKeyboard {
  return [
    [
      { text: bt("btn_conversation_analyze", lang), callback_data: CB.conversationAnalyze },
      { text: bt("btn_conversation_cancel", lang), callback_data: CB.conversationCancel },
    ],
  ];
}

export function buildConversationResultKeyboard(lang: Lang): InlineKeyboard {
  return [
    [
      { text: bt("btn_report", lang), callback_data: CB.report },
      { text: bt("btn_check_another", lang), callback_data: CB.checkAnother },
    ],
    [
      { text: bt("btn_quick_conversation", lang), callback_data: CB.conversationStart },
      { text: bt("btn_emergency", lang), callback_data: CB.emergency },
    ],
  ];
}

function orderedKeys<T extends string>(
  counts: Partial<Record<T, number>>,
  order: readonly T[],
): T[] {
  return order.filter((key) => (counts[key] ?? 0) > 0);
}

const stageLabels: Record<ConversationStage, Record<Lang, string>> = {
  opener: {
    ru: "начали с обычного сообщения",
    uz: "oddiy xabardan boshlandi",
    en: "started with a normal opener",
  },
  trust_building: { ru: "создавали доверие", uz: "ishonch uyg'otishga urindi", en: "built trust" },
  romance_pivot: {
    ru: "давили через отношения/доверие",
    uz: "munosabat yoki ishonch orqali bosim bo'ldi",
    en: "used relationship or trust pressure",
  },
  authority_claim: {
    ru: "представлялись службой/организацией",
    uz: "xizmat yoki tashkilot nomidan gapirdi",
    en: "claimed authority or an organization",
  },
  urgency: { ru: "торопили", uz: "shoshiltirdi", en: "created urgency" },
  verification_request: {
    ru: "перешли к подтверждению/коду",
    uz: "tasdiqlash yoki kodga o'tdi",
    en: "moved to verification/code",
  },
  payment_request: {
    ru: "перешли к оплате/переводу",
    uz: "to'lov yoki o'tkazmaga o'tdi",
    en: "moved to payment/transfer",
  },
  apk_install: {
    ru: "просили приложение/APK",
    uz: "ilova/APK so'radi",
    en: "asked for an app/APK",
  },
  qr_login: { ru: "появился QR/вход", uz: "QR/kirish paydo bo'ldi", en: "introduced QR/login" },
  investment_pitch: {
    ru: "перевели к инвестициям/крипте",
    uz: "investitsiya/kriptoga burdi",
    en: "pivoted to investment/crypto",
  },
};

const actionLabels: Record<ConversationRequestedAction, Record<Lang, string>> = {
  say_code: {
    ru: "назвать код или цифры",
    uz: "kod yoki raqamlarni aytish",
    en: "say a code or digits",
  },
  send_card: { ru: "дать данные карты", uz: "karta ma'lumotini berish", en: "share card details" },
  transfer_money: {
    ru: "перевести или оплатить деньги",
    uz: "pul o'tkazish yoki to'lash",
    en: "transfer or pay money",
  },
  install_app: {
    ru: "установить приложение/APK",
    uz: "ilova/APK o'rnatish",
    en: "install an app/APK",
  },
  scan_qr: {
    ru: "сканировать QR или войти",
    uz: "QR skan qilish yoki kirish",
    en: "scan QR or log in",
  },
  connect_wallet: {
    ru: "подключить кошелёк или seed",
    uz: "hamyon yoki seed iborani ulash",
    en: "connect wallet or seed phrase",
  },
  send_document: { ru: "отправить документ/ID", uz: "hujjat/ID yuborish", en: "send document/ID" },
  keep_call: { ru: "оставаться на линии", uz: "liniyada qolish", en: "stay on the line" },
};

const pressureLabels: Record<ConversationPressureFlag, Record<Lang, string>> = {
  urgent: { ru: "срочность", uz: "shoshiltirish", en: "urgency" },
  secrecy: { ru: "секретность", uz: "sir saqlash", en: "secrecy" },
  fear: { ru: "страх/угроза", uz: "qo'rqitish", en: "fear/threat" },
  promised_profit: { ru: "обещание дохода", uz: "foyda va'dasi", en: "profit promise" },
  relationship_trust: {
    ru: "давление через доверие",
    uz: "ishonch orqali bosim",
    en: "trust pressure",
  },
  official_impersonation: {
    ru: "образ банка/службы",
    uz: "bank/xizmat qiyofasi",
    en: "bank/service impersonation",
  },
};

const reasonLabels: Record<string, Record<Lang, string>> = {
  asks_for_sms_code: {
    ru: "просят SMS-код/цифры",
    uz: "SMS-kod/raqamlar so'ralgan",
    en: "asks for SMS code/digits",
  },
  asks_for_card_cvv: {
    ru: "просят данные карты",
    uz: "karta ma'lumotini so'raydi",
    en: "asks for card details",
  },
  asks_to_transfer_to_safe_account: {
    ru: "предлагают «безопасный счёт»",
    uz: "«xavfsiz hisob» taklif qilinyapti",
    en: "proposes a ‘safe account’",
  },
  asks_for_money_transfer: {
    ru: "просят перевод/оплату",
    uz: "pul o'tkazish/to'lov so'ralgan",
    en: "asks for transfer/payment",
  },
  asks_to_install_apk: {
    ru: "просят установить APK/приложение",
    uz: "APK/ilova o'rnatish so'ralgan",
    en: "asks to install APK/app",
  },
  asks_to_scan_qr: { ru: "просят QR/вход", uz: "QR/kirish so'ralgan", en: "asks for QR/login" },
  wallet_seed_phrase: {
    ru: "кошелёк/seed-фраза",
    uz: "hamyon/seed ibora",
    en: "wallet/seed phrase",
  },
  asks_for_personal_data: {
    ru: "просят документ/ID",
    uz: "hujjat/ID so'ralgan",
    en: "asks for document/ID",
  },
  keeps_user_on_call: {
    ru: "держат на линии",
    uz: "liniyada ushlab turadi",
    en: "keeps user on the line",
  },
};

function levelTitle(level: RiskLevel, lang: Lang): string {
  const dict: Record<RiskLevel, Record<Lang, string>> = {
    safe: {
      ru: "🧵 Разговор: явных опасных признаков не видно",
      uz: "🧵 Suhbat: aniq xavf belgisi ko'rinmayapti",
      en: "🧵 Conversation: no obvious danger signs",
    },
    unknown: {
      ru: "🧵 Разговор: данных пока мало",
      uz: "🧵 Suhbat: hozircha ma'lumot kam",
      en: "🧵 Conversation: not enough evidence yet",
    },
    suspicious: {
      ru: "🧵 Разговор: есть подозрительная эскалация",
      uz: "🧵 Suhbat: shubhali kuchayish bor",
      en: "🧵 Conversation: suspicious escalation",
    },
    high_risk: {
      ru: "🧵 Разговор: высокий риск",
      uz: "🧵 Suhbat: xavf yuqori",
      en: "🧵 Conversation: high risk",
    },
  };
  return dict[level][lang];
}

function formatList(items: string[], empty: string): string {
  return items.length > 0 ? items.map((item) => `• ${item}`).join("\n") : `• ${empty}`;
}

function nextStep(draft: ConversationDraftSnapshot, lang: Lang): string {
  const actions = new Set(draft.requestedActions);
  if (actions.has("say_code")) {
    return {
      ru: "Не называйте код. Завершите разговор и проверьте действие только в официальном приложении или по официальному номеру.",
      uz: "Kodni aytmang. Suhbatni tugating va amalni faqat rasmiy ilova yoki rasmiy raqam orqali tekshiring.",
      en: "Do not say the code. End the conversation and verify only in the official app or official number.",
    }[lang];
  }
  if (actions.has("transfer_money") || actions.has("send_card")) {
    return {
      ru: "Не переводите деньги и не вводите карту. Свяжитесь с банком/сервисом сами через официальный канал.",
      uz: "Pul o'tkazmang va karta ma'lumotini kiritmang. Bank/xizmatga o'zingiz rasmiy kanal orqali murojaat qiling.",
      en: "Do not transfer money or enter card details. Contact the bank/service yourself through an official channel.",
    }[lang];
  }
  if (actions.has("install_app")) {
    return {
      ru: "Не устанавливайте APK или приложение из чата. Удалите файл и проверяйте сервис только через официальный магазин/сайт.",
      uz: "Chatdan APK yoki ilova o'rnatmang. Faylni o'chiring va servisni faqat rasmiy do'kon/sayt orqali tekshiring.",
      en: "Do not install an APK or app from the chat. Delete it and use only the official store/site.",
    }[lang];
  }
  if (actions.has("scan_qr") || actions.has("connect_wallet")) {
    return {
      ru: "Не сканируйте QR и не подключайте кошелёк. Откройте сервис сами, не по ссылке из переписки.",
      uz: "QR skan qilmang va hamyon ulamang. Servisni yozishmadagi havola orqali emas, o'zingiz oching.",
      en: "Do not scan the QR or connect a wallet. Open the service yourself, not from the chat link.",
    }[lang];
  }
  if (draft.strongestLevel === "suspicious") {
    return {
      ru: "Пауза. Не отправляйте деньги, коды, карту или документы. Пришлите следующий экран/ссылку, если появится конкретная просьба.",
      uz: "To'xtang. Pul, kod, karta yoki hujjat yubormang. Aniq so'rov chiqsa, keyingi ekran/havolani yuboring.",
      en: "Pause. Do not send money, codes, card data or documents. Send the next screen/link if a concrete request appears.",
    }[lang];
  }
  return {
    ru: "Пока не видно конкретного опасного действия. Если попросят код, карту, оплату, APK, QR или документ — не выполняйте просьбу и пришлите её отдельно.",
    uz: "Hozircha aniq xavfli amal ko'rinmayapti. Kod, karta, to'lov, APK, QR yoki hujjat so'ralsa — to'xtang va alohida yuboring.",
    en: "I do not see a concrete dangerous action yet. If they ask for a code, card, payment, APK, QR or document, do not comply; send that request separately.",
  }[lang];
}

function topReasons(draft: ConversationDraftSnapshot): string[] {
  return Object.entries(draft.reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason]) => reason);
}

export function buildConversationResultText(draft: ConversationDraftSnapshot, lang: Lang): string {
  const stageItems = orderedKeys(draft.stageCounts, ORDERED_STAGES).map(
    (stage) => stageLabels[stage][lang],
  );
  const actionItems = ORDERED_ACTIONS.filter((action) =>
    draft.requestedActions.includes(action),
  ).map((action) => actionLabels[action][lang]);
  const pressureItems = ORDERED_PRESSURE.filter((flag) => draft.pressureFlags.includes(flag)).map(
    (flag) => pressureLabels[flag][lang],
  );
  const reasonItems = topReasons(draft).map(
    (reason) => reasonLabels[reason]?.[lang] ?? reason.replaceAll("_", " "),
  );

  const copy = {
    ru: {
      count: `Проверено сообщений: ${draft.messageCount}.`,
      stages: "Как развивалось:",
      noStages: "эскалация не видна по присланным сообщениям",
      actions: "Что просят сделать:",
      noActions: "явной просьбы к действию пока нет",
      pressure: "Сигналы давления:",
      noPressure: "сильного давления не видно",
      strongest: "Самые важные признаки:",
      noReasons: "опасных просьб в явном виде не найдено",
      next: "Следующий безопасный шаг:",
    },
    uz: {
      count: `Tekshirildi: ${draft.messageCount} ta xabar.`,
      stages: "Qanday rivojlandi:",
      noStages: "yuborilgan xabarlarda kuchayish ko'rinmayapti",
      actions: "Nima qilishni so'rayapti:",
      noActions: "hozircha aniq amal so'ralmagan",
      pressure: "Bosim belgilari:",
      noPressure: "kuchli bosim ko'rinmayapti",
      strongest: "Eng muhim belgilar:",
      noReasons: "aniq xavfli so'rov topilmadi",
      next: "Keyingi xavfsiz qadam:",
    },
    en: {
      count: `Messages checked: ${draft.messageCount}.`,
      stages: "How it evolved:",
      noStages: "no escalation is visible in the supplied messages",
      actions: "Requested action:",
      noActions: "no concrete action request yet",
      pressure: "Pressure signals:",
      noPressure: "no strong pressure is visible",
      strongest: "Most important signals:",
      noReasons: "no explicit dangerous request found",
      next: "Next safe step:",
    },
  }[lang];

  return [
    levelTitle(draft.strongestLevel, lang),
    copy.count,
    "",
    copy.stages,
    formatList(stageItems, copy.noStages),
    "",
    copy.actions,
    formatList(actionItems, copy.noActions),
    "",
    copy.pressure,
    formatList(pressureItems, copy.noPressure),
    "",
    copy.strongest,
    formatList(reasonItems, copy.noReasons),
    "",
    copy.next,
    nextStep(draft, lang),
  ].join("\n");
}

export function buildConversationLastCheckSnapshot(
  draft: ConversationDraftSnapshot,
  now = new Date(),
): LastCheckSnapshot {
  const context: LastCheckContext =
    draft.stageCounts.investment_pitch || draft.pressureFlags.includes("promised_profit")
      ? "crypto"
      : "generic";
  return {
    level: draft.strongestLevel,
    type: "text",
    context,
    reasons: topReasons(draft),
    at: now.toISOString(),
  };
}
