import type { Lang } from "@/lib/i18n";
import type { ReasonCode } from "@/lib/risk/rules";

/**
 * Deterministic offline corpus for clause-boundary and polarity regressions.
 *
 * These are synthetic QA strings, not real user transcripts and not training
 * data. They are intentionally evaluated with the production `evaluateText`
 * function in unit tests; no Telegram, AI-provider, reputation, or database
 * request is made.
 */
export const MIXED_CLAUSE_RISK_CATEGORIES = [
  "otp_or_sms",
  "password",
  "pin",
  "cvv",
  "card_data",
  "personal_data",
  "money_transfer",
  "delivery_fee",
  "apk_install",
  "screen_share",
  "dangerous_qr",
] as const;

export type MixedClauseRiskCategory = (typeof MIXED_CLAUSE_RISK_CATEGORIES)[number];

export const MIXED_CLAUSE_SHAPES = [
  "neutral_then_danger",
  "danger_then_safety",
  "safe_control",
] as const;

export type MixedClauseShape = (typeof MIXED_CLAUSE_SHAPES)[number];

export type MixedClauseSeparator = "comma" | "colon" | "dash" | "semicolon" | "contrast" | "none";

export interface MixedClauseAdversarialCase {
  id: string;
  lang: Lang;
  category: MixedClauseRiskCategory;
  shape: MixedClauseShape;
  separator: MixedClauseSeparator;
  text: string;
  requiredReasons: readonly ReasonCode[];
  forbiddenReasons: readonly ReasonCode[];
}

interface LocalizedRiskSeed {
  neutral: string;
  danger: string;
  safety: string;
  safeControl: string;
  requiredReason: ReasonCode;
}

const SEPARATORS: Readonly<Record<Lang, readonly { id: MixedClauseSeparator; text: string }[]>> = {
  ru: [
    { id: "comma", text: ", " },
    { id: "colon", text: ": " },
    { id: "dash", text: " — " },
    { id: "semicolon", text: "; " },
    { id: "contrast", text: " но " },
  ],
  uz: [
    { id: "comma", text: ", " },
    { id: "colon", text: ": " },
    { id: "dash", text: " — " },
    { id: "semicolon", text: "; " },
    { id: "contrast", text: " lekin " },
  ],
  en: [
    { id: "comma", text: ", " },
    { id: "colon", text: ": " },
    { id: "dash", text: " — " },
    { id: "semicolon", text: "; " },
    { id: "contrast", text: " but " },
  ],
};

const RISK_SEEDS: Readonly<
  Record<Lang, Readonly<Record<MixedClauseRiskCategory, LocalizedRiskSeed>>>
> = {
  ru: {
    otp_or_sms: {
      neutral: "Я проверил код товара",
      danger: "незнакомец просит отправить код из SMS",
      safety: "потом никому другому этот SMS-код не отправляйте",
      safeControl: "Никогда не отправляйте код из SMS незнакомым.",
      requiredReason: "asks_for_sms_code",
    },
    password: {
      neutral: "Парольная политика приложения понятна",
      danger: "он просит сообщить пароль от банковского приложения",
      safety: "никогда потом не сообщайте пароль другим",
      safeControl: "Не сообщайте пароль от банковского приложения незнакомым.",
      requiredReason: "asks_for_pin",
    },
    pin: {
      neutral: "PIN нужен только для входа в моё приложение",
      danger: "он просит назвать PIN банковской карты",
      safety: "никогда не называйте PIN другим людям",
      safeControl: "Никогда не называйте PIN банковской карты незнакомым.",
      requiredReason: "asks_for_pin",
    },
    cvv: {
      neutral: "Я прочитал справку о том, что такое CVV",
      danger: "он просит назвать CVV с обратной стороны карты",
      safety: "никогда потом не сообщайте CVV другим",
      safeControl: "Не отправляйте CVV с обратной стороны карты в чат.",
      requiredReason: "asks_for_card_cvv",
    },
    card_data: {
      neutral: "Номер заказа уже проверен",
      danger: "он просит отправить номер банковской карты",
      safety: "не отправляйте номер карты другим людям",
      safeControl: "Не отправляйте номер банковской карты незнакомым.",
      requiredReason: "requests_card_digits",
    },
    personal_data: {
      neutral: "Адрес доставки в форме уже заполнен",
      danger: "он просит прислать фото паспорта",
      safety: "не отправляйте паспорт незнакомым людям",
      safeControl: "Не присылайте фото паспорта незнакомым.",
      requiredReason: "requests_personal_data",
    },
    money_transfer: {
      neutral: "Статус обычного платежа проверен",
      danger: "незнакомец просит перевести деньги на чужую карту",
      safety: "не переводите деньги другим незнакомцам",
      safeControl: "Не переводите деньги на чужую карту.",
      requiredReason: "asks_for_money_transfer",
    },
    delivery_fee: {
      neutral: "Я сверил адрес доставки",
      danger: "курьер просит оплатить сбор за доставку по ссылке",
      safety: "не оплачивайте неизвестные сборы за доставку",
      safeControl: "Проверьте адрес доставки и не оплачивайте неизвестный сбор.",
      requiredReason: "fake_delivery_payment",
    },
    apk_install: {
      neutral: "Скриншот меню уже проверен",
      danger: "он просит установить APK-приложение",
      safety: "не устанавливайте APK из других чатов",
      safeControl: "Не устанавливайте APK из сообщений незнакомцев.",
      requiredReason: "asks_to_install_apk",
    },
    screen_share: {
      neutral: "Скриншот проверки я сохранил",
      danger: "он просит показать экран телефона",
      safety: "не показывайте экран другим незнакомцам",
      safeControl: "Не показывайте экран телефона незнакомым.",
      requiredReason: "asks_to_share_screen",
    },
    dangerous_qr: {
      neutral: "QR-меню ресторана открылось нормально",
      danger: "он просит отсканировать QR-код для входа в Telegram",
      safety: "не сканируйте чужие QR-коды для входа",
      safeControl: "Не сканируйте QR-код для входа, если источник неизвестен.",
      requiredReason: "asks_to_scan_qr",
    },
  },
  uz: {
    otp_or_sms: {
      neutral: "Men mahsulot kodini tekshirdim",
      danger: "notanish odam SMS kodni yuborishimni so'rayapti",
      safety: "keyin bu SMS kodni boshqa hech kimga yubormang",
      safeControl: "SMS kodni notanish odamlarga hech qachon yubormang.",
      requiredReason: "asks_for_sms_code",
    },
    password: {
      neutral: "Ilovaning parol siyosati tushunarli",
      danger: "u bank ilovasi parolini aytishni so'rayapti",
      safety: "keyin parolni boshqa hech kimga aytmang",
      safeControl: "Bank ilovasi parolini notanish odamlarga aytmang.",
      requiredReason: "asks_for_pin",
    },
    pin: {
      neutral: "PIN faqat mening ilovamga kirish uchun kerak",
      danger: "u bank kartasi PIN kodini aytishni so'rayapti",
      safety: "PIN kodni boshqa odamlarga hech qachon aytmang",
      safeControl: "Bank kartasi PIN kodini notanish odamlarga aytmang.",
      requiredReason: "asks_for_pin",
    },
    cvv: {
      neutral: "Men CVV nima ekanini o'qib chiqdim",
      danger: "u kartadagi CVV kodni aytishni so'rayapti",
      safety: "CVV kodni keyin boshqa hech kimga aytmang",
      safeControl: "Kartadagi CVV kodni chatga yubormang.",
      requiredReason: "asks_for_card_cvv",
    },
    card_data: {
      neutral: "Buyurtma raqami allaqachon tekshirildi",
      danger: "u karta raqamini yuborishni so'rayapti",
      safety: "karta raqamini boshqa odamlarga yubormang",
      safeControl: "Bank kartasi raqamini notanish odamlarga yubormang.",
      requiredReason: "requests_card_digits",
    },
    personal_data: {
      neutral: "Yetkazib berish manzili shaklda yozilgan",
      danger: "u pasport rasmini yuborishni so'rayapti",
      safety: "pasport rasmini notanish odamlarga yubormang",
      safeControl: "Pasport rasmini notanish odamlarga yubormang.",
      requiredReason: "requests_personal_data",
    },
    money_transfer: {
      neutral: "Oddiy to'lov holati tekshirildi",
      danger: "notanish odam pulni begona kartaga o'tkazishni so'rayapti",
      safety: "notanish odamlarga pul o'tkazmang",
      safeControl: "Begona kartaga pul o'tkazmang.",
      requiredReason: "asks_for_money_transfer",
    },
    delivery_fee: {
      neutral: "Men yetkazib berish manzilini tekshirdim",
      danger: "kuryer yetkazib berish komissiyasini to'lashni so'rayapti",
      safety: "noma'lum yetkazib berish to'lovini to'lamang",
      safeControl: "Manzilni tekshiring va noma'lum yetkazib berish komissiyasini to'lamang.",
      requiredReason: "fake_delivery_payment",
    },
    apk_install: {
      neutral: "Menyu skrinshoti allaqachon tekshirildi",
      danger: "u APK faylni yuklab o'rnatishni so'rayapti",
      safety: "boshqa chatlardan APK o'rnatmang",
      safeControl: "Notanish xabarlardan APK faylni o'rnatmang.",
      requiredReason: "asks_to_install_apk",
    },
    screen_share: {
      neutral: "Tekshiruv skrinshotini saqladim",
      danger: "u telefon ekranini ko'rsatishni so'rayapti",
      safety: "ekranni boshqa notanish odamlarga ko'rsatmang",
      safeControl: "Telefon ekranini notanish odamlarga ko'rsatmang.",
      requiredReason: "asks_to_share_screen",
    },
    dangerous_qr: {
      neutral: "Restoran QR-menyusi to'g'ri ochildi",
      danger: "u Telegramga kirish uchun QR kodni skanerlashni so'rayapti",
      safety: "kirish uchun begona QR kodni skanerlamang",
      safeControl: "Manbasi noma'lum bo'lsa, kirish uchun QR kodni skanerlamang.",
      requiredReason: "asks_to_scan_qr",
    },
  },
  en: {
    otp_or_sms: {
      neutral: "I checked the product code",
      danger: "a stranger asks me to send the SMS code",
      safety: "do not send that SMS code to anyone else later",
      safeControl: "Never send an SMS code to a stranger.",
      requiredReason: "asks_for_sms_code",
    },
    password: {
      neutral: "The app password policy is clear",
      danger: "they ask me to share my bank password",
      safety: "never share the password with anyone else later",
      safeControl: "Do not share your bank password with a stranger.",
      requiredReason: "asks_for_pin",
    },
    pin: {
      neutral: "The PIN is only for signing in to my own app",
      danger: "they ask me to tell them my bank PIN",
      safety: "never tell the PIN to anyone else",
      safeControl: "Never tell your bank PIN to a stranger.",
      requiredReason: "asks_for_pin",
    },
    cvv: {
      neutral: "I read the help page explaining what CVV means",
      danger: "they ask me to send the CVV from the back of my card",
      safety: "do not send the CVV to anyone else later",
      safeControl: "Do not send the CVV from the back of your card in chat.",
      requiredReason: "asks_for_card_cvv",
    },
    card_data: {
      neutral: "The order number has already been checked",
      danger: "they ask me to send my bank card number",
      safety: "do not send the card number to anyone else",
      safeControl: "Do not send your bank card number to a stranger.",
      requiredReason: "requests_card_digits",
    },
    personal_data: {
      neutral: "The delivery address is already in the form",
      danger: "they ask me to send a photo of my passport",
      safety: "do not send the passport to strangers",
      safeControl: "Do not send a photo of your passport to a stranger.",
      requiredReason: "requests_personal_data",
    },
    money_transfer: {
      neutral: "The ordinary payment status was checked",
      danger: "a stranger asks me to transfer money to a third-party card",
      safety: "do not transfer money to other strangers",
      safeControl: "Do not transfer money to a stranger's card.",
      requiredReason: "asks_for_money_transfer",
    },
    delivery_fee: {
      neutral: "I verified the delivery address",
      danger: "the courier asks me to pay a delivery fee by link",
      safety: "do not pay unknown delivery fees",
      safeControl: "Verify the delivery address and do not pay an unknown delivery fee.",
      requiredReason: "fake_delivery_payment",
    },
    apk_install: {
      neutral: "The menu screenshot has already been checked",
      danger: "they ask me to install an APK app",
      safety: "do not install APK files from other chats",
      safeControl: "Do not install an APK file from a stranger's message.",
      requiredReason: "asks_to_install_apk",
    },
    screen_share: {
      neutral: "I saved the verification screenshot",
      danger: "they ask me to share my phone screen",
      safety: "do not share the screen with other strangers",
      safeControl: "Do not share your phone screen with a stranger.",
      requiredReason: "asks_to_share_screen",
    },
    dangerous_qr: {
      neutral: "The restaurant QR menu opened normally",
      danger: "they ask me to scan a QR code to log in to Telegram",
      safety: "do not scan another login QR code from strangers",
      safeControl: "Do not scan a login QR code if its source is unknown.",
      requiredReason: "asks_to_scan_qr",
    },
  },
};

function buildMixedClauseAdversarialCorpus(): MixedClauseAdversarialCase[] {
  const corpus: MixedClauseAdversarialCase[] = [];

  for (const lang of ["ru", "uz", "en"] as const) {
    for (const category of MIXED_CLAUSE_RISK_CATEGORIES) {
      const seed = RISK_SEEDS[lang][category];

      for (const separator of SEPARATORS[lang]) {
        corpus.push({
          id: `${lang}-${category}-neutral-danger-${separator.id}`,
          lang,
          category,
          shape: "neutral_then_danger",
          separator: separator.id,
          text: `${seed.neutral}${separator.text}${seed.danger}.`,
          requiredReasons: [seed.requiredReason],
          forbiddenReasons: [],
        });
        corpus.push({
          id: `${lang}-${category}-danger-safety-${separator.id}`,
          lang,
          category,
          shape: "danger_then_safety",
          separator: separator.id,
          text: `${seed.danger}${separator.text}${seed.safety}.`,
          requiredReasons: [seed.requiredReason],
          forbiddenReasons: [],
        });
      }

      corpus.push({
        id: `${lang}-${category}-safe-control`,
        lang,
        category,
        shape: "safe_control",
        separator: "none",
        text: seed.safeControl,
        requiredReasons: [],
        forbiddenReasons: [seed.requiredReason],
      });
    }
  }

  return corpus;
}

export const MIXED_CLAUSE_ADVERSARIAL_CORPUS = buildMixedClauseAdversarialCorpus();
