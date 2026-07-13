import type { Lang } from "@/lib/i18n";
import { classifyMetaIntent, getMetaIntentResponse, type MetaIntent } from "@/lib/meta-intent";
import { evaluateText, scoreFromCodes, type ReasonCode } from "@/lib/risk/rules";
import {
  buildLastCheckFollowUpText,
  buildLastCheckSnapshot,
  classifyLastCheckFollowUp,
  type LastCheckFollowUpAction,
} from "@/lib/telegram/check-followup";
import { formatCheckResult } from "@/lib/telegram/format";
import {
  canonicalFollowUpIntentId,
  canonicalMetaIntentId,
  canonicalPanicIntentId,
  canonicalVictimIntentId,
  type CanonicalTelegramIntentId,
} from "@/lib/telegram/intent-contract";
import { buildPanicScenarioText, type PanicScenarioId } from "@/lib/telegram/emergency";
import type { LastCheckSnapshot } from "@/lib/telegram/session.server";
import { classifyLiveCallContext, classifyTextPanicIntent } from "@/lib/telegram/text-panic-intent";
import {
  buildVictimIntentText,
  classifyVictimIntent,
  type VictimIntentKind,
} from "@/lib/telegram/victim-intent";

/**
 * Deterministic, synthetic and completely offline QA corpus. It neither calls
 * an AI/reputation provider nor trains a model. The rows are composed test
 * conversations, not a claim that 540 live Telegram users were interviewed.
 */
export const EVERYDAY_DIALOGUE_CATEGORIES = [
  "scam_concern",
  "help_now",
  "active_code_pressure",
  "active_transfer_pressure",
  "link_or_file_received",
  "unknown_call",
  "family_targeted",
  "already_happened",
  "what_to_do",
  "why_result",
  "challenge_result",
  "capabilities",
  "greetings_and_thanks",
  "mixed_clause_trap",
  "neutral_word_trap",
] as const;

type FiveSeeds = readonly [Seed, Seed, Seed, Seed, Seed];

const EXTRA_SEEDS: Readonly<Record<EverydayDialogueCategory, Readonly<Record<Lang, FiveSeeds>>>> = {
  scam_concern: {
    ru: [
      v("Мне кажется, этот человек хочет меня обмануть.", "general_scam_concern"),
      v("Я думаю, что попал в переписку с мошенниками.", "general_scam_concern"),
      v("Это всё похоже на развод, и я не знаю, верить ли им.", "general_scam_concern"),
      v("Не понимаю, почему меня так торопят — это мошенничество?", "general_scam_concern"),
      v("Со мной связался мошенник или я зря переживаю?", "general_scam_concern"),
    ],
    uz: [
      v("Menimcha, bu firibgarlik.", "general_scam_concern"),
      v("Menga yozayotgan odam firibgarga o'xshaydi.", "general_scam_concern"),
      v("Meni aldayaptilar, deb gumon qilyapman.", "general_scam_concern"),
      v("Bu rost gapmi yoki firib?", "general_scam_concern"),
      v("Men bilan gaplashayotgan kishi scammer bo'lishi mumkin.", "general_scam_concern"),
    ],
    en: [
      v("I suspect this person is trying to scam me.", "general_scam_concern"),
      v("Could this whole conversation be a fraud?", "general_scam_concern"),
      v("I think the person messaging me is a scammer.", "general_scam_concern"),
      v("Someone may be setting me up for a scam.", "general_scam_concern"),
      v("I cannot tell if this offer is genuine or fraudulent.", "general_scam_concern"),
    ],
  },
  help_now: {
    ru: [
      v("Я в панике, не могу спокойно подумать.", "emotional_help"),
      v("Мне плохо от этой ситуации, помогите.", "emotional_help"),
      v("Я волнуюсь и боюсь сделать хуже.", "emotional_help"),
      v("Мне нужна помощь, я один не справляюсь.", "emotional_help"),
      v("Я запуталась и не понимаю, кому верить.", "emotional_help"),
    ],
    uz: [
      v("Yordam kerak, bu vaziyat meni qo'rqityapti.", "emotional_help"),
      v("Juda qo'rqyapman, xato qilib qo'yishdan xavotirdaman.", "emotional_help"),
      v("Nima qilishni bilmayman, boshim qotib qoldi.", "emotional_help"),
      v("Iltimos, menga yordam bering, o'zim hal qila olmayapman.", "emotional_help"),
      v("Yordam bering, bu gaplardan sarosimaga tushdim.", "emotional_help"),
    ],
    en: [
      v("Help me, I cannot think clearly.", "emotional_help"),
      v("I am scared I might make things worse.", "emotional_help"),
      v("I don't know what to do next.", "emotional_help"),
      v("Please help me before I answer them.", "emotional_help"),
      v("I am scared and need someone to guide me.", "emotional_help"),
    ],
  },
  active_code_pressure: {
    ru: [
      v("Курьер просит код из уведомления, чтобы отдать посылку.", "code_request"),
      v("Меня просят переслать сообщение с одноразовым паролем целиком.", "code_request"),
      v("Во время звонка мне велят прочитать код подтверждения вслух.", "code_request"),
      v("Меня просят показать код на экране во время видеозвонка.", "code_request"),
      v("Мне сказали сообщить OTP, чтобы отменить заявку.", "code_request"),
    ],
    uz: [
      v("Kuryer posilkani berish uchun SMS kodni so'rayapti.", "code_request"),
      v(
        "Mendan bir martalik parol bor xabarni boshqa chatga yuborishni so'rashdi.",
        "code_request",
      ),
      v(
        "Qo'ng'iroqdagi odam tasdiqlash kodini ovoz chiqarib aytishimni so'rayapti.",
        "code_request",
      ),
      v("Kodni ekranda ko'rsatishimni talab qilishyapti.", "code_request"),
      v("Arizani bekor qilish uchun OTPni berishim kerak deyishyapti.", "code_request"),
    ],
    en: [
      v("They ask me for the SMS code before handing over the parcel.", "code_request"),
      v("They want me to forward the entire message containing the one-time code.", "code_request"),
      v("A caller tells me to read the confirmation code aloud.", "code_request"),
      v("They asked me to show the verification code on camera.", "code_request"),
      v("They say I must provide an OTP to cancel a request.", "code_request"),
    ],
  },
  active_transfer_pressure: {
    ru: [
      v("Меня просят отправить деньги на незнакомый кошелёк.", "transfer_request"),
      v("Мне сказали оплатить по реквизитам из чата.", "transfer_request"),
      v("Они хотят, чтобы я разделил сумму на несколько переводов.", "transfer_request"),
      v("Собеседник просит меня оплатить чужой счёт.", "transfer_request"),
      v("Мне велят перевести деньги через платёжный терминал.", "transfer_request"),
    ],
    uz: [
      v("Mendan begona hamyonga pul yuborishni so'rashyapti.", "transfer_request"),
      v("Ular chatdagi rekvizitlarga to'lov qilishimni aytishyapti.", "transfer_request"),
      v("Pulni bir necha o'tkazmaga bo'lib yuborishim kerak deyishyapti.", "transfer_request"),
      v("Suhbatdosh o'rniga hisobni men to'lashimni so'rayapti.", "transfer_request"),
      v("Menga terminal orqali pul o'tkazing deyishdi.", "transfer_request"),
    ],
    en: [
      v("They ask me to send money to a wallet I do not know.", "transfer_request"),
      v("Someone told me to pay using the details in the chat.", "transfer_request"),
      v("They want me to split the amount into several transfers.", "transfer_request"),
      v("The caller needs me to pay a bill for them.", "transfer_request"),
      v("They told me to move the money through a payment terminal.", "transfer_request"),
    ],
  },
  link_or_file_received: {
    ru: [
      v("Мне отправили ссылку якобы на отслеживание посылки.", "link_received"),
      v("Неизвестный аккаунт прислал мне короткую ссылку.", "link_received"),
      v("Мне дали ссылку и сказали заново войти в профиль.", "link_received"),
      v("Я получил документ с неизвестным расширением.", "file_received"),
      v("Мне прислали PDF, который я не ожидал.", "file_received"),
    ],
    uz: [
      v("Menga posilkani kuzatish uchun havola yuborishdi.", "link_received"),
      v("Notanish akkaunt menga qisqa link jo'natdi.", "link_received"),
      v("Menga profilga qayta kirish uchun havola berishdi.", "link_received"),
      v("Men kengaytmasi noma'lum fayl oldim.", "file_received"),
      v("Menga kutmagan PDF hujjati keldi.", "file_received"),
    ],
    en: [
      v("They sent me a link that supposedly tracks a parcel.", "link_received"),
      v("An unknown account gave me a shortened link.", "link_received"),
      v("Someone sent a link and said I must sign in again.", "link_received"),
      v("I received a file with an extension I do not recognize.", "file_received"),
      v("They sent me a PDF I was not expecting.", "file_received"),
    ],
  },
  unknown_call: {
    ru: [
      v("Неизвестный абонент звонит мне поздно вечером.", "unknown_call"),
      v("Мне несколько раз звонили с разных незнакомых номеров.", "unknown_call"),
      v("Незнакомый номер звонит один раз и сразу сбрасывает.", "unknown_call"),
      v("Когда я отвечаю, в трубке никто ничего не говорит.", "silent_call"),
      v("У меня пропущенный вызов с зарубежного номера.", "foreign_call"),
    ],
    uz: [
      v("Kechasi notanish raqam menga qo'ng'iroq qilyapti.", "unknown_call"),
      v("Menga turli noma'lum raqamlardan qayta-qayta qo'ng'iroq qilishdi.", "unknown_call"),
      v("Notanish raqam bir marta jiringlatib, darrov uzib qo'yadi.", "unknown_call"),
      v("Telefonni ko'tarsam, narigi tomonda hech kim gapirmaydi.", "silent_call"),
      v("Menda chet el raqamidan o'tkazib yuborilgan qo'ng'iroq bor.", "foreign_call"),
    ],
    en: [
      v("A hidden number keeps calling me late at night.", "unknown_call"),
      v("I received several calls from different unknown numbers.", "unknown_call"),
      v("An unfamiliar caller rings once and hangs up.", "unknown_call"),
      v("When I answer, nobody says anything.", "silent_call"),
      v("I have a missed call from a foreign number.", "foreign_call"),
    ],
  },
  family_targeted: {
    ru: [
      v("Дедушке позвонили от имени соседа и попросили занять денег.", "friend_money"),
      v("Сыну пишет якобы одноклассник и просит срочно скинуть деньги.", "friend_money"),
      v("Дочери прислали голосовое от имени подруги с просьбой помочь переводом.", "friend_money"),
      v("Папе написал родственник и попросил оплатить чужой счёт.", "friend_money"),
      v("Другу пришла просьба перевести деньги со знакомого аккаунта.", "friend_money"),
    ],
    uz: [
      v("Bobomga qo'shnisi nomidan qo'ng'iroq qilib qarz so'rashdi.", "friend_money"),
      v("O'g'limga sinfdoshi bo'lib yozib, tezda pul yuborishni so'rashyapti.", "friend_money"),
      v("Qizimga dugonasining ovozida pul so'rab xabar kelibdi.", "friend_money"),
      v("Otamga qarindoshi nomidan begona hisobni to'lashni aytishibdi.", "friend_money"),
      v("Do'stimga tanish akkauntdan pul o'tkazish iltimosi keldi.", "friend_money"),
    ],
    en: [
      v(
        "Someone called my grandfather pretending to be a neighbor and asked to borrow money.",
        "friend_money",
      ),
      v("A classmate is messaging my son and asking for an urgent transfer.", "friend_money"),
      v(
        "My daughter received a voice message in her friend's voice asking for money.",
        "friend_money",
      ),
      v("A relative is asking my father to pay an unfamiliar bill.", "friend_money"),
      v("A request for money came to my friend from an account they recognize.", "friend_money"),
    ],
  },
  already_happened: {
    ru: [
      v("Дедушка уже снял деньги и отдал их незнакомому курьеру.", "relative_already_paid"),
      v("Сестра уже сообщила им код подтверждения.", "relative_already_paid"),
      v("С моей карты прошёл платёж, который я не совершал.", "unauthorized_charge"),
      v("Мою почту взломали, и я больше не могу войти.", "account_hacked_other"),
      v("Я уже отправил незнакомцу скан удостоверения личности.", "personal_data_already_shared"),
    ],
    uz: [
      v("Bobom pulni yechib, notanish kuryerga berib yubordi.", "relative_already_paid"),
      v("Singlim tasdiqlash kodini ularga aytib bo'ldi.", "relative_already_paid"),
      v("Hisobimdan men qilmagan to'lov o'tibdi.", "unauthorized_charge"),
      v("Emailim buzildi va endi unga kira olmayapman.", "account_hacked_other"),
      v(
        "Men begona odamga shaxsiy hujjatim nusxasini yuborib qo'ydim.",
        "personal_data_already_shared",
      ),
    ],
    en: [
      v(
        "My grandfather already withdrew the money and handed it to a stranger.",
        "relative_already_paid",
      ),
      v("My sister already gave them the confirmation code.", "relative_already_paid"),
      v("A payment I did not make appeared on my card.", "unauthorized_charge"),
      v("My email was hacked and I can no longer sign in.", "account_hacked_other"),
      v(
        "I already sent a copy of my identity document to someone I do not know.",
        "personal_data_already_shared",
      ),
    ],
  },
  what_to_do: {
    ru: [
      v("Что делать, если я уже ответил?", "advice_question"),
      v("Нужно ли блокировать этот номер?", "advice_question"),
      v("Можно ли доверять этому сообщению?", "advice_question"),
      v("Как понять, безопасно ли продолжать разговор?", "advice_question"),
      v("Что мне им ответить, если они снова напишут?", "advice_question"),
    ],
    uz: [
      v("Agar ularga javob bergan bo'lsam, nima qilay?", "advice_question"),
      v("Bu odamga javob beraymi yoki bloklaymi?", "advice_question"),
      v("Bu xabar xavfsizligini qanday bilaman?", "advice_question"),
      v("Ular yana yozsa, nima qilay?", "advice_question"),
      v("Hozir aloqani uzaymi yoki javob beraymi?", "advice_question"),
    ],
    en: [
      v("What should I do if I already replied?", "advice_question"),
      v("Should I block this number?", "advice_question"),
      v("How do I know if this message is safe?", "advice_question"),
      v("Should I stop the conversation now?", "advice_question"),
      v("What do I reply if they contact me again?", "advice_question"),
    ],
  },
  why_result: {
    ru: [
      f("Почему проверка показала подозрительный результат?", "explain"),
      f("Почему ты не называешь это безопасным?", "explain"),
      f("По каким признакам ты определяешь риск?", "methodology"),
      f("На чём основан этот результат?", "methodology"),
      f("Какие источники ты использовал?", "methodology"),
    ],
    uz: [
      f("Nega tekshiruv shubhali natija ko'rsatdi?", "explain"),
      f("Nima uchun buni xavfsiz deb bo'lmaydi?", "explain"),
      f("Bu nimaga asoslangan?", "methodology"),
      f("Qaysi dalillardan foydalandingiz?", "methodology"),
      f("Ma'lumotni qanday tahlil qilasiz?", "methodology"),
    ],
    en: [
      f("Why did this receive a suspicious rating?", "explain"),
      f("Why can this not be called safe?", "explain"),
      f("What evidence did you use?", "methodology"),
      f("What is this verdict based on?", "methodology"),
      f("How do you analyze a message like this?", "methodology"),
    ],
  },
  challenge_result: {
    ru: [
      f("Вы действительно уверены в этой оценке?", "confidence"),
      f("Ты ошибся: это безопасное сообщение.", "disagreement"),
      f("Проверь это ещё раз.", "recheck"),
      f("Тогда можно позвонить маме?", "trusted_person"),
      f("Какой следующий шаг?", "next_steps"),
    ],
    uz: [
      f("Ishonchingiz komilmi?", "confidence"),
      f("Siz xato qildingiz, bu xavfsiz.", "disagreement"),
      f("Qayta tekshiring.", "recheck"),
      f("Yaqin odamim bilan maslahatlashsam bo'ladimi?", "trusted_person"),
      f("Keyin nima qilay?", "next_steps"),
    ],
    en: [
      f("How sure are you?", "confidence"),
      f("You may be wrong about this result.", "disagreement"),
      f("Can you double-check this?", "recheck"),
      f("Should I show this to my family?", "trusted_person"),
      f("What next?", "next_steps"),
    ],
  },
  capabilities: {
    ru: [
      m("Сможешь проанализировать веб-страницу?", "can_check_link"),
      m("Можно загрузить фото для проверки?", "can_check_image"),
      m("Принимаешь текст письма для анализа?", "can_check_message"),
      m("Можешь посмотреть Telegram-профиль?", "can_check_account"),
      m("Проверяешь QR-коды на скриншотах?", "can_check_qr"),
    ],
    uz: [
      m("Sayt manzilini tahlil qila olasizmi?", "can_check_link"),
      m("Rasmni tekshirishga yuborsam bo'ladimi?", "can_check_image"),
      m("Xabar matnini ko'rib bera olasizmi?", "can_check_message"),
      m("Telegram profilini tekshirib berasizmi?", "can_check_account"),
      m("Telefon raqamini yuborish mumkinmi?", "can_check_phone"),
    ],
    en: [
      m("Could you inspect a website?", "can_check_link"),
      m("May I upload a photo for review?", "can_check_image"),
      m("Does this bot review message text?", "can_check_message"),
      m("Are you able to assess a Telegram profile?", "can_check_account"),
      m("Do you check QR codes?", "can_check_qr"),
    ],
  },
  greetings_and_thanks: {
    ru: [
      m("Доброе утро, бот.", "greeting"),
      m("Добрый вечер.", "greeting"),
      v("Спасибо.", "acknowledgement"),
      v("Понятно.", "acknowledgement"),
      v("Готово.", "acknowledgement"),
    ],
    uz: [
      m("Xayrli tong.", "greeting"),
      m("Xayrli kech, do'stim.", "greeting"),
      v("Rahmat.", "acknowledgement"),
      v("Tushunarli.", "acknowledgement"),
      v("Mayli.", "acknowledgement"),
    ],
    en: [
      m("Good morning, bot.", "greeting"),
      m("Good evening.", "greeting"),
      v("Thank you.", "acknowledgement"),
      v("Okay.", "acknowledgement"),
      v("Done.", "acknowledgement"),
    ],
  },
  mixed_clause_trap: {
    ru: [
      r("Ваш заказ уже упакован, теперь продиктуйте код из SMS.", "asks_for_sms_code"),
      r("В анкете всё заполнено, пришлите CVV банковской карты.", "asks_for_card_cvv"),
      r("Регистрация почти закончена, отправьте фото паспорта.", "requests_personal_data"),
      r("Мы проверили версию телефона, установите защитный APK.", "asks_to_install_apk"),
      r("Сначала обсудим заявку, затем откройте AnyDesk и покажите экран.", "asks_to_share_screen"),
    ],
    uz: [
      r("Buyurtmangiz tayyor, endi SMS kodni ayting.", "asks_for_sms_code"),
      r("Ariza to'ldirildi, kartaning CVV kodini yuboring.", "asks_for_card_cvv"),
      r("Ro'yxatdan o'tish tugayapti, pasport rasmini yuboring.", "requests_personal_data"),
      r("Telefon modeli mos ekan, himoya APK faylini o'rnating.", "asks_to_install_apk"),
      r(
        "Avval arizani muhokama qilamiz, keyin AnyDeskni ochib ekranni ko'rsating.",
        "asks_to_share_screen",
      ),
    ],
    en: [
      r("Your order is packed, now read out the code from the SMS.", "asks_for_sms_code"),
      r("The form is complete, send the CVV from your bank card.", "asks_for_card_cvv"),
      r(
        "Registration is almost finished, send a photo of your passport.",
        "requests_personal_data",
      ),
      r("Your phone version is supported, install the protection APK.", "asks_to_install_apk"),
      r(
        "We can discuss the application first, then open AnyDesk and show your screen.",
        "asks_to_share_screen",
      ),
    ],
  },
  neutral_word_trap: {
    ru: [
      r("Купон-код указан на чеке, а код из SMS пришлите мне.", "asks_for_sms_code"),
      r(
        "В руководстве есть пример PIN-кода, но сообщите настоящий PIN вашей карты.",
        "asks_for_pin",
      ),
      r(
        "На музейном билете есть QR для аудиогида, а для входа в банк отсканируйте QR из чата.",
        "asks_to_scan_qr",
      ),
      r(
        "В документации указан тестовый адрес, теперь пришлите адрес проживания и фото паспорта.",
        "requests_personal_data",
      ),
      r(
        "В таблице есть поле payment, а CVV банковской карты отправьте в чат.",
        "asks_for_card_cvv",
      ),
    ],
    uz: [
      r("Chegirma kodi chekda yozilgan, SMS kodni esa menga ayting.", "asks_for_sms_code"),
      r(
        "Darslikda PIN kodi misol sifatida berilgan, lekin kartangizning haqiqiy PINini operatorga ayting.",
        "asks_for_pin",
      ),
      r(
        "Muzey chiptasida audiogid uchun QR bor, bankka kirish uchun chatdagi QRni skaner qiling.",
        "asks_to_scan_qr",
      ),
      r(
        "Qo'llanmada sinov manzili bor, endi yashash manzilingiz va pasport rasmini yuboring.",
        "requests_personal_data",
      ),
      r(
        "Jadvalda payment degan ustun bor, bank kartangizning CVV kodini chatga yuboring.",
        "asks_for_card_cvv",
      ),
    ],
    en: [
      r(
        "The coupon code is printed on the receipt, but send me the code from the SMS.",
        "asks_for_sms_code",
      ),
      r(
        "The tutorial shows a sample PIN, but tell the operator your real card PIN.",
        "asks_for_pin",
      ),
      r(
        "The museum ticket has a QR for the audio guide, but scan the QR from the chat to enter your bank.",
        "asks_to_scan_qr",
      ),
      r(
        "The manual contains a sample address, now send your home address and a photo of your passport.",
        "requests_personal_data",
      ),
      r(
        "The spreadsheet has a payment column, but send your bank card CVV in the chat.",
        "asks_for_card_cvv",
      ),
    ],
  },
};

export type EverydayDialogueCategory = (typeof EVERYDAY_DIALOGUE_CATEGORIES)[number];

type Seed =
  | { text: string; family: "victim"; intent: VictimIntentKind }
  | { text: string; family: "meta"; intent: MetaIntent }
  | { text: string; family: "followup"; action: LastCheckFollowUpAction }
  | { text: string; family: "risk"; reasons: readonly ReasonCode[] };

type SevenSeeds = readonly [Seed, Seed, Seed, Seed, Seed, Seed, Seed];

interface CategorySpec {
  category: EverydayDialogueCategory;
  seeds: Readonly<Record<Lang, SevenSeeds>>;
}

export interface EverydayDialogueTurn {
  utterance: string;
  route: CanonicalTelegramIntentId;
  response: string;
  family: "victim" | "meta" | "followup" | "panic" | "risk";
  expectedIntent?: VictimIntentKind | MetaIntent;
  expectedAction?: LastCheckFollowUpAction;
  expectedPanicId?: PanicScenarioId;
  expectedReasons?: readonly ReasonCode[];
}

export interface EverydayDialogue {
  id: string;
  category: EverydayDialogueCategory;
  lang: Lang;
  first: EverydayDialogueTurn;
  followUp: EverydayDialogueTurn;
  lastCheck?: LastCheckSnapshot;
}

const CONVERSATIONAL_FOLLOW_UP_SEEDS: Readonly<Record<Lang, readonly Seed[]>> = {
  ru: [
    m("Как пользоваться ботом?", "how_to_use"),
    m("Что мне отправить для проверки?", "how_to_use"),
    m("Что ты умеешь?", "what_can_you_do"),
    m("Какие функции есть у бота?", "what_can_you_do"),
    m("Ты можешь проверить ссылку?", "can_check_link"),
    m("Ты можешь проверить номер телефона?", "can_check_phone"),
    m("Ты можешь проверить скриншот?", "can_check_image"),
    m("Ты можешь проверить Telegram-аккаунт?", "can_check_account"),
    m("Ты можешь проверить сообщение?", "can_check_message"),
    m("Ты можешь проверить QR-код?", "can_check_qr"),
    v("Что мне делать?", "advice_question"),
    v("Как мне поступить?", "advice_question"),
    m("Мне нужна помощь.", "help"),
    m("Помощь", "help"),
    m("Привет, бот!", "greeting"),
  ],
  uz: [
    m("Bu botdan qanday foydalanaman?", "how_to_use"),
    m("Qanday foydalanaman?", "how_to_use"),
    m("Nima qila olasan?", "what_can_you_do"),
    m("Bot nima qiladi?", "what_can_you_do"),
    m("Havolani tekshira olasizmi?", "can_check_link"),
    m("Telefon raqamini tekshira olasizmi?", "can_check_phone"),
    m("Skrinshotni tekshira olasizmi?", "can_check_image"),
    m("Telegram akkauntini tekshira olasizmi?", "can_check_account"),
    m("Xabar matnini tekshira olasizmi?", "can_check_message"),
    m("QR-kodni tekshira olasizmi?", "can_check_qr"),
    v("Nima qilay?", "advice_question"),
    v("Endi nima qilay?", "advice_question"),
    m("Menga yordam kerak.", "help"),
    m("Yordam", "help"),
    m("Salom, bot!", "greeting"),
  ],
  en: [
    m("How do I use this bot?", "how_to_use"),
    m("What should I send for a check?", "how_to_use"),
    m("What can you do?", "what_can_you_do"),
    m("How do you check?", "how_do_you_check"),
    m("Can you check a link?", "can_check_link"),
    m("Can you check a phone number?", "can_check_phone"),
    m("Can you check a screenshot?", "can_check_image"),
    m("Can you check a Telegram account?", "can_check_account"),
    m("Can you check a message?", "can_check_message"),
    m("Can you check a QR code?", "can_check_qr"),
    v("What should I do?", "advice_question"),
    v("How should I proceed?", "advice_question"),
    m("I need help.", "help"),
    m("Help", "help"),
    m("Hello, bot!", "greeting"),
  ],
};

const RESULT_FOLLOW_UP_SEEDS: Readonly<Record<Lang, readonly Seed[]>> = {
  ru: [
    f("Ты уверен?", "confidence"),
    f("А точно?", "confidence"),
    f("Это точно?", "confidence"),
    f("Вы действительно уверены в этой оценке?", "confidence"),
    f("Как ты это проверил?", "methodology"),
    f("Какие источники ты использовал?", "methodology"),
    f("На чём основан этот результат?", "methodology"),
    f("Почему это подозрительно?", "explain"),
    f("Объясни этот результат.", "explain"),
    f("Можно связаться с близким человеком?", "trusted_person"),
    f("Тогда можно позвонить маме?", "trusted_person"),
    f("Перепроверь ещё раз.", "recheck"),
    f("Проверь это ещё раз.", "recheck"),
    f("Я не согласен с результатом.", "disagreement"),
    f("Ты ошибся: это безопасное сообщение.", "disagreement"),
    f("Что мне делать?", "next_steps"),
    f("Какой следующий шаг?", "next_steps"),
    f("Объясни простыми словами.", "simple_explain"),
    f("Спасибо за помощь.", "acknowledgement"),
    f("Кто ты?", "identity"),
  ],
  uz: [
    f("Aniqmi?", "confidence"),
    f("Rostmi?", "confidence"),
    f("Ishonchingiz komilmi?", "confidence"),
    f("Siz bunga aniq ishonasizmi?", "confidence"),
    f("Qanday tekshirdingiz?", "methodology"),
    f("Bu nimaga asoslangan?", "methodology"),
    f("Qaysi dalillardan foydalandingiz?", "methodology"),
    f("Nega bu xavfli?", "explain"),
    f("Natijani tushuntiring.", "explain"),
    f("Yaqin odamim bilan bog'lansam bo'ladimi?", "trusted_person"),
    f("Unda yaqinimga qo'ng'iroq qilsam bo'ladimi?", "trusted_person"),
    f("Yana bir marta tekshiring.", "recheck"),
    f("Qayta tekshiring.", "recheck"),
    f("Men rozi emasman.", "disagreement"),
    f("Siz xato qildingiz.", "disagreement"),
    f("Nima qilay?", "next_steps"),
    f("Keyin nima qilay?", "next_steps"),
    f("Oddiy qilib tushuntiring.", "simple_explain"),
    f("Yordam uchun rahmat.", "acknowledgement"),
    f("Siz kimsiz?", "identity"),
  ],
  en: [
    f("Are you sure?", "confidence"),
    f("Really?", "confidence"),
    f("How sure are you?", "confidence"),
    f("Are you really sure about this?", "confidence"),
    f("How did you check it?", "methodology"),
    f("What evidence did you use?", "methodology"),
    f("What did you base that on?", "methodology"),
    f("Why is this suspicious?", "explain"),
    f("Explain this result.", "explain"),
    f("Can I contact someone close to me?", "trusted_person"),
    f("Should I show this to my family?", "trusted_person"),
    f("Can you double-check this?", "recheck"),
    f("Check this again.", "recheck"),
    f("I disagree with this result.", "disagreement"),
    f("You may be wrong about this result.", "disagreement"),
    f("What should I do?", "next_steps"),
    f("What is the next step?", "next_steps"),
    f("Explain in simple words.", "simple_explain"),
    f("Thank you for the help.", "acknowledgement"),
    f("Who are you?", "identity"),
  ],
};

const FIXED_NOW = new Date("2026-07-13T08:00:00.000Z");

const BASELINE_SCORE = scoreFromCodes(["weird_domain"]);

const BASELINE_RESULT = {
  type: "text" as const,
  display: "https://offline-check.example.xyz/login",
  level: BASELINE_SCORE.level,
  score: BASELINE_SCORE.score,
  reasons: ["weird_domain"] as ReasonCode[],
  explanation: null,
  knownReports: 0,
  verifiedContact: null,
  brandEvidence: [],
};

const BASELINE_LAST_CHECK = buildLastCheckSnapshot(BASELINE_RESULT, FIXED_NOW);

function v(text: string, intent: VictimIntentKind): Seed {
  return { text, family: "victim", intent };
}

function m(text: string, intent: MetaIntent): Seed {
  return { text, family: "meta", intent };
}

function f(text: string, action: LastCheckFollowUpAction): Seed {
  return { text, family: "followup", action };
}

function r(text: string, ...reasons: ReasonCode[]): Seed {
  return { text, family: "risk", reasons };
}

const CATEGORY_SPECS: readonly CategorySpec[] = [
  {
    category: "scam_concern",
    seeds: {
      ru: [
        v("Кажется, меня пытаются обмануть.", "general_scam_concern"),
        v("По-моему, это мошенники.", "general_scam_concern"),
        v("Не понимаю, это правда или обман?", "general_scam_concern"),
        v("У меня сейчас подозрительная переписка.", "general_scam_concern"),
        v("Мне кажется, со мной говорит мошенник.", "general_scam_concern"),
        v("Меня пытаются развести на деньги.", "general_scam_concern"),
        v("Сейчас было что-то очень похожее на обман.", "general_scam_concern"),
      ],
      uz: [
        v("Meni aldashmoqchi shekilli.", "general_scam_concern"),
        v("Menimcha, bu firibgarlar.", "general_scam_concern"),
        v("Bu rostmi yoki firibgarlikmi?", "general_scam_concern"),
        v("Hozir menda shubhali yozishma bor.", "general_scam_concern"),
        v("Men bilan firibgar gaplashayotganga o'xshaydi.", "general_scam_concern"),
        v("Mendan aldab pul olishmoqchi.", "general_scam_concern"),
        v("Hozirgina firibgarlikka o'xshash holat bo'ldi.", "general_scam_concern"),
      ],
      en: [
        v("I think someone is trying to scam me.", "general_scam_concern"),
        v("This looks like a scam to me.", "general_scam_concern"),
        v("I cannot tell whether this is real or a scam.", "general_scam_concern"),
        v("I have a suspicious conversation going on.", "general_scam_concern"),
        v("I think I am talking to a scammer.", "general_scam_concern"),
        v("They are trying to trick me out of money.", "general_scam_concern"),
        v("Something that looked like fraud just happened.", "general_scam_concern"),
      ],
    },
  },
  {
    category: "help_now",
    seeds: {
      ru: [
        v("Помогите, я растерялся.", "emotional_help"),
        v("Мне срочно нужна помощь.", "emotional_help"),
        v("Я боюсь и не знаю, что делать.", "emotional_help"),
        v("Пожалуйста, помоги мне разобраться.", "emotional_help"),
        v("Не понимаю, что сейчас происходит.", "emotional_help"),
        v("Мне страшно отвечать этому человеку.", "emotional_help"),
        v("Я запутался, объясни спокойно.", "emotional_help"),
      ],
      uz: [
        v("Yordam bering, nima qilishni bilmay qoldim.", "emotional_help"),
        v("Menga zudlik bilan yordam kerak.", "emotional_help"),
        v("Qo'rqyapman va nima qilishni bilmayman.", "emotional_help"),
        v("Iltimos, vaziyatni tushunishga yordam bering.", "emotional_help"),
        v("Hozir nima bo'layotganini tushunmayapman.", "emotional_help"),
        v("Bu odamga javob berishga qo'rqyapman.", "emotional_help"),
        v("Adashib qoldim, xotirjam tushuntiring.", "emotional_help"),
      ],
      en: [
        v("Please help, I am confused.", "emotional_help"),
        v("I need help urgently.", "emotional_help"),
        v("I am scared and do not know what to do.", "emotional_help"),
        v("Please help me understand this situation.", "emotional_help"),
        v("I do not understand what is happening right now.", "emotional_help"),
        v("I am afraid to reply to this person.", "emotional_help"),
        v("I am lost, please explain this calmly.", "emotional_help"),
      ],
    },
  },
  {
    category: "active_code_pressure",
    seeds: {
      ru: [
        v("У меня сейчас просят код из SMS.", "code_request"),
        v("Они требуют назвать шесть цифр из сообщения.", "code_request"),
        v("Мне звонят и просят продиктовать код.", "code_request"),
        v("Собеседник хочет код для подтверждения операции.", "code_request"),
        v("Меня уговаривают переслать одноразовый код.", "code_request"),
        v("Прямо сейчас пришёл код, и его просят назвать.", "code_request"),
        v("Мне сказали сообщить verification code.", "code_request"),
      ],
      uz: [
        v("Hozir mendan SMS kodni so'rashyapti.", "code_request"),
        v("Ular xabardagi olti raqamni aytishimni talab qilyapti.", "code_request"),
        v("Menga qo'ng'iroq qilib kodni ayting deyishyapti.", "code_request"),
        v("Suhbatdosh operatsiyani tasdiqlash kodini xohlayapti.", "code_request"),
        v("Bir martalik kodni yuborishga ko'ndirishyapti.", "code_request"),
        v("Hozirgina kod keldi va uni aytishimni so'rashyapti.", "code_request"),
        v("Menga verification kodni ayting deyishdi.", "code_request"),
      ],
      en: [
        v("They are asking me for an SMS code right now.", "code_request"),
        v("They demand the six digits from my message.", "code_request"),
        v("Someone is calling and asking me to read out a code.", "code_request"),
        v("The person wants a code to confirm the operation.", "code_request"),
        v("They are pressuring me to forward a one-time code.", "code_request"),
        v("A code just arrived and they want me to tell them.", "code_request"),
        v("They told me to share the verification code.", "code_request"),
      ],
    },
  },
  {
    category: "active_transfer_pressure",
    seeds: {
      ru: [
        v("Мне сейчас говорят перевести деньги.", "transfer_request"),
        v("Они торопят меня с переводом на другую карту.", "transfer_request"),
        v("У меня требуют оплатить прямо во время звонка.", "transfer_request"),
        v("Меня убеждают отправить деньги на безопасный счёт.", "transfer_request"),
        v("Собеседник просит срочно сделать перевод.", "transfer_request"),
        v("Мне велят снять деньги и передать курьеру.", "transfer_request"),
        v("Они говорят оплатить комиссию немедленно.", "transfer_request"),
      ],
      uz: [
        v("Hozir menga pul o'tkazing deyishyapti.", "transfer_request"),
        v("Ular boshqa kartaga pul yuborishga shoshiryapti.", "transfer_request"),
        v("Qo'ng'iroq paytida darhol to'lov qilishimni talab qilyapti.", "transfer_request"),
        v("Meni xavfsiz hisobga pul yuborishga ko'ndirishyapti.", "transfer_request"),
        v("Suhbatdosh zudlik bilan pul o'tkazishni so'rayapti.", "transfer_request"),
        v("Pulni yechib kuryerga berishimni aytishdi.", "transfer_request"),
        v("Ular komissiyani hozir to'lash kerak deyishyapti.", "transfer_request"),
      ],
      en: [
        v("They are telling me to transfer money now.", "transfer_request"),
        v("They are rushing me to send money to another card.", "transfer_request"),
        v("They demand payment while I am still on the call.", "transfer_request"),
        v("They are persuading me to move money to a safe account.", "transfer_request"),
        v("The person asks me to make an urgent transfer.", "transfer_request"),
        v("They told me to withdraw cash and give it to a courier.", "transfer_request"),
        v("They say I must pay a commission immediately.", "transfer_request"),
      ],
    },
  },
  {
    category: "link_or_file_received",
    seeds: {
      ru: [
        v("Мне прислали незнакомую ссылку.", "link_received"),
        v("У меня в Telegram появилась ссылка на вход.", "link_received"),
        v("Мне скинули QR и просят его открыть.", "link_received"),
        v("Незнакомец отправил файл APK.", "file_received"),
        v("Мне пришёл архив от неизвестного контакта.", "file_received"),
        v("У моей мамы появился файл с названием квитанция.apk.", "file_received"),
        v("Они прислали приложение якобы для защиты.", "file_received"),
      ],
      uz: [
        v("Menga notanish havola yuborishdi.", "link_received"),
        v("Telegramimga kirish uchun havola keldi.", "link_received"),
        v("Menga QR yuborib, uni ochishni so'rashdi.", "link_received"),
        v("Notanish odam APK fayl yubordi.", "file_received"),
        v("Menga noma'lum kontaktdan arxiv keldi.", "file_received"),
        v("Onamga kvitansiya.apk nomli fayl kelibdi.", "file_received"),
        v("Ular himoya uchun ilova yuborishdi.", "file_received"),
      ],
      en: [
        v("Someone sent me an unfamiliar link.", "link_received"),
        v("A Telegram login link appeared in my chat.", "link_received"),
        v("They sent me a QR and asked me to open it.", "link_received"),
        v("A stranger sent me an APK file.", "file_received"),
        v("I received an archive from an unknown contact.", "file_received"),
        v("My mother received a file named receipt.apk.", "file_received"),
        v("They sent an app that is supposedly for protection.", "file_received"),
      ],
    },
  },
  {
    category: "unknown_call",
    seeds: {
      ru: [
        v("Мне звонит неизвестный номер.", "unknown_call"),
        v("Они опять звонят с незнакомого номера.", "unknown_call"),
        v("У меня прямо сейчас подозрительный звонок.", "unknown_call"),
        v("Звонят и молчат в трубку.", "silent_call"),
        v("Мне звонят из другой страны.", "foreign_call"),
        v("Номер иностранный, а человек говорит про банк.", "foreign_call"),
        v("У моей мамы входящий от неизвестного человека.", "unknown_call"),
      ],
      uz: [
        v("Menga noma'lum raqam qo'ng'iroq qilyapti.", "unknown_call"),
        v("Ular yana notanish raqamdan qo'ng'iroq qilishyapti.", "unknown_call"),
        v("Hozir menda shubhali qo'ng'iroq bor.", "unknown_call"),
        v("Qo'ng'iroq qilishadi va jim turishadi.", "silent_call"),
        v("Menga chet el raqamidan qo'ng'iroq qilishyapti.", "foreign_call"),
        v("Raqam xorijniki, odam esa bank haqida gapiryapti.", "foreign_call"),
        v("Onamga noma'lum odam qo'ng'iroq qilyapti.", "unknown_call"),
      ],
      en: [
        v("An unknown number is calling me.", "unknown_call"),
        v("They are calling again from an unfamiliar number.", "unknown_call"),
        v("I have a suspicious call right now.", "unknown_call"),
        v("They call and stay silent.", "silent_call"),
        v("I am getting a call from another country.", "foreign_call"),
        v("It is a foreign number and the caller talks about my bank.", "foreign_call"),
        v("My mother is getting a call from an unknown person.", "unknown_call"),
      ],
    },
  },
  {
    category: "family_targeted",
    seeds: {
      ru: [
        v("Моей маме пишет человек и просит деньги.", "friend_money"),
        v("У моего отца якобы друг срочно просит перевод.", "friend_money"),
        v("Бабушке звонят и говорят, что внук попал в беду.", "friend_money"),
        v("Моему брату пишет знакомый с просьбой одолжить.", "friend_money"),
        v("У моей сестры просят деньги от имени подруги.", "friend_money"),
        v("Нашему родственнику звонят с голосом сына и просят помощь.", "friend_money"),
        v("У них в семейном чате появился срочный сбор денег.", "friend_money"),
      ],
      uz: [
        v("Onamga bir odam yozib pul so'rayapti.", "friend_money"),
        v("Otamdan go'yoki do'sti shoshilinch pul so'rayapti.", "friend_money"),
        v("Buvimga qo'ng'iroq qilib nabirasi muammoga tushdi deyishdi.", "friend_money"),
        v("Akamga tanishi qarz so'rab yozibdi.", "friend_money"),
        v("Opamdan dugonasi nomidan pul so'rashyapti.", "friend_money"),
        v("Qarindoshimizga o'g'lining ovozida yordam so'rab qo'ng'iroq qilishdi.", "friend_money"),
        v("Ularning oilaviy chatida shoshilinch pul yig'ish boshlandi.", "friend_money"),
      ],
      en: [
        v("Someone is messaging my mother and asking for money.", "friend_money"),
        v("A supposed friend urgently asks my father for a transfer.", "friend_money"),
        v("They called my grandmother and said her grandson was in trouble.", "friend_money"),
        v("An acquaintance is messaging my brother to borrow money.", "friend_money"),
        v("Someone asks my sister for money in her friend's name.", "friend_money"),
        v("A relative got a call in his son's voice asking for help.", "friend_money"),
        v("An urgent money collection appeared in their family chat.", "friend_money"),
      ],
    },
  },
  {
    category: "already_happened",
    seeds: {
      ru: [
        v("Моя бабушка уже перевела деньги мошенникам.", "relative_already_paid"),
        v("Мама успела назвать код из SMS.", "relative_already_paid"),
        v("У меня только что списали деньги без разрешения.", "unauthorized_charge"),
        v("Я уже ввёл пароль на чужом сайте.", "account_hacked_other"),
        v("Они получили доступ к моему аккаунту.", "account_hacked_other"),
        v("Я отправил фото паспорта незнакомцу.", "personal_data_already_shared"),
        v("Мой брат уже оплатил их комиссию.", "relative_already_paid"),
      ],
      uz: [
        v("Buvim firibgarlarga pul o'tkazib yubordi.", "relative_already_paid"),
        v("Onam SMS kodni aytib ulgurdi.", "relative_already_paid"),
        v("Kartamdan ruxsatsiz pul yechildi.", "unauthorized_charge"),
        v("Men begona saytga parolimni kiritib bo'ldim.", "account_hacked_other"),
        v("Ular akkauntimga kirib olishdi.", "account_hacked_other"),
        v("Men notanish odamga pasport rasmini yubordim.", "personal_data_already_shared"),
        v("Akam ularning komissiyasini to'lab bo'ldi.", "relative_already_paid"),
      ],
      en: [
        v("My grandmother already sent money to scammers.", "relative_already_paid"),
        v("My mother already told them the SMS code.", "relative_already_paid"),
        v("Money was just taken from my card without permission.", "unauthorized_charge"),
        v("I already entered my password on someone else's site.", "account_hacked_other"),
        v("They got access to my account.", "account_hacked_other"),
        v("I sent a passport photo to a stranger.", "personal_data_already_shared"),
        v("My brother already paid their commission.", "relative_already_paid"),
      ],
    },
  },
  {
    category: "what_to_do",
    seeds: {
      ru: [
        v("Что мне делать?", "advice_question"),
        v("Как мне сейчас поступить?", "advice_question"),
        v("Стоит ли отвечать этому человеку?", "advice_question"),
        v("Можно ли открыть то, что они прислали?", "advice_question"),
        v("Что им лучше ответить?", "advice_question"),
        v("Нужно ли мне перезванивать?", "advice_question"),
        v("Как понять, что я ещё в безопасности?", "advice_question"),
      ],
      uz: [
        v("Men nima qilay?", "advice_question"),
        v("Hozir qanday yo'l tutay?", "advice_question"),
        v("Bu odamga javob beraymi?", "advice_question"),
        v("Ular yuborgan narsani ochsam bo'ladimi?", "advice_question"),
        v("Ularga nima deb javob beray?", "advice_question"),
        v("Qayta qo'ng'iroq qilishim kerakmi?", "advice_question"),
        v("Hali xavfsiz ekanimni qanday bilaman?", "advice_question"),
      ],
      en: [
        v("What should I do?", "advice_question"),
        v("How should I act right now?", "advice_question"),
        v("Should I reply to this person?", "advice_question"),
        v("Can I open what they sent me?", "advice_question"),
        v("What should I reply to them?", "advice_question"),
        v("Should I call them back?", "advice_question"),
        v("How do I know whether I am still safe?", "advice_question"),
      ],
    },
  },
  {
    category: "why_result",
    seeds: {
      ru: [
        f("Почему ты так решил?", "explain"),
        f("С чего ты сделал такой вывод?", "explain"),
        f("Почему результат именно такой?", "explain"),
        f("Какие признаки ты увидел?", "methodology"),
        f("Ты вообще это проверял каким-то образом?", "methodology"),
        f("Почему домен показался подозрительным?", "methodology"),
        f("Как ты пришёл к этой оценке?", "methodology"),
      ],
      uz: [
        f("Nega bunday qaror qildingiz?", "explain"),
        f("Bu xulosaga nimaga asoslanib keldingiz?", "explain"),
        f("Nega natija aynan shunday?", "explain"),
        f("Qaysi belgilarni ko'rdingiz?", "methodology"),
        f("Buni biror usul bilan tekshirdingizmi?", "methodology"),
        f("Nega domen shubhali ko'rindi?", "methodology"),
        f("Bu bahoga qanday keldingiz?", "methodology"),
      ],
      en: [
        f("Why did you decide that?", "explain"),
        f("What made you reach that conclusion?", "explain"),
        f("Why is the result like this?", "explain"),
        f("What signs did you notice?", "methodology"),
        f("Did you actually check it in some way?", "methodology"),
        f("Why did the domain look suspicious?", "methodology"),
        f("How did you arrive at this rating?", "methodology"),
      ],
    },
  },
  {
    category: "challenge_result",
    seeds: {
      ru: [
        f("Ты точно в этом уверен?", "confidence"),
        f("Ты действительно уверен в этом?", "confidence"),
        f("Я не согласен с таким ответом.", "disagreement"),
        f("Я не согласен с этой оценкой.", "disagreement"),
        f("Перепроверь ещё раз.", "recheck"),
        f("Можно связаться с близким человеком?", "trusted_person"),
        f("Какой следующий шаг мне сделать?", "next_steps"),
      ],
      uz: [
        f("Siz bunga aniq ishonasizmi?", "confidence"),
        f("Xato qildingizmi?", "disagreement"),
        f("Men rozi emasman, bu javob noto'g'ri.", "disagreement"),
        f("Bu natijaga ishonmayman.", "disagreement"),
        f("Yana bir marta tekshiring.", "recheck"),
        f("Yaqin odamim bilan bog'lansam bo'ladimi?", "trusted_person"),
        f("Endi keyin nima qilay?", "next_steps"),
      ],
      en: [
        f("Are you really sure about this?", "confidence"),
        f("You may be wrong about this.", "disagreement"),
        f("I disagree with that answer.", "disagreement"),
        f("I do not trust this result.", "disagreement"),
        f("Can you double-check that?", "recheck"),
        f("Can I contact someone close to me?", "trusted_person"),
        f("What should I do next now?", "next_steps"),
      ],
    },
  },
  {
    category: "capabilities",
    seeds: {
      ru: [
        m("Ты можешь проверить ссылку?", "can_check_link"),
        m("Можно прислать тебе текст сообщения?", "can_check_message"),
        m("Ты умеешь смотреть скриншоты?", "can_check_image"),
        m("Проверишь номер телефона?", "can_check_phone"),
        m("Ты можешь оценить Telegram-аккаунт?", "can_check_account"),
        m("Можно отправить QR-код на проверку?", "can_check_qr"),
        m("Что вообще умеет этот бот?", "what_can_you_do"),
      ],
      uz: [
        m("Havolani tekshira olasizmi?", "can_check_link"),
        m("Sizga xabar matnini yuborsam bo'ladimi?", "can_check_message"),
        m("Skrinshotlarni ko'rib bera olasizmi?", "can_check_image"),
        m("Telefon raqamini tekshirasizmi?", "can_check_phone"),
        m("Telegram akkauntini baholay olasizmi?", "can_check_account"),
        m("QR-kodni tekshirishga yuborsam bo'ladimi?", "can_check_qr"),
        m("Bu bot umuman nimalar qila oladi?", "what_can_you_do"),
      ],
      en: [
        m("Can you check a link?", "can_check_link"),
        m("Can I send you the text of a message?", "can_check_message"),
        m("Can you look at screenshots?", "can_check_image"),
        m("Can you check a phone number?", "can_check_phone"),
        m("Can you assess a Telegram account?", "can_check_account"),
        m("Can I send a QR code for checking?", "can_check_qr"),
        m("What can this bot actually do?", "what_can_you_do"),
      ],
    },
  },
  {
    category: "greetings_and_thanks",
    seeds: {
      ru: [
        m("Привет.", "greeting"),
        m("Добрый день.", "greeting"),
        m("Здравствуйте.", "greeting"),
        v("Спасибо за помощь.", "acknowledgement"),
        v("Хорошо, я так и сделаю.", "acknowledgement"),
        m("Рад, что нашёл этого бота.", "greeting"),
        m("Можно сначала просто поздороваться?", "greeting"),
      ],
      uz: [
        m("Salom.", "greeting"),
        m("Xayrli kun.", "greeting"),
        m("Assalomu alaykum.", "greeting"),
        v("Yordam uchun rahmat.", "acknowledgement"),
        v("Yaxshi, shunday qilaman.", "acknowledgement"),
        m("Bu botni topganimdan xursandman.", "greeting"),
        m("Avval shunchaki salomlashsam bo'ladimi?", "greeting"),
      ],
      en: [
        m("Hello.", "greeting"),
        m("Good afternoon.", "greeting"),
        m("Hi there.", "greeting"),
        v("Thank you for the help.", "acknowledgement"),
        v("Okay, I will do that.", "acknowledgement"),
        m("I am glad I found this bot.", "greeting"),
        m("Can I just say hello first?", "greeting"),
      ],
    },
  },
  {
    category: "mixed_clause_trap",
    seeds: {
      ru: [
        r("Это обычная проверка, пришлите код из SMS.", "asks_for_sms_code"),
        r("Здравствуйте, для сверки продиктуйте код из сообщения.", "asks_for_sms_code"),
        r("Ничего срочного, отправьте CVV с обратной стороны карты.", "asks_for_card_cvv"),
        r("Мы просто уточняем данные, пришлите фото паспорта.", "requests_personal_data"),
        r(
          "Это стандартная процедура, переведите деньги на безопасный счёт.",
          "asks_to_transfer_to_safe_account",
        ),
        r("Сообщение информационное, установите APK для защиты.", "asks_to_install_apk"),
        r("Проверка завершена, откройте AnyDesk и покажите экран.", "asks_to_share_screen"),
      ],
      uz: [
        r("Bu oddiy tekshiruv, SMS kodni yuboring.", "asks_for_sms_code"),
        r("Salom, solishtirish uchun xabardagi kodni ayting.", "asks_for_sms_code"),
        r("Shoshilinch emas, kartaning CVV kodini yuboring.", "asks_for_card_cvv"),
        r("Biz faqat ma'lumotni aniqlaymiz, pasport rasmini yuboring.", "requests_personal_data"),
        r(
          "Bu standart jarayon, pulni xavfsiz hisobga o'tkazing.",
          "asks_to_transfer_to_safe_account",
        ),
        r("Bu axborot xabari, himoya uchun APK o'rnating.", "asks_to_install_apk"),
        r("Tekshiruv tugadi, AnyDeskni ochib ekranni ko'rsating.", "asks_to_share_screen"),
      ],
      en: [
        r("This is a routine check, send the code from the SMS.", "asks_for_sms_code"),
        r("Hello, read out the code from the message for verification.", "asks_for_sms_code"),
        r("There is no rush, send the CVV from the back of the card.", "asks_for_card_cvv"),
        r("We are only updating records, send a photo of your passport.", "requests_personal_data"),
        r(
          "This is standard procedure, transfer the money to a safe account.",
          "asks_to_transfer_to_safe_account",
        ),
        r("This is an information notice, install the APK for protection.", "asks_to_install_apk"),
        r("The check is complete, open AnyDesk and show your screen.", "asks_to_share_screen"),
      ],
    },
  },
  {
    category: "neutral_word_trap",
    seeds: {
      ru: [
        r("Ваш tracking code уже создан, теперь продиктуйте код из SMS.", "asks_for_sms_code"),
        r(
          "Пароль нужен только для приложения, а нам отправьте код подтверждения.",
          "asks_for_sms_code",
        ),
        r("В меню есть QR-код, но для входа отсканируйте другой QR.", "asks_to_scan_qr"),
        r(
          "Это карточная игра, однако пришлите последние четыре цифры банковской карты.",
          "requests_card_digits",
        ),
        r(
          "Платёж указан в квитанции, дополнительно переведите деньги на безопасный счёт.",
          "asks_to_transfer_to_safe_account",
        ),
        r("Проверка адреса завершена, теперь отправьте фото паспорта.", "requests_personal_data"),
        r("Код программы открыт, а секретный PIN карты сообщите оператору.", "asks_for_pin"),
      ],
      uz: [
        r("Tracking kod tayyor, endi SMS kodni ayting.", "asks_for_sms_code"),
        r("Parol faqat ilova uchun, bizga tasdiqlash kodini yuboring.", "asks_for_sms_code"),
        r("Menyuda QR-kod bor, lekin kirish uchun boshqa QRni skaner qiling.", "asks_to_scan_qr"),
        r(
          "Bu karta o'yini, ammo bank kartaning oxirgi to'rt raqamini yuboring.",
          "requests_card_digits",
        ),
        r(
          "To'lov kvitansiyada ko'rsatilgan, qo'shimcha pulni xavfsiz hisobga o'tkazing.",
          "asks_to_transfer_to_safe_account",
        ),
        r("Manzil tekshiruvi tugadi, endi pasport rasmini yuboring.", "requests_personal_data"),
        r("Dastur kodi ochiq, bank kartaning maxfiy PINini operatorga ayting.", "asks_for_pin"),
      ],
      en: [
        r("Your tracking code is ready, now tell us the code from the SMS.", "asks_for_sms_code"),
        r(
          "The password is only for the app, but send us the verification code.",
          "asks_for_sms_code",
        ),
        r("There is a QR code on the menu, but scan another QR to sign in.", "asks_to_scan_qr"),
        r(
          "This is a card game, however send the last four digits of your bank card.",
          "requests_card_digits",
        ),
        r(
          "The payment is on the receipt, additionally transfer money to a safe account.",
          "asks_to_transfer_to_safe_account",
        ),
        r(
          "The address check is complete, now send a photo of your passport.",
          "requests_personal_data",
        ),
        r("The program code is public, tell the operator your secret card PIN.", "asks_for_pin"),
      ],
    },
  },
] as const;

function riskResult(text: string) {
  const reasons = evaluateText(text);
  const { score, level } = scoreFromCodes(reasons);
  return {
    type: "text" as const,
    display: "[offline everyday dialogue]",
    level,
    score,
    reasons,
    explanation: null,
    knownReports: 0,
    verifiedContact: null,
    brandEvidence: [],
  };
}

function resolveProductionTurn(
  utterance: string,
  lang: Lang,
  lastCheck?: LastCheckSnapshot,
): { turn: EverydayDialogueTurn; lastCheck?: LastCheckSnapshot } {
  const metaIntent = classifyMetaIntent(utterance);
  const followUpAction = lastCheck
    ? classifyLastCheckFollowUp(utterance, { lastCheck }, FIXED_NOW)
    : null;

  // Mirrors the relevant text-routing priority in router.ts: a recent result
  // keeps provenance for result questions, otherwise meta intents win before
  // conversational victim guidance and finally the fresh risk pipeline.
  if (
    lastCheck &&
    followUpAction &&
    (!metaIntent || metaIntent === "explain_risk" || metaIntent === "how_do_you_check")
  ) {
    return {
      turn: {
        utterance,
        route: canonicalFollowUpIntentId(followUpAction),
        response: buildLastCheckFollowUpText(followUpAction, lastCheck, lang, utterance),
        family: "followup",
        expectedAction: followUpAction,
      },
      lastCheck,
    };
  }

  if (metaIntent) {
    return {
      turn: {
        utterance,
        route: canonicalMetaIntentId(metaIntent),
        response: getMetaIntentResponse(metaIntent, lang),
        family: "meta",
        expectedIntent: metaIntent,
      },
      ...(lastCheck ? { lastCheck } : {}),
    };
  }

  const victimIntent = classifyVictimIntent(utterance);
  if (victimIntent?.kind === "friend_money") {
    return {
      turn: {
        utterance,
        route: canonicalVictimIntentId(victimIntent.kind),
        response: buildVictimIntentText(victimIntent, lang),
        family: "victim",
        expectedIntent: victimIntent.kind,
      },
      ...(lastCheck ? { lastCheck } : {}),
    };
  }

  const panicId = classifyTextPanicIntent(utterance);
  if (panicId !== null) {
    const liveCallContext = panicId === 6 ? classifyLiveCallContext(utterance) : undefined;
    return {
      turn: {
        utterance,
        route: canonicalPanicIntentId(panicId),
        response: buildPanicScenarioText(
          panicId,
          lang,
          liveCallContext === undefined ? {} : { liveCallContext },
        ),
        family: "panic",
        expectedPanicId: panicId,
      },
      ...(lastCheck ? { lastCheck } : {}),
    };
  }

  if (victimIntent) {
    return {
      turn: {
        utterance,
        route: canonicalVictimIntentId(victimIntent.kind),
        response: buildVictimIntentText(victimIntent, lang),
        family: "victim",
        expectedIntent: victimIntent.kind,
      },
      ...(lastCheck ? { lastCheck } : {}),
    };
  }

  const result = riskResult(utterance);
  return {
    turn: {
      utterance,
      route: "input.risk_check",
      response: formatCheckResult(result, lang).text,
      family: "risk",
      expectedReasons: result.reasons,
    },
    lastCheck: buildLastCheckSnapshot(result, FIXED_NOW),
  };
}

function firstTurn(
  seed: Seed,
  lang: Lang,
): { turn: EverydayDialogueTurn; lastCheck?: LastCheckSnapshot } {
  const resolved = resolveProductionTurn(
    seed.text,
    lang,
    seed.family === "followup" ? BASELINE_LAST_CHECK : undefined,
  );
  if (seed.family !== "risk") return resolved;
  return {
    ...resolved,
    turn: { ...resolved.turn, expectedReasons: seed.reasons },
  };
}

function secondTurn(
  lang: Lang,
  sequence: number,
  lastCheck?: LastCheckSnapshot,
): EverydayDialogueTurn {
  const pool = lastCheck ? RESULT_FOLLOW_UP_SEEDS[lang] : CONVERSATIONAL_FOLLOW_UP_SEEDS[lang];
  const seed = pool[sequence % pool.length]!;
  return resolveProductionTurn(seed.text, lang, lastCheck).turn;
}

function buildEverydayDialogueCorpus(): EverydayDialogue[] {
  const dialogues: EverydayDialogue[] = [];

  for (const [categoryIndex, spec] of CATEGORY_SPECS.entries()) {
    for (const lang of ["ru", "uz", "en"] as const) {
      const completeSeeds = [...spec.seeds[lang], ...EXTRA_SEEDS[spec.category][lang]];

      for (const [seedIndex, seed] of completeSeeds.entries()) {
        const { turn: first, lastCheck } = firstTurn(seed, lang);
        dialogues.push({
          id: `${spec.category}:${lang}:${seedIndex + 1}`,
          category: spec.category,
          lang,
          first,
          followUp: secondTurn(lang, categoryIndex * 12 + seedIndex, lastCheck),
          ...(lastCheck ? { lastCheck } : {}),
        });
      }
    }
  }

  return dialogues;
}

export const EVERYDAY_DIALOGUE_CORPUS: readonly EverydayDialogue[] = buildEverydayDialogueCorpus();

export const EVERYDAY_DIALOGUE_STATS = {
  totalDialogues: EVERYDAY_DIALOGUE_CORPUS.length,
  totalUserTurns: EVERYDAY_DIALOGUE_CORPUS.length * 2,
  languageCounts: Object.fromEntries(
    (["ru", "uz", "en"] as const).map((lang) => [
      lang,
      EVERYDAY_DIALOGUE_CORPUS.filter((dialogue) => dialogue.lang === lang).length,
    ]),
  ),
  categoryCounts: Object.fromEntries(
    EVERYDAY_DIALOGUE_CATEGORIES.map((category) => [
      category,
      EVERYDAY_DIALOGUE_CORPUS.filter((dialogue) => dialogue.category === category).length,
    ]),
  ),
  firstFamilyCounts: Object.fromEntries(
    (["victim", "meta", "followup", "panic", "risk"] as const).map((family) => [
      family,
      EVERYDAY_DIALOGUE_CORPUS.filter((dialogue) => dialogue.first.family === family).length,
    ]),
  ),
} as const;

export const EVERYDAY_DIALOGUE_FIXED_NOW = FIXED_NOW;
