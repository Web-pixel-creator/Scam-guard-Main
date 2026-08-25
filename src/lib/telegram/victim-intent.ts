import type { Lang } from "@/lib/i18n";
import type { InlineKeyboard } from "@/lib/telegram/api.server";
import type { PanicScenarioId } from "@/lib/telegram/emergency";
import {
  buildAskedContextKeyboardRows,
  type AskedContextKind,
} from "@/lib/telegram/check-context-buttons";
import { CB } from "@/lib/telegram/format";
import { bt } from "@/lib/telegram/bot-i18n";
import { normalizeIntentTextForMatching } from "@/lib/telegram/intent-text-normalization";
import { resolveTelegramTextLanguage } from "@/lib/telegram/inline-query-language";
import { transliterateRuLatin } from "@/lib/telegram/ru-translit";
import { isAccidentalOutgoingTransferIntent } from "@/lib/telegram/text-panic-intent";
import { uzbekLatinMatchingVariant } from "@/lib/risk/uz-cyrillic-translit";

export const ALL_VICTIM_INTENTS = [
  "emotional_help",
  "general_scam_concern",
  "advice_question",
  "unknown_contact",
  "unknown_call",
  "foreign_call",
  "identity_uncertain",
  "telegram_message",
  "telegram_takeover",
  "bank_call",
  "operator_call",
  "link_received",
  "file_received",
  "apple_security",
  "code_request",
  "card_request",
  "transfer_request",
  "coercive_secrecy",
  "apk_request",
  "link_request",
  "personal_data_request",
  "personal_data_already_shared",
  "utility_impersonation",
  "pension_benefit",
  "phone_borrowing",
  "money_mule",
  "accidental_transfer_outgoing",
  "open_budget",
  "medical_code",
  "child_game_bonus",
  "silent_call",
  "official_impersonation",
  "friend_money",
  "support_impersonation",
  "authority_impersonation",
  "authority_physical_coercion",
  "gov_service_login",
  "romance_contact",
  "romance_money",
  "job_offer",
  "earning_channel",
  "task_scam",
  "investment_offer",
  "travel_migration_prepayment",
  "legal_impersonation",
  "bank_contact_question",
  "report_question",
  "acknowledgement",
  "blackmail_threat",
  "violence_threat",
  "withdrawal_blocked",
  "identity_loan",
  "unauthorized_charge",
  "account_hacked_other",
  "scammer_recontact",
  "privacy_question",
  "relative_already_paid",
  "trust_or_greeting",
] as const;

export type VictimIntentKind = (typeof ALL_VICTIM_INTENTS)[number];

export const ALL_VICTIM_SCENARIOS = [
  "apk_already_installed",
  "authority_physical_coercion",
  "bank_contact_from_message",
  "fake_boss_request",
  "charity_pressure",
  "fake_support",
  "fake_tax_payment",
  "fake_fine_cashback_app",
  "investment_offer",
  "loan_advance_fee",
  "game_escrow_fee",
  "marketplace_delivery",
  "known_contact_prize_link",
  "money_already_sent",
  "parcel_fee",
  "passport_already_shared",
  "photo_extortion",
  "neighbor_video_malware",
  "police_impersonation",
  "penalty_points_cancellation",
  "prize_fee",
  "qr_login",
  "recovery_fee",
  "rental_deposit",
  "remote_access",
  "romance_money",
  "safe_account_transfer",
  "sim_swap",
  "telegram_account_taken_over",
  "telegram_channel_invite",
  "unknown_stranger_request",
  "vote_link",
] as const;

export type VictimScenario = (typeof ALL_VICTIM_SCENARIOS)[number];

export interface VictimIntentMatch {
  kind: VictimIntentKind;
  askedContext?: AskedContextKind;
  /** Narrow, evidence-backed presentation topic; canonical intent/side effects stay unchanged. */
  scenario?: VictimScenario;
}

/** Coarse, privacy-safe context for a short reply to recent victim guidance. */
export interface VictimFollowUpContext extends VictimIntentMatch {
  at: string;
}

export type VictimGuidanceFollowUpAction =
  | "why"
  | "next_steps"
  | "trusted_person"
  | "reply_script"
  | "verify_official"
  | "explain_simple"
  | "pressure";

export interface VictimGuidanceFollowUp {
  action: VictimGuidanceFollowUpAction;
  context: VictimIntentMatch;
}

export const VICTIM_FOLLOW_UP_CONTEXT_WINDOW_MS = 20 * 60 * 1_000;

const EXPLICIT_URL_RE = /(?:https?:\/\/|www\.|t\.me\/|telegram\.me\/)/iu;
const DOMAIN_LIKE_RE = /\b[a-z0-9-]+\.[a-z]{2,}\b/giu;
const FILE_NAME_LIKE_RE =
  /\b[\p{L}0-9_-]+\.(?:apk|exe|pdf|pptx|docx?|xlsx?|zip|rar|7z|gif|jpe?g|png|mp3|ogg|mp4)\b/iu;
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/u;
const TELEGRAM_HANDLE_RE = /@[a-zA-Z0-9_]{3,}/u;
const PERSONAL_DATA_REQUEST_RE =
  /(?:паспорт|фото\s+(?:паспорта|документ|id|айди)|документ|удостоверени|id.?карт|пинфл|pinfl|jshshir|инн|дата\s+рождения|адрес|прописка|personal\s+data|passport|id\s+card|date\s+of\s+birth|address|pasport|hujjat|jshshir|tug['’]?ilgan|manzil)/iu;
const LONG_MESSAGE_LIMIT = 260;

const ADVICE_QUESTION_RE =
  /(?:что\s+(?:мне\s+)?делать|как\s+понять|что\s+отвечать|что\s+мне\s+(?:ей|ему|им)\s+ответить|нужно\s+ли|можно\s+ли|это\s+точно\s+мошенник|what\s+should\s+i\s+do|should\s+i|how\s+do\s+i\s+know|what\s+do\s+i\s+reply|nima\s+qilay|qanday\s+bilaman|javob\s+beraymi)/iu;
const COMPLETED_LINK_OR_QR_ACTION_RE =
  /(?:(?:я|i|men)\s+)?(?:проверил[аи]?|отсканировал[аи]?|сканировал[аи]?|переш[её]л[аи]?|открыл[аи]?|нажал[аи]?|checked|scanned|opened|followed|clicked|tekshirdim|skaner\s+qildim|skanerladim|ochdim|bosdim|kirdim).{0,60}(?:ссылк|link|havola|qr(?:ni)?|куар)|(?:ссылк|link|havola|qr(?:ni)?|куар).{0,60}(?:проверил[аи]?|отсканировал[аи]?|сканировал[аи]?|переш[её]л[аи]?|открыл[аи]?|нажал[аи]?|checked|scanned|opened|followed|clicked|tekshirdim|skaner\s+qildim|skanerladim|ochdim|bosdim|kirdim)/iu;
const QR_ARTIFACT_RE = /(?:qr(?:ni)?|куар)/iu;
const ACCOUNT_ACCESS_LOSS_RE =
  /(?:потерял[аи]?\s+доступ|не\s+могу\s+(?:войти|зайти|получить\s+доступ)).{0,60}(?:telegram|телеграм|аккаунт)|(?:telegram|телеграм|аккаунт).{0,60}(?:потерял[аи]?\s+доступ|не\s+могу\s+(?:войти|зайти|получить\s+доступ))|(?:cannot|can\s*not|can't|no\s+longer\s+can)\s+(?:access|log\s*in(?:to)?|sign\s*in(?:to)?).{0,40}(?:telegram|account)|lost\s+access.{0,40}(?:telegram|account)|(?:telegram|account).{0,40}(?:lost\s+access|cannot\s+(?:access|log\s*in|sign\s*in))|(?:akkaunt|telegram)(?:im)?ga.{0,40}(?:kira\s+olmayapman|kirolmayapman|kira\s+olmayman|kirolmayman)|(?:kira\s+olmayapman|kirolmayapman|kira\s+olmayman|kirolmayman).{0,40}(?:akkaunt|telegram)/iu;
const POST_ACTION_CONCERN_RE =
  /(?:боюсь|страшно|волнуюсь|переживаю|afraid|scared|worried|qo['’]?rq|xavotir)/iu;
const UNKNOWN_CALL_RE =
  /(?:неизвестн|незнаком|unknown|unfamiliar|hidden|notanish|noma['’]?lum|подозрительн|shubhali|suspicious).{0,80}(?:номер|абонент|звон|входящ|call|caller|raqam|qo['’]?ng['’]?iroq)|(?:номер|абонент|звон|входящ|call|caller|raqam|qo['’]?ng['’]?iroq).{0,80}(?:неизвестн|незнаком|unknown|unfamiliar|hidden|notanish|noma['’]?lum|подозрительн|shubhali|suspicious)/iu;

// High-confidence early routes. These are intentionally narrower than the
// generic request rules below: a completed incident needs aftercare, while a
// request targeting a named relative needs identity verification guidance.
const FAMILY_CONTEXT_RE =
  /(?:^|[^\p{L}])(?:мам\p{L}*|пап\p{L}*|бабуш\p{L}*|дедуш\p{L}*|внук\p{L}*|внуч\p{L}*|муж\p{L}*|жен\p{L}*|супруг\p{L}*|брат\p{L}*|сестр\p{L}*|сын\p{L}*|доч\p{L}*|родствен\p{L}*|близк\p{L}*|друг(?:|а|у|ом|е|и|ов|ья|ьям|ьями)|подруг\p{L}*|семейн\p{L}*|onam\p{L}*|otam\p{L}*|erim\p{L}*|xotinim\p{L}*|turmush\s+o['’]?rtog['’]?im\p{L}*|buvim\p{L}*|bobom\p{L}*|nabir\p{L}*|nevar\p{L}*|akam\p{L}*|ukam\p{L}*|opam\p{L}*|singlim\p{L}*|o['’]?g['’]?lim\p{L}*|qizim\p{L}*|qarindosh\p{L}*|yaqin\p{L}*|do['’]?stim\p{L}*|oilaviy|mother|father|mom|dad|husband|wife|spouse|grandmother|grandfather|grandma|grandpa|brother|sister|son|daughter|relative|friend|family)(?=$|[^\p{L}])/iu;
const COMPLETED_FAMILY_ACTION_RE =
  /(?:уже|успел[аи]?|already|ulgurdi|bo['’]?ldi|перевел[аи]?|перевёл[аи]?|отправил[аи]?|отдал[аи]?|оплатил[аи]?|снял[аи]?|назвал[аи]?|сообщил[аи]?|продиктовал[аи]?|o['’]?tkaz(?:di|ib)|yubor(?:di|ib)|berib|to['’]?la(?:di|b)|aytib|yechib|sent|gave|paid|transferred|withdrew|handed|told|shared)/iu;
const FAMILY_SENSITIVE_VALUE_RE =
  /(?:деньг|денег|миллион|тысяч|сум|перевод|оплат|комисс|код|sms|смс|карт|pul|million|ming|so['’]?m|qarz|o['’]?tkaz|to['’]?lov|komissiya|kod|karta|money|transfer|payment|commission|code|cash)/iu;
const COMPLETED_FAMILY_COUNTERPARTY_RE =
  /(?:мошен|незнаком|чуж|их\s+комисс|им\s+(?:деньг|код)|firibgar|notanish|begona|ular(?:ga|ning).{0,30}(?:komiss|pul|kod)|scammer|stranger|unknown\s+(?:person|courier)|them.{0,30}(?:money|code)|their\s+commission)/iu;
const COMPLETED_CODE_SHARE_RE =
  /(?:(?:назва(?:л|ть)|сообщ|продикт|ayt|told|shared|gave).{0,80}(?:sms|смс|код\s+(?:из\s+sms|подтверждения)|tasdiqlash\s+kod|sms\s+kod|confirmation\s+code)|(?:sms|смс|код\s+(?:из\s+sms|подтверждения)|tasdiqlash\s+kod|sms\s+kod|confirmation\s+code).{0,80}(?:назва(?:л|ть)|сообщ|продикт|ayt|told|shared|gave))/iu;
const COMPLETED_TRANSFER_ACTOR_RE =
  /(?:^|[^\p{L}])(?:я|мы|муж|жена|мама|папа|сын|дочь|i|we|my\s+(?:husband|wife|mother|father|son|daughter)|men|biz|erim|xotinim|onam|otam|o['’]?g['’]?lim|qizim)(?=$|[^\p{L}])/iu;
const COMPLETED_TRANSFER_IMPLICIT_SELF_RE =
  /^(?:уже\s+|вчера\s+|только\s+что\s+)*(?:перев[её]л[аи]?|отправил[аи]?|заплатил[аи]?|оплатил[аи]?)(?=$|[^\p{L}])/iu;
const COMPLETED_TRANSFER_ACTION_RE =
  /(?:перев[её]л[аи]?|отправил[аи]?|заплатил[аи]?|оплатил[аи]?|transferred|sent|paid|o['’]?tkazd\p{L}*|yubord\p{L}*|to['’]?lad\p{L}*)/iu;
const COMPLETED_TRANSFER_VALUE_RE =
  /(?:ден[ьи]?г|миллион|тысяч|сум|сч[её]т|money|million|thousand|account|pul|million|ming|so['’]?m|hisob|\d)/iu;
const COMPLETED_TRANSFER_HARM_RE =
  /(?:мошен|обман|скам|этот\s+сч[её]т|трубк\p{L}*\s+не\s+бер|не\s+отвеча|пропал\p{L}*|что\s+делать|куда\s+звонить|scam|fraud|this\s+account|stopped\s+answering|no\s+longer\s+answer|what\s+should\s+i\s+do|firibgar|aldash|shu\s+hisob|javob\s+bermay|nima\s+qilay|qayerga\s+qo['’]?ng['’]?iroq)/iu;
const COMPLETED_APP_INSTALL_ACTION_RE =
  /(?:установил[аи]?|поставил[аи]?|скачал[аи]?|installed|downloaded|o['’]?rnatd\p{L}*|yuklad\p{L}*)/iu;
const COMPLETED_APP_INSTALL_ARTIFACT_RE = /(?:приложен|apk|app|application|ilova|dastur)/iu;
const COMPLETED_APP_INSTALL_HARM_RE =
  /(?:прислал|отправил|из\s+(?:чата|telegram)|по\s+просьб|странн\p{L}*.{0,35}(?:sms|смс)|(?:sms|смс).{0,35}странн|sent\s+(?:it|me)|from\s+(?:a\s+)?chat|asked\s+me|strange.{0,30}(?:sms|text)|yubor|jo['’]?nat|chatdan|so['’]?rashdi|g['’]?alati.{0,30}(?:sms|xabar))/iu;
const ACTIVE_FAMILY_REQUEST_RE =
  /(?:просит|просят|просил[аи]?|попросил|просьб|сбор|занять|одолж|попал.{0,20}бед|(?:нужно|надо|требу(?:ет|ют)).{0,80}(?:заплат|передат|отдат|привез)|голос.{0,40}помощ|so['’]?ra|iltimos|aytish|yig['’]?ish|muammoga\s+tush|ovoz.{0,40}yordam|asks?|asking|request|borrow|collection|in\s+trouble|voice.{0,40}(?:help|money))/iu;
const FAMILY_REQUEST_VALUE_RE =
  /(?:деньг|денег|перевод|оплат|заплат|штраф|налич|курьер|доллар|рубл|бед|сбор|pul|qarz|o['’]?tkaz|to['’]?lov|to['’]?la|muammo|yig['’]?ish|money|transfer|pay|cash|fine|courier|trouble|collection)/iu;
const FAMILY_IMPERSONATION_HELP_RE =
  /(?:голос|ovoz|voice).{0,60}(?:помощ|yordam|help)|(?:помощ|yordam|help).{0,60}(?:голос|ovoz|voice)/iu;
const COMPLETED_PERSONAL_DATA_RE =
  /(?:(?:я|i|men).{0,80}(?:отправил[аи]?|выслал[аи]?|послал[аи]?|передал[аи]?|загрузил[аи]?|sent|shared|submitted|uploaded|yubordim|jo['’]?natdim|yukladim|taqdim\s+etdim|yuborib\s+qo['’]?ydim).{0,120}(?:(?:фото|скан|копи[юя])\s+(?:своего\s+|моего\s+)?(?:паспорта|удостоверения|документа)|паспорт|удостоверен|документ\s+удостоверяющ|passport|passport\s+(?:photo|scan|copy)|identity\s+document|(?:photo|scan|copy)\s+of\s+(?:my\s+)?(?:passport|identity\s+document)|pasport|shaxsiy\s+hujjat|(?:pasport|hujjat)\s+(?:rasmi|nusxasi))|(?:я|i|men).{0,80}(?:(?:фото|скан|копи[юя])\s+(?:своего\s+|моего\s+)?(?:паспорта|удостоверения|документа)|паспорт|удостоверен|документ\s+удостоверяющ|passport|passport\s+(?:photo|scan|copy)|identity\s+document|(?:photo|scan|copy)\s+of\s+(?:my\s+)?(?:passport|identity\s+document)|pasport|shaxsiy\s+hujjat|(?:pasport|hujjat)\s+(?:rasmi|nusxasi)).{0,120}(?:отправил[аи]?|выслал[аи]?|послал[аи]?|передал[аи]?|загрузил[аи]?|sent|shared|submitted|uploaded|yubordim|jo['’]?natdim|yukladim|taqdim\s+etdim|yuborib\s+qo['’]?ydim))/iu;
const COMPLETED_PASSWORD_ENTRY_RE =
  /(?:(?:я|i|men).{0,80}(?:вв[её]л|entered|kiritib\s+bo['’]?ldim).{0,80}(?:парол|password|parol).{0,80}(?:чуж|someone\s+else|begona).{0,30}(?:site|сайт|sayt)|(?:я|i|men).{0,80}(?:чуж|someone\s+else|begona).{0,30}(?:site|сайт|sayt).{0,80}(?:парол|password|parol).{0,80}(?:вв[её]л|entered|kiritib\s+bo['’]?ldim))/iu;
const UNAUTHORIZED_CHARGE_RE =
  /(?:списали|списание|сняли).{0,80}(?:без\s+(?:моего\s+)?разрешения|котор(?:ый|ое)\s+я\s+не\s+совершал)|(?:без\s+(?:моего\s+)?разрешения).{0,80}(?:списали|сняли)|(?:kartamdan|hisobimdan).{0,80}ruxsatsiz.{0,80}(?:pul\s+yechildi|to['’]?lov)|ruxsatsiz.{0,80}(?:pul\s+yechildi|to['’]?lov)|(?:money|payment|charge).{0,80}(?:taken|charged|debited|appeared).{0,80}(?:without\s+(?:my\s+)?permission|i\s+did\s+not\s+make)/iu;
const SAFE_ROUTINE_PAYMENT_RE =
  /(?:(?:mother|mom).{0,60}(?:already\s+)?paid.{0,60}(?:electricity|utility)\s+bill|мам\p{L}*.{0,60}(?:уже\s+)?оплатил\p{L}*.{0,60}коммунальн\p{L}*\s+услуг\p{L}*|onam\p{L}*.{0,60}elektr\s+to['’]?lovini.{0,60}to['’]?ladi|i\s+already\s+sent\s+money\s+back\s+to\s+my\s+friend|я\s+уже\s+вернул\p{L}*\s+деньги\s+другу)/iu;
const SAFE_OFFICIAL_DOCUMENT_UPLOAD_RE =
  /(?:(?:i|я|men).{0,80}(?:sent|shared|submitted|uploaded|отправил[аи]?|выслал[аи]?|загрузил[аи]?|yubordim|jo['’]?natdim|yukladim|taqdim\s+etdim).{0,100}(?:passport|identity\s+document|\bid\b|паспорт|удостоверен|pasport|shaxsiy\s+hujjat|hujjat\s+(?:rasmi|nusxasi)).{0,140}(?:official|официальн\p{L}*|rasmiy).{0,100}(?:app|government\s+portal|bank(?:ing)?\s+app|visa\s+application\s+cent(?:er|re)|государственн\p{L}*\s+портал|приложен\p{L}*\s+банк\p{L}*|визов\p{L}*\s+центр\p{L}*|davlat\s+portali|bank\s+ilovasi|viza\s+markazi)|(?:i|я|men).{0,80}(?:passport|identity\s+document|\bid\b|паспорт|удостоверен|pasport|shaxsiy\s+hujjat|hujjat\s+(?:rasmi|nusxasi)).{0,100}(?:official|официальн\p{L}*|rasmiy).{0,100}(?:app|government\s+portal|bank(?:ing)?\s+app|visa\s+application\s+cent(?:er|re)|государственн\p{L}*\s+портал|приложен\p{L}*\s+банк\p{L}*|визов\p{L}*\s+центр\p{L}*|davlat\s+portali|bank\s+ilovasi|viza\s+markazi).{0,100}(?:sent|shared|submitted|uploaded|отправил[аи]?|выслал[аи]?|загрузил[аи]?|yubordim|jo['’]?natdim|yukladim|taqdim\s+etdim))/iu;
const SAFE_OFFICIAL_DOCUMENT_HANDOFF_RE =
  /(?:(?:я).{0,80}(?:передал[аи]?|послал[аи]?).{0,100}(?:паспорт|удостоверен).{0,140}(?:официальн\p{L}*).{0,100}(?:государственн\p{L}*\s+портал|приложен\p{L}*\s+банк\p{L}*|визов\p{L}*\s+центр\p{L}*)|(?:men).{0,80}(?:pasport|shaxsiy\s+hujjat).{0,140}(?:rasmiy).{0,100}(?:davlat\s+portali|bank\s+ilovasi|viza\s+markazi).{0,100}(?:topshirdim|taqdim\s+etdim))/iu;
const SAFE_OFFICIAL_SIM_SERVICE_RE =
  /(?:(?:mobile\s+operator|mobile\s+carrier|оператор|beeline|ucell|mobiuz|uzmobile|uztelecom).{0,100}(?:replaced|reissued|заменил\p{L}*|перевыпустил\p{L}*|almashtir\p{L}*).{0,80}(?:sim|e-?sim|сим).{0,100}(?:official\s+(?:office|store)|официальн\p{L}*\s+(?:офис|салон)|rasmiy\s+(?:ofis|do['’]?kon))|(?:official\s+(?:office|store)|официальн\p{L}*\s+(?:офис|салон)|rasmiy\s+(?:ofis|do['’]?kon)).{0,100}(?:mobile\s+operator|mobile\s+carrier|оператор|beeline|ucell|mobiuz|uzmobile|uztelecom).{0,100}(?:replaced|reissued|заменил\p{L}*|перевыпустил\p{L}*|almashtir\p{L}*).{0,80}(?:sim|e-?sim|сим))/iu;
const AUTHORITY_CONTACT_RE =
  /(?:(?:мне|нам|меня|со\s+мной).{0,70}(?:звон(?:ит|ят|или|ил|ила)|позвон(?:ил|ила|или)|пиш(?:ет|ут)|написал[аи]?|связал[аси]?ь?|обратил[аси]?ь?).{0,140}(?:рувд|(?<!\p{L})овд(?!\p{L})|мвд|полици|прокуратур|следовател|майор|кадастр|налогов|солик|солиқ|суд)|(?:мне|нам|меня|со\s+мной).{0,70}(?:рувд|(?<!\p{L})овд(?!\p{L})|мвд|полици|прокуратур|следовател|майор|кадастр|налогов|солик|солиқ|суд).{0,140}(?:звон(?:ит|ят|или|ил|ила)|позвон(?:ил|ила|или)|пиш(?:ет|ут)|написал[аи]?|связал[аси]?ь?|обратил[аси]?ь?)|(?:рувд|(?<!\p{L})овд(?!\p{L})|мвд|полици|прокуратур|следовател|майор|кадастр|налогов|солик|солиқ|суд).{0,140}(?:звон(?:ит|ят|или|ил|ила)|пиш(?:ет|ут)|написал[аи]?|связал[аси]?ь?|обратил[аси]?ь?).{0,70}(?:мне|нам|меня)|(?:menga|bizga|men\s+bilan).{0,70}(?:qo['’]?ng['’]?iroq|qong['’]?iroq|telefon|yoz|xabar|bog['’]?lan).{0,140}(?:iib|ichki\s+ishlar|politsiya|prokuratura|prokuror|tergovchi|soliq|kadastr|sud)|(?:menga|bizga|men\s+bilan).{0,70}(?:iib|ichki\s+ishlar|politsiya|prokuratura|prokuror|tergovchi|soliq|kadastr|sud).{0,140}(?:qo['’]?ng['’]?iroq|qong['’]?iroq|telefon|yoz|xabar|bog['’]?lan)|(?:iib|ichki\s+ishlar|politsiya|prokuratura|prokuror|tergovchi|soliq|kadastr|sud).{0,140}(?:qo['’]?ng['’]?iroq|qong['’]?iroq|telefon|yoz|xabar|bog['’]?lan).{0,70}(?:menga|bizga)|(?:me|us).{0,70}(?:call(?:ed|ing|s)?|wrote|messag(?:ed|ing|es)?|text(?:ed|ing|s)?|contact(?:ed|ing|s)?).{0,140}(?:police|prosecutor|tax\s+(?:office|authority)|court|investigator|detective)|(?:police|prosecutor|tax\s+(?:office|authority)|court|investigator|detective).{0,140}(?:call(?:ed|ing|s)?|wrote|messag(?:ed|ing|es)?|text(?:ed|ing|s)?|contact(?:ed|ing|s)?).{0,70}(?:me|us))/iu;
const QUOTED_RU_LEGAL_AUTHORITY_CLAIM_RE =
  /(?:(?:(?:я|мы)\s+(?:(?:сотрудник|представитель|следователь|майор)\s+)?(?:из\s+)?(?:рувд|(?<!\p{L})овд(?!\p{L})|мвд|полици|прокуратур)|(?:это|говорит)\s+(?:рувд|(?<!\p{L})овд(?!\p{L})|мвд|полици|прокуратур)).{0,180}(?:вас\s+подозрева|вы\s+подозрева|вас\s+обвиня|против\s+вас.{0,35}(?:дело|производство)|вы\s+проходите\s+по\s+(?:уголовн\p{L}*\s+)?делу|вас\s+разыскива|вы\s+в\s+розыске|вам\s+грозит|вас\s+задержат)|(?:вас\s+подозрева|вы\s+подозрева|вас\s+обвиня|против\s+вас.{0,35}(?:дело|производство)|вы\s+проходите\s+по\s+(?:уголовн\p{L}*\s+)?делу|вас\s+разыскива|вы\s+в\s+розыске|вам\s+грозит|вас\s+задержат).{0,180}(?:(?:я|мы)\s+(?:(?:сотрудник|представитель|следователь|майор)\s+)?(?:из\s+)?(?:рувд|(?<!\p{L})овд(?!\p{L})|мвд|полици|прокуратур)|(?:это|говорит)\s+(?:рувд|(?<!\p{L})овд(?!\p{L})|мвд|полици|прокуратур)))/iu;
const QUOTED_UZ_LEGAL_AUTHORITY_CLAIM_RE =
  /(?:(?:men\s+(?:(?:iib|ichki\s+ishlar|politsiya|prokuratura)(?:dan)?(?:man)?|(?:iib|ichki\s+ishlar|politsiya|prokuratura)\s+xodimiman)|bu\s+(?:iib|ichki\s+ishlar|politsiya|prokuratura)).{0,180}(?:siz.{0,45}(?:gumon|ayblan|jinoyat\s+ishi|qidiruv)|sizga.{0,45}(?:jinoyat\s+ishi|ayblov)))/iu;
const QUOTED_EN_LEGAL_AUTHORITY_CLAIM_RE =
  /(?:(?:i\s+am|i['’]?m|this\s+is)\s+(?:(?:an?\s+)?(?:officer|investigator|detective)\s+(?:with|from)\s+|from\s+)?(?:the\s+)?(?:police|prosecutor['’]?s?\s+office).{0,180}(?:you\s+are\s+(?:suspected|accused|under\s+investigation)|you\s+are\s+wanted|there\s+is\s+(?:a\s+)?(?:criminal\s+)?case\s+against\s+you|a\s+warrant.{0,35}you))/iu;
const AUTHORITY_LEGAL_TOPIC_RE =
  /(?:рувд|(?<!\p{L})овд(?!\p{L})|мвд|полици|прокуратур|следовател|инспектор|(?<!\p{L})iib(?!\p{L})|ichki\s+ishlar|politsiya|prokuror|tergovchi|police|investigator|detective|prosecutor|law\s+enforcement\s+officer)/iu;
const AUTHORITY_LEGAL_ALLEGATION_RE =
  /(?:подозрева|подозреваем|обвиня|уголовн\p{L}*\s+дел|разыскива|розыск|задерж|jinoyat\s+ishi|gumon|ayblan|qidiruv|suspect(?:ed)?|criminal\s+case|accused|under\s+investigation|warrant)/iu;
const OPERATOR_SIM_TOPIC_RE =
  /(?:sim(?:-?карт\p{L}*)?|e-?sim|сим(?:-?карт\p{L}*)?|оператор|beeline|ucell|mobiuz|uzmobile|uztelecom|mobile\s+operator|mobile\s+carrier|cell(?:ular)?\s+carrier)/iu;
const OPERATOR_SIM_CHANGE_RE =
  /(?:замен|перевыпуск|восстанов|перенос\p{L}*\s+номер|almashtir|qayta\s+chiqar|raqam\p{L}*\s+ko['’]?chir|replace|replacement|swap|reissue|port(?:ing)?\s+(?:my\s+)?number)/iu;
const OPERATOR_SIM_SECRET_RE = /(?:sms|смс|otp|код|code|kod|tasdiqlash)/iu;
const INVESTMENT_VEHICLE_RE =
  /(?:инвест|крипт|бирж|трейд|ton|wallet|кошел[её]к|invest|crypto|trading|exchange|hamyon)/iu;
const INVESTMENT_PROMISE_RE =
  /(?:гарантир|гарантирован|доход|прибыл|быстр\p{L}*\s+процент|кафолат|kafolat|daromad|foyda|tez\s+foiz|guaranteed|guarantee|income|profit|return|yield)/iu;
const INVESTMENT_SOLICIT_RE =
  /(?:предлага|приглаша|совету|обеща|влож|внести|пополни|taklif|va['’]?da|pul\s+qo['’]?y|depozit|offer|invite|promise|deposit)/iu;
const SAFE_PHYSICAL_ACCESS_CODE_RE =
  /(?:(?:door|entrance|gate|подъезд|домофон|двер|ворот|eshik|darvoza).{0,50}(?<!\p{L})(?:code|код|kod(?:i(?:ni)?)?)(?!\p{L})|(?<!\p{L})(?:code|код|kod(?:i(?:ni)?)?)(?!\p{L}).{0,50}(?:door|entrance|gate|подъезд|домофон|двер|ворот|eshik|darvoza))/iu;

function withoutQrCodeLabel(text: string): string {
  return text
    .replace(/\bqr[\s-]*(?:code|код|kod)\b/giu, "qr")
    .replace(/\b(?:code|код|kod)[\s-]*qr\b/giu, "qr");
}

function normalizeVictimText(text: string): string {
  return (
    normalizeIntentTextForMatching(text)
      .replace(/ё/g, "е")
      .replace(/Ё/g, "Е")
      // Emotional letter stretching («памагитееее») — collapse 3+ repeats of a
      // letter to two. Digits are excluded so phone/amount payloads survive.
      .replace(/([^\d\s])\1{2,}/g, "$1$1")
  );
}

function hasConcreteArtifact(text: string): boolean {
  if (EXPLICIT_URL_RE.test(text) || PHONE_RE.test(text) || TELEGRAM_HANDLE_RE.test(text)) {
    return true;
  }

  for (const [domainLike] of text.matchAll(DOMAIN_LIKE_RE)) {
    if (!FILE_NAME_LIKE_RE.test(domainLike)) return true;
  }

  return false;
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
  return /(?:^|[\s,.;:!?])(?:мне|меня|у\s+меня|со\s+мной|я|он|она|они|незнакомец|мама|папа|бабушк[аеи]?|дедушк[аеи]?|брат|сестра|маму|папу|друга|сын|дочь|мени|бизни|менга|menga|mendan|meni|men|bizga|bizdan|biz|ular|onam|otam|i|me|my|they|someone|caller)(?=$|[\s,.;:!?])/iu.test(
    text,
  );
}

function hasAskVerb(text: string): boolean {
  return /(?:просят|просит|попросил[аи]?|спрашива(?:ет|ют)|спросил[аи]?|сказал[аи]?|говорит|требу(?:ет|ют)|нужно|надо|хочет|хотят|asked|asks|asking|told|wants?|needs?|so['’]?ra|sorashyap|ayt|deyap|kerak)/iu.test(
    text,
  );
}

function isCardCredentialRequest(text: string): boolean {
  return (
    /(?:карт|карта|karta|card)/iu.test(text) &&
    /(?:просят|просит|спрашива|требу|сўра\p{L}*|so['’]?ra\p{L}*|ask(?:ed|s|ing)?|need(?:ed|s)?)/iu.test(
      text,
    ) &&
    /(?:номер\s+карт|срок\s+действ|три\s+цифр|цифр.{0,24}(?:сзади|оборот)|рақам|уч\s+рақам|орқасид|raqam|uch\s+raqam|orqasid|expiry|three\s+digits|cvv|cvc)/iu.test(
      text,
    )
  );
}

function isExplicitCodeRequest(text: string): boolean {
  return (
    hasVictimRequestFrame(text) &&
    hasAskVerb(text) &&
    /(?:sms|смс|otp|push|пуш).{0,60}(?:код|code|kod|цифр|digits)|(?:код|code|kod|цифр|digits).{0,60}(?:sms|смс|otp|push|пуш)/iu.test(
      text,
    )
  );
}

function isBankOrCardCodeDisclosureRequest(text: string): boolean {
  return (
    hasVictimRequestFrame(text) &&
    hasAskVerb(text) &&
    /(?:банк|bank|карт|card|karta)/iu.test(text) &&
    /(?:код|code|kod|цифр|digits)/iu.test(text) &&
    /(?:продикт|назва|сказа|сообщ|переда|отправ|дикт|tell|say|share|send|dictat|ayt|yubor|jo['’]?nat)/iu.test(
      text,
    )
  );
}

function isPensionOrSubsidyRequest(text: string): boolean {
  return (
    /(?:пенси\p{L}*|нафақа|нафака|субсиди\p{L}*|ижтимоий\s+ҳимоя|ижтимоий\s+химоя|nafaqa|subsidiya|ijtimoiy\s+himoya|pension|benefit)/iu.test(
      text,
    ) &&
    /(?:код|sms|смс|карт|рақам|ракам|сўра|сура|юбор|тасдиқ|тасдик|ссыл|подтверд|code|card|raqam|so['’]?ra|yubor|tasdiq|havola|link)/iu.test(
      text,
    )
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

const VICTIM_CLAUSE_SPLIT_RE =
  /[,.!?;،:\u2013\u2014\n]+|\s+(?:but|however|then|after\s+that|но|однако|затем|потом|lekin|keyin)\s+/iu;
const SENSITIVE_ACCOUNT_CODE_CONTEXT_RE =
  /(?:банк|банков|сч[её]т|аккаунт|вход|логин|telegram|телеграм|bank|banking|account|login|sign[\s-]?in|hisob|kirish|sms|смс|otp|verification|tasdiq)/iu;

function isSafePhysicalAccessOnly(text: string): boolean {
  const clauses = text
    .split(VICTIM_CLAUSE_SPLIT_RE)
    .map((clause) => clause.trim())
    .filter(Boolean);
  if (!clauses.some((clause) => SAFE_PHYSICAL_ACCESS_CODE_RE.test(clause))) return false;

  return clauses.every((clause) => {
    if (!SAFE_PHYSICAL_ACCESS_CODE_RE.test(clause)) {
      return !(
        hasVictimRequestFrame(clause) &&
        hasAskVerb(clause) &&
        /(?:код|code|kod|парол|password|цифр|digits)/iu.test(clause)
      );
    }

    const codeMentions = clause.match(/(?:код|code|kod)/giu)?.length ?? 0;
    return !(
      SENSITIVE_ACCOUNT_CODE_CONTEXT_RE.test(clause) ||
      (codeMentions > 1 && hasAskVerb(clause))
    );
  });
}

const UZ_TRAVEL_TOPIC_RE =
  /(?:viza|koreya|rossiya|migratsiya|haj|umra|(?<!\p{L})tur(?!\p{L})|sayohat|agentlik|(?:chet\s+el(?:ga|da|dagi)?|xorij(?:ga|da|dagi)?)\s+(?:ishga|ishlash(?:ga)?|ish))/iu;
const UZ_PREPAYMENT_RE =
  /(?:to['’]?lov|oldindan|komissiya|garov|depozit|bron|hujjat|o['’]?qish\s+puli|(?<!\p{L})pul\p{L}{0,8}(?!\p{L}))/iu;
const EN_TRAVEL_TOPIC_RE =
  /(?:visa|migration|korea|russia|hajj|umrah|tour|travel\s+agency|(?:work|job)\s+(?:abroad|overseas))/iu;
const EN_PREPAYMENT_RE = /(?:prepay|fee|deposit|commission|advance|payment|training\s+fee)/iu;
const WAIVED_JOB_PAYMENT_RE =
  /(?:без\s+(?:какого[-\s]либо\s+|любого\s+)?(?:взноса?|оплаты?|предоплаты?|комиссии?|депозита?|залога?)|(?:бесплатн\p{L}*\s+(?:обучен\p{L}*|курс\p{L}*|оформлен\p{L}*)|(?:обучен\p{L}*|курс\p{L}*|оформлен\p{L}*)\s+бесплатн\p{L}*)|(?:не\s+(?:нужно|надо|требуется|просят)\s+(?:ничего\s+)?(?:платить|оплачивать|вносить|переводить)|(?:платить|оплачивать|вносить|переводить)\s+не\s+(?:нужно|надо|требуется))|(?<!\p{L})(?:bepul|pulsiz|tekin)(?!\p{L})|(?:(?:pul|to['’]?lov|badal|depozit|garov|komissiya)\s+(?:umuman\s+)?kerak\s+emas)|(?:(?:pul|badal|depozit|garov|komissiya)\s+to['’]?lash|to['’]?lov\s+qilish)\s+kerak\s+emas|(?:no\s+(?:(?:training|course|onboarding|registration)\s+)?(?:fee|payment|deposit|commission|charge)|without\s+(?:a\s+|any\s+|the\s+)?(?:fee|payment|deposit|commission|charge)|free\s+(?:training|course|onboarding|registration)|(?:training|course|onboarding|registration)\s+(?:is\s+)?free|(?:fee|payment|deposit|commission|charge)\s+(?:is\s+)?not\s+required|(?:do\s+not|don['’]?t|not\s+required\s+to)\s+pay(?:\s+(?:a\s+|any\s+|the\s+)?(?:fee|payment|deposit|commission|charge))?))/giu;

function withoutWaivedJobPayments(text: string): string {
  return text.replace(WAIVED_JOB_PAYMENT_RE, " [waived] ");
}

function allMatchIndices(text: string, pattern: RegExp): number[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  const indices: number[] = [];
  for (const match of text.matchAll(matcher)) {
    if (match.index !== undefined) indices.push(match.index);
  }
  return indices;
}

function hasNearbyPatterns(
  text: string,
  left: RegExp,
  right: RegExp,
  maxDistance: number,
): boolean {
  const leftIndices = allMatchIndices(text, left);
  const rightIndices = allMatchIndices(text, right);
  let leftCursor = 0;
  let rightCursor = 0;

  while (leftCursor < leftIndices.length && rightCursor < rightIndices.length) {
    const leftIndex = leftIndices[leftCursor];
    const rightIndex = rightIndices[rightCursor];
    if (Math.abs(leftIndex - rightIndex) <= maxDistance) return true;
    if (leftIndex < rightIndex) leftCursor += 1;
    else rightCursor += 1;
  }
  return false;
}

function isAuthorityLegalIncident(text: string): boolean {
  return (
    hasVictimFrame(text) &&
    hasNearbyPatterns(text, AUTHORITY_LEGAL_TOPIC_RE, AUTHORITY_LEGAL_ALLEGATION_RE, 220)
  );
}

function isOperatorSimSecretRequest(text: string): boolean {
  return (
    hasAskVerb(text) &&
    OPERATOR_SIM_TOPIC_RE.test(text) &&
    OPERATOR_SIM_CHANGE_RE.test(text) &&
    OPERATOR_SIM_SECRET_RE.test(text)
  );
}

function isHighConfidenceInvestmentOffer(text: string): boolean {
  return (
    INVESTMENT_VEHICLE_RE.test(text) &&
    INVESTMENT_PROMISE_RE.test(text) &&
    INVESTMENT_SOLICIT_RE.test(text)
  );
}

function hasExplicitBlackmailLabel(text: string): boolean {
  return /(?:шантаж|шатаж|вымога|sextortion|blackmail|blckmail|shantaj|tovlamachi)/iu.test(text);
}

function isTravelMigrationPrepaymentIntent(text: string): boolean {
  const paymentEvidence = withoutWaivedJobPayments(text);
  return (
    /(?:агентств|турагент|турфирм|визов|виза|коре|росси|рф|миграц|работа\s+за\s+границ|патент|разрешени.{0,20}работ|паломнич|хадж|умра|тур|путевк|авиабилет).{0,140}(?:предоплат|комисс|сбор|депозит|залог|оплат|взнос|бронь|страхов|документ)/iu.test(
      paymentEvidence,
    ) ||
    /(?:предоплат|комисс|сбор|депозит|залог|оплат|взнос|бронь|страхов).{0,140}(?:агентств|турагент|турфирм|визов|виза|коре|росси|рф|миграц|работа\s+за\s+границ|патент|разрешени.{0,20}работ|паломнич|хадж|умра|тур|путевк|авиабилет)/iu.test(
      paymentEvidence,
    ) ||
    hasNearbyPatterns(paymentEvidence, UZ_TRAVEL_TOPIC_RE, UZ_PREPAYMENT_RE, 140) ||
    hasNearbyPatterns(paymentEvidence, EN_TRAVEL_TOPIC_RE, EN_PREPAYMENT_RE, 140)
  );
}

const JOB_ENTRY_FEE_WINDOW_RE =
  /(?:(?:(?<!\p{L})работ(?:а|у|ы|е|ой|ою|ам|ами|ах)(?!\p{L})|ваканс|подработ|заработ|стажиров|работодатель|трудоустрой|нович|(?<!\p{L})ish(?!\p{L})|vakans|daromad|oylik|masofaviy|yangi\s+xodim|ishga\s+(?:kir|taklif|olamiz|qabul)|(?<!\p{L})job(?!\p{L})|(?:before|for|start(?:ing)?|access\s+to)\s+(?:the\s+)?work(?!\p{L})|(?<!\p{L})work(?=\s+(?:training|course|uniform|fee|deposit|access|onboarding))|vacanc|income|remote\s+work|employ|new\s+hire|newcomer|onboard).{0,140}(?:взнос|обуч|курс|(?<!\p{L})(?:спец|уни)?форм(?:а|у|ы|е|ой|ою|ам|ами|ах)?(?!\p{L})|провер|предоплат|комисс|депозит|залог|активац|оформлен|доступ|badal|o['’]?qish|kurs|forma|tekshir|garov|depozit|komiss|faollashtir|ro['’]?yxat|kirish|fee|training|course|uniform|verification|deposit|prepay|commission|activation|registration|access)|(?:взнос|обуч|курс|(?<!\p{L})(?:спец|уни)?форм(?:а|у|ы|е|ой|ою|ам|ами|ах)?(?!\p{L})|провер|предоплат|комисс|депозит|залог|активац|оформлен|доступ|badal|o['’]?qish|kurs|forma|tekshir|garov|depozit|komiss|faollashtir|ro['’]?yxat|kirish|fee|training|course|uniform|verification|deposit|prepay|commission|activation|registration|access).{0,140}(?:(?<!\p{L})работ(?:а|у|ы|е|ой|ою|ам|ами|ах)(?!\p{L})|ваканс|подработ|заработ|стажиров|работодатель|трудоустрой|нович|(?<!\p{L})ish(?!\p{L})|vakans|daromad|oylik|masofaviy|yangi\s+xodim|ishga\s+(?:kir|taklif|olamiz|qabul)|(?<!\p{L})job(?!\p{L})|(?:before|for|start(?:ing)?|access\s+to)\s+(?:the\s+)?work(?!\p{L})|(?<!\p{L})work(?=\s+(?:training|course|uniform|fee|deposit|access|onboarding))|vacanc|income|remote\s+work|employ|new\s+hire|newcomer|onboard))/iu;
const JOB_ENTRY_PAYMENT_ACTION_RE =
  /(?:оплат|заплат|платить|внести|перевест|взнос|предоплат|депозит|залог|комисс|to['’]?la|to['’]?lov|(?<!\p{L})pul\p{L}{0,8}(?!\p{L})|badal|depozit|garov|komiss|\b(?:pay|payment|fee|deposit|commission|charge|prepay)\b)/iu;

/**
 * A bounded, topic-specific job-entry payment route. It intentionally requires
 * both an employment/onboarding signal and a concrete fee/training object so
 * ordinary payments merely mentioned near the word "work" stay on their own
 * route. Work-abroad/visa prepayments retain the more specific travel route.
 */
function isJobEntryFeeIntent(text: string): boolean {
  const paymentEvidence = withoutWaivedJobPayments(text);
  return (
    !isTravelMigrationPrepaymentIntent(paymentEvidence) &&
    JOB_ENTRY_FEE_WINDOW_RE.test(paymentEvidence) &&
    JOB_ENTRY_PAYMENT_ACTION_RE.test(paymentEvidence)
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
    FAMILY_CONTEXT_RE.test(text) &&
    COMPLETED_FAMILY_ACTION_RE.test(text) &&
    FAMILY_SENSITIVE_VALUE_RE.test(text) &&
    (COMPLETED_FAMILY_COUNTERPARTY_RE.test(text) || COMPLETED_CODE_SHARE_RE.test(text))
  ) {
    return { kind: "relative_already_paid", askedContext: "transfer" };
  }

  if (
    FAMILY_CONTEXT_RE.test(text) &&
    ACTIVE_FAMILY_REQUEST_RE.test(text) &&
    (FAMILY_REQUEST_VALUE_RE.test(text) || FAMILY_IMPERSONATION_HELP_RE.test(text))
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
    /(?:apple|ios|iphone|айфон|эппл|apple\s?id).{0,180}(?:вирус|поврежд|72|парол|провер|блок|установ|окно|баннер|разблок)|(?:вирус|поврежд.{0,20}ios|оповещен.{0,20}apple).{0,140}(?:установ|парол|ok|инструкц)/iu.test(
      text,
    )
  ) {
    return { kind: "apple_security", askedContext: "apk" };
  }

  if (
    /(?:telegram|телеграм|телеграмм|teiegram|аккаунт|профиль|premium|премиум).{0,180}(?:галочк|официал|поддержк|блок|удал|замороз|провер|вериф|отмена|спасти|подар|голосован|проголос|мамочк|конкурс|войти|вход|парол|код)|(?:галочк|официал|поддержк|блок|удал|замороз|провер|вериф|отмена|premium|премиум|подар|голосован|проголос|мамочк|конкурс).{0,180}(?:telegram|телеграм|телеграмм|аккаунт|профиль)/iu.test(
      text,
    ) ||
    /(?:одноклассник|одноклассниц|друг|подруга|знаком|родствен|мама|папа|человек|кто.?то).{0,120}(?:просит|попросил|зовет|зовёт|скинул|прислал|отправил).{0,120}(?:голосован|проголос|опрос|конкурс|лучш.{0,30}мам|мамочк).{0,120}(?:ссылк|перей|нажать|кнопк|канал|чат)|(?:одноклассник|одноклассниц|друг|подруга|знаком|родствен|мама|папа|человек|кто.?то).{0,120}(?:просит|попросил|зовет|зовёт|скинул|прислал|отправил).{0,120}(?:ссылк|перей|нажать|кнопк|канал|чат).{0,120}(?:голосован|проголос|опрос|конкурс|лучш.{0,30}мам|мамочк)|(?:голосован|проголос|опрос|конкурс|лучш.{0,30}мам|мамочк).{0,120}(?:ссылк|перей|нажать|кнопк).{0,120}(?:одноклассник|одноклассниц|друг|подруга|знаком|родствен|мама|папа|человек|кто.?то)/iu.test(
      text,
    ) ||
    /(?:просят|просит|попросил[аи]?|зов[её]т|нужно|надо|сказал[аи]?).{0,120}(?:голосован|проголос|опрос|конкурс|лучш.{0,30}мам|мамочк).{0,120}(?:ссылк|перей|нажать|кнопк)|(?:ссылк|перей|нажать|кнопк).{0,120}(?:голосован|проголос|опрос|конкурс|лучш.{0,30}мам|мамочк)/iu.test(
      text,
    ) ||
    /(?:hurmatli|telegram|akkaunt|hisob).{0,180}(?:muzlat|o['’]?chir|blok|tasdiq|havola|parol|kod|premium|sovg['’]?a|ovoz)/iu.test(
      text,
    ) ||
    /(?:просит|просят|попросил[аи]?|пишет|прислал[аи]?|звонит|зв[оа]нят)[\s\S]{0,60}(?:проголосова|голосован)[\s\S]{0,80}(?:конкурс|голосовани|племянниц|дочк|подруг|внучк|лучш)|(?:конкурс|konkurs|tanlov)[\s\S]{0,80}(?:проголос|голосован|ovoz\s+ber)|ovoz\s+ber[\s\S]{0,60}(?:konkurs|tanlov)/iu.test(
      text,
    )
  ) {
    return { kind: "telegram_takeover", askedContext: "link_qr" };
  }

  if (
    /(?:apk|\.apk|exe|\.exe|pdf\.apk|pptx|\.pptx|gif|стикер|открытк|голосов(?:ое|ой)|takvim|таквим|повестк|chaqiruvsud|sudga|so['’]?nggi|последн.{0,20}слов|покидаю.{0,40}мир|ухожу.{0,40}мир|вирус|virus).{0,180}(?:откры|скач|установ|пришл|файл|ссылк|документ|yukla|och|o['’]?rnat)?/iu.test(
      text,
    ) ||
    /(?:приш[её]л[ао]?|пришли|поступил[ао]?|получил[аи]?|получили).{0,80}(?:файл|документ|архив|file|document).{0,100}(?:apk|\.apk|exe|\.exe|pdf\.apk|pptx|\.pptx|gif|повестк|takvim|таквим|chaqiruvsud|sudga|вирус|virus)/iu.test(
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
    ) ||
    /(?:предлага(?:ют|ет)|зов(?:ут|ет)|приглаша(?:ют|ет)|обеща(?:ют|ет)|таклиф|taklif).{0,120}(?:бот|канал|чат|групп|приложени|bot|channel|group).{0,160}(?:заработ|доход|легк.{0,20}деньг|сум.{0,30}день|500\s*000|500000|pul|daromad)/iu.test(
      text,
    )
  ) {
    return { kind: "earning_channel", askedContext: "link_qr" };
  }

  if (
    /(?:водоканал|сувсоз|suvsoz|счетчик|счётчик|умн.{0,20}датчик|(?<!\p{L})газ(?!\p{L})|электроэнерг|электроснаб|электросет|электричеств|(?<!\p{L})свет(?!\p{L})|коммунал|нулев.{0,20}баланс|(?<!\p{L})utility(?!\p{L})).{0,180}(?:паспорт|пинфл|код|sms|смс|ссылк|оплат|звон|данн|адрес|долг|установ|провер)?/iu.test(
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
    /(?:незнаком|посторон|человек|кто.?то).{0,120}(?:просит|попросил|хочет|дал).{0,90}(?:телефон|смартфон).{0,90}(?:позвон|минут|звонок)|(?:на\s+улиц[еуы]|улиц[аеуы]|посторон|незнаком).{0,100}(?:просят|просит|попросил|хочет).{0,90}(?:телефон|смартфон).{0,90}(?:позвон|минут|звонок)|(?:просят|просит|попросил|хочет).{0,60}(?:телефон|смартфон).{0,70}(?:на\s+минут|позвонить|позвон|звонок)|(?:телефон|смартфон).{0,100}(?:на\s+минут|позвонить).{0,100}(?:просит|просят|незнаком|посторон)/iu.test(
      text,
    )
  ) {
    return { kind: "phone_borrowing", askedContext: "call" };
  }

  if (
    /(?:(?:по\s+ошибк|ошибочн|случайн|чуж\p{L}*).{0,100}(?:приш\p{L}*|поступ\p{L}*|зачисл\p{L}*|получ\p{L}*|перевод|деньг)|(?:приш\p{L}*|поступ\p{L}*|зачисл\p{L}*|получ\p{L}*).{0,100}(?:по\s+ошибк|ошибочн|случайн|чуж\p{L}*)).{0,160}(?:вернуть|обратно|пересл|друг.{0,20}счет|друг.{0,20}счёт)|(?:снять|обнал|банкомат|atm).{0,140}(?:деньг|перевод|карт|счет|счёт)|(?:за\s+дозу|терроризм|оружи|назначени.{0,20}платеж)/iu.test(
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
  const combined = classifyVictimIntentWithTranslit(normalized);

  // In a multiline request, Telegram users commonly put the actual scenario
  // on one line and add only a trust/next-step question, pressure detail, URL
  // or username on the other lines. Those wrapper lines must not steal the
  // primary scenario (for example by turning photo blackmail into a generic
  // family-emergency answer). Preserve the sole concrete line intent only when
  // every remaining line is clearly contextual rather than a second scenario.
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) {
    const matches = lines.map((line) => ({
      line: normalizeVictimText(line),
      match: classifyVictimIntentWithTranslit(normalizeVictimText(line)),
    }));
    const concrete = matches.filter(({ match }) => match && isConcreteLineIntent(match.kind));
    if (
      concrete.length === 1 &&
      matches.every(
        ({ line, match }) =>
          match === concrete[0]!.match || (!match && isContextOnlyVictimLine(line)),
      )
    ) {
      return concrete[0]!.match;
    }
  }

  return combined;
}

function classifyVictimIntentWithTranslit(normalized: string): VictimIntentMatch | null {
  // Do not reinterpret an explicitly completed official SIM service as
  // Russian Latin-keyboard input after the direct classifier correctly
  // keeps it neutral.
  if (SAFE_OFFICIAL_SIM_SERVICE_RE.test(normalized)) return null;
  if (
    isExplicitCompletedPersonalGift(normalized) ||
    isExplicitSelfFoundOfficialStoreApp(normalized) ||
    isNeutralEmergencyNumberFact(normalized)
  ) {
    return null;
  }
  // A file name with an Uzbek case suffix (for example ROAD24.apkni) can look
  // like a web domain to the generic artifact detector. Preserve this strict
  // multi-signal scam route before the URL/handle early exit.
  if (isFakeFineCashbackApp(normalized)) {
    return { kind: "apk_request", askedContext: "apk", scenario: "fake_fine_cashback_app" };
  }
  if (isKnownContactPrizeLink(normalized)) {
    return { kind: "identity_uncertain", scenario: "known_contact_prize_link" };
  }
  // A concrete artifact normally belongs to the real checker. Preserve only
  // the deliberately strict investment route here: it requires an investment
  // vehicle, a promised return and solicitation, so a neutral URL such as a
  // relative's YouTube link cannot become victim guidance. Never run either
  // transliteration fallback over a domain, phone or username.
  if (hasConcreteArtifact(normalized)) {
    return isHighConfidenceInvestmentOffer(normalized)
      ? {
          kind: "investment_offer",
          askedContext: "transfer",
          scenario: "investment_offer",
        }
      : null;
  }
  const direct = classifyNormalizedVictimIntent(normalized);
  if (direct) return direct;
  // The risk rules already use this gated Uzbek Cyrillic matching variant.
  // Reuse it here only after the original text matched nothing; the user's
  // original text remains authoritative for display, persistence and logs.
  const uzbekLatin = uzbekLatinMatchingVariant(normalized);
  if (uzbekLatin !== null) {
    const uzbekMatch = classifyNormalizedVictimIntent(uzbekLatin);
    if (uzbekMatch) return uzbekMatch;
  }
  // Do not reinterpret a complete Uzbek-Latin sentence as Russian typed on a
  // Latin keyboard. This matters for neutral wording such as a relative asking
  // for ordinary household help: `yordam` would otherwise become `ердам` and
  // look like a misspelled Russian emergency plea. Ambiguous short fragments
  // still retain the Russian-transliteration fallback.
  if (resolveTelegramTextLanguage(normalized, "en") === "uz") return null;
  // Latin-keyboard fallback: «menya obmanuli» → «меня обманули». Runs only
  // when the original text matched nothing, so native Uzbek Latin phrases
  // (understood directly by the patterns) are unaffected.
  const translit = transliterateRuLatin(normalized);
  return translit === null ? null : classifyNormalizedVictimIntent(translit);
}

const CONTEXTUAL_VICTIM_KINDS = new Set<VictimIntentKind>([
  "account_hacked_other",
  "accidental_transfer_outgoing",
  "apple_security",
  "apk_request",
  "bank_call",
  "blackmail_threat",
  "card_request",
  "code_request",
  "coercive_secrecy",
  "authority_physical_coercion",
  "earning_channel",
  "task_scam",
  "file_received",
  "friend_money",
  "identity_uncertain",
  "identity_loan",
  "gov_service_login",
  "investment_offer",
  "job_offer",
  "legal_impersonation",
  "official_impersonation",
  "operator_call",
  "money_mule",
  "personal_data_request",
  "personal_data_already_shared",
  "relative_already_paid",
  "romance_money",
  "support_impersonation",
  "telegram_takeover",
  "transfer_request",
  "unauthorized_charge",
  "violence_threat",
  "withdrawal_blocked",
  "travel_migration_prepayment",
  "utility_impersonation",
]);

const CONTEXTUAL_TRANSFER_KINDS = new Set<VictimIntentKind>([
  "accidental_transfer_outgoing",
  "coercive_secrecy",
  "earning_channel",
  "task_scam",
  "friend_money",
  "investment_offer",
  "job_offer",
  "romance_money",
  "transfer_request",
  "travel_migration_prepayment",
]);

const CONTEXTUAL_APK_KINDS = new Set<VictimIntentKind>([
  "apple_security",
  "apk_request",
  "file_received",
]);
const ASKED_CONTEXT_KINDS = new Set<AskedContextKind>([
  "code",
  "card",
  "transfer",
  "apk",
  "link_qr",
  "call",
]);

const SHORT_CONTEXT_CONFIRMATION_RE =
  /^(?:точно|вы\s+уверены|ты\s+уверен|правда|really|are\s+you\s+sure|is\s+that\s+right|rostmi|rostdan\s+firibgar(?:lar)?mi|aniqmi|ishonchingiz\s+komilmi)[?!.\s]*$/iu;
const SHORT_CONTEXT_WHY_RE =
  /^(?:(?:а\s+)?п(?:о|а)чему(?:\s+(?:это|так))?(?:\s+(?:опасно|рискованно))?|why(?:\s+is\s+(?:this|it)\s+(?:dangerous|risky))?|nega(?:\s+bu)?(?:\s+(?:xavfli|xatarli))?|nima\s+uchun)[?!.\s]*$/iu;
const SHORT_CONTEXT_NEXT_STEPS_RE =
  /^(?:что(?:\s+мне)?\s+делать\s+дальше|что\s+дальше|(?:(?:ну|ок(?:ей)?)\s*(?:,|и)?\s*)?что\s+теперь|what\s+(?:should|do)\s+i\s+do\s+next|what\s+next|(?:ok(?:ay)?\s*,?\s*(?:and\s+)?)?now\s+what|ok(?:ay)?\s*,?\s*(?:and\s+)?now|endi[-\s]*chi|(?:(?:endi|keyin)\s+)?nima\s+qil(?:ay|ishim\s+kerak|aman)|(?:(?:энди|кейин)\s+)?нима\s+қил(?:ай|ишим\s+керак|аман))[?!.\s]*$/iu;
const SHORT_CONTEXT_TRUSTED_PERSON_RE =
  /^(?:можно\s+(?:ли\s+)?(?:показать|отправить|переслать)\s+(?:это\s+)?(?:сыну|дочери|дочке|близкому|родным|семье|другу|подруге)|can\s+i\s+(?:show|send|forward)\s+(?:this|it)\s+to\s+(?:my\s+)?(?:son|daughter|family|friend|trusted\s+person)|(?:buni\s+)?(?:o['’]?g['’]?limga|qizimga|yaqinimga|oilamga|do['’]?stimga)\s+(?:ko['’]?rsatsam|yuborsam)\s+bo['’]?ladimi)[?!.\s]*$/iu;
const SHORT_CONTEXT_REPLY_SCRIPT_RE =
  /^(?:что(?:\s+мне)?\s+(?:им|ему|ей)\s+(?:сказать|ответить)|что\s+(?:сказать|ответить)|what\s+(?:should|do)\s+i\s+(?:say|reply|answer)(?:\s+to\s+them)?|(?:(?:ularga|unga)\s+)?nima\s+(?:(?:deb\s+)?javob\s+ber(?:ay|sam|ishim\s+kerak)|(?:dey|ayt|yoz)(?:in|ay|sam))|(?:(?:уларга|унга)\s+)?нима\s+(?:(?:деб\s+)?жавоб\s+бер(?:ай|сам|ишим\s+керак)|(?:дей|айт|ёз)(?:ин|ай|сам)))[?!.\s]*$/iu;
const BOUNDED_RU_LATIN_CONTEXT_FOLLOW_UP_RE =
  /^(?:p[oa]chemu|chto\s+(?:mne\s+)?delat\s+dalshe|chto\s+(?:mne\s+)?im\s+(?:skazat|otvetit)|nu\s+i\s+chto\s+teper)[?!.,\s]*$/iu;
const SHORT_CONTEXT_VERIFY_OFFICIAL_RE =
  /^(?:(?:а\s+)?если\s+это\s+(?:правда\s+)?банк,?\s+как\s+проверить|как\s+проверить,?\s+что\s+это\s+(?:правда\s+)?банк|how\s+(?:do|can)\s+i\s+(?:check|verify)\s+(?:that\s+)?it(?:'s|\s+is)\s+(?:really\s+)?(?:the\s+)?bank|bu\s+haqiqiy\s+bank\s+ekanini\s+qanday\s+tekshir(?:aman|sa\s+bo['’]?ladi))[?!.\s]*$/iu;
const SHORT_CONTEXT_EXPLAIN_SIMPLE_RE =
  /^(?:объясни(?:те)?\s+(?:это\s+)?прост(?:о|ыми\s+словами)|explain\s+(?:it|this)\s+(?:simply|in\s+simple\s+words)|(?:sodda|oddiy)\s+(?:qilib|so['’]?zlar\s+bilan)\s+tushuntir(?:ing)?)[?!.\s]*$/iu;
const SHORT_CONTEXT_PRESSURE_RE =
  /^(?=.{1,180}$)(?=.*(?:сроч|тороп|иначе|пропад|urgent|hurry|otherwise|zudlik|tez|aks\s+holda))(?=.*(?:сказал|говор|they\s+say|they\s+said|deyish|aytish|ular)).*$/iu;
const SHORT_MONEY_ALREADY_SENT_RE =
  /^(?=.{1,140}$)(?=.*(?:^|[^\p{L}])(?:я|мне|i|me|men|menga)(?=$|[^\p{L}]))(?=.*(?:перев[её]л|отправил|заплатил|sent|transferred|paid|yubordim|o['’]?tkazdim|to['’]?ladim))(?=.*(?:\d|деньг|миллион|тысяч|сум|money|million|thousand|sum|pul|ming|so['’]?m)).*$/iu;
const SHORT_APK_ALREADY_INSTALLED_RE =
  /^(?=.{1,100}$)(?=.*(?:^|[^\p{L}])(?:я|i|men)(?=$|[^\p{L}]))(?=.*(?:уже\s+установил|already\s+installed|installed\s+it|o['’]?rnat(?:dim|ib\s+bo['’]?ldim))).*$/iu;
const SHORT_APK_REMOVAL_RE =
  /^(?:как\s+(?:его\s+|это\s+)?удалить|как\s+удалить\s+(?:приложение|apk)|how\s+do\s+i\s+(?:remove|uninstall)\s+(?:it|the\s+app)|how\s+to\s+(?:remove|uninstall)\s+(?:it|the\s+app)|qanday\s+(?:uni\s+)?o['’]?chiraman|ilovani\s+qanday\s+o['’]?chiraman)[?!.\s]*$/iu;
const NEGATED_COMPLETION_RE =
  /(?:не\s+(?:перев[её]л|отправил|заплатил|установил)|did\s*not\s+(?:send|transfer|pay|install)|didn['’]?t\s+(?:send|transfer|pay|install)|(?:yubor|o['’]?tkaz|to['’]?la|o['’]?rnat)madim)/iu;
const SHORT_CONTEXT_CODE_ALREADY_SHARED_RE =
  /^(?=.{1,160}$)(?:(?:ну\s+)?(?:я\s+)?(?:им|ему|ей)\s+(?:уже\s+)?(?:все|всё)\s+(?:сказал[аи]?|сообщил[аи]?|назвал[аи]?|продиктовал[аи]?)(?:\s+и\s+что\s+теперь)?|(?:ну\s+)?(?:я\s+)?(?:им|ему|ей)\s+(?:уже\s+)?(?:сказал[аи]?|сообщил[аи]?|назвал[аи]?|продиктовал[аи]?)\s+(?:все|всё)(?:\s+и\s+что\s+теперь)?|(?:men\s+)?(?:ularga|unga)\s+(?:hammasini|barchasini)\s+ayt(?:ib)?vordim(?:\s+endi\s+nima\s+qilay)?|i\s+(?:already\s+)?told\s+them\s+everything(?:[,;:]?\s+(?:and\s+)?what\s+(?:do\s+i\s+do\s+)?now)?)[?!.,\s]*$/iu;

function activeVictimFollowUpContext(value: unknown, now: Date): VictimFollowUpContext | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.kind !== "string" ||
    !ALL_VICTIM_INTENTS.includes(candidate.kind as VictimIntentKind) ||
    !CONTEXTUAL_VICTIM_KINDS.has(candidate.kind as VictimIntentKind) ||
    typeof candidate.at !== "string" ||
    !Number.isFinite(Date.parse(candidate.at))
  ) {
    return null;
  }
  const ageMs = now.getTime() - Date.parse(candidate.at);
  if (ageMs < 0 || ageMs > VICTIM_FOLLOW_UP_CONTEXT_WINDOW_MS) return null;

  const match: VictimFollowUpContext = {
    kind: candidate.kind as VictimIntentKind,
    at: candidate.at,
  };
  if (
    typeof candidate.askedContext === "string" &&
    ASKED_CONTEXT_KINDS.has(candidate.askedContext as AskedContextKind)
  ) {
    match.askedContext = candidate.askedContext as AskedContextKind;
  }
  if (
    typeof candidate.scenario === "string" &&
    ALL_VICTIM_SCENARIOS.includes(candidate.scenario as VictimScenario)
  ) {
    match.scenario = candidate.scenario as VictimScenario;
  }
  return match;
}

export function buildVictimFollowUpContext(
  match: VictimIntentMatch,
  now = new Date(),
): VictimFollowUpContext | null {
  if (!CONTEXTUAL_VICTIM_KINDS.has(match.kind)) return null;
  return { ...match, at: now.toISOString() };
}

/**
 * Interpret only short, artifact-free replies against recent coarse victim
 * guidance. A new link/phone/file always stays a fresh check.
 */
export function classifyVictimContextualFollowUp(
  text: string,
  value: unknown,
  now = new Date(),
): VictimIntentMatch | null {
  const context = activeVictimFollowUpContext(value, now);
  if (!context) return null;
  const normalized = normalizeVictimText(text);
  if (
    !normalized ||
    EXPLICIT_URL_RE.test(normalized) ||
    PHONE_RE.test(normalized) ||
    TELEGRAM_HANDLE_RE.test(normalized) ||
    FILE_NAME_LIKE_RE.test(normalized) ||
    NEGATED_COMPLETION_RE.test(normalized)
  ) {
    return null;
  }

  if (CONTEXTUAL_TRANSFER_KINDS.has(context.kind) && SHORT_MONEY_ALREADY_SENT_RE.test(normalized)) {
    return {
      kind: "transfer_request",
      askedContext: "transfer",
      scenario: "money_already_sent",
    };
  }

  if (
    CONTEXTUAL_APK_KINDS.has(context.kind) &&
    (SHORT_APK_ALREADY_INSTALLED_RE.test(normalized) || SHORT_APK_REMOVAL_RE.test(normalized))
  ) {
    return { kind: "apk_request", askedContext: "apk", scenario: "apk_already_installed" };
  }

  if (SHORT_CONTEXT_CONFIRMATION_RE.test(normalized)) {
    return {
      kind: context.kind,
      ...(context.askedContext ? { askedContext: context.askedContext } : {}),
      ...(context.scenario ? { scenario: context.scenario } : {}),
    };
  }

  return null;
}

/**
 * Resolve an otherwise ambiguous short admission only against a recent,
 * bounded victim context. "I told them everything" is unsafe to interpret as
 * an emergency in isolation, but it is a completed-code event immediately
 * after code guidance.
 */
export function classifyVictimContextualPanicIntent(
  text: string,
  value: unknown,
  now = new Date(),
): PanicScenarioId | null {
  const context = activeVictimFollowUpContext(value, now);
  if (!context || context.askedContext !== "code") return null;

  const normalized = normalizeVictimText(text);
  if (
    !normalized ||
    EXPLICIT_URL_RE.test(normalized) ||
    PHONE_RE.test(normalized) ||
    TELEGRAM_HANDLE_RE.test(normalized) ||
    FILE_NAME_LIKE_RE.test(normalized) ||
    NEGATED_COMPLETION_RE.test(normalized)
  ) {
    return null;
  }

  return SHORT_CONTEXT_CODE_ALREADY_SHARED_RE.test(normalized) ? 1 : null;
}

/**
 * Keep a short explanatory/help question attached to recent enum-only victim
 * guidance. Concrete artifacts remain fresh checks and are never folded into
 * this context.
 */
export function classifyVictimGuidanceFollowUp(
  text: string,
  value: unknown,
  now = new Date(),
): VictimGuidanceFollowUp | null {
  const active = activeVictimFollowUpContext(value, now);
  if (!active) return null;
  const normalized = normalizeVictimText(text);
  if (
    !normalized ||
    EXPLICIT_URL_RE.test(normalized) ||
    PHONE_RE.test(normalized) ||
    TELEGRAM_HANDLE_RE.test(normalized) ||
    FILE_NAME_LIKE_RE.test(normalized)
  ) {
    return null;
  }

  let action: VictimGuidanceFollowUpAction | null = SHORT_CONTEXT_WHY_RE.test(normalized)
    ? "why"
    : SHORT_CONTEXT_NEXT_STEPS_RE.test(normalized)
      ? "next_steps"
      : SHORT_CONTEXT_TRUSTED_PERSON_RE.test(normalized)
        ? "trusted_person"
        : SHORT_CONTEXT_REPLY_SCRIPT_RE.test(normalized)
          ? "reply_script"
          : SHORT_CONTEXT_VERIFY_OFFICIAL_RE.test(normalized)
            ? "verify_official"
            : SHORT_CONTEXT_EXPLAIN_SIMPLE_RE.test(normalized)
              ? "explain_simple"
              : SHORT_CONTEXT_PRESSURE_RE.test(normalized)
                ? "pressure"
                : null;
  if (!action && BOUNDED_RU_LATIN_CONTEXT_FOLLOW_UP_RE.test(normalized)) {
    action = /^p[oa]chemu/iu.test(normalized)
      ? "why"
      : /(?:skazat|otvetit)/iu.test(normalized)
        ? "reply_script"
        : "next_steps";
  }
  if (!action) return null;

  const { at: _at, ...context } = active;
  return { action, context };
}

function buildContextualReplyScript(context: VictimIntentMatch, lang: Lang): string {
  if (context.kind === "authority_physical_coercion") {
    return {
      ru: "Лучше не продолжать разговор. Если нужно закончить одной фразой: «Я не буду выполнять это требование. Я прекращаю контакт и звоню 102». Затем отойдите в безопасное место и позвоните 102; несовершеннолетнему нужно сразу позвать взрослого.",
      uz: "Suhbatni davom ettirmagan ma'qul. Bitta jumla bilan tugatish kerak bo'lsa: «Bu talabni bajarmayman. Aloqani tugatib, 102 ga qo'ng'iroq qilaman». Keyin xavfsiz joyga uzoqlashing va 102 ga qo'ng'iroq qiling; voyaga yetmagan bo'lsangiz, darhol kattani chaqiring.",
      en: "It is safer not to continue. If you need one closing sentence, say: “I will not carry out this demand. I am ending contact and calling 102.” Then move somewhere safe and call 102; a minor should tell a trusted adult immediately.",
    }[lang];
  }

  if (context.kind === "blackmail_threat" || context.kind === "violence_threat") {
    return {
      ru: "Лучше ничего не отвечать и не торговаться. Сохраните угрозы, профиль и время сообщений, затем заблокируйте контакт. При угрозе физической безопасности уйдите в безопасное место и звоните 102.",
      uz: "Javob bermang va savdolashmang. Tahdid, profil va xabar vaqtini saqlang, keyin kontaktni bloklang. Jismoniy xavf bo'lsa, xavfsiz joyga o'tib 102 ga qo'ng'iroq qiling.",
      en: "It is safer not to reply or negotiate. Save the threats, profile, and message times, then block the contact. If there is a physical safety threat, move somewhere safe and call 102.",
    }[lang];
  }

  if (
    context.scenario === "neighbor_video_malware" ||
    context.scenario === "known_contact_prize_link" ||
    context.kind === "identity_uncertain" ||
    context.kind === "friend_money"
  ) {
    return {
      ru: "В этом чате не отвечайте по существу. Позвоните человеку по сохранённому номеру и спросите: «Ты сам отправил это сообщение?» Не пересылайте ему код, пароль или данные карты.",
      uz: "Shu chatning o'zida javob bermang. Odamga saqlangan raqam orqali qo'ng'iroq qilib: «Bu xabarni o'zing yubordingmi?» deb so'rang. Kod, parol yoki karta ma'lumotini yubormang.",
      en: "Do not resolve it in the same chat. Call the person using a saved number and ask, “Did you send this message yourself?” Do not forward a code, password, or card data.",
    }[lang];
  }

  if (
    context.kind === "romance_money" ||
    context.kind === "job_offer" ||
    context.kind === "earning_channel" ||
    context.kind === "task_scam" ||
    context.scenario === "penalty_points_cancellation"
  ) {
    return {
      ru: "Скажите: «Я не перевожу деньги и не отправляю документы до независимой проверки». После этого поставьте разговор на паузу; не объясняйте и не спорьте под давлением.",
      uz: "Ayting: «Mustaqil tekshiruvsiz pul o'tkazmayman va hujjat yubormayman». Keyin suhbatni to'xtating; bosim ostida izoh bermang va bahslashmang.",
      en: "Say: “I will not send money or documents until I verify this independently.” Then pause the conversation; do not explain or argue under pressure.",
    }[lang];
  }

  if (context.kind === "accidental_transfer_outgoing") {
    return {
      ru: "Не договаривайтесь о возврате в переписке и не делайте второй перевод. Напишите только: «Вопрос уже передан моему банку; решаю его через официальный сервис». Дальше следуйте инструкции банка.",
      uz: "Chatda qaytarish haqida kelishmang va ikkinchi o'tkazma qilmang. Faqat: «Bankimga murojaat qildim, masalani rasmiy xizmat orqali hal qilaman», deb yozing. Keyin bank ko'rsatmasiga amal qiling.",
      en: "Do not arrange a return in chat or make a second transfer. Say only: “I have contacted my bank and will handle this through the official service.” Then follow the bank's instructions.",
    }[lang];
  }

  return {
    ru: "Скажите одну фразу: «Я ничего не сообщаю и сам перезвоню по официальному номеру». Затем завершите звонок и не отвечайте на давление.\n\nНе называйте код, данные карты или пароль и не переводите деньги.",
    uz: "Bitta jumla ayting: «Hech narsa aytmayman, rasmiy raqamga o'zim qayta qo'ng'iroq qilaman». Keyin suhbatni tugating va bosimga javob bermang.\n\nKod, karta ma'lumoti yoki parolni aytmang, pul o'tkazmang.",
    en: "Say one sentence: “I will not share anything; I will call back using the official number.” Then end the conversation and do not respond to pressure.\n\nDo not share codes, card data, or passwords, and do not transfer money.",
  }[lang];
}

function buildContextualWhyText(context: VictimIntentMatch, lang: Lang): string {
  if (context.kind === "authority_physical_coercion") {
    return {
      ru: "Опасность в самом требовании: неизвестный человек под видом госоргана пытается заставить вас совершить опасное или незаконное действие. Угроза уголовным делом не подтверждает его полномочия — это способ подчинить и изолировать вас. Не выполняйте просьбу; уйдите в безопасное место и звоните 102.",
      uz: "Xavf talabning o'zida: noma'lum odam davlat idorasi nomidan sizni xavfli yoki noqonuniy ishga majburlayapti. Jinoyat ishi bilan tahdid qilish uning vakolatini tasdiqlamaydi — bu bo'ysundirish va ajratib qo'yish usuli. Talabni bajarmang; xavfsiz joyga o'tib, 102 ga qo'ng'iroq qiling.",
      en: "The demand itself is dangerous: an unknown person is using an authority's name to make you carry out a dangerous or illegal act. A threat of a criminal case is not proof of authority; it is a way to control and isolate you. Do not comply; move somewhere safe and call 102.",
    }[lang];
  }

  if (context.kind === "violence_threat" || context.kind === "blackmail_threat") {
    return {
      ru: "Угрозу нельзя считать безопасной только потому, что она пришла из чата. Платёж или уступка не гарантируют, что угрозы прекратятся, и могут вызвать новые требования. Поэтому приоритет — безопасное место, близкий человек, сохранение доказательств без риска и звонок 102.",
      uz: "Tahdid chatdan kelgani uchun uni xavfsiz deb bo'lmaydi. Pul yoki yon berish tahdid tugashini kafolatlamaydi va yangi talablarni keltirib chiqarishi mumkin. Shuning uchun xavfsiz joy, ishonchli inson, xavfsiz saqlangan dalillar va 102 birinchi o'rinda turadi.",
      en: "A threat is not harmless just because it came through a chat. Paying or complying does not guarantee it will stop and may trigger further demands. Prioritize a safe place, a trusted person, evidence saved without risk, and a call to 102.",
    }[lang];
  }

  if (context.scenario === "neighbor_video_malware") {
    return {
      ru: "Даже знакомый аккаунт могли взломать. APK, файл с двойным расширением или требование установить плеер может дать злоумышленнику доступ к SMS и устройству. Поэтому личность отправителя проверяют отдельным звонком, а вложение не открывают.",
      uz: "Tanish akkaunt ham buzilgan bo'lishi mumkin. APK, ikki kengaytmali fayl yoki player o'rnatish talabi firibgarga SMS va qurilmaga kirish berishi mumkin. Shuning uchun yuboruvchi alohida qo'ng'iroq bilan tekshiriladi, fayl esa ochilmaydi.",
      en: "A familiar account can still be compromised. An APK, double-extension file, or demand to install a player can expose SMS and the device. Verify the sender in a separate call and do not open the attachment.",
    }[lang];
  }

  if (context.scenario === "known_contact_prize_link") {
    return {
      ru: "Имя знакомого не подтверждает ссылку: его аккаунт могли взломать. Такая страница может украсть сеанс Telegram, банковский код или данные карты. Поэтому знакомого проверяют по сохранённому номеру, а акцию находят самостоятельно в официальном приложении или на сайте банка.",
      uz: "Tanish ism havolani tasdiqlamaydi: uning akkaunti buzilgan bo'lishi mumkin. Bunday sahifa Telegram seansi, bank kodi yoki karta ma'lumotini o'g'irlashi mumkin. Tanishni saqlangan raqam orqali tekshiring, aksiyani esa bankning rasmiy ilovasi yoki saytidan o'zingiz toping.",
      en: "A familiar name does not validate the link; the account may be compromised. The page could steal a Telegram session, banking code, or card data. Verify the person through a saved number and find the promotion independently in the bank's official app or site.",
    }[lang];
  }

  if (
    context.scenario === "fake_fine_cashback_app" ||
    context.scenario === "penalty_points_cancellation"
  ) {
    return {
      ru: "Логотип, слово «официально» или знакомый в ведомстве не подтверждают приложение и посредника. Неофициальный APK может получить доступ к SMS и банку, а частный перевод не исправляет государственную запись. Проверяйте штраф или баллы только через самостоятельно открытый официальный сервис.",
      uz: "Logotip, «rasmiy» so'zi yoki idoradagi tanish ilova va vositachini tasdiqlamaydi. Norasmiy APK SMS va bankka kira olishi, shaxsiy o'tkazma esa davlat yozuvini tuzatmasligi mumkin. Jarima yoki ballarni faqat o'zingiz ochgan rasmiy xizmat orqali tekshiring.",
      en: "A logo, the word “official,” or an alleged insider does not validate an app or intermediary. An unofficial APK may access SMS and banking, while a private transfer does not correct a government record. Check fines or points only through an official service you open independently.",
    }[lang];
  }

  if (context.kind === "accidental_transfer_outgoing") {
    return {
      ru: "Обычный перевод, который вы подтвердили сами, не всегда можно отменить автоматически. Только ваш банк или платёжный сервис видит статус операции и может сказать, доступен ли отзыв. Поэтому не делайте второй перевод и обращайтесь через официальный канал как можно скорее.",
      uz: "O'zingiz tasdiqlagan oddiy o'tkazmani har doim avtomatik bekor qilib bo'lmaydi. Operatsiya holatini faqat bank yoki to'lov xizmati ko'radi va qaytarib chaqirish mavjudligini ayta oladi. Ikkinchi o'tkazma qilmang va imkon qadar tez rasmiy kanalga murojaat qiling.",
      en: "A transfer you authorized yourself cannot always be cancelled automatically. Only your bank or payment service can see its status and tell you whether recall is available. Do not make a second transfer; contact the official channel as soon as possible.",
    }[lang];
  }

  return {
    ru: "Риск создаёт не название организации, а просьба передать код, деньги, данные или установить файл под давлением. Эти действия могут дать другому человеку доступ к аккаунту или операции. Завершите контакт и проверьте просьбу независимо через официальный канал.",
    uz: "Xavfni tashkilot nomi emas, bosim ostida kod, pul, ma'lumot yoki fayl o'rnatishni so'rash tug'diradi. Bu boshqa odamga akkaunt yoki operatsiyaga kirish berishi mumkin. Aloqani tugating va so'rovni rasmiy kanal orqali mustaqil tekshiring.",
    en: "The risk comes from the pressured request for a code, money, data, or an installation—not from the organization name. Those actions may give someone access to an account or operation. End contact and verify independently through an official channel.",
  }[lang];
}

function buildContextualNextStepsText(context: VictimIntentMatch, lang: Lang): string {
  if (context.askedContext === "code") {
    return {
      ru: "Код не сообщайте и ничего им не подтверждайте. Завершите контакт, сами откройте официальное приложение или позвоните по официальному номеру. Если код уже передан, сразу завершите неизвестные сеансы или свяжитесь с банком — в зависимости от того, для чего пришёл код.",
      uz: "Kodni aytmang va hech narsani tasdiqlamang. Aloqani tugatib, rasmiy ilovani o'zingiz oching yoki rasmiy raqamga qo'ng'iroq qiling. Kod berilgan bo'lsa, kod nimaga kelganiga qarab begona seanslarni tugating yoki bank bilan darhol bog'laning.",
      en: "Do not share the code or approve anything. End contact and open the official app yourself or call an official number. If the code was already shared, end unknown sessions or contact the bank immediately, depending on what the code was for.",
    }[lang];
  }

  if (context.kind === "authority_physical_coercion") {
    return {
      ru: "Сейчас: не выполняйте требование и не приближайтесь к указанному месту или предмету. Перейдите в безопасное место, позвоните 102 и сообщите близкому; несовершеннолетнему нужно сразу позвать взрослого. Сохраняйте переписку только если это безопасно.",
      uz: "Hozir talabni bajarmang va aytilgan joy yoki buyumga yaqinlashmang. Xavfsiz joyga o'tib, 102 ga qo'ng'iroq qiling va yaqin insonga ayting; voyaga yetmagan bo'lsangiz, darhol kattani chaqiring. Yozishmani faqat xavfsiz bo'lsa saqlang.",
      en: "Do not comply or approach the named place or object. Move somewhere safe, call 102, and tell someone you trust; a minor should tell a trusted adult immediately. Preserve the chat only if it is safe.",
    }[lang];
  }

  if (context.kind === "violence_threat" || context.kind === "blackmail_threat") {
    return {
      ru: "Перейдите в безопасное место и сообщите близкому человеку. Не платите и не соглашайтесь на встречу. Сохраните профиль, время и угрозы без риска для себя, затем позвоните 102; если опасность непосредственная — звоните сразу.",
      uz: "Xavfsiz joyga o'ting va yaqin insonga ayting. Pul to'lamang va uchrashuvga rozi bo'lmang. O'zingizga xavf tug'dirmasa, profil, vaqt va tahdidlarni saqlang, keyin 102 ga qo'ng'iroq qiling; xavf yaqin bo'lsa, darhol qo'ng'iroq qiling.",
      en: "Move somewhere safe and tell a trusted person. Do not pay or agree to meet. Save the profile, timestamps, and threats only if safe, then call 102; call immediately if danger is imminent.",
    }[lang];
  }

  if (context.kind === "accidental_transfer_outgoing") {
    return {
      ru: "Откройте официальный канал своего банка или платёжного сервиса, сообщите время, сумму и получателя и спросите, доступен ли отзыв перевода. Сохраните чек. Не обещайте возврат в чате и не отправляйте вторую сумму; результат возврата не гарантирован.",
      uz: "Bank yoki to'lov xizmatining rasmiy kanalini ochib, vaqt, summa va oluvchini ayting hamda o'tkazmani qaytarib chaqirish mavjudligini so'rang. Chekni saqlang. Chatda qaytarishni va'da qilmang va ikkinchi summa yubormang; qaytish kafolatlanmaydi.",
      en: "Use your bank or payment service's official channel, give the time, amount, and recipient, and ask whether transfer recall is available. Save the receipt. Do not promise a return in chat or send a second amount; recovery is not guaranteed.",
    }[lang];
  }

  if (context.scenario === "fake_fine_cashback_app" || context.kind === "apk_request") {
    return {
      ru: "Не открывайте и не устанавливайте файл. Если APK уже установлен, включите авиарежим и отдельно выключите Wi‑Fi и мобильную связь; с другого доверенного устройства свяжитесь с банком. Сам штраф проверьте в официальном сервисе, открытом вручную.",
      uz: "Faylni ochmang va o'rnatmang. APK o'rnatilgan bo'lsa, aviarejimni yoqing va Wi‑Fi hamda mobil aloqani alohida o'chiring; boshqa ishonchli qurilmadan bank bilan bog'laning. Jarimani o'zingiz ochgan rasmiy xizmatda tekshiring.",
      en: "Do not open or install the file. If the APK is installed, enable airplane mode and separately turn off Wi‑Fi and mobile data; contact the bank from another trusted device. Check the fine in an official service you open manually.",
    }[lang];
  }

  if (context.scenario === "known_contact_prize_link" || context.kind === "friend_money") {
    return {
      ru: "Не используйте ссылку и не отвечайте по существу в том же чате. Позвоните знакомому по сохранённому номеру. Акцию или просьбу проверьте отдельно через официальный сайт/приложение; коды и данные карты не вводите.",
      uz: "Havoladan foydalanmang va shu chatning o'zida mazmunan javob bermang. Tanishga saqlangan raqam orqali qo'ng'iroq qiling. Aksiya yoki so'rovni rasmiy sayt/ilova orqali alohida tekshiring; kod va karta ma'lumotini kiritmang.",
      en: "Do not use the link or resolve the request in the same chat. Call the person using a saved number. Verify the promotion or request separately through an official site or app; do not enter codes or card data.",
    }[lang];
  }

  return {
    ru: "Завершите контакт и ничего не подтверждайте. Сохраните сообщение без секретов и проверьте отправителя или организацию по номеру, сайту либо приложению, которые нашли самостоятельно. Если код, деньги или доступ уже переданы — сразу переходите к восстановлению через банк или соответствующий сервис.",
    uz: "Aloqani tugating va hech narsani tasdiqlamang. Sirlarni qo'shmasdan xabarni saqlang va yuboruvchi yoki tashkilotni o'zingiz topgan raqam, sayt yoxud ilova orqali tekshiring. Kod, pul yoki kirish allaqachon berilgan bo'lsa, darhol bank yoki tegishli xizmat orqali tiklashga o'ting.",
    en: "End contact and approve nothing. Save the message without secrets and verify the sender or organization using a number, site, or app you found independently. If a code, money, or access was already shared, move straight to recovery through the bank or relevant service.",
  }[lang];
}

export function buildVictimGuidanceFollowUpText(
  followUp: VictimGuidanceFollowUp,
  lang: Lang,
): string {
  if (followUp.action === "reply_script") {
    return buildContextualReplyScript(followUp.context, lang);
  }

  if (followUp.action === "verify_official") {
    return {
      ru: "Завершите входящий звонок. Откройте приложение банка сами или возьмите номер с обратной стороны карты либо с официального сайта и позвоните туда.\n\nНе используйте номер из SMS, чата или входящего звонка и ничего не подтверждайте кодом.",
      uz: "Kiruvchi qo'ng'iroqni tugating. Bank ilovasini o'zingiz oching yoki karta orqasi/rasmiy saytdagi raqamga o'zingiz qo'ng'iroq qiling.\n\nSMS, chat yoki kiruvchi qo'ng'iroqdagi raqamdan foydalanmang va kod bilan hech narsani tasdiqlamang.",
      en: "End the incoming call. Open the bank app yourself or call the number on the back of the card or the official website.\n\nDo not use a number from the SMS, chat, or incoming call, and do not approve anything with a code.",
    }[lang];
  }

  if (followUp.action === "explain_simple") {
    const prefix = {
      ru: "Простыми словами:",
      uz: "Oddiy qilib:",
      en: "In simple terms:",
    }[lang];
    return `${prefix}\n\n${buildVictimIntentText(followUp.context, lang)}`;
  }

  if (followUp.action === "pressure") {
    return {
      ru: "Срочность и угроза, что деньги «пропадут», — это давление, а не доказательство полномочий звонящего. Не спорьте и не выполняйте просьбу быстрее из-за страха.\n\nКод и данные карты не сообщайте. Завершите разговор и проверьте всё сами через официальный канал.",
      uz: "Shoshirish va pul «yo'qoladi» degan tahdid — bosim, qo'ng'iroq qiluvchining vakolatiga dalil emas. Qo'rquv sabab so'rovni tez bajarmang.\n\nKod va karta ma'lumotini aytmang. Suhbatni tugatib, hammasini rasmiy kanal orqali o'zingiz tekshiring.",
      en: "Urgency and a threat that the money will “disappear” are pressure, not proof that the caller has authority. Do not act faster because of fear.\n\nDo not share codes or card data. End the conversation and verify independently through an official channel.",
    }[lang];
  }

  if (followUp.action === "trusted_person") {
    return {
      ru: "Да, покажите сообщение близкому человеку, которому доверяете. Это хороший безопасный шаг.\n\nНо не пересылайте сам SMS-код, пароль, PIN/CVV, данные карты или фото документов — даже близкому. Покажите только просьбу собеседника и мой совет.",
      uz: "Ha, xabarni ishonadigan yaqin insoningizga ko'rsating. Bu xavfsiz va foydali qadam.\n\nAmmo SMS-kod, parol, PIN/CVV, karta ma'lumoti yoki hujjat rasmini hatto yaqin insonga ham yubormang. Faqat suhbatdoshning so'rovi va mening tavsiyamni ko'rsating.",
      en: "Yes. Show the message to a trusted person; that is a good safe step.\n\nDo not forward the actual SMS code, password, PIN/CVV, card data, or document photos, even to someone close. Show only the request and this guidance.",
    }[lang];
  }

  if (followUp.action === "why" && followUp.context.askedContext === "code") {
    return {
      ru: "Это опасно, потому что SMS-код может подтвердить вход в банк или Telegram, смену доступа либо денежную операцию. Тот, кто получит код, может действовать от вашего имени.\n\nКод не сообщайте. Откройте официальное приложение сами или позвоните по номеру с карты/официального сайта.",
      uz: "Bu xavfli, chunki SMS-kod bank yoki Telegramga kirishni, kirish ma'lumotini o'zgartirishni yoxud pul operatsiyasini tasdiqlashi mumkin. Kodni olgan odam sizning nomingizdan harakat qilishi mumkin.\n\nKodni aytmang. Rasmiy ilovani o'zingiz oching yoki karta/rasmiy saytdagi raqamga qo'ng'iroq qiling.",
      en: "This is dangerous because an SMS code can approve a bank or Telegram login, an access change, or a money operation. Whoever gets the code may be able to act as you.\n\nDo not share it. Open the official app yourself or call the number on the card or official site.",
    }[lang];
  }

  if (followUp.action === "why") {
    return buildContextualWhyText(followUp.context, lang);
  }

  if (followUp.action === "next_steps") {
    return buildContextualNextStepsText(followUp.context, lang);
  }

  return buildVictimIntentText(followUp.context, lang);
}

const NON_CONCRETE_LINE_INTENTS = new Set<VictimIntentKind>([
  "acknowledgement",
  "advice_question",
  "emotional_help",
  "general_scam_concern",
  "privacy_question",
  "telegram_message",
  "trust_or_greeting",
  "unknown_call",
]);

function isConcreteLineIntent(kind: VictimIntentKind): boolean {
  return !NON_CONCRETE_LINE_INTENTS.has(kind);
}

function isContextOnlyVictimLine(normalized: string): boolean {
  if (!normalized) return true;
  if (/^(?:https?:\/\/|www\.)\S+$/iu.test(normalized)) return true;
  if (/^@[a-z][a-z0-9_]{3,31}$/iu.test(normalized)) return true;
  return (
    /^(?:bunga\s+)?ishonish\s+mumkinmi|^(?:can\s+i|should\s+i)\s+trust|^(?:можно\s+ли\s+)?(?:ему|ей|им|этому)\s+доверять/iu.test(
      normalized,
    ) ||
    /(?:что\s+(?:мне\s+)?делать|what\s+(?:should|do)\s+i\s+do|nima\s+qilish(?:im|\s+kerak))/iu.test(
      normalized,
    ) ||
    /(?:не\s+спеш|not\s+in\s+a\s+hurry|shoshmayapman)/iu.test(normalized) ||
    /(?:тороп|pressur|shoshir).{0,100}(?:близк|семь|family|relative|yaqin)/iu.test(normalized)
  );
}

function hasAllScenarioSignals(normalized: string, signals: readonly RegExp[]): boolean {
  return signals.every((signal) => signal.test(normalized));
}

const EXPLICIT_RISK_SOURCE_PREFIX_RE =
  /^(?:(?:the\s+)?(?:caller|scammer|fraudster|attacker|stranger|unknown\s+contact)\b|(?:i|we)\s+(?:received|got|was\s+sent).{0,60}\b(?:from\s+)?(?:the\s+)?(?:caller|scammer|fraudster|attacker|stranger|unknown\s+contact)\b|(?:мошенник|звонивш\p{L}*|незнаком\p{L}*|собеседник)(?!\p{L})|(?:firibgar|qo['’]?ng['’]?iroq\s+qiluvchi|notanish\s+kontakt)\b)/iu;
const EDUCATIONAL_EXAMPLE_PREFIX_RE =
  /^(?:(?:the\s+)?(?:article|documentation|guide|manual)\s+(?:says|states|shows|explains|describes)(?:\s*:|\s+that(?!\p{L})|\s*,?\s*["“‘])|(?:support\s+)?documentation\s+(?:gives|shows|contains)\s+(?:this\s+)?(?:example|hypothetical)\s*:|(?:(?:for\s+)?example|hypothetical\s+example)\s*:|(?:статья|документация|инструкция|руководство)\s+(?:говорит|гласит|показывает|объясняет)\s*:|(?:пример|гипотетический\s+пример)\s*:|(?:maqola|hujjat|qo['’]?llanma)\s+(?:deydi|ko['’]?rsatadi|tushuntiradi)\s*:|(?:misol|faraziy\s+misol)\s*:)/iu;
const STRONG_EDUCATIONAL_EXAMPLE_PREFIX_RE =
  /^(?:(?:support\s+)?documentation\s+(?:gives|shows|contains)\s+(?:this\s+)?(?:example|hypothetical)\s*:|(?:(?:for\s+)?example|hypothetical\s+example)\s*:|(?:пример|гипотетический\s+пример)\s*:|(?:misol|faraziy\s+misol)\s*:)/iu;
const DOCUMENT_ATTRIBUTED_QUOTE_PREFIX_RE =
  /^\s*(?:(?:the\s+)?(?:article|documentation|guide|manual)|(?:статья|документация|инструкция|руководство)|(?:maqola|hujjat|qo['’]?llanma))\s+\p{L}{2,32}\s*(?::|,)\s*(?<opener>["“„«])/iu;
const PROTECTIVE_COVER_STORY_INSTRUCTION_RE =
  /(?:(?:never|do\s+not|don['’]?t|must\s+not|should\s+not)\s+(?:tell|ask|instruct).{0,90}(?:customer|user|person|someone).{0,90}(?:tell|say)|(?:не|никогда\s+не)\s+(?:говорите|просите|инструктируйте).{0,90}(?:клиент|пользовател|человек).{0,90}(?:сказать|говорить)|(?:hech\s+qachon|aslo).{0,45}(?:mijoz|odam).{0,90}(?:deb\s+ayt|aytishni))/iu;

function isNonUserEducationalExample(text: string): boolean {
  const normalized = text.trim();
  return (
    !EXPLICIT_RISK_SOURCE_PREFIX_RE.test(normalized) &&
    EDUCATIONAL_EXAMPLE_PREFIX_RE.test(normalized)
  );
}

function withoutDocumentAttributedQuote(text: string): string {
  const match = DOCUMENT_ATTRIBUTED_QUOTE_PREFIX_RE.exec(text);
  const opener = match?.groups?.opener;
  if (!match || !opener) return text;

  const closer = opener === "«" ? "»" : opener === "„" ? "“" : opener === "“" ? "”" : '"';
  const closeAt = text.indexOf(closer, match[0].length);
  return closeAt === -1 ? text : text.slice(closeAt + closer.length).trimStart();
}

const EXPLICIT_INCIDENT_OWNER_PREFIX_RE = /^(?:i|we|я|мы|men|biz)(?!\p{L})/iu;

function isEducationalContinuation(previous: string, current: string): boolean {
  const normalizedCurrent = current.trim().replace(/^[\s"'“”‘’([\]-]+/u, "");
  return (
    isNonUserEducationalExample(previous) &&
    !EXPLICIT_RISK_SOURCE_PREFIX_RE.test(normalizedCurrent) &&
    (!EXPLICIT_INCIDENT_OWNER_PREFIX_RE.test(normalizedCurrent) ||
      STRONG_EDUCATIONAL_EXAMPLE_PREFIX_RE.test(previous.trim()))
  );
}

function splitScenarioAssertionClauses(text: string): string[] {
  return text
    .split(
      /[.!?;\n]+|(?:,\s*|\s+)(?:(?:but|however|но|однако|lekin|biroq)|(?:and|then|а|и|затем|va|keyin)(?=\s+(?:(?:(?:now|теперь|endi)\s+)?(?:(?:the\s+)?(?:caller|scammer|fraudster|attacker|stranger|unknown\s+contact)|мошенник|звонивш\p{L}*|незнаком\p{L}*|собеседник|firibgar|qo['’]?ng['’]?iroq\s+qiluvchi|notanish\s+kontakt)(?!\p{L})|(?:i|we|я|мы|men|biz)(?!\p{L})|(?:this|that|the|этот|эта|это|тот|та|bu|shu)\s+(?:(?:second|another|второй|другой|ikkinchi|boshqa)\s+)?(?:loan|credit|installment|bnpl|кредит|за[ёе]м|рассрочк\p{L}*|kredit(?:ni)?|qarz(?:ni)?|nasiya)(?!\p{L}))))\s+/iu,
    )
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function isTaskRewardDepositTrap(normalized: string): boolean {
  if (
    /(?:(?:не\s+(?:пополняйте|платите)|(?:do\s+not|don['’]?t|never)\s+(?:top\s*up|pay)|balansni\s+to['’]?ldirmang).{0,120}(?:мошен|обман|опасн|scam|fraud|firib|xavf)|(?:мошен|обман|опасн|scam|fraud|firib|xavf).{0,120}(?:не\s+(?:пополняйте|платите)|(?:do\s+not|don['’]?t|never)\s+(?:top\s*up|pay)|balansni\s+to['’]?ldirmang))/iu.test(
      normalized,
    )
  ) {
    return false;
  }
  return hasAllScenarioSignals(normalized, [
    /(?:лайк|реакци|просмотр|видео|отзыв|комментар|задани|layk|video|sharh|topshiriq|vazifa|like|review|comment|task)/iu,
    /(?:пополни|пополнить|внести|оплатить|депозит|баланс|(?:треб\p{L}*|прос\p{L}*|нуж\p{L}*|надо).{0,35}(?:налог|комисс)|balans(?:ni)?\s+to['’]?ldir|pul\s+o['’]?tkaz|to['’]?la|to['’]?lov|(?:komissiya|soliq).{0,25}(?:kerak|so['’]?ra)|top\s*up|add\s+(?:money|funds)|deposit|pay|balance|verification\s+fee)/iu,
    /(?:вывод|вывести|снять|заработ|(?:зарплат|заработ).{0,30}(?:получ|выплат|вывест|снять)|(?:получ|выплат|обещ\p{L}*|начисл\p{L}*).{0,30}(?:зарплат|заработ)|pulni\s+yech|daromadni\s+ol|ish\s+haq(?:i|ini).{0,30}(?:ol|yech|ber)|withdraw|cash(?:ing)?\s*out|earnings?)/iu,
  ]);
}

function isUnauthorizedCreditOpened(normalized: string): boolean {
  const scenarioText = withoutDocumentAttributedQuote(normalized);
  const selfAuthorized =
    /(?:я\s+сам(?:а)?\s+(?:взял[аи]?|оформил[аи]?|открыл[аи]?).{0,30}(?:кредит|за[ёе]м|рассрочк)|(?:muddatli\s+to['’]?lov|nasiya|kredit|qarz).{0,35}o['’]?zim.{0,25}(?:oldim|ochdim|rasmiylashtirdim)|o['’]?zim.{0,25}(?:muddatli\s+to['’]?lov|nasiya|kredit|qarz).{0,25}(?:oldim|ochdim|rasmiylashtirdim)|i\s+personally\s+(?:opened|took\s+out|registered|applied\s+for).{0,35}(?:klarna|installment|loan|credit|bnpl)|i\s+myself\s+(?:opened|took\s+out|registered|applied\s+for).{0,35}(?:klarna|installment|loan|credit|bnpl)|i\s+(?:opened|took\s+out|registered|applied\s+for).{0,35}(?:klarna|installment|loan|credit|bnpl).{0,20}\bmyself\b)/iu;
  const subject =
    /(?:на\s+(?:ваше|мо[ёе])\s+имя|на\s+меня|без\s+(?:моего|вашего)\s+(?:ведома|согласия)|sizga|sizning\s+nomingizga|mening\s+nomimga|nomimga|ustimga|in\s+(?:your|my)\s+name|without\s+(?:your|my)\s+(?:knowledge|consent)|using\s+my\s+identity|my\s+identity)/iu;
  const product =
    /(?:кредит|за[ёе]м|микрозайм|рассрочк|kredit|qarz|mikroqarz|nasiya|muddatli\s+to['’]?lov|bo['’]?lib\s+to['’]?lash|loan|credit|buy[\s-]?now[\s-]?pay[\s-]?later|\bbnpl\b|installment|klarna)/iu;
  const opened =
    /(?:оформ(?:или|лен[ао]?|лено)|открыли|взяли|повесили|навесили|rasmiylashtir(?:ildi|ilgan|ishibdi)|och(?:ildi|ilibdi|ishibdi)|olishibdi|was\s+(?:opened|taken\s+out|registered)|has\s+been\s+(?:opened|registered)|opened|registered|appeared)/iu;
  const explicitDenial =
    /(?:котор(?:ый|ого|ую)\s+(?:я\s+)?не\s+(?:брал[аи]?|оформлял[аи]?|открывал[аи]?|заказывал[аи]?)|(?:^|[^\p{L}])я\s+(?:его|это|такого)?\s*не\s+(?:брал[аи]?|оформлял[аи]?|открывал[аи]?|заказывал[аи]?)|(?:^|[^\p{L}])men\s+(?:uni\s+)?(?:ochmaganman|olmaganman|rasmiylashtirmaganman)|(?:^|[^\p{L}])i\s+(?:did\s+not|didn['’]?t|never)\s+(?:open|take\s+out|register|apply\s+for)|not\s+(?:opened|taken\s+out|registered)\s+by\s+me)/iu;
  const selfAuthorizedIdentityUse =
    /(?:^|[^\p{L}])i\s+(?:opened|took\s+out|registered|applied\s+for).{0,50}using\s+my\s+identity/iu;
  const clauses = splitScenarioAssertionClauses(scenarioText);

  return clauses.some((clause, index) => {
    if (
      isNonUserEducationalExample(clause) ||
      selfAuthorized.test(clause) ||
      selfAuthorizedIdentityUse.test(clause)
    ) {
      return false;
    }
    const previous = clauses[index - 1] ?? "";
    const previousIsSelfAuthorized =
      selfAuthorized.test(previous) || selfAuthorizedIdentityUse.test(previous);
    const adjacent = previous && !previousIsSelfAuthorized ? `${previous} ${clause}` : clause;
    if (isEducationalContinuation(previous, clause)) return false;
    return (
      product.test(adjacent) &&
      ((subject.test(adjacent) && opened.test(adjacent)) || explicitDenial.test(adjacent))
    );
  });
}

function isCoerciveOfficialSecrecy(normalized: string): boolean {
  const scenarioText = withoutDocumentAttributedQuote(normalized);
  const safetyWarning =
    /(?:(?:полици|мвд|госорган).{0,50}(?:никогда\s+не|не\s+(?:просит|требует|должн)).{0,70}(?:никому\s+не\s+говор|держать.{0,20}в\s+тайне)|(?:iib|iiv|politsiya).{0,50}(?:hech\s+qachon|talab\s+qilmaydi).{0,70}(?:hech\s+kimga\s+ayt|sir\s+saqla)|(?:police|law[\s-]?enforcement).{0,50}(?:never|do(?:es)?\s+not).{0,30}(?:ask|demand|require).{0,70}(?:tell\s+no\s+one|not\s+tell\s+anyone|keep.{0,20}secret))/iu;
  const secrecyInstruction =
    /(?:никому\s+не\s+(?:говор|расскаж|сообщ)|держите\s+(?:это|операци|расследовани|дело).{0,20}в\s+тайне|hech\s+kimga\s+(?:aytmang|gapirmang)|sir\s+saqla|(?:not\s+to|do\s+not|don['’]?t)\s+tell\s+anyone|keep\s+(?:this|the\s+(?:operation|investigation|case|transaction)).{0,20}secret)/iu;
  const officialContext =
    /(?:операци[яию]|спецопераци|расследовани|следстви|уголовн.{0,20}дел|мвд|полици|прокуратур|iib|ichki\s+ishlar|politsiya|prokuratura|maxsus\s+operatsiya|tergov|jinoyat\s+ishi|police\s+operation|law[\s-]?enforcement\s+operation|investigation|criminal\s+case)/iu;
  const clauses = splitScenarioAssertionClauses(scenarioText);
  return clauses.some((clause, index) => {
    if (safetyWarning.test(clause) || isNonUserEducationalExample(clause)) return false;
    const previous = clauses[index - 1] ?? "";
    const next = clauses[index + 1] ?? "";
    if (isEducationalContinuation(previous, clause)) return false;
    return (
      secrecyInstruction.test(clause) &&
      (officialContext.test(clause) ||
        officialContext.test(previous) ||
        (EXPLICIT_RISK_SOURCE_PREFIX_RE.test(clause) && officialContext.test(next)))
    );
  });
}

function isCoerciveTransactionSecrecy(normalized: string): boolean {
  const scenarioText = withoutDocumentAttributedQuote(normalized);
  // Keep explicit safety advice out of the victim route. In particular,
  // “never hide a transfer from the bank” describes the safe rule rather than
  // a scammer's instruction.
  const safetyWarning =
    /(?:(?:не\s+(?:скрывайте|утаивайте)|никогда\s+не\s+(?:скрывайте|утаивайте)|(?:do\s+not|don['’]?t|never|should\s+not)\s+(?:hide|conceal)|(?:yashirmang|sir\s+saqlamang)).{0,80}(?:перевод|операци|плат[её]ж|банк|transfer|transaction|payment|bank|o['’]?tkaz|to['’]?lov|bank)|(?:o['’]?tkazma|to['’]?lov).{0,60}(?:yashirmang|sir\s+saqlamang))/iu;

  const secrecyInstruction =
    /(?:не\s+(?:говорить|говорите|сообщать|сообщайте|рассказывать|рассказывайте)\s+(?:банку|семье|близким)|скры(?:ть|вать|вайте)\s+(?:этот\s+)?(?:перевод|операци[юя]|плат[её]ж).{0,50}(?:от\s+(?:банка|семьи|близких))?|(?:перевод|операци[юя]|плат[её]ж).{0,60}(?:держ(?:ать|ите)\s+в\s+тайне|скры(?:ть|вать)|никому\s+не\s+(?:говорить|сообщать))|(?:not\s+to|do\s+not|don['’]?t)\s+(?:tell|inform)\s+(?:the\s+)?(?:bank|family).{0,80}(?:transfer|transaction|payment|money)|(?:hide|conceal)\s+(?:this\s+|the\s+)?(?:transfer|transaction|payment).{0,50}(?:from\s+(?:the\s+)?(?:bank|family))|keep\s+(?:this\s+|the\s+)?(?:transfer|transaction|payment).{0,30}secret|(?:bankka|oilaga|yaqinlarga)\s+(?:bu\s+)?(?:o['’]?tkazma|to['’]?lov|pul).{0,45}(?:haqida\s+)?(?:aytma|gapirma)|(?:o['’]?tkazma|to['’]?lov).{0,55}(?:bankdan|oiladan|yaqinlardan)\s+(?:yashir|sir\s+saqla))/iu;
  const transactionContext =
    /(?:перевод|операци[яию]|плат[её]ж|деньг|банк|transfer|transaction|payment|money|bank|o['’]?tkaz|to['’]?lov|pul)/iu;

  const deceptiveTruthInstruction =
    /(?:правд\p{L}*\s+не\s+(?:говор|расскаж|сообщ)|не\s+(?:говор|расскаж|сообщ).{0,20}правд|rost(?:ini)?\s+(?:aytma|gapirma)|haqiqat\p{L}*\s+(?:aytma|gapirma)|(?:do\s+not|don['’]?t)\s+(?:tell|say).{0,25}(?:the\s+)?truth|hide\s+the\s+truth)/iu;
  const explicitTruthAdvice =
    /(?:(?:честно|правду).{0,25}(?:скаж|говор)|(?:скаж|говор).{0,25}(?:честно|правду)|rostini\s+ayt(?:ing)?|haqiqat\p{L}*\s+ayt(?:ing)?|(?:tell|say).{0,25}(?:the\s+truth|honestly|truthfully)|(?:honestly|truthfully).{0,25}(?:tell|say))/iu;

  const clauses = splitScenarioAssertionClauses(scenarioText);
  const clauseLocalCoverStory = clauses.some((clause, index) => {
    if (
      isNonUserEducationalExample(clause) ||
      PROTECTIVE_COVER_STORY_INSTRUCTION_RE.test(clause) ||
      safetyWarning.test(clause) ||
      (explicitTruthAdvice.test(clause) && !deceptiveTruthInstruction.test(clause))
    ) {
      return false;
    }
    const previous = clauses[index - 1] ?? "";
    const candidate = previous ? `${previous} ${clause}` : clause;
    if (isEducationalContinuation(previous, clause)) return false;
    return hasAllScenarioSignals(candidate, [
      /(?:банк|bank)/iu,
      /(?:перевод|плат[её]ж|деньг|transfer|payment|money|o['’]?tkaz|to['’]?lov|pul)/iu,
      /(?:семь|родствен|family|relative|oila|qarindosh)/iu,
      /(?:скаж(?:и|ите)|говор(?:и|ите)|(?:сказали|велел[аи]?|приказали|требуют|просят).{0,35}(?:сказать|говорить)|(?:deb\s+ayt(?:ing)?|ayt(?:ing)?.{0,20}\s+deb)|(?:tell|say)\s+(?:the\s+)?bank|(?:told|asked|instructed)\s+(?:me\s+)?to\s+(?:tell|say))/iu,
    ]);
  });

  const clauseLocalTransactionSecrecy = clauses.some((clause, index) => {
    if (safetyWarning.test(clause) || isNonUserEducationalExample(clause)) return false;
    const previous = clauses[index - 1] ?? "";
    const adjacent = previous ? `${previous} ${clause}` : clause;
    if (isEducationalContinuation(previous, clause)) return false;
    return secrecyInstruction.test(clause) && transactionContext.test(adjacent);
  });

  return clauseLocalTransactionSecrecy || clauseLocalCoverStory;
}

function classifyPoliceImpersonationScenario(normalized: string): VictimIntentMatch | null {
  if (
    hasAllScenarioSignals(normalized, [
      /(?:полици|police|polits|poits|iib|iiv)/iu,
      /(?:уголовн|завед\p{L}*\s+дел|возбуд\p{L}*\s+дел|criminal\s+case|open\p{L}*\s+(?:a\s+)?case|jinoiy\s+ish)/iu,
      /(?:деньг|money|pul|перев|transfer|o['’]?tkaz|без[оа]пасн\p{L}*\s+сч[её]т|safe\s+account|xavfsiz\s+hisob|треб|demand|talab)/iu,
    ])
  ) {
    return {
      kind: "legal_impersonation",
      askedContext: "transfer",
      scenario: "police_impersonation",
    };
  }
  return null;
}

function isRentalViewingDepositRequest(normalized: string): boolean {
  if (
    /(?:без|не\s+(?:нужно|надо|просят|требуют)?\s*)(?:депозит|залог|задат)|(?:депозит|залог|задат).{0,70}(?:после\s+(?:просмотр|подписан|провер)|по\s+(?:подписанному\s+)?договору)|(?:do\s+not|don['’]?t|no)\s+(?:pay|send|transfer).{0,50}(?:deposit|holding\s+fee)|(?:deposit|holding\s+fee).{0,70}(?:after\s+(?:viewing|inspection|signing)|under\s+(?:the\s+)?signed\s+contract)|(?:depozit|garov).{0,70}(?:ko['’]?rgandan|tekshirgandan|shartnoma\s+imzolangandan)\s+keyin/iu.test(
      normalized,
    )
  ) {
    return false;
  }

  return hasAllScenarioSignals(normalized, [
    /(?<![\p{L}\p{N}_])(?:olx|avito)(?![\p{L}\p{N}_])|маркетплейс|площадк|объявлен|арендодател|владелец|риелтор|агент\p{L}*.{0,20}аренд|rental\s+platform|marketplace|listing|landlord|property\s+owner|rental\s+agent|ijara\s+platform|e['’]?lon|uy\s+egasi|ijara\s+agent/iu,
    /(?:квартир|жиль|аренд|съ[её]м|просмотр|uy|kvartira|ijara|ko['’]?rish|apartment|flat|rental|rent|viewing)/iu,
    /(?:депозит|залог|задат|depozit|garov|deposit|holding\s+fee|reservation\s+fee)/iu,
    /(?:прос\p{L}*|треб\p{L}*|сказал\p{L}*|вел\p{L}*).{0,70}(?:внест|перевест|отправ|оплат)|(?:внест|перевест|отправ|оплат).{0,70}(?:депозит|залог|задат|карт)|(?:so['’]?ra|ayt|talab).{0,70}(?:yubor|o['’]?tkaz|to['’]?la)|(?:yubor|o['’]?tkaz|to['’]?la).{0,70}(?:depozit|garov|karta)|(?:ask|told|require|demand).{0,70}(?:pay|send|transfer)|(?:pay|send|transfer).{0,70}(?:deposit|fee|card)/iu,
  ]);
}

function isGameAccountEscrowFeeRequest(normalized: string): boolean {
  if (
    /(?:yubormang|jo['’]?natmang|o['’]?tkazmang|to['’]?lamang|не\s+(?:отправляйте|переводите|платите)|do\s+not\s+(?:send|transfer|pay)|don['’]?t\s+(?:send|transfer|pay))|(?:platform|платформ|platforma).{0,60}(?:удерж|вычита|deduct|ushlab\s+qol).{0,50}(?:после|after|keyin).{0,35}(?:сделк|sale|savdo)/iu.test(
      normalized,
    )
  ) {
    return false;
  }

  return hasAllScenarioSignals(normalized, [
    /(?<!\p{L})(?:o['’]?yin\p{L}*|game\p{L}*|игр\p{L}*|roblox|steam)(?!\p{L})/iu,
    /(?:akkaunt|account|аккаунт|skin|item|скин|предмет)/iu,
    /(?:sotib\s+ol|sot\p{L}*|xarid|buy|sell|sale|прода|купить|покупа)/iu,
    /(?:vositachi|escrow|garant|kafil|посредник|гарант)/iu,
    /(?:(?:oldindan|avval|upfront|advance|заранее|предоплат).{0,60}(?:komiss|commission|fee|комисс|сбор|to['’]?lov|плат)|(?:komiss|commission|fee|комисс|сбор).{0,60}(?:yubor|jo['’]?nat|o['’]?tkaz|to['’]?la|send|transfer|pay|отправ|перев|оплат))/iu,
    /(?:so['’]?ra|deyap|ayt|talab|прос|треб|сказ|вел|ask|tell|told|say|want|require|instruct)/iu,
  ]);
}

function isSuspiciousBossVideoTransferRequest(normalized: string): boolean {
  if (
    /(?:never|do\s+not|don['’]?t|не\s+нужно|не\s+следует|нельзя|hech\s+qachon|yubormang|o['’]?tkazmang).{0,80}(?:transfer|wire|payment|send\s+(?:money|funds)|перев|плат|o['’]?tkaz|pul)/iu.test(
      normalized,
    )
  ) {
    return false;
  }

  return hasAllScenarioSignals(normalized, [
    /(?<!\p{L})(?:boss|manager|director|ceo|cfo|executive|supervisor)(?!\p{L})|руководител|директор|начальник|rahbar|direktor/iu,
    /(?:video\s+call|zoom|teams|google\s+meet|видео(?:звон|созвон|вызов)|видеосвяз|video\s+qo['’]?ng['’]?iroq)/iu,
    /(?:(?:look|sound|appear|seem)(?:ed|s)?).{0,30}(?:strange|odd|different|unusual|off|fake)|deepfake|(?:выглядел|звучал|голос|лицо).{0,30}(?:стран|необыч|друг|поддельн)|(?:ko['’]?rin|ovoz).{0,30}(?:g['’]?alati|boshqacha|soxta)/iu,
    /(?:order|instruct|ask|tell|told|demand|request)(?:ed|s|ing)?.{0,110}(?:urgent\s+)?(?:transfer|wire|payment|send\s+(?:money|funds))|(?:приказ|попрос|сказал|треб).{0,110}(?:сроч\p{L}*\s+)?(?:перев|плат)|(?:buyur|so['’]?ra|ayt|talab).{0,110}(?:zudlik\p{L}*\s+)?(?:o['’]?tkaz|pul\s+yubor|to['’]?lov)/iu,
  ]);
}

function isRecoveryFeeRequest(normalized: string): boolean {
  if (
    /(?:не\s+(?:платите|платить|просит|просят|требует|требуют).{0,60}(?:предоплат|комисс|сбор|заранее)|без\s+(?:предоплат|комисс)|(?:to['’]?lamang|to['’]?lamaslik|so['’]?ramaydi|talab\s+qilmaydi).{0,60}(?:oldindan|haq|komiss)|(?:oldindan\s+haq|komiss).{0,30}(?:yo['’]?q|so['’]?ramaydi)|(?:do\s+not|don['’]?t|never)(?:\s+to)?\s+pay.{0,60}(?:upfront|advance|fee|commission)|(?:no|without)\s+(?:an?\s+)?(?:upfront|advance)\s+(?:fee|payment)|does\s+not\s+(?:ask|require).{0,40}(?:fee|payment|commission))/iu.test(
      normalized,
    )
  ) {
    return false;
  }

  return hasAllScenarioSignals(normalized, [
    /(?:уже|раньше|до\s+этого).{0,100}(?:потерял\p{L}*|лишил\p{L}*|перев[её]л\p{L}*).{0,100}(?:деньг|мошен|скам)|(?:oldin|avval).{0,100}(?:firib|aldan).{0,100}(?:pul\s+yo['’]?qot|pul\s+o['’]?tkaz)|(?:already|previously|before).{0,100}(?:lost|sent|paid).{0,100}(?:money|funds).{0,80}(?:scam|fraud)|(?:lost|sent|paid).{0,100}(?:money|funds).{0,80}(?:to\s+a\s+scam|to\s+a\s+fraud)/iu,
    /(?:юрист|адвокат|агент\p{L}*.{0,30}(?:возврат|взыскан)|служб\p{L}*.{0,30}возврат).{0,120}(?:вернут|возврат|взыск|найт\p{L}*.{0,20}деньг)|(?:yurist|advokat|qaytarish\s+agent|recovery\s+agent).{0,120}(?:qaytar|recover|get\s+(?:the\s+)?money\s+back|retrieve)|(?:lawyer|attorney|recovery\s+(?:agent|service|expert)).{0,120}(?:recover|get\s+(?:it|the\s+money|funds)\s+back|return\s+(?:the\s+)?money)/iu,
    /(?:(?:предоплат|комисс|сбор|аванс|оплат\p{L}*\s+заранее).{0,70}(?:прос|треб|нуж|заранее)|(?:прос|треб|нуж).{0,70}(?:предоплат|комисс|сбор|аванс)|(?:oldindan|avval).{0,40}(?:haq|komiss|to['’]?lov)|(?:haq|komiss|to['’]?lov).{0,50}(?:oldindan|avval)|(?:upfront|advance).{0,30}(?:fee|payment|commission)|(?:fee|commission|payment).{0,40}(?:upfront|in\s+advance))/iu,
    /(?:прос|треб|плат|оплат|so['’]?ra|talab|to['’]?la|ask|require|demand|pay)/iu,
  ]);
}

const AUTHORITY_PHYSICAL_DANGEROUS_ACTION_RE =
  /(?:подж(?:ечь|игать|игай|игайте)|подож(?:гу|гут|жет|жёт|жешь|жите|ги|гите)|сжечь|сломать|разбить|повредить|перерезать|перерезать\s+кабел|подложить|подбросить|yoq(?:ish|ib|masa|ing|moq)|o['’]?t\s+qo['’]?y|buz|sindir|uz(?:ish|ib\s+tashla)|zarar\s+yetkaz|set\s+fire|burn|damage|break|destroy|cut.{0,35}(?:wire|cable))/iu;
const AUTHORITY_PHYSICAL_RISKY_PACKAGE_RE =
  /(?:(?:остав|подлож|подброс|отнес|отнест|перенес|перенест|спрят|полож).{0,35}(?:пакет|сумк|рюкзак|коробк|посылк|предмет).{0,90}(?:заправк|школ|склад|вокзал|станци|метро|обществен|людн|здан|объект)|(?:пакет|сумк|рюкзак|коробк|посылк|предмет).{0,90}(?:заправк|школ|склад|вокзал|станци|метро|обществен|людн|здан|объект).{0,90}(?:остав|подлож|подброс|отнес|отнест|перенес|перенест|спрят|полож)|(?:paket|sumka|buyum|quti)(?:ni)?\s+(?:olib\s+bor|qoldir|yashir).{0,90}(?:zapravka|maktab|ombor|vokzal|bekat|metro|jamoat|gavjum|bino|obyekt)|(?:paket|sumka|buyum|quti)(?:ni)?.{0,90}(?:zapravka|maktab|ombor|vokzal|bekat|metro|jamoat|gavjum|bino|obyekt).{0,90}(?:olib\s+bor|qoldir|yashir)|(?:leave|carry|take|hide|place).{0,35}(?:package|bag|backpack|box|object).{0,90}(?:gas\s+station|school|warehouse|railway\s+station|station|subway|public|crowded|building|site)|(?:package|bag|backpack|box|object).{0,90}(?:gas\s+station|school|warehouse|railway\s+station|station|subway|public|crowded|building|site).{0,90}(?:leave|carry|take|hide|place))/iu;
const PROTECTIVE_DANGEROUS_IMPERATIVE_RE =
  /(?:не\s+(?:поджигай(?:те)?|поджигайте|ломай(?:те)?|разбивай(?:те)?|трогай(?:те)?|подкладывай(?:те)?|переноси(?:те)?)|do\s+not\s+(?:burn|damage|break|touch|carry|leave)|don['’]?t\s+(?:burn|damage|break|touch|carry|leave)|(?:yoqmang|buzmang|sindirmang|tegmang|olib\s+bormang|qoldirmang))/giu;

function isAuthorityPhysicalCoercion(normalized: string): boolean {
  // Remove only protective imperative clauses ("не поджигайте"). Conditional
  // threats such as "если сын не подожжет" / "yoqmasa" still describe the
  // coerced dangerous act and must remain. A later live command in another
  // clause therefore cannot be hidden by a neighbouring safety sentence.
  const actionCandidate = normalized.replace(PROTECTIVE_DANGEROUS_IMPERATIVE_RE, " ");
  if (
    !AUTHORITY_PHYSICAL_DANGEROUS_ACTION_RE.test(actionCandidate) &&
    !AUTHORITY_PHYSICAL_RISKY_PACKAGE_RE.test(actionCandidate)
  ) {
    return false;
  }

  const newsContext =
    /(?:новост|статья|памятк|news|article|warning|maqola|ogohlantir|xabar(?:da|larda)?\s+(?:aytil|yozil))/iu.test(
      normalized,
    );
  const addressedPerson =
    /(?:мне|меня|нам|сыну|дочер|дочке|девочк|мальчик|парню|реб[её]нк|подростк|(?<!\p{L})(?:я|мы)(?!\p{L})|menga|meni|bizga|bolam|bolaga|o['’]?g['’]?limga|qizimga|o['’]?smirga|me|my\s+(?:child|son|daughter)|us|(?<!\p{L})i(?!\p{L}))/iu.test(
      normalized,
    );
  if (newsContext && !addressedPerson) return false;

  const hasAuthority =
    /(?:налогов|полици|мвд|фсб|прокуратур|следо(?:в)?ател|оперативник|госбезопас|sol(?:iq|i|q)chi|so(?:l)?iq|politsiya|iib|iiv|prokuror(?:man|lik)?|prokuratura|profilaktika\s+inspektor|tergov|xavfsizlik\s+xizmat|tax|police|law[\s-]?enforcement|prosecutor|detective|federal\s+agent|[iі]nvesti?gator|security\s+service)/iu.test(
      normalized,
    );
  const hasDirective =
    /(?:приказ|велел|застав|принужд|треб|говор|пиш|напис|звон|угрож|buyur|majburl|talab|ayt|yoz|qo['’]?ng['’]?iroq|qo['’]?rqit|(?:yoq|buz|sindir|uz)\p{L}*masang|order(?:ed|ing|s)?|told|forced|demand|threaten|message|call|say)/iu.test(
      normalized,
    );
  const hasStrongCoercion = /(?:застав|принужд|majburl|talab\s+qil|forced)/iu.test(normalized);
  const hasThreatOrSecrecy =
    /(?:иначе|если\s+(?:(?:я|мы|ты|вы|он|она|сын|дочь|реб[её]нок)\s+)?не|угрож\p{L}*.{0,35}(?:дел|арест|посад)|посад|уголовн\p{L}*\s+дел|арест|никому\s+не\s+(?:говор|скаж)|hech\s+kimga\s+aytma|aks\s+holda|bajarmasang|yoqmasa|jinoiy\s+ish|ish\s+och|qama|if\s+(?:i|you|he|she|my\s+(?:son|daughter|child))\s+(?:do\s+not|does\s+not|don['’]?t|doesn['’]?t)|unless.{0,70}arrest|otherwise|criminal\s+case|arrest|go\s+to\s+jail|face\s+jail|tell\s+no\s+one|keep\s+it\s+secret)/iu.test(
      normalized,
    );
  return hasAuthority && hasDirective && (hasStrongCoercion || hasThreatOrSecrecy);
}

export function isExplicitNativeNeighborVideoSafe(normalized: string): boolean {
  const knownContact =
    /(?:со(?:с)?ед|соседк|жи(?:л)?ец|знаком|друг|подруг|qo['’]?s(?:h)?n?im?|tanish|do['’]?st|ne(?:i)?ghbor|neighbour|res(?:i)?d?ent|friend|someone\s+i\s+know)/iu.test(
      normalized,
    );
  const nativeVideo =
    /(?:обычн\p{L}*\s+(?:mp4|видео|видеокруж)|видеокруж|прямо\s+в\s+telegram|из\s+галереи|отправил\p{L}*\s+как\s+видео|normal\s+(?:mp4|native\s+telegram\s+video|video)|native\s+telegram\s+video|video\s+message|telegram\s+ichida\s+oddiy\s+video|oddiy\s+(?:mp4|video)|galereyadan)/iu.test(
      normalized,
    );
  const explicitlyNoExternalArtifact =
    /(?:ссыл\p{L}*|архив\p{L}*|приложен\p{L}*|файл\p{L}*).{0,45}(?:нет|не\s+было)|(?:без|никак(?:ой|ого))\s+(?:ссыл|архив|приложен|файл)|hech\s+qanday\s+(?:havola|arxiv|fayl|ilova).{0,45}(?:yo['’]?q|kerak\s+emas)|(?:havola|arxiv|fayl|ilova).{0,45}yo['’]?q|no\s+(?:link|archive|file|extra\s+(?:app|application))|with\s+no\s+(?:link|archive|file|extra\s+(?:app|application))/iu.test(
      normalized,
    );
  const suspiciousAction =
    /(?:откры|скач|установ|нажм|apk|проигрывател|кодек|och|yukla|o['’]?rnat|bos|open|download|install|click|viewer|codec)/iu.test(
      normalized,
    );
  return knownContact && nativeVideo && explicitlyNoExternalArtifact && !suspiciousAction;
}

/**
 * A police/authority safety notice can contain the same actor, dangerous-act,
 * and "call" words as a live coercion report. Keep only an explicitly
 * protective notice here; a first-person order, threat, or live contact still
 * falls through to the incident routes below.
 */
export function isExplicitAuthoritySafetyNotice(normalized: string): boolean {
  const safetySource =
    /(?:(?:полици|мвд|налогов|ведомств|authority|police|law\s+enforcement|tax\s+authority|politsiya|iib|soliq).{0,90}(?:памятк|предупрежд|инструкц|safety\s+(?:notice|warning|advice)|warning|awareness|ogohlantir|eslatma)|(?:памятк|предупрежд|инструкц|safety\s+(?:notice|warning|advice)|warning|awareness|ogohlantir|eslatma).{0,90}(?:полици|мвд|налогов|ведомств|authority|police|law\s+enforcement|tax\s+authority|politsiya|iib|soliq))/iu;
  const protectiveInstruction =
    /(?:(?:никогда\s+не|не|нельзя)\s+(?:перенос|оставля|поджиг|сжиг|лома|поврежда|трога)|(?:never|do\s+not|don['’]?t)\s+(?:carry|leave|place|burn|damage|break|touch)|(?:hech\s+qachon|aslo).{0,30}(?:olib\s+bor|qoldir|yoq|buz)|(?:olib\s+bormang|qoldirmang|yoqmang|buzmang))/iu;
  const liveIncident =
    /(?:(?:мне|нам|меня|сыну|дочер|реб[её]нк).{0,100}(?:приказ|велел|застав|требу|угрожа|звон|пиш)|(?<!\p{L})(?:me|us)(?!\p{L}).{0,100}(?:order|told|force|demand|threaten|call|messag)|my\s+(?:child|son|daughter).{0,100}(?:order|told|force|demand|threaten|call|messag)|(?:menga|bizga|bolam|o['’]?g['’]?limga|qizimga).{0,100}(?:buyur|majburl|talab|tahdid|qo['’]?ng['’]?iroq|yoz))/iu;
  return (
    safetySource.test(normalized) &&
    protectiveInstruction.test(normalized) &&
    !liveIncident.test(normalized)
  );
}

function isNeighborVideoMalwareBait(normalized: string): boolean {
  if (isExplicitNativeNeighborVideoSafe(normalized)) return false;
  if (
    /(?:никак(?:ой|ого)\s+(?:файл|apk|приложен).{0,45}(?:не\s+нуж|не\s+надо|не\s+треб)|hech\s+qanday\s+(?:fayl|apk|ilova).{0,55}(?:kerak\s+emas|shart\s+emas|talab\s+qilinmaydi)|no\s+(?:file|apk|app).{0,45}(?:is\s+needed|required|to\s+install)|(?:устанавливать|скачивать|o['’]?rnatish|yuklash|installing|downloading).{0,25}(?:не\s+нуж|не\s+надо|kerak\s+emas|shart\s+emas|is\s+not\s+(?:needed|required)))/iu.test(
      normalized,
    )
  ) {
    return false;
  }

  const knownContact =
    /(?:со(?:с)?ед|соседк|жи(?:л)?ец|знаком|друг|подруг|qo['’]?s(?:h)?n?im?|қўшни\p{L}*|tanish|do['’]?st|ne(?:i)?ghbor|neighbour|res(?:i)?d?ent|friend|someone\s+i\s+know)/iu;
  const videoContext =
    /(?:видео|ролик|двор\p{L}*.{0,30}камер|камер\p{L}*.{0,30}(?:двор|подъезд)|запис\p{L}*.{0,30}(?:камер|домофон)|домофон|video|footage|recording|courtyard.{0,20}camera|doorbell|kamera\s+yozuvi|hovli.{0,25}kamer|kirishdagi\s+video|videodagi|это\s+ты|is\s+this\s+you|senmi)/iu;
  const artifact =
    /(?:архив|файл|вложен|apk|ссыл|player|viewer|проигрывател|кодек|arxiv|fayl|ilova|havola|codec|archive|file|attachment|link|[\p{L}0-9_-]+\.(?:zip|rar|7z)|(?:отдельн|alohida|separate).{0,30}(?:видео|запис|video|recording))/iu;
  const action =
    /(?:откры|скач|установ|нажм|глян|посмотр|распак|просит|надо|нужно|och|yukla|o['’]?rnat|bos|ko['’]?r|so['’]?ra|оч|юклаб|ўрнат|бос|кўр|сўра|kerak|open|download|install|click|view|watch|extract|unpack|asks?|wants?|says?\s+to)/iu;
  const artifactAction =
    (artifact.test(normalized) && action.test(normalized)) ||
    /(?:архив|файл|вложен|apk|ссыл|arxiv|fayl|ilova|havola|archive|file|attachment|link|[\p{L}0-9_-]+\.(?:zip|rar|7z)).{0,120}(?:откры|скач|установ|нажм|глян|посмотр|распак|och|yukla|o['’]?rnat|bos|ko['’]?r|оч|юклаб|ўрнат|бос|кўр|open|download|install|click|view|watch|extract|unpack)|(?:откры|скач|установ|нажм|глян|посмотр|распак|och|yukla|o['’]?rnat|bos|ko['’]?r|оч|юклаб|ўрнат|бос|кўр|open|download|install|click|view|watch|extract|unpack).{0,120}(?:архив|файл|вложен|apk|ссыл|arxiv|fayl|ilova|havola|archive|file|attachment|link|[\p{L}0-9_-]+\.(?:zip|rar|7z)|player|viewer|codec|проигрывател|просмотрщик|кодек|recording)/iu.test(
      normalized,
    );
  return knownContact.test(normalized) && videoContext.test(normalized) && artifactAction;
}

export function isExplicitSafeOfficialFineAppPayment(normalized: string): boolean {
  const fine = /(?:штраф|ja(?:r)?ima|жарима|traffic\s+(?:fine|ticket)|\bfine\b)/iu;
  const completedPayment =
    /(?:оплачен|оплатил|оплатила|to['’]?ladim|to['’]?langan|тўладим|тўланган|paid)/iu;
  const officialApp =
    /(?:(?:официальн\p{L}*|банковск\p{L}*).{0,35}(?:прилож|магазин)|(?:bankning\s+)?rasmiy\s+ilova|банкнинг\s+расмий\s+илова|official\s+(?:bank|government)\s+app|(?:bank|government)\s+official\s+app|app.{0,20}(?:official\s+store|app\s+store|google\s+play)|(?:из|found\s+in)\s+(?:официальн\p{L}*\s+)?(?:магазин|store))/iu;
  const explicitlyNoExternalArtifact =
    /(?:apk|файл|вложен|сообщени).{0,45}(?:не\s+было|не\s+приходил|не\s+присылал|нет)|(?:без|никак(?:ого|их))\s+(?:apk|файл|вложен)|(?:apk|fayl|xabar).{0,45}(?:kelma(?:di|gan)|yo['’]?q)|hech\s+narsa\s+yuklamadim|(?:apk|файл|хабар).{0,45}(?:келма(?:ди|ган)|йўқ)|ҳеч\s+нарса\s+юкламадим|no\s+(?:apk|chat\s+attachment|message\s+attachment)|(?:apk|chat\s+attachment).{0,35}(?:was\s+not|wasn['’]?t)\s+(?:involved|sent|received)/iu;
  const suspiciousPromotion =
    /(?:кешб[эе]к|cashback|keshbek|скидк|chegirma|discount|стопроцент|100\s*(?:%|процент|foiz)|one\s+hundred\s+percent|полностью\s+верн|to['’]?liq\s+qaytar|тўлиқ\s+қайтар|refund\s+the\s+full)/iu;

  return (
    fine.test(normalized) &&
    completedPayment.test(normalized) &&
    officialApp.test(normalized) &&
    explicitlyNoExternalArtifact.test(normalized) &&
    !suspiciousPromotion.test(normalized)
  );
}

export function isExplicitCompletedPersonalGift(normalized: string): boolean {
  const completedGift =
    /(?:подарок.{0,25}(?:уже\s+)?получил|(?:уже\s+)?получил.{0,25}подарок|sovg['’]?a(?:ni)?.{0,25}oldim|совға(?:ни)?.{0,25}олдим|received\s+(?:the|a|my)\s+gift|(?:already\s+)?received.{0,20}(?:the|a|my)\s+gift)/iu;
  const inPersonHandoff =
    /(?:лично\s+(?:вручил|подарил)|(?:вручил|подарил).{0,20}лично|shaxsan\s+berdi|шахсан\s+берди|handed\s+me.{0,30}(?:in\s+person|phone)|handed\s+me\s+a\s+phone|personally\s+(?:gave|handed))/iu;
  const personalOccasion = /(?:день\s+рождени|tug['’]?ilgan\s+kun|туғилган\s+кун|birthday)/iu;
  const explicitlyNoLink =
    /(?:ссыл\p{L}*.{0,20}не\s+было|havola.{0,20}yo['’]?q|ҳавола.{0,20}йўқ|(?:there\s+was\s+)?no\s+link)/iu;

  return (
    completedGift.test(normalized) &&
    inPersonHandoff.test(normalized) &&
    personalOccasion.test(normalized) &&
    explicitlyNoLink.test(normalized)
  );
}

export function isExplicitSelfFoundOfficialStoreApp(normalized: string): boolean {
  const road24 = /(?:roa(?:d)?\s*24|роад\s*24)/iu;
  const officialStore = /(?:google\s+play|app\s+store)/iu;
  const selfFound =
    /(?:сам\p{L}*.{0,35}(?:наш[её]л|скачал|установил)|o['’]?zim.{0,35}(?:topib|topdim|o['’]?rnatdim)|ўзим.{0,35}(?:топиб|топдим|ўрнатдим)|(?:found|downloaded|installed).{0,40}(?:myself|on\s+my\s+own))/iu;
  const explicitlyNoChatApk =
    /(?:из\s+чата.{0,25}apk.{0,25}не\s+присыл|chatdan.{0,25}apk.{0,25}kelmagan|чатдан.{0,25}apk.{0,25}келмаган|no\s+apk.{0,35}(?:came|arrived|was\s+sent).{0,25}(?:from\s+)?(?:a\s+)?chat)/iu;

  return (
    road24.test(normalized) &&
    officialStore.test(normalized) &&
    selfFound.test(normalized) &&
    explicitlyNoChatApk.test(normalized)
  );
}

function isNeutralEmergencyNumberFact(normalized: string): boolean {
  return /^(?:(?:the\s+)?police(?:\s+emergency)?\s+number\s+is\s+102|полиция\s+рақами\s+102)[.!]?$/iu.test(
    normalized,
  );
}

function isNaturalAccidentalOutgoingTransferIntent(normalized: string): boolean {
  const uzbekVariant = uzbekLatinMatchingVariant(normalized);
  const variants = uzbekVariant === null ? [normalized] : [normalized, uzbekVariant];

  return variants.some((variant) =>
    /(?:(?:i|we)\s+accidentally\s+(?:transferred|sent|paid).{0,80}wrong\s+(?:person|recipient|account|card|number)|(?:i|we).{0,20}(?:topped\s+up|recharged|paid).{0,80}(?:someone\s+else['’]?s|wrong)\s+(?:phone|number|mobile).{0,50}(?:by\s+mistake|accidentally)|по\s+ошибке.{0,45}(?:оплатил\p{L}*|пополнил\p{L}*).{0,50}чуж(?:ой|ого)\s+(?:номер(?:а)?\s+телефон\p{L}*|телефон\p{L}*)|(?:оплатил\p{L}*|пополнил\p{L}*).{0,50}чуж(?:ой|ого)\s+(?:номер(?:а)?\s+телефон\p{L}*|телефон\p{L}*).{0,45}(?:по\s+ошибке|случайно)|adashib.{0,70}o['’]?zimnikining\s+o['’]?rniga.{0,90}boshqa\s+odamning\s+telefon\s+raqamiga.{0,60}to['’]?lov\s+qildim|(?:boshqa|begona)\s+(?:odamning\s+)?telefon\s+raqamiga.{0,45}(?:xato|adashib).{0,30}(?:to['’]?ladim|to['’]?lov\s+qildim))/iu.test(
      variant,
    ),
  );
}

function isFakeFineCashbackApp(normalized: string): boolean {
  if (isExplicitSafeOfficialFineAppPayment(normalized)) return false;

  const fine = /(?:штраф|ja(?:r)?ima|жарима|traffic\s+(?:fine|ticket)|\bfine\b)/iu;
  const artifact =
    /(?:roa(?:d)?\s*24|роад\s*24|\.\s*apk|\bapk\b|приложен\p{L}*|\bilova\b|илова|\bapp\b)/iu;
  const promotion =
    /(?:кешб[эе]к|cashback|keshbek|скидк|chegirma|discount|стопроцент\p{L}*|100\s*(?:%|процент\p{L}*|foiz)|one\s+hundred\s+percent|верн\p{L}*\s+100|полност\p{L}*\s+верн|верн\p{L}*.{0,20}(?:весь|полный)\s+штраф|to['’]?liq\s+qaytar\p{L}*|тўлиқ\s+қайтар\p{L}*|hammasini\s+qaytar\p{L}*|ҳаммасини\s+қайтар\p{L}*|refund\p{L}*\s+(?:the\s+)?full\s+(?:amount|fine)|full\s+(?:amount\s+)?refund)/iu;
  const activeDeliveryOrAction =
    /(?:предлага|прос(?:ят|ит)|прислал|отправил|приш[её]л|получил|шлют|тороп|скачал|скачать|загруз|установ|открыл|открыть|удалить|yubor|kel|ol|taklif|deyish|shoshir|yukla|o['’]?rnat|ochdim|ochish|o['’]?chirish|юбор|кел|таклиф|шошир|юклаб|ўрнат|очдим|ўчириш|sent|received|got|pushing|rush|download|install|opened|open|remove|asked|offered)/iu;

  return (
    fine.test(normalized) &&
    artifact.test(normalized) &&
    promotion.test(normalized) &&
    activeDeliveryOrAction.test(normalized)
  );
}

function withoutExplicitlyNegatedViolence(normalized: string): string {
  return normalized
    .replace(
      /(?<!\p{L})(?:(?:i|we|they)\s+)?(?:will\s+not|would\s+not|won['’]?t|never)\s+(?:(?:hurt|kill|beat)(?:\s+(?:you|me|him|her|them|us))?(?:\s+(?:or|and)\s+)?){1,3}/giu,
      " ",
    )
    .replace(
      /(?<!\p{L})не\s+(?:(?:уб(?:ью|ьем|ьём|ьют)|изоб(?:ью|ьем|ьём|ьют)|удар(?:ю|им|ят))(?:\s+(?:тебя|вас|его|её|ее|их|нас))?(?:\s+(?:или|и)\s+)?){1,3}/giu,
      " ",
    )
    .replace(
      /(?:(?:seni|meni|uni)\s+)?(?:urmay\p{L}*|o['’]?ldirmay\p{L}*|урмай\p{L}*|ўлдирмай\p{L}*)/giu,
      " ",
    )
    .replace(
      /(?<!\p{L})(?:(?:i|we|they)\s+)?(?:will\s+not|would\s+not|won['’]?t|never)\s+(?:shoot(?:\s+(?:you|me|him|her|them|us))?|break\s+(?:your|my|his|her|their|our)\s+neck|make\s+(?:you|me|him|her|them|us)\s+disappear)/giu,
      " ",
    )
    .replace(
      /(?<!\p{L})не\s+(?:застрел\p{L}*(?:\s+(?:тебя|вас|его|её|ее|их|нас))?|слом\p{L}*.{0,15}шею|закоп\p{L}*)/giu,
      " ",
    )
    .replace(
      /(?:(?:seni|meni|uni)\s+)?(?:otib\s+tashlamay\p{L}*|yo['’]?q\s+qilmay\p{L}*|отиб\s+ташламай\p{L}*|йўқ\s+қилмай\p{L}*)/giu,
      " ",
    );
}

function isPenaltyPointsCancellationOffer(normalized: string): boolean {
  const context =
    /(?:(?:штрафн|штран|дорожн|водительск).{0,25}балл|балл.{0,25}(?:штрафн|штран|нарушен|пдд)|ja(?:r)?ima\s+ball|yo['’]?l.{0,20}qoida.{0,25}ball|ballar(?:im)?ni|traffic\s+(?:pen(?:a)?lty|violation)\s+points?|(?:driving\s+)?(?:pen(?:a)?lty|violation)\s+points?)/iu;
  const erasure =
    /(?:обнул|стер|удал|убрат|снять|списать|спиш\p{L}*|аннулир|o['’]?chir|yo['’]?qot|olib\s+tashla|bekor\s+qil|nol(?:ga)?\s+qil|tozal|wipe|erase|delete|remove|clear|reset|cancel|take.{0,25}off)/iu;
  const safety =
    /(?:(?:обнул|стер|удал|убрат|снять|списать|спиш\p{L}*|аннулир).{0,35}(?:невозможно|нельзя)|(?:невозможно|нельзя).{0,35}(?:обнул|стер|удал|убрат|снять|списать|спиш\p{L}*|аннулир)|(?:o['’]?chir|yo['’]?qot|bekor\s+qil|nol(?:ga)?\s+qil|tozal).{0,35}(?:mumkin\s+emas|bo['’]?lmaydi)|(?:cannot|can['’]?t|impossible\s+to).{0,35}(?:wipe|erase|delete|remove|clear|reset|cancel)|(?:не\s+платите|pul\s+bermang|pul\s+o['’]?tkazmang|do\s+not\s+pay|don['’]?t\s+pay).{0,100}(?:посредник|vositachi|intermediar))/iu;
  const officialProcess =
    /(?:официальн\p{L}*\s+(?:провер|обжалован)|бесплатн\p{L}*\s+провер|rasmiy\s+(?:tekshir|shikoyat)|bepul\s+tekshir|official\s+(?:check|appeal)|free\s+check|lawful\s+appeal|government\s+portal|qonuniy\s+shikoyat)/iu;
  const linkedPayment =
    /(?:за\s+(?:деньг|оплат|комисс)|комисс|аванс|депозит|личн\p{L}*\s+(?:сч[её]т|карт)|знаком\p{L}*\s+(?:в\s+гаи|в\s+гибдд|в\s+мвд)|pulga|pul\s+evaziga|buning\s+uchun\s+pul\s+so['’]?ra|shaxsiy\s+karta|haq\s+so['’]?ra|komissiya\s+talab|yhxbda\s+odam|for\s+(?:money|cash|a\s+fee|payment)|cash\s+fee|personal\s+(?:account|card)|inside\s+traffic[\s-]?police\s+contact|(?:wants?|asks?|demands?)\s+(?:a|another)?\s*(?:fee|payment)|paid\s+(?:a\s+)?(?:deposit|fee))/iu;
  const completedLinkedPayment =
    /(?:(?:перев[её]л|оплатил|заплатил|дал).{0,100}(?:аванс|депозит|обещ|посредник|штрафн|штран|дорожн\p{L}*\s+балл|убрат|списать|аннулир)|(?:pul\s+o['’]?tkazdim|to['’]?ladim).{0,100}(?:bekor\s+qil|ballar|va['’]?da|vositachi)|paid.{0,100}(?:deposit|promis|clear|erase|reset|pen(?:a)?lty\s+points?))/iu;
  const paymentRequest =
    /(?:прос(?:ит|ят).{0,35}(?:оплат|перев|доплат)|(?:оплат|перевед|доплат)(?:и|ите)|haq\s+so['’]?ra|komissiya\s+talab|(?:pul|to['’]?lov).{0,35}(?:o['’]?tkaz|to['’]?la)|(?:asks?|wants?|demands?)\s+(?:a|another)?\s*(?:fee|payment)|pay\s+(?:me|us)|transfer.{0,35}(?:money|payment))/iu;

  const clauses = splitScenarioAssertionClauses(normalized);
  return clauses.some((clause, index) => {
    if (!context.test(clause) || !erasure.test(clause)) return false;
    const hasActiveOffer =
      /(?:предлага|обеща|просит|таклиф|ва['’]?да|сўра|taklif|va['’]?da|so['’]?ra|offers?|promises?|asks?|wants?|demands?|fixer|intermediar|посредник|vositachi)/iu.test(
        clause,
      );
    if (safety.test(clause)) return false;
    if (officialProcess.test(clause) && !hasActiveOffer) return false;
    if (linkedPayment.test(clause) || completedLinkedPayment.test(clause)) return true;
    return [clauses[index - 1], clauses[index + 1]].some(
      (candidate) => candidate !== undefined && paymentRequest.test(candidate),
    );
  });
}

function isExplicitSafeOfficialPrizeResults(normalized: string): boolean {
  const officialDestination =
    /(?:официальн\p{L}*.{0,25}(?:сайт|страниц)|(?:сайт|страниц).{0,25}официальн\p{L}*|rasmiy.{0,25}(?:sayt|sahifa)|(?:sayt|sahifa).{0,25}rasmiy|расмий.{0,25}(?:сайт|саҳифа)|official.{0,25}(?:site|website|page)|(?:site|website|page).{0,25}official)/iu;
  const publishedResults =
    /(?:опубликован\p{L}*.{0,35}победител|победител\p{L}*.{0,35}опубликован|итог\p{L}*\s+розыгрыш|rasmiy.{0,35}(?:yutuq\s+)?natija|g['’]?oliblar.{0,35}e['’]?lon\s+qilingan|расмий.{0,35}(?:ютуқ\s+)?натижа|ғолиблар.{0,35}эълон\s+қилинган|published\s+(?:the\s+)?winners|winners?.{0,25}(?:published|announced)|official\s+results?)/iu;
  const independentNavigation =
    /(?:сам\p{L}*.{0,35}(?:открыл|заш[её]л)|из\s+(?:своей\s+)?закладки|сообщени\p{L}*\s+от\s+друз\p{L}*.{0,30}(?:нет|не\s+было)|xatcho['’]?pdan.{0,35}o['’]?zim|o['’]?zim.{0,35}(?:ochdim|kirdim)|хатчўпдан.{0,35}ўзим|ўзим.{0,35}(?:очдим|кирдим)|opened.{0,35}(?:my\s+own\s+)?bookmark|no\s+(?:friend|contact).{0,25}messaged)/iu;
  const liveClaimAction =
    /(?:тороп|нажм|забир|получи|перейд|bos|shoshir|olib\s+(?:ol|qol)|o['’]?t|бос|шошир|олиб\s+(?:ол|қол)|ўт|rush|click|claim|get\s+yours?|wants?\s+me\s+to)/iu;

  return (
    officialDestination.test(normalized) &&
    publishedResults.test(normalized) &&
    (independentNavigation.test(normalized) || !liveClaimAction.test(normalized))
  );
}

function isKnownContactPrizeLink(normalized: string): boolean {
  if (isExplicitSafeOfficialPrizeResults(normalized)) return false;
  if (
    /(?:не\s+(?:переходите|открывайте|нажимайте).{0,80}(?:ссыл|кнопк)|(?:havola|tugma).{0,50}(?:bosmang|ochmang)|do\s+not\s+(?:click|open).{0,60}(?:link|button)|don['’]?t\s+(?:click|open).{0,60}(?:link|button))/iu.test(
      normalized,
    ) &&
    !/(?:мне|меня|мой\s+знаком|menga|tanishim|sent\s+me|my\s+friend).{0,100}(?:прислал|отправил|написал|yubor|yoz|sent|wrote)/iu.test(
      normalized,
    )
  ) {
    return false;
  }
  const knownContact =
    /(?:зн(?:а)?ком|друг|подруг|брат|сестр|родствен|контакт|при(?:я)?т?ел\p{L}*|аккаунт\p{L}*\s+(?:знаком|друг)|ta(?:n)?i(?:s)?him|tanish|do['’]?st|aka(?:m|si)?|opa(?:m|si)?|тан(?:и)?(?:ш)?им|дўст|акам|опам|qarindosh|kontakt|fr(?:i)?end|brother|sister|coll(?:e)?ague|relative|someone\s+i\s+know|known\s+contact)/iu;
  const prize =
    /(?:банк|bank|приз|подар|розыгрыш|выигр|денежн\p{L}*\s+подар|yutuq|yutug|sovg['’]?a|pul\s+mukofot|ютуқ|совға|мукофот|giveaway|prize|gift|reward|cash\s+(?:bonus|gift))/iu;
  const linkOrButton = /(?:ссыл|кнопк|havola|link|tugma|ҳавол|линк|тугма|button)/iu;
  const activeClaimOrOpen =
    /(?:переслал|зов[её]т|тороп|перейд|нажм|забир|получи|открыл|провер|утвержда|bos|aytdi|shoshir|olib\s+qol|ochdim|yubor|(?:sen\s+)?ham\s+ol|yozdi|бос|айтди|шошир|олиб\s+қол|очдим|юбор|ҳам\s+ол|ёзди|forwarded|wants?\s+me|rush|click|claim|opened|open|verify|insists?|sent)/iu;

  return (
    knownContact.test(normalized) &&
    prize.test(normalized) &&
    linkOrButton.test(normalized) &&
    activeClaimOrOpen.test(normalized)
  );
}

function classifyHighConfidenceEverydayScenario(normalized: string): VictimIntentMatch | null {
  if (isAuthorityPhysicalCoercion(normalized)) {
    return {
      kind: "authority_physical_coercion",
      askedContext: "call",
      scenario: "authority_physical_coercion",
    };
  }

  // These concrete emerging-scam combinations must outrank broad file and
  // forwarded-message heuristics. Each predicate still requires independent
  // scenario signals, so a bare ROAD24 brand or ordinary video remains neutral.
  if (isFakeFineCashbackApp(normalized)) {
    return { kind: "apk_request", askedContext: "apk", scenario: "fake_fine_cashback_app" };
  }

  if (isNeighborVideoMalwareBait(normalized)) {
    return { kind: "file_received", askedContext: "apk", scenario: "neighbor_video_malware" };
  }

  if (isPenaltyPointsCancellationOffer(normalized)) {
    return {
      kind: "transfer_request",
      askedContext: "transfer",
      scenario: "penalty_points_cancellation",
    };
  }

  if (isKnownContactPrizeLink(normalized)) {
    return {
      kind: "identity_uncertain",
      askedContext: "link_qr",
      scenario: "known_contact_prize_link",
    };
  }

  if (isUnauthorizedCreditOpened(normalized)) {
    return { kind: "identity_loan", askedContext: "transfer" };
  }

  if (isCoerciveOfficialSecrecy(normalized)) {
    return { kind: "official_impersonation", askedContext: "call" };
  }

  if (isCoerciveTransactionSecrecy(normalized)) {
    return { kind: "coercive_secrecy", askedContext: "transfer" };
  }

  if (isTaskRewardDepositTrap(normalized)) {
    return { kind: "task_scam", askedContext: "transfer" };
  }

  if (isRecoveryFeeRequest(normalized)) {
    return { kind: "transfer_request", askedContext: "transfer", scenario: "recovery_fee" };
  }

  if (isRentalViewingDepositRequest(normalized)) {
    return { kind: "transfer_request", askedContext: "transfer", scenario: "rental_deposit" };
  }

  if (isGameAccountEscrowFeeRequest(normalized)) {
    return { kind: "transfer_request", askedContext: "transfer", scenario: "game_escrow_fee" };
  }

  if (isSuspiciousBossVideoTransferRequest(normalized)) {
    return { kind: "identity_uncertain", askedContext: "transfer", scenario: "fake_boss_request" };
  }

  if (
    !/(?:вывести|вывод|withdraw|chiqar|yechib|qaytar)/iu.test(normalized) &&
    (hasAllScenarioSignals(normalized, [
      /(?:выигр\p{L}*|приз|лотере|подар|yutuq|lotereya|sovg['’]?a|won|winner|prize|lottery|gift)/iu,
      /(?:комисс|сбор|налог|оплат|заплат|komiss|yig['’]?im|soliq|to['’]?la|commission|fee|tax|pay)/iu,
      /(?:сначала|сперва|аванс|до\s+получен|аввал|oldin|oldindan|avval|before|upfront|advance|first)/iu,
    ]) ||
      /(?:выигр\p{L}*|приз|лотере|yutuq|lotereya|won|prize|lottery).{0,120}(?:надо|нужно|керак|kerak|must|need\s+to).{0,60}(?:комисс|сбор|налог|оплат|komiss|to['’]?la|commission|fee|tax|pay)/iu.test(
        normalized,
      ) ||
      hasAllScenarioSignals(normalized, [
        /(?:выигр\p{L}*|приз|лотере|yutuq|lotereya|won|prize|lottery)/iu,
        /(?:комисс|сбор|налог|komiss|yig['’]?im|soliq|commission|fee|tax)/iu,
        /(?:просят|треб|сказал|говор|оплат|заплат|so['’]?ra|deyish|to['’]?la|ask|told|pay)/iu,
      ]))
  ) {
    return { kind: "transfer_request", askedContext: "transfer", scenario: "prize_fee" };
  }

  if (
    hasAllScenarioSignals(normalized, [
      /(?:telegram\s+)?(?:qo['’]?llab[-\s]?quvvatlash|support|suport|поддержк|техподдержк).{0,60}(?:xodim|employee|agent|сотрудник)|(?:xodim|employee|agent|сотрудник).{0,60}(?:qo['’]?llab[-\s]?quvvatlash|support|suport|поддержк|техподдержк)/iu,
      /(?:parol|password|парол)/iu,
      /(?:yubor|jo['’]?nat|send|share|сообщ|отправ|so['’]?ra|ask|прос)/iu,
    ])
  ) {
    return { kind: "support_impersonation", scenario: "fake_support" };
  }

  if (
    hasAllScenarioSignals(normalized, [
      /(?:anydesk|andesk|teamviewer|rustdesk)/iu,
      /(?:установ|install|o['’]?rnat|прилож|app|ilova)/iu,
      /(?:экран|screen|ekran|показ|share|ko['’]?rsat)/iu,
    ])
  ) {
    return { kind: "apk_request", askedContext: "apk", scenario: "remote_access" };
  }

  if (
    !COMPLETED_LINK_OR_QR_ACTION_RE.test(normalized) &&
    hasAllScenarioSignals(normalized, [
      /(?:\bqr\b|куар)/iu,
      /telegram/iu,
      /(?:скан|scan|kirish|kira|sign\s*in|log\s*in|вход)/iu,
    ])
  ) {
    return { kind: "link_request", askedContext: "link_qr", scenario: "qr_login" };
  }

  if (
    hasAllScenarioSignals(normalized, [
      /(?:покупател|buyer|buer|xaridor|xaidor)/iu,
      /(?:курьер|куьер|courier|couier|kuryer|kuyer)/iu,
      /(?:ссыл|link|havola)/iu,
      /(?:карт|card|karta)/iu,
    ])
  ) {
    return {
      kind: "card_request",
      askedContext: "card",
      scenario: "marketplace_delivery",
    };
  }

  if (
    hasAllScenarioSignals(normalized, [
      /(?:фонд|благотвор|пожертв|charity|donation|fundrais|relief|jamg['’]?arma|xayriya|ehson|сбор\p{L}*.{0,50}(?:лечен|помощ|пострадав)|(?:лечен|treatment|davolanish|flood\s+victim).{0,50}(?:сбор|collection|yig['’]?im|donation))/iu,
      /(?:личн\p{L}*\s+карт|personal\s+card|shaxsiy\s+karta)/iu,
      /(?:перев|transfer|send|sent|pay|payment|o['’]?tkaz|pul)/iu,
    ])
  ) {
    return {
      kind: "transfer_request",
      askedContext: "transfer",
      scenario: "charity_pressure",
    };
  }

  if (
    hasAllScenarioSignals(normalized, [
      /(?:romantic|roantic|boyfriend|girlfriend|online\s+(?:partner|boyfriend|girlfriend)|(?<!\p{L})знаком\p{L}*|(?<!\p{L})tanish\p{L}*)/iu,
      /(?:ticket|билет|chipta|visa|виза|viza)/iu,
      /(?:money|ден|pul|pay|плат)/iu,
    ])
  ) {
    return { kind: "romance_money", askedContext: "transfer", scenario: "romance_money" };
  }

  if (
    hasAllScenarioSignals(normalized, [
      /(?:passport|pasport|paport|паспорт|документ|hujjat)/iu,
      /(?:already|alredy|sent|shared|от(?:п)?равил|отправил|yubordim|jo['’]?natdim)/iu,
      /(?:stranger|stanger|незнаком|notanish|noanish|begona)/iu,
    ])
  ) {
    return { kind: "personal_data_already_shared", scenario: "passport_already_shared" };
  }

  if (
    hasAllScenarioSignals(normalized, [
      /(?:soliq|налог|tax)/iu,
      /(?:to['’]?la|оплат|pay)/iu,
      /(?:havola|ссылк|link)/iu,
    ])
  ) {
    return {
      kind: "official_impersonation",
      askedContext: "transfer",
      scenario: "fake_tax_payment",
    };
  }

  if (
    hasAllScenarioSignals(normalized, [
      /(?:bank|банк)/iu,
      /(?:smsdagi\s+raqam|номер\p{L}*\s+из\s+sms|number\s+from\s+an?\s+sms)/iu,
      /(?:qo['’]?ng['’]?iroq|звон|call)/iu,
    ])
  ) {
    return { kind: "bank_contact_question", scenario: "bank_contact_from_message" };
  }

  if (
    /(?:vote|голос|ovoz).{0,120}(?:channel|chanel|chnnel|канал|kanal).{0,120}(?:link|ссыл|havola)|(?:channel|chanel|chnnel|канал|kanal).{0,120}(?:vote|голос|ovoz).{0,120}(?:link|ссыл|havola)/iu.test(
      normalized,
    )
  ) {
    return { kind: "telegram_takeover", askedContext: "link_qr", scenario: "vote_link" };
  }

  if (
    hasAllScenarioSignals(normalized, [
      /(?:kanal|channel|канал)/iu,
      /(?:daromad|daomad|earning|income|заработ\p{L}*|доход)/iu,
      /(?:tez|fast|быстр\p{L}*|daily|guaranteed|kafolat|гарантир|deposit|depozit|депозит)/iu,
    ])
  ) {
    return { kind: "earning_channel", askedContext: "link_qr" };
  }

  if (
    hasAllScenarioSignals(normalized, [
      /(?:kredit|krdit|kreit|loan|credit|кредит)/iu,
      /(?:oldindan|advance|upfront|заранее)/iu,
      /(?:komiss|commission|fee|комисс|sug['’]?urta|insurance|страхов|rasmiylashtirish|processing|оформлен)/iu,
    ])
  ) {
    return {
      kind: "transfer_request",
      askedContext: "transfer",
      scenario: "loan_advance_fee",
    };
  }

  if (
    /(?:courier|parcel|customs|курьер|посыл|тамож|kuryer|posilka|boj).{0,160}(?:fee|pay|payment|оплат|сбор|to['’]?la|to['’]?lov)|(?:fee|pay|payment|оплат|сбор|to['’]?la|to['’]?lov).{0,160}(?:courier|parcel|customs|курьер|посыл|тамож|kuryer|posilka|boj)/iu.test(
      normalized,
    )
  ) {
    return { kind: "transfer_request", askedContext: "transfer", scenario: "parcel_fee" };
  }

  if (
    /(?:fake|false|soxta|фальшив|поддельн).{0,80}(?:support|suport|поддержк|yordam\s+xizmati).{0,120}(?:(?:disable|turn\s+off|отключ|o['’]?chir).{0,80}(?:protection|security|защит|himoya)|(?:protection|security|защит|himoya).{0,80}(?:disable|turn\s+off|отключ|o['’]?chir))/iu.test(
      normalized,
    )
  ) {
    return { kind: "support_impersonation", scenario: "fake_support" };
  }

  if (
    hasAllScenarioSignals(normalized, [
      /(?:bank|банк)/iu,
      /(?:без[оа]пасн\p{L}*\s+сч[её]т|safe\s+account|xavfsiz\s+hisob)/iu,
      /(?:перев|transfer|o['’]?tkaz|деньг|money|pul)/iu,
    ])
  ) {
    return {
      kind: "transfer_request",
      askedContext: "transfer",
      scenario: "safe_account_transfer",
    };
  }

  if (
    /(?:telegram).{0,80}(?:channel|канал|kanal).{0,120}(?:suspicious|сомнитель|шубҳали|shubhali|invite|invites|вступ|зов|qo['’]?shil|chaqir)|(?:suspicious|сомнитель|шубҳали|shubhali).{0,100}(?:telegram).{0,80}(?:channel|канал|kanal)/iu.test(
      normalized,
    )
  ) {
    return { kind: "unknown_contact", scenario: "telegram_channel_invite" };
  }

  if (
    hasAllScenarioSignals(normalized, [
      /(?:stranger|stanger|unknown|незнаком|notanish|noanish|begona)/iu,
      /(?:instructions|инструкц|ko['’]?rsatma)/iu,
      /(?:follow|выполн|сдела|bajar|прос|ask|so['’]?ra)/iu,
    ])
  ) {
    return { kind: "unknown_contact", scenario: "unknown_stranger_request" };
  }

  if (
    /(?:fake|soxta|ложн|лже).{0,60}(?:bank|банк).{0,100}(?:employee|emloyee|agent|xodim|сотрудник).{0,140}(?:urgent|zudlik|сроч|demand|talab|треб).{0,100}(?:transaction|operatsiya|операци)/iu.test(
      normalized,
    )
  ) {
    return { kind: "bank_call", askedContext: "call" };
  }

  if (
    /(?:son|сын|дочь|daughter|o['’]?g['’]?lim|qizim).{0,100}(?:accident|авари|avariya).{0,120}(?:urgent|сроч|zudlik).{0,100}(?:transfer|перевод|pul|o['’]?tkaz)/iu.test(
      normalized,
    )
  ) {
    return { kind: "friend_money", askedContext: "transfer" };
  }

  if (
    /(?:romantic|dating|relationship|tanishim|знаком).{0,120}(?:ticket|visa|билет|виза|chipta|viza).{0,100}(?:money|pay|ден|pul)/iu.test(
      normalized,
    )
  ) {
    return { kind: "romance_money", askedContext: "transfer", scenario: "romance_money" };
  }

  if (
    /(?:men).{0,40}(?:paport|paaport|pasort|pasport|hujjat).{0,80}(?:rasm|nusxa).{0,100}(?:notanish|begona).{0,80}(?:yubordim|jo['’]?natdim)/iu.test(
      normalized,
    )
  ) {
    return { kind: "personal_data_already_shared", scenario: "passport_already_shared" };
  }

  if (
    /(?:smsdagi|sms\s+(?:message|xabar)|смс).{0,80}(?:raqam|number|номер).{0,100}(?:qo['’]?ng['’]?iroq|call|звон).{0,100}(?:taklif|tell|предлаг)/iu.test(
      normalized,
    )
  ) {
    return { kind: "bank_contact_question", scenario: "bank_contact_from_message" };
  }

  return null;
}

function classifyNormalizedVictimIntent(normalized: string): VictimIntentMatch | null {
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
    ) ||
    /(?:^|[\s,.;:!?])(?:ты|вы|это)\s+бот(?=$|[\s,.;:!?])|are\s+you\s+(?:a\s+)?bot|botmisan|botmisiz|ботмисан|ботмисиз/iu.test(
      normalized,
    )
  ) {
    return { kind: "trust_or_greeting" };
  }

  // Privacy questions decide whether a victim shares evidence at all — answer
  // honestly (hashing, redaction, no raw screenshots) instead of a risk card.
  if (
    /(?:это\s+)?(?:анонимно|конфиденциально)(?=$|[\s,.;:!?])|анонимност|не\s+соль[ёе](?:шь|те)|сольют\s+(?:мои\s+)?(?:данные|номер)|куда\s+(?:уходят|попадают|деваются)\s+(?:мои\s+)?(?:данные|номера)|(?:мои\s+)?данные\s+(?:не\s+)?(?:передают|попадут|сохраня|защищ)|maxfiymi|anonimmi|is\s+(?:this|it)\s+(?:anonymous|private|confidential)/iu.test(
      normalized,
    )
  ) {
    return { kind: "privacy_question" };
  }

  if (
    /^(?:(?:хорошо|ок|okay|ok|понял[аи]?|понятно|спасибо|спс|рахмат|rahmat)(?:\s+(?:спасибо|сделаю|понял[аи]?|ок|рахмат|rahmat))?|спасибо\s+за\s+помощь|хорошо,?\s+я\s+так\s+и\s+сделаю|yordam\s+uchun\s+rahmat|yaxshi,?\s+shunday\s+qilaman|сделаю|готово|tushunarli|mayli|xo['’]?p|thanks|thank\s+you(?:\s+for\s+(?:the\s+)?help)?|okay,?\s+i\s+will\s+do\s+that|done)[!.,\s]*$/iu.test(
      normalized,
    )
  ) {
    return { kind: "acknowledgement" };
  }

  if (isExplicitAuthoritySafetyNotice(normalized)) return null;

  // Physical coercion must outrank the broad police/tax impersonation route.
  // Its predicate requires an authority, a coercive instruction, a dangerous
  // act, and a threat/secrecy signal, so this does not turn an ordinary
  // authority mention into an emergency.
  if (isAuthorityPhysicalCoercion(normalized)) {
    return {
      kind: "authority_physical_coercion",
      askedContext: "call",
      scenario: "authority_physical_coercion",
    };
  }

  if (isNeighborVideoMalwareBait(normalized)) {
    return { kind: "file_received", askedContext: "apk", scenario: "neighbor_video_malware" };
  }

  if (isFakeFineCashbackApp(normalized)) {
    return { kind: "apk_request", askedContext: "apk", scenario: "fake_fine_cashback_app" };
  }

  if (isKnownContactPrizeLink(normalized)) {
    return {
      kind: "identity_uncertain",
      askedContext: "link_qr",
      scenario: "known_contact_prize_link",
    };
  }

  // Authority contact/accusation signals must run before generic unknown-call
  // and broad official-message routes, which would otherwise discard the
  // named РУВД/ОВД/МВД (or IIB/police) context.
  const policeImpersonation = classifyPoliceImpersonationScenario(normalized);
  if (policeImpersonation) return policeImpersonation;

  if (
    isAuthorityLegalIncident(normalized) ||
    QUOTED_RU_LEGAL_AUTHORITY_CLAIM_RE.test(normalized) ||
    QUOTED_UZ_LEGAL_AUTHORITY_CLAIM_RE.test(normalized) ||
    QUOTED_EN_LEGAL_AUTHORITY_CLAIM_RE.test(normalized)
  ) {
    return { kind: "legal_impersonation" };
  }

  if (AUTHORITY_CONTACT_RE.test(normalized)) {
    return { kind: "authority_impersonation", askedContext: "call" };
  }

  // Explicitly completed Telegram takeover needs recovery guidance, not the
  // preventative fake-login copy. The Uzbek-Cyrillic fallback above turns
  // «Телеграмимга кириб олишди, аккаунтим ўғирланди» into this same form.
  if (
    /(?:telegram(?:im)?ga|telegram|телеграм).{0,100}(?:kirib\s+olishdi|buzib\s+kirishdi|o['’]?g['’]?irlandi|og['’]?irlandi|взломал|угнал|украл|получил\p{L}*\s+доступ)|(?:kirib\s+olishdi|buzib\s+kirishdi|o['’]?g['’]?irlandi|og['’]?irlandi|взломал|угнал|украл|получил\p{L}*\s+доступ).{0,100}(?:telegram|телеграм)/iu.test(
      normalized,
    )
  ) {
    return {
      kind: "telegram_takeover",
      askedContext: "link_qr",
      scenario: "telegram_account_taken_over",
    };
  }

  // Post-action account loss is an incident, not a generic question about a
  // "QR code".  Keep it ahead of both emotional-help and advice/code routing
  // so the word "code" in the artifact label cannot hide a takeover signal.
  if (
    COMPLETED_LINK_OR_QR_ACTION_RE.test(normalized) &&
    QR_ARTIFACT_RE.test(normalized) &&
    ACCOUNT_ACCESS_LOSS_RE.test(normalized)
  ) {
    return { kind: "telegram_takeover", askedContext: "link_qr" };
  }

  // A victim who already interacted with a link/QR and is now worried needs
  // next-step advice.  This is more specific than the generic emotional-help
  // phrase "я боюсь" and preserves the completed-action context.
  if (
    COMPLETED_LINK_OR_QR_ACTION_RE.test(normalized) &&
    POST_ACTION_CONCERN_RE.test(normalized) &&
    ADVICE_QUESTION_RE.test(normalized)
  ) {
    return { kind: "advice_question" };
  }

  // Explicit benign completion context must not be reinterpreted as a scam
  // merely because it mentions a relative, payment, passport, or portal.
  if (
    SAFE_ROUTINE_PAYMENT_RE.test(normalized) ||
    SAFE_OFFICIAL_DOCUMENT_UPLOAD_RE.test(normalized) ||
    SAFE_OFFICIAL_DOCUMENT_HANDOFF_RE.test(normalized) ||
    SAFE_OFFICIAL_SIM_SERVICE_RE.test(normalized) ||
    isExplicitNativeNeighborVideoSafe(normalized) ||
    isExplicitSafeOfficialFineAppPayment(normalized) ||
    isSafePhysicalAccessOnly(normalized)
  ) {
    return null;
  }

  // A sender who simply chose the wrong recipient needs neutral bank recall
  // guidance. Do not reinterpret that ordinary mistake as a completed scam or
  // police incident. Incoming "return it elsewhere" requests are excluded by
  // the shared guard and continue to the money-mule route below.
  if (
    isAccidentalOutgoingTransferIntent(normalized) ||
    isNaturalAccidentalOutgoingTransferIntent(normalized)
  ) {
    return { kind: "accidental_transfer_outgoing", askedContext: "transfer" };
  }

  if (
    FAMILY_CONTEXT_RE.test(normalized) &&
    COMPLETED_FAMILY_ACTION_RE.test(normalized) &&
    FAMILY_SENSITIVE_VALUE_RE.test(normalized) &&
    (COMPLETED_FAMILY_COUNTERPARTY_RE.test(normalized) || COMPLETED_CODE_SHARE_RE.test(normalized))
  ) {
    return { kind: "relative_already_paid", askedContext: "transfer" };
  }

  if (
    (COMPLETED_TRANSFER_ACTOR_RE.test(normalized) ||
      COMPLETED_TRANSFER_IMPLICIT_SELF_RE.test(normalized)) &&
    !/(?:помогите|помоги|help\s+me|yordam)/iu.test(normalized) &&
    COMPLETED_TRANSFER_ACTION_RE.test(normalized) &&
    COMPLETED_TRANSFER_VALUE_RE.test(normalized) &&
    COMPLETED_TRANSFER_HARM_RE.test(normalized)
  ) {
    return {
      kind: "transfer_request",
      askedContext: "transfer",
      scenario: "money_already_sent",
    };
  }

  if (
    COMPLETED_APP_INSTALL_ACTION_RE.test(normalized) &&
    COMPLETED_APP_INSTALL_ARTIFACT_RE.test(normalized) &&
    COMPLETED_APP_INSTALL_HARM_RE.test(normalized)
  ) {
    return {
      kind: "apk_request",
      askedContext: "apk",
      scenario: "apk_already_installed",
    };
  }

  // Concrete scheme evidence must keep priority over generic wrapper clauses
  // such as "is this safe?" or "what should I do now?". These predicates
  // require multiple topic-specific signals, so neutral mentions of an
  // authority, a SIM, an investment wallet, or a job remain unaffected.
  if (hasExplicitBlackmailLabel(normalized)) {
    return {
      kind: "blackmail_threat",
      askedContext: "transfer",
      scenario: "photo_extortion",
    };
  }

  if (isOperatorSimSecretRequest(normalized)) {
    return { kind: "operator_call", askedContext: "call", scenario: "sim_swap" };
  }

  if (isPensionOrSubsidyRequest(normalized)) {
    return { kind: "pension_benefit", askedContext: "call" };
  }

  // A request for card credentials stays a card-compromise scenario even if
  // the caller claims the details are needed to return an accidental transfer.
  if (isCardCredentialRequest(normalized)) {
    return { kind: "card_request", askedContext: "card" };
  }

  const everydayScenario = classifyHighConfidenceEverydayScenario(normalized);
  if (everydayScenario) return everydayScenario;

  if (isHighConfidenceInvestmentOffer(normalized)) {
    return {
      kind: "investment_offer",
      askedContext: "transfer",
      scenario: "investment_offer",
    };
  }

  if (isJobEntryFeeIntent(normalized)) {
    return { kind: "job_offer" };
  }

  if (
    /(?:politsiyadanman|iibdanman|prokuraturadanman).{0,140}(?:jinoiy\s+ish|qo['’]?rqit|tahdid|pul\s+talab)/iu.test(
      normalized,
    )
  ) {
    return { kind: "legal_impersonation" };
  }

  if (
    /(?:soliq|налог|tax).{0,140}(?:to['’]?la|оплат|pay).{0,100}(?:havola|ссылк|link)|(?:havola|ссылк|link).{0,100}(?:soliq|налог|tax).{0,100}(?:to['’]?la|оплат|pay)/iu.test(
      normalized,
    )
  ) {
    return { kind: "official_impersonation", askedContext: "transfer" };
  }

  // A Telegram message can carry a bank/card code-theft request without being
  // a Telegram-login takeover. Keep the requested secret above the broad
  // Telegram-news matcher only when bank/card and disclosure signals coexist.
  if (isBankOrCardCodeDisclosureRequest(normalized)) {
    return { kind: "code_request", askedContext: "code" };
  }

  const newsIntent = classifyNewsVictimIntent(normalized);
  if (newsIntent) {
    return newsIntent;
  }

  // Keep concrete call scenarios such as repeated foreign-number calls above
  // the requested secret. Outside those scenarios, an explicit SMS/OTP-code
  // request still needs immediate code guidance rather than a generic answer.
  if (isExplicitCodeRequest(normalized)) {
    return { kind: "code_request", askedContext: "code" };
  }

  // Completed incidents must be classified before generic code/file/data
  // request rules, otherwise the bot gives prevention advice after the harm
  // has already happened.
  if (COMPLETED_PERSONAL_DATA_RE.test(normalized)) {
    return { kind: "personal_data_already_shared" };
  }

  if (COMPLETED_PASSWORD_ENTRY_RE.test(normalized)) {
    return { kind: "account_hacked_other", askedContext: "code" };
  }

  if (UNAUTHORIZED_CHARGE_RE.test(normalized)) {
    return { kind: "unauthorized_charge", askedContext: "card" };
  }

  // Threats of physical violence ("we will come to your home") — this is a
  // crime, the answer must lead with 102, not with a risk verdict. Keep this
  // above generic cries for help so wrappers such as "помогите" / "help me" /
  // "yordam" cannot hide the concrete physical-safety emergency.
  const violenceEvidence = withoutExplicitlyNegatedViolence(normalized);
  if (
    /(?:угрожа(?:ет|ют)|грозит(?:ся)?|грозят(?:ся)?|пригрозил[аи]?|tahdid\s+qil|threaten(?:s|ed|ing)?|said\s+they['’]?ll)[\s\S]{0,100}(?:приехать|приед(?:у|ем|ут)|прийти|прид(?:у|ем|ут)|найти|найд(?:у|ем|ут)|вычисл|адрес|домой|расправ|избить|избьют|изобьют|убить|убьют|порежут|сожгут|kelamiz|boramiz|uyingga|manzil|come\s+to\s+(?:my|your)\s+(?:home|house)|find\s+(?:me|you)|beat\s+(?:me|you)|kill\s+(?:me|you)|hurt\s+(?:me|you)|know\s+(?:my|your)\s+address)|(?:знаем|узнаем)[\s\S]{0,30}(?:где\s+ты|твой\s+адрес|адрес)|(?:мы\s+)?приедем\s+к\s+тебе|найдем\s+тебя|(?:тебя\s+)?(?:убью|убьем|убьют|изобью|изобьем|изобьют)|сломаю\s+(?:тебе\s+)?ноги|(?:seni\s+)?(?:uram(?:an|iz)|urib\s+tashla\p{L}*|o['’]?ldir(?:aman|amiz)|topamiz)|(?:сени\s+)?уриб\s+ташла\p{L}*|uyingga\s+(?:boramiz|kelamiz)|(?:uyingni|manzilingni)\s+bilamiz|(?:(?:we|i|they)\s+(?:will|['’]?ll)\s+)?(?:come\s+to\s+(?:your|my)\s+(?:home|house)|find\s+(?:you|me)|beat\s+(?:you|me)|kill\s+(?:you|me)|hurt\s+(?:you|me)|break\s+your\s+legs)|(?:we|they)\s+know\s+(?:where\s+you\s+live|your\s+address)/iu.test(
      violenceEvidence,
    ) ||
    /(?:(?:тебя\s+)?(?:застрел\p{L}*|закоп\p{L}*)|сломаю\s+(?:тебе\s+)?шею|seni\s+(?:otib\s+tashla(?!may)\p{L}*|yo['’]?q\s+qil(?!may)\p{L}*)|сени\s+(?:отиб\s+ташла(?!май|маы)\p{L}*|йўқ\s+қил(?!май|маы)\p{L}*)|shoot\s+(?:you|me)|break\s+(?:your|my)\s+neck|make\s+(?:you|me)\s+disappear)/iu.test(
      violenceEvidence,
    )
  ) {
    return { kind: "violence_threat", askedContext: "transfer" };
  }

  if (
    /(?:я\s+боюсь|мне\s+страшно|п[оа]м[оа]гите|срочно\s+помогите|мне\s+нужна\s+помощь|я\s+не\s+знаю\s+что\s+делать|я\s+запутал(?:ся|ась)|я\s+волнуюсь|не\s+понимаю,?\s+что\s+происходит|мне\s+плохо|я\s+в\s+панике|help\s+me|i\s+am\s+scared|i\s+don't\s+know\s+what\s+to\s+do|^(?:iltimos\s+)?yordam(?:\s+(?:bering|kerak))?$|menga\s+yordam|yordam(?:\s+(?:bering|kerak))?.{0,80}(?:nima\s+qilishni\s+bilmay|sarosima|qo['’]?rq|xavotir|o['’]?zim\s+hal\s+qila\s+olmay)|(?:iltimos.{0,40})?vaziyatni\s+tushunishga\s+yordam|[её]рдам|qo['’]?rqyapman|nima\s+qilishni\s+bilmay(?:man|\s+qoldim))/iu.test(
      normalized,
    )
  ) {
    return { kind: "emotional_help" };
  }

  // Blackmail / sextortion pressure: "pay or we publish your photos/chat".
  // Must come before the generic scam-concern block so the victim gets the
  // dedicated "do not pay, payment does not delete anything" guidance.
  if (
    /(?:опублику|вылож[иау]|разошл|разосл|распростран|солью|сольют|слить|скинут?\s+всем|отправ(?:ит|ят|лю)\s+(?:всем|друзьям|родным|близким|контактам)|tarqat|e['’]?lon\s+qil|таркат)[\s\S]{0,80}(?:фото|видео|переписк|интим|голы|скрин|(?<!\p{L})(?:rasm|surat|расм|сурат)(?!\p{L}))|(?:фото|видео|переписк|интим|(?<!\p{L})(?:rasm|surat|расм|сурат)(?!\p{L}))[\s\S]{0,80}(?:опублику|вылож|разошл|разосл|распростран|солью|сольют|всем\s+контакт|друзьям|родным|tarqat|e['’]?lon|таркат)/iu.test(
      normalized,
    ) ||
    hasExplicitBlackmailLabel(normalized) ||
    /(?:compromising\s+(?:photos?|videos?|materials?|images?)|(?:компромат|компрометирующ|kompromat).{0,100}(?:фото|видео|переписк|материал|rasm|surat|photo|video|image)|(?:фото|видео|переписк|rasm|surat|photo|video|image).{0,100}(?:компромат|компрометирующ|kompromat|compromising))/iu.test(
      normalized,
    ) ||
    /(?<!\p{L})(?:rasm(?:lar)?(?:im|ing|i|imiz|ingiz|lari)?(?:ni|ga|da|dan)?|surat(?:lar)?(?:im|ing|i|imiz|ingiz|lari)?(?:ni|ga|da|dan)?)(?!\p{L})[\s\S]{0,80}(?:tarqat\p{L}*|e['’]?lon\s+qil\p{L}*)[\s\S]{0,60}(?:deb|aks\s+holda|bo['’]?lmasa)[\s\S]{0,50}(?<!\p{L})pul\p{L}{0,8}(?!\p{L})[\s\S]{0,35}(?:so['’]?ra\p{L}*|talab\s+qil\p{L}*)/iu.test(
      normalized,
    ) ||
    /(?:требу(?:ет|ют)|просят|хотят|talab\s+qil)[\s\S]{0,40}(?:ден[ьи]?г|пул|pul|оплат|перевод)[\s\S]{0,80}(?:иначе|а\s+то|не\s+то|aks\s+holda|bo['’]?lmasa)[\s\S]{0,100}(?:опублику|разошл|разосл|вылож|расскаж|tarqat|e['’]?lon|таркат)|(?:иначе|а\s+то|aks\s+holda|bo['’]?lmasa)[\s\S]{0,60}(?:опублику|разошл|разосл|вылож|расскаж|tarqat|e['’]?lon|таркат)/iu.test(
      normalized,
    )
  ) {
    return {
      kind: "blackmail_threat",
      askedContext: "transfer",
      scenario: "photo_extortion",
    };
  }

  // Already-deceived aftermath: past-tense RU/UZ "I was scammed / money is
  // gone". The right answer is bank-first damage control (report_question),
  // not another "what do they ask you to do" prompt.
  if (
    /(?:^|[\s,.;:!?])(?:[оа]бманули|обманул[иа]|развели|надули|облапошили|кинули(?!\s+(?:ссылк|линк|url|фото|скрин|файл|сообщени|в\s+групп|в\s+чат))|aldashdi|aldab\s+ket(?:ishdi|di)|алдашди|алдаб\s+кет(?:ишди|ди)|obmanuli|razveli)(?=$|[\s,.;:!?])/iu.test(
      normalized,
    ) ||
    /(?:меня|нас|мени|бизни|менга|маму|папу|друга|meni|bizni|menga|menya|menia|nas)[\s\S]{0,60}(?:[оа]бманул|развел|кинул|надул|облапошил|aldashdi|aldab\s+ket|aldadi|алдашди|алдаб\s+кет|obmanul|razveli|kinuli)/iu.test(
      normalized,
    ) ||
    /(?:украли|сняли|списали|увели|похитили|ukrali)[\s\S]{0,40}(?:ден[ьи]?г|пул|pul|dengi)|(?:ден[ьи]?г\w*|пул|pul|dengi)[\s\S]{0,50}(?:украли|сняли|списали|увели|ушли|пропали|исчезли|ushli|yechib\s+olishdi|yechildi|ketdi|yo['’]?qoldi|o['’]?g['’]?irlashdi|кетди|йуколди)/iu.test(
      normalized,
    ) ||
    /(?:kartamdan|hisobimdan|картамдан|хисобимдан|ҳисобимдан)[\s\S]{0,50}(?:pul|пул)[\s\S]{0,50}(?:yech|olishdi|ket|еч|олишди|кет)/iu.test(
      normalized,
    ) ||
    /(?:как|можно\s+ли|поможет\s+ли|получится\s+ли|реально\s+ли|kak)\s+[\s\S]{0,30}?(?:вернуть|vernut)\s+(?:ден[ьи]?г\w*|перевод|средства|dengi)|pulni\s+(?:qanday\s+)?qaytar|(?:get|got)\s+(?:my\s+)?money\s+back/iu.test(
      normalized,
    )
  ) {
    return { kind: "report_question" };
  }

  // Investment/casino withdrawal trap: "pay a tax/fee to withdraw".
  if (
    /(?:не\s+могу|не\s+получается|не\s+да[юе]т|не\s+дают|нельзя|отказыва(?:ют|ется))[\s\S]{0,60}(?:вывести|вывод|снять|забрать)|(?:вывод|вывести\s+деньги|снять\s+деньги)[\s\S]{0,60}(?:заблокир|заморож|недоступ|отклоня|не\s+прош[ёе]л)|(?:налог|комисси|сбор|страховк|верификаци|депозит)[\s\S]{0,80}(?:вывод|вывести|снять|забрать|получить)[\s\S]{0,50}(?:ден[ьи]?г|выигрыш|прибыл|средств)|(?:pulimni|pulni|mablag['’]?(?:imni|ni)?|yutuq(?:ni|imni)?)[\s\S]{0,60}(?:qaytarib|yechib|chiqarib|olib)[\s\S]{0,50}(?:bo['’]?lm|olmayap|berishmayap|bermayap)|(?:yechish|chiqarish)[\s\S]{0,50}uchun[\s\S]{0,60}(?:soliq|komissiya|to['’]?lov|garov)|(?:can['’]?t|cannot)\s+withdraw|withdrawal[\s\S]{0,50}(?:blocked|frozen|fee|tax)/iu.test(
      normalized,
    )
  ) {
    return { kind: "withdrawal_blocked", askedContext: "transfer" };
  }

  // Loan/credit fraudulently opened in the victim's name.
  if (
    isUnauthorizedCreditOpened(normalized) ||
    /(?:на\s+меня|на\s+мо[ёе]\s+имя|без\s+моего\s+ведома|ustimga|nomimga|mening\s+nomimga)[\s\S]{0,60}(?:оформ|взяли|повесили|навесили|открыли|набрали|rasmiylashtir|olishibdi|ochishibdi)|(?:оформили|взяли|повесили|навесили|открыли|набрали)[\s\S]{0,40}(?:кредит|за[ёе]м|займ|микрозайм|ссуд)|(?:кредит|за[ёе]м|займ|микрозайм|ссуд|kredit|qarz|mikroqarz)[\s\S]{0,60}(?:на\s+мо[ёе]\s+имя|на\s+меня|без\s+моего\s+ведома|ustimga|nomimga|rasmiylashtirishibdi|rasmiylashtirilgan|olishibdi)/iu.test(
      normalized,
    )
  ) {
    return { kind: "identity_loan", askedContext: "transfer" };
  }

  // A charge/subscription the victim did not make.
  if (
    /(?:смс|sms|сообщени|уведомлени)[\s\S]{0,60}(?:списани|списали|снят|оплат|покупк|платеж)[\s\S]{0,80}не\s+(?:делал|совершал|покупал|платил|заказывал)|(?:списали|списание|сняли)[\s\S]{0,60}не\s+(?:делал|совершал|покупал|платил|заказывал)|(?:подписал[иа]|подключил[иа])[\s\S]{0,50}(?:платн|подписк)|платн(?:ые|ая|ую)\s+(?:подписк|смс|sms|услуг)[\s\S]{0,60}(?:списыва|снима|ден[ьи]?г)|(?:men\s+qilmagan|sotib\s+olmagan)[\s\S]{0,60}(?:to['’]?lov|xarid|yechil)|pullik\s+(?:obuna|sms|xizmat)/iu.test(
      normalized,
    )
  ) {
    return { kind: "unauthorized_charge", askedContext: "card" };
  }

  // Non-Telegram account takeover (Telegram itself routes to panic:5).
  if (
    /(?:взломали|взломан[аы]?|угнали|увели|украли)[\s\S]{0,50}(?:инстаграм|instagram|инсту|почт[уа]|email|e-?mail|имейл|мыло|facebook|фейсбук|vk|вконтакте|одноклассник|tiktok|тикток|whatsapp|ватсап|imo|имо)|(?:инстаграм|instagram|почт[уа]|email|e-?mail|facebook|фейсбук|vk|вконтакте|tiktok|тикток|whatsapp|ватсап|imo)[\s\S]{0,50}(?:взломали|взломан|угнали|увели|не\s+могу\s+(?:зайти|войти))|(?:instagram|pochta|email|whatsapp|imo)[\s\S]{0,50}(?:buzib|buzishdi|o['’]?g['’]?irla|olib\s+qo['’]?yishdi)|(?:buzib\s+kirishdi|buzishdi)[\s\S]{0,50}(?:instagram|pochta|email|whatsapp|imo)/iu.test(
      normalized,
    )
  ) {
    return { kind: "account_hacked_other", askedContext: "code" };
  }

  // The same scammer comes back from a new number/account.
  if (
    /(?:пишет|написал|звонит|позвонил|объявился|вернулся|вышел\s+на\s+связь)[\s\S]{0,60}с\s+(?:нов(?:ого|ым)|друго(?:го|й))\s+(?:номер|аккаунт|акк)|с\s+(?:нов(?:ого|ым)|друго(?:го|й))\s+(?:номер|аккаунт)[\s\S]{0,50}(?:пишет|написал|звонит|позвонил)|(?:мошенник|скамер|он|она|тот\s+же)[\s\S]{0,40}(?:опять|снова)[\s\S]{0,40}(?:пишет|написал|звонит|позвонил|объявился)|(?:yana|qayta)[\s\S]{0,40}(?:yozyapti|yozdi|qo['’]?ng['’]?iroq)[\s\S]{0,50}(?:yangi|boshqa)\s+(?:raqam|akkaunt)/iu.test(
      normalized,
    )
  ) {
    return { kind: "scammer_recontact" };
  }

  // A concrete document/identity-data request is more specific than a generic
  // mention of a scammer and must not be swallowed by the broad concern route.
  if (hasAskVerb(normalized) && PERSONAL_DATA_REQUEST_RE.test(normalized)) {
    return { kind: "personal_data_request" };
  }

  if (
    /(?:меня|нас|маму|папу|друга|мени|бизни|менга|onam|otam|meni|bizni|me|my\s+(?:mom|dad|friend)).{0,80}(?:обманыва|обманут|развод|скам|мошенник|ald[aao]yap|firib|scam|fraud)/iu.test(
      normalized,
    ) ||
    /(?:^|[\s,.;:!?])(?:это|bu|shu)\s+(?:скам|мошенник(?:и|ам|ов)?|мошенничество|обман|scam|fraud|firib|firibgarlik)(?:mi|ми)?(?:\?|$|[\s,.;:!?])|(?:^|[\s,.;:!?])(?:scam|skam|скам|firib(?:gar(?:lik|lar)?)?|фирибгар(?:лик|лар)?|мошен+ик(?:и|ов)?|обман|развод|кидалово)(?:mi|ми|\?)?(?:$|[\s,.;:!?])/iu.test(
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
    /(?:как\s+(?:мне\s+)?(?:связаться|позвонить|перезвонить)\s+(?:с|в)\s+банк|какой\s+номер\s+(?:банка|капиталбанка|kapitalbank|uzum|хамкор|hamkor)|номер\s+(?:банка|капиталбанка|kapitalbank|uzum|хамкор|hamkor)|(?:а\s+)?если\s+это\s+(?:правда\s+)?банк,?\s+как\s+проверить|как\s+проверить,?\s+что\s+это\s+(?:правда\s+)?банк|bankka\s+qanday\s+qo['’]?ng['’]?iroq|bu\s+haqiqiy\s+bank\s+ekanini\s+qanday\s+tekshir|bank\s+(?:number|phone)|how\s+(?:do\s+i\s+)?call\s+(?:the\s+)?bank|how\s+(?:do|can)\s+i\s+(?:check|verify).{0,30}(?:the\s+)?bank)/iu.test(
      normalized,
    ) ||
    /(?:как|где|kak)\s+[\s\S]{0,20}?(?:заблокировать|заморозить|блокировать|zablokirovat)\s+(?:карт|счет|счёт|kartu)|kartani\s+(?:qanday\s+)?blok|картани\s+(?:кандай\s+)?блок|how\s+(?:do\s+i\s+|to\s+)?(?:block|freeze)\s+(?:my\s+)?card/iu.test(
      normalized,
    )
  ) {
    return { kind: "bank_contact_question", askedContext: "call" };
  }

  if (
    /(?:куда\s+(?:звонить|обращаться|писать)|как\s+(?:пожаловаться|заявить|сообщить)|куда\s+пожаловаться|полици[яю]|милици[яю]|102|cyber\s*police|киберполици|shikoyat|politsiyaga\s+qanday|qayerga\s+(?:murojaat|shikoyat)|where\s+(?:do\s+i\s+)?report|how\s+(?:do\s+i\s+)?report).{0,100}(?:обман|мошен|скам|номер|деньг|перев|код|ald|firib|scam|fraud)?/iu.test(
      normalized,
    )
  ) {
    return { kind: "report_question" };
  }

  if (ADVICE_QUESTION_RE.test(normalized)) {
    if (/(?:код|sms|смс|otp|code|kod)/iu.test(withoutQrCodeLabel(normalized))) {
      return { kind: "code_request", askedContext: "code" };
    }
    if (isTravelMigrationPrepaymentIntent(normalized)) {
      return { kind: "travel_migration_prepayment", askedContext: "transfer" };
    }
    if (isJobEntryFeeIntent(normalized)) {
      return { kind: "job_offer" };
    }
    return { kind: "advice_question" };
  }

  if (isGovServiceLoginIntent(normalized)) {
    return { kind: "gov_service_login" };
  }

  // Keep an ordinary unknown-number report on the call-safety route. Uzbek
  // `qayta-qayta` contains `ayt`, which must not look like an ask verb and
  // accidentally combine with a later short-token QR check.
  if (
    UNKNOWN_CALL_RE.test(normalized) &&
    /(?:звон|call|caller|qo['’]?ng['’]?iroq)/iu.test(normalized) &&
    !/(?:ссылк|линк|\b(?:url|link|havola|qr)\b|куар|sms|смс|otp|код|парол|code|password|деньг|перевод|оплат|money|transfer|payment|pul|o['’]?tkaz|to['’]?lov)/iu.test(
      normalized,
    )
  ) {
    return { kind: "unknown_call", askedContext: "call" };
  }

  // Uzbek requests are often phrased with a verbal-noun action before the
  // final `so'rashdi` ("asked me to forward ..."). Keep the one-time secret
  // visible before generic "someone sent a message" fallbacks can win.
  if (
    hasVictimRequestFrame(normalized) &&
    /(?:bir\s+martalik\s+(?:parol|kod)|sms\s+kod|tasdiqlash\s+kodi)/iu.test(normalized) &&
    /(?:yuborishni|jo['’]?natishni|aytishni|ko['’]?rsatishni|so['’]?rash)/iu.test(normalized)
  ) {
    return { kind: "code_request", askedContext: "code" };
  }

  if (
    hasVictimRequestFrame(normalized) &&
    hasAskVerb(normalized) &&
    (/(?:оплат|pay(?:ment)?\b|to['’]?lov|to['’]?la).{0,50}(?:реквизит|сч[её]т|details?|account|hisob)/iu.test(
      normalized,
    ) ||
      /(?:реквизит|сч[её]т|details?|account|hisob).{0,50}(?:оплат|pay(?:ment)?\b|to['’]?lov|to['’]?la)/iu.test(
        normalized,
      ))
  ) {
    return { kind: "transfer_request", askedContext: "transfer" };
  }

  if (
    hasVictimRequestFrame(normalized) &&
    hasAskVerb(normalized) &&
    /(?:sms|смс|otp|push|пуш).{0,60}(?:код|code|kod|цифр|digits)|(?:код|code|kod|цифр|digits).{0,60}(?:sms|смс|otp|push|пуш)/iu.test(
      normalized,
    )
  ) {
    return { kind: "code_request", askedContext: "code" };
  }

  if (
    hasVictimRequestFrame(normalized) &&
    hasAskVerb(normalized) &&
    !/(?:сделать\s+перевод|перевод|перевести|оплат|transfer|payment|pay\b|to['’]?lov|to['’]?la|o['’]?tkaz)/iu.test(
      normalized,
    ) &&
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
    hasVictimFrame(normalized) &&
    /(?:приш[её]л|пришла|пришло|приходит|получил[аи]?|поступил[ао]?|keldi|oldim|received|got).{0,80}(?:sms|смс|otp|код|парол|цифр|сообщени|уведомлени|code|password|digits|kod|verification)|(?:sms|смс|otp|код|парол|цифр|сообщени|уведомлени|code|password|digits|kod|verification).{0,80}(?:приш[её]л|пришла|пришло|приходит|получил[аи]?|поступил[ао]?|keldi|oldim|received|got)/iu.test(
      normalized,
    ) &&
    /(?:зачем|почему|не\s+понимаю|не\s+понял[аи]?|не\s+знаю|сам|сама|како[йе].?то|какой-то|nimaga|nega|tushunmadim|why|not\s+sure|don['’]?t\s+understand)/iu.test(
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
    /(?:карт[ауые]|cvv|cvc|pin|пин|номер\s+карты|реквизит|card|karta|plastik)/iu.test(normalized) &&
    !/(?:перев(?:ести|од).{0,50}(?:на\s+)?карт|(?:на\s+)?карт\p{L}{0,8}.{0,50}перев|kartaga.{0,60}(?:pul|o['’]?tkaz)|(?:pul|o['’]?tkaz).{0,60}kartaga|transfer.{0,50}(?:to\s+)?(?:a\s+)?card)/iu.test(
      normalized,
    )
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

  // A fee tied to getting a job is more specific than a generic payment ask.
  // Keep this after code/card/family routes and the travel prepayment route,
  // but before the broad transfer fallback below.
  if (isJobEntryFeeIntent(normalized)) {
    return { kind: "job_offer" };
  }

  if (
    hasVictimRequestFrame(normalized) &&
    hasAskVerb(normalized) &&
    /(?:перевод|перевести|деньг|оплат|платеж|комисс|transfer|money|pay|payment|(?<!\p{L})pul\p{L}{0,8}(?!\p{L})|to['’]?lov|o['’]?tkaz)/iu.test(
      normalized,
    )
  ) {
    return { kind: "transfer_request", askedContext: "transfer" };
  }

  if (
    hasVictimRequestFrame(normalized) &&
    hasAskVerb(normalized) &&
    /(?:apk|приложени|установ|скачать|anydesk|dastur|ilova|install|download|(?<!\p{L})app(?!\p{L})|доступ\s+к\s+(?:телефон|экран|устройств)|демонстрац.{0,20}экран|screen\s+share|screen\s+access|phone\s+access)/iu.test(
      normalized,
    )
  ) {
    return { kind: "apk_request", askedContext: "apk" };
  }

  if (
    (hasVictimFrame(normalized) &&
      /(?:прислал[аи]?|прислали|скинул[аи]?|кинули|отправил[аи]?|дали|yuborishdi|jo['’]?natishdi|sent|gave).{0,80}(?:ссылк|линк|\b(?:url|link|havola)\b)/iu.test(
        normalized,
      )) ||
    (hasVictimFrame(normalized) &&
      /(?:ссылк|линк|\b(?:url|link|havola)\b).{0,80}(?:прислал[аи]?|прислали|скинул[аи]?|кинули|отправил[аи]?|дали|yuborishdi|jo['’]?natishdi|sent|gave)/iu.test(
        normalized,
      ))
  ) {
    return { kind: "link_received", askedContext: "link_qr" };
  }

  if (
    hasVictimRequestFrame(normalized) &&
    hasAskVerb(normalized) &&
    /(?:ссылк|линк|\b(?:url|link|havola|qr)\b|куар)/iu.test(normalized)
  ) {
    return { kind: "link_request", askedContext: "link_qr" };
  }

  if (
    (hasVictimFrame(normalized) &&
      /(?:прислал[аи]?|прислали|скинул[аи]?|отправил[аи]?|дали|приш[её]л[ао]?|пришли|поступил[ао]?|получил[аи]?|получили|yuborishdi|jo['’]?natishdi|sent|gave).{0,80}(?:файл|документ|apk|архив|pdf|file|document|fayl)/iu.test(
        normalized,
      )) ||
    (hasVictimFrame(normalized) &&
      /(?:файл|документ|apk|архив|pdf|file|document|fayl).{0,80}(?:прислал[аи]?|прислали|скинул[аи]?|отправил[аи]?|дали|приш[её]л[ао]?|пришли|поступил[ао]?|получил[аи]?|получили|yuborishdi|jo['’]?natishdi|sent|gave)/iu.test(
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
    ) ||
    /(?:soliq|солик|солиқ|davlat\s+xizmat|mygov|my\.gov|one\s?id).{0,120}(?:qo['’]?ng['’]?iroq|qong['’]?iroq|telefon|zvon|call|yoz|xabar|murojaat|sms|kod|karta|pasport|pinfl|jshshir|jarima|hujjat|pul).{0,120}(?:qil|kel|yoz|so['’]?ra|talab|ayt|yubor|ber)?/iu.test(
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
    /(?:^|[\s,.;:!?])(?:они|снова|опять)\s+(?:опять\s+|снова\s+)?звон(?:ит|ят)(?=$|[\s,.;:!?])|звон(?:ит|ят)\s+(?:опять|снова)/iu.test(
      normalized,
    ) ||
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
    /(?:знаком|приятел|одноклассник|одноклассниц).{0,120}(?:одолж|займ|занять|верну|скинь|переведи).{0,120}(?:деньг|перевод|помощ)?|(?:одолж|займ|занять|верну|скинь|переведи).{0,120}(?:деньг|перевод)?.{0,120}(?:знаком|приятел|одноклассник|одноклассниц)/iu.test(
      normalized,
    )
  ) {
    return { kind: "friend_money", askedContext: "transfer" };
  }

  if (
    /(?:люблю|скучаю|дорог|родн|(?<!\p{L})знаком\p{L}*|отношен|невест|жених|девушк|парен|интернет).{0,140}(?:деньг|перевед|помоги|билет|виза|лечение|инвест|крипт|депозит)/iu.test(
      normalized,
    ) ||
    /(?:деньг|перевед|помоги|билет|виза|лечение|инвест|крипт|депозит).{0,140}(?:люблю|скучаю|дорог|родн|(?<!\p{L})знаком\p{L}*|отношен|невест|жених|девушк|парен|интернет)/iu.test(
      normalized,
    ) ||
    /(?:sevgi|sog['’]?indim|aziz|(?<!\p{L})tanish(?!\p{L})|munosabat).{0,140}(?:pul|yordam|chipta|viza|davolanish|invest|kripto)/iu.test(
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
    /(?:мне|нам|со\s+мной|меня).{0,70}(?:пиш(?:ет|ут)|написал[аи]?|связал[аси]?ь?|обратил[аси]?ь?).{0,100}(?:админ|администратор|модератор|владелец).{0,80}(?:канал|чат|групп)/iu.test(
      normalized,
    ) ||
    /(?:админ|администратор|модератор|владелец).{0,80}(?:канал|чат|групп).{0,100}(?:пиш(?:ет|ут)|написал[аи]?|связал[аси]?ь?|обратил[аси]?ь?).{0,70}(?:мне|нам|со\s+мной|меня)/iu.test(
      normalized,
    ) ||
    /(?:menga|meni|men\s+bilan).{0,80}(?:kanal|guruh|chat).{0,80}(?:admini|administratori|admin|administrator|moderator).{0,80}(?:yoz|murojaat|bog['’]?lan)/iu.test(
      normalized,
    ) ||
    /(?:kanal|guruh|chat).{0,80}(?:admini|administratori|admin|administrator|moderator).{0,80}(?:menga|meni|men\s+bilan).{0,80}(?:yoz|murojaat|bog['’]?lan)/iu.test(
      normalized,
    ) ||
    /(?:channel|group|chat).{0,80}(?:admin|administrator|moderator|owner).{0,80}(?:messag|writ|text|contact).{0,80}(?:me|us)/iu.test(
      normalized,
    )
  ) {
    return { kind: "telegram_message" };
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

  // High-confidence everyday phrasing that does not carry a concrete payload.
  // This is deliberately kept at the final fallback: all specific incident,
  // panic and impersonation routes above retain priority, while quoted scam
  // payloads were already rejected by looksLikeScamPayloadRatherThanVictimPhrase.
  if (
    /(?:помоги(?:те)?|помощь|не\s+понимаю.{0,30}(?:происходит|разобраться)|запутал(?:ся|ась)|adashib\s+qoldim|sarosimaga\s+tushdim|hozir\s+nima\s+bo['’]?layotganini\s+tushunmayapman|help\s+me|please\s+help|i\s+am\s+(?:afraid|lost|confused)|i\s+do\s+not\s+understand\s+what\s+is\s+happening\s+right\s+now)/iu.test(
      normalized,
    )
  ) {
    return { kind: "emotional_help" };
  }

  if (
    /(?:подозрительн.{0,25}(?:переписк|разговор)|пытаются\s+(?:развести|обмануть)|хочет\s+меня\s+обмануть|похож.{0,30}(?:развод|обман|мошен)|(?:scam|fraud|fraudulent|scammer|suspicious).{0,80}(?:me|conversation|offer|person)|(?:i|someone|they).{0,80}(?:scam|fraud|trick\s+me)|aldashmoqchi|aldab\s+pul|firibgarlikka\s+o['’]?xsh|bu\s+(?:rost|firib))/iu.test(
      normalized,
    )
  ) {
    return { kind: "general_scam_concern" };
  }

  const everydayAsk =
    /(?:просят|просит|требу(?:ет|ют)|велят|сказал[аи]?|говорят|хочет|уговаривают|торопят|asks?|asked|demand|told|tell(?:s|ing)?|says?|wants?|pressure|needs?|so['’]?ra|talab|ayt|deyish|xohla|ko['’]?ndir|shoshir)/iu;
  if (
    everydayAsk.test(normalized) &&
    /(?:sms|смс|otp|одноразов|verification|подтверждени|код|парол|code|password|digits|kod|parol|olti\s+raqam)/iu.test(
      normalized,
    )
  ) {
    return { kind: "code_request", askedContext: "code" };
  }

  if (
    everydayAsk.test(normalized) &&
    /(?:перевод|перевести|деньг|оплат|комисс|кошел[её]к|сч[её]т|transfer|money|payment|pay\b|wallet|cash|(?<!\p{L})pul\p{L}{0,8}(?!\p{L})|to['’]?lov|to['’]?la|o['’]?tkaz|hamyon|hisob)/iu.test(
      normalized,
    )
  ) {
    return { kind: "transfer_request", askedContext: "transfer" };
  }

  if (
    /(?:прислал[аи]?|прислали|отправил[аи]?|отправили|получил[аи]?|приш[её]л|дали|sent|gave|received|yuborishdi|jo['’]?natdi|jo['’]?natishdi|keldi|oldim|berishdi).{0,100}(?:ссылк|link|havola)|(?:ссылк|link|havola).{0,100}(?:прислал|прислали|отправил|отправили|sent|gave|yubor|jo['’]?nat|ber)|(?:telegram\s+login\s+link).{0,80}(?:appeared|showed\s+up).{0,40}(?:chat|message)/iu.test(
      normalized,
    )
  ) {
    return { kind: "link_received", askedContext: "link_qr" };
  }

  if (
    /(?:прислал[аи]?|прислали|отправил[аи]?|отправили|получил[аи]?|приш[её]л|sent|received|yuborishdi|jo['’]?natdi|keldi|oldim).{0,100}(?:файл|apk|архив|pdf|приложени|file|archive|app|fayl|ilova)|(?:файл|архив|pdf|file|archive|fayl).{0,100}(?:прислал|прислали|получил|sent|received|yubor|jo['’]?nat|oldim|keldi)/iu.test(
      normalized,
    ) ||
    /(?:arxiv|ilova).{0,80}(?:keldi|yuborishdi|jo['’]?natishdi)/iu.test(normalized)
  ) {
    return { kind: "file_received" };
  }

  if (UNKNOWN_CALL_RE.test(normalized)) {
    return { kind: "unknown_call", askedContext: "call" };
  }

  if (
    /(?:звон|call|qo['’]?ng['’]?iroq).{0,80}(?:молчат|тишин|silent|nobody\s+says|jim\s+tur|hech\s+kim\s+gapir)/iu.test(
      normalized,
    ) ||
    /(?:telefonni\s+ko['’]?tar|when\s+i\s+answer).{0,80}(?:hech\s+kim\s+gapir|nobody\s+says|silent)/iu.test(
      normalized,
    )
  ) {
    return { kind: "silent_call", askedContext: "call" };
  }

  if (
    /(?:foreign|another\s+country|зарубеж|иностран|другой\s+стран|chet\s+el|xorij).{0,80}(?:номер|звон|call|raqam|qo['’]?ng['’]?iroq)|(?:номер|звон|call|raqam|qo['’]?ng['’]?iroq).{0,80}(?:foreign|another\s+country|зарубеж|иностран|chet\s+el|xorij)/iu.test(
      normalized,
    )
  ) {
    return { kind: "foreign_call", askedContext: "call" };
  }

  if (
    FAMILY_CONTEXT_RE.test(normalized) &&
    ACTIVE_FAMILY_REQUEST_RE.test(normalized) &&
    (FAMILY_REQUEST_VALUE_RE.test(normalized) || FAMILY_IMPERSONATION_HELP_RE.test(normalized))
  ) {
    return { kind: "friend_money", askedContext: "transfer" };
  }

  if (
    /(?:бабуш|дедуш|внук|buvim|bobom|nabira|grandmother|grandfather|grandson|granddaughter).{0,140}(?:звон|qo['’]?ng['’]?iroq|call).{0,100}(?:бед|попал|попала|муаммо|muammo|trouble)|(?:звон|qo['’]?ng['’]?iroq|call).{0,100}(?:бабуш|дедуш|buvim|bobom|grandmother|grandfather).{0,100}(?:бед|попал|muammo|trouble)|(?:семейн|oilaviy|family).{0,80}(?:чат|chat).{0,80}(?:сбор\s+денег|pul\s+yig['’]?ish|money\s+collection)|(?:сбор\s+денег|pul\s+yig['’]?ish|money\s+collection).{0,80}(?:семейн|oilaviy|family).{0,80}(?:чат|chat)|(?:мам|пап|отам|onam|otam|mother|father|friend|друг).{0,140}(?:от\s+имени\s+родствен|qarindosh.*nomidan|request\s+for\s+money).{0,100}(?:оплат|to['’]?la|pay|money|account|hisob)|request\s+for\s+money.{0,80}(?:my\s+)?friend/iu.test(
      normalized,
    )
  ) {
    return { kind: "friend_money", askedContext: "transfer" };
  }

  if (
    /(?:without\s+(?:my\s+)?permission|i\s+did\s+not\s+make|который\s+я\s+не\s+совершал|ruxsatsiz|men\s+qilmagan).{0,80}(?:payment|charge|money|плат[её]ж|списал|pul|to['’]?lov)|(?:payment|charge|плат[её]ж|списал|pul|to['’]?lov).{0,80}(?:without\s+(?:my\s+)?permission|i\s+did\s+not\s+make|который\s+я\s+не\s+совершал|ruxsatsiz|men\s+qilmagan)/iu.test(
      normalized,
    )
  ) {
    return { kind: "unauthorized_charge", askedContext: "card" };
  }

  if (
    /(?:money|funds?).{0,40}(?:was|were)\s+(?:just\s+)?(?:taken|charged|debited).{0,50}(?:card|account).{0,50}without\s+(?:my\s+)?permission/iu.test(
      normalized,
    )
  ) {
    return { kind: "unauthorized_charge", askedContext: "card" };
  }

  if (
    /(?:email|почт|аккаунт|account|akkaunt).{0,80}(?:hacked|взлом|не\s+могу\s+войти|got\s+access|buzildi|kira\s+olmay)|(?:hacked|взлом|got\s+access|buzildi).{0,80}(?:email|почт|аккаунт|account|akkaunt)/iu.test(
      normalized,
    )
  ) {
    return { kind: "account_hacked_other", askedContext: "code" };
  }

  if (
    /(?:они|they).{0,40}(?:получили\s+доступ|got\s+access).{0,60}(?:аккаунт|account)|ular.{0,40}akkauntimga\s+kirib\s+olishdi|(?:already|уже).{0,25}(?:entered|вв[её]л).{0,40}(?:password|парол).{0,60}(?:чуж|someone\s+else|begona).{0,30}(?:site|сайт)/iu.test(
      normalized,
    )
  ) {
    return { kind: "account_hacked_other", askedContext: "code" };
  }

  if (
    /(?:я\s+уже|i\s+(?:already\s+)?sent|men).{0,50}(?:отправил|sent|yubordim|yuborib\s+qo['’]?ydim).{0,50}(?:паспорт|passport|pasport|удостоверени|identity\s+document|shaxsiy\s+hujjat).{0,60}(?:незнаком|stranger|notanish|begona)|(?:я|i|men).{0,30}(?:незнаком|notanish|begona|stranger).{0,40}(?:паспорт|passport|pasport|удостоверени|identity\s+document|shaxsiy\s+hujjat).{0,40}(?:отправил|sent|yubordim|yuborib\s+qo['’]?ydim)|(?:i\s+sent|я\s+уже\s+отправил).{0,40}(?:passport\s+photo|скан\s+удостоверени).{0,40}(?:stranger|незнаком)|я\s+уже\s+отправил.{0,30}незнаком.{0,30}скан\s+удостоверени/iu.test(
      normalized,
    )
  ) {
    return { kind: "personal_data_already_shared" };
  }

  if (
    /(?:что\s+делать|как\s+(?:мне\s+)?(?:сейчас\s+)?поступить|стоит\s+ли|что\s+.{0,20}ответить|nima\s+qilay|hozir\s+qanday\s+yo['’]?l\s+tutay|javob\s+beray|qanday\s+bilaman|kerakmi|ochsam\s+bo['’]?ladimi|what\s+should\s+i\s+do|should\s+i|what\s+do\s+i\s+reply|how\s+do\s+i\s+know|can\s+i\s+open)/iu.test(
      normalized,
    )
  ) {
    return { kind: "advice_question" };
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

const VICTIM_SCENARIO_TEXT: Partial<Record<VictimScenario, Record<Lang, string>>> = {
  authority_physical_coercion: {
    ru: "Если человек от имени полиции, налоговой или другой службы заставляет вас что-то поджечь, сломать, перенести или оставить — не выполняйте это. Настоящие органы не дают тайные опасные задания через мессенджер и не угрожают делом за отказ.\n\nОтойдите от предмета или места в безопасную сторону, завершите контакт и позвоните 102. Если вы несовершеннолетний — сразу скажите родителю, учителю или другому взрослому, которому доверяете. Сохраните переписку, но не рискуйте собой ради скриншота.",
    uz: "Politsiya, soliq yoki boshqa idora nomidan biror narsani yoqish, buzish, olib borish yoki qoldirishga majburlashsa — bajarmang. Haqiqiy idoralar messenjerda maxfiy xavfli topshiriq bermaydi va rad etganingiz uchun ish ochish bilan qo'rqitmaydi.\n\nBuyum yoki joydan xavfsiz tomonga uzoqlashing, aloqani tugating va 102 ga qo'ng'iroq qiling. Voyaga yetmagan bo'lsangiz, darhol ota-ona, o'qituvchi yoki ishonchli kattaga ayting. Yozishmani saqlang, ammo skrin uchun o'zingizni xavfga qo'ymang.",
    en: "If someone claiming to be police, tax, or another authority orders you to burn, damage, carry, or leave something, do not do it. Real authorities do not issue secret dangerous tasks over a messenger or threaten a case for refusing.\n\nMove away from the object or place to somewhere safe, end contact, and call 102. If you are a minor, tell a parent, teacher, or another trusted adult immediately. Preserve the chat only if you can do so without putting yourself at risk.",
  },
  neighbor_video_malware: {
    ru: "Неожиданное «видео от соседей» или «это ты на видео?» может быть приманкой, особенно если это APK, вложенный файл или для просмотра требуют установить плеер. Имя знакомого не доказывает, что аккаунт не взломан.\n\nНе открывайте вложение и ничего не устанавливайте. Позвоните знакомому по сохранённому номеру и уточните, что он действительно отправлял. Обычное видео проверяйте по расширению: APK и файлы с двойным расширением не запускайте.",
    uz: "Qo'shni yoki tanishdan kutilmaganda kelgan «videodagi senmi?» xabari tuzoq bo'lishi mumkin, ayniqsa APK, ilova fayli yoki ko'rish uchun player o'rnatish talab qilinsa. Tanish ism akkaunt buzilmaganini isbotlamaydi.\n\nFaylni ochmang va hech narsa o'rnatmang. Tanishga saqlangan raqam orqali o'zingiz qo'ng'iroq qilib, rostdan yuborganini tekshiring. Oddiy videoning kengaytmasini ko'ring: APK va ikki kengaytmali fayllarni ishga tushirmang.",
    en: "An unexpected “video from a neighbor” or “is this you in the video?” can be bait, especially when it is an APK, attachment, or asks you to install a player. A familiar name does not prove the account is still controlled by that person.\n\nDo not open the attachment or install anything. Call the person using a saved number and ask whether they sent it. Check the extension of an ordinary video; never run an APK or a double-extension file.",
  },
  fake_fine_cashback_app: {
    ru: "APK или приложение из сообщения для оплаты штрафа, особенно с обещанием кешбэка или скидки, может быть подделкой. Логотип МВД, банка или название вроде ROAD24 не подтверждают источник.\n\nНе устанавливайте файл и не давайте доступ к SMS, уведомлениям или специальным возможностям. Проверьте штраф самостоятельно в официальном приложении или на госпортале, который открыли сами. Если APK уже установлен — включите авиарежим, отдельно выключите Wi‑Fi и мобильную связь и свяжитесь с банком с другого доверенного устройства.",
    uz: "Jarimani to'lash uchun xabarda yuborilgan APK yoki ilova, ayniqsa keshbek yoki chegirma va'da qilsa, soxta bo'lishi mumkin. IIV yoki bank logotipi va ROAD24 kabi nom manbani tasdiqlamaydi.\n\nFaylni o'rnatmang, SMS, bildirishnoma yoki maxsus imkoniyatlarga ruxsat bermang. Jarimani o'zingiz ochgan rasmiy ilova yoki davlat portalida tekshiring. APK o'rnatilgan bo'lsa, aviarejimni yoqing, Wi‑Fi va mobil aloqani alohida o'chiring va boshqa ishonchli qurilmadan bank bilan bog'laning.",
    en: "An APK or app sent in a message to pay a fine, especially with cashback or a discount, may be fake. A police or bank logo and a name such as ROAD24 do not prove its source.\n\nDo not install the file or grant SMS, notification, or accessibility access. Check the fine yourself in an official app or government portal you opened independently. If the APK is already installed, enable airplane mode, separately turn off Wi‑Fi and mobile data, and contact the bank from another trusted device.",
  },
  penalty_points_cancellation: {
    ru: "Обещание за деньги «обнулить» или удалить штрафные баллы через знакомого в дорожной службе — неофициальная и опасная сделка. Перевод посреднику не исправляет запись и может привести к новой оплате или краже данных.\n\nНе платите и не отправляйте документы. Бесплатно проверьте сведения на my.gov.uz или другом официальном сервисе; для исправления либо обжалования используйте официальную процедуру и канал уполномоченного ведомства. Сохраните переписку и реквизиты предложения.",
    uz: "Yo'l jarima ballarini pulga «o'chirish» yoki YHXBdagi tanish orqali yo'qotish va'dasi norasmiy va xavfli taklif. Vositachiga pul o'tkazish yozuvni tuzatmaydi va yana pul yoki ma'lumot talabiga olib kelishi mumkin.\n\nPul va hujjat yubormang. Ma'lumotni my.gov.uz yoki boshqa rasmiy xizmatda bepul tekshiring; tuzatish yoki shikoyat uchun vakolatli idoraning rasmiy tartibi va kanalidan foydalaning. Taklif yozishmasi va rekvizitlarini saqlang.",
    en: "An offer to wipe traffic penalty points for money or through an insider is an unofficial and risky deal. Paying an intermediary does not correct the record and may lead to further demands or data theft.\n\nDo not pay or send documents. Check the record free on my.gov.uz or another official service; use the authorized agency's official procedure and channel for a correction or appeal. Save the chat and payment details from the offer.",
  },
  known_contact_prize_link: {
    ru: "Сообщение от знакомого «я уже получил подарок банка, забирай тоже» не подтверждает приз: его аккаунт могли взломать. Ссылка на подписку или получение денег может вести к краже Telegram, банковских данных или кода.\n\nНе открывайте ссылку и позвоните знакомому по сохранённому номеру; акцию найдите сами на официальном сайте или в приложении банка. Если ввели код входа Telegram — завершите неизвестные сеансы и включите двухэтапную защиту. Если сообщили банковский OTP или данные карты — сразу позвоните в банк по официальному номеру, попросите заблокировать карту/доступ и проверить последние операции.",
    uz: "Tanishdan kelgan «men bank sovg'asini oldim, sen ham ol» xabari yutuqni tasdiqlamaydi: uning akkaunti buzilgan bo'lishi mumkin. Obuna yoki pul olish havolasi Telegram, bank ma'lumoti yoki kodni o'g'irlash uchun ishlatilishi mumkin.\n\nHavolani ochmang, tanishga saqlangan raqam orqali qo'ng'iroq qiling va aksiyani bankning rasmiy sayt yoki ilovasidan o'zingiz toping. Telegram kirish kodini kiritgan bo'lsangiz, begona seanslarni tugatib ikki bosqichli himoyani yoqing. Bank OTPsi yoki karta ma'lumotini bergan bo'lsangiz, bankka rasmiy raqam orqali darhol qo'ng'iroq qilib, karta/kirishni bloklash va so'nggi operatsiyalarni tekshirishni so'rang.",
    en: "A message from a friend saying “I got the bank gift, claim yours” does not prove there is a prize; their account may be compromised. A subscribe-or-claim link can be used to steal Telegram access, banking data, or a code.\n\nDo not open the link. Call the person using a saved number and find the promotion independently in the bank's official app or site. If you entered a Telegram login code, end unknown sessions and enable two-step verification. If you shared a banking OTP or card data, call the bank on its official number immediately and ask it to block the card/access and review recent operations.",
  },
  rental_deposit: {
    ru: "Депозит на карту до подтверждённого просмотра жилья — рискованная предоплата. Одного объявления на OLX недостаточно, чтобы подтвердить квартиру и личность владельца.\n\nПока не переводите деньги. Проверьте адрес и владельца независимо, осмотрите жильё и читайте договор до оплаты; не используйте реквизиты только из переписки.",
    uz: "Uy-joyni tasdiqlangan ko'rishdan oldin kartaga depozit yuborish — xavfli oldindan to'lov. OLXdagi e'lonning o'zi uy va egasini tasdiqlamaydi.\n\nHozircha pul o'tkazmang. Manzil va egani mustaqil tekshiring, uyni ko'ring va to'lovdan oldin shartnomani o'qing; faqat yozishmadagi rekvizitdan foydalanmang.",
    en: "A card deposit before a verified property viewing is a risky advance payment. A listing alone does not prove that the property or landlord is genuine.\n\nDo not transfer yet. Verify the address and owner independently, view the property, and read the contract before paying; do not rely only on payment details from the chat.",
  },
  game_escrow_fee: {
    ru: "Предоплата комиссии отдельному «гаранту» при продаже игрового аккаунта может быть схемой с посредником. Само слово «гарант» не защищает перевод и не подтверждает покупателя.\n\nСначала проверьте, разрешает ли платформа передачу или продажу аккаунта. Только если это разрешено, используйте её встроенную защиту сделки; отдельную комиссию не переводите и не передавайте пароль, код входа или резервные коды.",
    uz: "O'yin akkauntini sotishda alohida «vositachi»ga oldindan komissiya yuborish vositachilik firibgarligi bo'lishi mumkin. «Garant» degan nom o'tkazmani himoya qilmaydi va xaridorni tasdiqlamaydi.\n\nAvval platforma akkauntni berish yoki sotishga ruxsat berishini tekshiring. Faqat ruxsat etilgan bo'lsa, uning ichki savdo himoyasidan foydalaning; alohida komissiya yubormang, parol, kirish kodi yoki zaxira kodlarini bermang.",
    en: "An upfront fee to a separate “escrow agent” during a game-account sale may be an intermediary scam. Calling someone a guarantor does not protect the transfer or verify the buyer.\n\nFirst check whether the platform permits account transfers or sales. Only if permitted, use its built-in trade protection; do not send a separate fee or share the password, login code, or backup codes.",
  },
  fake_boss_request: {
    ru: "Странный голос или вид руководителя на видеозвонке вместе со срочным переводом — повод отдельно проверить личность. Это может быть взлом аккаунта или подмена видео/голоса, но по одному звонку это не доказано.\n\nНе переводите деньги. Позвоните руководителю по сохранённому номеру или свяжитесь через второй известный канал и получите обычное внутреннее подтверждение операции.",
    uz: "Videoqo'ng'iroqda rahbarning ovozi yoki ko'rinishi g'alati bo'lib, shoshilinch pul o'tkazish buyurilsa, shaxsni alohida tekshirish kerak. Bu akkaunt buzilishi yoki video/ovoz soxtalashtirilishi bo'lishi mumkin, ammo bitta qo'ng'iroq buning isboti emas.\n\nPul o'tkazmang. Rahbarga saqlangan raqam orqali o'zingiz qo'ng'iroq qiling yoki ikkinchi ishonchli kanal orqali bog'lanib, odatiy ichki tasdiqni oling.",
    en: "A boss who looks or sounds unusual on a video call while ordering an urgent transfer needs independent identity verification. It could be an account compromise or manipulated video or audio, but one call alone does not prove that.\n\nDo not transfer. Call the boss using a saved number or use a second known channel, then obtain the normal internal approval for the payment.",
  },
  prize_fee: {
    ru: "Если для получения выигрыша, приза или подарка сначала требуют комиссию, налог или сбор — это схема с предоплатой. Настоящий приз не выдают после перевода на чужую карту.\n\nНе платите и не подтверждайте операцию кодом. Проверьте организатора самостоятельно через официальный сайт; если вы не участвовали в розыгрыше, выигрыш выдуман.",
    uz: "Yutuq, sovg'a yoki mukofotni olishdan oldin komissiya, soliq yoki yig'im talab qilinsa — bu oldindan to'lov sxemasi. Haqiqiy mukofot begona kartaga pul o'tkazgandan keyin berilmaydi.\n\nPul to'lamang va operatsiyani kod bilan tasdiqlamang. Tashkilotchini rasmiy sayt orqali mustaqil tekshiring; tanlovda qatnashmagan bo'lsangiz, yutuq uydirma.",
    en: "If a prize, lottery win, or gift requires a commission, tax, or fee first, this is an advance-payment scheme. A real prize is not released after a transfer to someone else's card.\n\nDo not pay or approve an operation with a code. Verify the organizer independently through its official site; if you never entered, the win is fabricated.",
  },
  police_impersonation: {
    ru: "Полиция не требует переводить деньги на «безопасный счёт» и не решает уголовные дела частным переводом. Угроза «завести дело» здесь используется как давление.\n\nНе переводите деньги и завершите разговор. Проверьте обращение сами через 102 или официальный номер подразделения, найденный независимо от сообщения.",
    uz: "Politsiya «xavfsiz hisob»ga pul o'tkazishni talab qilmaydi va jinoyat ishini shaxsiy o'tkazma bilan hal qilmaydi. «Ish ochamiz» degan tahdid bu yerda bosim sifatida ishlatilmoqda.\n\nPul o'tkazmang va suhbatni tugating. Murojaatni 102 yoki xabardan mustaqil topilgan rasmiy bo'lim raqami orqali o'zingiz tekshiring.",
    en: "Police do not require transfers to a “safe account” or resolve criminal cases through a private payment. The threat to “open a case” is being used as pressure.\n\nDo not transfer money; end the conversation. Verify independently through 102 or an official department number you found yourself.",
  },
  photo_extortion: {
    ru: "Угроза рассылки личных фотографий за деньги — это вымогательство. Оплата не удаляет материалы и обычно приводит к новым требованиям.\n\nНе платите и не спорьте. Сохраните скрины угроз и профиль отправителя, затем заблокируйте его и пожалуйтесь в Telegram. Подключите близкого человека; при угрозах обратитесь в милицию по номеру 102.",
    uz: "Shaxsiy rasmlarni tarqatish bilan pul talab qilish — tovlamachilik. To'lov materiallarni o'chirmaydi va odatda yangi talablar paydo bo'lishiga olib keladi.\n\nPul to'lamang va bahslashmang. Tahdidlar hamda yuboruvchi profilining skrinlarini saqlang, keyin uni bloklab Telegramga shikoyat qiling. Yaqin insonni jalb qiling; tahdid bo'lsa 102 ga murojaat qiling.",
    en: "Threatening to distribute private photos unless you pay is extortion. Payment does not remove the material and usually leads to further demands.\n\nDo not pay or argue. Save screenshots of the threats and sender profile, then block and report the account. Involve a trusted person and contact police at 102 if you are threatened.",
  },
  fake_support: {
    ru: "Сотрудник поддержки Telegram не просит присылать пароль для «проверки аккаунта». Пароль и коды входа дают доступ к аккаунту.\n\nНичего не отправляйте. Откройте Telegram сами, проверьте Настройки → Устройства и включите двухэтапную защиту. На профиль собеседника пожалуйтесь как на поддельную поддержку.",
    uz: "Telegram qo'llab-quvvatlash xodimi «akkauntni tekshirish» uchun parol yuborishni so'ramaydi. Parol va kirish kodlari akkauntga kirish imkonini beradi.\n\nHech narsa yubormang. Telegramni o'zingiz oching, Sozlamalar → Qurilmalarni tekshiring va ikki bosqichli himoyani yoqing. Suhbatdosh profilidan soxta qo'llab-quvvatlash sifatida shikoyat qiling.",
    en: "Telegram support will not ask you to send a password to “verify the account.” Passwords and login codes can grant account access.\n\nSend nothing. Open Telegram yourself, check Settings → Devices, and enable two-step verification. Report the sender profile as fake support.",
  },
  safe_account_transfer: {
    ru: "«Безопасный счёт» для срочного перевода денег — выдуманная схема. Банк не защищает средства переводом на реквизиты, присланные в звонке или сообщении.\n\nНе переводите деньги и не подтверждайте операцию кодом. Завершите разговор и сами позвоните в банк по номеру из приложения или с обратной стороны карты.",
    uz: "Pulni shoshilinch o'tkazish uchun «xavfsiz hisob» — uydirma sxema. Bank mablag'ni qo'ng'iroq yoki xabarda berilgan rekvizitga o'tkazish orqali himoya qilmaydi.\n\nPul o'tkazmang va operatsiyani kod bilan tasdiqlamang. Suhbatni tugatib, ilova yoki kartadagi rasmiy raqam orqali bankka o'zingiz qo'ng'iroq qiling.",
    en: "A “safe account” for an urgent transfer is a fabricated scheme. A bank does not protect funds by moving them to details supplied in a call or message.\n\nDo not transfer money or approve an operation with a code. End the conversation and call the bank yourself using its app or the number on the back of the card.",
  },
  remote_access: {
    ru: "AnyDesk, TeamViewer и показ экрана дают собеседнику доступ к тому, что происходит на телефоне. Банк не просит ставить такие приложения.\n\nНе устанавливайте программу и не включайте демонстрацию экрана. Если уже дали доступ — отключите интернет, удалите разрешения приложения и свяжитесь с банком по официальному номеру.",
    uz: "AnyDesk, TeamViewer yoki ekran ko'rsatish suhbatdoshga telefondagi amallarni ko'rish va boshqarish imkonini beradi. Bank bunday ilovani o'rnatishni so'ramaydi.\n\nIlovani o'rnatmang va ekran ulashmang. Kirish bergan bo'lsangiz — internetni uzing, ilova ruxsatlarini olib tashlang va bankka rasmiy raqam orqali qo'ng'iroq qiling.",
    en: "AnyDesk, TeamViewer, or screen sharing can let the other person see and control activity on your phone. A bank will not ask you to install it.\n\nDo not install the app or share your screen. If access was already granted, disconnect the internet, remove the app's permissions, and contact the bank using its official number.",
  },
  parcel_fee: {
    ru: "Запрос отдельной оплаты за посылку или таможню нужно проверить независимо: срочность и реквизиты из сообщения не подтверждают реальный сбор.\n\nПока не платите. Проверьте номер отправления и начисление на официальном сайте перевозчика или таможни, который вы открыли сами, либо позвоните по найденному там номеру.",
    uz: "Posilka yoki bojxona uchun alohida to'lov so'rovini mustaqil tekshirish kerak: shoshilinchlik va xabardagi rekvizit haqiqiy bojni tasdiqlamaydi.\n\nHozircha to'lamang. Jo'natma raqami va bojni o'zingiz ochgan tashuvchi yoki bojxonaning rasmiy saytida tekshiring yoxud o'sha yerdagi raqamga qo'ng'iroq qiling.",
    en: "A separate parcel or customs payment request needs independent verification: urgency and payment details from the message do not prove that the charge is genuine.\n\nDo not pay yet. Check the tracking number and charge on the carrier's or customs authority's official site opened independently, or call the number listed there.",
  },
  recovery_fee: {
    ru: "Предложение вернуть уже потерянные деньги за предоплату или комиссию может быть повторной попыткой обмана. Само обещание юриста или «службы возврата» не доказывает, что они способны вернуть средства.\n\nНе платите заранее. Проверьте специалиста и организацию независимо, сохраните новое предложение и сначала обратитесь в свой банк и полицию только по официальным каналам.",
    uz: "Oldin yo'qotilgan pulni oldindan haq yoki komissiya evaziga qaytarish va'dasi takroriy firibgarlik bo'lishi mumkin. Yurist yoki «qaytarish xizmati»ning va'dasi pulni qaytara olishini isbotlamaydi.\n\nOldindan to'lamang. Mutaxassis va tashkilotni mustaqil tekshiring, yangi taklifni saqlang va avval bankingiz hamda politsiyaga faqat rasmiy kanallar orqali murojaat qiling.",
    en: "An offer to recover money already lost in exchange for an upfront fee may be a second scam attempt. A lawyer's or “recovery service's” promise does not prove that they can recover the funds.\n\nDo not pay upfront. Verify the professional and organization independently, save the new offer, and contact your bank and police through official channels first.",
  },
  marketplace_delivery: {
    ru: "Ссылка «курьера» от покупателя с просьбой ввести данные карты — типичная подмена доставки на маркетплейсе.\n\nНе вводите номер карты, срок, CVV или SMS-код. Оформляйте доставку и получение денег только внутри официального приложения или сайта площадки.",
    uz: "Xaridor yuborgan «kuryer» havolasida karta ma'lumotini kiritish — marketpleysdagi soxta yetkazib berish sxemasiga xos.\n\nKarta ma'lumotini yubormang: raqam, amal muddati, CVV yoki SMS-kod kiritmang. Yetkazib berish va pul olishni faqat platformaning rasmiy ilovasi yoki saytida rasmiylashtiring.",
    en: "A buyer's “courier” link asking for card details is a typical fake marketplace-delivery flow.\n\nDo not enter the card number, expiry date, CVV, or SMS code. Arrange delivery and payment only inside the marketplace's official app or site.",
  },
  loan_advance_fee: {
    ru: "Комиссия заранее за одобрение кредита — сильный признак схемы с предоплатой. Настоящее решение по кредиту проверяется у самого банка или МФО.\n\nНе переводите комиссию и не подтверждайте операцию кодом. Свяжитесь с кредитором только через его официальное приложение, сайт или номер.",
    uz: "Kreditni tasdiqlash uchun oldindan komissiya so'rash — oldindan to'lov sxemasining kuchli belgisi. Haqiqiy kredit qarori bank yoki MMTning o'zida tekshiriladi.\n\nKomissiya o'tkazmang va operatsiyani kod bilan tasdiqlamang. Kredit tashkilotiga faqat rasmiy ilova, sayt yoki raqam orqali murojaat qiling.",
    en: "An advance commission to approve a loan is a strong sign of an upfront-fee scheme. A real lending decision is verified with the bank or lender itself.\n\nDo not transfer the commission or confirm an operation with a code. Contact the lender only through its official app, site, or number.",
  },
  charity_pressure: {
    ru: "Давление при сборе пожертвований и перевод на личную карту требуют отдельной проверки организатора. Срочность сама по себе не подтверждает, что деньги попадут пострадавшим.\n\nПока не переводите деньги. Найдите организацию или сбор самостоятельно, проверьте её реквизиты и отчётность через официальный источник, а не по данным из сообщения.",
    uz: "Xayriya yig'imida bosim qilish va shaxsiy kartaga o'tkazma so'rash tashkilotchini alohida tekshirishni talab qiladi. Shoshilinchlikning o'zi pul jabrlanganlarga yetishini tasdiqlamaydi.\n\nHozircha pul o'tkazmang. Tashkilot yoki yig'imni o'zingiz toping, rekvizit va hisobotini xabardagi ma'lumotdan emas, rasmiy manbadan tekshiring.",
    en: "Pressure around a donation request and payment to a personal card require independent verification of the organizer. Urgency alone does not prove that the money will reach the people affected.\n\nDo not transfer yet. Find the organization or fundraiser independently and verify its payment details and reporting through an official source, not the message.",
  },
  qr_login: {
    ru: "QR для входа в Telegram может авторизовать чужое устройство в вашем аккаунте.\n\nНе сканируйте QR, который прислал или показывает другой человек. Если уже сканировали — откройте Telegram → Устройства, завершите незнакомый сеанс и включите двухэтапную защиту.",
    uz: "Telegramga kirish QR-kodi begona qurilmani akkauntingizga ulashi mumkin.\n\nBoshqa odam yuborgan yoki ko'rsatgan QRni skanerlamang. Skanerlagan bo'lsangiz — Telegram → Qurilmalar bo'limida begona seansni tugating va ikki bosqichli himoyani yoqing.",
    en: "A Telegram login QR can authorize someone else's device in your account.\n\nDo not scan a QR sent or shown by another person. If you already scanned it, open Telegram → Devices, end the unknown session, and enable two-step verification.",
  },
  money_already_sent: {
    ru: "Если деньги уже отправлены, действуйте сейчас: позвоните в банк по номеру из приложения или с карты и попросите заморозить перевод либо операцию.\n\nСохраните чек, номер получателя и переписку, но больше ничего не переводите и не сообщайте коды. После банка обратитесь в милицию по номеру 102.",
    uz: "Pul allaqachon yuborilgan bo'lsa, hozir harakat qiling: ilova yoki kartadagi rasmiy raqam orqali bankka qo'ng'iroq qilib, o'tkazma yoki operatsiyani muzlatishni so'rang.\n\nChek, oluvchi raqami va yozishmani saqlang, ammo boshqa pul yubormang va kod aytmang. Bankdan keyin 102 orqali militsiyaga murojaat qiling.",
    en: "If the money has already been sent, act now: call the bank using the number in its app or on the card and ask it to freeze the transfer or operation.\n\nSave the receipt, recipient details, and chat, but send nothing else and share no codes. After contacting the bank, report the incident to police at 102.",
  },
  apk_already_installed: {
    ru: "Если приложение или APK уже установлены по просьбе из чата или звонка, включите авиарежим и пока не открывайте банк, почту и SMS.\n\nНа другом безопасном устройстве позвоните в банк по официальному номеру. Затем вместе с близким или специалистом отключите у приложения специальные возможности/права администратора и удалите его. Если удалить не получается — не вводите пароли и обратитесь в сервис.",
    uz: "Chat yoki qo'ng'iroqdagi so'rov bilan ilova/APK o'rnatilgan bo'lsa, aviarejimni yoqing va hozircha bank, pochta hamda SMSni ochmang.\n\nBoshqa xavfsiz qurilmadan bankka rasmiy raqam orqali qo'ng'iroq qiling. Keyin yaqin inson yoki mutaxassis bilan ilovaning maxsus imkoniyatlar/administrator ruxsatlarini o'chirib, uni olib tashlang. O'chmasa, parol kiritmang va servisga murojaat qiling.",
    en: "If an app or APK was already installed because of a chat or caller, enable airplane mode and do not open banking, email, or SMS yet.\n\nCall the bank from another safe device using its official number. Then, with a trusted person or technician, remove the app's accessibility/device-admin permissions and uninstall it. If removal fails, enter no passwords and get in-person technical help.",
  },
  telegram_account_taken_over: {
    ru: "Если в Telegram уже вошёл посторонний, откройте Telegram сами: Настройки → Устройства и завершите все незнакомые сеансы. Затем включите двухэтапную защиту и защитите привязанные номер и почту.\n\nНикому не отправляйте новый код входа. Предупредите контакты, что от вашего имени могут просить деньги или коды, и пожалуйтесь на чужие сообщения/профили.",
    uz: "Telegramga begona odam allaqachon kirgan bo'lsa, Telegramni o'zingiz oching: Sozlamalar → Qurilmalar va barcha notanish seanslarni tugating. Keyin ikki bosqichli himoyani yoqing, bog'langan raqam va pochtani himoyalang.\n\nYangi kirish kodini hech kimga yubormang. Kontaktlarni sizning nomingizdan pul yoki kod so'ralishi mumkinligi haqida ogohlantiring va begona xabar/profillardan shikoyat qiling.",
    en: "If someone is already inside your Telegram account, open Telegram yourself: Settings → Devices and end every unknown session. Then enable two-step verification and secure the linked phone number and email.\n\nDo not send anyone a new login code. Warn contacts that messages asking for money or codes may be sent in your name, and report the intruder's messages/accounts.",
  },
  telegram_channel_invite: {
    ru: "Приглашение в сомнительный Telegram-канал само по себе ещё не доказывает обман, но риск начинается с кнопок, внешних ссылок, оплаты или просьбы войти в аккаунт.\n\nНе нажимайте кнопки и ничего не оплачивайте. Пришлите @username, ссылку или скрин условий — проверю конкретные признаки канала.",
    uz: "Shubhali Telegram kanaliga taklifning o'zi hali firibgarlikni isbotlamaydi, ammo tugma, tashqi havola, to'lov yoki akkauntga kirish so'rovi xavf tug'diradi.\n\nTugmalarni bosmang va hech narsa to'lamang. Kanalning @username'i, havolasi yoki shartlar skrinini yuboring — aniq belgilarni tekshiraman.",
    en: "An invitation to a suspicious Telegram channel is not proof by itself, but buttons, external links, payments, or account-login requests create risk.\n\nDo not press buttons or pay anything. Send the channel @username, link, or a screenshot of its terms and I will check the specific signals.",
  },
};

export function buildVictimIntentText(match: VictimIntentMatch, lang: Lang): string {
  const scenarioText = match.scenario ? VICTIM_SCENARIO_TEXT[match.scenario]?.[lang] : undefined;
  if (scenarioText) return scenarioText;

  const byKind: Record<VictimIntentKind, Record<Lang, string>> = {
    emotional_help: {
      ru: "Я рядом. Давайте спокойно разберёмся. Пока ничего не отправляйте и не оплачивайте.\n\nЧто происходит прямо сейчас: вам звонят, прислали ссылку или файл, просят код, данные карты либо перевод? Нажмите подходящую кнопку ниже или напишите одной фразой.",
      uz: "Men yoningizdaman. Keling, vaziyatni xotirjam aniqlaymiz. Hozircha hech narsa yubormang va to'lamang.\n\nHozir nima bo'lyapti: qo'ng'iroq qilishyaptimi, havola yoki fayl yuborishdimi, kod, karta ma'lumoti yoxud pul so'rashyaptimi? Pastdagi tugmani bosing yoki bir jumla bilan yozing.",
      en: "I am here with you. Let us work through this calmly. Do not send or pay anything yet.\n\nWhat is happening right now: are they calling, did they send a link or file, or are they asking for a code, card data, or transfer? Tap a button below or write one short sentence.",
    },
    general_scam_concern: {
      ru: "Хорошо, что вы решили проверить. Пока ничего не отправляйте и не оплачивайте.\n\nНапишите, что именно вас просят сделать: назвать код, дать данные карты, перевести деньги, установить APK, открыть ссылку/QR или просто продолжить общение?",
      uz: "Tekshirishga qaror qilganingiz yaxshi. Hozircha hech narsa yubormang va to'lamang.\n\nSizdan aynan nima so'rashyapti: kod aytish, karta ma'lumotini berish, pul o'tkazish, APK o'rnatish, havola/QRni ochish yoki shunchaki suhbatni davom ettirishmi?",
      en: "It is good that you decided to check. Do not send or pay anything yet.\n\nTell me what they are asking you to do: share a code, give card data, send money, install an APK, open a link/QR, or simply keep chatting?",
    },
    advice_question: {
      ru: "Безопасный шаг сейчас: не отправляйте код, карту, пароль, фото документов и деньги.\n\nПришлите коротко, что именно случилось или что вас просят сделать. Если уже отправили код/деньги — нажмите «Помощь сейчас».",
      uz: "Hozir xavfsiz qadam: kod, karta, parol, hujjat rasmi yoki pul yubormang.\n\nNima bo'lganini yoki sizdan nima so'ralganini qisqa yozing. Kod/pul yuborgan bo'lsangiz — «🆘 Shoshilinch qadamlar» tugmasini bosing.",
      en: "Safe step now: do not send codes, card data, passwords, document photos, or money.\n\nBriefly send what happened or what they ask you to do. If you already sent a code/money, press “Help now”.",
    },
    unknown_contact: {
      ru: "Незнакомец сам по себе ещё не доказательство. Главное — что он просит.\n\nНе отправляйте код, деньги, карту или документы. Пришлите его сообщение, @username/ссылку или нажмите ниже, если он просит конкретное действие.",
      uz: "Notanish odamning o'zi hali dalil emas. Muhimi — u nima so'rayapti.\n\nKod, pul, karta yoki hujjat yubormang. Uning xabarini, @username/havolani yuboring yoki aniq so'rov bo'lsa pastdagi tugmani bosing.",
      en: "A stranger alone is not proof. What matters is what they ask for.\n\nDo not send codes, money, card data, or documents. Send their message, @username/link, or tap below if they ask for a specific action.",
    },
    unknown_call: {
      ru: "Если звонит незнакомый номер — безопаснее не продолжать разговор под давлением.\n\nЕсли звонок ещё идёт, спокойно завершите его. Не называйте код, карту, паспортные данные и не переводите деньги. Пришлите номер с экрана — я проверю публичные признаки.",
      uz: "Notanish raqam qo'ng'iroq qilsa — bosim ostida suhbatni davom ettirmaslik xavfsizroq.\n\nQo'ng'iroq davom etsa, xotirjam tugating. Kod, karta, pasport ma'lumoti aytmang va pul o'tkazmang. Ekrandagi raqamni yuboring — ochiq belgilarni tekshiraman.",
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
    personal_data_already_shared: {
      ru: "Документы уже отправлены — сейчас важно снизить риск.\n\n1. Прекратите контакт и сохраните переписку и профиль.\n2. Если вместе с документом отправляли логин, пароль или код — немедленно смените их и включите двухфакторную защиту.\n3. Свяжитесь с банком и органом, выдавшим документ, только по официальным каналам: уточните блокировку или замену документа и контроль заявок на кредит.\nЕсли документ уже используют или требуют деньги — сообщите в милицию по номеру 102.",
      uz: "Hujjatlar allaqachon yuborilgan — endi xavfni kamaytirish kerak.\n\n1. Aloqani to'xtating, yozishma va profilni saqlang.\n2. Hujjat bilan login, parol yoki kod ham yuborilgan bo'lsa — darhol almashtiring va ikki bosqichli himoyani yoqing.\n3. Bank va hujjatni bergan idoraga faqat rasmiy kanal orqali murojaat qiling: hujjatni bloklash yoki almashtirish va kredit arizalarini nazorat qilishni aniqlashtiring.\nHujjat ishlatilayotgan bo'lsa yoki pul talab qilishsa — 102 ga xabar bering.",
      en: "The documents have already been shared — reduce the risk now.\n\n1. Stop contact and save the chat and profile.\n2. If you also shared a login, password, or code, change it immediately and enable two-factor protection.\n3. Contact your bank and the authority that issued the document through official channels: ask about blocking or replacing it and monitoring credit applications.\nIf the document is already being used or someone demands money, report it to the police on 102.",
    },
    friend_money: {
      ru: "Если «друг» или близкий срочно просит деньги — сначала подтвердите личность другим каналом.\n\nНе переводите и не передавайте наличные курьеру. Позвоните по сохранённому номеру или спросите семейное кодовое слово/личный вопрос.",
      uz: "«Do'st» yoki yaqin inson shoshilinch pul so'rasa — avval boshqa kanal orqali shaxsini tasdiqlang.\n\nPul o'tkazmang va kuryerga naqd bermang. Saqlangan raqamga qo'ng'iroq qiling yoki oilaviy kod so'z/shaxsiy savol so'rang.",
      en: "If a “friend” or relative urgently asks for money, verify their identity through another channel first.\n\nDo not transfer money or hand cash to a courier. Call the saved number or ask a family code word/personal question.",
    },
    utility_impersonation: {
      ru: "Водоканал, газ, свет, Suvsoz или «умный счётчик» проверяем только через официальный районный отдел.\n\nНе диктуйте паспорт, ПИНФЛ, SMS-код и не платите по ссылке. Завершите звонок и перезвоните сами по номеру из квитанции, сайта или приложения.",
      uz: "Suvsoz, gaz, elektr yoki «aqlli hisoblagich»ni faqat rasmiy tuman bo'limi orqali tekshiring.\n\nPasport, JSHSHIR/PINFL, SMS-kod aytmang va havola orqali to'lamang. Qo'ng'iroqni tugating va kvitansiya, sayt yoki ilovadagi raqamga o'zingiz qo'ng'iroq qiling.",
      en: "Water, gas, electricity, Suvsoz, or “smart meter” requests should be checked only through the official local office.\n\nDo not share passport data, ID number, SMS code, or pay by link. End the call and call back using the number from a bill, site, or app.",
    },
    pension_benefit: {
      ru: "Перерасчёт пенсии, субсидия, пособие или грант не оформляются через передачу SMS-кода или данных карты человеку в чате либо звонке.\n\nНе называйте код, паспорт, ПИНФЛ и данные карты. Откройте официальный личный кабинет сами или найдите контакт нужного ведомства на его официальном сайте; номер из сообщения не используйте.",
      uz: "Pensiyani qayta hisoblash, subsidiya, nafaqa yoki grant chat yoki qo'ng'iroqda boshqa odamga SMS-kod va karta ma'lumotini berish orqali rasmiylashtirilmaydi.\n\nKod, pasport, JSHSHIR/PINFL yoki karta ma'lumotini aytmang. Rasmiy kabinetni o'zingiz oching yoki idora kontaktini uning rasmiy saytidan toping; xabardagi raqamdan foydalanmang.",
      en: "A pension recalculation, benefit, subsidy, or grant is not arranged by giving an SMS code or card data to someone in a chat or call.\n\nDo not share a code, passport, ID number, or card data. Open the official account yourself or find the agency's contact on its official website; do not use a number from the message.",
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
    accidental_transfer_outgoing: {
      ru: "Если вы сами ошиблись получателем, это ещё не означает мошенничество. Важно не делать второй перевод и не пытаться решать вопрос по реквизитам из чужого сообщения.\n\nСразу обратитесь в банк или платёжный сервис через официальный канал, сообщите время, сумму и получателя и спросите, доступен ли отзыв перевода. Сохраните чек и реквизиты. Возврат не гарантирован: доступную процедуру определит банк или сервис.",
      uz: "Pulni o'zingiz xato oluvchiga yuborgan bo'lsangiz, bu hali firibgarlik degani emas. Ikkinchi o'tkazma qilmang va begona xabardagi rekvizit orqali masalani hal qilmang.\n\nBank yoki to'lov xizmatiga rasmiy kanal orqali darhol murojaat qiling, vaqt, summa va oluvchini ayting hamda o'tkazmani qaytarib chaqirish mavjudligini so'rang. Chek va rekvizitni saqlang. Qaytarish kafolatlanmaydi; mavjud tartibni bank yoki xizmat aytadi.",
      en: "If you chose the wrong recipient yourself, that does not by itself mean fraud. Do not make a second transfer or use payment details from an unsolicited message to fix it.\n\nContact your bank or payment service immediately through an official channel, provide the time, amount, and recipient, and ask whether transfer recall is available. Save the receipt and details. Recovery is not guaranteed; the bank or service will explain the available procedure.",
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
      ru: "Бесплатные бонусы, игровая валюта или подарок ребёнку часто ведут к коду, аккаунту или вымогательству.\n\nНе вводите код и не переходите в сторонний чат. Покупки и бонусы проверяйте только во встроенном официальном магазине или инструментах самой игры и с согласием родителя. Завершите переписку, сохраните скрин и спокойно обсудите это с ребёнком.",
      uz: "Bolaga bepul bonus, o'yin valyutasi yoki sovg'a ko'pincha kod, akkaunt yoki qo'rqitishga olib boradi.\n\nKod kiritmang va begona chatga o'tmang. Xarid va bonuslarni faqat o'yinning rasmiy ichki do'koni yoki vositalarida, ota-ona roziligi bilan tekshiring. Yozishmani tugating, skrin saqlang va bola bilan xotirjam gaplashing.",
      en: "Free bonuses, game currency, or gifts for a child often lead to codes, account theft, or extortion.\n\nDo not enter a code or move to a third-party chat. Check purchases and bonuses only through the game's official built-in store or tools and with parental consent. End the chat, save a screenshot, and talk with the child calmly.",
    },
    silent_call: {
      ru: "Если звонят и молчат — завершите вызов. Сам по себе короткий ответ не даёт доступ к счетам, но продолжать разговор с неизвестным номером незачем.\n\nНе сообщайте личные данные и коды, не нажимайте цифры по инструкции звонящего и не перезванивайте на неизвестный номер. При повторных звонках заблокируйте его.",
      uz: "Qo'ng'iroq qilib jim turishsa, qo'ng'iroqni tugating. Qisqa javobning o'zi hisoblaringizga kirish bermaydi, ammo noma'lum raqam bilan suhbatni davom ettirish shart emas.\n\nShaxsiy ma'lumot va kod aytmang, qo'ng'iroq qiluvchi aytgan raqamlarni bosmang va noma'lum raqamga qayta qo'ng'iroq qilmang. Takrorlansa, raqamni bloklang.",
      en: "If a caller stays silent, end the call. A short spoken answer alone does not grant access to your accounts, but there is no reason to continue with an unknown caller.\n\nDo not share personal data or codes, press keypad options on their instruction, or call the unknown number back. Block it if the calls repeat.",
    },
    official_impersonation: {
      ru: "Госорган, МВД, суд, налоговая или инспектор не должны требовать код, карту, паспорт, наличные или скрывать «операцию» от семьи и банка в личном чате. Требование никому не говорить — приём изоляции, а не доказательство официального расследования.\n\nЗавершите контакт. Не платите и ничего не передавайте; проверьте обращение сами через 102, официальный номер, сайт или личное обращение.",
      uz: "Davlat idorasi, IIB, sud, soliq yoki inspektor shaxsiy chatda kod, karta, pasport, naqd pul talab qilmasligi yoki «operatsiya»ni oila va bankdan sir saqlashni buyurmasligi kerak. Hech kimga aytmaslik talabi — rasmiy tergov isboti emas, izolyatsiya usuli.\n\nAloqani tugating. Pul to'lamang va hech narsa bermang; murojaatni 102, rasmiy raqam, sayt yoki shaxsan mustaqil tekshiring.",
      en: "A government body, police, court, tax office, or inspector should not demand codes, card data, documents, cash, or secrecy from family and the bank in a private chat. An order to tell no one is isolation, not proof of an official investigation.\n\nEnd the contact. Do not pay or send anything; verify independently through 102, an official number, website, or in person.",
    },
    coercive_secrecy: {
      ru: "Просьба скрыть перевод от банка, семьи или близких — сильный признак давления и изоляции. Настоящая операция не требует обманывать банк или придумывать для него другую причину.\n\nНе переводите деньги и не следуйте готовой версии для банка. Завершите контакт и сами позвоните в банк по номеру с карты или из приложения. Если уже перевели — сохраните чек и сразу попросите банк заморозить или оспорить операцию.",
      uz: "O'tkazmani bank, oila yoki yaqinlardan yashirish talabi — bosim va izolyatsiyaning kuchli belgisi. Haqiqiy operatsiya bankni aldashni yoki unga boshqa sabab aytishni talab qilmaydi.\n\nPul o'tkazmang va bank uchun tayyorlab berilgan yolg'on izohni aytmang. Aloqani tugating, karta yoki ilovadagi rasmiy raqam orqali bankka o'zingiz qo'ng'iroq qiling. Pul yuborilgan bo'lsa — chekni saqlang va operatsiyani muzlatish yoki e'tiroz qilishni darhol so'rang.",
      en: "Being told to hide a transfer from the bank, family, or someone you trust is a strong sign of pressure and isolation. A legitimate transaction does not require you to mislead the bank or use a cover story.\n\nDo not transfer money or follow a prepared explanation for the bank. End the contact and call the bank yourself using the number on your card or in its app. If you already paid, save the receipt and immediately ask the bank to freeze or dispute the transaction.",
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
    authority_physical_coercion: {
      ru: "Не выполняйте опасное или незаконное «задание» от человека, который представляется полицией, налоговой или другой службой. Отойдите в безопасное место, завершите контакт и позвоните 102.\n\nЕсли вы несовершеннолетний — сразу сообщите родителю, учителю или другому взрослому, которому доверяете. Не трогайте и не переносите предметы; сохраняйте переписку только без риска для себя.",
      uz: "Politsiya, soliq yoki boshqa idora nomidan berilgan xavfli yoki noqonuniy «topshiriq»ni bajarmang. Xavfsiz joyga uzoqlashing, aloqani tugating va 102 ga qo'ng'iroq qiling.\n\nVoyaga yetmagan bo'lsangiz, darhol ota-ona, o'qituvchi yoki ishonchli kattaga ayting. Buyumlarga tegmang va ularni ko'chirmang; yozishmani faqat o'zingizga xavf tug'dirmasa saqlang.",
      en: "Do not carry out a dangerous or illegal “task” from someone claiming to be police, tax, or another authority. Move to a safe place, end contact, and call 102.\n\nIf you are a minor, tell a parent, teacher, or another trusted adult immediately. Do not touch or move objects; preserve the chat only when doing so does not put you at risk.",
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
      ru: "Не платите заранее за вакансию, обучение, форму, активацию или доступ к работе. Не отправляйте карту или документы и не устанавливайте присланное приложение. Работа/лёгкий доход становятся особенно рискованными, когда просят заплатить до договора или оформления. Это сильный признак риска, но сам по себе он не доказывает мошенничество.\n\nПопросите название компании, официальный сайт и договор. Пришлите текст вакансии, ссылку или условия без личных данных.",
      uz: "Oldindan vakansiya, o'qish, forma, faollashtirish yoki ishga kirish uchun pul to'lamang. Karta yoki hujjat yubormang va yuborilgan ilovani o'rnatmang. Shartnoma yoki rasmiy ishga qabuldan oldin pul so'rash — kuchli xavf belgisi, ammo o'zi firibgarlikni isbotlamaydi.\n\nKompaniya nomi, rasmiy sayt va shartnomani so'rang. Vakansiya matni, havola yoki shartlarni shaxsiy ma'lumotsiz yuboring.",
      en: "Do not pay upfront for a vacancy, training, a uniform, activation, or access to a job. Do not send card data or documents, and do not install an app they provide. Asking for payment before a contract or formal onboarding is a strong risk signal, but not proof of fraud.\n\nAsk for the company name, official website, and contract. Send the vacancy text, link, or terms without personal data.",
    },
    earning_channel: {
      ru: "Канал или бот с быстрым заработком — риск. Часто сначала просят нажать кнопку, перейти по ссылке, ввести код, карту или оплатить «доступ».\n\nПока не переходите и ничего не вводите. Пришлите ссылку, username или скрин условий.",
      uz: "Tez daromad va'da qiladigan kanal yoki bot — xavf. Ko'pincha avval tugmani bosish, havolaga o'tish, kod/karta kiritish yoki «kirish» uchun to'lashni so'rashadi.\n\nHozircha o'tmang va hech narsa kiritmang. Havola, username yoki shartlar skrinini yuboring.",
      en: "A channel or bot promising fast income is risky. It often starts with pressing a button, opening a link, entering a code/card, or paying for “access”.\n\nDo not open it or enter anything yet. Send the link, username, or screenshot of the terms.",
    },
    task_scam: {
      ru: "Заработок за лайки, просмотры или простые задания с требованием пополнить баланс для вывода — типичная ловушка: цифры на экране не означают, что деньги реально ваши.\n\nНе пополняйте баланс и не платите «комиссию» за вывод. Сохраните скрины заданий, кабинета и переписки; если уже платили картой — звоните в банк по официальному номеру.",
      uz: "Layk, ko'rish yoki oddiy topshiriqlar uchun daromad va pulni yechishdan oldin balans to'ldirish talabi — odatiy tuzoq: ekrandagi raqamlar haqiqiy pul ekanini bildirmaydi.\n\nBalansni to'ldirmang va pul yechish uchun «komissiya» to'lamang. Topshiriqlar, kabinet va yozishma skrinlarini saqlang; karta bilan to'lagan bo'lsangiz, bankka rasmiy raqam orqali qo'ng'iroq qiling.",
      en: "Earnings for likes, views, or simple tasks that require a balance top-up before withdrawal are a common trap: an on-screen balance does not mean the money is real.\n\nDo not top up or pay a withdrawal “fee”. Save screenshots of the tasks, account, and chat; if you already paid by card, call your bank using its official number.",
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
      ru: "Связывайтесь с банком только через номер в приложении, на карте или на официальном сайте. Номер, который продиктовал звонящий, не используйте.\n\nПроверенные короткие номера: NBU — 1344; Капиталбанк — 1340; Ипак Йули Банк — 1296; АНОРБАНК — 1290; UZCARD — 1257.\n\nЕсли уже назвали код, CVV/PIN или перевели деньги — срочно просите банк заблокировать карту/операцию.",
      uz: "Bank bilan faqat ilova, karta yoki rasmiy saytdagi raqam orqali bog'laning. Qo'ng'iroq qilgan odam aytgan raqamdan foydalanmang.\n\nTekshirilgan qisqa raqamlar: NBU — 1344; Kapitalbank — 1340; Ipak Yo'li Bank — 1296; ANORBANK — 1290; UZCARD — 1257.\n\nKod, CVV/PIN aytgan yoki pul o'tkazgan bo'lsangiz — bankdan karta/operatsiyani zudlik bilan bloklashni so'rang.",
      en: "Contact the bank only through the number in the app, on the card, or on the official website. Do not use a number dictated by the caller.\n\nVerified short numbers: NBU — 1344; Kapitalbank — 1340; Ipak Yuli Bank — 1296; ANORBANK — 1290; UZCARD — 1257.\n\nIf you already shared a code, CVV/PIN, or transferred money, urgently ask the bank to block the card/operation.",
    },
    report_question: {
      ru: "Если уже ушли деньги или код — сначала банк: попросите заблокировать карту/операцию. Затем можно обратиться в полицию/102 и сохранить чеки, номера, ссылки и переписку.\n\nЧтобы предупредить других через Ishonch Guard, нажмите «Сообщить случай» или пришлите номер, ссылку, username и короткое описание.",
      uz: "Pul yoki kod ketgan bo'lsa — avval bank: karta/operatsiyani bloklashni so'rang. Keyin politsiya/102 ga murojaat qiling va chek, raqam, havola, yozishmalarni saqlang.\n\nIshonch Guard orqali boshqalarni ogohlantirish uchun «Xabar berish» tugmasini bosing yoki raqam, havola, username va qisqa tavsif yuboring.",
      en: "If money or a code was already sent, call the bank first and ask to block the card/operation. Then contact police/102 and save receipts, numbers, links, and chat history.\n\nTo warn others through Ishonch Guard, tap “Report” or send the number, link, username, and a short description.",
    },
    violence_threat: {
      ru: "Угроза приехать или применить силу — это вопрос физической безопасности. Не оценивайте сами, блеф это или нет.\n\n1. Не платите и не соглашайтесь на встречу; перейдите в безопасное место.\n2. Позвоните в милицию — 102. Сохраните скрины угроз, номер и username, если это можно сделать безопасно.\n3. Сразу расскажите близкому человеку и не оставайтесь с угрозой один на один.\nЕсли угрожают из-за фото или переписки, оплата всё равно не гарантирует прекращение шантажа.",
      uz: "Kelib qolish yoki kuch ishlatish tahdidi — jismoniy xavfsizlik masalasi. Bu blefmi yoki yo'qmi, o'zingiz baholamang.\n\n1. Pul to'lamang va uchrashuvga rozi bo'lmang; xavfsiz joyga o'ting.\n2. 102 ga qo'ng'iroq qiling. Xavfsiz bo'lsa, tahdid skrinlari, raqam va username'ni saqlang.\n3. Darhol yaqin insonga ayting va tahdid bilan yolg'iz qolmang.\nRasm yoki yozishma bilan tahdid qilishsa ham, to'lov shantaj tugashini kafolatlamaydi.",
      en: "A threat to come to you or use force is a physical-safety issue. Do not try to decide on your own whether it is a bluff.\n\n1. Do not pay or agree to meet; move somewhere safe.\n2. Call police on 102. Save the threats, number, and username only if it is safe to do so.\n3. Tell a trusted person immediately and do not face the threat alone.\nIf the threat involves photos or chats, payment still does not guarantee the extortion will stop.",
    },
    withdrawal_blocked: {
      ru: "Похоже на ловушку с выводом средств, если новый «налог», «комиссию» или «верификацию» требуют перевести на личную карту либо оплатить по реквизитам из чата. Наличие такой оплаты в кабинете само по себе не доказывает обман, но её нужно проверить независимо.\n\n1. Пока больше ничего не платите и не пополняйте баланс.\n2. Сохраните скрины кабинета, баланса и переписки с «поддержкой» или «наставником».\n3. Проверьте условия на официальном сайте, найденном самостоятельно; если платили картой — позвоните в банк по официальному номеру.\nПришлите ссылку платформы или @username наставника — проверю признаки.",
      uz: "Yangi «soliq», «komissiya» yoki «verifikatsiya»ni shaxsiy kartaga yoxud chatdagi rekvizitga to'lash talab qilinsa, bu pul yechish tuzog'iga o'xshaydi. Kabinetda to'lov ko'rsatilishining o'zi firibgarlikni isbotlamaydi, ammo uni mustaqil tekshirish kerak.\n\n1. Hozircha boshqa hech narsa to'lamang va balans to'ldirmang.\n2. Kabinet, balans va «ustoz» yoki «qo'llab-quvvatlash» bilan yozishma skrinlarini saqlang.\n3. Shartlarni o'zingiz topgan rasmiy saytda tekshiring; karta bilan to'lagan bo'lsangiz, bankka rasmiy raqam orqali qo'ng'iroq qiling.\nPlatforma havolasini yoki ustozning @username'ini yuboring — belgilarini tekshiraman.",
      en: "This looks like a withdrawal trap when a new “tax”, “fee”, or “verification” must be sent to a personal card or payment details supplied in chat. A displayed fee alone is not proof of fraud, but it needs independent verification.\n\n1. Do not pay or top up anything else yet.\n2. Save screenshots of the account, balance, and chats with “support” or the “mentor”.\n3. Check the terms on an official site you find independently; if you paid by card, call your bank using its official number.\nSend the platform link or the mentor's @username and I will check the signs.",
    },
    identity_loan: {
      ru: "Если кредит или займ оформили на ваше имя без вас — решается это по официальной линии, платить тому, кто пишет или звонит, не нужно.\n\n1. Позвоните в банк/МФО, где оформлен кредит, по официальному номеру: заявите о мошенническом оформлении.\n2. Подайте заявление в милицию (102) — оно нужно для оспаривания долга.\n3. Проверьте свою кредитную историю в кредитном бюро и смените пароли от банковских приложений.\nСохраните все SMS и документы. Напишите, просили ли у вас до этого код, паспорт или фото документов.",
      uz: "Kredit yoki qarz sizning nomingizga sizsiz rasmiylashtirilgan bo'lsa — bu rasmiy yo'l bilan hal qilinadi, yozayotgan yoki qo'ng'iroq qilayotganga pul to'lash kerak emas.\n\n1. Kredit rasmiylashtirilgan bank/MFTga rasmiy raqam orqali qo'ng'iroq qiling: firibgarlik haqida bildiring.\n2. Militsiyaga ariza bering (102) — qarzni bekor qilish uchun kerak bo'ladi.\n3. Kredit byurosida kredit tarixingizni tekshiring va bank ilovalari parollarini almashtiring.\nBarcha SMS va hujjatlarni saqlang. Oldin sizdan kod, pasport yoki hujjat rasmi so'ralganmi — yozing.",
      en: "If a loan was opened in your name without you, it is resolved through official channels — do not pay whoever writes or calls.\n\n1. Call the bank/lender where the loan was opened using the official number and report fraudulent registration.\n2. File a police report (102) — you will need it to dispute the debt.\n3. Check your credit history at the credit bureau and change your banking app passwords.\nSave all SMS and documents. Tell me if anyone asked you for a code, passport, or document photos before this.",
    },
    unauthorized_charge: {
      ru: "Списание, которого вы не делали — повод сразу действовать через банк, а не через того, кто пишет или звонит.\n\n1. Позвоните в банк по официальному номеру: оспорьте операцию и при необходимости заблокируйте карту.\n2. Платные SMS-подписки отключаются у мобильного оператора — позвоните оператору по официальному номеру.\n3. Никому не называйте код из SMS «для отмены списания» — так крадут остальное.\nПришлите текст SMS без кода — проверю признаки.",
      uz: "Siz qilmagan yechib olish — bank orqali darhol harakat qilish sababi, yozayotgan yoki qo'ng'iroq qilayotgan odam orqali emas.\n\n1. Bankka rasmiy raqam orqali qo'ng'iroq qiling: operatsiyani e'tiroz bildiring, kerak bo'lsa kartani bloklang.\n2. Pullik SMS-obunalar mobil operatorda o'chiriladi — operatorga rasmiy raqam orqali qo'ng'iroq qiling.\n3. «Yechib olishni bekor qilish» uchun SMS-koddan hech kimga aytmang — shunday qilib qolganini o'g'irlashadi.\nSMS matnini kodsiz yuboring — belgilarini tekshiraman.",
      en: "A charge you did not make means acting through the bank right away, not through whoever writes or calls.\n\n1. Call the bank using the official number: dispute the operation and block the card if needed.\n2. Paid SMS subscriptions are cancelled through your mobile operator — call the operator's official number.\n3. Never share an SMS code “to cancel the charge” — that is how the rest gets stolen.\nSend the SMS text without the code and I will check the signs.",
    },
    account_hacked_other: {
      ru: "Возвращаем доступ и закрываем чужой вход:\n\n1. С другого устройства запустите восстановление пароля («Забыли пароль») — доступ вернётся через привязанную почту или номер.\n2. Сразу включите двухфакторную защиту и завершите чужие сеансы в настройках.\n3. Проверьте привязанную почту: если она тоже взломана — сначала верните её.\n4. Предупредите друзей: от вашего имени могут просить деньги или коды.\nЕсли от вашего имени уже просят деньги — пришлите скрин, помогу составить предупреждение.",
      uz: "Kirishni qaytaramiz va begona kirishni yopamiz:\n\n1. Boshqa qurilmadan parolni tiklashni boshlang («Parolni unutdingizmi») — kirish bog'langan pochta yoki raqam orqali qaytadi.\n2. Darhol ikki bosqichli himoyani yoqing va sozlamalarda begona seanslarni tugating.\n3. Bog'langan pochtani tekshiring: u ham buzilgan bo'lsa — avval uni qaytaring.\n4. Do'stlaringizni ogohlantiring: sizning nomingizdan pul yoki kod so'rashlari mumkin.\nSizning nomingizdan pul so'rashayotgan bo'lsa — skrin yuboring, ogohlantirish matnini tuzishga yordam beraman.",
      en: "Let's restore access and close the intruder's session:\n\n1. From another device, start password recovery (“Forgot password”) — access returns through the linked email or number.\n2. Enable two-factor protection right away and end unknown sessions in settings.\n3. Check the linked email: if it is also hacked, recover it first.\n4. Warn your friends: someone may ask them for money or codes in your name.\nIf money is already being requested in your name, send a screenshot and I will help write a warning.",
    },
    scammer_recontact: {
      ru: "Если тот же человек выходит на связь с нового номера или аккаунта — не отвечайте и не спорьте: любая реакция показывает, что канал активен.\n\n1. Заблокируйте новый номер или аккаунт и сохраните скрин.\n2. Пришлите номер или @username сюда для проверки; чтобы оформить сообщение о случае, используйте кнопку «Сообщить случай».\n3. Если появились угрозы или требования денег — напишите, дам следующий безопасный шаг.",
      uz: "O'sha odam yangi raqam yoki akkauntdan chiqsa, javob bermang va bahslashmang: har qanday javob kanal faol ekanini ko'rsatadi.\n\n1. Yangi raqam yoki akkauntni bloklang va skrin saqlang.\n2. Raqam yoki @username'ni tekshirish uchun shu yerga yuboring; holat haqida xabar berish uchun «Xabar berish» tugmasidan foydalaning.\n3. Tahdid yoki pul talabi paydo bo'lsa, yozing — keyingi xavfsiz qadamni aytaman.",
      en: "If the same person contacts you from a new number or account, do not reply or argue; any reaction shows that the channel is active.\n\n1. Block the new number or account and save a screenshot.\n2. Send the number or @username here for a check; use the “Report” button if you want to submit the incident.\n3. If threats or money demands appear, write to me for the next safe step.",
    },
    privacy_question: {
      ru: "Полный исходный номер или URL не сохраняется в базе Ishonch Guard в открытом виде. Для повторного сопоставления и защиты от злоупотреблений могут сохраняться отпечаток (хеш), маскированное отображение номера или имя хоста ссылки. Распознанные коды и данные карт вырезаются перед сохранением.\n\nСообщение сначала проходит через Telegram и техническую инфраструктуру бота. Если анализ изображений включён, снимок может быть передан настроенному AI/vision-провайдеру для текущей проверки; исходные байты изображения локально не сохраняются и не добавляются в базу жалоб. Поэтому не присылайте настоящий SMS-код, PIN, CVV, пароль, сид-фразу или полное фото документа. Публикация жалобы возможна только обезличенно и после модерации.",
      uz: "To'liq asl raqam yoki URL Ishonch Guard bazasida ochiq ko'rinishda saqlanmaydi. Qayta moslashtirish va suiiste'moldan himoya uchun iz (hash), raqamning niqoblangan ko'rinishi yoki havola hosti saqlanishi mumkin. Aniqlangan kod va karta ma'lumoti saqlashdan oldin olib tashlanadi.\n\nXabar avval Telegram va botning texnik infratuzilmasidan o'tadi. Rasm tahlili yoqilgan bo'lsa, joriy tekshiruv uchun surat sozlangan AI/vision provayderiga uzatilishi mumkin; rasmning asl baytlari lokal saqlanmaydi va shikoyatlar bazasiga qo'shilmaydi. Shuning uchun haqiqiy SMS-kod, PIN, CVV, parol, seed ibora yoki hujjatning to'liq rasmini yubormang. Shikoyat faqat shaxssiz va moderatsiyadan keyin e'lon qilinishi mumkin.",
      en: "The full original number or URL is not stored in clear text in the Ishonch Guard database. For repeat matching and abuse prevention, the system may retain a fingerprint (hash), a masked number display, or the link hostname. Detected codes and card data are removed before storage.\n\nThe message first passes through Telegram and the bot's technical infrastructure. If image analysis is enabled, an image may be sent to the configured AI/vision provider for the current check; its original bytes are not stored locally or added to the reports database. Never send a real SMS code, PIN, CVV, password, seed phrase, or full document photo. A report can be published only after anonymization and moderation.",
    },
    relative_already_paid: {
      ru: "Если близкий уже перевёл деньги или назвал код — сейчас дорога каждая минута, действуйте вместе с ним.\n\n1. Позвоните вместе в его банк по официальному номеру: попросите заморозить перевод или заблокировать карту.\n2. Сохраните чеки, номера, переписку — это доказательства.\n3. Подайте заявление в милицию — 102.\nНе ругайте близкого: стыд мешает жертвам просить помощь. Подключите «Семейный щит» в меню — в следующий раз бот предупредит вас сразу.",
      uz: "Yaqiningiz allaqachon pul o'tkazgan yoki kod aytgan bo'lsa — har bir daqiqa muhim, u bilan birga harakat qiling.\n\n1. Birga uning bankiga rasmiy raqam orqali qo'ng'iroq qiling: o'tkazmani muzlatish yoki kartani bloklashni so'rang.\n2. Chek, raqam va yozishmalarni saqlang — bular dalil.\n3. Militsiyaga ariza bering — 102.\nYaqiningizni koyimang: uyat jabrlanuvchilarga yordam so'rashga xalaqit beradi. Menyudan «Oila qalqoni»ni ulang — keyingi safar bot sizni darhol ogohlantiradi.",
      en: "If a loved one has already transferred money or shared a code, every minute counts — act together with them.\n\n1. Call their bank together using the official number: ask to freeze the transfer or block the card.\n2. Save receipts, numbers, and chats — they are evidence.\n3. File a police report — 102.\nDo not scold your loved one: shame stops victims from asking for help. Enable Family Shield in the menu so the bot warns you immediately next time.",
    },
    blackmail_threat: {
      ru: "Это вымогательство. Платить нельзя: оплата не удаляет материалы и обычно ведёт к новым требованиям.\n\nНе отвечайте и не переводите деньги. Сохраните скрины переписки и профиль отправителя, затем заблокируйте его и пожалуйтесь в Telegram. Если тяжело одному — подключите близкого человека. Пошаговая помощь есть в /panic.",
      uz: "Bu tovlamachilik. Pul to'lash mumkin emas: to'lov materiallarni o'chirmaydi va odatda yangi talablarga olib keladi.\n\nJavob bermang va pul o'tkazmang. Yozishma skrinlarini va yuboruvchi profilini saqlang, keyin uni bloklang va Telegramga shikoyat qiling. Yolg'iz og'ir bo'lsa — yaqin insonni jalb qiling. Bosqichma-bosqich yordam /panic da bor.",
      en: "This is extortion. Do not pay: payment does not delete the material and usually leads to new demands.\n\nDo not reply or send money. Save screenshots of the chat and the sender's profile, then block them and report to Telegram. If it feels heavy alone, involve a trusted person. Step-by-step help is in /panic.",
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
      ru: "Я — Ishonch Guard, бесплатный защитный бот. Я не читаю ваши чаты сам и не прошу коды, PIN, CVV, пароли или деньги.\n\nЧтобы помочь, пришлите номер, ссылку, username, скриншот или коротко: что вас просят сделать.",
      uz: "Men — Ishonch Guard, bepul himoya botiman. Chatlaringizni o'zim o'qimayman va kod, PIN, CVV, parol yoki pul so'ramayman.\n\nYordam berishim uchun raqam, havola, username, skrinshot yoki qisqa yozing: sizdan nima so'rashyapti.",
      en: "I am Ishonch Guard, a free safety bot. I do not read your chats by myself and I do not ask for codes, PINs, CVVs, passwords, or money.\n\nTo help, send a number, link, username, screenshot, or briefly what they ask you to do.",
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
      ru: "Код никому не называйте. Это может быть вход в банк, Telegram или подтверждение операции.\n\nСейчас ничего не отправляйте и проверьте просьбу только через официальный канал.",
      uz: "Kodni hech kimga aytmang. Bu bank, Telegram kirishi yoki operatsiyani tasdiqlash bo'lishi mumkin.\n\nHozir hech narsa yubormang va so'rovni faqat rasmiy kanal orqali tekshiring.",
      en: "Do not tell anyone the code. It can log in to your bank/Telegram or confirm an operation.\n\nSend nothing now and verify the request only through an official channel.",
    },
    card: {
      ru: "Данные карты, CVV, PIN, фото карты и SMS-коды не отправляем.\n\nНастоящий банк не просит это в чате или по звонку. Если уже отправили данные — блокируйте карту через банк; если назвали код — сообщите об этом банку.",
      uz: "Karta ma'lumotlari, CVV, PIN, karta rasmi va SMS-kodlarni yubormaymiz.\n\nHaqiqiy bank buni chatda yoki qo'ng'iroqda so'ramaydi. Ma'lumot yuborgan bo'lsangiz — bank orqali kartani bloklang; kodni aytgan bo'lsangiz, bankka xabar bering.",
      en: "Do not send card data, CVV, PIN, card photos, or SMS codes.\n\nA real bank does not ask for this in chat or on a call. If you sent card data, block the card through the bank; if you shared a code, tell the bank.",
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
      ru: "Если звонок ещё идёт — спокойно завершите его.\n\nСкажите: «Я завершаю звонок и перезвоню по официальному номеру». Потом проверьте номер/просьбу здесь.",
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
    case "coercive_secrecy":
    case "money_mule":
    case "accidental_transfer_outgoing":
      return "transfer";
    case "apk_request":
    case "apple_security":
      return "apk";
    case "link_request":
    case "link_received":
    case "telegram_takeover":
    case "earning_channel":
    case "task_scam":
      return "link_qr";
    case "bank_call":
    case "operator_call":
    case "unknown_call":
    case "foreign_call":
    case "authority_impersonation":
    case "authority_physical_coercion":
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
