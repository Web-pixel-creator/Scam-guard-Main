import type { Lang } from "@/lib/i18n";
import type { PanicScenarioId } from "@/lib/telegram/emergency";
import type { VictimIntentKind } from "@/lib/telegram/victim-intent";

type VictimExpectedRoute = {
  kind: "victim_intent";
  intent: VictimIntentKind;
  replyIncludes: string;
};

type HandlerReplyExpectedRoute = {
  kind: "handler_reply";
  route: "orphan_followup" | "confirmation_followup";
  replyIncludes: string;
};

type PanicExpectedRoute = {
  kind: "panic";
  panicId: PanicScenarioId;
};

type RiskPipelineExpectedRoute = {
  kind: "risk_pipeline";
};

export type LivePhraseExpectedRoute =
  | VictimExpectedRoute
  | HandlerReplyExpectedRoute
  | PanicExpectedRoute
  | RiskPipelineExpectedRoute;

export type LivePhraseCase = {
  area: string;
  text: string;
  lang?: Lang;
  expected: LivePhraseExpectedRoute;
};

export const LIVE_PHRASE_CASES = [
  {
    area: "emotion",
    text: "помогите",
    expected: { kind: "victim_intent", intent: "emotional_help", replyIncludes: "Я рядом" },
  },
  {
    area: "emotion",
    text: "срочно помогите",
    expected: { kind: "victim_intent", intent: "emotional_help", replyIncludes: "Я рядом" },
  },
  {
    area: "emotion",
    text: "я боюсь",
    expected: { kind: "victim_intent", intent: "emotional_help", replyIncludes: "Я рядом" },
  },
  {
    area: "emotion",
    text: "мне страшно",
    expected: { kind: "victim_intent", intent: "emotional_help", replyIncludes: "Я рядом" },
  },
  {
    area: "advice",
    text: "я не знаю что делать",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "Безопасный шаг прямо сейчас",
    },
  },
  {
    area: "general concern",
    text: "меня пытаются обмануть",
    expected: {
      kind: "victim_intent",
      intent: "general_scam_concern",
      replyIncludes: "Вы правильно остановились",
    },
  },
  {
    area: "general concern",
    text: "мне кажется это скам",
    expected: {
      kind: "victim_intent",
      intent: "general_scam_concern",
      replyIncludes: "Вы правильно остановились",
    },
  },
  {
    area: "general concern",
    text: "думаю это мошенники",
    expected: {
      kind: "victim_intent",
      intent: "general_scam_concern",
      replyIncludes: "Вы правильно остановились",
    },
  },
  {
    area: "call",
    text: "мне звонят",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "call",
    text: "мне звонят прямо сейчас",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "call",
    text: "мне звонит неизвестный номер",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "call",
    text: "мне звонят с незнакомого номера",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "call",
    text: "мне звонят и говорят не кладите трубку",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "call",
    text: "звонит мошенник",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "call",
    text: "мошенник звонит",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "bank call",
    text: "звонят из банка",
    expected: { kind: "victim_intent", intent: "bank_call", replyIncludes: "официальный канал" },
  },
  {
    area: "bank call",
    text: "мне звонили из банка",
    expected: { kind: "victim_intent", intent: "bank_call", replyIncludes: "официальный канал" },
  },
  {
    area: "authority call",
    text: "мне звонит фейковый майор",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "authority call",
    text: "мне звонят из полиции",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "contact",
    text: "мне пишет незнакомый человек",
    expected: {
      kind: "victim_intent",
      intent: "unknown_contact",
      replyIncludes: "Незнакомец сам по себе",
    },
  },
  {
    area: "contact",
    text: "мне пишет какой-то неизвестный человек",
    expected: {
      kind: "victim_intent",
      intent: "unknown_contact",
      replyIncludes: "Незнакомец сам по себе",
    },
  },
  {
    area: "contact",
    text: "мне пишет неизвестный номер",
    expected: {
      kind: "victim_intent",
      intent: "unknown_contact",
      replyIncludes: "Незнакомец сам по себе",
    },
  },
  {
    area: "identity",
    text: "мне пишет одноклассник, но я не уверен что это он",
    expected: { kind: "victim_intent", intent: "identity_uncertain", replyIncludes: "не уверены" },
  },
  {
    area: "identity",
    text: "мне пишет родственник но странным образом",
    expected: { kind: "victim_intent", intent: "identity_uncertain", replyIncludes: "не уверены" },
  },
  {
    area: "friend money",
    text: "мне написал друг и просит деньги",
    expected: {
      kind: "victim_intent",
      intent: "friend_money",
      replyIncludes: "подтвердите личность",
    },
  },
  {
    area: "support",
    text: "мне пишет кто-то из техподдержки",
    expected: {
      kind: "victim_intent",
      intent: "support_impersonation",
      replyIncludes: "Поддержка/служба безопасности",
    },
  },
  {
    area: "support",
    text: "мне пишет служба безопасности",
    expected: {
      kind: "victim_intent",
      intent: "support_impersonation",
      replyIncludes: "Поддержка/служба безопасности",
    },
  },
  {
    area: "support",
    text: "мне пишет банк",
    expected: {
      kind: "victim_intent",
      intent: "support_impersonation",
      replyIncludes: "Поддержка/служба безопасности",
    },
  },
  {
    area: "romance",
    text: "мне пишет девушка из интернета",
    expected: {
      kind: "victim_intent",
      intent: "romance_contact",
      replyIncludes: "романтический знакомый",
    },
  },
  {
    area: "romance",
    text: "девушка из интернета просит деньги на билет",
    expected: {
      kind: "victim_intent",
      intent: "romance_money",
      replyIncludes: "частый сценарий обмана",
    },
  },
  {
    area: "job",
    text: "мне пишет работодатель",
    expected: { kind: "victim_intent", intent: "job_offer", replyIncludes: "Работа/лёгкий доход" },
  },
  {
    area: "job",
    text: "работодатель просит оплатить обучение перед работой",
    expected: { kind: "victim_intent", intent: "job_offer", replyIncludes: "Работа/лёгкий доход" },
  },
  {
    area: "earning channel",
    text: "меня приглашают в канал для заработка",
    expected: { kind: "victim_intent", intent: "job_offer", replyIncludes: "Работа/лёгкий доход" },
  },
  {
    area: "earning channel",
    text: "меня зовут вступить в канал для заработка",
    expected: { kind: "victim_intent", intent: "job_offer", replyIncludes: "Работа/лёгкий доход" },
  },
  {
    area: "earning channel",
    text: "меня добавили в группу для заработка",
    expected: { kind: "victim_intent", intent: "job_offer", replyIncludes: "Работа/лёгкий доход" },
  },
  {
    area: "code request",
    text: "у меня просят код",
    expected: {
      kind: "victim_intent",
      intent: "code_request",
      replyIncludes: "Код никому не называйте",
    },
  },
  {
    area: "code request",
    text: "мне пишет незнакомый человек. Он хочет смс код",
    expected: {
      kind: "victim_intent",
      intent: "code_request",
      replyIncludes: "Код никому не называйте",
    },
  },
  {
    area: "code request",
    text: "меня просят подтвердить вход",
    expected: {
      kind: "handler_reply",
      route: "confirmation_followup",
      replyIncludes: "Подтверждение",
    },
  },
  {
    area: "code request",
    text: "у меня просят подтвердить перевод",
    expected: {
      kind: "handler_reply",
      route: "confirmation_followup",
      replyIncludes: "Подтверждение",
    },
  },
  {
    area: "card request",
    text: "у меня просят карту",
    expected: { kind: "victim_intent", intent: "card_request", replyIncludes: "Данные карты" },
  },
  {
    area: "card request",
    text: "у меня просят последние цифры карты",
    expected: { kind: "victim_intent", intent: "card_request", replyIncludes: "Данные карты" },
  },
  {
    area: "card request",
    text: "у меня просят CVV",
    expected: { kind: "victim_intent", intent: "card_request", replyIncludes: "Данные карты" },
  },
  {
    area: "personal data",
    text: "у меня просят паспорт",
    expected: { kind: "victim_intent", intent: "personal_data_request", replyIncludes: "Паспорт" },
  },
  {
    area: "personal data",
    text: "у меня просят ПИНФЛ",
    expected: { kind: "victim_intent", intent: "personal_data_request", replyIncludes: "Паспорт" },
  },
  {
    area: "transfer request",
    text: "меня просят перевести деньги",
    expected: {
      kind: "victim_intent",
      intent: "transfer_request",
      replyIncludes: "Деньги пока не переводите",
    },
  },
  {
    area: "transfer request",
    text: "мне сказали сделать перевод на карту",
    expected: {
      kind: "victim_intent",
      intent: "transfer_request",
      replyIncludes: "Деньги пока не переводите",
    },
  },
  {
    area: "link request",
    text: "у меня просят перейти по ссылке",
    expected: { kind: "victim_intent", intent: "link_request", replyIncludes: "Ссылку или QR" },
  },
  {
    area: "voting link",
    text: "меня просят проголосовать на канале и перейти по ссылке",
    expected: { kind: "victim_intent", intent: "link_request", replyIncludes: "Ссылку или QR" },
  },
  {
    area: "apk request",
    text: "меня просят скачать приложение",
    expected: {
      kind: "victim_intent",
      intent: "apk_request",
      replyIncludes: "Не устанавливайте APK",
    },
  },
  {
    area: "apk request",
    text: "меня просят установить AnyDesk",
    expected: {
      kind: "victim_intent",
      intent: "apk_request",
      replyIncludes: "Не устанавливайте APK",
    },
  },
  {
    area: "link received",
    text: "мне прислали ссылку",
    expected: {
      kind: "victim_intent",
      intent: "link_received",
      replyIncludes: "Пока не открывайте ссылку",
    },
  },
  {
    area: "file received",
    text: "мне прислали файл",
    expected: {
      kind: "victim_intent",
      intent: "file_received",
      replyIncludes: "Файл от незнакомого источника",
    },
  },
  {
    area: "unknown object",
    text: "мне что-то прислали",
    expected: {
      kind: "victim_intent",
      intent: "telegram_message",
      replyIncludes: "вам пишут в Telegram",
    },
  },
  {
    area: "bank contact",
    text: "как мне связаться с банком?",
    expected: {
      kind: "victim_intent",
      intent: "bank_contact_question",
      replyIncludes: "Официальный обратный звонок",
    },
  },
  {
    area: "report",
    text: "куда пожаловаться на мошенника",
    expected: { kind: "victim_intent", intent: "report_question", replyIncludes: "сохранить чеки" },
  },
  {
    area: "acknowledgement",
    text: "хорошо сделаю",
    expected: {
      kind: "victim_intent",
      intent: "acknowledgement",
      replyIncludes: "по одному безопасному шагу",
    },
  },
  {
    area: "greeting",
    text: "Salom",
    expected: {
      kind: "victim_intent",
      intent: "trust_or_greeting",
      replyIncludes: "Ishonch Guard",
    },
  },
  {
    area: "uzbek code",
    text: "menga kod so'rashyapti",
    lang: "uz",
    expected: {
      kind: "victim_intent",
      intent: "code_request",
      replyIncludes: "Kodni hech kimga aytmang",
    },
  },
  {
    area: "uzbek call",
    text: "menga noma'lum raqamdan qo'ng'iroq qilishyapti",
    lang: "uz",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "uzbek concern",
    text: "meni aldayapti",
    lang: "uz",
    expected: {
      kind: "victim_intent",
      intent: "general_scam_concern",
      replyIncludes: "To'g'ri to'xtadingiz",
    },
  },
  {
    area: "english code",
    text: "someone asked me for a verification code",
    lang: "en",
    expected: {
      kind: "victim_intent",
      intent: "code_request",
      replyIncludes: "Do not tell anyone the code",
    },
  },
  {
    area: "english call",
    text: "someone is calling me from an unknown number",
    lang: "en",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "english bank contact",
    text: "how do I call the bank",
    lang: "en",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "Official callback",
    },
  },
  {
    area: "english apk",
    text: "they asked me to install an app",
    lang: "en",
    expected: { kind: "victim_intent", intent: "apk_request", replyIncludes: "Do not install" },
  },
  {
    area: "sent code",
    text: "Я только что передал код из СМС",
    expected: { kind: "panic", panicId: 1 },
  },
  {
    area: "sent code",
    text: "я отправил смс код",
    expected: { kind: "panic", panicId: 1 },
  },
  {
    area: "sent code",
    text: "я уже назвал цифры",
    expected: { kind: "panic", panicId: 1 },
  },
  {
    area: "uzbek sent code",
    text: "men kodni yubordim",
    lang: "uz",
    expected: { kind: "panic", panicId: 1 },
  },
  {
    area: "english sent code",
    text: "I already sent the SMS code",
    lang: "en",
    expected: { kind: "panic", panicId: 1 },
  },
  {
    area: "sent money",
    text: "я уже перевел деньги",
    expected: { kind: "panic", panicId: 3 },
  },
  {
    area: "sent money",
    text: "я уже сделал перевод",
    expected: { kind: "panic", panicId: 3 },
  },
  {
    area: "card data sent",
    text: "я уже ввел данные карты",
    expected: { kind: "panic", panicId: 4 },
  },
  {
    area: "apk installed",
    text: "я уже установил apk",
    expected: { kind: "panic", panicId: 2 },
  },
  {
    area: "remote access",
    text: "я уже дал доступ к телефону",
    expected: { kind: "panic", panicId: 2 },
  },
  {
    area: "english card sent",
    text: "I already entered card details",
    lang: "en",
    expected: { kind: "panic", panicId: 4 },
  },
  {
    area: "direct scam payload",
    text: "Служба безопасности Kapitalbank. Ваша карта заблокирована. Назовите код из SMS.",
    expected: { kind: "risk_pipeline" },
  },
  {
    area: "direct scam payload",
    text: "Salom, bu kodni kiriting please: 1234",
    lang: "uz",
    expected: { kind: "risk_pipeline" },
  },
] as const satisfies readonly LivePhraseCase[];
