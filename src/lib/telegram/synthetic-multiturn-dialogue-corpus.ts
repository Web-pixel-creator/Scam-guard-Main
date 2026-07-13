import type { Lang } from "@/lib/i18n";
import type { MetaIntent } from "@/lib/meta-intent";
import { evaluateText, scoreFromCodes, type ReasonCode } from "@/lib/risk/rules";
import {
  ALL_LAST_CHECK_FOLLOW_UP_ACTIONS,
  buildLastCheckSnapshot,
  FOLLOW_UP_GOLDEN_PHRASES,
  type LastCheckFollowUpAction,
} from "@/lib/telegram/check-followup";
import type { CanonicalTelegramIntentId } from "@/lib/telegram/intent-contract";
import type { LastCheckSnapshot } from "@/lib/telegram/session.server";

/**
 * Deterministic, synthetic, offline QA data. These rows do not train the bot,
 * are not transcripts of real people, and are not a substitute for Telegram
 * Desktop/Android/iOS acceptance testing. Each row is a distinct sequence of
 * two or three user turns rather than one utterance repeated behind prefixes.
 */
export const SYNTHETIC_MULTITURN_DIALOGUE_CATEGORIES = [
  "code_theft",
  "safe_account_transfer",
  "credential_theft",
  "malware_or_remote_access",
  "qr_account_action",
  "ordinary_to_capability",
  "meta_exploration",
  "ordinary_chitchat",
] as const;

export type SyntheticMultiturnDialogueCategory =
  (typeof SYNTHETIC_MULTITURN_DIALOGUE_CATEGORIES)[number];

export interface SyntheticRiskTurn {
  kind: "risk_check";
  utterance: string;
  expectedRoute: "input.risk_check";
  expectedReasons: readonly ReasonCode[];
}

export interface SyntheticMetaTurn {
  kind: "meta";
  utterance: string;
  expectedRoute: `meta.${MetaIntent}`;
  expectedIntent: MetaIntent;
}

export interface SyntheticFollowUpTurn {
  kind: "followup";
  utterance: string;
  expectedRoute: `followup.${LastCheckFollowUpAction}`;
  expectedAction: LastCheckFollowUpAction;
}

export type SyntheticDialogueTurn = SyntheticRiskTurn | SyntheticMetaTurn | SyntheticFollowUpTurn;

export type SyntheticDialogueTurns =
  | readonly [SyntheticDialogueTurn, SyntheticDialogueTurn]
  | readonly [SyntheticDialogueTurn, SyntheticDialogueTurn, SyntheticDialogueTurn];

export interface SyntheticMultiturnDialogue {
  id: string;
  category: SyntheticMultiturnDialogueCategory;
  lang: Lang;
  turns: SyntheticDialogueTurns;
  /** Present only for dialogues whose later turns refer to a recent check. */
  lastCheck?: LastCheckSnapshot;
}

interface CategorySpec {
  category: SyntheticMultiturnDialogueCategory;
  count: number;
  mode: "risk" | "ordinary_to_capability" | "meta" | "ordinary";
}

const CATEGORY_SPECS: readonly CategorySpec[] = [
  { category: "code_theft", count: 150, mode: "risk" },
  { category: "safe_account_transfer", count: 130, mode: "risk" },
  { category: "credential_theft", count: 120, mode: "risk" },
  { category: "malware_or_remote_access", count: 110, mode: "risk" },
  { category: "qr_account_action", count: 110, mode: "risk" },
  { category: "ordinary_to_capability", count: 120, mode: "ordinary_to_capability" },
  { category: "meta_exploration", count: 140, mode: "meta" },
  { category: "ordinary_chitchat", count: 120, mode: "ordinary" },
] as const;

interface RiskSeed {
  text: string;
  expectedReasons: readonly ReasonCode[];
}

type LocalizedRiskSeeds = Readonly<Record<Lang, readonly RiskSeed[]>>;

const RISK_SEEDS: Readonly<
  Record<
    Extract<
      SyntheticMultiturnDialogueCategory,
      | "code_theft"
      | "safe_account_transfer"
      | "credential_theft"
      | "malware_or_remote_access"
      | "qr_account_action"
    >,
    LocalizedRiskSeeds
  >
> = {
  code_theft: {
    ru: [
      {
        text: "Звонивший просит продиктовать код из SMS, который сейчас придёт.",
        expectedReasons: ["asks_for_sms_code"],
      },
      {
        text: "В чате требуют отправить код, который пришёл из банковского приложения.",
        expectedReasons: ["asks_for_sms_code"],
      },
      {
        text: "Мне написали: продиктуйте шесть цифр из сообщения.",
        expectedReasons: ["asks_for_sms_code"],
      },
      {
        text: "Незнакомец просит переслать verification code из уведомления.",
        expectedReasons: ["asks_for_sms_code"],
      },
    ],
    uz: [
      {
        text: "Qo'ng'iroq qilgan odam kelgan kodni yuborishimni so'rayapti.",
        expectedReasons: ["asks_for_sms_code"],
      },
      {
        text: "Bank xodimi SMS kodni aytishimni talab qilyapti.",
        expectedReasons: ["asks_for_sms_code"],
      },
      {
        text: "Xabarda menga: kodni yuboring, deb yozishdi.",
        expectedReasons: ["asks_for_sms_code"],
      },
      {
        text: "Notanish odam ilovadan kelgan kodni aytishimni so'radi.",
        expectedReasons: ["asks_for_sms_code"],
      },
    ],
    en: [
      {
        text: "The caller asks me to send the verification code that arrived by SMS.",
        expectedReasons: ["asks_for_sms_code"],
      },
      {
        text: "They told me to read the six digits received in the message.",
        expectedReasons: ["asks_for_sms_code"],
      },
      {
        text: "Bank support wants the SMS code from the app.",
        expectedReasons: ["asks_for_sms_code"],
      },
      {
        text: "A stranger says I must forward the code that will arrive.",
        expectedReasons: ["asks_for_sms_code"],
      },
    ],
  },
  safe_account_transfer: {
    ru: [
      {
        text: "Звонящий велит перевести деньги на безопасный счёт.",
        expectedReasons: ["asks_to_transfer_to_safe_account"],
      },
      {
        text: "Якобы сотрудник банка просит срочно отправить средства на безопасную карту.",
        expectedReasons: ["asks_to_transfer_to_safe_account"],
      },
      {
        text: "Мне сказали защитить накопления переводом на безопасный счет.",
        expectedReasons: ["asks_to_transfer_to_safe_account"],
      },
      {
        text: "В сообщении требуют сделать перевод на safe account.",
        expectedReasons: ["asks_to_transfer_to_safe_account"],
      },
    ],
    uz: [
      {
        text: "Qo'ng'iroq qilgan odam pulni xavfsiz hisobga o'tkazishni aytdi.",
        expectedReasons: ["asks_to_transfer_to_safe_account"],
      },
      {
        text: "O'zini bank xodimi degan kishi xavfsiz hisobga pul o'tkazing dedi.",
        expectedReasons: ["asks_to_transfer_to_safe_account"],
      },
      {
        text: "Jamg'armani saqlash uchun xavfsiz hisob kerakligini aytishdi.",
        expectedReasons: ["asks_to_transfer_to_safe_account"],
      },
      {
        text: "Xabarda pulni xavfsiz hisobga yuborish talab qilinyapti.",
        expectedReasons: ["asks_to_transfer_to_safe_account"],
      },
    ],
    en: [
      {
        text: "The caller says I must transfer money to a safe account.",
        expectedReasons: ["asks_to_transfer_to_safe_account"],
      },
      {
        text: "Someone claiming to be bank security wants funds moved to a safe account.",
        expectedReasons: ["asks_to_transfer_to_safe_account"],
      },
      {
        text: "They say my savings are protected only after a transfer to a safe account.",
        expectedReasons: ["asks_to_transfer_to_safe_account"],
      },
      {
        text: "The message demands an immediate payment to a safe account.",
        expectedReasons: ["asks_to_transfer_to_safe_account"],
      },
    ],
  },
  credential_theft: {
    ru: [
      {
        text: "В чате просят назвать CVV с обратной стороны карты.",
        expectedReasons: ["asks_for_card_cvv"],
      },
      {
        text: "Собеседник требует сообщить PIN банковской карты.",
        expectedReasons: ["asks_for_pin"],
      },
      {
        text: "Мне написали: отправьте фото паспорта для проверки.",
        expectedReasons: ["requests_personal_data"],
      },
      {
        text: "Незнакомец просит последние четыре цифры карты.",
        expectedReasons: ["requests_card_digits"],
      },
    ],
    uz: [
      {
        text: "Xabarda kartaning CVV kodini ayting deyishdi.",
        expectedReasons: ["asks_for_card_cvv"],
      },
      {
        text: "Notanish odam bank kartamning PIN kodini so'rayapti.",
        expectedReasons: ["asks_for_pin"],
      },
      {
        text: "Ular yozdi: pasport rasmini yuboring.",
        expectedReasons: ["requests_personal_data"],
      },
      {
        text: "Mendan kartaning oxirgi to'rt raqamini tasdiqlashni so'rashdi.",
        expectedReasons: ["requests_card_digits"],
      },
    ],
    en: [
      {
        text: "The chat asks me to tell the CVV on the back of my card.",
        expectedReasons: ["asks_for_card_cvv"],
      },
      {
        text: "A stranger wants the PIN for my bank card.",
        expectedReasons: ["asks_for_pin"],
      },
      {
        text: "They wrote: send a photo of your passport for verification.",
        expectedReasons: ["requests_personal_data"],
      },
      {
        text: "The caller asks me to send the three-digit CVV from the card.",
        expectedReasons: ["asks_for_card_cvv"],
      },
    ],
  },
  malware_or_remote_access: {
    ru: [
      {
        text: "Оператор просит установить APK-приложение для защиты.",
        expectedReasons: ["asks_to_install_apk"],
      },
      {
        text: "Мне предлагают включить демонстрацию экрана через AnyDesk.",
        expectedReasons: ["asks_to_share_screen"],
      },
      {
        text: "Собеседник требует установить приложение QuickSupport.",
        expectedReasons: ["asks_to_install_apk"],
      },
      {
        text: "Для помощи просят дать доступ к экрану в TeamViewer.",
        expectedReasons: ["asks_to_share_screen"],
      },
    ],
    uz: [
      {
        text: "Xavfsizlik uchun APK yuklab oling deyishdi.",
        expectedReasons: ["asks_to_install_apk"],
      },
      {
        text: "Yordam berish uchun AnyDesk orqali ekranimni ko'rmoqchi.",
        expectedReasons: ["asks_to_share_screen"],
      },
      {
        text: "Menga ilovani o'rnating, APK yuboramiz deyishdi.",
        expectedReasons: ["asks_to_install_apk"],
      },
      {
        text: "Notanish kishi TeamViewer bilan ekran ulashishni so'radi.",
        expectedReasons: ["asks_to_share_screen"],
      },
    ],
    en: [
      {
        text: "Support told me to install an APK app for protection.",
        expectedReasons: ["asks_to_install_apk"],
      },
      {
        text: "The caller wants me to share my screen through AnyDesk.",
        expectedReasons: ["asks_to_share_screen"],
      },
      {
        text: "They insist I install an app called QuickSupport.",
        expectedReasons: ["asks_to_install_apk"],
      },
      {
        text: "A stranger asks for screen sharing in TeamViewer.",
        expectedReasons: ["asks_to_share_screen"],
      },
    ],
  },
  qr_account_action: {
    ru: [
      {
        text: "Для входа в банк просят сканировать QR-код.",
        expectedReasons: ["asks_to_scan_qr"],
      },
      {
        text: "Мне велят отсканировать QR для подтверждения аккаунта.",
        expectedReasons: ["asks_to_scan_qr"],
      },
      {
        text: "В розыгрыше требуют сканировать QR-код ради приза.",
        expectedReasons: ["asks_to_scan_qr"],
      },
      {
        text: "Собеседник просит сканировать QR для перевода денег.",
        expectedReasons: ["asks_to_scan_qr"],
      },
    ],
    uz: [
      {
        text: "Bank hisobiga kirish uchun QR-kodni skaner qiling deyishdi.",
        expectedReasons: ["asks_to_scan_qr"],
      },
      {
        text: "Akkauntni tasdiqlash uchun QR skaner qilishni so'rashyapti.",
        expectedReasons: ["asks_to_scan_qr"],
      },
      {
        text: "Sovrin olish uchun QR-kodni skaner qiling deyishdi.",
        expectedReasons: ["asks_to_scan_qr"],
      },
      {
        text: "Pul o'tkazish uchun QR kodni skaner qilishni aytishdi.",
        expectedReasons: ["asks_to_scan_qr"],
      },
    ],
    en: [
      {
        text: "They ask me to scan a QR code to log in to the bank.",
        expectedReasons: ["asks_to_scan_qr"],
      },
      {
        text: "The message says to scan this QR to verify my account.",
        expectedReasons: ["asks_to_scan_qr"],
      },
      {
        text: "A giveaway requires me to scan a QR code for the prize.",
        expectedReasons: ["asks_to_scan_qr"],
      },
      {
        text: "The caller wants a QR scan to confirm a money transfer.",
        expectedReasons: ["asks_to_scan_qr"],
      },
    ],
  },
};

interface MetaSeed {
  text: string;
  intent: MetaIntent;
}

const ORDINARY_SEEDS: Readonly<Record<Lang, readonly MetaSeed[]>> = {
  ru: [
    { text: "Привет", intent: "greeting" },
    { text: "Здравствуйте", intent: "greeting" },
    { text: "Добрый день", intent: "greeting" },
    { text: "Расскажи анекдот", intent: "off_topic" },
    { text: "Посоветуй фильм на вечер", intent: "off_topic" },
    { text: "Какая сегодня погода?", intent: "off_topic" },
    { text: "Почему небо голубое?", intent: "off_topic" },
    { text: "Помоги решить уравнение", intent: "off_topic" },
  ],
  uz: [
    { text: "Salom", intent: "greeting" },
    { text: "Assalomu alaykum", intent: "greeting" },
    { text: "Xayrli kun", intent: "greeting" },
    { text: "Bir latifa aytib bering", intent: "off_topic" },
    { text: "Film tavsiya qiling", intent: "off_topic" },
    { text: "Bugun ob-havo qanday?", intent: "off_topic" },
    { text: "Osmon nega ko'k?", intent: "off_topic" },
    { text: "Tenglamani yechishga yordam bering", intent: "off_topic" },
  ],
  en: [
    { text: "Hello", intent: "greeting" },
    { text: "Hi there", intent: "greeting" },
    { text: "Good afternoon", intent: "greeting" },
    { text: "Tell me a joke", intent: "off_topic" },
    { text: "Recommend a movie for tonight", intent: "off_topic" },
    { text: "What is the weather today?", intent: "off_topic" },
    { text: "Why is the sky blue?", intent: "off_topic" },
    { text: "Help me solve an equation", intent: "off_topic" },
  ],
};

const CAPABILITY_SEEDS: Readonly<Record<Lang, readonly MetaSeed[]>> = {
  ru: [
    { text: "Ты можешь проверить ссылку?", intent: "can_check_link" },
    { text: "Ты можешь проверить номер телефона?", intent: "can_check_phone" },
    { text: "Ты можешь проверить скриншот?", intent: "can_check_image" },
    { text: "Ты можешь проверить Telegram-аккаунт?", intent: "can_check_account" },
    { text: "Ты можешь проверить текст сообщения?", intent: "can_check_message" },
    { text: "Ты можешь проверить QR-код?", intent: "can_check_qr" },
  ],
  uz: [
    { text: "Havolani tekshira olasizmi?", intent: "can_check_link" },
    { text: "Telefon raqamini tekshira olasizmi?", intent: "can_check_phone" },
    { text: "Skrinshotni tekshira olasizmi?", intent: "can_check_image" },
    { text: "Telegram akkauntini tekshira olasizmi?", intent: "can_check_account" },
    { text: "Xabar matnini tekshira olasizmi?", intent: "can_check_message" },
    { text: "QR-kodni tekshira olasizmi?", intent: "can_check_qr" },
  ],
  en: [
    { text: "Can you check a link?", intent: "can_check_link" },
    { text: "Can you check a phone number?", intent: "can_check_phone" },
    { text: "Can you check a screenshot?", intent: "can_check_image" },
    { text: "Can you check a Telegram account?", intent: "can_check_account" },
    { text: "Can you check a message?", intent: "can_check_message" },
    { text: "Can you check a QR code?", intent: "can_check_qr" },
  ],
};

const META_SEEDS: Readonly<Record<Lang, readonly MetaSeed[]>> = {
  ru: [
    { text: "Как пользоваться ботом?", intent: "how_to_use" },
    { text: "Что ты умеешь?", intent: "what_can_you_do" },
    { text: "Как ты проверяешь такие вещи?", intent: "how_do_you_check" },
    { text: "Почему это опасно?", intent: "explain_risk" },
    { text: "Ты видишь SCAM-метку Telegram-аккаунта?", intent: "telegram_account_limits" },
    { text: "Почему ты не смог проанализировать картинку?", intent: "why_failed" },
    { text: "Помощь", intent: "help" },
    ...CAPABILITY_SEEDS.ru,
  ],
  uz: [
    { text: "Bu botdan qanday foydalanaman?", intent: "how_to_use" },
    { text: "Bot nima qiladi?", intent: "what_can_you_do" },
    { text: "Bunday narsalarni qanday tekshirasiz?", intent: "how_do_you_check" },
    { text: "Nega bu xavfli?", intent: "explain_risk" },
    { text: "Telegram akkauntidagi SCAM belgisini ko'rasizmi?", intent: "telegram_account_limits" },
    { text: "Nega rasmni o'qiy olmading?", intent: "why_failed" },
    { text: "Yordam", intent: "help" },
    ...CAPABILITY_SEEDS.uz,
  ],
  en: [
    { text: "How do I use this bot?", intent: "how_to_use" },
    { text: "What can you do?", intent: "what_can_you_do" },
    { text: "How do you check things like this?", intent: "how_do_you_check" },
    { text: "Why is this dangerous?", intent: "explain_risk" },
    { text: "Can you see a Telegram SCAM label?", intent: "telegram_account_limits" },
    { text: "The image OCR failed, why?", intent: "why_failed" },
    { text: "Help", intent: "help" },
    ...CAPABILITY_SEEDS.en,
  ],
};

const RISK_OPENERS: Readonly<Record<Lang, readonly string[]>> = {
  ru: [
    "Мне написал незнакомец.",
    "Звонок идёт прямо сейчас.",
    "В семейном чате обсуждаем это сообщение.",
    "Я пока ничего не подтвердил.",
    "Хочу проверить ситуацию до любого действия.",
  ],
  uz: [
    "Menga notanish odam yozdi.",
    "Hozir menga qo'ng'iroq qilishyapti.",
    "Oilaviy chatda shu xabarni muhokama qilyapmiz.",
    "Men hali hech narsani tasdiqlamadim.",
    "Biror ish qilishdan oldin vaziyatni tekshirmoqchiman.",
  ],
  en: [
    "A stranger contacted me.",
    "The call is happening right now.",
    "My family chat is discussing this message.",
    "I have not confirmed anything yet.",
    "I want to check the situation before taking action.",
  ],
};

const RISK_QUESTIONS: Readonly<Record<Lang, readonly string[]>> = {
  ru: [
    "Это похоже на обман?",
    "Что здесь опасного?",
    "Как поступить безопасно?",
    "Стоит ли прекращать разговор?",
    "Проверьте, пожалуйста, признаки риска.",
  ],
  uz: [
    "Bu firibgarlikka o'xshaydimi?",
    "Bu yerda nima xavfli?",
    "Qanday xavfsiz yo'l tutay?",
    "Suhbatni to'xtatish kerakmi?",
    "Xavf belgilarini tekshirib bering.",
  ],
  en: [
    "Does this look like a scam?",
    "What is dangerous here?",
    "What is the safe next step?",
    "Should I end the conversation?",
    "Please check the warning signs.",
  ],
};

const FOLLOW_UP_WRAPPERS: Readonly<Record<Lang, (text: string) => string>> = {
  ru: (text) => `Спасибо за помощь. Ещё один вопрос: ${text}`,
  uz: (text) => `Yordamingiz uchun rahmat. Yana bir savol: ${text}`,
  en: (text) => `Thanks for your help. One more question: ${text}`,
};

const ACKNOWLEDGEMENTS: Readonly<Record<Lang, string>> = {
  ru: FOLLOW_UP_GOLDEN_PHRASES.acknowledgement.ru.reply,
  uz: FOLLOW_UP_GOLDEN_PHRASES.acknowledgement.uz.reply,
  en: FOLLOW_UP_GOLDEN_PHRASES.acknowledgement.en.reply,
};

const FIXED_CHECK_AT = "2026-07-13T08:00:00.000Z";
const LANGUAGES: readonly Lang[] = ["ru", "uz", "en"];

function metaTurn(seed: MetaSeed): SyntheticMetaTurn {
  return {
    kind: "meta",
    utterance: seed.text,
    expectedIntent: seed.intent,
    expectedRoute: `meta.${seed.intent}`,
  };
}

function followUpTurn(
  action: LastCheckFollowUpAction,
  lang: Lang,
  ordinal: number,
): SyntheticFollowUpTurn {
  const variant = ordinal % 2 === 0 ? "reply" : "typo";
  const base = FOLLOW_UP_GOLDEN_PHRASES[action][lang][variant];
  const utterance = ordinal % 3 === 0 ? FOLLOW_UP_WRAPPERS[lang](base) : base;
  return {
    kind: "followup",
    utterance,
    expectedAction: action,
    expectedRoute: `followup.${action}`,
  };
}

function lastCheckFor(utterance: string): LastCheckSnapshot {
  const reasons = evaluateText(utterance);
  const { score, level } = scoreFromCodes(reasons);
  return buildLastCheckSnapshot(
    {
      type: "text",
      display: "[synthetic text]",
      level,
      score,
      reasons,
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    },
    new Date(FIXED_CHECK_AT),
  );
}

function buildRiskDialogue(
  id: number,
  category: Extract<
    SyntheticMultiturnDialogueCategory,
    | "code_theft"
    | "safe_account_transfer"
    | "credential_theft"
    | "malware_or_remote_access"
    | "qr_account_action"
  >,
  lang: Lang,
  langOrdinal: number,
): SyntheticMultiturnDialogue {
  const seeds = RISK_SEEDS[category][lang];
  const seed = seeds[langOrdinal % seeds.length];
  const opener = RISK_OPENERS[lang][Math.floor(langOrdinal / seeds.length) % 5];
  const question =
    RISK_QUESTIONS[lang][Math.floor(langOrdinal / (seeds.length * RISK_OPENERS[lang].length)) % 5];
  const riskTurn: SyntheticRiskTurn = {
    kind: "risk_check",
    utterance: `${opener} ${seed.text} ${question}`,
    expectedRoute: "input.risk_check",
    expectedReasons: seed.expectedReasons,
  };
  const action =
    ALL_LAST_CHECK_FOLLOW_UP_ACTIONS[(id + langOrdinal) % ALL_LAST_CHECK_FOLLOW_UP_ACTIONS.length];
  const secondTurn = followUpTurn(action, lang, langOrdinal);
  const acknowledgement: SyntheticFollowUpTurn = {
    kind: "followup",
    utterance: ACKNOWLEDGEMENTS[lang],
    expectedAction: "acknowledgement",
    expectedRoute: "followup.acknowledgement",
  };
  const turns: SyntheticDialogueTurns =
    id % 2 === 1 ? [riskTurn, secondTurn, acknowledgement] : [riskTurn, secondTurn];
  return {
    id: `synthetic-${String(id + 1).padStart(4, "0")}`,
    category,
    lang,
    turns,
    lastCheck: lastCheckFor(riskTurn.utterance),
  };
}

function buildMetaDialogue(
  id: number,
  category: Extract<
    SyntheticMultiturnDialogueCategory,
    "ordinary_to_capability" | "meta_exploration" | "ordinary_chitchat"
  >,
  lang: Lang,
  langOrdinal: number,
): SyntheticMultiturnDialogue {
  let firstPool: readonly MetaSeed[];
  let secondPool: readonly MetaSeed[];
  if (category === "ordinary_to_capability") {
    firstPool = ORDINARY_SEEDS[lang];
    secondPool = CAPABILITY_SEEDS[lang];
  } else if (category === "meta_exploration") {
    firstPool = META_SEEDS[lang];
    secondPool = META_SEEDS[lang];
  } else {
    firstPool = ORDINARY_SEEDS[lang];
    secondPool = ORDINARY_SEEDS[lang];
  }

  const first = firstPool[langOrdinal % firstPool.length];
  const second = secondPool[Math.floor(langOrdinal / firstPool.length) % secondPool.length];
  const firstTurn = metaTurn(first);
  const secondTurn = metaTurn(second);
  const thirdPool = category === "ordinary_chitchat" ? CAPABILITY_SEEDS[lang] : META_SEEDS[lang];
  const turns: SyntheticDialogueTurns =
    id % 2 === 1
      ? [firstTurn, secondTurn, metaTurn(thirdPool[(langOrdinal * 5 + 3) % thirdPool.length])]
      : [firstTurn, secondTurn];
  return {
    id: `synthetic-${String(id + 1).padStart(4, "0")}`,
    category,
    lang,
    turns,
  };
}

function buildCorpus(): SyntheticMultiturnDialogue[] {
  const rows: SyntheticMultiturnDialogue[] = [];
  for (const spec of CATEGORY_SPECS) {
    const languageOrdinals: Record<Lang, number> = { ru: 0, uz: 0, en: 0 };
    for (let index = 0; index < spec.count; index += 1) {
      const id = rows.length;
      const lang = LANGUAGES[id % LANGUAGES.length];
      const langOrdinal = languageOrdinals[lang]++;
      if (spec.mode === "risk") {
        rows.push(
          buildRiskDialogue(
            id,
            spec.category as Extract<
              SyntheticMultiturnDialogueCategory,
              | "code_theft"
              | "safe_account_transfer"
              | "credential_theft"
              | "malware_or_remote_access"
              | "qr_account_action"
            >,
            lang,
            langOrdinal,
          ),
        );
      } else {
        rows.push(
          buildMetaDialogue(
            id,
            spec.category as Extract<
              SyntheticMultiturnDialogueCategory,
              "ordinary_to_capability" | "meta_exploration" | "ordinary_chitchat"
            >,
            lang,
            langOrdinal,
          ),
        );
      }
    }
  }
  return rows;
}

export const SYNTHETIC_MULTITURN_DIALOGUE_CORPUS: readonly SyntheticMultiturnDialogue[] =
  buildCorpus();

export interface SyntheticMultiturnDialogueStats {
  totalDialogues: number;
  totalUserTurns: number;
  categoryCounts: Readonly<Record<SyntheticMultiturnDialogueCategory, number>>;
  languageCounts: Readonly<Record<Lang, number>>;
  turnCounts: Readonly<Record<2 | 3, number>>;
  routeCounts: Readonly<Record<CanonicalTelegramIntentId, number>>;
}

function buildStats(rows: readonly SyntheticMultiturnDialogue[]): SyntheticMultiturnDialogueStats {
  const categoryCounts = Object.fromEntries(
    SYNTHETIC_MULTITURN_DIALOGUE_CATEGORIES.map((category) => [category, 0]),
  ) as Record<SyntheticMultiturnDialogueCategory, number>;
  const languageCounts: Record<Lang, number> = { ru: 0, uz: 0, en: 0 };
  const turnCounts: Record<2 | 3, number> = { 2: 0, 3: 0 };
  const routeCounts = {} as Record<CanonicalTelegramIntentId, number>;
  let totalUserTurns = 0;

  for (const row of rows) {
    categoryCounts[row.category] += 1;
    languageCounts[row.lang] += 1;
    turnCounts[row.turns.length as 2 | 3] += 1;
    totalUserTurns += row.turns.length;
    for (const turn of row.turns) {
      routeCounts[turn.expectedRoute] = (routeCounts[turn.expectedRoute] ?? 0) + 1;
    }
  }

  return {
    totalDialogues: rows.length,
    totalUserTurns,
    categoryCounts,
    languageCounts,
    turnCounts,
    routeCounts,
  };
}

export const SYNTHETIC_MULTITURN_DIALOGUE_STATS: SyntheticMultiturnDialogueStats = buildStats(
  SYNTHETIC_MULTITURN_DIALOGUE_CORPUS,
);

export const SYNTHETIC_MULTITURN_FIXED_NOW = new Date(FIXED_CHECK_AT);
