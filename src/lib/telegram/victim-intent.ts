import type { Lang } from "@/lib/i18n";
import type { InlineKeyboard } from "@/lib/telegram/api.server";
import {
  buildAskedContextKeyboardRows,
  type AskedContextKind,
} from "@/lib/telegram/check-context-buttons";
import { CB } from "@/lib/telegram/format";
import { bt } from "@/lib/telegram/bot-i18n";

export type VictimIntentKind =
  | "emotional_help"
  | "general_scam_concern"
  | "advice_question"
  | "unknown_contact"
  | "unknown_call"
  | "foreign_call"
  | "identity_uncertain"
  | "telegram_message"
  | "telegram_takeover"
  | "bank_call"
  | "operator_call"
  | "link_received"
  | "file_received"
  | "apple_security"
  | "code_request"
  | "card_request"
  | "transfer_request"
  | "apk_request"
  | "link_request"
  | "personal_data_request"
  | "utility_impersonation"
  | "pension_benefit"
  | "phone_borrowing"
  | "money_mule"
  | "open_budget"
  | "medical_code"
  | "child_game_bonus"
  | "silent_call"
  | "official_impersonation"
  | "friend_money"
  | "support_impersonation"
  | "authority_impersonation"
  | "gov_service_login"
  | "romance_contact"
  | "romance_money"
  | "job_offer"
  | "earning_channel"
  | "investment_offer"
  | "travel_migration_prepayment"
  | "legal_impersonation"
  | "bank_contact_question"
  | "report_question"
  | "acknowledgement"
  | "trust_or_greeting";

export interface VictimIntentMatch {
  kind: VictimIntentKind;
  askedContext?: AskedContextKind;
}

const URL_RE = /(?:https?:\/\/|www\.|t\.me\/|telegram\.me\/|\b[a-z0-9-]+\.[a-z]{2,}\b)/iu;
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/u;
const TELEGRAM_HANDLE_RE = /@[a-zA-Z0-9_]{3,}/u;
const LONG_MESSAGE_LIMIT = 260;

function normalizeVictimText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[’‘`]/g, "'")
    .replace(/ё/g, "е")
    .replace(/Ё/g, "Е")
    .toLocaleLowerCase("ru")
    .trim()
    .replace(/\s+/g, " ");
}

function hasConcreteArtifact(text: string): boolean {
  return URL_RE.test(text) || PHONE_RE.test(text) || TELEGRAM_HANDLE_RE.test(text);
}

function looksLikeScamPayloadRatherThanVictimPhrase(text: string): boolean {
  if (text.length > LONG_MESSAGE_LIMIT) return true;
  if (hasConcreteArtifact(text)) return true;
  return (
    /(?:служб[аы]\s+безопасности|центральн.{0,20}банк|ваш\s+счет|ваша\s+карта|поздравляем|вы\s+выиграли|one\s?id|налоговая|поддержка\s+telegram|bank\s+xodimi|kodingizni\s+ayting|security\s+department|your\s+account|your\s+card).{0,120}(?:код|sms|cvv|pin|парол|ссылк|оплат|перевед|blocked|verify|code|payment|kod|to'lov)/iu.test(
      text,
    ) ||
    /^(?:salom|hello|здравствуйте)[,\s]+(?:men|я|this is).{0,80}(?:bank|банк|support|поддержк|xodim)/iu.test(
      text,
    )
  );
}

function hasVictimFrame(text: string): boolean {
  return /(?:^|[\s,.;:!?])(?:мне|меня|у\s+меня|со\s+мной|я|он|она|они|маму|папу|друга|сын|дочь|menga|meni|men|bizga|biz|onam|otam|i|me|my|they|someone|caller)(?=$|[\s,.;:!?])/iu.test(
    text,
  );
}

function hasAskVerb(text: string): boolean {
  return /(?:просят|просит|попросил[аи]?|спрашива(?:ет|ют)|спросил[аи]?|сказал[аи]?|говорит|требу(?:ет|ют)|нужно|надо|хочет|хотят|asked|asks|asking|told|wants?|needs?|so['’]?ra|sorashyap|ayt|deyap|kerak)/iu.test(
    text,
  );
}

function hasVictimRequestFrame(text: string): boolean {
  return (
    hasVictimFrame(text) ||
    /^(?:у\s+меня\s+)?(?:просят|просит|попросил[аи]?|спрашива(?:ет|ют)|спросил[аи]?|сказал[аи]?|говорит|требу(?:ет|ют)|нужно|надо|хочет|хотят)(?=$|[\s,.;:!?])/iu.test(
      text,
    ) ||
    /^(?:they|someone|caller)\s+(?:asked|asks|is\s+asking|told|wants?|needs?)(?=$|[\s,.;:!?])/iu.test(
      text,
    )
  );
}

function isTravelMigrationPrepaymentIntent(text: string): boolean {
  return (
    /(?:агентств|турагент|турфирм|визов|виза|коре|росси|рф|миграц|работа\s+за\s+границ|патент|разрешени.{0,20}работ|паломнич|хадж|умра|тур|путевк|авиабилет).{0,140}(?:предоплат|комисс|сбор|депозит|залог|оплат|взнос|бронь|страхов|документ)/iu.test(
      text,
    ) ||
    /(?:предоплат|комисс|сбор|депозит|залог|оплат|взнос|бронь|страхов).{0,140}(?:агентств|турагент|турфирм|визов|виза|коре|росси|рф|миграц|работа\s+за\s+границ|патент|разрешени.{0,20}работ|паломнич|хадж|умра|тур|путевк|авиабилет)/iu.test(
      text,
    ) ||
    /(?:viza|koreya|rossiya|migratsiya|haj|umra|tur|sayohat|agentlik).{0,140}(?:to['’]?lov|oldindan|komissiya|garov|depozit|bron|hujjat)/iu.test(
      text,
    ) ||
    /(?:visa|migration|work\s+abroad|korea|russia|hajj|umrah|tour|travel\s+agency).{0,140}(?:prepay|fee|deposit|commission|advance|payment)/iu.test(
      text,
    )
  );
}

function isGovServiceLoginIntent(text: string): boolean {
  const govService =
    /(?:one\s?id|oneid|my\.gov\.uz|id\.gov\.uz|my\.soliq\.uz|soliq\.uz|soliq|солик|солиқ|госуслуг|госуслуги|госорган|электронн.{0,20}правительств|давлат\s+хизмат|pinfl|пинфл|jshshir|myid|digital\s+passport|цифров.{0,20}паспорт)/iu;
  const loginAction =
    /(?:войд|войти|вход|логин|авториз|кабинет|подтверд|код|sms|смс|парол|ссылк|разблок|тиклаш|tasdiq|kirish|login|sign\s*in|verify|confirm|password|code|restore|blocked)/iu;

  return (
    (govService.test(text) && loginAction.test(text)) ||
    /(?:хот(?:ят|ели|ел|ела)|просят|просит|сказали|говорят|нужно|надо).{0,80}(?:войд|войти|вход|логин|авториз|подтверд).{0,80}(?:one\s?id|oneid|my\.gov\.uz|id\.gov\.uz|my\.soliq\.uz|soliq\.uz|soliq|солик|солиқ|госуслуг|госуслуги|давлат\s+хизмат)/iu.test(
      text,
    ) ||
    /(?:one\s?id|oneid|my\.gov\.uz|id\.gov\.uz|my\.soliq\.uz|soliq\.uz|soliq|солик|солиқ|госуслуг|госуслуги|давлат\s+хизмат).{0,80}(?:хот(?:ят|ели|ел|ела)|просят|просит|сказали|говорят|нужно|надо).{0,80}(?:войд|войти|вход|логин|авториз|подтверд)/iu.test(
      text,
    )
  );
}

function classifyNewsVictimIntent(text: string): VictimIntentMatch | null {
  if (
    /(?:бабушк|дедушк|мама|папа|родствен|близк|друг|подруг|сосед|сын|дочь).{0,180}(?:мошен|сроч|помощ|деньг|перевод|операци|лечение|авар|больниц)|(?:мошен|звонил|позвонил|пишет|просит).{0,180}(?:бабушк|дедушк|мама|папа|родствен|близк|друг|подруг|сын|дочь).{0,120}(?:деньг|помощ|перевод|сроч|лечение|авар|больниц)/iu.test(
      text,
    ) ||
    /(?:родствен|близк|мама|папа|бабушк|дедушк|сын|дочь|друг|подруга).{0,160}(?:ии|ai|deepfake|дипфейк|видеосвяз|видео|голос).{0,160}(?:деньг|помощ|перевод|сроч)/iu.test(
      text,
    )
  ) {
    return { kind: "friend_money", askedContext: "transfer" };
  }

  if (
    /(?:\+98|\+988|\+996|\+987|\+989|иран|ирана|нигери|кыргыз|киргиз|таджик|туркмен|зарубеж|иностран|друг(?:ой|ая|ую|ого)?\s+стран|chet\s+el|foreign).{0,140}(?:звон|номер|вызов|call|qo['’]?ng)|(?:звон|номер|вызов|call).{0,140}(?:\+98|\+988|\+996|\+987|\+989|иран|ирана|нигери|кыргыз|киргиз|таджик|туркмен|зарубеж|иностран|друг(?:ой|ая|ую|ого)?\s+стран|foreign)/iu.test(
      text,
    )
  ) {
    return { kind: "foreign_call", askedContext: "call" };
  }

  if (
    /(?:telegram|телеграм|телеграмм|teiegram|аккаунт|профиль|premium|премиум).{0,180}(?:галочк|официал|поддержк|блок|удал|замороз|провер|вериф|отмена|спасти|подар|голосован|проголос|мамочк|конкурс|войти|вход|парол|код)|(?:галочк|официал|поддержк|блок|удал|замороз|провер|вериф|отмена|premium|премиум|подар|голосован|проголос|мамочк|конкурс).{0,180}(?:telegram|телеграм|телеграмм|аккаунт|профиль)/iu.test(
      text,
    ) ||
    /(?:одноклассник|друг|подруга|знаком|родствен|мама|папа|человек|кто.?то).{0,120}(?:просит|попросил|зовет|зовёт|скинул|прислал|отправил).{0,120}(?:голосован|проголос|опрос|конкурс|лучш.{0,30}мам|мамочк).{0,120}(?:ссылк|перей|нажать|кнопк|канал|чат)|(?:голосован|проголос|опрос|конкурс|лучш.{0,30}мам|мамочк).{0,120}(?:ссылк|перей|нажать|кнопк).{0,120}(?:одноклассник|друг|подруга|знаком|родствен|мама|папа|человек|кто.?то)/iu.test(
      text,
    ) ||
    /(?:hurmatli|telegram|akkaunt|hisob).{0,180}(?:muzlat|o['’]?chir|blok|tasdiq|havola|parol|kod|premium|sovg['’]?a|ovoz)/iu.test(
      text,
    )
  ) {
    return { kind: "telegram_takeover", askedContext: "link_qr" };
  }

  if (
    /(?:apk|\.apk|exe|\.exe|pdf\.apk|pptx|\.pptx|gif|стикер|открытк|голосов(?:ое|ой)|takvim|таквим|повестк|chaqiruvsud|sudga|so['’]?nggi|последн.{0,20}слов|покидаю.{0,40}мир|ухожу.{0,40}мир|вирус|virus).{0,180}(?:откры|скач|установ|пришл|файл|ссылк|документ|yukla|och|o['’]?rnat)?/iu.test(
      text,
    )
  ) {
    return { kind: "file_received" };
  }

  if (
    /(?:apple|ios|iphone|айфон|эппл|apple\s?id).{0,180}(?:вирус|поврежд|72|парол|провер|блок|установ|окно|баннер|разблок)|(?:вирус|поврежд.{0,20}ios|оповещен.{0,20}apple).{0,140}(?:установ|парол|ok|инструкц)/iu.test(
      text,
    )
  ) {
    return { kind: "apple_security", askedContext: "apk" };
  }

  if (
    /(?:open\s*budget|openbudget|опен\s*бюджет|open\s+budjet|овоз|ovoz).{0,180}(?:код|sms|смс|голос|100\.?000|деньг|куп|sotib|olamiz|pul)|(?:покупа|купить|сотиб|sotib).{0,90}(?:голос|ovoz).{0,90}(?:open|бюджет|budget)/iu.test(
      text,
    )
  ) {
    return { kind: "open_budget", askedContext: "code" };
  }

  if (
    /(?:бот|канал|чат|групп|приложени|bot|channel|group).{0,160}(?:обеща|предлага|зов[её]т|приглаша|нажать|кнопк|перейти|подпис).{0,160}(?:заработ|доход|легк.{0,20}деньг|сум.{0,30}день|500\s*000|500000|million|pul|daromad)|(?:заработ|доход|легк.{0,20}деньг|сум.{0,30}день|500\s*000|500000|pul|daromad).{0,160}(?:бот|канал|чат|групп|нажать|кнопк|перейти|подпис|bot|channel|group)/iu.test(
      text,
    )
  ) {
    return { kind: "earning_channel", askedContext: "link_qr" };
  }

  if (
    /(?:водоканал|сувсоз|suvsoz|счетчик|счётчик|умн.{0,20}датчик|газ|электр|свет|коммунал|нулев.{0,20}баланс|utility).{0,180}(?:паспорт|пинфл|код|sms|смс|ссылк|оплат|звон|данн|адрес|долг|установ|провер)?/iu.test(
      text,
    )
  ) {
    return { kind: "utility_impersonation", askedContext: "call" };
  }

  if (
    /(?:пенсион|пенси[яию]|нафак|nafaqa|1271|выплат|надбавк|повышен.{0,20}пенс|пособи|грант).{0,180}(?:код|sms|смс|паспорт|пинфл|карт|данн|звон|оформ|увелич)/iu.test(
      text,
    )
  ) {
    return { kind: "pension_benefit", askedContext: "call" };
  }

  if (
    /(?:дмед|dmed|поликлиник|врач|медработ|медик|осмотр|грипп|shifokor).{0,180}(?:код|sms|смс|запис|вход|систем|просит|ayt|kod)/iu.test(
      text,
    )
  ) {
    return { kind: "medical_code", askedContext: "code" };
  }

  if (
    /(?:незнаком|посторон|человек|кто.?то).{0,120}(?:просит|попросил|хочет|дал).{0,90}(?:телефон|смартфон).{0,90}(?:позвон|минут|звонок)|(?:телефон|смартфон).{0,100}(?:на\s+минут|позвонить).{0,100}(?:просит|незнаком|посторон)/iu.test(
      text,
    )
  ) {
    return { kind: "phone_borrowing", askedContext: "call" };
  }

  if (
    /(?:деньг|сум|перевод).{0,120}(?:по\s+ошибк|ошибочн|случайн|вернуть|обратно|друг.{0,20}счет|друг.{0,20}счёт)|(?:вернуть|снять|обнал|банкомат|atm).{0,140}(?:деньг|перевод|карт|счет|счёт)|(?:за\s+дозу|терроризм|оружи|назначени.{0,20}платеж)/iu.test(
      text,
    )
  ) {
    return { kind: "money_mule", askedContext: "transfer" };
  }

  if (
    /(?:ребен|дет[ией]|школьник|game|игр|robux|bonus|бонус|валют).{0,180}(?:код|sms|смс|мессенджер|данн|подар|бесплатн|запуг|вымог)/iu.test(
      text,
    )
  ) {
    return { kind: "child_game_bonus", askedContext: "code" };
  }

  if (
    /(?:молчащ|молчат|тишина|ничего\s+не\s+говор|сказал.{0,20}алло|сказал.{0,20}да|запис(?:ать|али).{0,30}голос|копи.{0,30}голос|voice\s+clone)/iu.test(
      text,
    )
  ) {
    return { kind: "silent_call", askedContext: "call" };
  }

  if (
    /(?:мвд|миб|бпи|mib|bpi|суд|налогов|солик|солиқ|инспектор|госорган|госслужб|орган).{0,180}(?:код|sms|смс|карта|паспорт|пинфл|налич|деньг|штраф|долг|квитанц|документ|звон|пришел|пришёл)/iu.test(
      text,
    )
  ) {
    return { kind: "official_impersonation", askedContext: "call" };
  }

  return null;
}

export function classifyVictimIntent(text: string): VictimIntentMatch | null {
  const normalized = normalizeVictimText(text);
  if (!normalized) return null;
  if (looksLikeScamPayloadRatherThanVictimPhrase(normalized)) return null;
  if (
    /(?:мошенник|скамер|scammer|fraudster).{0,40}(?:написал[аи]?|пиш(?:ет|ут)|сказал[аи]?)\s*:/iu.test(
      normalized,
    )
  ) {
    return null;
  }

  if (
    /^(?:salom|assalomu\s+alaykum|hello|hi|привет|здравствуйте)[!.,\s]*$/iu.test(normalized) ||
    /(?:sizga|senga|botga|this\s+bot|этому\s+боту|тебе|вам).{0,40}(?:ishonsam|ishonsa|trust|доверять|ишонсам)/iu.test(
      normalized,
    ) ||
    /(?:это\s+точно\s+бот|что\s+это\s+за\s+бот|а\s+вы\s+кто|как\s+ты\s+работаешь|ты\s+не\s+мошенник|вы\s+не\s+мошенник|are\s+you\s+a\s+scam|who\s+are\s+you|how\s+do\s+you\s+work)/iu.test(
      normalized,
    )
  ) {
    return { kind: "trust_or_greeting" };
  }

  if (
    /^(?:(?:хорошо|ок|okay|ok|понял[аи]?|понятно|спасибо|спс|рахмат|rahmat)(?:\s+(?:спасибо|сделаю|понял[аи]?|ок|рахмат|rahmat))?|сделаю|готово|tushunarli|mayli|xo['’]?p|thanks|thank\s+you|done)[!.,\s]*$/iu.test(
      normalized,
    )
  ) {
    return { kind: "acknowledgement" };
  }

  const newsIntent = classifyNewsVictimIntent(normalized);
  if (newsIntent) {
    return newsIntent;
  }

  if (
    /(?:я\s+боюсь|мне\s+страшно|помогите|срочно\s+помогите|мне\s+нужна\s+помощь|я\s+не\s+знаю\s+что\s+делать|я\s+запутал(?:ся|ась)|я\s+волнуюсь|help\s+me|i\s+am\s+scared|i\s+don't\s+know\s+what\s+to\s+do|yordam|qo['’]?rqyapman|nima\s+qilishni\s+bilmayman)/iu.test(
      normalized,
    )
  ) {
    return { kind: "emotional_help" };
  }

  if (
    /(?:меня|нас|маму|папу|друга|onam|otam|meni|bizni|me|my\s+(?:mom|dad|friend)).{0,80}(?:обманыва|обманут|развод|скам|мошенник|ald[aao]yap|firib|scam|fraud)/iu.test(
      normalized,
    ) ||
    /(?:звонил[аи]?|позвонил[аи]?|пиш(?:ет|ут)|написал[аи]?|связал[аси]?ь?).{0,60}(?:мошенник|скамер|скам|scammer|fraudster)|(?:мошенник|скамер|scammer|fraudster).{0,60}(?:звонил[аи]?|позвонил[аи]?|писал[аи]?|написал[аи]?)/iu.test(
      normalized,
    ) ||
    /(?:думаю|кажется|похоже|maybe|i\s+think|menimcha).{0,60}(?:мошенник|скам|обман|scam|fraud|firib)/iu.test(
      normalized,
    ) ||
    /(?:не\s+понимаю|не\s+знаю).{0,80}(?:обман|мошенник|скам|развод|scam|fraud|firib)/iu.test(
      normalized,
    )
  ) {
    return { kind: "general_scam_concern" };
  }

  if (
    /(?:как\s+(?:мне\s+)?(?:связаться|позвонить|перезвонить)\s+(?:с|в)\s+банк|какой\s+номер\s+(?:банка|капиталбанка|kapitalbank|uzum|хамкор|hamkor)|номер\s+(?:банка|капиталбанка|kapitalbank|uzum|хамкор|hamkor)|bankka\s+qanday\s+qo['’]?ng['’]?iroq|bank\s+(?:number|phone)|how\s+(?:do\s+i\s+)?call\s+(?:the\s+)?bank)/iu.test(
      normalized,
    )
  ) {
    return { kind: "bank_contact_question" };
  }

  if (
    /(?:куда\s+(?:звонить|обращаться|писать)|как\s+(?:пожаловаться|заявить|сообщить)|куда\s+пожаловаться|полици[яю]|102|cyber\s*police|киберполици|shikoyat|politsiyaga\s+qanday|qayerga\s+(?:murojaat|shikoyat)|where\s+(?:do\s+i\s+)?report|how\s+(?:do\s+i\s+)?report).{0,100}(?:обман|мошен|скам|номер|деньг|перев|код|ald|firib|scam|fraud)?/iu.test(
      normalized,
    )
  ) {
    return { kind: "report_question" };
  }

  if (
    /(?:что\s+мне\s+делать|как\s+понять|что\s+отвечать|что\s+мне\s+(?:ей|ему|им)\s+ответить|нужно\s+ли|можно\s+ли|это\s+точно\s+мошенник|what\s+should\s+i\s+do|should\s+i|how\s+do\s+i\s+know|what\s+do\s+i\s+reply|nima\s+qilay|qanday\s+bilaman|javob\s+beraymi)/iu.test(
      normalized,
    )
  ) {
    if (/(?:код|sms|смс|otp|code|kod)/iu.test(normalized)) {
      return { kind: "code_request", askedContext: "code" };
    }
    return { kind: "advice_question" };
  }

  if (isGovServiceLoginIntent(normalized)) {
    return { kind: "gov_service_login" };
  }

  if (
    hasVictimRequestFrame(normalized) &&
    hasAskVerb(normalized) &&
    !/(?:сделать\s+перевод|перевод|перевести|transfer|o['’]?tkaz)/iu.test(normalized) &&
    /(?:последн.{0,20}цифр.{0,30}карт|карт[ауые]|фото\s+карт|номер\s+карты|реквизит|cvv|cvc|(?:pin|пин)(?=$|[\s,.;:!?]))/iu.test(
      normalized,
    )
  ) {
    return { kind: "card_request", askedContext: "card" };
  }

  if (
    hasVictimRequestFrame(normalized) &&
    hasAskVerb(normalized) &&
    /(?:sms|смс|otp|код|парол|цифр|сообщени|уведомлени|code|password|digits|kod|telegram\s+code|verification)/iu.test(
      normalized,
    )
  ) {
    return { kind: "code_request", askedContext: "code" };
  }

  if (
    /(?:курьер|доставк|посылк|почт|заказ|delivery|courier).{0,120}(?:sms|смс|код|цифр|сообщени|уведомлени|получ|подтверд|продикт|назвать)|(?:sms|смс|код|цифр|сообщени|уведомлени).{0,120}(?:курьер|доставк|посылк|почт|заказ|delivery|courier)/iu.test(
      normalized,
    )
  ) {
    return { kind: "code_request", askedContext: "code" };
  }

  if (
    hasVictimRequestFrame(normalized) &&
    hasAskVerb(normalized) &&
    /(?:подтверд(?:ить|и|ите|ят|ить\s+нужно).{0,40}(?:вход|логин|операци|перевод)|(?:вход|логин|операци|перевод).{0,40}подтверд|confirm.{0,40}(?:login|transfer|operation)|verify.{0,40}(?:login|transfer|operation)|tasdiq.{0,40}(?:kirish|o['’]?tkaz|operatsiya))/iu.test(
      normalized,
    )
  ) {
    return { kind: "code_request", askedContext: "code" };
  }

  if (
    hasVictimRequestFrame(normalized) &&
    hasAskVerb(normalized) &&
    /(?:паспорт|фото\s+(?:паспорта|документ|id|айди)|документ|удостоверени|id.?карт|пинфл|pinfl|jshshir|инн|дата\s+рождения|адрес|прописка|personal\s+data|passport|id\s+card|date\s+of\s+birth|address|pasport|hujjat|jshshir|tug['’]?ilgan|manzil)/iu.test(
      normalized,
    )
  ) {
    return { kind: "personal_data_request" };
  }

  if (isTravelMigrationPrepaymentIntent(normalized)) {
    return { kind: "travel_migration_prepayment", askedContext: "transfer" };
  }

  if (
    /(?:мне|со\s+мной).{0,60}(?:пишет|написал|связался).{0,80}(?:нотариус|юрист|коллектор|суд|полици|налогов|lawyer|notary|court|police)/iu.test(
      normalized,
    )
  ) {
    return { kind: "legal_impersonation" };
  }

  if (
    hasVictimRequestFrame(normalized) &&
    hasAskVerb(normalized) &&
    /(?:сделать\s+перевод|перевод\s+на\s+карт|перевести.{0,40}на\s+карт|transfer.{0,40}(?:card|account)|o['’]?tkaz.{0,40}karta)/iu.test(
      normalized,
    )
  ) {
    return { kind: "transfer_request", askedContext: "transfer" };
  }

  if (
    hasVictimRequestFrame(normalized) &&
    hasAskVerb(normalized) &&
    /(?:карт[ауые]|cvv|cvc|pin|пин|номер\s+карты|реквизит|card|karta|plastik)/iu.test(normalized)
  ) {
    return { kind: "card_request", askedContext: "card" };
  }

  if (
    /(?:мне|со\s+мной).{0,60}(?:пишет|написал|связался|связалась).{0,80}(?:друг|подруга|родствен|сын|дочь|мама|папа).{0,80}(?:(?:просит|нужны|надо|срочно).{0,40}(?:деньг|перевод|перевест|оплат|скинуть|отправить)|(?:деньг|перевод|перевест|оплат))/iu.test(
      normalized,
    ) ||
    /(?:друг|подруга|родствен|сын|дочь|мама|папа).{0,80}(?:(?:просит|нужны|надо|срочно).{0,40}(?:деньг|перевод|перевест|оплат|скинуть|отправить)|(?:деньг|перевод|перевест|оплат).{0,40}(?:просит|нужны|надо|срочно))/iu.test(
      normalized,
    )
  ) {
    return { kind: "friend_money", askedContext: "transfer" };
  }

  if (
    hasVictimRequestFrame(normalized) &&
    hasAskVerb(normalized) &&
    /(?:перевод|перевести|деньг|оплат|платеж|комисс|transfer|money|pay|payment|pul|to['’]?lov|o['’]?tkaz)/iu.test(
      normalized,
    )
  ) {
    return { kind: "transfer_request", askedContext: "transfer" };
  }

  if (
    hasVictimRequestFrame(normalized) &&
    hasAskVerb(normalized) &&
    /(?:apk|приложени|установ|скачать|anydesk|dastur|ilova|install|download|app|доступ\s+к\s+(?:телефон|экран|устройств)|демонстрац.{0,20}экран|screen\s+share|screen\s+access|phone\s+access)/iu.test(
      normalized,
    )
  ) {
    return { kind: "apk_request", askedContext: "apk" };
  }

  if (
    hasVictimFrame(normalized) &&
    /(?:прислал[аи]?|прислали|скинул[аи]?|кинули|отправил[аи]?|дали|yuborishdi|jo['’]?natishdi|sent|gave).{0,80}(?:ссылк|линк|url|link|havola)/iu.test(
      normalized,
    ) ||
    (hasVictimFrame(normalized) &&
      /(?:ссылк|линк|url|link|havola).{0,80}(?:прислал[аи]?|прислали|скинул[аи]?|кинули|отправил[аи]?|дали|yuborishdi|jo['’]?natishdi|sent|gave)/iu.test(
        normalized,
      ))
  ) {
    return { kind: "link_received", askedContext: "link_qr" };
  }

  if (
    hasVictimRequestFrame(normalized) &&
    hasAskVerb(normalized) &&
    /(?:ссылк|линк|url|link|havola|qr|куар)/iu.test(normalized)
  ) {
    return { kind: "link_request", askedContext: "link_qr" };
  }

  if (
    hasVictimFrame(normalized) &&
    /(?:прислал[аи]?|прислали|скинул[аи]?|отправил[аи]?|дали|yuborishdi|jo['’]?natishdi|sent|gave).{0,80}(?:файл|документ|apk|архив|pdf|file|document|fayl)/iu.test(
      normalized,
    ) ||
    (hasVictimFrame(normalized) &&
      /(?:файл|документ|apk|архив|pdf|file|document|fayl).{0,80}(?:прислал[аи]?|прислали|скинул[аи]?|отправил[аи]?|дали|yuborishdi|jo['’]?natishdi|sent|gave)/iu.test(
        normalized,
      ))
  ) {
    return { kind: "file_received" };
  }

  if (
    hasVictimFrame(normalized) &&
    (/(?:прислал[аи]?|прислали|скинул[аи]?|кинули|отправил[аи]?|отправили|пришло|yuborishdi|jo['’]?natishdi|sent|gave).{0,80}(?:что.?то|что.?нибудь|како[ей].?то|сообщение|скрин|фото|картинк|xabar|nimadir|narsa)/iu.test(
      normalized,
    ) ||
      /(?:что.?то|что.?нибудь|како[ей].?то|сообщение|скрин|фото|картинк|xabar|nimadir|narsa).{0,80}(?:прислал[аи]?|прислали|скинул[аи]?|кинули|отправил[аи]?|отправили|пришло|yuborishdi|jo['’]?natishdi|sent|gave)/iu.test(
        normalized,
      ))
  ) {
    return { kind: "telegram_message" };
  }

  if (
    /(?:menga|meni|men bilan|someone|stranger|unknown).{0,80}(?:notanish|unknown|stranger|odam).{0,80}(?:yoz|message|messag|wrote|text)/iu.test(
      normalized,
    ) ||
    /(?:notanish|unknown|stranger|odam).{0,80}(?:yoz|message|messag|wrote|text).{0,80}(?:menga|meni|me)/iu.test(
      normalized,
    )
  ) {
    return { kind: "unknown_contact" };
  }

  if (
    /(?:мне|нам|со\s+мной|меня).{0,60}(?:звон(?:ит|ят|или|ил|ила)|позвон(?:ил|ила|или)|связал[аси]?ь?|пиш(?:ет|ут)|написал[аи]?|связался).{0,120}(?:майор|лжемайор|следователь|следственн|прокуратур|мвд|полици|налогов|солик|солиқ|кадастр|суд|major|police|prosecutor|tax|court|mayor|politsiya|prokuratura|soliq|kadastr|iib)/iu.test(
      normalized,
    ) ||
    /(?:майор|лжемайор|следователь|следственн|прокуратур|мвд|полици|налогов|солик|солиқ|кадастр|суд|major|police|prosecutor|tax|court|mayor|politsiya|prokuratura|soliq|kadastr|iib).{0,120}(?:звон(?:ит|ят|или|ил|ила)|пиш(?:ет|ут)|написал[аи]?|связал[аси]?ь?)/iu.test(
      normalized,
    )
  ) {
    return { kind: "authority_impersonation", askedContext: "call" };
  }

  if (
    /(?:сотрудник|директор|оператор|представил[аси]?ь?|говорит|сказал[аи]?|пишет).{0,120}(?:оператор|билайн|beeline|ucell|юселл|mobiuz|мобиуз|uzmobile|uztelecom|узмобайл|узтелеком).{0,140}(?:договор|истека|продл|срок|номер|сим|sim|esim|код|sms|смс|продикт|подтверд|личност|блок)|(?:оператор|билайн|beeline|ucell|юселл|mobiuz|мобиуз|uzmobile|uztelecom|узмобайл|узтелеком).{0,140}(?:сотрудник|директор|говорит|сказал[аи]?|договор|истека|продл|срок|номер|сим|sim|esim|код|sms|смс|продикт|подтверд|личност|блок)/iu.test(
      normalized,
    ) ||
    /(?:мне|нам|со\s+мной|меня).{0,60}(?:звон(?:ит|ят|или|ил|ила)|позвон(?:ил|ила|или)|связал[аси]?ь?).{0,120}(?:оператор|билайн|beeline|ucell|юселл|mobiuz|мобиуз|uzmobile|uztelecom|узмобайл|узтелеком)/iu.test(
      normalized,
    ) ||
    /(?:оператор|билайн|beeline|ucell|юселл|mobiuz|мобиуз|uzmobile|uztelecom|узмобайл|узтелеком).{0,120}(?:звон(?:ит|ят|или|ил|ила)|позвон(?:ил|ила|или)|связал[аси]?ь?)/iu.test(
      normalized,
    )
  ) {
    return { kind: "operator_call", askedContext: "call" };
  }

  if (
    /(?:мне|нам|со\s+мной).{0,40}(?:звонил[аи]?|позвонил[аи]?|связал[аси]?ь?).{0,80}(?:банк|банка|служб[аы]\s+безопасности|оператор)|(?:банк|банка|служб[аы]\s+безопасности).{0,80}(?:звонил[аи]?|позвонил[аи]?|связал[аси]?ь?)/iu.test(
      normalized,
    ) ||
    /(?:^|\s)(?:звон(?:ит|ят|или)|позвон(?:ил|ила|или)).{0,50}(?:из\s+)?(?:банк|банка|служб[аы]\s+безопасности|оператор)/iu.test(
      normalized,
    ) ||
    /(?:звонил[аи]?|сказал[аи]?).{0,80}(?:карта|счет|аккаунт).{0,80}(?:заблок|заморож)/iu.test(
      normalized,
    ) ||
    /(?:bank|operator).{0,80}(?:called|qo['’]?ng['’]?iroq|bog['’]?lan)/iu.test(normalized)
  ) {
    return { kind: "bank_call", askedContext: "call" };
  }

  if (
    /(?:мне|нам|меня|со\s+мной).{0,60}(?:звон(?:ит|ят|или|ил|ила)|позвон(?:ил|ила|или)).{0,100}(?:незнаком|неизвестн|номер|прямо\s+сейчас|боюсь|ночью|утром|зарубеж|иностран|друг(?:ой|ая|ую|ого)?\s+стран|другого\s+города|\+998|noma['’]?lum|notanish|raqam|qo['’]?ng['’]?iroq|unknown|strange\s+number|foreign\s+number)/iu.test(
      normalized,
    ) ||
    /(?:звон(?:ит|ят|или|ил|ила)|позвон(?:ил|ила|или)).{0,100}(?:незнаком|неизвестн|номер|прямо\s+сейчас|боюсь|ночью|утром|зарубеж|иностран|друг(?:ой|ая|ую|ого)?\s+стран|другого\s+города|\+998|foreign\s+number)/iu.test(
      normalized,
    ) ||
    /(?:звонок|вызов).{0,100}(?:незнаком|неизвестн|номер|зарубеж|иностран|друг(?:ой|ая|ую|ого)?\s+стран|foreign\s+number)/iu.test(
      normalized,
    ) ||
    /(?:незнаком|неизвестн|номер|зарубеж|иностран|друг(?:ой|ая|ую|ого)?\s+стран|foreign\s+number).{0,100}(?:звонок|вызов|трубк)/iu.test(
      normalized,
    ) ||
    /^(?:мне\s+)?звонят(?:\s+прямо\s+сейчас)?[!.,\s]*$/iu.test(normalized) ||
    /(?:menga|meni).{0,80}(?:qo['’]?ng['’]?iroq|qongiroq).{0,80}(?:qilyap|qilish|qildi|notanish|noma['’]?lum|raqam)/iu.test(
      normalized,
    )
  ) {
    return { kind: "unknown_call", askedContext: "call" };
  }

  if (
    /(?:мне|со\s+мной).{0,50}(?:пишет|написал|связался|связалась).{0,80}(?:одноклассник|друг|подруга|знаком|родствен|мама|папа).{0,80}(?:не\s+уверен|точно\s+он|точно\s+она|сомневаюсь)/iu.test(
      normalized,
    ) ||
    /(?:мне|со\s+мной).{0,50}(?:пишет|написал|связался|связалась).{0,80}(?:одноклассник|друг|подруга|знаком|родствен|мама|папа).{0,80}(?:странн|необычн|подозрител)/iu.test(
      normalized,
    ) ||
    /(?:friend|classmate|relative).{0,80}(?:not\s+sure|is\s+it\s+really|asks?\s+money)/iu.test(
      normalized,
    )
  ) {
    return { kind: "identity_uncertain" };
  }

  if (
    /(?:мне|со\s+мной).{0,60}(?:пишет|написал|связался|связалась).{0,80}(?:техподдержк|поддержк|служб[аы]\s+безопасности|бот\s+от\s+имени\s+банка|сотрудник\s+банка|банк|оператор|bank\s+support|support)/iu.test(
      normalized,
    ) ||
    /(?:bank|security|support).{0,80}(?:is\s+)?(?:messaging|writing|texting|contacting)\s+me/iu.test(
      normalized,
    )
  ) {
    return { kind: "support_impersonation" };
  }

  if (
    /(?:люблю|скучаю|дорог|родн|знаком|отношен|невест|жених|девушк|парен|интернет).{0,140}(?:деньг|перевед|помоги|билет|виза|лечение|инвест|крипт|депозит)/iu.test(
      normalized,
    ) ||
    /(?:деньг|перевед|помоги|билет|виза|лечение|инвест|крипт|депозит).{0,140}(?:люблю|скучаю|дорог|родн|знаком|отношен|невест|жених|девушк|парен|интернет)/iu.test(
      normalized,
    ) ||
    /(?:sevgi|sog['’]?indim|aziz|tanish|munosabat).{0,140}(?:pul|yordam|chipta|viza|davolanish|invest|kripto)/iu.test(
      normalized,
    ) ||
    /(?:love|miss|dear|dating|relationship|girl|boyfriend|girlfriend).{0,140}(?:money|transfer|ticket|visa|treatment|invest|crypto|deposit)/iu.test(
      normalized,
    )
  ) {
    return { kind: "romance_money", askedContext: "transfer" };
  }

  if (
    /(?:мне|со\s+мной).{0,60}(?:пишет|написала|связалась).{0,80}(?:девушка|парень|роман|интернет|dating|relationship|любов|sevgi)/iu.test(
      normalized,
    ) ||
    /(?:мне|со\s+мной).{0,80}(?:познакомил[аи]?сь|познакомился|познакомились).{0,80}(?:девушка|парень|знаком|интернет|telegram|телеграм)/iu.test(
      normalized,
    )
  ) {
    return { kind: "romance_contact" };
  }

  if (
    /(?:работ|ваканс|подработ|заработ|легк.{0,20}доход|удаленн.{0,20}работ|стажиров|работодатель).{0,120}(?:взнос|обуч|форма|провер|предоплат|комисс|депозит|оплат|карта)/iu.test(
      normalized,
    ) ||
    /(?:взнос|обуч|форма|провер|предоплат|комисс|депозит|оплат).{0,120}(?:работ|ваканс|подработ|заработ|доход|стажиров|работодатель)/iu.test(
      normalized,
    ) ||
    /(?:ish|vakans|daromad|oylik|masofaviy).{0,120}(?:to['’]?lov|o['’]?qish|forma|tekshir|garov|depozit|karta)/iu.test(
      normalized,
    ) ||
    /(?:job|work|vacancy|income|remote).{0,120}(?:fee|training|uniform|verification|deposit|prepay|card)/iu.test(
      normalized,
    )
  ) {
    return { kind: "job_offer" };
  }

  if (
    /(?:мне|меня|со\s+мной|menga|meni|me)?.{0,80}(?:предлага(?:ют|ет)|зов(?:ут|ет)|приглаша(?:ют|ет)|совет(?:уют|ует)|обеща(?:ют|ет)|aytishyap|taklif).{0,120}(?:инвест|крипт|crypto|ton|wallet|бирж|трейд|trading|доход|прибыл|сигнал|depozit|daromad|foyda)/iu.test(
      normalized,
    ) ||
    /(?:канал|чат|групп|channel|chat|group).{0,100}(?:инвест|крипт|crypto|ton|wallet|бирж|трейд|trading|доход|прибыл|сигнал|signal)/iu.test(
      normalized,
    ) ||
    /(?:инвест|крипт|crypto|ton|wallet|бирж|трейд|trading|доход|прибыл|сигнал).{0,100}(?:канал|чат|групп|channel|chat|group|депозит|влож|пополни|пополнить|deposit)/iu.test(
      normalized,
    )
  ) {
    return { kind: "investment_offer", askedContext: "transfer" };
  }

  if (
    /(?:бот|канал|чат|групп|приложени|bot|channel|group).{0,160}(?:обеща(?:ют|ет)|предлага(?:ют|ет)|зов(?:ут|ет)|приглаша(?:ют|ет)|нажать|кнопк|перейти|подпис).{0,160}(?:заработ|доход|легк.{0,20}деньг|сум.{0,30}день|500\s*000|500000|pul|daromad)|(?:заработ|доход|легк.{0,20}деньг|сум.{0,30}день|500\s*000|500000|pul|daromad).{0,160}(?:бот|канал|чат|групп|нажать|кнопк|перейти|подпис|bot|channel|group)/iu.test(
      normalized,
    )
  ) {
    return { kind: "earning_channel", askedContext: "link_qr" };
  }

  if (
    /(?:мне|со\s+мной).{0,60}(?:пишет|написал|связался).{0,80}(?:работодатель|работ[ау]|ваканси|легкий\s+доход|job|employer|ish|daromad)/iu.test(
      normalized,
    ) ||
    /(?:мне|меня|со\s+мной|menga|meni|me).{0,80}(?:приглаша(?:ют|ет)|зов(?:ут|ет)|добавля(?:ют|ет)|invite|invited).{0,100}(?:канал|чат|групп|channel|chat|group)?.{0,80}(?:заработ|доход|подработ|инвест|крипт|ton|wallet|daromad|ish|pul)/iu.test(
      normalized,
    ) ||
    /(?:канал|чат|групп|channel|chat|group).{0,80}(?:для\s+)?(?:заработ|доход|подработ|инвест|крипт|ton|wallet|daromad|pul)/iu.test(
      normalized,
    )
  ) {
    return { kind: "job_offer" };
  }

  if (
    /(?:мне|со\s+мной).{0,60}(?:пишет|написал|связался).{0,80}(?:нотариус|юрист|коллектор|суд|полици|налогов|lawyer|notary|court|police)/iu.test(
      normalized,
    )
  ) {
    return { kind: "legal_impersonation" };
  }

  if (
    /(?:мне|со\s+мной).{0,60}(?:пишет|написал|связался|пишут).{0,80}(?:незнаком|неизвестн|номер|кто-то|какой.?то|odam|notanish|someone|stranger)/iu.test(
      normalized,
    )
  ) {
    return { kind: "unknown_contact" };
  }

  if (/(?:мне|меня|menga|meni|me).{0,60}(?:пишут|написали|xabar|yoz|message)/iu.test(normalized)) {
    return { kind: "telegram_message" };
  }

  if (/(?:menga|meni|men).{0,80}(?:aldayap|firib|scam)/iu.test(normalized)) {
    return { kind: "general_scam_concern" };
  }

  if (/(?:menga|meni).{0,80}(?:nimadir|narsa|xabar).{0,60}(?:yuborishdi|kel)/iu.test(normalized)) {
    return { kind: "telegram_message" };
  }

  return null;
}

export function buildVictimIntentKeyboard(lang: Lang, match: VictimIntentMatch): InlineKeyboard {
  if (match.askedContext) {
    return [
      [{ text: bt("btn_emergency", lang), callback_data: CB.emergency }],
      [{ text: bt("btn_check_another", lang), callback_data: CB.checkAnother }],
    ];
  }

  return [
    ...buildAskedContextKeyboardRows(lang),
    [
      { text: bt("btn_emergency", lang), callback_data: CB.emergency },
      { text: bt("btn_check_another", lang), callback_data: CB.checkAnother },
    ],
  ];
}

export function buildVictimIntentText(match: VictimIntentMatch, lang: Lang): string {
  const byKind: Record<VictimIntentKind, Record<Lang, string>> = {
    emotional_help: {
      ru: "Я рядом. Сначала остановимся и разберёмся спокойно.\n\nЧто происходит прямо сейчас: вам звонят, прислали ссылку/файл, просят код, карту или перевод? Нажмите подходящую кнопку ниже или напишите одной фразой.",
      uz: "Men yoningizdaman. Avval to'xtab, xotirjam aniqlaymiz.\n\nHozir nima bo'lyapti: qo'ng'iroq qilishyaptimi, havola/fayl yuborishdimi, kod, karta yoki pul so'rashyaptimi? Pastdagi tugmani bosing yoki bir jumla bilan yozing.",
      en: "I am here with you. First, pause and we will sort this out calmly.\n\nWhat is happening right now: are they calling, did they send a link/file, or are they asking for a code, card, or transfer? Tap a button below or write one short sentence.",
    },
    general_scam_concern: {
      ru: "Вы правильно остановились. Пока ничего не отправляйте.\n\nЧтобы понять риск, напишите, что именно вас просят сделать: код, карту, перевод, APK, ссылку/QR или просто общение?",
      uz: "To'g'ri to'xtadingiz. Hozircha hech narsa yubormang.\n\nXavfni tushunish uchun yozing: sizdan aynan nima so'rashyapti — kod, karta, pul, APK, havola/QR yoki shunchaki suhbatmi?",
      en: "Good that you stopped. Do not send anything yet.\n\nTo understand the risk, tell me what they ask you to do: code, card, transfer, APK, link/QR, or just chatting?",
    },
    advice_question: {
      ru: "Безопасный шаг сейчас: не отправляйте код, карту, пароль, фото документов и деньги.\n\nПришлите коротко, что именно случилось или что вас просят сделать. Если уже отправили код/деньги — нажмите «Помощь сейчас».",
      uz: "Hozir xavfsiz qadam: kod, karta, parol, hujjat rasmi yoki pul yubormang.\n\nNima bo'lganini yoki sizdan nima so'ralganini qisqa yozing. Kod/pul yuborgan bo'lsangiz — «Emergency» tugmasini bosing.",
      en: "Safe step now: do not send codes, card data, passwords, document photos, or money.\n\nBriefly send what happened or what they ask you to do. If you already sent a code/money, press “Help now”.",
    },
    unknown_contact: {
      ru: "Незнакомец сам по себе ещё не доказательство. Главное — что он просит.\n\nНе отправляйте код, деньги, карту или документы. Пришлите его сообщение, @username/ссылку или нажмите ниже, если он просит конкретное действие.",
      uz: "Notanish odamning o'zi hali dalil emas. Muhimi — u nima so'rayapti.\n\nKod, pul, karta yoki hujjat yubormang. Uning xabarini, @username/havolani yuboring yoki aniq so'rov bo'lsa pastdagi tugmani bosing.",
      en: "A stranger alone is not proof. What matters is what they ask for.\n\nDo not send codes, money, card data, or documents. Send their message, @username/link, or tap below if they ask for a specific action.",
    },
    unknown_call: {
      ru: "Если звонит незнакомый номер — безопаснее не продолжать разговор под давлением.\n\nЕсли звонок ещё идёт, спокойно завершите его. Не называйте код, карту, паспортные данные и не переводите деньги. Пришлите номер с экрана — я проверю публичные признаки.",
      uz: "Notanish raqam qo'ng'iroq qilsa — bosim ostida suhbatni davom ettirmagan xavfsizroq.\n\nQo'ng'iroq davom etsa, xotirjam tugating. Kod, karta, pasport ma'lumoti aytmang va pul o'tkazmang. Ekrandagi raqamni yuboring — ochiq belgilarni tekshiraman.",
      en: "If an unknown number is calling, it is safer not to continue under pressure.\n\nIf the call is still active, end it calmly. Do not share a code, card, passport data, or transfer money. Send the number from the screen and I will check public signals.",
    },
    foreign_call: {
      ru: "Иностранный номер сам по себе не доказывает мошенничество, но под давлением это красный флаг.\n\nЕсли звонок ещё идёт — завершите его. Банк, оператор или госслужба не должны просить SMS-код, карту, паспорт или перевод с зарубежного номера. Пришлите номер или что именно просили.",
      uz: "Chet el raqami o'zi firibgarlikni isbotlamaydi, lekin bosim bo'lsa — bu qizil bayroq.\n\nQo'ng'iroq davom etsa, tugating. Bank, operator yoki davlat xizmati chet el raqamidan SMS-kod, karta, pasport yoki pul so'ramasligi kerak. Raqamni yoki nima so'rashganini yuboring.",
      en: "A foreign number alone is not proof of fraud, but pressure is a red flag.\n\nIf the call is still active, end it. A bank, operator, or government service should not ask for an SMS code, card, passport, or transfer from an overseas number. Send the number or what they asked for.",
    },
    identity_uncertain: {
      ru: "Если человек похож на знакомого, но вы не уверены — не переводите деньги и не отправляйте код.\n\nПерезвоните по уже сохранённому номеру или задайте личный вопрос, ответ на который нельзя взять из соцсетей.",
      uz: "Odam tanishga o'xshasa ham, ishonchingiz komil bo'lmasa — pul yoki kod yubormang.\n\nOldindan saqlangan raqamga qayta qo'ng'iroq qiling yoki ijtimoiy tarmoqlardan topib bo'lmaydigan shaxsiy savol bering.",
      en: "If the person looks like someone you know but you are not sure, do not send money or codes.\n\nCall back using the saved number or ask a personal question that cannot be guessed from social media.",
    },
    telegram_message: {
      ru: "Понял: вам пишут в Telegram. Я не вижу ваши чаты сам, поэтому нужен кусок переписки.\n\nПришлите текст сообщения, @username/ссылку или скрин. Пока не отправляйте код, карту, деньги и не открывайте APK.",
      uz: "Tushundim: sizga Telegramda yozishyapti. Men chatlaringizni o'zim ko'rmayman, shuning uchun yozishmadan parcha kerak.\n\nXabar matni, @username/havola yoki skrin yuboring. Hozircha kod, karta, pul yubormang va APK ochmang.",
      en: "Understood: someone is messaging you on Telegram. I cannot see your chats by myself, so I need a piece of the conversation.\n\nSend the message text, @username/link, or screenshot. For now, do not send codes, card data, money, or open APKs.",
    },
    telegram_takeover: {
      ru: "Похоже на попытку увести Telegram-аккаунт: «галочка», Premium, удаление, блокировка, голосование или проверка часто ведут на фейковый вход.\n\nНе нажимайте кнопку и не вводите код. Откройте Telegram сами, проверьте активные устройства и включите двухэтапную защиту. Пришлите ссылку или скрин, если хотите проверить точнее.",
      uz: "Bu Telegram akkauntini olib qo'yish urinishiga o'xshaydi: «belgi», Premium, o'chirish, bloklash, ovoz berish yoki tekshiruv ko'pincha soxta kirishga olib boradi.\n\nTugmani bosmang va kod kiritmang. Telegramni o'zingiz oching, aktiv qurilmalarni tekshiring va ikki bosqichli himoyani yoqing. Aniqroq tekshirish uchun havola yoki skrin yuboring.",
      en: "This looks like a Telegram account takeover attempt: verification badges, Premium gifts, deletion, blocking, voting, or “checks” often lead to a fake login.\n\nDo not press the button or enter a code. Open Telegram yourself, check active devices, and enable two-step verification. Send the link or screenshot if you want a closer check.",
    },
    bank_call: {
      ru: "Если звонили «из банка», проверяем только через официальный канал.\n\nНе называйте код, PIN, CVV и не переводите деньги. Перезвоните сами по номеру из приложения, карты или официального сайта. Напишите, что именно они просили.",
      uz: "«Bankdan» qo'ng'iroq bo'lsa, faqat rasmiy kanal orqali tekshiramiz.\n\nKod, PIN, CVV aytmang va pul o'tkazmang. Ilova, karta yoki rasmiy saytdagi raqamga o'zingiz qo'ng'iroq qiling. Ular nima so'rashganini yozing.",
      en: "If they called “from the bank”, verify only through an official channel.\n\nDo not share a code, PIN, CVV, or transfer money. Call back yourself using the number in the app, on the card, or official site. Tell me what they asked for.",
    },
    operator_call: {
      ru: "Если звонят «из оператора связи» или называют Beeline/Ucell/Mobiuz/Uztelecom, проверяем только через официальный номер или приложение.\n\nНе называйте SMS-код для SIM/eSIM, перевыпуска номера, входа в кабинет или «проверки личности». Завершите разговор и перезвоните оператору сами. Напишите, что именно они просили.",
      uz: "Agar «operator» nomidan qo'ng'iroq qilishsa yoki Beeline/Ucell/Mobiuz/Uztelecom deb aytishsa, faqat rasmiy raqam yoki ilova orqali tekshiring.\n\nSIM/eSIM, raqamni qayta chiqarish, kabinetga kirish yoki «shaxsni tekshirish» kodi aytilmaydi. Suhbatni tugating va operatorga o'zingiz qo'ng'iroq qiling. Ular nima so'rashganini yozing.",
      en: "If someone calls “from the mobile operator” or mentions Beeline/Ucell/Mobiuz/Uztelecom, verify only through the official number or app.\n\nDo not share an SMS code for SIM/eSIM, number replacement, account login, or “identity check”. Hang up and call the operator yourself. Tell me what they asked for.",
    },
    link_received: {
      ru: "Пока не открывайте ссылку и не вводите данные.\n\nПришлите саму ссылку или скрин экрана после перехода. Опасно, если дальше просят код, карту, оплату, Telegram-вход или APK.",
      uz: "Hozircha havolani ochmang va ma'lumot kiritmang.\n\nHavolaning o'zini yoki ochilgandan keyingi ekranni yuboring. Keyin kod, karta, to'lov, Telegram kirish yoki APK so'ralsa — xavfli.",
      en: "Do not open the link or enter data yet.\n\nSend the link itself or a screenshot of the next screen. It is risky if it asks for a code, card data, payment, Telegram login, or APK.",
    },
    file_received: {
      ru: "Файл от незнакомого источника не открывайте, особенно APK/архив.\n\nПришлите скрин сообщения или название файла. Если это приложение для «защиты», «банка», «работы» или «выплаты» — лучше остановиться.",
      uz: "Notanish manbadan kelgan faylni ochmang, ayniqsa APK/arxiv bo'lsa.\n\nXabar skrinini yoki fayl nomini yuboring. Bu «himoya», «bank», «ish» yoki «to'lov» ilovasi bo'lsa — to'xtagan yaxshi.",
      en: "Do not open a file from an unknown source, especially an APK/archive.\n\nSend a screenshot of the message or the file name. If it is an app for “security”, “bank”, “work”, or “payment”, stop.",
    },
    apple_security: {
      ru: "Окно «Apple/iOS повреждена» или «вирусы 72%» почти всегда рекламная ловушка.\n\nНе нажимайте «установить» и не вводите Apple ID. Закройте страницу, проверьте устройство через настройки Apple, а если уже ввели пароль — смените его с официального сайта/настроек.",
      uz: "«Apple/iOS shikastlangan» yoki «72% virus» oynasi odatda reklama tuzog'i bo'ladi.\n\n«O'rnatish»ni bosmang va Apple ID kiritmang. Sahifani yoping, qurilmani Apple sozlamalari orqali tekshiring; parol kiritgan bo'lsangiz — rasmiy sayt/sozlamalardan almashtiring.",
      en: "An “Apple/iOS damaged” or “72% viruses” pop-up is usually an ad trap.\n\nDo not tap install or enter your Apple ID. Close the page, check the device through Apple settings, and if you already entered a password, change it through the official site/settings.",
    },
    personal_data_request: {
      ru: "Паспорт, ПИНФЛ, фото документов, адрес и дату рождения не отправляйте в чат незнакомцу.\n\nНастоящая организация проверяет такие данные только через официальный сайт, приложение, офис или сохранённый номер. Пришлите текст просьбы или ссылку, если она есть.",
      uz: "Pasport, JSHSHIR/PINFL, hujjat rasmi, manzil va tug'ilgan sanani notanish chatga yubormang.\n\nHaqiqiy tashkilot bunday ma'lumotni faqat rasmiy sayt, ilova, ofis yoki saqlangan raqam orqali tekshiradi. So'rov matni yoki havola bo'lsa yuboring.",
      en: "Do not send passport data, ID numbers, document photos, address, or date of birth to an unknown chat.\n\nA real organization verifies this only through an official site, app, office, or saved number. Send the request text or link if there is one.",
    },
    friend_money: {
      ru: "Если «друг» или близкий срочно просит деньги — сначала подтвердите личность другим каналом.\n\nНе переводите сразу. Позвоните по сохранённому номеру или спросите семейное кодовое слово/личный вопрос.",
      uz: "«Do'st» yoki yaqin inson shoshilinch pul so'rasa — avval boshqa kanal orqali shaxsini tasdiqlang.\n\nDarhol pul o'tkazmang. Saqlangan raqamga qo'ng'iroq qiling yoki oilaviy kod so'z/shaxsiy savol so'rang.",
      en: "If a “friend” or relative urgently asks for money, verify their identity through another channel first.\n\nDo not transfer immediately. Call the saved number or ask a family code word/personal question.",
    },
    utility_impersonation: {
      ru: "Водоканал, газ, свет, Suvsoz или «умный счётчик» проверяем только через официальный районный отдел.\n\nНе диктуйте паспорт, ПИНФЛ, SMS-код и не платите по ссылке. Завершите звонок и перезвоните сами по номеру из квитанции, сайта или приложения.",
      uz: "Suvsoz, gaz, elektr yoki «aqlli hisoblagich»ni faqat rasmiy tuman bo'limi orqali tekshiring.\n\nPasport, JSHSHIR/PINFL, SMS-kod aytmang va havola orqali to'lamang. Qo'ng'iroqni tugating va kvitansiya, sayt yoki ilovadagi raqamga o'zingiz qo'ng'iroq qiling.",
      en: "Water, gas, electricity, Suvsoz, or “smart meter” requests should be checked only through the official local office.\n\nDo not share passport data, ID number, SMS code, or pay by link. End the call and call back using the number from a bill, site, or app.",
    },
    pension_benefit: {
      ru: "Пенсионный фонд, надбавка, пособие или грант не оформляются через SMS-код по звонку.\n\nНе называйте код, паспорт, ПИНФЛ и данные карты. Проверяйте через официальный номер 1271, 102 или личный кабинет, открытый вручную.",
      uz: "Pensiya jamg'armasi, nafaqa, qo'shimcha to'lov yoki grant telefon orqali SMS-kod bilan rasmiylashtirilmaydi.\n\nKod, pasport, JSHSHIR/PINFL yoki karta ma'lumotini aytmang. 1271, 102 yoki o'zingiz ochgan rasmiy kabinet orqali tekshiring.",
      en: "Pension increases, benefits, or grants are not processed through an SMS code on a call.\n\nDo not share a code, passport, ID number, or card data. Verify through the official number 1271, 102, or an account you open yourself.",
    },
    phone_borrowing: {
      ru: "Не отдавайте незнакомцу разблокированный телефон даже «на минуту».\n\nЕсли хотите помочь — наберите номер сами и включите громкую связь. Не передавайте телефон с открытым банком, Telegram, SMS или уведомлениями.",
      uz: "Notanish odamga blokdan chiqarilgan telefonni «bir daqiqaga» ham bermang.\n\nYordam bermoqchi bo'lsangiz, raqamni o'zingiz tering va ovozli rejimni yoqing. Bank, Telegram, SMS yoki bildirishnomalar ochiq telefonda qolmasin.",
      en: "Do not hand an unlocked phone to a stranger, even “for a minute”.\n\nIf you want to help, dial the number yourself and use speakerphone. Do not hand over a phone with bank apps, Telegram, SMS, or notifications accessible.",
    },
    money_mule: {
      ru: "Если деньги пришли «по ошибке» и просят вернуть на другой счёт — не переводите сами.\n\nСразу обратитесь в банк: пусть возврат идёт официально. Сохраните сообщение, чек и номер. Иначе можно стать участником чужой схемы.",
      uz: "Pul «xato» kelib, boshqa hisobga qaytarishni so'rashsa — o'zingiz o'tkazmang.\n\nDarhol bankka murojaat qiling: qaytarish rasmiy yo'l bilan bo'lsin. Xabar, chek va raqamni saqlang. Aks holda begona sxemaga aralashib qolishingiz mumkin.",
      en: "If money arrived “by mistake” and they ask you to send it to another account, do not transfer it yourself.\n\nContact the bank immediately so any return is handled officially. Save the message, receipt, and number. Otherwise you may become part of someone else's scheme.",
    },
    open_budget: {
      ru: "Open Budget/голос за деньги — рискованная схема. Код из SMS может привязать ваш номер, карту или аккаунт к чужим действиям.\n\nНе продавайте голос и не называйте код. Проверяйте Open Budget только через официальный сайт/приложение.",
      uz: "Open Budget ovozini pulga berish — xavfli sxema. SMS-kod raqamingiz, kartangiz yoki akkauntingizni begona harakatlarga bog'lashi mumkin.\n\nOvozni sotmang va kod aytmang. Open Budgetni faqat rasmiy sayt/ilova orqali tekshiring.",
      en: "Selling an Open Budget vote is risky. An SMS code can link your number, card, or account to someone else's actions.\n\nDo not sell the vote and do not share the code. Check Open Budget only through the official site/app.",
    },
    medical_code: {
      ru: "Поликлиника, врач или DMED не должны просить SMS-код в чате или по телефону.\n\nНе диктуйте код. Записывайтесь только через официальный сервис, регистратуру или сохранённый номер поликлиники.",
      uz: "Poliklinika, shifokor yoki DMED chat/telefon orqali SMS-kod so'ramasligi kerak.\n\nKodni aytmang. Faqat rasmiy servis, registratura yoki saqlangan poliklinika raqami orqali yoziling.",
      en: "A clinic, doctor, or DMED should not ask for an SMS code in chat or by phone.\n\nDo not dictate the code. Book only through the official service, reception desk, or saved clinic number.",
    },
    child_game_bonus: {
      ru: "Бесплатные бонусы, игровая валюта или подарок ребёнку часто ведут к коду, аккаунту или вымогательству.\n\nНе вводите код и не переходите в сторонний чат. Лучше остановить переписку, сохранить скрин и обсудить это с ребёнком спокойно.",
      uz: "Bolaga bepul bonus, o'yin valyutasi yoki sovg'a ko'pincha kod, akkaunt yoki qo'rqitishga olib boradi.\n\nKod kiritmang va begona chatga o'tmang. Yozishmani to'xtating, skrin saqlang va bola bilan xotirjam gaplashing.",
      en: "Free bonuses, game currency, or gifts for a child often lead to codes, account theft, or extortion.\n\nDo not enter a code or move to a third-party chat. Stop the conversation, save a screenshot, and talk with the child calmly.",
    },
    silent_call: {
      ru: "Если звонят и молчат — лучше сразу сбросить.\n\nНе говорите «да», не продолжайте разговор и не перезванивайте по неизвестному номеру. Заблокируйте номер и предупредите близких, если звонки повторяются.",
      uz: "Qo'ng'iroq qilib jim turishsa — darhol tugatgan yaxshi.\n\n«Ha» demang, suhbatni davom ettirmang va noma'lum raqamga qayta qo'ng'iroq qilmang. Raqamni bloklang va takrorlansa yaqinlaringizni ogohlantiring.",
      en: "If they call and stay silent, it is safer to hang up immediately.\n\nDo not say “yes”, do not continue, and do not call back an unknown number. Block it and warn relatives if calls repeat.",
    },
    official_impersonation: {
      ru: "Госорган, МИБ/БПИ, суд, налоговая или инспектор не должны требовать код, карту, паспорт или наличные в личном чате.\n\nНе платите «штраф» по ссылке и не передавайте документы. Проверьте через официальный номер, сайт или личное обращение.",
      uz: "Davlat idorasi, MIB/BPI, sud, soliq yoki inspektor shaxsiy chatda kod, karta, pasport yoki naqd pul talab qilmasligi kerak.\n\nHavola orqali «jarima» to'lamang va hujjat bermang. Rasmiy raqam, sayt yoki shaxsan murojaat orqali tekshiring.",
      en: "A government body, enforcement office, court, tax office, or inspector should not demand a code, card, passport, or cash in a private chat.\n\nDo not pay a “fine” by link or send documents. Verify through an official number, site, or in person.",
    },
    support_impersonation: {
      ru: "Поддержка/служба безопасности в чате — частый сценарий обмана.\n\nНе отправляйте коды, пароли, карту и не устанавливайте приложения. Проверяйте только через официальный сайт, приложение или номер.",
      uz: "Chatdagi qo'llab-quvvatlash/xavfsizlik xizmati — keng tarqalgan firibgarlik yo'li.\n\nKod, parol, karta yubormang va ilova o'rnatmang. Faqat rasmiy sayt, ilova yoki raqam orqali tekshiring.",
      en: "Support/security service in chat is a common scam path.\n\nDo not send codes, passwords, card data, or install apps. Verify only through the official website, app, or number.",
    },
    authority_impersonation: {
      ru: "Звонок или чат от «майора», полиции, прокуратуры, налоговой, кадастра, суда или коллектора часто используют для давления страхом.\n\nНе называйте коды, не отправляйте документы и не платите по ссылке. Завершите контакт и проверяйте только через официальный номер или личное обращение.",
      uz: "«Mayor», politsiya, prokuratura, soliq, kadastr, sud yoki kollektor nomidan qo'ng'iroq/chat ko'pincha qo'rqitish uchun ishlatiladi.\n\nKod aytmang, hujjat yubormang va havola orqali to'lamang. Aloqani tugating va faqat rasmiy raqam yoki shaxsan murojaat orqali tekshiring.",
      en: "A call or chat from a “major”, police, prosecutor, tax office, cadastre, court, or collector is often used to pressure with fear.\n\nDo not share codes, send documents, or pay by link. End the contact and verify only through an official number or in person.",
    },
    gov_service_login: {
      ru: "Soliq, OneID и госуслуги проверяем только через официальный сайт или приложение, открытые вручную.\n\nНе входите по ссылке из чата/SMS, не называйте пароль и SMS-код. Если вас просят «войти», «подтвердить» или «разблокировать» — пришлите ссылку или текст просьбы.",
      uz: "Soliq, OneID va davlat xizmatlarini faqat rasmiy sayt yoki ilovani o'zingiz ochib tekshiring.\n\nChat/SMS havolasi orqali kirmang, parol va SMS-kodni aytmang. «Kirish», «tasdiqlash» yoki «blokdan chiqarish» so'ralsa — havola yoki so'rov matnini yuboring.",
      en: "Check Soliq, OneID, and government services only through the official site/app that you open yourself.\n\nDo not sign in from a chat/SMS link, and do not share your password or SMS code. If they ask you to “sign in”, “confirm”, or “unlock”, send the link or request text.",
    },
    romance_contact: {
      ru: "Новый романтический знакомый — не риск сам по себе. Риск начинается, если появляются деньги, билеты, виза, инвестиции, крипта или «помоги срочно».\n\nПока ничего не переводите. Пришлите его просьбу текстом.",
      uz: "Yangi romantik tanishning o'zi xavf emas. Xavf pul, chipta, viza, investitsiya, kripto yoki «tez yordam ber» so'rovi chiqqanda boshlanadi.\n\nHozircha pul o'tkazmang. Uning iltimosini matn qilib yuboring.",
      en: "A new romantic contact is not risky by itself. Risk starts when money, tickets, visas, investment, crypto, or “urgent help” appears.\n\nDo not transfer anything yet. Send their request as text.",
    },
    romance_money: {
      ru: "Романтический знакомый просит деньги, билет, визу, лечение или инвестицию — это частый сценарий обмана.\n\nПока ничего не переводите. Поставьте паузу, сохраните переписку и проверьте ситуацию с близким человеком.",
      uz: "Romantik tanish pul, chipta, viza, davolanish yoki investitsiya so'rasa — bu keng tarqalgan firibgarlik sxemasi.\n\nHozircha pul o'tkazmang. To'xtab turing, yozishmani saqlang va vaziyatni yaqin inson bilan tekshiring.",
      en: "A romantic contact asking for money, a ticket, visa, treatment, or investment is a common scam pattern.\n\nDo not transfer anything yet. Pause, save the chat, and review it with a trusted person.",
    },
    job_offer: {
      ru: "Работа/лёгкий доход становится опасной, если просят взнос, обучение, депозит, карту, APK или ваши документы.\n\nНе платите заранее. Пришлите текст предложения или ссылку.",
      uz: "Ish/yengil daromad xavfli bo'ladi, agar badal, o'qish puli, depozit, karta, APK yoki hujjat so'ralsa.\n\nOldindan to'lamang. Taklif matni yoki havolani yuboring.",
      en: "A job/easy-income offer becomes risky if they ask for a fee, training payment, deposit, card data, APK, or documents.\n\nDo not pay upfront. Send the offer text or link.",
    },
    earning_channel: {
      ru: "Канал или бот с быстрым заработком — риск. Часто сначала просят нажать кнопку, перейти по ссылке, ввести код, карту или оплатить «доступ».\n\nПока не переходите и ничего не вводите. Пришлите ссылку, username или скрин условий.",
      uz: "Tez daromad va'da qiladigan kanal yoki bot — xavf. Ko'pincha avval tugmani bosish, havolaga o'tish, kod/karta kiritish yoki «kirish» uchun to'lashni so'rashadi.\n\nHozircha o'tmang va hech narsa kiritmang. Havola, username yoki shartlar skrinini yuboring.",
      en: "A channel or bot promising fast income is risky. It often starts with pressing a button, opening a link, entering a code/card, or paying for “access”.\n\nDo not open it or enter anything yet. Send the link, username, or screenshot of the terms.",
    },
    investment_offer: {
      ru: "Инвестиции/крипта через Telegram-канал или личного «наставника» часто ведут к депозиту, платным сигналам или комиссии за вывод.\n\nПока не пополняйте баланс и не подключайте кошелёк. Пришлите ссылку, username автора или условия.",
      uz: "Telegram-kanal yoki shaxsiy «ustoz» orqali investitsiya/kripto ko'pincha depozit, pulli signallar yoki yechib olish komissiyasiga olib boradi.\n\nHozircha balans to'ldirmang va hamyon ulamang. Havola, muallif username'i yoki shartlarni yuboring.",
      en: "Investment/crypto through a Telegram channel or personal “mentor” often leads to deposits, paid signals, or withdrawal fees.\n\nDo not top up a balance or connect a wallet yet. Send the link, author username, or terms.",
    },
    travel_migration_prepayment: {
      ru: "Визы, работа за границей, туры, хадж/умра или билеты становятся рискованными, если просят предоплату, комиссию, депозит или «сбор за документы» в чате.\n\nПока не платите. Проверьте агентство через официальный сайт/офис, договор и лицензию. Пришлите ссылку или текст условий.",
      uz: "Viza, chet elda ish, tur, haj/umra yoki chipta xavfli bo'ladi, agar chatda oldindan to'lov, komissiya, depozit yoki «hujjat yig'imi» so'ralsa.\n\nHozircha to'lamang. Agentlikni rasmiy sayt/ofis, shartnoma va litsenziya orqali tekshiring. Havola yoki shartlar matnini yuboring.",
      en: "Visas, work abroad, tours, Hajj/Umrah, or tickets become risky if a chat asks for prepayment, a fee, deposit, or “document charge”.\n\nDo not pay yet. Verify the agency through an official site/office, contract, and license. Send the link or terms.",
    },
    legal_impersonation: {
      ru: "Нотариус, юрист, полиция, налоговая или коллектор в чате могут давить страхом.\n\nНе оплачивайте «штраф» по ссылке и не отправляйте документы. Проверьте через официальный номер/сайт и пришлите текст угрозы.",
      uz: "Notarius, yurist, politsiya, soliq yoki kollektor chatda qo'rqitishi mumkin.\n\nHavola orqali «jarima» to'lamang va hujjat yubormang. Rasmiy raqam/sayt orqali tekshiring va tahdid matnini yuboring.",
      en: "A notary, lawyer, police, tax office, or collector in chat may pressure you with fear.\n\nDo not pay a “fine” by link or send documents. Verify through an official number/site and send the threat text.",
    },
    bank_contact_question: {
      ru: "Связывайтесь с банком только через номер в приложении, на карте или на официальном сайте. Номер, который продиктовал звонящий, не используйте.\n\nЕсли уже назвали код, CVV/PIN или перевели деньги — сначала срочно звоните в банк и просите заблокировать карту/операцию.",
      uz: "Bank bilan faqat ilova, karta yoki rasmiy saytdagi raqam orqali bog'laning. Qo'ng'iroq qilgan odam aytgan raqamdan foydalanmang.\n\nKod, CVV/PIN aytgan yoki pul o'tkazgan bo'lsangiz — avval bankka zudlik bilan qo'ng'iroq qilib karta/operatsiyani bloklashni so'rang.",
      en: "Contact the bank only through the number in the app, on the card, or on the official website. Do not use a number dictated by the caller.\n\nIf you already shared a code, CVV/PIN, or transferred money, call the bank urgently and ask to block the card/operation.",
    },
    report_question: {
      ru: "Если уже ушли деньги или код — сначала банк: попросите заблокировать карту/операцию. Затем можно обратиться в полицию/102 и сохранить чеки, номера, ссылки и переписку.\n\nЧтобы предупредить других через Ishonch Guard, нажмите «Сообщить случай» или пришлите номер, ссылку, username и короткое описание.",
      uz: "Pul yoki kod ketgan bo'lsa — avval bank: karta/operatsiyani bloklashni so'rang. Keyin politsiya/102 ga murojaat qiling va chek, raqam, havola, yozishmalarni saqlang.\n\nIshonch Guard orqali boshqalarni ogohlantirish uchun «Xabar berish» tugmasini bosing yoki raqam, havola, username va qisqa tavsif yuboring.",
      en: "If money or a code was already sent, call the bank first and ask to block the card/operation. Then contact police/102 and save receipts, numbers, links, and chat history.\n\nTo warn others through Ishonch Guard, tap “Report” or send the number, link, username, and a short description.",
    },
    acknowledgement: {
      ru: "Хорошо. Делайте спокойно, по одному безопасному шагу.\n\nЕсли появится новая просьба — код, карта, перевод, APK, ссылка или звонок — пришлите сюда, я помогу проверить.",
      uz: "Yaxshi. Xotirjam, bitta xavfsiz qadam bilan boring.\n\nYangi so'rov chiqsa — kod, karta, pul, APK, havola yoki qo'ng'iroq — shu yerga yuboring, tekshirishga yordam beraman.",
      en: "Good. Take it calmly, one safe step at a time.\n\nIf a new request appears — code, card, transfer, APK, link, or call — send it here and I will help check it.",
    },
    code_request: unreachableAskedContextText,
    card_request: unreachableAskedContextText,
    transfer_request: unreachableAskedContextText,
    apk_request: unreachableAskedContextText,
    link_request: unreachableAskedContextText,
    trust_or_greeting: {
      ru: "Да, я Ishonch Guard. Я не читаю ваши чаты сам и не прошу коды, PIN, CVV, пароли или деньги.\n\nЧтобы помочь, пришлите номер, ссылку, username, скриншот или коротко: что вас просят сделать.",
      uz: "Ha, men Ishonch Guardman. Chatlaringizni o'zim o'qimayman va kod, PIN, CVV, parol yoki pul so'ramayman.\n\nYordam berishim uchun raqam, havola, username, skrinshot yoki qisqa yozing: sizdan nima so'rashyapti.",
      en: "Yes, I am Ishonch Guard. I do not read your chats by myself and I do not ask for codes, PINs, CVVs, passwords, or money.\n\nTo help, send a number, link, username, screenshot, or briefly what they ask you to do.",
    },
  };

  const specificText = byKind[match.kind][lang];
  if (specificText) return specificText;
  if (match.askedContext) return askedContextIntro(match.askedContext, lang);
  return askedContextIntro(matchAskedContext(match.kind), lang);
}

const unreachableAskedContextText: Record<Lang, string> = {
  ru: "",
  uz: "",
  en: "",
};

function askedContextIntro(context: AskedContextKind, lang: Lang): string {
  const text: Record<AskedContextKind, Record<Lang, string>> = {
    code: {
      ru: "Код никому не называйте. Это может быть вход в банк, Telegram или подтверждение операции.\n\nСейчас: остановитесь, ничего не отправляйте и проверьте только через официальный канал.",
      uz: "Kodni hech kimga aytmang. Bu bank, Telegram kirishi yoki operatsiyani tasdiqlash bo'lishi mumkin.\n\nHozir: to'xtang, hech narsa yubormang va faqat rasmiy kanal orqali tekshiring.",
      en: "Do not tell anyone the code. It can log in to your bank/Telegram or confirm an operation.\n\nNow: stop, send nothing, and verify only through an official channel.",
    },
    card: {
      ru: "Данные карты, CVV, PIN и фото карты не отправляем.\n\nНастоящий банк не просит это в чате или по звонку. Если уже отправили — блокируйте карту через банк.",
      uz: "Karta ma'lumotlari, CVV, PIN va karta rasmini yubormaymiz.\n\nHaqiqiy bank buni chatda yoki qo'ng'iroqda so'ramaydi. Yuborgan bo'lsangiz — bank orqali kartani bloklang.",
      en: "Do not send card data, CVV, PIN, or card photos.\n\nA real bank does not ask for this in chat or on a call. If already sent, block the card through the bank.",
    },
    transfer: {
      ru: "Деньги пока не переводите. Срочный перевод, «безопасный счёт», комиссия или помощь знакомому часто используются в обмане.\n\nЕсли уже перевели — сохраните чек и звоните в банк.",
      uz: "Hozircha pul o'tkazmang. Shoshilinch o'tkazma, «xavfsiz hisob», komissiya yoki tanishga yordam ko'pincha firibgarlikda ishlatiladi.\n\nYuborgan bo'lsangiz — chekni saqlang va bankka qo'ng'iroq qiling.",
      en: "Do not transfer money yet. Urgent transfers, “safe accounts”, fees, or helping a contact are common scam paths.\n\nIf already paid, save the receipt and call the bank.",
    },
    apk: {
      ru: "Не устанавливайте APK или приложение по просьбе из чата/звонка.\n\nТакое приложение может читать SMS и уведомления. Если уже установили — включите авиарежим и удаляйте с помощью близкого/специалиста.",
      uz: "Chat/qo'ng'iroq orqali so'ralgan APK yoki ilovani o'rnatmang.\n\nBunday ilova SMS va bildirishnomalarni o'qishi mumkin. O'rnatgan bo'lsangiz — aviarejimni yoqing va yaqin inson/mutaxassis bilan o'chiring.",
      en: "Do not install an APK/app because a chat/caller asks you to.\n\nSuch an app may read SMS and notifications. If already installed, turn on airplane mode and remove it with a trusted person/specialist.",
    },
    link_qr: {
      ru: "Ссылку или QR сначала проверяем. Не вводите там код, карту, пароль и не подключайте Telegram/кошелёк.\n\nПришлите сам URL или следующий экран после перехода.",
      uz: "Havola yoki QRni avval tekshiramiz. U yerda kod, karta, parol kiritmang va Telegram/hamyon ulamang.\n\nURL yoki o'tgandan keyingi ekranni yuboring.",
      en: "Check the link or QR first. Do not enter a code, card data, password, or connect Telegram/wallet there.\n\nSend the URL or the next screen after opening it.",
    },
    call: {
      ru: "Если звонок ещё идёт — спокойно завершите его.\n\nСкажите: «Я сам перезвоню по официальному номеру». Потом проверьте номер/просьбу здесь.",
      uz: "Qo'ng'iroq davom etayotgan bo'lsa — uni xotirjam tugating.\n\nAyting: «Men rasmiy raqamga o'zim qayta qo'ng'iroq qilaman». Keyin raqam/iltimosni shu yerda tekshiring.",
      en: "If the call is still ongoing, end it calmly.\n\nSay: “I will call back myself using the official number.” Then check the number/request here.",
    },
  };

  return text[context][lang];
}

function matchAskedContext(kind: VictimIntentKind): AskedContextKind {
  switch (kind) {
    case "code_request":
    case "open_budget":
    case "medical_code":
    case "child_game_bonus":
      return "code";
    case "card_request":
      return "card";
    case "transfer_request":
    case "money_mule":
      return "transfer";
    case "apk_request":
    case "apple_security":
      return "apk";
    case "link_request":
    case "link_received":
    case "telegram_takeover":
    case "earning_channel":
      return "link_qr";
    case "bank_call":
    case "operator_call":
    case "unknown_call":
    case "foreign_call":
    case "authority_impersonation":
    case "utility_impersonation":
    case "pension_benefit":
    case "phone_borrowing":
    case "silent_call":
    case "official_impersonation":
      return "call";
    default:
      return "code";
  }
}
