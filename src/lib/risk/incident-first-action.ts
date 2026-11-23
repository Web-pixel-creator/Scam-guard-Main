import { uzbekLatinMatchingVariant } from "./uz-cyrillic-translit";
import { normalizeIntentTextForMatching } from "@/lib/telegram/intent-text-normalization";

export const INCIDENT_ACTION = {
  reported_unauthorized_debit: {
    ru: "Сразу откройте приложение своего банка. Попросите поддержку оспорить списание. Не сообщайте SMS-код.",
    uz: "Bankingiz ilovasini oching. Yordam xizmatiga operatsiyani tasdiqlamaganingizni ayting. SMS kodini hech kimga aytmang.",
    en: "Open your bank’s own app now. Ask support to dispute the charge. Do not share your SMS code.",
  },
  carrier_command_already_dialed: {
    ru: "Откройте приложение своего оператора. Попросите поддержку проверить, изменились ли услуги или настройки номера. Не набирайте другие команды по просьбе звонящего.",
    uz: "Operatoringiz ilovasini oching. Yordam xizmatidan raqamingiz xizmatlari yoki sozlamalari o‘zgarganini tekshirishni so‘rang. Qo‘ng‘iroq qilgan odam aytgan boshqa buyruqlarni termang.",
    en: "Open your carrier’s app. Ask support to check whether any services or settings changed. Do not dial other codes at the caller’s request.",
  },
  relative_in_distress: {
    ru: "Пока не переводите деньги. Сами позвоните близкому по сохранённому номеру.",
    uz: "Pul yubormang. Yaqiningizga telefoningizda saqlangan raqam orqali o‘zingiz qo‘ng‘iroq qiling.",
    en: "Do not send money. Call your relative or friend back on their saved number. A familiar voice and caller ID do not prove who called.",
  },
  operator_requests_dial_code: {
    ru: "Не набирайте команду. Положите трубку. Для проверки откройте приложение своего оператора.",
    uz: "Kodni termang. Suhbatni tugating. Tekshirish uchun mobil operatoringiz ilovasini o‘zingiz oching.",
    en: "Do not dial the code. End the call and contact your carrier through its official app or website. Do not share SMS codes either.",
  },
} as const;
export type IncidentReason = keyof typeof INCIDENT_ACTION;
export const INCIDENT_LABEL = {
  reported_unauthorized_debit: {
    ru: "Вы сообщили о списании без вашего разрешения",
    uz: "Siz ruxsatsiz pul yechilganini aytdingiz",
    en: "You reported a charge you did not authorize",
  },
  carrier_command_already_dialed: {
    ru: "Вы уже набрали команду по просьбе звонящего",
    uz: "Qo‘ng‘iroq qilgan odam aytgan buyruqni tergansiz",
    en: "You already dialed the code the caller requested",
  },
  relative_in_distress: {
    ru: "Близкий срочно просит деньги",
    uz: "Yaqin inson shoshilinch pul so‘rayapti",
    en: "“Relative/friend in distress” money request",
  },
  operator_requests_dial_code: {
    ru: "От имени оператора просят набрать команду",
    uz: "Operator nomidan kod terishni so‘rashmoqda",
    en: "A caller claiming to be your carrier asks you to dial a code",
  },
} as const;

export function matchIncidentScript(text: string): IncidentReason | null {
  if (matchesFamilyMoneyCall(text)) return "relative_in_distress";
  const dial = operatorDialStage(text);
  if (dial)
    return dial === "done" ? "carrier_command_already_dialed" : "operator_requests_dial_code";
  return null;
}

// Positive first-person statements only, not quotes, questions or warnings.
export function normalizeIncidentText(text: string): string {
  // A line break may introduce a different speaker or a separate event.
  return normalizeIntentTextForMatching(text.replace(/[\r\n]+/gu, "; "));
}
const localAmount =
  /(?<![\p{L}\d])\d{1,12}(?: \d{3}){0,3}(?: (?:тысяч[аи]?|минг|ming|million))? (?:сум(?:ов|а)?|сўм|so'm|uzs)(?!\p{L})/giu;
const debitStatements = [
  /^(?:с моей (?:банковской )?карты|с моего сч[её]та|у меня) (?:только что |уже )?(?:списали|сняли) (?:деньги|средства) без (?:моего )?(?:разрешения|согласия)$/iu,
  /^(?:с (?:банковской )?карты|со сч[её]та) (?:только что |уже )?(?:списали|сняли) (?:деньги|средства) без моего (?:разрешения|согласия)$/iu,
  /^(?:kartamdan|hisobimdan) (?:(?:ruxsatsiz|ruxsatimsiz) pul|pul (?:ruxsatsiz|ruxsatimsiz)) y?ech(?:ildi|ib olindi)$/iu,
  /^(?:money (?:was taken|was debited) from my (?:bank )?(?:card|account)|my (?:bank )?(?:card|account) was charged) without my (?:permission|consent)$/iu,
];
export function reportsUnauthorizedDebit(text: string): boolean {
  if (!/(?:разрешения|согласия|ruxsat|permission|consent)/iu.test(text)) return false;
  const ownWords = text.replace(/«[^»]*(?:»|$)|“[^”]*(?:”|$)|"[^"]*(?:"|$)/gu, ";");
  return (ownWords.match(/[^.!?;\n]+[.!?]?/gu) ?? []).some((sentence) => {
    const ownStatement = stripNextStep(sentence.trim()).replace(/[.!]$/u, "").trim();
    const statement = ownStatement.replace(
      localAmount,
      /^(?:kartamdan|hisobimdan) /iu.test(ownStatement) ? "pul" : "деньги",
    );
    return debitStatements.some((pattern) => pattern.test(statement));
  });
}

// Strip only a question about the next step, not "I did it?" or "..., right?".
function stripNextStep(text: string): string {
  return text.replace(
    /,\s*(?:(?:а\s+)?что\s+(?:мне\s+)?(?:(?:теперь|дальше)\s+)?делать|(?:endi\s+)?nima\s+qil(?:ay|ishim kerak)|what\s+(?:now|(?:should|do)\s+i\s+do(?:\s+now)?))\s*\??$/iu,
    "",
  );
}

// Bind the request to the caller, not just two keywords in a paragraph.
// No biometric or caller-ID verification is implied.
const ruKin = "(?:внук|внуки|внучка|сын|дочь|дочка|мама|папа|брат|сестра|бабушка|дедушка|муж|жена)";
const ruCall = "(?:звонит|звонят|позвонил[аи]?)";
const enKin =
  "(?:grandson|granddaughter|son|daughter|mother|father|mom|mum|dad|sister|brother|grandmother|grandfather|grandma|grandpa|husband|wife)";
const enUrgent = "(?:urgently|immediately|right now|right away)";
const ruUrgent = "(?:срочно|немедленно|прямо сейчас)";
const ruPayment = "(?:перевести|отправить|переслать) (?:(?:ему|ей|им|мне) )?деньги";
const enPayment = "(?:send|wire|transfer) (?:(?:him|her|them|me) )?(?:some )?(?:money|cash|funds)";
const familyCallPatterns = [
  {
    caller: new RegExp(
      `(?<!\\p{L})(?:${ruKin} (?:мне )?${ruCall}|${ruCall} (?:мне )?(?:(?:мой|моя) )?${ruKin})(?!\\p{L})`,
      "iu",
    ),
    bridge:
      /^(?:\s+(?:мне|по видео(?:связи)?|со своего номера|с её номера|с его номера))?\s*,?\s*(?:и\s+)?/iu,
    demand: new RegExp(
      `^(?:просит|просят|попросил[аи]?) (?:меня )?(?:${ruUrgent} ${ruPayment}|${ruPayment} ${ruUrgent})(?!\\p{L})`,
      "iu",
    ),
    continuation: /^(?:он|она|они)\s+/iu,
  },
  {
    caller: new RegExp(
      `\\b${enKin} (?:is on a (?:video|phone) call|(?:is )?(?:video[- ]?)?calling(?: me)?|(?:video[- ]?)?called(?: me)?)\\b`,
      "iu",
    ),
    bridge:
      /^(?:\s+(?:from (?:her|his|their) (?:own |usual )?number|on (?:a )?video))?\s*,?\s*(?:and\s+)?/iu,
    demand: new RegExp(
      `^(?:asking|asks?|asked) (?:me |us )?(?:to )?(?:${enPayment} ${enUrgent}|${enUrgent} ${enPayment}|for (?:money|cash) ${enUrgent})\\b`,
      "iu",
    ),
    continuation: /^(?:she|he|they)\s+/iu,
  },
] as const;

function hasReportedFamilyCall(parts: string[], text: string): boolean {
  // Leave quoted examples, completed transfers and mixed credential/file
  // incidents to the existing contextual/aftercare paths.
  if (
    !/urgent|immediately|right (?:now|away)|срочно|немедленно|прямо сейчас/iu.test(text) ||
    /\b(?:already (?:sent|paid|transferred)|otp|apk|sms code)\b|(?<!\p{L})(?:уже (?:перев[её]л|отправил|оплатил)|смс[- ]?код|код из смс)/iu.test(
      text,
    )
  )
    return false;
  return parts.some((part, i) =>
    familyCallPatterns.some(({ caller, bridge, demand, continuation }) => {
      const match = caller.exec(part);
      if (!match) return false;
      if (
        /\b(?:if|imagine|hypothetically)\b|(?<!\p{L})(?:если|представим)(?!\p{L})/iu.test(
          part.slice(0, match.index),
        )
      )
        return false;
      const tail = part
        .slice(match.index + match[0].length)
        .replace(bridge, "")
        .trim();
      if (demand.test(tail)) return true;
      if (tail) return false;
      const next = parts[i + 1]?.trim() ?? "";
      return continuation.test(next) && demand.test(next.replace(continuation, ""));
    }),
  );
}

const uzKin = /\b(?:nabira(?:m|miz|ngiz)?|o'g'lim|qizim|onam|otam|akam|ukam|opam|singlim)\b/iu;
const uzRelativeCalled = new RegExp(
  "^" + uzKin.source + "\\s+(?:telefon qildi|(?:video)?qo'ng'iroq qildi)$",
  "iu",
);
export function uzRequestFromOtherSpeaker(text: string): boolean {
  const normalized = normalizeIncidentText(text);
  const clauses = (uzbekLatinMatchingVariant(normalized) ?? normalized)
    .split(/[.!?;,]+|\s+(?:keyin|so'ng|lekin|ammo)\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  return clauses.some(
    (part, i) =>
      uzRelativeCalled.test(part) &&
      /^(?:(?:keyin|so'ng|lekin|ammo)\s+)?(?:bank(?:\s+xodimi)?|operator|do'kon|sotuvchi)\s+(?:zudlik bilan|shoshilinch|tezda)\s+pul\s+so'ra(?:di|yapti|moqda)$/iu.test(
        clauses[i + 1] ?? "",
      ),
  );
}
// Entire report: do not borrow the relative from the next sentence or route
// a completed transfer through pre-payment advice.
const ruFamilyChat = new RegExp(
  `^${ruKin} (?:мне )?написал[аи]? (?:в (?:telegram|телеграме?) )?и (?:просит|попросил[аи]?) ${ruUrgent} ${ruPayment}[.!?]?$`,
  "iu",
);
const uzFamilyChat = new RegExp(
  `^${uzKin.source} (?:telegramda |xabar )?yozib,? (?:shoshilinch|zudlik bilan|tezda) pul (?:yubor|o'tkaz|jo'nat)ish(?:im|imiz)ni so'ra(?:di|yapti|moqda)[.!?]?$`,
  "iu",
);
// Only a reported request tied to this caller, not an urgency word elsewhere
// in the message. Asking for cash is not proof of an instruction to transfer.
const uzCallDemand = new RegExp(
  "^" +
    uzKin.source +
    "\\s+(?:(?:video)?qo'ng'iroq(?:da|\\s+qildi)|telefon qildi)" +
    "(?:,\\s*ovozi o'xshaydi)?(?:,\\s*|\\s+va\\s+|\\s+)" +
    "(?:shoshilinch|zudlik bilan|tezda) pul " +
    "(?:(?<transfer>(?:yubor|o'tkaz|jo'nat)ish(?:im|imiz)?ni) )?" +
    "so'ra(?:di|yapti|moqda|shdi)(?:,\\s*ovozi ham o'ziniki)?$",
  "iu",
);
export function uzFamilyDemandEvidence(text: string): "money" | "transfer" | null {
  if (uzFamilyChat.test(text)) return "transfer";
  for (const part of text.split(/[.!?;\n]+/u)) {
    const match = uzCallDemand.exec(part.trim());
    if (match) return match.groups?.transfer ? "transfer" : "money";
  }
  return null;
}

// "Ovoz" means both voice and vote. A relative actually asking for money in
// an urgent call is not a ballot; voice, family or urgency alone are not enough.
function matchesFamilyMoneyCall(text: string): boolean {
  if (ruFamilyChat.test(text) || uzFamilyChat.test(text)) return true;
  const parts = text.split(/[.!?;\n]+/u);
  if (hasReportedFamilyCall(parts, text)) return true;
  // The relative must be the grammatical subject of the request. A call and
  // an unrelated request later in the sentence do not identify the speaker.
  if (uzFamilyDemandEvidence(text)) return true;
  return parts.some(
    (part, i) =>
      uzRelativeCalled.test(part.trim()) &&
      /^(?:u\s+)?(?:shoshilinch|zudlik bilan|tezda) pul (?:yuborishimni |o'tkazishimni |jo'natishimni )?so'ra(?:di|yapti|moqda)[.!?]?$/iu.test(
        parts[i + 1]?.trim() ?? "",
      ),
  );
}

const CARRIER =
  /(?<!\p{L})(?:оператор\p{L}*|operator(?:i|im|imiz)?|carrier|mobile provider)(?!\p{L})/iu;
const REQUEST =
  /(?:про(?:сят|сит|сили)|попроси\p{L}*|сказал\p{L}*|требу\p{L}*|\b(?:asked|asks?|told|instructed|wants?)\b|so'ra(?:shdi|di|yapti|shyapti|moqda)|ter(?:ing|ishni)\s+de(?:di|yish))/iu;
const DIAL =
  /(?:набрать|наберите|набери|введите|ввести)\s+(?:(?:на телефоне|с телефона|специальн\p{L}*|сервисн\p{L}*|эт\p{L}*)\s+){0,2}(?:ussd|команд|код)|\b(?:dial|key in)\s+(?:(?:a|the|this|special|service|ussd)\s+){0,3}(?:ussd|command|code)\b|(?:ussd(?:[- ]?(?:kod|buyruq|komanda)\p{L}*)?|(?:maxsus|xizmat)\s+kod(?:ni)?)\s+ter(?:ish|ing)/iu;
const NO_DIAL_REQUEST =
  /(?:не\s+(?:про(?:сят|сит|сили)|просил|попросил|наб(?:ир|рать)|ввод)|\b(?:never|not|don't|didn't|doesn't|nobody)\s+(?:ask|dial|to dial|enter|tell|told)|\bno one\s+asked|so'ram(?:adi|agan)|terma(?:ng|slik))/iu;
const ONE_TIME_CODE = /(?:sms|смс|одноразов|one[- ]time|tasdiqlash kodi)/iu;
const UZ_HANDSET_COMMAND = /\btelefonda buyruq(?:ni)? ter(?:ish|ing)/iu;
function hasDistinctDialAndSmsRequests(sentence: string): boolean {
  const parts = sentence.split(/\s+(?:и|va|hamda|and)\s+/iu);
  return (
    parts.some(
      (part) => !ONE_TIME_CODE.test(part) && (DIAL.test(part) || UZ_HANDSET_COMMAND.test(part)),
    ) &&
    parts.some(
      (part) =>
        ONE_TIME_CODE.test(part) &&
        /назвать|сообщить|сказать|продиктовать|aytish|tell|share|read out/iu.test(part),
    )
  );
}
// Match the user's affirmative completion, not "I did not dial", a question,
// a hypothetical, a different phone number, or a quote from the caller.
const COMPLETED_DIAL =
  /^(?:(?:да[, ]+)?(?:я\s+)?(?:уже\s+)?(?:набрал[а]?|вв[её]л[а]?)\s+(?:е[её]|его|(?:эту\s+)?команду|(?:этот\s+)?код)|(?:yes[, ]+)?i\s+(?:already\s+)?(?:dialed|dialled|entered)\s+(?:it|(?:the|that)\s+(?:code|command))|(?:men\s+)?(?:(?:uni|buyruqni|kodni)\s+)?(?:allaqachon\s+)?terdim)\s*[.!]?$/iu;
const CARRIER_NOTICE =
  /(?:памятк\p{L}*|предупре(?:д|жд)\p{L}*[^.!?]{0,100}(?:если|мошенник)|(?<!\p{L})если\s+(?:кто|попросят|оператор)|\b(?:safety notice|if (?:someone|a caller|the carrier))\b|\bogohlantir\p{L}*[^.!?]{0,80}(?:agar|firibgar)|\bagar\b)/iu;
function isCarrierNotice(text: string): boolean {
  return CARRIER_NOTICE.test(
    text
      .trim()
      .replace(/^после (?:прочтения )?(?:(?:этой|вашей) )?памятки(?: оператора)?[,\s]+/iu, ""),
  );
}
function isCompletedDialPart(part: string): boolean {
  return (
    COMPLETED_DIAL.test(part) ||
    /^(?:да[, ]+)?я\s+(?:е[её]|его)\s+(?:уже\s+)?(?:набрал[а]?|вв[её]л[а]?)\s*[.!]?$/iu.test(part)
  );
}
export function reportsCompletedCarrierDial(text: string): boolean {
  const normalized = normalizeIncidentText(text);
  return [normalized, uzbekLatinMatchingVariant(normalized)].some(
    (part) => !!part && isCompletedDialPart(stripNextStep(part)),
  );
}
function operatorDialStage(text: string): "asked" | "done" | null {
  if (!CARRIER.test(text)) return null;
  let stage: "asked" | "done" | null = null;
  const sentences = (text.match(/[^.!?;\n]+[.!?]?/gu) ?? [])
    .flatMap((s) =>
      CARRIER_NOTICE.test(s) ? s.split(/,\s*(?:но|однако|but|lekin|ammo)\s+/iu) : [s],
    )
    .map((s) => s.trim());
  for (const [i, sentence] of sentences.entries()) {
    const explicitHandsetCommand =
      /(?:набрать|наберите|dial|key in)\s+[*#][\d*#]{1,23}#|[*#][\d*#]{1,23}#\s*(?:ni\s+)?ter(?:ish|ing)/iu.test(
        sentence,
      );
    if (
      !(DIAL.test(sentence) || explicitHandsetCommand || UZ_HANDSET_COMMAND.test(sentence)) ||
      !REQUEST.test(sentence) ||
      NO_DIAL_REQUEST.test(sentence) ||
      isCarrierNotice(sentence)
    )
      continue;
    if (
      /(?:введите|ввести|key in)/iu.test(sentence) &&
      !/(?:ussd|на телефоне|с телефона|команд|dial[ -]?pad)/iu.test(sentence)
    )
      continue;
    // Entering an OTP in a form is not dialing a handset service command.
    if (
      ONE_TIME_CODE.test(sentence) &&
      !explicitHandsetCommand &&
      !/ussd/iu.test(sentence) &&
      !hasDistinctDialAndSmsRequests(sentence)
    )
      continue;
    const caller = i > 0 ? sentences[i - 1].slice(-120) : "";
    if (
      !CARRIER.test(sentence) &&
      !(
        CARRIER.test(caller) &&
        !isCarrierNotice(caller) &&
        /звон|позвони|call|rang|qo'ng'iroq|telefon/iu.test(caller)
      )
    )
      continue;
    const continuation = stripNextStep(sentences[i + 1] ?? "");
    const completed = [stripNextStep(sentence).split(/[,;:]/u).at(-1)?.trim(), continuation].some(
      (part) => part && isCompletedDialPart(part),
    );
    if (completed) stage = "done";
    else stage ??= "asked";
  }
  return stage;
}

export function detectFirstAction(text: string): IncidentReason | null {
  const normalized = normalizeIncidentText(text);
  const variant = uzbekLatinMatchingVariant(normalized);
  for (const report of variant ? [normalized, variant] : [normalized]) {
    if (reportsUnauthorizedDebit(report)) return "reported_unauthorized_debit";
  }
  return matchIncidentScript(normalized) ?? (variant ? matchIncidentScript(variant) : null);
}
