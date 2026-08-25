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
  route: "orphan_followup" | "confirmation_followup" | "sensitive_secret";
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

export const LIVE_PHRASE_CASES: readonly LivePhraseCase[] = [
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
    area: "emotion",
    text: "мне нужна помощь",
    expected: { kind: "victim_intent", intent: "emotional_help", replyIncludes: "Я рядом" },
  },
  {
    area: "emotion",
    text: "я запутался",
    expected: { kind: "victim_intent", intent: "emotional_help", replyIncludes: "Я рядом" },
  },
  {
    area: "emotion",
    text: "я волнуюсь",
    expected: { kind: "victim_intent", intent: "emotional_help", replyIncludes: "Я рядом" },
  },
  {
    area: "emotion",
    text: "help me",
    lang: "en",
    expected: { kind: "victim_intent", intent: "emotional_help", replyIncludes: "I am here" },
  },
  {
    area: "emotion",
    text: "I am scared",
    lang: "en",
    expected: { kind: "victim_intent", intent: "emotional_help", replyIncludes: "I am here" },
  },
  {
    area: "emotion",
    text: "yordam kerak",
    lang: "uz",
    expected: {
      kind: "victim_intent",
      intent: "emotional_help",
      replyIncludes: "Men yoningizdaman",
    },
  },
  {
    area: "emotion",
    text: "qo'rqyapman",
    lang: "uz",
    expected: {
      kind: "victim_intent",
      intent: "emotional_help",
      replyIncludes: "Men yoningizdaman",
    },
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
      replyIncludes: "Хорошо, что вы решили проверить",
    },
  },
  {
    area: "general concern",
    text: "мне кажется это скам",
    expected: {
      kind: "victim_intent",
      intent: "general_scam_concern",
      replyIncludes: "Хорошо, что вы решили проверить",
    },
  },
  {
    area: "general concern",
    text: "думаю это мошенники",
    expected: {
      kind: "victim_intent",
      intent: "general_scam_concern",
      replyIncludes: "Хорошо, что вы решили проверить",
    },
  },
  {
    area: "general concern",
    text: "кажется меня разводят",
    expected: {
      kind: "victim_intent",
      intent: "general_scam_concern",
      replyIncludes: "Хорошо, что вы решили проверить",
    },
  },
  {
    area: "general concern",
    text: "не понимаю это обман или нет",
    expected: {
      kind: "victim_intent",
      intent: "general_scam_concern",
      replyIncludes: "Хорошо, что вы решили проверить",
    },
  },
  {
    area: "general concern",
    text: "someone is trying to scam me",
    lang: "en",
    expected: {
      kind: "victim_intent",
      intent: "general_scam_concern",
      replyIncludes: "It is good that you decided to check",
    },
  },
  {
    area: "general concern",
    text: "meni firibgarlar aldayapti",
    lang: "uz",
    expected: {
      kind: "victim_intent",
      intent: "general_scam_concern",
      replyIncludes: "Tekshirishga qaror qilganingiz yaxshi",
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
    area: "call",
    text: "звонят с зарубежного номера",
    expected: {
      kind: "victim_intent",
      intent: "foreign_call",
      replyIncludes: "Иностранный номер",
    },
  },
  {
    area: "call",
    text: "мне звонят с другой страны. Просто звонок с другой страны, брать трубку?",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "call",
    text: "мне звонят из Нигерии",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "call",
    text: "мне звонят с номера +998",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "call",
    text: "мне звонят и торопят",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "call",
    text: "they keep calling me",
    lang: "en",
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
    area: "bank call",
    text: "со мной связался сотрудник банка",
    expected: { kind: "victim_intent", intent: "bank_call", replyIncludes: "официальный канал" },
  },
  {
    area: "bank call",
    text: "мне позвонила служба безопасности",
    expected: { kind: "victim_intent", intent: "bank_call", replyIncludes: "официальный канал" },
  },
  {
    area: "bank call",
    text: "звонили и сказали что карта заблокирована",
    expected: { kind: "victim_intent", intent: "bank_call", replyIncludes: "официальный канал" },
  },
  {
    area: "operator call",
    text: "мне звонит директор билайна",
    expected: { kind: "victim_intent", intent: "operator_call", replyIncludes: "оператор" },
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
    area: "authority call",
    text: "мне звонит следователь",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "authority call",
    text: "мне звонит прокуратура",
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
    area: "contact",
    text: "мне написал неизвестный человек",
    expected: {
      kind: "victim_intent",
      intent: "unknown_contact",
      replyIncludes: "Незнакомец сам по себе",
    },
  },
  {
    area: "contact",
    text: "со мной связался незнакомец",
    expected: {
      kind: "victim_intent",
      intent: "unknown_contact",
      replyIncludes: "Незнакомец сам по себе",
    },
  },
  {
    area: "contact",
    text: "someone unknown is messaging me",
    lang: "en",
    expected: {
      kind: "victim_intent",
      intent: "unknown_contact",
      replyIncludes: "A stranger alone",
    },
  },
  {
    area: "contact",
    text: "menga notanish odam yozdi",
    lang: "uz",
    expected: {
      kind: "victim_intent",
      intent: "unknown_contact",
      replyIncludes: "Notanish odamning o'zi",
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
    area: "identity",
    text: "мне пишет друг, но я сомневаюсь что это он",
    expected: { kind: "victim_intent", intent: "identity_uncertain", replyIncludes: "не уверены" },
  },
  {
    area: "identity",
    text: "мне пишет мама странно и просит не звонить",
    expected: { kind: "victim_intent", intent: "identity_uncertain", replyIncludes: "не уверены" },
  },
  {
    area: "identity",
    text: "my friend is messaging me but I am not sure it is him",
    lang: "en",
    expected: { kind: "victim_intent", intent: "identity_uncertain", replyIncludes: "not sure" },
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
    area: "friend money",
    text: "мне пишет родственник и просит перевести срочно",
    expected: {
      kind: "victim_intent",
      intent: "friend_money",
      replyIncludes: "подтвердите личность",
    },
  },
  {
    area: "friend money",
    text: "мама просит срочно отправить деньги",
    expected: {
      kind: "victim_intent",
      intent: "friend_money",
      replyIncludes: "подтвердите личность",
    },
  },
  {
    area: "friend money",
    text: "моей бабушке звонил мошенник. Он просил срочно прислать деньги на помощь",
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
    area: "support",
    text: "мне пишет бот от имени банка",
    expected: {
      kind: "victim_intent",
      intent: "support_impersonation",
      replyIncludes: "Поддержка/служба безопасности",
    },
  },
  {
    area: "support",
    text: "bank support is messaging me",
    lang: "en",
    expected: {
      kind: "victim_intent",
      intent: "support_impersonation",
      replyIncludes: "Support/security service",
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
    text: "со мной познакомилась девушка в телеграме",
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
    area: "romance",
    text: "новая знакомая просит деньги на лечение",
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
    area: "job",
    text: "работодатель просит оплатить форму",
    expected: { kind: "victim_intent", intent: "job_offer", replyIncludes: "Работа/лёгкий доход" },
  },
  {
    area: "job",
    text: "предлагают работу но надо внести депозит",
    expected: { kind: "victim_intent", intent: "job_offer", replyIncludes: "Работа/лёгкий доход" },
  },
  {
    area: "earning channel",
    text: "меня приглашают в канал для заработка",
    expected: {
      kind: "victim_intent",
      intent: "earning_channel",
      replyIncludes: "быстрым заработком",
    },
  },
  {
    area: "crypto investment",
    text: "мне предлагают инвестировать в крипту через телеграм канал",
    expected: {
      kind: "victim_intent",
      intent: "investment_offer",
      replyIncludes: "Инвестиции/крипта",
    },
  },
  {
    area: "crypto investment",
    text: "зовут в крипто канал с платными сигналами",
    expected: {
      kind: "victim_intent",
      intent: "investment_offer",
      replyIncludes: "Инвестиции/крипта",
    },
  },
  {
    area: "crypto investment",
    text: "предлагают TON wallet с гарантированной прибылью",
    expected: {
      kind: "victim_intent",
      intent: "investment_offer",
      replyIncludes: "Инвестиции/крипта",
    },
  },
  {
    area: "travel migration",
    text: "агентство обещает визу в Корею но просит предоплату",
    expected: {
      kind: "victim_intent",
      intent: "travel_migration_prepayment",
      replyIncludes: "Визы, работа за границей",
    },
  },
  {
    area: "travel migration",
    text: "турфирма просит оплатить хадж заранее",
    expected: {
      kind: "victim_intent",
      intent: "travel_migration_prepayment",
      replyIncludes: "Визы, работа за границей",
    },
  },
  {
    area: "travel migration",
    text: "обещают работу в России но нужен сбор за документы",
    expected: {
      kind: "victim_intent",
      intent: "travel_migration_prepayment",
      replyIncludes: "Визы, работа за границей",
    },
  },
  {
    area: "earning channel",
    text: "меня зовут вступить в канал для заработка",
    expected: {
      kind: "victim_intent",
      intent: "earning_channel",
      replyIncludes: "быстрым заработком",
    },
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
    text: "у меня просят пароль",
    expected: {
      kind: "victim_intent",
      intent: "code_request",
      replyIncludes: "Код никому не называйте",
    },
  },
  {
    area: "code request",
    text: "мне сказали назвать цифры из сообщения",
    expected: {
      kind: "victim_intent",
      intent: "code_request",
      replyIncludes: "Код никому не называйте",
    },
  },
  {
    area: "code request",
    text: "просят отправить код подтверждения в чат",
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
    area: "card request",
    text: "у меня просят пин от карты",
    expected: { kind: "victim_intent", intent: "card_request", replyIncludes: "Данные карты" },
  },
  {
    area: "card request",
    text: "спрашивают реквизиты карты",
    expected: { kind: "victim_intent", intent: "card_request", replyIncludes: "Данные карты" },
  },
  {
    area: "card request",
    text: "просят фото карты",
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
    area: "personal data",
    text: "у меня просят фото паспорта",
    expected: { kind: "victim_intent", intent: "personal_data_request", replyIncludes: "Паспорт" },
  },
  {
    area: "personal data",
    text: "у меня просят JSHSHIR",
    expected: { kind: "victim_intent", intent: "personal_data_request", replyIncludes: "Паспорт" },
  },
  {
    area: "personal data",
    text: "у меня просят дату рождения и адрес",
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
    area: "transfer request",
    text: "просят отправить деньги на этот номер",
    expected: {
      kind: "victim_intent",
      intent: "transfer_request",
      replyIncludes: "Деньги пока не переводите",
    },
  },
  {
    area: "transfer request",
    text: "у меня просят оплатить комиссию",
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
    area: "link request",
    text: "мне сказали открыть ссылку",
    expected: { kind: "victim_intent", intent: "link_request", replyIncludes: "Ссылку или QR" },
  },
  {
    area: "link request",
    text: "нужно перейти по QR",
    expected: { kind: "victim_intent", intent: "link_request", replyIncludes: "Ссылку или QR" },
  },
  {
    area: "voting link",
    text: "меня просят проголосовать на канале и перейти по ссылке",
    expected: {
      kind: "victim_intent",
      intent: "telegram_takeover",
      replyIncludes: "Telegram-аккаунт",
    },
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
    area: "apk request",
    text: "у меня просят дать доступ к телефону",
    expected: {
      kind: "victim_intent",
      intent: "apk_request",
      replyIncludes: "Не устанавливайте APK",
    },
  },
  {
    area: "apk request",
    text: "просят включить демонстрацию экрана",
    expected: {
      kind: "victim_intent",
      intent: "apk_request",
      replyIncludes: "Не устанавливайте APK",
    },
  },
  {
    area: "news-derived utility",
    text: "звонят из водоканала и просят паспорт для умного счетчика",
    expected: {
      kind: "victim_intent",
      intent: "utility_impersonation",
      replyIncludes: "Водоканал",
    },
  },
  {
    area: "news-derived utility",
    text: "пишут из сувсоза и требуют данные для заявки",
    expected: {
      kind: "victim_intent",
      intent: "utility_impersonation",
      replyIncludes: "Suvsoz",
    },
  },
  {
    area: "news-derived pension",
    text: "пенсионный фонд обещает повысить пенсию и просит данные карты",
    expected: {
      kind: "victim_intent",
      intent: "pension_benefit",
      replyIncludes: "Перерасчёт пенсии",
    },
  },
  {
    area: "news-derived phone borrowing",
    text: "незнакомец просит телефон на минуту позвонить",
    expected: {
      kind: "victim_intent",
      intent: "phone_borrowing",
      replyIncludes: "Не отдавайте",
    },
  },
  {
    area: "news-derived money mule",
    text: "деньги пришли по ошибке просят вернуть на другой счет",
    expected: {
      kind: "victim_intent",
      intent: "money_mule",
      replyIncludes: "по ошибке",
    },
  },
  {
    area: "news-derived telegram takeover",
    text: "официальный Telegram просит пройти проверку иначе аккаунт удалят",
    expected: {
      kind: "victim_intent",
      intent: "telegram_takeover",
      replyIncludes: "Telegram-аккаунт",
    },
  },
  {
    area: "news-derived telegram takeover",
    text: "мне пишут от имени Telegram с галочкой",
    expected: {
      kind: "victim_intent",
      intent: "telegram_takeover",
      replyIncludes: "Telegram-аккаунт",
    },
  },
  {
    area: "news-derived apple",
    text: "оповещение Apple iOS повреждена на 72 процента просит установить защиту",
    expected: {
      kind: "victim_intent",
      intent: "apple_security",
      replyIncludes: "Apple/iOS",
    },
  },
  {
    area: "news-derived open budget",
    text: "покупают голос Open Budget и просят SMS код",
    expected: {
      kind: "victim_intent",
      intent: "open_budget",
      replyIncludes: "Open Budget",
    },
  },
  {
    area: "news-derived medical",
    text: "врач DMED просит SMS код для записи",
    expected: {
      kind: "victim_intent",
      intent: "medical_code",
      replyIncludes: "DMED",
    },
  },
  {
    area: "news-derived children",
    text: "ребенку предлагают бесплатные бонусы в игре и просят код",
    expected: {
      kind: "victim_intent",
      intent: "child_game_bonus",
      replyIncludes: "Бесплатные бонусы",
    },
  },
  {
    area: "news-derived silent call",
    text: "звонят и молчат чтобы записать голос",
    expected: {
      kind: "victim_intent",
      intent: "silent_call",
      replyIncludes: "звонят и молчат",
    },
  },
  {
    area: "news-derived official",
    text: "инспектор МИБ требует наличные за списание долга",
    expected: {
      kind: "victim_intent",
      intent: "official_impersonation",
      replyIncludes: "Госорган",
    },
  },
  {
    area: "news-derived official",
    text: "агентство Хотели в Солик войти",
    expected: {
      kind: "victim_intent",
      intent: "gov_service_login",
      replyIncludes: "Soliq",
    },
  },
  {
    area: "news-derived official",
    text: "Хотели в Soliq войти",
    expected: {
      kind: "victim_intent",
      intent: "gov_service_login",
      replyIncludes: "Soliq",
    },
  },
  {
    area: "news-derived official",
    text: "мне звонили из солик",
    expected: {
      kind: "victim_intent",
      intent: "official_impersonation",
      replyIncludes: "налоговой",
    },
  },
  {
    area: "news-derived foreign call",
    text: "мне звонят с +988 и представляются сотрудником банка, просят данные карты и SMS",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "news-derived foreign call",
    text: "мне звонят с +98 говорят Uzmobile и просят код для защиты номера от блокировки",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "news-derived foreign call",
    text: "мне звонят по 15 раз с иностранного номера и просят карту и код из SMS",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "news-derived foreign call",
    text: "мне звонит Uztelecom с +996 договор истекает и просят SMS код",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "news-derived telegram takeover",
    text: "мне пришло сообщение от Telegram аккаунт удален нажмите Отмена чтобы спасти профиль",
    expected: {
      kind: "victim_intent",
      intent: "telegram_takeover",
      replyIncludes: "Telegram-аккаунт",
    },
  },
  {
    area: "news-derived telegram takeover",
    text: "мне пришел подарок Telegram Premium надо активировать по ссылке",
    expected: {
      kind: "victim_intent",
      intent: "telegram_takeover",
      replyIncludes: "Telegram-аккаунт",
    },
  },
  {
    area: "news-derived telegram takeover",
    text: "мне пишет знакомый и просит проголосовать в конкурсе по ссылке",
    expected: {
      kind: "victim_intent",
      intent: "telegram_takeover",
      replyIncludes: "Telegram-аккаунт",
    },
  },
  {
    area: "news-derived telegram takeover",
    text: "просят проголосовать за лучшую мамочку по ссылке",
    expected: {
      kind: "victim_intent",
      intent: "telegram_takeover",
      replyIncludes: "Telegram-аккаунт",
    },
  },
  {
    area: "news-derived file",
    text: "прислали APK повестка в суд",
    expected: {
      kind: "victim_intent",
      intent: "file_received",
      replyIncludes: "Файл от незнакомого источника",
    },
  },
  {
    area: "news-derived file",
    text: "в телеграм пришел файл повестка.pdf.apk",
    expected: {
      kind: "victim_intent",
      intent: "file_received",
      replyIncludes: "Файл от незнакомого источника",
    },
  },
  {
    area: "news-derived file",
    text: "мне прислали голосовое сообщение как файл и говорят открыть",
    expected: {
      kind: "victim_intent",
      intent: "file_received",
      replyIncludes: "Файл от незнакомого источника",
    },
  },
  {
    area: "news-derived file",
    text: "прислали GIF открытку с новым годом и файл pptx",
    expected: {
      kind: "victim_intent",
      intent: "file_received",
      replyIncludes: "Файл от незнакомого источника",
    },
  },
  {
    area: "news-derived apple",
    text: "всплывающее окно Apple ID просит пароль для проверки аккаунта",
    expected: {
      kind: "victim_intent",
      intent: "apple_security",
      replyIncludes: "Apple/iOS",
    },
  },
  {
    area: "news-derived money mule",
    text: "у банкомата незнакомец просит снять деньги с моей карты",
    expected: {
      kind: "victim_intent",
      intent: "money_mule",
      replyIncludes: "по ошибке",
    },
  },
  {
    area: "news-derived utility",
    text: "пишут что нулевой баланс за газ и нужно перейти по ссылке для проверки",
    expected: {
      kind: "victim_intent",
      intent: "utility_impersonation",
      replyIncludes: "Водоканал",
    },
  },
  {
    area: "news-derived official",
    text: "мне звонят из госорганов знают ФИО и ПИНФЛ просят код",
    expected: { kind: "panic", panicId: 6 },
  },
  {
    area: "card request",
    text: "у меня спрашивают три цифры на обороте карты",
    expected: {
      kind: "victim_intent",
      intent: "card_request",
      replyIncludes: "Данные карты",
    },
  },
  {
    area: "news-derived medical",
    text: "поликлиника просит SMS код для записи в DMED",
    expected: {
      kind: "victim_intent",
      intent: "medical_code",
      replyIncludes: "DMED",
    },
  },
  {
    area: "friend money",
    text: "знакомый пишет срочно одолжи деньги верну через пару часов",
    expected: {
      kind: "victim_intent",
      intent: "friend_money",
      replyIncludes: "подтвердите личность",
    },
  },
  {
    area: "news-derived children",
    text: "ребенку обещают бесплатные бонусы в игре и просят код",
    expected: {
      kind: "victim_intent",
      intent: "child_game_bonus",
      replyIncludes: "Бесплатные бонусы",
    },
  },
  {
    area: "news-derived children",
    text: "ребёнку обещают робуксы и просят код",
    expected: {
      kind: "victim_intent",
      intent: "child_game_bonus",
      replyIncludes: "Бесплатные бонусы",
    },
  },
  {
    area: "news-derived earning channel",
    text: "мне предлагают бот для заработка 500 тысяч сум в день по нажатию кнопки",
    expected: {
      kind: "victim_intent",
      intent: "earning_channel",
      replyIncludes: "быстрым заработком",
    },
  },
  {
    area: "news-derived earning channel",
    text: "мне предлагают бот для заработка 500 тысяч сум в день",
    expected: {
      kind: "victim_intent",
      intent: "earning_channel",
      replyIncludes: "быстрым заработком",
    },
  },
  {
    area: "code request",
    text: "звонят из почты для получения посылки нужно продиктовать SMS код",
    expected: {
      kind: "victim_intent",
      intent: "code_request",
      replyIncludes: "Код никому не называйте",
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
    area: "file received",
    text: "мне скинули APK файл",
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
    area: "unknown object",
    text: "мне пришло странное сообщение",
    expected: {
      kind: "victim_intent",
      intent: "telegram_message",
      replyIncludes: "вам пишут в Telegram",
    },
  },
  {
    area: "telegram message",
    text: "мне пишут в телеграме",
    expected: {
      kind: "victim_intent",
      intent: "telegram_message",
      replyIncludes: "вам пишут в Telegram",
    },
  },
  {
    area: "telegram message",
    text: "мне пишет администратор канала",
    expected: {
      kind: "victim_intent",
      intent: "telegram_message",
      replyIncludes: "вам пишут в Telegram",
    },
  },
  {
    area: "telegram message",
    text: "администратор канала написал мне",
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
    area: "report",
    text: "куда звонить если меня обманули",
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
    area: "acknowledgement",
    text: "спасибо",
    expected: {
      kind: "victim_intent",
      intent: "acknowledgement",
      replyIncludes: "по одному безопасному шагу",
    },
  },
  {
    area: "acknowledgement",
    text: "понял",
    expected: {
      kind: "victim_intent",
      intent: "acknowledgement",
      replyIncludes: "по одному безопасному шагу",
    },
  },
  {
    area: "acknowledgement",
    text: "рахмат",
    lang: "uz",
    expected: {
      kind: "victim_intent",
      intent: "acknowledgement",
      replyIncludes: "bitta xavfsiz qadam",
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
    area: "greeting",
    text: "привет",
    expected: {
      kind: "victim_intent",
      intent: "trust_or_greeting",
      replyIncludes: "Ishonch Guard",
    },
  },
  {
    area: "greeting",
    text: "а вы кто?",
    expected: {
      kind: "victim_intent",
      intent: "trust_or_greeting",
      replyIncludes: "Ishonch Guard",
    },
  },
  {
    area: "greeting",
    text: "можно вам доверять?",
    expected: {
      kind: "victim_intent",
      intent: "trust_or_greeting",
      replyIncludes: "Ishonch Guard",
    },
  },
  {
    area: "greeting",
    text: "ты не мошенник?",
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
    area: "uzbek code",
    text: "menga SMS kod so'rashdi",
    lang: "uz",
    expected: {
      kind: "victim_intent",
      intent: "code_request",
      replyIncludes: "Kodni hech kimga aytmang",
    },
  },
  {
    area: "uzbek card",
    text: "menga karta so'rashyapti",
    lang: "uz",
    expected: {
      kind: "victim_intent",
      intent: "card_request",
      replyIncludes: "Karta ma'lumotlari",
    },
  },
  {
    area: "uzbek personal data",
    text: "menga pasport so'rashyapti",
    lang: "uz",
    expected: {
      kind: "victim_intent",
      intent: "personal_data_request",
      replyIncludes: "Pasport",
    },
  },
  {
    area: "uzbek personal data",
    text: "menga JSHSHIR so'rashyapti",
    lang: "uz",
    expected: {
      kind: "victim_intent",
      intent: "personal_data_request",
      replyIncludes: "Pasport",
    },
  },
  {
    area: "uzbek transfer",
    text: "menga pul o'tkaz deyapti",
    lang: "uz",
    expected: {
      kind: "victim_intent",
      intent: "transfer_request",
      replyIncludes: "Hozircha pul o'tkazmang",
    },
  },
  {
    area: "uzbek link",
    text: "menga havola yuborishdi",
    lang: "uz",
    expected: {
      kind: "victim_intent",
      intent: "link_received",
      replyIncludes: "Hozircha havolani ochmang",
    },
  },
  {
    area: "uzbek file",
    text: "menga fayl yuborishdi",
    lang: "uz",
    expected: {
      kind: "victim_intent",
      intent: "file_received",
      replyIncludes: "Notanish manbadan",
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
      replyIncludes: "Tekshirishga qaror qilganingiz yaxshi",
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
    area: "english link",
    text: "someone sent me a link",
    lang: "en",
    expected: {
      kind: "victim_intent",
      intent: "link_received",
      replyIncludes: "Do not open the link",
    },
  },
  {
    area: "english file",
    text: "someone sent me a file",
    lang: "en",
    expected: {
      kind: "victim_intent",
      intent: "file_received",
      replyIncludes: "Do not open a file",
    },
  },
  {
    area: "english card",
    text: "they asked for my card details",
    lang: "en",
    expected: {
      kind: "victim_intent",
      intent: "card_request",
      replyIncludes: "Do not send card data",
    },
  },
  {
    area: "english personal data",
    text: "they asked for my passport",
    lang: "en",
    expected: {
      kind: "victim_intent",
      intent: "personal_data_request",
      replyIncludes: "Do not send passport",
    },
  },
  {
    area: "english transfer",
    text: "they told me to transfer money",
    lang: "en",
    expected: {
      kind: "victim_intent",
      intent: "transfer_request",
      replyIncludes: "Do not transfer money yet",
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
    area: "received code",
    text: "мне пришел какой то код мне пришел код на телефон зачем я не понял",
    expected: {
      kind: "victim_intent",
      intent: "code_request",
      replyIncludes: "Код никому не называйте",
    },
  },
  {
    area: "uzbek received code",
    text: "menga kod keldi nimaga tushunmadim",
    lang: "uz",
    expected: {
      kind: "victim_intent",
      intent: "code_request",
      replyIncludes: "Kodni hech kimga aytmang",
    },
  },
  {
    area: "english received code",
    text: "I got a verification code and I don't understand why",
    lang: "en",
    expected: {
      kind: "victim_intent",
      intent: "code_request",
      replyIncludes: "Do not tell anyone the code",
    },
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
    area: "sent code",
    text: "я уже сообщил код подтверждения",
    expected: { kind: "panic", panicId: 1 },
  },
  {
    area: "sent code",
    text: "я уже продиктовал код",
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
    area: "sent money",
    text: "я уже оплатил комиссию",
    expected: { kind: "panic", panicId: 3 },
  },
  {
    area: "sent money",
    text: "я уже пополнил баланс",
    expected: { kind: "panic", panicId: 3 },
  },
  {
    area: "card data sent",
    text: "я уже ввел данные карты",
    expected: { kind: "panic", panicId: 4 },
  },
  {
    area: "card data sent",
    text: "я уже дал cvv",
    expected: { kind: "panic", panicId: 4 },
  },
  {
    area: "card data sent",
    text: "я уже сказал пин карты",
    expected: { kind: "panic", panicId: 4 },
  },
  {
    area: "apk installed",
    text: "я уже установил apk",
    expected: { kind: "panic", panicId: 2 },
  },
  {
    area: "apk installed",
    text: "я установил приложение и дал доступ к смс",
    expected: { kind: "panic", panicId: 2 },
  },
  {
    area: "remote access",
    text: "я уже дал доступ к телефону",
    expected: { kind: "panic", panicId: 2 },
  },
  {
    area: "telegram access",
    text: "я уже отсканировал QR для входа в Telegram",
    expected: { kind: "panic", panicId: 5 },
  },
  {
    area: "telegram access",
    text: "я потерял доступ к телеграму",
    expected: { kind: "panic", panicId: 5 },
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
    expected: {
      kind: "handler_reply",
      route: "sensitive_secret",
      replyIncludes: "Kod yashirildi",
    },
  },
  {
    area: "post-check confidence",
    text: "ты точно в этом уверен?",
    expected: { kind: "handler_reply", route: "orphan_followup", replyIncludes: "Я не вижу" },
  },
  {
    area: "post-check confidence",
    text: "siz bunga aniq ishonasizmi?",
    lang: "uz",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "Qaysi tekshiruv",
    },
  },
  {
    area: "post-check confidence",
    text: "are you really sure about that?",
    lang: "en",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "I cannot see",
    },
  },
  {
    area: "post-check methodology",
    text: "Почему домен подозрительный ты посчитал, ты его проверил каким-то образом?",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "не буду придумывать метод",
    },
  },
  {
    area: "post-check methodology",
    text: "bu domenni qanday tekshirdingiz?",
    lang: "uz",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "usulni o'ylab topmayman",
    },
  },
  {
    area: "post-check methodology",
    text: "how did you check this domain?",
    lang: "en",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "will not invent a method",
    },
  },
  {
    area: "post-check trusted person",
    text: "я могу связаться с близким?",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "Свяжитесь с близким сами",
    },
  },
  {
    area: "post-check trusted person",
    text: "yaqin odamim bilan bog'lansam bo'ladimi?",
    lang: "uz",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "o'zingiz bog'laning",
    },
  },
  {
    area: "post-check trusted person",
    text: "can I call someone I trust?",
    lang: "en",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "Contact someone you trust yourself",
    },
  },
  {
    area: "post-check recheck",
    text: "перепроверь ещё раз",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "не храню исходную ссылку",
    },
  },
  {
    area: "post-check recheck",
    text: "yana bir marta tekshir",
    lang: "uz",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "oldingi link",
    },
  },
  {
    area: "post-check recheck",
    text: "check it again",
    lang: "en",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "do not keep the original link",
    },
  },
  {
    area: "post-check methodology variant",
    text: "Какие источники ты использовал?",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "не буду придумывать метод",
    },
  },
  {
    area: "post-check trusted person variant",
    text: "Можно связаться с мамой?",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "Свяжитесь с близким сами",
    },
  },
  {
    area: "post-check trusted person variant",
    text: "Можно показать близкому?",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "Свяжитесь с близким сами",
    },
  },
  {
    area: "post-check trusted person variant",
    text: "Can I show this to my mother?",
    lang: "en",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "Contact someone you trust yourself",
    },
  },
  {
    area: "post-check trusted person variant",
    text: "yaqin odamim bilan boglansam bo'ladimi?",
    lang: "uz",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "o'zingiz bog'laning",
    },
  },
  {
    area: "post-check trusted person variant",
    text: "ishonchli odamga qongiroq qilsam bo'ladimi?",
    lang: "uz",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "o'zingiz bog'laning",
    },
  },
  {
    area: "post-check recheck variant",
    text: "А можешь перепроверить?",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "не храню исходную ссылку",
    },
  },
  {
    area: "post-check recheck variant",
    text: "Проверь ещё",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "не храню исходную ссылку",
    },
  },
  {
    area: "post-check recheck variant",
    text: "Can you double-check?",
    lang: "en",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "do not keep the original link",
    },
  },
  {
    area: "post-check disagreement",
    text: "я не согласен, ты ошибся",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "можете не соглашаться",
    },
  },
  {
    area: "post-check disagreement",
    text: "men rozi emasman, xato qildingiz",
    lang: "uz",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "qo'shilmasligingiz mumkin",
    },
  },
  {
    area: "post-check disagreement",
    text: "I disagree, you may be wrong",
    lang: "en",
    expected: {
      kind: "handler_reply",
      route: "orphan_followup",
      replyIncludes: "may disagree",
    },
  },
];
