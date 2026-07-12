import type { Lang } from "@/lib/i18n";
import type { RunCheckResult } from "@/lib/risk/check-core";
import { VERIFIED_CONTACTS } from "@/lib/risk/verified-contacts";
import { REASON_LABELS, type ReasonCode, type RiskLevel } from "@/lib/risk/rules";
import { filterAdvice } from "@/lib/telegram/advice-filter";
import { hasConcreteArtifact } from "@/lib/telegram/concrete-artifact";
import {
  collectResultReasonCodesForPresentation,
  INLINE_REASON_POLICY,
  presentInlineReason,
} from "@/lib/telegram/inline-reason-presentation";
import type {
  LastCheckContext,
  LastCheckEvidenceMethod,
  LastCheckEvidenceSource,
  LastCheckProvenance,
  LastCheckSnapshot,
  ReportDraft,
} from "@/lib/telegram/session.server";

const RECENT_CHECK_WINDOW_MS = 20 * 60 * 1000;

const CONFIDENCE_RE =
  /^(?:точно|точно\?|а\s+точно|это\s+точно|ты\s+уверен[а]?|уверен[а]?|правда|реально|это\s+безопасно|можно\s+доверять|sure|really|are\s+you\s+sure|is\s+it\s+safe|can\s+i\s+trust|aniqmi|rostmi|xavfsizmi|ishonsa\s+bo'ladimi)[\s?!.,]*$/i;
const QR_OPEN_RE =
  /(?:можно|безопасно|стоит)\s+(?:открыть|сканировать|перейти).{0,25}qr|qr.{0,25}(?:можно|безопасно|открыть|сканировать|перейти)/i;
const NEXT_STEPS_RE =
  /(?:что\s+(?:делать|дальше|посоветуешь)|что\s+мне\s+делать|как\s+(?:поступить|быть)|какой\s+следующий\s+шаг|что\s+еще|что\s+ещё|what\s+(?:should\s+i\s+do|next)|next\s+step|nima\s+qilay|keyin\s+nima|qanday\s+qilay)/i;
const CONTACTS_RE =
  /(?:дай|покажи|нужен|нужны|куда|как)\s+.{0,30}(?:номер|контакт|банк|горяч|звон)|(?:номер|контакт|телефон|горячая\s+линия)\s+.{0,30}(?:банка|банк|служб)|(?:bank\s+number|official\s+number|where\s+to\s+call|call\s+the\s+bank|bank\s+contact|bank\s+contacts|bank\s+hotline|bank\s+raqam|rasmiy\s+raqam|qayerga\s+qo'ng'iroq)/i;
const REPORT_CONTEXT_RE =
  /(?:пожаловаться|заявлен|полици|102|куда\s+звонить\s+если|обманул|обманули|мошен|скам|report|police|fraud|scam|shikoyat|aldadi|firib)/i;
const SIMPLE_EXPLAIN_RE =
  /(?:объясни|поясни|скажи|можно)\s*.{0,30}(?:как\s+бабушк|простыми\s+словами|совсем\s+прост|по[-\s]?простому|человеческ)|(?:как\s+бабушк|простыми\s+словами|совсем\s+прост|по[-\s]?простому|для\s+(?:мамы|папы|пожил)|я\s+пожил|мне\s+сложно)|(?:explain|say|tell)\s*.{0,30}(?:simply|simple\s+words|like\s+i'?m\s+(?:five|old|elderly)|for\s+(?:my\s+)?(?:mom|mother|grandmother|grandma))|(?:simple\s+words|eli5|like\s+i'?m\s+five|for\s+(?:my\s+)?(?:mom|mother|grandmother|grandma))|(?:oddiy|sodda|tushunarli)\s*.{0,30}(?:qilib|so'zlar|tushuntir)|(?:buvimga|onamga|otamga|keksalar)/i;
const EXPLAIN_RE =
  /^(?:почему(?:\s+.{1,120})?|объясни(?:\s+.{0,120})?|поясни(?:\s+.{0,120})?|я\s+не\s+понял[а]?(?:\s+.{0,80})?|не\s+понял[а]?(?:\s+.{0,80})?|что\s+это\s+значит|why(?:\s+.{0,120})?|explain(?:\s+.{0,120})?|i\s+do\s+not\s+understand|i\s+don't\s+understand|nega(?:\s+.{0,120})?|tushunmadim|izohla(?:\s+.{0,120})?)[\s?!.,]*$/i;
// "Is this made by AI / a neural net?" style questions about the last check.
// We cannot reliably detect AI generation, so we answer honestly and redirect
// to what actually matters for safety instead of returning a generic card.
const AI_ORIGIN_RE =
  /(нейросет|нейронк|искусственн[а-яё]*\s+интеллект|сгенерир|chatgpt|midjourney|ai[\s-]?generated|ai[\s-]?made|generated\s+(?:by|with)\s+(?:ai|a?\s*neural)|made\s+(?:by|with)\s+ai|looks?\s+(?:like\s+)?ai|sun'?iy\s+intellekt|(?:^|[^a-zа-яё])(?:ai|ии)(?:[^a-zа-яё]|$))/i;
const CONFIRMATION_REQUEST_RE =
  /(?:попросил[аи]?|попросили|просят|просит|сказал[аи]?|нужно|надо|требу(?:ет|ют))\s+.{0,40}(?:подтвержден(?:ие|ия)|подтвердить|подтверждать)|(?:подтвержден(?:ие|ия)|подтвердить|подтверждать)\s+.{0,40}(?:попросил[аи]?|попросили|просят|просит|нужно|надо|требу(?:ет|ют)|операци[яю]|вход)|(?:asked|asks|asking|need|needs)\s+.{0,40}(?:confirm|confirmation|verify|verification)|(?:confirm|confirmation|verify)\s+.{0,40}(?:operation|login|account)|(?:tasdiq|tasdiqlash)/i;
const ACKNOWLEDGEMENT_RE =
  /^(?:(?:я\s+)?(?:понял[а]?|понятно|сделаю|сделал[а]?|готов[ао]?|готово)|хорошо(?:[,\s]+(?:сделаю|понял[а]?|спасибо))?|ок(?:ей)?|спасибо|благодарю|рахмат|rahmat|tushunarli|yaxshi|qilaman|qildim|ok|okay|thanks|thank\s+you)[\s.!?]*$/i;
const IDENTITY_RE =
  /^(?:(?:а\s+)?(?:вы|ты)\s+кто|кто\s+(?:вы|ты)|что\s+ты\s+умеешь|что\s+вы\s+умеете|как\s+ты\s+работаешь|who\s+are\s+you|what\s+can\s+you\s+do|how\s+do\s+you\s+work|siz\s+kimsiz|sen\s+kimsan|nima\s+qila\s+olasan)[\s?!.,]*$/i;
const EXTENDED_CONFIDENCE_RE =
  /(?:ты|вы)\s+(?:действительно\s+|реально\s+|точно\s+)?(?:в\s+этом\s+)?уверен[аы]?|(?:are\s+you|you(?:'re|\s+are))\s+(?:really\s+|absolutely\s+)?sure(?:\s+about\s+(?:it|that|this))?|siz\s+(?:bunga\s+)?(?:aniq\s+)?ishonasizmi/i;
const METHODOLOGY_RE =
  /(?:как(?:им\s+образом)?\s+.{0,40}(?:проверил|проверили|определил|посчитал)|(?:проверил|проверили)\s+.{0,40}(?:как|образом|метод)|почему\s+.{0,40}(?:домен|ссылка|номер|аккаунт)\s+.{0,60}(?:подозр|опасн|риск).{0,60}(?:провер|метод|образ)|какие\s+источники\s+(?:ты|вы)\s+использовал[и]?|how\s+(?:did|do)\s+you\s+(?:check|verify|decide|determine)|what\s+(?:method|source)s?\s+did\s+you\s+use|which\s+sources?\s+did\s+you\s+use|qanday\s+.{0,40}(?:tekshir|aniqla)|nima\s+asosida\s+.{0,40}(?:tekshir|aniqla))/i;
const TRUSTED_PERSON_RE =
  /(?:(?:могу|можно|стоит|лучше)\s+.{0,35}(?:связаться|позвонить|поговорить|посоветоваться|показать)\s+.{0,35}(?:близк|родствен|друг|семь|мам|пап|родител)|(?:близк|родствен|друг|семь|мам|пап|родител)\w*\s+.{0,35}(?:позвон|связ|поговор|показ)|can\s+i\s+(?:call|contact|talk\s+to|ask|show\s+(?:this\s+)?to)\s+(?:someone\s+i\s+trust|a\s+trusted\s+person|my\s+(?:family|friend|relative|mother|mom|father|parents?))|(?:call|contact|ask|show\s+(?:this\s+)?to)\s+(?:someone\s+you\s+trust|a\s+trusted\s+person)|yaqin\s+odam\w*\s+bilan\s+.{0,30}(?:bog['’]?lan|gaplash|maslahat)|ishonchli\s+odam\w*\s+.{0,30}(?:qo['’]?ng['’]?iroq|bog['’]?lan|gaplash))/i;
const RECHECK_RE =
  /^(?:(?:а\s+)?можешь\s+перепроверить|перепроверь(?:те)?(?:\s+(?:ещ[её]\s+раз|заново|повторно))?|проверь(?:те)?\s+(?:это\s+)?(?:ещ[её](?:\s+раз)?|заново|повторно)|повтори(?:те)?\s+проверку|can\s+you\s+double[-\s]?check(?:\s+(?:it|this|that))?|check\s+(?:it|this|that)\s+again|recheck(?:\s+it)?|run\s+the\s+check\s+again|yana\s+bir\s+marta\s+tekshir(?:ing)?|qayta\s+tekshir(?:ing)?)[\s.!?]*$/i;
const DISAGREEMENT_RE =
  /(?:я\s+не\s+соглас|ты\s+ошиб|вы\s+ошиб|это\s+неправда|не\s+верю\s+этому\s+результату|i\s+disagree|you\s+(?:may\s+be\s+|are\s+)?wrong|i\s+do\s+not\s+trust\s+this\s+result|men\s+rozi\s+emas|xato\s+qildingiz|bu\s+natijaga\s+ishonmayman)/i;

const NEW_SCAM_REQUEST_RE =
  /(?:(?:просят|просит|попросил[аи]?|сказал[аи]?|требуют|требует|предлагают)\s+.{0,80}(?:код|парол|pin|cvv|карт|перевест|переводить|переведи|оплатить|apk|приложен)|(?:asks?|asked|told|wants?|requires?)\s+.{0,80}(?:code|otp|pin|cvv|card|send\s+(?:money|funds)|make\s+(?:a\s+)?(?:transfer|payment)|apk|install)|(?:so['’]?(?:rayapti|radi)|aytdi|talab)\s+.{0,80}(?:kod|pin|cvv|karta|to['’]?lov|o['’]?tkaz|apk)|(?:kod|pin|cvv|karta).{0,40}(?:so['’]?(?:rayapti|radi)|talab)|(?:transfer|send|pay)\s+(?:me\s+)?(?:money|funds?)\b|(?:переведи|переведите|оплати|оплатите|отправь|пришли)\s+.{0,40}(?:деньг|код|карт))/i;
const NEW_PERSONAL_DATA_REQUEST_RE =
  /(?:(?:просят|просит|попросил[аи]?|требуют|требует|нужно|надо).{0,100}(?:отправить|прислать|показать|дать|сообщить)?.{0,40}(?:паспорт|фото\s+(?:паспорта|документ)|документ|удостоверени|id.?карт|пинфл|инн|дат[ау]\s+рождения|адрес|пропис)|(?:asks?|asked|wants?|requires?|told\s+me).{0,100}(?:send|share|show|provide)?.{0,40}(?:passport|document\s+photo|photo\s+of\s+(?:my\s+)?id|id\s+card|personal\s+data|date\s+of\s+birth|address)|(?:so['’]?(?:rayapti|radi)|talab|aytdi).{0,100}(?:yubor|ber|ko['’]?rsat)?.{0,40}(?:pasport|hujjat|jshshir|tug['’]?ilgan|manzil)|(?:passport|pasport|паспорт|id\s+card|id.?карт|пинфл|jshshir|hujjat).{0,100}(?:send|share|provide|yubor|jo['’]?nat|отправ|присл|показ|сообщ|просят|просит|so['’]?(?:rayapti|radi)))/iu;

function hasNewCheckPayload(text: string): boolean {
  return (
    hasConcreteArtifact(text) ||
    NEW_SCAM_REQUEST_RE.test(text) ||
    NEW_PERSONAL_DATA_REQUEST_RE.test(text)
  );
}

const CRYPTO_CONTEXT_RE =
  /(крипт|биткоин|bitcoin|binance|trading|трейд|инвест|доходн|прибыл|forex|crypto|investment|investits|kripto|daromad|foyda)/i;
const QR_MENU_CONTEXT_RE =
  /(меню|ресторан|кафе|акци[яи]|лояльност|qr.{0,30}(меню|info|информац)|restaurant|menu|promo|loyalty|restoran|aksiya|ma'lumot)/i;
const DELIVERY_CONTEXT_RE =
  /(доставк|заказ|выдач|пункт|курьер|почт|delivery|pickup|order|courier|yetkazib|buyurtma|topshirish)/i;
const TOPIC_ONLY_EXPLANATION_REASONS = new Set([
  "unknown_sender",
  "new_telegram_account",
  "hosted_app_platform",
  "valid_uz_phone",
  "non_uz_phone",
]);

export const ALL_LAST_CHECK_FOLLOW_UP_ACTIONS = [
  "confidence",
  "methodology",
  "trusted_person",
  "recheck",
  "disagreement",
  "next_steps",
  "contacts",
  "explain",
  "simple_explain",
  "ai_origin",
  "confirmation_request",
  "acknowledgement",
  "identity",
] as const;

export type LastCheckFollowUpAction = (typeof ALL_LAST_CHECK_FOLLOW_UP_ACTIONS)[number];

export type GoldenFollowUpPhraseKind = "reply" | "typo";

export const FOLLOW_UP_GOLDEN_PHRASES: Readonly<
  Record<
    LastCheckFollowUpAction,
    Readonly<Record<Lang, Readonly<Record<GoldenFollowUpPhraseKind, string>>>>
  >
> = {
  confidence: {
    ru: { reply: "Да, но ты точно уверен?", typo: "Ты точна уверен?" },
    uz: { reply: "Ha, lekin aniqmi?", typo: "Ishonsa boladimi?" },
    en: { reply: "Okay, but are you sure?", typo: "R u sure?" },
  },
  methodology: {
    ru: { reply: "А как именно ты это проверил?", typo: "Как ты это праверил?" },
    uz: {
      reply: "Buni nimaga asoslanib tekshirdingiz?",
      typo: "Qande tekshirdiz?",
    },
    en: { reply: "What did you base that on?", typo: "How u check this?" },
  },
  trusted_person: {
    ru: { reply: "Тогда можно позвонить маме?", typo: "Можна связаться с близким?" },
    uz: {
      reply: "Unda yaqinimga qo'ng'iroq qilsam bo'ladimi?",
      typo: "Yaqin odamga qongiroq qilsam boladimi?",
    },
    en: { reply: "Then can I call my family?", typo: "Can I call my famly?" },
  },
  recheck: {
    ru: { reply: "Да, перепроверь ещё раз", typo: "Перепроверь ешё раз" },
    uz: { reply: "Ha, qayta tekshiring", typo: "Qayta tekshr" },
    en: { reply: "Yes, check it again please", typo: "Chek it again pls" },
  },
  disagreement: {
    ru: { reply: "Нет, я не согласен с этим", typo: "Ты ашибся" },
    uz: { reply: "Yo'q, bu natijaga ishonmayman", typo: "Xato qildiz" },
    en: { reply: "No, I disagree with this result", typo: "U are wrong" },
  },
  next_steps: {
    ru: { reply: "Хорошо, а что теперь?", typo: "Че делать дальше?" },
    uz: { reply: "Xo'p, endi nima qilay?", typo: "Nma qilay?" },
    en: { reply: "Okay, now what?", typo: "Wat should I do next?" },
  },
  contacts: {
    ru: { reply: "Тогда дай номер банка", typo: "Номер баннка?" },
    uz: { reply: "Unda bank raqamini bering", typo: "Bank nomeri qane?" },
    en: { reply: "Then give me the bank number", typo: "Bank no?" },
  },
  explain: {
    ru: { reply: "А почему так?", typo: "Пачему?" },
    uz: { reply: "Xo'p, nega bunday?", typo: "Nma uchun?" },
    en: { reply: "Okay, why is that?", typo: "Y is that?" },
  },
  simple_explain: {
    ru: { reply: "Можно объяснить проще?", typo: "Объясни папроще" },
    uz: { reply: "Soddaroq ayting", typo: "Sodaroq tushuntir" },
    en: { reply: "Can you say it more simply?", typo: "Explain simpl pls" },
  },
  ai_origin: {
    ru: { reply: "То есть это сделал ИИ?", typo: "Это нейронка?" },
    uz: { reply: "Demak, bu sun'iy intellektmi?", typo: "Bu suniy intelektmi?" },
    en: { reply: "So was this made by AI?", typo: "Is this AI gen?" },
  },
  confirmation_request: {
    ru: { reply: "То есть мне не подтверждать?", typo: "Просят подтвердить аперацию" },
    uz: { reply: "Demak, tasdiqlamaymi?", typo: "Tasdiqlash kere" },
    en: { reply: "So should I confirm it?", typo: "Shud I confirm?" },
  },
  acknowledgement: {
    ru: { reply: "Ясно, спасибо", typo: "Спс" },
    uz: { reply: "Tushundim, rahmat", typo: "Raxmat" },
    en: { reply: "Got it, thanks", typo: "Thx" },
  },
  identity: {
    ru: { reply: "А ты кто вообще?", typo: "Кто ты такой" },
    uz: { reply: "Bu qanday bot?", typo: "Siz kims" },
    en: { reply: "What is this bot?", typo: "Who r u" },
  },
};

function normalizeGoldenFollowUpPhrase(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/[.!?,;:]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

const GOLDEN_FOLLOW_UP_ACTION_BY_PHRASE = new Map<string, LastCheckFollowUpAction>();
for (const action of ALL_LAST_CHECK_FOLLOW_UP_ACTIONS) {
  for (const lang of ["ru", "uz", "en"] as const) {
    for (const phrase of Object.values(FOLLOW_UP_GOLDEN_PHRASES[action][lang])) {
      const key = normalizeGoldenFollowUpPhrase(phrase);
      if (GOLDEN_FOLLOW_UP_ACTION_BY_PHRASE.has(key)) {
        throw new Error(`Duplicate golden follow-up phrase: ${key}`);
      }
      GOLDEN_FOLLOW_UP_ACTION_BY_PHRASE.set(key, action);
    }
  }
}

function classifyGoldenFollowUpPhrase(text: string): LastCheckFollowUpAction | null {
  return GOLDEN_FOLLOW_UP_ACTION_BY_PHRASE.get(normalizeGoldenFollowUpPhrase(text)) ?? null;
}

function isRecent(snapshot: LastCheckSnapshot, now: Date): boolean {
  const at = Date.parse(snapshot.at);
  return Number.isFinite(at) && now.getTime() - at <= RECENT_CHECK_WINDOW_MS;
}

function hasNewerRecentPanicContext(
  scenarioData: ReportDraft | undefined,
  snapshot: LastCheckSnapshot,
  now: Date,
): boolean {
  const panicAt = Date.parse(scenarioData?.lastPanicAt ?? "");
  const checkAt = Date.parse(snapshot.at);
  return (
    Number.isFinite(panicAt) &&
    Number.isFinite(checkAt) &&
    panicAt >= checkAt &&
    now.getTime() - panicAt <= RECENT_CHECK_WINDOW_MS
  );
}

export function detectLastCheckContext(result: RunCheckResult): LastCheckContext {
  const haystack = `${result.type}\n${result.display}\n${result.explanation ?? ""}`;

  if (DELIVERY_CONTEXT_RE.test(haystack)) return "delivery";
  if (QR_MENU_CONTEXT_RE.test(haystack)) return "qr_menu";
  if (CRYPTO_CONTEXT_RE.test(haystack)) return "crypto";
  if (
    result.type === "phone" ||
    result.reasons.includes("valid_uz_phone") ||
    result.reasons.includes("non_uz_phone")
  ) {
    return "phone";
  }
  if (result.type === "telegram") return "telegram_profile";
  return "generic";
}

const EVIDENCE_SOURCE: Record<LastCheckEvidenceMethod, LastCheckEvidenceSource> = {
  text_pattern: "visible_input",
  url_structure: "visible_input",
  domain_comparison: "visible_input",
  phone_format: "visible_input",
  telegram_visible: "visible_input",
  official_directory: "official_directory",
  local_reports: "moderated_reports",
  external_reputation: "external_reputation",
  context: "visible_input",
};

function uniqueBounded<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].slice(0, 3);
}

function buildLastCheckProvenance(reasons: readonly ReasonCode[]): LastCheckProvenance {
  const policies = reasons.map((reason) => INLINE_REASON_POLICY[reason]);
  const methods = uniqueBounded(policies.map((policy) => policy.evidence));

  return {
    methods,
    sources: uniqueBounded(methods.map((method) => EVIDENCE_SOURCE[method])),
    limitations: uniqueBounded(policies.map((policy) => policy.limitation)),
  };
}

export function buildLastCheckSnapshot(
  result: RunCheckResult,
  now = new Date(),
): LastCheckSnapshot {
  const reasons = collectResultReasonCodesForPresentation(result).slice(0, 3);
  return {
    level: result.level,
    type: result.type,
    context: detectLastCheckContext(result),
    reasons,
    provenance: buildLastCheckProvenance(reasons),
    at: now.toISOString(),
  };
}

export function buildImageUnreadableSnapshot(now = new Date()): LastCheckSnapshot {
  return {
    level: "unknown",
    type: "unknown",
    context: "image_unreadable",
    at: now.toISOString(),
  };
}

export function classifyLastCheckFollowUp(
  text: string,
  scenarioData: ReportDraft | undefined,
  now = new Date(),
): LastCheckFollowUpAction | null {
  const trimmed = text.trim();
  if (!trimmed || hasNewCheckPayload(trimmed)) return null;

  const snapshot = scenarioData?.lastCheck;
  if (!snapshot || !isRecent(snapshot, now)) return null;
  if (hasNewerRecentPanicContext(scenarioData, snapshot, now)) return null;

  const goldenAction = classifyGoldenFollowUpPhrase(trimmed);
  if (goldenAction) return goldenAction;

  if (IDENTITY_RE.test(trimmed)) return "identity";
  if (AI_ORIGIN_RE.test(trimmed)) return "ai_origin";
  if (METHODOLOGY_RE.test(trimmed)) return "methodology";
  if (TRUSTED_PERSON_RE.test(trimmed)) return "trusted_person";
  if (RECHECK_RE.test(trimmed)) return "recheck";
  if (DISAGREEMENT_RE.test(trimmed)) return "disagreement";
  if (CONTACTS_RE.test(trimmed) && !REPORT_CONTEXT_RE.test(trimmed)) return "contacts";
  if (NEXT_STEPS_RE.test(trimmed)) return "next_steps";
  if (SIMPLE_EXPLAIN_RE.test(trimmed)) return "simple_explain";
  if (EXPLAIN_RE.test(trimmed)) return "explain";
  if (
    CONFIDENCE_RE.test(trimmed) ||
    EXTENDED_CONFIDENCE_RE.test(trimmed) ||
    QR_OPEN_RE.test(trimmed)
  )
    return "confidence";
  if (CONFIRMATION_REQUEST_RE.test(trimmed)) return "confirmation_request";
  if (ACKNOWLEDGEMENT_RE.test(trimmed)) return "acknowledgement";
  return null;
}

export function classifyOrphanCheckFollowUp(text: string): LastCheckFollowUpAction | null {
  const trimmed = text.trim();
  if (!trimmed || hasNewCheckPayload(trimmed)) return null;

  const goldenAction = classifyGoldenFollowUpPhrase(trimmed);
  if (goldenAction && goldenAction !== "acknowledgement") return goldenAction;

  if (IDENTITY_RE.test(trimmed)) return "identity";
  if (AI_ORIGIN_RE.test(trimmed)) return "ai_origin";
  if (METHODOLOGY_RE.test(trimmed)) return "methodology";
  if (TRUSTED_PERSON_RE.test(trimmed)) return "trusted_person";
  if (RECHECK_RE.test(trimmed)) return "recheck";
  if (DISAGREEMENT_RE.test(trimmed)) return "disagreement";
  if (CONTACTS_RE.test(trimmed) && !REPORT_CONTEXT_RE.test(trimmed)) return "contacts";
  if (NEXT_STEPS_RE.test(trimmed)) return "next_steps";
  if (SIMPLE_EXPLAIN_RE.test(trimmed)) return "simple_explain";
  if (EXPLAIN_RE.test(trimmed)) return "explain";
  if (
    CONFIDENCE_RE.test(trimmed) ||
    EXTENDED_CONFIDENCE_RE.test(trimmed) ||
    QR_OPEN_RE.test(trimmed)
  )
    return "confidence";
  if (CONFIRMATION_REQUEST_RE.test(trimmed)) return "confirmation_request";
  return null;
}

export function classifyAcknowledgementFollowUp(text: string): "acknowledgement" | null {
  const trimmed = text.trim();
  if (!trimmed || hasNewCheckPayload(trimmed)) return null;
  if (classifyGoldenFollowUpPhrase(trimmed) === "acknowledgement") return "acknowledgement";
  return ACKNOWLEDGEMENT_RE.test(trimmed) ? "acknowledgement" : null;
}

function levelText(level: RiskLevel, lang: Lang): string {
  const dict: Record<RiskLevel, Record<Lang, string>> = {
    safe: {
      ru: "явных опасных признаков не видно",
      uz: "aniq xavf belgisi ko'rinmayapti",
      en: "I do not see obvious danger signs",
    },
    unknown: {
      ru: "точного вывода пока нет",
      uz: "hozircha aniq xulosa yo'q",
      en: "there is not enough evidence for a precise verdict",
    },
    suspicious: {
      ru: "есть подозрительные признаки",
      uz: "shubhali belgilar bor",
      en: "there are suspicious signs",
    },
    high_risk: {
      ru: "риск высокий",
      uz: "xavf yuqori",
      en: "the risk is high",
    },
  };
  return dict[level][lang];
}

function bankContacts(lang: Lang): string {
  const contacts = VERIFIED_CONTACTS.filter(
    (contact) =>
      (contact.orgType === "bank" || contact.orgType === "payment_system") &&
      contact.contactType === "short_code",
  ).slice(0, 6);

  return contacts.map((contact) => `• ${contact.org[lang]} — ${contact.display}`).join("\n");
}

function confidenceText(snapshot: LastCheckSnapshot, lang: Lang): string {
  if (lang === "uz") {
    if (snapshot.level === "high_risk") {
      return "Men buni xavfli holatdek qabul qilgan bo'lardim.\n\nHozir:\n1. Suhbatni to'xtating.\n2. SMS-kod, karta, parol yoki login bermang.\n3. Bankka faqat rasmiy raqam orqali qo'ng'iroq qiling.\n\nAgar bu xato bo'lsa ham, bu qadamlar sizga zarar qilmaydi.";
    }
    if (snapshot.context === "image_unreadable") {
      return "Bu rasm bo'yicha aniq ayta olmayman: matn yoki QR ishonchli o'qilmadi.\n\nMen xavfni o'ylab topmayman. Aniq tekshirish uchun SMS/chat matnini, QR ochadigan havolani yoki sizdan nima so'rashganini yuboring.";
    }
    if (snapshot.context === "qr_menu") {
      return `Aniq kafolat bera olmayman. Ko'rinib turgan rasm bo'yicha ${levelText(snapshot.level, lang)}: bu menyu yoki ma'lumot beruvchi QRga o'xshaydi.\n\nQRni ochsangiz, sahifa manzilini tekshiring. SMS-kod, karta ma'lumoti, login yoki to'lov so'ralsa — to'xtang va keyingi ekran skrinini yuboring.`;
    }
    if (snapshot.context === "delivery") {
      return `Aniq kafolat emas, lekin ko'rinib turgan ma'lumot bo'yicha ${levelText(snapshot.level, lang)}.\n\nHavola, to'lov, APK yoki kod so'rovi paydo bo'lsa — uni alohida yuboring.`;
    }
    if (snapshot.context === "phone") {
      return `Raqamning o'zi yakuniy dalil emas: ${levelText(snapshot.level, lang)}.\n\nAgar suhbatda kod, pul, karta yoki ilova so'ralgan bo'lsa, nima deyishganini qisqacha yozing.`;
    }
    if (snapshot.context === "telegram_profile") {
      return `100% kafolat bera olmayman: Telegram profili yoki kanal bo'yicha faqat ochiq belgilar ko'rinadi. Hozirgi natija: ${levelText(snapshot.level, lang)}.\n\nMuhimi profil emas, u nima so'rayotgani: kod, pul, karta, APK yoki bosim bo'lsa — to'xtang va xabarni yuboring.`;
    }
    return `100% kafolat emas: men faqat ko'rinib turgan belgilarni tekshiraman. Hozirgi natija bo'yicha ${levelText(snapshot.level, lang)}.\n\nAgar kod, karta, APK, login yoki to'lov so'ralsa — to'xtang va shu xabarni yuboring.`;
  }

  if (lang === "en") {
    if (snapshot.level === "high_risk") {
      return "I would treat this as risky.\n\nRight now:\n1. Stop the conversation.\n2. Do not share SMS codes, card data, passwords, or logins.\n3. Call your bank only using an official number.\n\nEven if it turns out to be harmless, these steps do not hurt you.";
    }
    if (snapshot.context === "image_unreadable") {
      return "I cannot be sure from that image: the text or QR was not readable enough.\n\nI will not invent a risk from a blurry picture. For a precise check, send the SMS/chat text, the link opened by the QR, or what they ask you to do.";
    }
    if (snapshot.context === "qr_menu") {
      return `I cannot guarantee it 100%. Based on the visible screenshot, ${levelText(snapshot.level, lang)}: it looks like a menu or informational QR.\n\nIf you open it, check the page address. If it asks for an SMS code, card data, login, or payment, stop and send me the next screen.`;
    }
    if (snapshot.context === "delivery") {
      return `Not a 100% guarantee, but from the visible details ${levelText(snapshot.level, lang)}.\n\nIf a link, payment, APK, or code request appears, send that separately.`;
    }
    if (snapshot.context === "phone") {
      return `The number alone is not final proof: ${levelText(snapshot.level, lang)}.\n\nIf the caller asked for a code, money, card data, or an app, briefly describe the call.`;
    }
    if (snapshot.context === "telegram_profile") {
      return `I cannot guarantee it 100%: for a Telegram profile or channel I can only check visible/public signs. Previous result: ${levelText(snapshot.level, lang)}.\n\nWhat matters is the request: codes, money, card data, APKs, or pressure are the real danger signs.`;
    }
    return `Not a 100% guarantee: I check only visible risk signs. In the previous result, ${levelText(snapshot.level, lang)}.\n\nIf someone asks for a code, card data, APK, login, or payment, stop and send that message.`;
  }

  if (snapshot.level === "high_risk") {
    return "Я бы действовал как при реальном риске.\n\nСейчас:\n1. Остановите разговор.\n2. Не сообщайте SMS-код, карту, пароль или логин.\n3. Перезвоните в банк только по официальному номеру.\n\nДаже если тревога окажется ложной, эти шаги вам не навредят.";
  }
  if (snapshot.context === "image_unreadable") {
    return "По этой картинке я не могу сказать точно: текст или QR не прочитались достаточно надёжно.\n\nЯ не буду выдумывать риск по мутному скрину. Для точной проверки пришлите текст из SMS/чата, ссылку, которая открывается по QR, или коротко: что вас просят сделать.";
  }
  if (snapshot.context === "qr_menu") {
    return `Не могу гарантировать на 100%. По видимому скриншоту ${levelText(snapshot.level, lang)}: это похоже на меню или информационный QR.\n\nЕсли открываете QR — проверьте адрес страницы. Если попросят SMS-код, карту, логин или оплату, остановитесь и пришлите следующий экран.`;
  }
  if (snapshot.context === "delivery") {
    return `Это не 100% гарантия, но по видимым данным ${levelText(snapshot.level, lang)}.\n\nЕсли появится ссылка, оплата, APK или просьба назвать код — пришлите это отдельно.`;
  }
  if (snapshot.context === "phone") {
    return `Сам номер не даёт 100% вывода: ${levelText(snapshot.level, lang)}.\n\nЕсли в разговоре просили код, деньги, данные карты или приложение — кратко опишите, что именно сказали.`;
  }
  if (snapshot.context === "telegram_profile") {
    return `Не могу гарантировать на 100%: по Telegram-профилю или каналу я вижу только открытые признаки. По прошлой проверке ${levelText(snapshot.level, lang)}.\n\nГлавное — не сам профиль, а что он просит: код, деньги, карту, APK или давление. Если это есть, остановитесь и пришлите сообщение.`;
  }
  return `Это не 100% гарантия: я проверяю только видимые признаки. По прошлой проверке ${levelText(snapshot.level, lang)}.\n\nЕсли просят код, карту, APK, логин или оплату — остановитесь и пришлите это сообщение.`;
}

function methodologyText(snapshot: LastCheckSnapshot, lang: Lang): string {
  const reasonCodes = (snapshot.reasons ?? []).filter(
    (reason): reason is ReasonCode => reason in INLINE_REASON_POLICY,
  );
  const presented = presentInlineReason(reasonCodes, lang);

  if (lang === "uz") {
    if (!presented) {
      return "Oldingi natija ko'rinadigan ma'lumotdagi deterministik xavf qoidalariga asoslangan. Aniq xavf sababi saqlanmagan, shuning uchun usulni o'ylab topmayman.\n\nAniq qayta tekshirish uchun link, matn yoki skrinshotni yana yuboring.";
    }
    return `Oldingi natijani shunday oldim:\n${presented.evidence}\n\nCheklov: ${presented.limitation}\n\nMen yashirin egani yoki yuboruvchi shaxsini tekshirmadim; faqat ko'rinadigan ma'lumot va ko'rsatilgan manbadan foydalandim.`;
  }
  if (lang === "en") {
    if (!presented) {
      return "The previous result used deterministic risk rules on visible submitted data. No specific risk reason was retained, so I will not invent a method.\n\nFor a precise recheck, send the link, text, or screenshot again.";
    }
    return `How I got the previous result:\n${presented.evidence}\n\nLimitation: ${presented.limitation}\n\nI did not verify a hidden owner or sender identity; I used only visible submitted data and the stated source.`;
  }
  if (!presented) {
    return "Прошлый результат основан на детерминированных правилах риска по видимым данным. Конкретная причина риска не сохранилась, поэтому я не буду придумывать метод.\n\nДля точной перепроверки пришлите ссылку, текст или скриншот заново.";
  }
  return `Вот как я получил прошлый результат:\n${presented.evidence}\n\nОграничение: ${presented.limitation}\n\nЯ не проверял скрытого владельца или личность отправителя — использовал только видимые данные и указанный источник.`;
}

function trustedPersonText(lang: Lang): string {
  if (lang === "uz") {
    return "Ha, albatta. Yaqin yoki ishonchli odam bilan o'zingiz bog'laning: saqlangan raqamga qo'ng'iroq qiling va vaziyatni birga tekshiring.\n\nUnga SMS-kod, PIN, CVV, parol, karta rasmi yoki shubhali fayl yubormang. Bu oddiy xabar yaqin odamga avtomatik signal yubormaydi.";
  }
  if (lang === "en") {
    return "Yes. Contact someone you trust yourself: call a saved number and review the situation together.\n\nDo not forward SMS codes, PINs, CVV, passwords, card photos, or suspicious files. This ordinary message does not automatically notify anyone.";
  }
  return "Да. Свяжитесь с близким сами: позвоните по сохранённому номеру и спокойно проверьте ситуацию вместе.\n\nНе пересылайте ему SMS-коды, PIN, CVV, пароли, фото карты или подозрительные файлы. Обычная фраза в чате никому автоматически сигнал не отправляет.";
}

function recheckText(lang: Lang): string {
  if (lang === "uz") {
    return "Qayta tekshiraman, lekin maxfiylik sabab oldingi link, matn yoki skrinshotni saqlamayman. Shu materialni yana yuboring — u yangi tekshiruvdan o'tadi.\n\nYangi dalilsiz oldingi natijani o'zgartirmayman va tekshiruv bo'lib o'tgandek ko'rsatmayman.";
  }
  if (lang === "en") {
    return "I can recheck it, but for privacy I do not keep the original link, text, or screenshot. Send the item again and it will go through a new check.\n\nWithout new evidence I will not change the previous result or pretend a recheck happened.";
  }
  return "Могу перепроверить, но ради приватности я не храню исходную ссылку или текст, а также скриншот. Пришлите заново ссылку, текст или скриншот — материал пройдёт новую проверку.\n\nБез новых данных я не изменю прошлый результат и не буду делать вид, что перепроверка уже состоялась.";
}

function disagreementText(snapshot: LastCheckSnapshot, lang: Lang): string {
  if (lang === "uz") {
    return `Siz bu natijaga qo'shilmasligingiz mumkin. Bu ayblov emas, ko'rinadigan belgilar bo'yicha ehtiyotkor baho: ${levelText(snapshot.level, lang)}.\n\nMustaqil tekshiring: xabardagi kontakt orqali emas, rasmiy ilova, sayt yoki saqlangan raqamdan foydalaning. Qo'shimcha kontekst bo'lsa, uni yangi tekshiruvga yuboring.`;
  }
  if (lang === "en") {
    return `You may disagree with this result. It is not an accusation; it is a cautious assessment of visible signals: ${levelText(snapshot.level, lang)}.\n\nVerify independently through the official app, website, or a saved number—not through the contact in the message. Send additional context as a new check.`;
  }
  return `Вы можете не соглашаться с результатом. Это не обвинение, а осторожная оценка видимых признаков: ${levelText(snapshot.level, lang)}.\n\nПроверьте независимо — через официальное приложение, сайт или сохранённый номер, а не контакт из сообщения. Дополнительный контекст пришлите как новую проверку.`;
}

function highRiskNextStepsText(snapshot: LastCheckSnapshot, lang: Lang): string {
  const reasonBoundActions = filterAdvice("high_risk", snapshot.reasons ?? [], lang);
  const fallback: Record<Lang, string[]> = {
    ru: [
      "Остановите разговор или контакт и не выполняйте просьбу из сообщения или звонка",
      "Проверьте организацию или человека независимо — не через присланный контакт",
    ],
    uz: [
      "Muloqotni to'xtating va xabar yoki qo'ng'iroqdagi so'rovni bajarmang",
      "Tashkilot yoki odamni yuborilgan kontakt orqali emas, mustaqil tekshiring",
    ],
    en: [
      "Stop the interaction and do not carry out the request in the message or call",
      "Verify the organization or person independently, not through the supplied contact",
    ],
  };
  const actions = reasonBoundActions.length > 0 ? reasonBoundActions : fallback[lang];
  const heading: Record<Lang, string> = {
    ru: "Следующий безопасный шаг:",
    uz: "Keyingi xavfsiz qadam:",
    en: "Next safe step:",
  };
  const resend: Record<Lang, string> = {
    ru: "Новый экран, ссылку или просьбу пришлите как отдельную проверку.",
    uz: "Yangi ekran, havola yoki so'rovni alohida tekshiruv sifatida yuboring.",
    en: "Send any new screen, link, or request as a separate check.",
  };

  return `${heading[lang]}\n${actions.map((action, index) => `${index + 1}. ${action}`).join("\n")}\n${actions.length + 1}. ${resend[lang]}`;
}

function nextStepsText(snapshot: LastCheckSnapshot, lang: Lang): string {
  if (lang === "uz") {
    if (snapshot.context === "image_unreadable") {
      return "Keyingi qadam:\n1. SMS/chat matnini qo'lda yuboring.\n2. QR ochilsa, ochilgan havolani yuboring.\n3. Agar faqat video/rasm bo'lsa, QR, username, rekvizit yoki va'da ko'ringan yaqinroq skrin yuboring.";
    }
    if (snapshot.level === "high_risk") {
      return highRiskNextStepsText(snapshot, lang);
    }
    if (snapshot.context === "qr_menu") {
      return "Keyingi qadam:\n1. QR ochilsa, manzilni tekshiring.\n2. Kod, karta, login yoki to'lov so'ralsa — to'xtang.\n3. Shubhali ekran chiqsa, skrinshot yuboring.";
    }
    if (snapshot.context === "phone") {
      return "Keyingi qadam:\n1. Raqamga qarab xulosa qilmang.\n2. Agar qo'ng'iroq bo'lgan bo'lsa, nima so'rashganini yozing.\n3. Kod, pul yoki ilova so'ralsa — suhbatni to'xtating va rasmiy raqamga qo'ng'iroq qiling.";
    }
    if (snapshot.context === "telegram_profile") {
      return "Keyingi qadam:\n1. Profilga qarab yakuniy xulosa qilmang.\n2. U so'ragan narsani tekshiring: kod, pul, karta, APK yoki havola.\n3. Shubhali xabar, skrinshot yoki linkni alohida yuboring.";
    }
    return "Keyingi qadam:\n1. Agar havola, kod, karta yoki to'lov bo'lmasa — kuzating.\n2. Yangi xabar yoki so'rov paydo bo'lsa, alohida yuboring.\n3. Shoshirishsa yoki qo'rqitishsa — bu xavf belgisi.";
  }

  if (lang === "en") {
    if (snapshot.context === "image_unreadable") {
      return "Next step:\n1. Paste the SMS/chat text manually.\n2. If it is a QR, send the link it opens.\n3. If it is only a video/image, send a closer screenshot showing the QR, username, payment details, or promise.";
    }
    if (snapshot.level === "high_risk") {
      return highRiskNextStepsText(snapshot, lang);
    }
    if (snapshot.context === "qr_menu") {
      return "Next step:\n1. If you open the QR, check the page address.\n2. If it asks for a code, card, login, or payment — stop.\n3. If another screen looks suspicious, send a screenshot.";
    }
    if (snapshot.context === "phone") {
      return "Next step:\n1. Do not judge by the number alone.\n2. If it was a call, write what they asked you to do.\n3. If they ask for a code, money, or an app — hang up and call an official number.";
    }
    if (snapshot.context === "telegram_profile") {
      return "Next step:\n1. Do not judge by the profile alone.\n2. Check what it asks for: codes, money, card data, APKs, or links.\n3. Send the suspicious message, screenshot, or link separately.";
    }
    return "Next step:\n1. If there is no link, code, card, or payment request, watch calmly.\n2. Send any new message or request separately.\n3. Pressure or threats are a warning sign.";
  }

  if (snapshot.context === "image_unreadable") {
    return "Следующий шаг:\n1. Пришлите текст из SMS/чата вручную.\n2. Если это QR — пришлите ссылку, которая открывается.\n3. Если это видео/картинка — пришлите более близкий скрин, где видны QR, username, реквизиты или обещание.";
  }
  if (snapshot.level === "high_risk") {
    return highRiskNextStepsText(snapshot, lang);
  }
  if (snapshot.context === "qr_menu") {
    return "Следующий шаг:\n1. Если открываете QR — проверьте адрес страницы.\n2. Если просят код, карту, логин или оплату — остановитесь.\n3. Если появится новый подозрительный экран, пришлите скриншот.";
  }
  if (snapshot.context === "phone") {
    return "Следующий шаг:\n1. Не делайте вывод только по номеру.\n2. Если был звонок — напишите, что именно просили сделать.\n3. Если просят код, деньги или приложение — завершите разговор и звоните по официальному номеру.";
  }
  if (snapshot.context === "telegram_profile") {
    return "Следующий шаг:\n1. Не делайте вывод только по профилю.\n2. Смотрите, что именно он просит: код, деньги, карту, APK или ссылку.\n3. Подозрительное сообщение, скриншот или ссылку пришлите отдельно.";
  }
  return "Следующий шаг:\n1. Если нет ссылки, кода, карты или оплаты — спокойно наблюдайте.\n2. Новое сообщение или просьбу пришлите отдельно.\n3. Давление, срочность и угрозы — тревожный признак.";
}

function contactsText(lang: Lang): string {
  const contacts = bankContacts(lang);

  if (lang === "uz") {
    return `Rasmiy qayta qo'ng'iroq:\n1. Shubhali xabardagi yoki qo'ng'iroqdagi raqamga qo'ng'iroq qilmang.\n2. Raqamni karta orqasidan, bank ilovasidan yoki rasmiy saytdan oling.\n\nTekshirilgan qisqa raqamlar:\n${contacts}`;
  }
  if (lang === "en") {
    return `Official callback:\n1. Do not call the number from the suspicious message or incoming call.\n2. Use the number on your card, in the bank app, or on the official website.\n\nVerified short numbers:\n${contacts}`;
  }
  return `Официальный обратный звонок:\n1. Не звоните по номеру из подозрительного сообщения или входящего звонка.\n2. Возьмите номер с карты, из приложения банка или с официального сайта.\n\nПроверенные короткие номера:\n${contacts}`;
}

function reasonEvidence(snapshot: LastCheckSnapshot, lang: Lang): string {
  const reasonCodes =
    snapshot.level === "unknown"
      ? (snapshot.reasons ?? []).filter((code) => !TOPIC_ONLY_EXPLANATION_REASONS.has(code))
      : (snapshot.reasons ?? []);

  const labels = reasonCodes
    .map((code) => REASON_LABELS[code as ReasonCode]?.[lang])
    .filter((label): label is string => Boolean(label))
    .slice(0, 2);

  if (labels.length === 0) return "";

  if (lang === "uz") {
    return `\n\nNimani ko'rdim:\n${labels.map((label) => `• ${label}`).join("\n")}`;
  }
  if (lang === "en") {
    return `\n\nWhat I saw:\n${labels.map((label) => `• ${label}`).join("\n")}`;
  }
  return `\n\nЧто я увидел:\n${labels.map((label) => `• ${label}`).join("\n")}`;
}

const SIMPLE_REASON_LABELS: Record<string, Record<Lang, string>> = {
  asks_for_sms_code: {
    ru: "просят код из SMS",
    uz: "SMS-kod so'ralyapti",
    en: "they ask for an SMS code",
  },
  asks_for_card_cvv: {
    ru: "просят данные карты или CVV",
    uz: "karta ma'lumoti yoki CVV so'ralyapti",
    en: "they ask for card data or CVV",
  },
  asks_to_transfer_to_safe_account: {
    ru: "просят перевести деньги",
    uz: "pul o'tkazish so'ralyapti",
    en: "they ask you to transfer money",
  },
  asks_to_install_apk: {
    ru: "просят установить неизвестное приложение",
    uz: "noma'lum ilova o'rnatish so'ralyapti",
    en: "they ask you to install an unknown app",
  },
  asks_to_scan_qr: {
    ru: "просят войти или оплатить через QR",
    uz: "QR orqali kirish yoki to'lash so'ralyapti",
    en: "they ask you to log in or pay through a QR",
  },
  wallet_seed_phrase: {
    ru: "просят секретную фразу кошелька",
    uz: "hamyonning maxfiy iborasi so'ralyapti",
    en: "they ask for a wallet secret phrase",
  },
  brand_impersonation: {
    ru: "похожи на банк или службу, но это не доказано",
    uz: "bank yoki xizmat nomidan gapiryapti, lekin bu tasdiqlanmagan",
    en: "they look like a bank or service, but that is not proven",
  },
  impersonates_official: {
    ru: "выдают себя за официальную организацию",
    uz: "o'zini rasmiy tashkilotdek ko'rsatyapti",
    en: "they pretend to be an official organization",
  },
  keeps_user_on_call: {
    ru: "не дают спокойно положить трубку и проверить",
    uz: "xotirjam tekshirishga qo'ymayapti",
    en: "they do not let you hang up and check calmly",
  },
  urgency_pressure: {
    ru: "торопят или пугают",
    uz: "shoshiltiryapti yoki qo'rqityapti",
    en: "they rush or scare you",
  },
  suspicious_invite_link: {
    ru: "ведут по подозрительной ссылке",
    uz: "shubhali havolaga yo'naltiryapti",
    en: "they push a suspicious link",
  },
};

function simpleSignals(snapshot: LastCheckSnapshot, lang: Lang): string {
  const reasonCodes =
    snapshot.level === "unknown"
      ? (snapshot.reasons ?? []).filter((code) => !TOPIC_ONLY_EXPLANATION_REASONS.has(code))
      : (snapshot.reasons ?? []);

  const labels = reasonCodes
    .map((code) => SIMPLE_REASON_LABELS[code]?.[lang])
    .filter((label): label is string => Boolean(label))
    .slice(0, 2);

  if (labels.length === 0) return "";

  if (lang === "uz") return `\n\nMen ko'rgan belgi: ${labels.join("; ")}.`;
  if (lang === "en") return `\n\nThe sign I saw: ${labels.join("; ")}.`;
  return `\n\nЧто я заметил: ${labels.join("; ")}.`;
}

function simpleReasonText(snapshot: LastCheckSnapshot, lang: Lang): string {
  if (lang === "uz") {
    if (snapshot.context === "image_unreadable") {
      return "Rasm xira: men matn yoki QRni ishonchli o'qiy olmadim. Shuning uchun xavfni o'ylab topmayman.";
    }
    if (snapshot.level === "high_risk") {
      return "Bu holat kalitni notanish odamga berishga o'xshaydi. Kod, karta, parol, APK yoki QR-kirish pulingiz yoki akkauntingizga yo'l ochishi mumkin.";
    }
    if (snapshot.context === "qr_menu") {
      return "QRning o'zi xavf emas. U eshikdek: xavf keyingi sahifada kod, karta, login yoki to'lov so'ralsa boshlanadi.";
    }
    if (snapshot.context === "phone") {
      return "Raqamning o'zi odam kimligini isbotlamaydi. Muhimi: qo'ng'iroqda kod, pul, karta yoki ilova so'ralganmi.";
    }
    if (snapshot.context === "telegram_profile") {
      return "Telegram profili yolg'iz o'zi isbot emas. Muhimi: akkaunt sizdan kod, pul, karta, APK yoki havola so'rayaptimi.";
    }
    if (snapshot.context === "crypto") {
      return "Kripto mavzusi o'zi firibgarlik emas. Lekin tez foyda, depozit yoki pul chiqarish komissiyasi ko'pincha tuzoq bo'ladi.";
    }
    if (snapshot.level === "unknown") {
      return "Hozir faktlar kam. Bu xavfsiz degani ham emas, firibgarlik degani ham emas.";
    }
    if (snapshot.level === "suspicious") {
      return "Bu xabarda ehtiyot bo'lish kerak bo'lgan belgilar bor. Odatda keyin kod, karta, to'lov yoki ilova so'ralishi mumkin.";
    }
    return "Yuborgan narsangizda aniq xavfli iltimos ko'rinmadi. Lekin keyingi xabarlarda kod, karta yoki to'lov so'ralsa, to'xtang.";
  }

  if (lang === "en") {
    if (snapshot.context === "image_unreadable") {
      return "The image was not clear enough: I could not reliably read the text or QR. So I will not invent danger.";
    }
    if (snapshot.level === "high_risk") {
      return "This is like giving a key to a stranger. A code, card data, password, APK, or QR login can open access to your money or account.";
    }
    if (snapshot.context === "qr_menu") {
      return "A QR code itself is not dangerous. It is like a door: risk starts if the next page asks for a code, card data, login, or payment.";
    }
    if (snapshot.context === "phone") {
      return "The number alone does not prove who the person is. What matters is whether the call asked for a code, money, card data, or an app.";
    }
    if (snapshot.context === "telegram_profile") {
      return "A Telegram profile alone is not proof. What matters is whether it asks for a code, money, card data, an APK, or a link.";
    }
    if (snapshot.context === "crypto") {
      return "Crypto itself is not fraud. But fast profit, deposits, or withdrawal fees are often used as a trap.";
    }
    if (snapshot.level === "unknown") {
      return "There are too few facts right now. That does not mean it is safe, and it does not mean it is fraud.";
    }
    if (snapshot.level === "suspicious") {
      return "I see signs that mean you should slow down. These situations often lead to a code, card, payment, or app request.";
    }
    return "I did not see an obviously dangerous request in what you sent. But if the next message asks for a code, card data, or payment, stop.";
  }

  if (snapshot.context === "image_unreadable") {
    return "Картинка была недостаточно понятной: я не смог надёжно прочитать текст или QR. Поэтому я не придумываю опасность.";
  }
  if (snapshot.level === "high_risk") {
    return "Это похоже на ситуацию, где незнакомцу могут дать ключ от ваших денег или аккаунта. Код, карта, пароль, APK или вход через QR могут открыть доступ мошенникам.";
  }
  if (snapshot.context === "qr_menu") {
    return "Сам QR не опасен. Он как дверь: риск начинается, если за этой дверью просят код, карту, логин или оплату.";
  }
  if (snapshot.context === "phone") {
    return "Номер сам по себе не доказывает, кто звонит. Главное - просили ли в разговоре код, деньги, карту или приложение.";
  }
  if (snapshot.context === "telegram_profile") {
    return "Профиль в Telegram сам по себе не доказательство. Главное - просит ли он код, деньги, карту, APK или перейти по ссылке.";
  }
  if (snapshot.context === "crypto") {
    return "Крипто само по себе не скам. Но быстрый доход, депозит или комиссия за вывод часто бывают приманкой.";
  }
  if (snapshot.level === "unknown") {
    return "Пока мало фактов. Это не значит, что всё безопасно, и не значит, что это точно скам.";
  }
  if (snapshot.level === "suspicious") {
    return "Я вижу признаки, из-за которых лучше не спешить. Часто после таких сообщений просят код, карту, оплату или приложение.";
  }
  return "В том, что вы прислали, я не увидел явной опасной просьбы. Но если дальше попросят код, карту или оплату - остановитесь.";
}

function simpleActionText(snapshot: LastCheckSnapshot, lang: Lang): string {
  if (lang === "uz") {
    if (snapshot.context === "image_unreadable") {
      return "Xavfsiz qadam: xabar matnini, QR ochadigan havolani yoki sizdan nima so'ralganini yozib yuboring.";
    }
    if (snapshot.level === "high_risk") {
      return "Hozir xavfsiz qadam:\n1. Suhbatni to'xtating.\n2. Kod, karta, parol yoki hujjat rasmini yubormang.\n3. Faqat rasmiy ilova yoki rasmiy raqam orqali tekshiring.";
    }
    if (snapshot.level === "unknown") {
      return "Xavfsiz qadam: aniq xabar, link yoki skrin yuboring. Ungacha kod, karta yoki pul bermang.";
    }
    return "Xavfsiz qadam: shoshilmang. Kod, karta, parol, APK yoki pul so'ralsa - darhol to'xtang va shu xabarni yuboring.";
  }

  if (lang === "en") {
    if (snapshot.context === "image_unreadable") {
      return "Safe step: send the message text, the link opened by the QR, or what they asked you to do.";
    }
    if (snapshot.level === "high_risk") {
      return "Safe step now:\n1. Stop the conversation.\n2. Do not send codes, card data, passwords, or document photos.\n3. Check only through the official app or official number.";
    }
    if (snapshot.level === "unknown") {
      return "Safe step: send the exact message, link, or screenshot. Until then, do not share codes, card data, or money.";
    }
    return "Safe step: slow down. If they ask for a code, card data, password, APK, or money, stop and send that message here.";
  }

  if (snapshot.context === "image_unreadable") {
    return "Безопасный шаг: пришлите текст сообщения, ссылку из QR или словами, что вас просят сделать.";
  }
  if (snapshot.level === "high_risk") {
    return "Безопасный шаг сейчас:\n1. Прекратите разговор.\n2. Не отправляйте код, карту, пароль или фото документов.\n3. Проверяйте только через официальное приложение или официальный номер.";
  }
  if (snapshot.level === "unknown") {
    return "Безопасный шаг: пришлите точный текст, ссылку или скриншот. До этого не сообщайте код, карту и не переводите деньги.";
  }
  return "Безопасный шаг: не спешите. Если попросят код, карту, пароль, APK или деньги - остановитесь и пришлите это сообщение сюда.";
}

function simpleExplainText(snapshot: LastCheckSnapshot, lang: Lang): string {
  const reason = simpleReasonText(snapshot, lang);
  const signals = simpleSignals(snapshot, lang);
  const action = simpleActionText(snapshot, lang);

  if (lang === "uz") {
    return `Oddiy qilib tushuntiraman.\n\n${reason}${signals}\n\n${action}`;
  }
  if (lang === "en") {
    return `In simple words.\n\n${reason}${signals}\n\n${action}`;
  }
  return `Объясню совсем просто.\n\n${reason}${signals}\n\n${action}`;
}

function explainText(snapshot: LastCheckSnapshot, lang: Lang): string {
  const evidence = reasonEvidence(snapshot, lang);

  if (lang === "uz") {
    if (snapshot.context === "image_unreadable") {
      return "Sabab: rasmda matn/QR yetarlicha aniq ko'rinmadi. Bunday holatda men xavfni taxmin qilib aytmayman.\n\nEng yaxshi dalil: xabar matni, QR havolasi yoki sizdan nima so'ralgani.";
    }
    if (snapshot.context === "qr_menu") {
      return `Qisqacha: QRning o'zi firibgarlik emas. Men ko'rinib turgan kontekstni baholadim: menyu/ma'lumot QRga o'xshaydi. Natija: ${levelText(snapshot.level, lang)}.\n\nXavf keyingi sahifada kod, karta, login yoki to'lov so'ralsa paydo bo'ladi.${evidence}`;
    }
    if (snapshot.context === "phone") {
      return `Qisqacha: raqamning o'zi dalil emas. Men egasini yashirin bazadan bilmayman; xavf suhbatda nima so'ralganiga bog'liq. Natija: ${levelText(snapshot.level, lang)}.${evidence}`;
    }
    if (snapshot.context === "telegram_profile") {
      return `Qisqacha: Telegram menga yashirin SCAM belgisi, akkaunt yoshi, shikoyatlar tarixi yoki kimga yozganini ko'rsatmaydi. Shuning uchun @username yakka o'zi xavfsizlikni ham, firibgarlikni ham isbotlamaydi. Men faqat ochiq belgilar va siz yuborgan matn/skrinlarni tekshiraman. Natija: ${levelText(snapshot.level, lang)}.${evidence}`;
    }
    if (snapshot.context === "crypto") {
      return `Qisqacha: kripto/investitsiya mavzusi yolg'iz o'zi firibgarlik emas. Lekin tez daromad, bepul start, pulli signal, depozit yoki «yechish komissiyasi» ko'pincha savdo voronkasining belgisi. Natija: ${levelText(snapshot.level, lang)}.${evidence}`;
    }
    return `Qisqacha: men oldingi xabarda ko'rinib turgan xavf belgilarini tekshirdim. Natija: ${levelText(snapshot.level, lang)}.${evidence}\n\nMen ichki ballarni ko'rsatmayman. Muhimi: kod, karta, parol, APK, pul o'tkazish yoki bosim bo'lsa — xavf oshadi.`;
  }
  if (lang === "en") {
    if (snapshot.context === "image_unreadable") {
      return "Reason: the image did not show readable text/QR clearly enough. In that case I do not guess or invent a threat.\n\nBest evidence: the message text, QR link, or what they ask you to do.";
    }
    if (snapshot.context === "qr_menu") {
      return `Briefly: a QR code itself is not fraud. I checked the visible context: it looked like a menu or informational QR. Result: ${levelText(snapshot.level, lang)}.\n\nRisk starts on the next page if it asks for a code, card data, login, or payment.${evidence}`;
    }
    if (snapshot.context === "phone") {
      return `Briefly: the number itself is not proof. I cannot identify the owner from a hidden database; risk depends on what the caller asked for. Result: ${levelText(snapshot.level, lang)}.${evidence}`;
    }
    if (snapshot.context === "telegram_profile") {
      return `Briefly: Telegram does not show me hidden SCAM labels, account age, complaint history, or who the account messaged. So a @username alone proves neither safety nor fraud. I check only public signs and the text/screenshots you send. Result: ${levelText(snapshot.level, lang)}.${evidence}`;
    }
    if (snapshot.context === "crypto") {
      return `Briefly: crypto/investment alone is not fraud. But fast profit, free start, paid signals, deposit, or a “withdrawal fee” are common funnel signs. Result: ${levelText(snapshot.level, lang)}.${evidence}`;
    }
    return `Briefly: I checked the visible risk signs in the previous item. Result: ${levelText(snapshot.level, lang)}.${evidence}\n\nI do not show internal scores. What matters: codes, card data, passwords, APKs, transfers, and pressure increase risk.`;
  }
  if (snapshot.context === "image_unreadable") {
    return "Причина: на изображении не было достаточно читаемого текста или QR. В такой ситуации я не угадываю и не придумываю угрозу.\n\nЛучшее доказательство: текст сообщения, ссылка из QR или короткое описание, что вас просят сделать.";
  }
  if (snapshot.context === "qr_menu") {
    return `Коротко: сам QR не является скамом. Я оценил видимый контекст: похоже на меню или информационный QR. Итог: ${levelText(snapshot.level, lang)}.\n\nРиск начинается на следующей странице, если там просят код, карту, логин или оплату.${evidence}`;
  }
  if (snapshot.context === "phone") {
    return `Коротко: сам номер не доказательство. Я не узнаю владельца из скрытой базы; риск зависит от того, что просили в разговоре. Итог: ${levelText(snapshot.level, lang)}.${evidence}`;
  }
  if (snapshot.context === "telegram_profile") {
    return `Коротко: Telegram не показывает мне скрытую SCAM-метку, возраст аккаунта, историю жалоб и кому аккаунт писал. Поэтому один @username не доказывает ни безопасность, ни скам. Я проверяю только открытые признаки и текст/скриншоты, которые вы прислали. Итог: ${levelText(snapshot.level, lang)}.${evidence}`;
  }
  if (snapshot.context === "crypto") {
    return `Коротко: тема крипто/инвестиций сама по себе не скам. Но быстрый доход, «старт бесплатно», платные сигналы, депозит или «комиссия за вывод» часто бывают воронкой. Итог: ${levelText(snapshot.level, lang)}.${evidence}`;
  }
  return `Коротко: я проверил видимые признаки риска в прошлом сообщении. Итог: ${levelText(snapshot.level, lang)}.${evidence}\n\nЯ не показываю внутренние баллы. Главное: коды, карта, пароль, APK, перевод денег и давление повышают риск.`;
}

function aiOriginWhatMatters(context: string | undefined, lang: Lang): string {
  const dict: Record<string, Record<Lang, string>> = {
    qr_menu: {
      ru: "какой адрес откроется по QR и что на нём попросят",
      uz: "QR qaysi manzilni ochishi va u yerda nima so'ralishi",
      en: "what address the QR opens and what it asks for",
    },
    telegram_profile: {
      ru: "что именно этот аккаунт просит сделать",
      uz: "bu akkaunt aynan nima qilishni so'rayotgani",
      en: "what exactly this account asks you to do",
    },
    delivery: {
      ru: "куда ведёт ссылка и не просят ли оплату по карте",
      uz: "havola qayerga olib borishi va karta orqali to'lov so'ralayotgani",
      en: "where the link leads and whether it asks for card payment",
    },
    crypto: {
      ru: "не обещают ли быстрый доход и не просят ли депозит или seed-фразу",
      uz: "tez daromad va'da qilinayotgani, depozit yoki seed-ibora so'ralayotgani",
      en: "whether it promises fast profit or asks for a deposit or seed phrase",
    },
    phone: {
      ru: "что именно просили в разговоре — код, деньги, карту или приложение",
      uz: "suhbatda nima so'ralgani — kod, pul, karta yoki ilova",
      en: "what the call asked for — a code, money, card data, or an app",
    },
  };
  const fallback: Record<Lang, string> = {
    ru: "что именно вас просят сделать и какой адрес откроется по ссылке",
    uz: "sizdan nima so'ralayotgani va havola qaysi manzilni ochishi",
    en: "what you are asked to do and what address the link opens",
  };
  return (context ? dict[context]?.[lang] : undefined) ?? fallback[lang];
}

function aiOriginText(snapshot: LastCheckSnapshot, lang: Lang): string {
  const whatMatters = aiOriginWhatMatters(snapshot.context, lang);
  const visualMenuContext = snapshot.context === "qr_menu";
  if (lang === "uz") {
    if (visualMenuContext) {
      return `Ha, ko'rinishidan bu shablon yoki AI bilan tayyorlangan menyu/reklamaga o'xshashi mumkin. Lekin men buni fakt deb aytmayman: skrinshotdagi dizaynning o'zi firibgarlikni isbotlamaydi.\n\nXavfsizlik uchun muhimi — ${whatMatters}. Agar to'lov, SMS-kod, karta ma'lumoti yoki login so'ralsa — to'xtang va keyingi ekranni yuboring.`;
    }
    return `Rostini aytsam: bu AI yoki odam tomonidan qilinganini aniq ayta olmayman — menda ishonchli AI-detektor yo'q, va o'ylab topmayman. Lekin xavfsizlik uchun bu asosiy emas: «AI» ko'rinishining o'zi firibgarlikni isbotlamaydi.\n\nMuhimi — ${whatMatters}. Agar to'lov, SMS-kod, karta ma'lumoti yoki login so'ralsa — to'xtang va keyingi ekranni yuboring.`;
  }
  if (lang === "en") {
    if (visualMenuContext) {
      return `Yes, visually it may look like a template or AI-made menu/ad. I still won't state that as a fact: the design style alone does not prove a scam.\n\nFor safety, what matters is ${whatMatters}. If it asks for payment, an SMS code, card data, or a login — stop and send me the next screen.`;
    }
    return `Honestly: I can't reliably tell whether this was made by AI or a person — I have no trustworthy AI detector and I won't guess. But for safety it doesn't matter: an "AI" look alone does not prove a scam.\n\nWhat matters is ${whatMatters}. If it asks for payment, an SMS code, card data, or a login — stop and send me the next screen.`;
  }
  if (visualMenuContext) {
    return `Да, визуально это может быть шаблонный или AI-сделанный макет меню/рекламы. Но я не буду утверждать это как факт: сам стиль картинки не доказывает мошенничество.\n\nДля безопасности важнее другое — ${whatMatters}. Если попросят оплату, SMS-код, данные карты или вход — остановитесь и пришлите следующий экран.`;
  }
  return `Честно: я не берусь точно сказать, сделано это ИИ или человеком — у меня нет надёжного детектора AI, и я не хочу выдумывать. Но для безопасности это не главное: «AI-шный» вид сам по себе не доказывает мошенничество.\n\nВажно другое — ${whatMatters}. Если попросят оплату, SMS-код, данные карты или вход — остановитесь и пришлите следующий экран.`;
}

export function buildAcknowledgementFollowUpText(lang: Lang): string {
  if (lang === "uz") {
    return "Yaxshi. Men yoningizdaman. Shoshilmang, bitta xavfsiz qadamdan boring.\n\nKod, karta, parol yoki hujjat rasmini yubormang. Yangi havola, ekran yoki iltimos chiqsa — shu yerga yuboring, tekshiraman.";
  }
  if (lang === "en") {
    return "Good. I am here with you. Take it calmly, one safe step at a time.\n\nDo not send codes, card details, passwords, or document photos. If a new link, screen, or request appears, send it here and I will check it.";
  }
  return "Хорошо. Я рядом. Делайте спокойно, по одному безопасному шагу.\n\nНе отправляйте коды, карту, пароль или фото документов. Если появится новая ссылка, экран или просьба — пришлите сюда, я проверю.";
}

function confirmationRequestText(snapshot: LastCheckSnapshot | null, lang: Lang): string {
  const phoneContext = snapshot?.context === "phone";
  if (lang === "uz") {
    const channel = phoneContext
      ? "Bank yoki xizmatga faqat ilova, karta yoki rasmiy saytdagi raqam orqali qayta qo'ng'iroq qiling."
      : "Xizmatni faqat rasmiy ilova, sayt yoki ishonchli kontakt orqali tekshiring.";
    return `Tushundim. «Tasdiqlash» ko'pincha SMS-kod, ilovadagi push, QR orqali kirish yoki karta operatsiyasini anglatadi.\n\nAgar kirish, pul o'tkazma, «xavfsizlik» yoki karta operatsiyasini tasdiqlash so'ralsa — tasdiqlamang va suhbatni tugating. ${channel}`;
  }
  if (lang === "en") {
    const channel = phoneContext
      ? "Call back only using the number from the bank app, card, or official website."
      : "Verify only through the official app, website, or trusted contact.";
    return `Understood. A request to "confirm" often means an SMS code, an app push, QR login, or a card operation.\n\nIf they ask you to confirm a login, transfer, "security" action, or card operation, do not confirm it and end the conversation. ${channel}`;
  }
  const channel = phoneContext
    ? "Перезвоните только по номеру из приложения, карты или официального сайта."
    : "Проверяйте только через официальное приложение, сайт или доверенный контакт.";
  return `Понял. «Подтверждение» часто означает SMS-код, push в приложении, вход через QR или операцию по карте.\n\nЕсли вас просят подтвердить вход, перевод, «безопасность» или операцию по карте — не подтверждайте и завершите разговор. ${channel}`;
}

function identityText(lang: Lang): string {
  if (lang === "uz") {
    return "Men Ishonch Guardman. Men chatlaringizni o'zim o'qimayman — faqat shu yerga yuborgan narsangizni tekshiraman.\n\nRaqam, havola, username, skrinshot, ovozli xabar yoki shubhali matnni yuboring. Men xavf darajasi va bitta xavfsiz qadam bilan javob beraman.\n\nAgar hozir qo'ng'iroq qilishayotgan bo'lsa yoki kod yuborgan/pul o'tkazgan bo'lsangiz, /panic ni bosing.";
  }
  if (lang === "en") {
    return "I am Ishonch Guard. I do not read your chats on my own — I only check what you send here.\n\nSend a number, link, username, screenshot, voice message, or suspicious text. I will reply with a risk level and one safe next step.\n\nIf someone is calling right now, or you already sent a code or money, use /panic.";
  }
  return "Я Ishonch Guard. Я не читаю ваши чаты сам — проверяю только то, что вы присылаете сюда.\n\nПришлите номер, ссылку, username, скриншот, голосовое или текст подозрительного сообщения. Я отвечу уровнем риска и одним безопасным шагом.\n\nЕсли вам звонят прямо сейчас или вы уже сообщили код/перевели деньги — нажмите /panic.";
}

export function buildLastCheckFollowUpText(
  action: LastCheckFollowUpAction,
  snapshot: LastCheckSnapshot,
  lang: Lang,
): string {
  switch (action) {
    case "confidence":
      return confidenceText(snapshot, lang);
    case "methodology":
      return methodologyText(snapshot, lang);
    case "trusted_person":
      return trustedPersonText(lang);
    case "recheck":
      return recheckText(lang);
    case "disagreement":
      return disagreementText(snapshot, lang);
    case "next_steps":
      return nextStepsText(snapshot, lang);
    case "contacts":
      return contactsText(lang);
    case "explain":
      return explainText(snapshot, lang);
    case "simple_explain":
      return simpleExplainText(snapshot, lang);
    case "ai_origin":
      return aiOriginText(snapshot, lang);
    case "confirmation_request":
      return confirmationRequestText(snapshot, lang);
    case "acknowledgement":
      return buildAcknowledgementFollowUpText(lang);
    case "identity":
      return identityText(lang);
  }
}

export function buildOrphanCheckFollowUpText(action: LastCheckFollowUpAction, lang: Lang): string {
  if (action === "identity") return identityText(lang);
  if (action === "contacts") return contactsText(lang);
  if (action === "trusted_person") return trustedPersonText(lang);
  if (action === "recheck") return recheckText(lang);
  if (action === "confirmation_request") return confirmationRequestText(null, lang);
  if (action === "acknowledgement") return buildAcknowledgementFollowUpText(lang);
  if (action === "simple_explain") {
    if (lang === "uz") {
      return "Oddiy qilib aytganda: men faqat aniq tekshiruv bo'yicha tushuntira olaman.\n\nLink, raqam, username, skrinshot yoki xabar matnini yuboring. Hozircha kod, karta, parol yoki pul yubormang.";
    }
    if (lang === "en") {
      return "In simple words: I can explain only a concrete check.\n\nSend the link, number, username, screenshot, or message text. Until then, do not send codes, card data, passwords, or money.";
    }
    return "Совсем просто: я могу объяснить только конкретную проверку.\n\nПришлите ссылку, номер, username, скриншот или текст сообщения. Пока не отправляйте код, карту, пароль или деньги.";
  }
  if (action === "methodology") {
    if (lang === "uz") {
      return "Qaysi oldingi tekshiruv haqida so'rayotganingizni ko'rmayapman, shuning uchun usulni o'ylab topmayman. Link, matn yoki skrinshotni yana yuboring — keyin qaysi belgilar va manbalar ishlatilganini tushuntiraman.";
    }
    if (lang === "en") {
      return "I cannot see which previous check you mean, so I will not invent a method. Send the link, text, or screenshot again and I will explain which signals and sources were used.";
    }
    return "Я не вижу, о какой прошлой проверке речь, поэтому не буду придумывать метод. Пришлите ссылку, текст или скриншот заново — после проверки я объясню, какие признаки и источники использованы.";
  }
  if (action === "disagreement") {
    if (lang === "uz") {
      return "Siz natijaga qo'shilmasligingiz mumkin. Hozir qaysi tekshiruv haqida gap ketayotganini ko'rmayapman. Materialni yana yuboring va uni rasmiy kanal orqali mustaqil tekshiring.";
    }
    if (lang === "en") {
      return "You may disagree with a result. I cannot see which check you mean right now. Send the item again and verify it independently through an official channel.";
    }
    return "Вы можете не соглашаться с результатом. Сейчас я не вижу, о какой проверке речь. Пришлите материал заново и проверьте его независимо через официальный канал.";
  }

  if (action === "ai_origin") {
    if (lang === "uz") {
      return "Bir narsa AI yoki odam tomonidan qilinganini aniq ayta olmayman — va xavfsizlik uchun bu asosiy emas. Muhimi: havola qaysi manzilni ochishi va to'lov, SMS-kod yoki karta so'ralayotgani.\n\nTekshirish uchun havola, skrinshot yoki xabar matnini yuboring.";
    }
    if (lang === "en") {
      return "I can't reliably tell whether something was made by AI or a person — and for safety it doesn't matter. What matters is where a link leads and whether it asks for payment, an SMS code, or card data.\n\nSend the link, screenshot, or message text and I'll check it.";
    }
    return "Я не берусь точно сказать, сделано что-то ИИ или человеком — и для безопасности это не главное. Важно, какой адрес откроется по ссылке и не просят ли там оплату, SMS-код или данные карты.\n\nПришлите ссылку, скриншот или текст сообщения — я проверю.";
  }

  if (lang === "uz") {
    if (action === "confidence") {
      return "Qaysi tekshiruv haqida so'rayotganingiz ko'rinmayapti. Link, raqam, skrinshot yoki xabarni qayta yuboring — shu bo'yicha aniq javob beraman.\n\nAgar savol QR haqida bo'lsa: QRning o'zi xavf emas. Ochilgandan keyin kod, karta, login yoki to'lov so'ralsa — to'xtang va shu ekranni yuboring.";
    }
    if (action === "explain") {
      return "Men sababni faqat aniq tekshiruv bo'yicha tushuntira olaman. Iltimos, link, raqam, username, skrinshot yoki xabar matnini yuboring.\n\nAgar hozir bosim bo'lsa: kod, PIN, CVV, parol yoki karta ma'lumotlarini bermang.";
    }
    return "Hozir xavfsiz yo'l:\n1. SMS-kod, PIN, CVV, parol yoki karta ma'lumotlarini bermang.\n2. Noma'lum APK/ilovani o'rnatmang.\n3. Pul o'tkazmang va QR orqali login qilmang.\n4. Link, raqam, skrinshot yoki xabar matnini yuboring — men aniq tekshiraman.";
  }

  if (lang === "en") {
    if (action === "confidence") {
      return "I cannot see which previous check you mean. Send the link, number, screenshot, or message again and I will answer about that exact item.\n\nIf this is about a QR: the QR itself is not dangerous. If the next page asks for a code, card data, login, or payment, stop and send that screen.";
    }
    if (action === "explain") {
      return "I can explain the reason only for a concrete check. Please send the link, number, username, screenshot, or message text.\n\nIf someone is pressuring you now: do not share SMS codes, PIN, CVV, passwords, or card data.";
    }
    return "Safe step right now:\n1. Do not share SMS codes, PIN, CVV, passwords, or card data.\n2. Do not install unknown APKs/apps.\n3. Do not transfer money or log in through QR.\n4. Send the link, number, screenshot, or message text — I will check it precisely.";
  }

  if (action === "confidence") {
    return "Я не вижу, к какой именно проверке относится вопрос. Пришлите ссылку, номер, скриншот или сообщение ещё раз — отвечу по нему точно.\n\nЕсли вопрос про QR: сам QR не опасен. Опасно, если после открытия просят код, карту, логин или оплату. В таком случае остановитесь и пришлите следующий экран.";
  }
  if (action === "explain") {
    return "Я могу объяснить причину только по конкретной проверке. Пришлите ссылку, номер, username, скриншот или текст сообщения.\n\nЕсли на вас сейчас давят: не сообщайте SMS-код, PIN, CVV, пароль или данные карты.";
  }
  return "Безопасный шаг прямо сейчас:\n1. Не сообщайте SMS-код, PIN, CVV, пароль или данные карты.\n2. Не устанавливайте неизвестные APK/приложения.\n3. Не переводите деньги и не входите через QR.\n4. Пришлите ссылку, номер, скриншот или текст — я проверю точнее.";
}
