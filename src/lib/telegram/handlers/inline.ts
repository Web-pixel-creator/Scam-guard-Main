import { createHash } from "node:crypto";

import type { Lang } from "@/lib/i18n";
import { classifyMetaIntent, getMetaIntentResponse, type MetaIntent } from "@/lib/meta-intent";
import { maskForDisplay } from "@/lib/risk/detect";
import { buildRiskPassportSummary, type RiskPassportSummary } from "@/lib/risk/risk-passport";
import { runCheck, type RateLimitedError, type RunCheckResult } from "@/lib/risk/check-core";
import type { RiskLevel } from "@/lib/risk/rules";
import type { SensitiveSecretClass } from "@/lib/risk/sensitive-text";
import { uzbekLatinMatchingVariant } from "@/lib/risk/uz-cyrillic-translit";
import { filterAdvice } from "@/lib/telegram/advice-filter";
import {
  answerInlineQuery,
  escapeMarkdownV2,
  type InlineQueryResultArticle,
} from "@/lib/telegram/api.server";
import { hasConcreteArtifact } from "@/lib/telegram/concrete-artifact";
import { resolveInlineQueryLanguage } from "@/lib/telegram/inline-query-language";
import {
  inlineDeliveryRetryMsFromSeconds,
  TelegramInlineAnswerDeliveryError,
} from "@/lib/telegram/inline-answer-delivery-error";
import type { InlineQueryCtx } from "@/lib/telegram/router";
import { normalizeIntentTextForMatching } from "@/lib/telegram/intent-text-normalization";
import {
  buildSensitiveSecretGuidance,
  detectTelegramSensitiveSecret,
} from "@/lib/telegram/sensitive-secret-input";
import {
  collectResultReasonCodesForPresentation,
  presentInlineReason,
} from "@/lib/telegram/inline-reason-presentation";
import { classifyVictimIntent, type VictimIntentKind } from "@/lib/telegram/victim-intent";

const MAX_INLINE_QUERY_LENGTH = 256;
const MAX_INLINE_DESCRIPTION_LENGTH = 120;
const SUCCESS_INLINE_CACHE_SECONDS = 10;
const DEFAULT_BOT_USERNAME = "scamguard_bot";
const INLINE_PLAIN_TEXT = new WeakMap<InlineQueryResultArticle, string>();

function unicodeCodePointLength(value: string): number {
  return Array.from(value).length;
}

function configuredBotUsername(): string {
  const configured =
    typeof process === "undefined"
      ? ""
      : (process.env.TELEGRAM_BOT_USERNAME ?? "").trim().replace(/^@/u, "");
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/u.test(configured) ? configured : DEFAULT_BOT_USERNAME;
}

function applyConfiguredBotMention(value: string, username: string): string {
  return value.replaceAll(`@${DEFAULT_BOT_USERNAME}`, `@${username}`);
}

type HumanInlineIntent =
  | "link_request"
  | "code_request"
  | "recovery_phrase_request"
  | "sent_code"
  | "sent_money"
  | "confirm_request"
  | "card_request"
  | "transfer_request"
  | "app_request"
  | "unknown_call"
  | "bank_call"
  | "operator_call"
  | "foreign_call"
  | "telegram_takeover"
  | "malicious_file"
  | "utility_impersonation"
  | "official_impersonation"
  | "pension_benefit"
  | "phone_borrowing"
  | "money_mule"
  | "open_budget"
  | "apple_security"
  | "medical_code"
  | "child_game_bonus"
  | "silent_call"
  | "personal_data"
  | "personal_data_aftercare"
  | "delivery_payment"
  | "prize_fee"
  | "gov_service"
  | "sim_swap"
  | "relative_distress"
  | "job_offer"
  | "investment_offer"
  | "travel_migration_prepayment"
  | "romance_money"
  | "unknown_contact"
  | "identity_uncertain"
  | "earning_channel"
  | "bank_contact"
  | "bank_impersonation"
  | "safe_account_transfer"
  | "loan_advance_fee"
  | "charity_pressure"
  | "support_impersonation"
  | "qr_login"
  | "tax_payment"
  | "general_scam_concern"
  | "voting_link"
  | "next_step"
  | "reply_safety"
  | "safety_question"
  | "blackmail_threat"
  | "chat_invite";

type InlineFollowUpKind =
  | "trust"
  | "scam_confirmation"
  | "bank_chat_number"
  | "link_verification"
  | "reason"
  | "next_action";

type InlineSmallTalkIntent = "thanks" | "identity";

const AMBIGUOUS_NUMERIC_COPY: Readonly<
  Record<Lang, { title: string; description: string; message: string }>
> = {
  ru: {
    title: "Код или неполный номер",
    description:
      "Не вставляйте настоящий код. Если это номер — укажите его полностью, а просьбу опишите словами.",
    message:
      "Короткая цифровая строка может быть секретным кодом или неполным номером. Не публикуйте настоящий SMS-код, OTP или PIN. Если это телефон, укажите полный номер; отдельно словами опишите, что вас попросили сделать.",
  },
  uz: {
    title: "Kod yoki to'liq bo'lmagan raqam",
    description:
      "Haqiqiy kodni kiritmang. Bu raqam bo'lsa, to'liq yozing va so'rovni so'z bilan tushuntiring.",
    message:
      "Qisqa raqamlar maxfiy kod yoki to'liq bo'lmagan telefon bo'lishi mumkin. Haqiqiy SMS-kod, OTP yoki PINni oshkor qilmang. Bu telefon bo'lsa, to'liq raqamni yozing; nima qilish so'ralganini alohida so'z bilan tushuntiring.",
  },
  en: {
    title: "Code or incomplete number",
    description:
      "Do not paste a real code. If this is a phone number, enter it in full and describe the request in words.",
    message:
      "A short digit string may be a secret code or an incomplete phone number. Do not publish a real SMS code, OTP, or PIN. If it is a phone number, enter the full number and separately describe in words what you were asked to do.",
  },
};

type HumanInlineCopy = {
  title: string;
  description: string;
  /** Longer text used after the user inserts the result into the chat. */
  message?: string;
};

const INLINE_SMALL_TALK_COPY: Readonly<
  Record<Lang, Readonly<Record<InlineSmallTalkIntent, { title: string; description: string }>>>
> = {
  ru: {
    thanks: {
      title: "Пожалуйста",
      description:
        "Если появится новая ссылка, номер или просьба — добавьте её после @scamguard_bot.",
    },
    identity: {
      title: "Я — Ishonch Guard",
      description:
        "Помогаю проверить ссылку, номер, Telegram-аккаунт или текст по видимым признакам риска.",
    },
  },
  uz: {
    thanks: {
      title: "Arzimaydi",
      description: "Yangi havola, raqam yoki so'rov bo'lsa, uni @scamguard_bot dan keyin yozing.",
    },
    identity: {
      title: "Men — Ishonch Guard",
      description:
        "Havola, raqam, Telegram akkaunti yoki matnni ko'rinadigan xavf belgilariga ko'ra tekshiraman.",
    },
  },
  en: {
    thanks: {
      title: "You are welcome",
      description: "If you get another link, number, or request, add it after @scamguard_bot.",
    },
    identity: {
      title: "I am Ishonch Guard",
      description:
        "I check links, numbers, Telegram accounts, and message text for visible risk signs.",
    },
  },
};

const PREFLIGHT_HUMAN_INLINE_INTENTS = new Set<HumanInlineIntent>([
  "link_request",
  "recovery_phrase_request",
  "unknown_call",
  "bank_call",
  "operator_call",
  "foreign_call",
  "sent_money",
  "telegram_takeover",
  "malicious_file",
  "app_request",
  "utility_impersonation",
  "official_impersonation",
  "gov_service",
  "pension_benefit",
  "phone_borrowing",
  "money_mule",
  "open_budget",
  "apple_security",
  "medical_code",
  "child_game_bonus",
  "silent_call",
  "personal_data_aftercare",
  "relative_distress",
  "job_offer",
  "travel_migration_prepayment",
  "romance_money",
  "earning_channel",
  "prize_fee",
  "unknown_contact",
  "identity_uncertain",
  "bank_contact",
  "bank_impersonation",
  "safe_account_transfer",
  "loan_advance_fee",
  "charity_pressure",
  "support_impersonation",
  "qr_login",
  "tax_payment",
  "delivery_payment",
  "sim_swap",
  "transfer_request",
  "general_scam_concern",
  "voting_link",
  "next_step",
  "reply_safety",
  "safety_question",
  "blackmail_threat",
  "chat_invite",
]);

type Copy = {
  helpTitle: string;
  helpDescription: string;
  helpMessage: string;
  tooLongTitle: string;
  tooLongDescription: string;
  rateLimitTitle: string;
  rateLimitDescription: string;
  errorTitle: string;
  errorDescription: string;
  continueInBot: string;
  checkedBy: string;
  displayLabel: string;
  reasonLabel: string;
  stepLabel: string;
  levels: Record<RiskLevel, { title: string; description: string; step: string }>;
  reasonFallback: Record<RiskLevel, string>;
};

const COPY: Record<Lang, Copy> = {
  ru: {
    helpTitle: "Проверить через Ishonch Guard",
    helpDescription: "Введите номер, ссылку, username или текст сообщения",
    helpMessage:
      "Проверю номер, ссылку, Telegram username или текст сообщения.\n\nПример: @scamguard_bot +998901234567\n\nЯ не прошу SMS-коды, PIN, CVV или пароли.",
    tooLongTitle: "Слишком длинный текст",
    tooLongDescription: "Сократите сообщение до 256 символов",
    rateLimitTitle: "Слишком много проверок",
    rateLimitDescription: "Подождите немного и попробуйте снова",
    errorTitle: "Не удалось проверить",
    errorDescription: "Откройте бота и пришлите запрос туда",
    continueInBot: "Открыть Ishonch Guard",
    checkedBy: "Проверено через Ishonch Guard",
    displayLabel: "Что проверяли",
    reasonLabel: "Что заметил",
    stepLabel: "Безопасный шаг",
    levels: {
      safe: {
        title: "🟢 Безопасно",
        description: "Явных признаков скама не найдено",
        step: "Не вводите коды или данные карты, если после перехода их попросят.",
      },
      unknown: {
        title: "⚪ Недостаточно данных",
        description: "Нужно больше контекста для точной оценки",
        step: "Пришлите полный текст, ссылку или скрин в @scamguard_bot.",
      },
      suspicious: {
        title: "🟠 Требуется осторожность",
        description: "Есть подозрительные признаки",
        step: "Не вводите код/карту и проверьте детали в @scamguard_bot.",
      },
      high_risk: {
        title: "🔴 Высокий риск",
        description: "Похоже на опасную схему",
        step: "Не сообщайте коды или данные карты, не переводите деньги и не устанавливайте приложения.",
      },
    },
    reasonFallback: {
      safe: "Опасных сигналов в видимом тексте нет.",
      unknown: "Одного значения мало для уверенного вывода.",
      suspicious: "Есть признаки давления, неизвестного источника или подозрительной ссылки.",
      high_risk: "Есть признаки кражи кода, карты, денег или доступа.",
    },
  },
  uz: {
    helpTitle: "Ishonch Guard orqali tekshirish",
    helpDescription: "Raqam, havola, username yoki xabar matnini kiriting",
    helpMessage:
      "Raqam, havola, Telegram username yoki xabar matnini tekshiraman.\n\nMisol: @scamguard_bot +998901234567\n\nMen SMS-kod, PIN, CVV yoki parol so'ramayman.",
    tooLongTitle: "Matn juda uzun",
    tooLongDescription: "Xabarni 256 belgigacha qisqartiring",
    rateLimitTitle: "Tekshiruvlar ko'p",
    rateLimitDescription: "Biroz kutib, qayta urinib ko'ring",
    errorTitle: "Tekshirib bo'lmadi",
    errorDescription: "Botni ochib, so'rovni o'sha yerga yuboring",
    continueInBot: "Ishonch Guardni ochish",
    checkedBy: "Ishonch Guard orqali tekshirildi",
    displayLabel: "Tekshirilgan narsa",
    reasonLabel: "Nima ko'rindi",
    stepLabel: "Xavfsiz qadam",
    levels: {
      safe: {
        title: "🟢 Xavfsiz",
        description: "Aniq scam belgilari topilmadi",
        step: "O'tgandan keyin kod yoki karta ma'lumotlari so'ralsa, kiritmang.",
      },
      unknown: {
        title: "⚪ Ma'lumot yetarli emas",
        description: "Aniq baholash uchun ko'proq kontekst kerak",
        step: "To'liq matn, havola yoki skrinshotni @scamguard_bot ga yuboring.",
      },
      suspicious: {
        title: "🟠 Ehtiyot bo'ling",
        description: "Shubhali belgilar bor",
        step: "Kod/karta kiritmang va tafsilotlarni @scamguard_bot da tekshiring.",
      },
      high_risk: {
        title: "🔴 Yuqori xavf",
        description: "Xavfli sxemaga o'xshaydi",
        step: "Kod yoki karta ma'lumotlarini bermang, pul yubormang va ilova o'rnatmang.",
      },
    },
    reasonFallback: {
      safe: "Ko'rinib turgan matnda xavfli signal yo'q.",
      unknown: "Bitta qiymat ishonchli xulosa uchun yetarli emas.",
      suspicious: "Bosim, noma'lum manba yoki shubhali havola belgilari bor.",
      high_risk: "Kod, karta, pul yoki akkauntga kirishni o'g'irlash belgilari bor.",
    },
  },
  en: {
    helpTitle: "Check with Ishonch Guard",
    helpDescription: "Type a number, link, username or message text",
    helpMessage:
      "I can check a number, link, Telegram username or message text.\n\nExample: @scamguard_bot +998901234567\n\nI never ask for SMS codes, PINs, CVV or passwords.",
    tooLongTitle: "Text is too long",
    tooLongDescription: "Shorten it to 256 characters",
    rateLimitTitle: "Too many checks",
    rateLimitDescription: "Wait a bit and try again",
    errorTitle: "Could not check it",
    errorDescription: "Open the bot and send the request there",
    continueInBot: "Open Ishonch Guard",
    checkedBy: "Checked by Ishonch Guard",
    displayLabel: "Checked",
    reasonLabel: "What I noticed",
    stepLabel: "Safe step",
    levels: {
      safe: {
        title: "🟢 Safe",
        description: "No clear scam signals found",
        step: "Do not enter codes or card data if the next page asks for them.",
      },
      unknown: {
        title: "⚪ Not enough data",
        description: "More context is needed for a confident check",
        step: "Send the full text, link or screenshot to @scamguard_bot.",
      },
      suspicious: {
        title: "🟠 Be careful",
        description: "Suspicious signals were found",
        step: "Do not enter a code/card and verify details in @scamguard_bot.",
      },
      high_risk: {
        title: "🔴 High risk",
        description: "This looks like a dangerous scheme",
        step: "Do not share codes or card data. Do not send money or install an app.",
      },
    },
    reasonFallback: {
      safe: "No dangerous signal is visible in the provided text.",
      unknown: "One value is not enough for a confident conclusion.",
      suspicious: "There are signs of pressure, unknown source or suspicious link.",
      high_risk: "There are signs of code, card, money or account-access theft.",
    },
  },
};

const PREVIEW_COPY: Record<
  Lang,
  {
    phoneReportsTitle: string;
    phoneReportsDescription: string;
    phoneNoReportsTitle: string;
    phoneNoReportsDescription: string;
    phoneWeakTitle: string;
    phoneWeakDescription: string;
    telegramTitle: string;
    telegramDescription: string;
    humanIntents: Record<HumanInlineIntent, HumanInlineCopy>;
    unknownTitle: string;
    unknownDescription: string;
  }
> = {
  ru: {
    phoneReportsTitle: "Номер: есть жалобы",
    phoneReportsDescription:
      "Есть подтверждённые жалобы Ishonch Guard. Не отправляйте код, карту или деньги.",
    phoneNoReportsTitle: "Номер: жалоб не найдено",
    phoneNoReportsDescription:
      "Жалоб нет — это не гарантия. В этом же запросе опишите просьбу; не вставляйте настоящий код, PIN, CVV или фото.",
    phoneWeakTitle: "Номер выглядит неполным",
    phoneWeakDescription:
      "Укажите полный номер и словами опишите просьбу в этом же запросе. Не вставляйте код, PIN, CVV или фото документа.",
    telegramTitle: "Telegram: нужен контекст",
    telegramDescription:
      "Username сам не доказывает риск. Добавьте текст просьбы, ссылку на пост или скрин.",
    humanIntents: {
      link_request: {
        title: "Ссылка: сначала проверим",
        description:
          "Вы упомянули ссылку, но адреса здесь нет. Не открывайте её; добавьте URL или полный текст в этот же запрос.",
        message:
          "Вы упомянули ссылку, но её адреса в запросе нет. Пока не открывайте её и ничего не вводите. Добавьте сам URL или полный текст сообщения в этот же запрос — без паролей и кодов.",
      },
      code_request: {
        title: "Код: никому не называйте",
        description:
          "Не сообщайте SMS-код или PIN. Push-коды, OTP и пароли тоже не диктуйте; добавьте только текст просьбы или скрин.",
      },
      recovery_phrase_request: {
        title: "Сид-фраза: никому не отправляйте",
        description:
          "Поддержка и проверка кошелька не требуют seed/recovery phrase. Не вводите и не отправляйте слова; если уже раскрыли их, создайте новый кошелёк в официальном приложении.",
      },
      sent_code: {
        title: "Код уже отправлен: действуйте срочно",
        description:
          "Заблокируйте карту/доступ через банк и смените пароль с другого устройства. С мошенником не спорьте.",
      },
      sent_money: {
        title: "Деньги уже переведены: срочно в банк",
        description:
          "Позвоните в банк по официальному номеру, попросите заморозить/оспорить перевод и сохраните чек. Не делайте «возвратный перевод».",
      },
      confirm_request: {
        title: "Подтверждение: осторожно",
        description:
          "Не подтверждайте вход, перевод или операцию по звонку/чату. Уточните, что именно просят подтвердить.",
      },
      card_request: {
        title: "Карта: не отправляйте данные",
        description:
          "Номер карты, срок, CVV/CVC, PIN и фото карты не отправляем. Пришлите текст просьбы.",
      },
      transfer_request: {
        title: "Перевод: нужна причина",
        description:
          "Не переводите незнакомцам или на «безопасный счёт». Если не указано кому, куда и зачем — добавьте причину перевода.",
      },
      app_request: {
        title: "Приложение: не устанавливайте",
        description:
          "Не ставьте APK, AnyDesk, RustDesk или «защитное» приложение по просьбе из чата/звонка.",
      },
      unknown_call: {
        title: "Неизвестный звонок: лучше перезвонить",
        description:
          "Если звонят с незнакомого или иностранного номера, не называйте код, карту или паспорт. Завершите звонок и проверьте просьбу.",
      },
      bank_call: {
        title: "Звонок из банка: перезвоните сами",
        description:
          "Не называйте коды и данные карты. Завершите разговор и звоните по номеру с карты/приложения.",
      },
      operator_call: {
        title: "Оператор связи: перезвоните сами",
        description:
          "Beeline/Ucell/Mobiuz/Uztelecom проверяйте только через официальный номер или приложение. Код для SIM/eSIM не называйте.",
      },
      foreign_call: {
        title: "Иностранный звонок: не продолжайте под давлением",
        description:
          "Банк, оператор или госслужба не должны выманивать коды с зарубежного номера. Завершите звонок и проверяйте только через официальный канал.",
      },
      telegram_takeover: {
        title: "Telegram: не входите по ссылке",
        description:
          "Фейковая галочка, блокировка, удаление, Premium, голосование или «проверка» часто ведут к угону аккаунта. Не вводите код и пароль.",
      },
      malicious_file: {
        title: "Файл/вирус: не открывайте",
        description:
          "APK, EXE, PDF.APK, GIF, PPTX, «голосовое» или открытка от незнакомых могут украсть доступ. Не скачивайте и пришлите скрин/текст.",
      },
      utility_impersonation: {
        title: "Коммунальная служба: перезвоните сами",
        description:
          "Водоканал, газ, свет или Suvsoz не должны просить паспорт, ПИНФЛ, SMS-код или оплату по ссылке. Перезвоните в районный отдел.",
      },
      official_impersonation: {
        title: "Госорган/инспектор: проверьте официально",
        description:
          "РУВД, МВД, полиция и инспектор не должны просить код, деньги или документы в чате. Проверяйте по официальному номеру.",
      },
      pension_benefit: {
        title: "Пенсия/выплата: не называйте данные",
        description:
          "Пенсионный фонд, грант или надбавка по телефону не требуют SMS-код, карту, паспорт или ПИНФЛ. Проверяйте через 1271/102 или официальный канал.",
      },
      phone_borrowing: {
        title: "Просят телефон: не отдавайте разблокированный",
        description:
          "Если незнакомец просит телефон «на минуту», он может открыть банк или восстановить аккаунт. Наберите номер сами и включите громкую связь.",
      },
      money_mule: {
        title: "Чужие деньги: не переводите дальше",
        description:
          "Если деньги пришли «по ошибке» или просят снять/вернуть на другой счет, не переводите сами. Сразу обращайтесь в банк и сохраните чек.",
      },
      open_budget: {
        title: "Open Budget/голос: код не отдавайте",
        description:
          "За голос официально не покупают SMS-код. Не продавайте голос, не называйте код и не привязывайте карту/номер к чужому устройству.",
      },
      apple_security: {
        title: "Apple/iOS: не устанавливайте «защиту»",
        description:
          "Окна про вирусы, повреждение iOS или проверку Apple ID могут быть фишингом. Закройте страницу, не вводите пароль и не ставьте приложение.",
      },
      medical_code: {
        title: "Врач/DMED: код не диктуйте",
        description:
          "Поликлиника или DMED не должны просить SMS-код по телефону/в чате. Записывайтесь только через официальный канал.",
      },
      child_game_bonus: {
        title: "Игровые бонусы: не вводите код",
        description:
          "Бесплатная валюта, бонусы или подарки для игры могут быть приманкой. Не переходите в мессенджер и не называйте код.",
      },
      silent_call: {
        title: "Молчаливый звонок: сбросьте",
        description:
          "Если звонят и молчат, не говорите «да» и не продолжайте. Сбросьте, заблокируйте номер и предупредите близких.",
      },
      personal_data: {
        title: "Документы: не отправляйте фото",
        description:
          "Не отправляйте паспорт, ПИНФЛ/ИНН, селфи или адрес. В этот же запрос добавьте только текст просьбы — без данных.",
        message:
          "Не отправляйте фото паспорта, ПИНФЛ/ИНН, селфи, адрес или другие персональные данные. Проверьте просьбу через официальный канал. Сюда добавьте только её текст или ссылку — без самих документов и секретов.",
      },
      personal_data_aftercare: {
        title: "Паспорт уже отправлен: снизьте риск",
        description:
          "Сохраните переписку. Больше ничего не отправляйте; прекратите контакт и уточните меры защиты по официальному номеру.",
        message:
          "Сохраните переписку, профиль и время отправки. Больше ничего не отправляйте и не спорьте с собеседником. Если вы также сообщили код, карту или дали доступ — срочно звоните в банк. По паспорту обратитесь в выдавший документ орган или полицию только по официальному номеру и уточните меры защиты.",
      },
      delivery_payment: {
        title: "Доставка: проверьте ссылку",
        description:
          "Не платите пошлину/доставку из чата. Пришлите ссылку или SMS целиком, особенно если просят карту.",
      },
      prize_fee: {
        title: "Приз: не платите сбор",
        description:
          "За выигрыш, грант или подарок не платят налог/комиссию заранее. Пришлите сообщение целиком.",
      },
      gov_service: {
        title: "OneID/госуслуги: не вводите код",
        description:
          "Не входите по ссылке из чата/SMS. Откройте my.gov.uz или soliq.uz сами; пароль и SMS-код не называйте.",
      },
      sim_swap: {
        title: "SIM/оператор: осторожно",
        description:
          "Не называйте код для замены SIM/eSIM или переноса номера. Завершите разговор и звоните оператору сами.",
      },
      relative_distress: {
        title: "Близкий в беде: перезвоните",
        description:
          "Не переводите срочно по сообщению. Перезвоните близкому по сохранённому номеру или спросите семейное кодовое слово.",
      },
      job_offer: {
        title: "Работа: не платите взнос",
        description:
          "Платить за вакансию или обязательное обучение до договора опасно. Для проверки вставьте сюда текст условий, название компании или URL; деньги и документы не отправляйте.",
        message:
          "Не оплачивайте обучение, форму, проверку или доступ к вакансии до договора и независимой проверки работодателя. Вставьте сюда только текст условий, название компании или URL вакансии; деньги и документы никому не отправляйте.",
      },
      investment_offer: {
        title: "Инвестиции/крипта: осторожно",
        description: "Не переводите депозит. Гарантированный доход и TON/USDT — частый крючок.",
      },
      travel_migration_prepayment: {
        title: "Виза/тур: не платите заранее",
        description:
          "Визы, работа за границей, хадж/умра, туры и билеты рискованны, если просят предоплату или сбор в чате.",
      },
      romance_money: {
        title: "Отношения: деньги не отправляйте",
        description:
          "Если новый знакомый просит билет, визу, лечение или инвестицию — остановитесь и пришлите текст просьбы.",
      },
      unknown_contact: {
        title: "Незнакомец: нужен текст просьбы",
        description:
          "Не отправляйте коды, деньги, карту или документы. Пришлите, что именно он просит сделать.",
      },
      identity_uncertain: {
        title: "Личность не ясна: перезвоните",
        description:
          "Аккаунт знакомого мог быть взломан. Перезвоните по сохранённому номеру или задайте личный вопрос.",
      },
      earning_channel: {
        title: "Канал заработка: осторожно",
        description:
          "Каналы с быстрым доходом часто ведут к депозиту, крипте, ставкам или «заданию». Не платите заранее.",
      },
      bank_contact: {
        title: "Связаться с банком: только официальный номер",
        description:
          "Звоните из приложения, с карты или официального сайта. Не используйте номер из чата, SMS или звонка.",
      },
      general_scam_concern: {
        title: "Подозреваете обман: пришлите просьбу",
        description:
          "Хорошо, что решили проверить. Добавьте в этот запрос сообщение, ссылку, номер или точную просьбу собеседника.",
      },
      voting_link: {
        title: "Голосование/канал: сначала проверим",
        description:
          "Не переходите по ссылке и не входите в Telegram заново. Такие ссылки могут красть аккаунт: не вводите код, а URL вставьте сюда.",
      },
      next_step: {
        title: "Что делать: пока ничего не отправляйте",
        description:
          "Добавьте в этот запрос текст, ссылку, номер или то, что уже произошло — я подскажу конкретный безопасный шаг.",
      },
      reply_safety: {
        title: "Ответ: не раскрывайте данные",
        description:
          "Сюда добавляйте только текст просьбы. Не вставляйте настоящий SMS-код, PIN, CVV, данные карты или фото документов.",
        message:
          "Можно ответить нейтрально, не раскрывая данные. В этот запрос добавьте только текст чужой просьбы; настоящий SMS-код, PIN, CVV, данные карты, пароль или фото документов не вставляйте.",
      },
      safety_question: {
        title: "Безопасно ли: проверим по фактам",
        description:
          "Я не буду угадывать. Пришлите сообщение, ссылку, номер или скрин; пока ничего не вводите и не оплачивайте.",
      },
      blackmail_threat: {
        title: "Шантаж фото: не платите",
        description:
          "Сохраните скриншоты. Не отправляйте деньги или новые материалы; затем заблокируйте профиль и пожалуйтесь.",
        message:
          "Это похоже на шантаж или подготовку к нему. Не платите и не отправляйте новые фото, видео, документы или коды: оплата не гарантирует удаление материалов. Сохраните скриншоты переписки и профиль, расскажите близкому человеку, затем заблокируйте отправителя и пожалуйтесь в Telegram. При прямых угрозах обратитесь в полицию по официальному номеру.",
      },
      bank_impersonation: {
        title: "Лжесотрудник банка: завершите разговор",
        description:
          "Не подтверждайте операцию и не называйте код. Завершите разговор и самостоятельно откройте приложение банка или позвоните по номеру с карты.",
      },
      safe_account_transfer: {
        title: "«Безопасный счёт»: не переводите",
        description:
          "Банк и полиция не переводят деньги клиентов на «безопасный счёт». Завершите звонок и свяжитесь с банком самостоятельно.",
      },
      loan_advance_fee: {
        title: "Кредит: не платите комиссию заранее",
        description:
          "Настоящий кредитор не требует перевод на личную карту за одобрение, страховку или выдачу кредита. Проверьте организацию отдельно.",
      },
      charity_pressure: {
        title: "Сбор помощи: сначала проверьте фонд",
        description:
          "Не переводите под давлением на личную карту. Найдите официальный сайт фонда и реквизиты самостоятельно, без ссылки из сообщения.",
      },
      support_impersonation: {
        title: "Лжеподдержка: не отключайте защиту",
        description:
          "Поддержка не просит отключать 2FA, сообщать код или передавать доступ. Откройте приложение сами и обратитесь в официальный раздел помощи.",
      },
      qr_login: {
        title: "QR-вход: не сканируйте чужой код",
        description:
          "QR для входа может привязать чужое устройство к вашему Telegram. Не сканируйте его и проверьте активные сеансы в настройках.",
      },
      tax_payment: {
        title: "Налог по ссылке: не оплачивайте",
        description:
          "Не платите налог или сбор по ссылке из сообщения. Откройте официальный сайт налоговой самостоятельно и проверьте начисление там.",
      },
      chat_invite: {
        title: "Канал/чат: сначала проверим",
        description:
          "Не переходите по сомнительной ссылке и не входите в Telegram заново. Вставьте сюда URL, username или текст просьбы канала.",
      },
    },
    unknownTitle: "Нужно больше контекста",
    unknownDescription:
      "Вставьте полное сообщение: что просят сделать, ссылку, номер, код, карту или перевод.",
  },
  uz: {
    phoneReportsTitle: "Raqam: shikoyat bor",
    phoneReportsDescription:
      "Ishonch Guardda tasdiqlangan shikoyatlar bor. Kod, karta yoki pul yubormang.",
    phoneNoReportsTitle: "Raqam: shikoyat topilmadi",
    phoneNoReportsDescription:
      "Shikoyat yo'q — bu kafolat emas. Shu so'rovda iltimosni yozing; haqiqiy kod, PIN, CVV yoki hujjat rasmini kiritmang.",
    phoneWeakTitle: "Raqam to'liq emas",
    phoneWeakDescription:
      "To'liq raqamni va iltimosni shu so'rovda yozing. Haqiqiy kod, PIN, CVV yoki hujjat rasmini kiritmang.",
    telegramTitle: "Telegram: kontekst kerak",
    telegramDescription:
      "Username o'zi xavfni isbotlamaydi. So'rov matni, post havolasi yoki skrin yuboring.",
    humanIntents: {
      link_request: {
        title: "Havola: avval tekshiramiz",
        description:
          "Havola aytilgan, lekin manzil yo'q. Uni ochmang; URL yoki to'liq matnni shu so'rovga qo'shing.",
        message:
          "Siz havolani aytdingiz, lekin uning manzili so'rovda yo'q. Uni ochmang va hech narsa kiritmang. URL yoki to'liq xabarni shu so'rovga qo'shing — parol va kodlarsiz.",
      },
      code_request: {
        title: "Kod: hech kimga aytmang",
        description:
          "SMS-kod yoki PIN-ni aytmang. Push-kod, OTP va parolni ham aytmang; faqat so'rov matni yoki skrinni qo'shing.",
      },
      recovery_phrase_request: {
        title: "Tiklash iborasi: hech kimga yubormang",
        description:
          "Hamyon yordami yoki tekshiruv seed/tiklash iborasini so'ramaydi. So'zlarni kiritmang va yubormang; oshkor qilgan bo'lsangiz, rasmiy ilovada yangi hamyon yarating.",
      },
      sent_code: {
        title: "Kod yuborilgan: tez harakat qiling",
        description:
          "Bank orqali kartani/kirishni bloklang va boshqa qurilmadan parolni almashtiring. Hozircha javob bermang.",
      },
      sent_money: {
        title: "Pul yuborilgan: darhol bankka qo'ng'iroq qiling",
        description:
          "Bankning rasmiy raqamiga qo'ng'iroq qiling, o'tkazmani muzlatish/bahslashishni so'rang va chekni saqlang. Pulni boshqa hisobga qaytarmang.",
      },
      confirm_request: {
        title: "Tasdiqlash: ehtiyot bo'ling",
        description:
          "Kirish, o'tkazma yoki karta operatsiyasini qo'ng'iroq/chat orqali tasdiqlamang.",
      },
      card_request: {
        title: "Karta: ma'lumot bermang",
        description: "Karta raqami, muddati, CVV/CVC, PIN yoki karta rasmini yubormang.",
      },
      transfer_request: {
        title: "Pul o'tkazma: sabab kerak",
        description:
          "Notanish odamga yoki «xavfsiz hisob»ga pul o'tkazmang. Kimga, qayerga va nega so'ralgani yo'q bo'lsa, sababni qo'shing.",
      },
      app_request: {
        title: "Ilova: o'rnatmang",
        description:
          "Chat/qo'ng'iroq bo'yicha APK, AnyDesk, RustDesk yoki «himoya» ilovasini o'rnatmang.",
      },
      unknown_call: {
        title: "Noma'lum qo'ng'iroq: qayta tekshiring",
        description:
          "Notanish yoki chet el raqami qo'ng'iroq qilsa, kod, karta yoki pasport ma'lumotini aytmang. Suhbatni tugating va so'rovni tekshiring.",
      },
      bank_call: {
        title: "Bankdan qo'ng'iroq: o'zingiz qayta qo'ng'iroq qiling",
        description:
          "Kod va karta ma'lumotlarini aytmang. Suhbatni tugating va rasmiy raqamga qo'ng'iroq qiling.",
      },
      operator_call: {
        title: "Operator: o'zingiz qayta qo'ng'iroq qiling",
        description:
          "Beeline/Ucell/Mobiuz/Uztelecomni faqat rasmiy raqam yoki ilova orqali tekshiring. SIM/eSIM kodi aytilmaydi.",
      },
      foreign_call: {
        title: "Chet el raqami: bosim ostida gaplashmang",
        description:
          "Bank, operator yoki davlat xizmati chet el raqamidan kod so'ramaydi. Qo'ng'iroqni tugating va rasmiy kanal orqali tekshiring.",
      },
      telegram_takeover: {
        title: "Telegram: havola orqali kirmang",
        description:
          "Soxta belgi, bloklash, o'chirish, Premium, ovoz berish yoki «tekshiruv» akkauntni o'g'irlashi mumkin. Kod va parol kiritmang.",
      },
      malicious_file: {
        title: "Fayl/virus: ochmang",
        description:
          "APK, EXE, PDF.APK, GIF, PPTX, «ovozli xabar» yoki tabrik fayli xavfli bo'lishi mumkin. Yuklamang, skrin yoki matn yuboring.",
      },
      utility_impersonation: {
        title: "Kommunal xizmat: o'zingiz qayta qo'ng'iroq qiling",
        description:
          "Suvsoz, gaz yoki elektr xizmati chat/qo'ng'iroqda pasport, PINFL, SMS-kod yoki havola orqali to'lov so'ramasligi kerak.",
      },
      official_impersonation: {
        title: "Davlat organi/inspektor: rasmiy tekshiring",
        description:
          "IIB, IIV, soliq yoki sud chatda kod, pul yoki hujjat talab qilmasligi kerak. Faqat rasmiy raqamdan tekshiring.",
      },
      pension_benefit: {
        title: "Pensiya/to'lov: ma'lumot bermang",
        description:
          "Pensiya jamg'armasi, grant yoki ustama uchun telefon orqali SMS-kod, karta, pasport yoki PINFL aytilmaydi. 1271/102 yoki rasmiy kanal orqali tekshiring.",
      },
      phone_borrowing: {
        title: "Telefon so'rashsa: ochiq holda bermang",
        description:
          "Notanish odam telefonni «bir daqiqaga» so'rasa, bank yoki akkauntga kirishi mumkin. Raqamni o'zingiz tering va ovozli aloqa yoqing.",
      },
      money_mule: {
        title: "Begona pul: boshqa hisobga o'tkazmang",
        description:
          "Pul «adashib» kelsa yoki yechib/ qaytarib berishni so'rashsa, o'zingiz o'tkazmang. Bankka murojaat qiling va chekni saqlang.",
      },
      open_budget: {
        title: "Open Budget/ovoz: kod bermang",
        description:
          "Ovoz uchun SMS-kod sotilmaydi. Kod aytmang, kartani yoki raqamni begona qurilmaga bog'lamang.",
      },
      apple_security: {
        title: "Apple/iOS: «himoya» o'rnatmang",
        description:
          "Virus, iOS shikastlangan yoki Apple ID tekshiruvi haqidagi oyna fishing bo'lishi mumkin. Sahifani yoping, parol kiritmang.",
      },
      medical_code: {
        title: "Shifokor/DMED: kod aytmang",
        description:
          "Poliklinika yoki DMED telefon/chat orqali SMS-kod so'ramasligi kerak. Faqat rasmiy kanal orqali yoziling.",
      },
      child_game_bonus: {
        title: "O'yin bonuslari: kod kiritmang",
        description:
          "Bepul valyuta, bonus yoki sovg'a bolalarni tuzoqqa tushirishi mumkin. Messengerga o'tmang va kod aytmang.",
      },
      silent_call: {
        title: "Jim qo'ng'iroq: o'chiring",
        description:
          "Qo'ng'iroqda jim turishsa, «ha» demang va gapni davom ettirmang. O'chiring, bloklang va yaqinlarni ogohlantiring.",
      },
      personal_data: {
        title: "Hujjatlar: rasm yubormang",
        description:
          "Pasport, PINFL/STIR, selfi yoki manzilni yubormang. Shu so'rovga faqat iltimos matnini qo'shing — ma'lumotsiz.",
        message:
          "Pasport rasmi, PINFL/STIR, selfi, manzil yoki boshqa shaxsiy ma'lumotlarni yubormang. So'rovni rasmiy kanal orqali tekshiring. Bu yerga faqat matn yoki havolani, hujjat va sirlarsiz qo'shing.",
      },
      personal_data_aftercare: {
        title: "Pasport yuborilgan: xavfni kamaytiring",
        description:
          "Yozishmani saqlang. Boshqa ma'lumot yubormang; aloqani to'xtatib, rasmiy raqam orqali himoya choralarini aniqlang.",
        message:
          "Yozishmani saqlang. Profil va yuborilgan vaqtni ham qayd eting. Boshqa ma'lumot yubormang va suhbatdosh bilan bahslashmang. Kod, karta yoki kirish huquqini ham bergan bo'lsangiz, darhol bankka qo'ng'iroq qiling. Pasport bo'yicha hujjatni bergan organ yoki politsiyaga faqat rasmiy raqam orqali murojaat qilib, himoya choralarini aniqlang.",
      },
      delivery_payment: {
        title: "Kuryer/posilka: to'lovni tekshiring",
        description:
          "Kuryer yoki posilka uchun chatdagi boj/to'lovni to'lamang. SMS yoki havolani to'liq yuboring.",
      },
      prize_fee: {
        title: "Yutuq: oldindan to'lov qilmang",
        description:
          "Yutuq, grant yoki sovg'a uchun avval soliq/komissiya to'lamang. Xabarni yuboring.",
      },
      gov_service: {
        title: "OneID/davlat xizmati: kod kiritmang",
        description:
          "Chat/SMS havolasi orqali kirmang. my.gov.uz yoki soliq.uz ni o'zingiz oching; parol va SMS-kodni aytmang.",
      },
      sim_swap: {
        title: "SIM/operator: ehtiyot bo'ling",
        description:
          "SIM/eSIM almashtirish yoki raqamni ko'chirish uchun kod aytmang. Suhbatni tugatib, operatorga o'zingiz qo'ng'iroq qiling.",
      },
      relative_distress: {
        title: "Yaqin odam xavfda: qayta qo'ng'iroq qiling",
        description:
          "Shoshilinch pul o'tkazmang. Saqlangan raqamga qayta qo'ng'iroq qiling yoki oilaviy kod so'zini so'rang.",
      },
      job_offer: {
        title: "Ish: oldindan to'lov qilmang",
        description:
          "Shartnomasiz ish yoki majburiy o'qish uchun to'lash xavfli. Tekshirish uchun shartlar, kompaniya nomi yoki URLni kiriting; pul va hujjat yubormang.",
        message:
          "Shartnoma va ish beruvchini mustaqil tekshirmasdan o'qish, forma, tekshiruv yoki vakansiyaga kirish uchun to'lamang. Bu yerga faqat shartlar matni, kompaniya nomi yoki vakansiya URLini kiriting; pul va hujjat yubormang.",
      },
      investment_offer: {
        title: "Invest/kripto: ehtiyot bo'ling",
        description: "Depozit yubormang. Kafolatlangan TON/USDT daromadi - keng tarqalgan tuzoq.",
      },
      travel_migration_prepayment: {
        title: "Viza/tur: oldindan to'lamang",
        description:
          "Viza, chet elda ish, haj/umra, tur va chiptalar uchun chatda oldindan to'lov yoki yig'im so'ralsa, xavfli.",
      },
      romance_money: {
        title: "Munosabat: pul yubormang",
        description:
          "Yangi tanish chipta, viza, davolanish yoki investitsiya uchun pul so'rasa, to'xtang va matnni yuboring.",
      },
      unknown_contact: {
        title: "Notanish odam: so'rov matni kerak",
        description: "Kod, pul, karta yoki hujjat yubormang. U aynan nima so'rayotganini yuboring.",
      },
      identity_uncertain: {
        title: "Shaxs aniq emas: qayta qo'ng'iroq qiling",
        description:
          "Tanish odamning akkaunti buzilgan bo'lishi mumkin. Saqlangan raqamga qo'ng'iroq qiling yoki shaxsiy savol bering.",
      },
      earning_channel: {
        title: "Daromad kanali: ehtiyot bo'ling",
        description:
          "Tez daromad kanallari ko'pincha depozit, kripto, stavka yoki «topshiriq»ga olib boradi. Oldindan to'lamang.",
      },
      bank_contact: {
        title: "Bank bilan aloqa: faqat rasmiy raqam",
        description:
          "Ilova, karta yoki rasmiy sayt orqali qo'ng'iroq qiling. Chat, SMS yoki qo'ng'iroqdagi raqamdan foydalanmang.",
      },
      general_scam_concern: {
        title: "Aldovdan shubhalanyapsiz: so'rovni yuboring",
        description:
          "Tekshirishga qaror qilganingiz yaxshi. Shu so'rovga xabar, havola, raqam yoki aniq iltimosni qo'shing.",
      },
      voting_link: {
        title: "Ovoz berish/kanal: avval tekshiramiz",
        description:
          "Havolaga o'tmang va Telegramga qayta kirmang. Bunday havola akkauntni o'g'irlashi mumkin: kod kiritmang, URLni shu yerga qo'shing.",
      },
      next_step: {
        title: "Nima qilish kerak: hozircha hech narsa yubormang",
        description:
          "Shu so'rovga matn, havola, raqam yoki nima bo'lganini qo'shing — aniq xavfsiz qadamni aytaman.",
      },
      reply_safety: {
        title: "Javob: ma'lumot bermang",
        description:
          "Bu yerga faqat iltimos matnini yozing. Haqiqiy SMS-kod, PIN, CVV, karta ma'lumoti yoki hujjat rasmini kiritmang.",
        message:
          "Ma'lumot bermasdan neytral javob berish mumkin. Shu so'rovga faqat begona iltimos matnini qo'shing; haqiqiy SMS-kod, PIN, CVV, karta, parol yoki hujjat rasmini kiritmang.",
      },
      safety_question: {
        title: "Xavfsizmi: faktlar bo'yicha tekshiramiz",
        description:
          "Taxmin qilmayman. Xabar, havola, raqam yoki skrin yuboring; hozircha hech narsa kiritmang yoki to'lamang.",
      },
      blackmail_threat: {
        title: "Foto bilan shantaj: pul to'lamang",
        description:
          "Skrinshotlarni saqlang. Pul yoki yangi material yubormang; keyin profilni bloklab, shikoyat qiling.",
        message:
          "Bu shantaj yoki unga tayyorgarlikka o'xshaydi. Pul, yangi foto/video, hujjat yoki kod yubormang: to'lov materiallar o'chirilishini kafolatlamaydi. Yozishma va profil skrinshotlarini saqlang, yaqin odamga ayting, keyin yuboruvchini bloklab Telegramga shikoyat qiling. To'g'ridan-to'g'ri tahdid bo'lsa, politsiyaga faqat rasmiy raqam orqali murojaat qiling.",
      },
      bank_impersonation: {
        title: "Soxta bank xodimi: suhbatni tugating",
        description:
          "Operatsiyani tasdiqlamang va kod aytmang. Suhbatni tugatib, bank ilovasini o'zingiz oching yoki kartadagi raqamga qo'ng'iroq qiling.",
      },
      safe_account_transfer: {
        title: "«Xavfsiz hisob»: pul o'tkazmang",
        description:
          "Bank yoki politsiya mijoz pulini «xavfsiz hisob»ga o'tkazmaydi. Qo'ng'iroqni tugatib, bank bilan o'zingiz bog'laning.",
      },
      loan_advance_fee: {
        title: "Kredit: oldindan komissiya to'lamang",
        description:
          "Haqiqiy kreditor tasdiqlash, sug'urta yoki kredit berish uchun shaxsiy kartaga pul so'ramaydi. Tashkilotni alohida tekshiring.",
      },
      charity_pressure: {
        title: "Xayriya: avval jamg'armani tekshiring",
        description:
          "Bosim ostida shaxsiy kartaga pul o'tkazmang. Jamg'armaning rasmiy sayti va rekvizitlarini xabardagi havolasiz o'zingiz toping.",
      },
      support_impersonation: {
        title: "Soxta yordam xizmati: himoyani o'chirmang",
        description:
          "Yordam xizmati 2FAni o'chirishni, kod aytishni yoki kirish huquqini berishni so'ramaydi. Rasmiy yordam bo'limini o'zingiz oching.",
      },
      qr_login: {
        title: "QR-kirish: begona kodni skanerlamang",
        description:
          "Kirish QR-kodi begona qurilmani Telegramingizga ulashi mumkin. Uni skanerlamang va sozlamalarda faol seanslarni tekshiring.",
      },
      tax_payment: {
        title: "Havoladagi soliq: to'lamang",
        description:
          "Xabardagi havola orqali soliq yoki yig'im to'lamang. Soliq xizmatining rasmiy saytini o'zingiz ochib, qarzdorlikni o'sha yerda tekshiring.",
      },
      chat_invite: {
        title: "Kanal/chat: avval tekshiramiz",
        description:
          "Shubhali havolaga o'tmang va Telegramga qayta kirmang. URL, username yoki kanal so'rovi matnini shu yerga kiriting.",
      },
    },
    unknownTitle: "Kontekst kerak",
    unknownDescription:
      "To'liq xabarni yuboring: nima qilish so'ralgan, havola, raqam, kod, karta yoki pul.",
  },
  en: {
    phoneReportsTitle: "Number: reports found",
    phoneReportsDescription:
      "Ishonch Guard has confirmed reports. Do not send a code, card data or money.",
    phoneNoReportsTitle: "Number: no reports found",
    phoneNoReportsDescription:
      "No reports is not a guarantee. Describe the request here; do not paste a real code, PIN, CVV or document photo.",
    phoneWeakTitle: "Number looks incomplete",
    phoneWeakDescription:
      "Add the full number and describe the request here. Do not paste a real code, PIN, CVV or document photo.",
    telegramTitle: "Telegram: context needed",
    telegramDescription:
      "A username alone cannot prove risk. Add the request text, post link or screenshot.",
    humanIntents: {
      link_request: {
        title: "Link: check it first",
        description:
          "You mentioned a link, but its address is missing. Do not open it; add the URL or full text to this query.",
        message:
          "You mentioned a link, but its address is missing from the query. Do not open it or enter anything. Add the URL or full message to this same query — without passwords or codes.",
      },
      code_request: {
        title: "Code: do not share it with anyone",
        description:
          "Do not share your SMS code or PIN. Do not read out push codes, OTPs or passwords; add only the request text or screenshot.",
      },
      recovery_phrase_request: {
        title: "Recovery phrase: never share it",
        description:
          "Wallet support or verification does not need your seed/recovery phrase. Do not enter or send its words; if exposed, create a new wallet in the official app.",
      },
      sent_code: {
        title: "Code already sent: act now",
        description:
          "Block card/access through the bank and change the password from another device. Do not argue with the scammer.",
      },
      sent_money: {
        title: "Money already sent: call the bank now",
        description:
          "Call the bank through an official number, ask to freeze/dispute the transfer, and save the receipt. Do not make a return transfer.",
      },
      confirm_request: {
        title: "Confirmation: be careful",
        description:
          "Do not confirm a login, transfer or card operation from a call/chat. Send what they ask to confirm.",
      },
      card_request: {
        title: "Card: do not send details",
        description:
          "Do not send card number, expiry, CVV/CVC, PIN or card photos. Send the request text.",
      },
      transfer_request: {
        title: "Transfer: reason needed",
        description:
          "Do not transfer to strangers or a “safe account”. If who, where or why is missing, add the reason for the transfer.",
      },
      app_request: {
        title: "App: do not install it",
        description:
          "Do not install APK, AnyDesk, RustDesk or a “security” app from a chat or call.",
      },
      unknown_call: {
        title: "Unknown call: call back safely",
        description:
          "If an unknown or foreign number calls, do not share a code, card data, or passport data. Hang up and verify the request.",
      },
      bank_call: {
        title: "Bank call: call back yourself",
        description:
          "Do not share codes or card data. Hang up and call the number from your card/app.",
      },
      operator_call: {
        title: "Mobile operator: call back yourself",
        description:
          "Verify Beeline/Ucell/Mobiuz/Uztelecom only through the official number or app. Do not share a SIM/eSIM code.",
      },
      foreign_call: {
        title: "Foreign call: do not continue under pressure",
        description:
          "A bank, operator or government service should not ask for codes from a foreign number. Hang up and verify through an official channel.",
      },
      telegram_takeover: {
        title: "Telegram: do not sign in by link",
        description:
          "Fake badges, blocking, deletion, Premium, voting or verification links often steal accounts. Do not enter a code or password.",
      },
      malicious_file: {
        title: "File/virus: do not open it",
        description:
          "APK, EXE, PDF.APK, GIF, PPTX, a voice file or a greeting card may steal access. Do not download it; send a screenshot or text.",
      },
      utility_impersonation: {
        title: "Utility service: call back yourself",
        description:
          "Water, gas, electricity or Suvsoz should not ask by chat/call for passport, tax ID, SMS code, or payment by link.",
      },
      official_impersonation: {
        title: "Government/inspector: verify officially",
        description:
          "Police, tax, court, or an inspector should not demand codes, money, or documents in chat. Call an official number.",
      },
      pension_benefit: {
        title: "Pension/benefit: do not share data",
        description:
          "A pension fund, grant or benefit increase does not require SMS code, card, passport, or tax ID by phone. Verify via 1271/102 or an official channel.",
      },
      phone_borrowing: {
        title: "Phone request: do not hand it unlocked",
        description:
          "If a stranger asks for your phone for a minute, they may open banking or recover accounts. Dial yourself and use speakerphone.",
      },
      money_mule: {
        title: "Someone else's money: do not forward it",
        description:
          "If money arrived by mistake or they ask you to withdraw/return it to another account, do not transfer it yourself. Contact the bank and save receipts.",
      },
      open_budget: {
        title: "Open Budget/vote: do not share the code",
        description:
          "Official voting does not buy your SMS code. Do not sell a vote, share a code, or bind your card/number to someone else's device.",
      },
      apple_security: {
        title: "Apple/iOS: do not install protection",
        description:
          "Popups about viruses, damaged iOS or Apple ID verification may be phishing. Close the page, do not enter a password or install an app.",
      },
      medical_code: {
        title: "Doctor/DMED: do not dictate a code",
        description:
          "A clinic or DMED should not ask for an SMS code by phone/chat. Book only through an official channel.",
      },
      child_game_bonus: {
        title: "Game bonuses: do not enter a code",
        description:
          "Free currency, bonuses or gifts for games can be bait. Do not move to messenger or share a code.",
      },
      silent_call: {
        title: "Silent call: hang up",
        description:
          "If the caller is silent, do not say yes or continue. Hang up, block the number, and warn relatives.",
      },
      personal_data: {
        title: "Documents: do not send photos",
        description:
          "Do not send a passport, tax ID, selfie or address. Add only the request text here — without personal data.",
        message:
          "Do not send passport photos, tax ID, selfies, address or other personal data. Verify the request through an official channel. Add only its text or link here — without documents or secrets.",
      },
      personal_data_aftercare: {
        title: "Passport already sent: reduce the risk",
        description:
          "Save the chat. Send nothing else; end contact and ask about protective steps through an official number.",
        message:
          "Save the chat, profile, and time sent. Send nothing else and do not argue with the contact. If you also shared a code, card details, or access, call your bank now. For the passport, contact the issuing authority or police through an official number and ask what protective steps to take.",
      },
      delivery_payment: {
        title: "Delivery: check the link",
        description:
          "Do not pay delivery/customs from a chat. Send the full SMS or link, especially if card data is asked.",
      },
      prize_fee: {
        title: "Prize: do not pay a fee",
        description:
          "Real prizes, grants or gifts do not require upfront tax/commission. Send the full message.",
      },
      gov_service: {
        title: "OneID/government: do not enter a code",
        description:
          "Do not sign in from a chat/SMS link. Open my.gov.uz or soliq.uz yourself; do not share password or SMS code.",
      },
      sim_swap: {
        title: "SIM/operator: be careful",
        description:
          "Do not share a code for SIM/eSIM replacement or number transfer. Hang up and call the operator yourself.",
      },
      relative_distress: {
        title: "Loved one in trouble: call back",
        description:
          "Do not send urgent money from a message. Call the saved number or ask the family code word.",
      },
      job_offer: {
        title: "Job: do not pay a fee",
        description:
          "Paying for a job or mandatory training before a contract is risky. Paste the terms, company name, or URL here; do not pay or send ID.",
        message:
          "Do not pay for training, uniform, verification or access to a vacancy before a contract and independent employer check. Paste only the terms, company name, or vacancy URL here; do not send money or documents.",
      },
      investment_offer: {
        title: "Invest/crypto: be careful",
        description: "Do not send a deposit. Guaranteed TON/USDT returns are common bait.",
      },
      travel_migration_prepayment: {
        title: "Visa/tour: do not prepay",
        description:
          "Visas, work abroad, Hajj/Umrah, tours and tickets are risky if a chat asks for prepayment or a fee.",
      },
      romance_money: {
        title: "Relationship: do not send money",
        description:
          "If a new contact asks for a ticket, visa, treatment or investment, pause and send the request text.",
      },
      unknown_contact: {
        title: "Unknown contact: send the request",
        description:
          "Do not send codes, money, card data or documents. Send what exactly they ask you to do.",
      },
      identity_uncertain: {
        title: "Identity unclear: call back",
        description:
          "A familiar account may be hacked. Call the saved number or ask a personal question.",
      },
      earning_channel: {
        title: "Earning channel: be careful",
        description:
          "Fast-income channels often lead to deposits, crypto, betting or tasks. Do not prepay.",
      },
      bank_contact: {
        title: "Contacting the bank: official number only",
        description:
          "Call from the app, card or official website. Do not use a number from a chat, SMS or call.",
      },
      general_scam_concern: {
        title: "Suspect a scam: send the request",
        description:
          "Good that you decided to check. Add the message, link, number, or the exact request here.",
      },
      voting_link: {
        title: "Voting/channel: check it first",
        description:
          "Do not open the link or sign in to Telegram again. It may steal the account: do not enter a code; paste the URL here.",
      },
      next_step: {
        title: "What to do: do not send anything yet",
        description:
          "Add the text, link, number, or what already happened here — I will give a specific safe step.",
      },
      reply_safety: {
        title: "Reply: do not reveal data",
        description:
          "Add only the request text here. Do not paste a real SMS code, PIN, CVV, card details or document photo.",
        message:
          "You may reply neutrally without revealing data. Add only the other person's request text here; never paste a real SMS code, PIN, CVV, card details, password or document photo.",
      },
      safety_question: {
        title: "Is it safe: check with facts",
        description:
          "I will not guess. Send the message, link, number or screenshot; do not enter anything or pay yet.",
      },
      blackmail_threat: {
        title: "Photo blackmail: do not pay",
        description:
          "Save screenshots. Do not send money or new material; then block and report the profile.",
        message:
          "This looks like blackmail or preparation for it. Do not pay or send new photos, videos, documents, or codes: payment does not guarantee deletion. Save screenshots of the chat and profile, tell someone you trust, then block the sender and report the account to Telegram. If there is a direct threat, contact police through an official number.",
      },
      bank_impersonation: {
        title: "Fake bank employee: end the call",
        description:
          "Do not confirm the operation or share a code. End the call, then open the bank app yourself or call the number printed on the card.",
      },
      safe_account_transfer: {
        title: "‘Safe account’: do not transfer",
        description:
          "Banks and police do not move customer money to a ‘safe account’. End the call and contact the bank independently.",
      },
      loan_advance_fee: {
        title: "Loan: do not pay an advance fee",
        description:
          "A real lender does not require a transfer to a personal card for approval, insurance, or release of a loan. Verify the lender independently.",
      },
      charity_pressure: {
        title: "Charity request: verify the organization first",
        description:
          "Do not transfer to a personal card under pressure. Find the charity's official site and payment details yourself, not through the message link.",
      },
      support_impersonation: {
        title: "Fake support: do not disable protection",
        description:
          "Support will not ask you to disable 2FA, share a code, or hand over access. Open the app yourself and use its official help section.",
      },
      qr_login: {
        title: "QR sign-in: do not scan someone else's code",
        description:
          "A sign-in QR can connect another device to your Telegram account. Do not scan it; review active sessions in settings.",
      },
      tax_payment: {
        title: "Tax payment link: do not pay",
        description:
          "Do not pay a tax or fee through a link from a message. Open the tax authority's official site yourself and verify the charge there.",
      },
      chat_invite: {
        title: "Channel/chat: check it first",
        description:
          "Do not open a suspicious link or sign in to Telegram again. Paste the URL, username, or channel request text here.",
      },
    },
    unknownTitle: "More context needed",
    unknownDescription:
      "Paste the full message: what they ask you to do, link, number, code, card or transfer.",
  },
};

function classifyInlineFollowUp(text: string): InlineFollowUpKind | null {
  const lines = text
    .normalize("NFKC")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  // A user may add a follow-up question on line two and then paste the actual
  // message, URL or username on line three. Matching only the last line made
  // the question disappear as soon as useful evidence was added.
  const tail = normalizeIntentTextForMatching(lines.slice(1).join(" "));
  if (
    /(?:номер|телефон|raqam|phone|number).{0,80}(?:чат|chat|sms|смс|звон|qo['’]?ng['’]?iroq|message)/iu.test(
      tail,
    ) ||
    /(?:чат|chat|sms|смс|звон|qo['’]?ng['’]?iroq|message).{0,80}(?:номер|телефон|raqam|phone|number)/iu.test(
      tail,
    )
  ) {
    return "bank_chat_number";
  }
  if (
    /(?:как|qanday|how).{0,90}(?:узнать|понять|провер|бил|аниқ|know|tell|check).{0,90}(?:ссылк|havola|link|url).{0,80}(?:подстав|фейк|soxta|fake|phish|мошен|firib)/iu.test(
      tail,
    ) ||
    /(?:ссылк|havola|link|url).{0,90}(?:подстав|фейк|soxta|fake|phish|мошен|firib)/iu.test(tail) ||
    /(?:подстав|фейк|soxta|fake|phish).{0,40}(?:ссылк|havola|link|url)/iu.test(tail)
  ) {
    return "link_verification";
  }
  if (
    /(?:не\s+доверять|можно\s+ли\s+(?:ему|ей|им)?\s*доверять|стоит\s+ли\s+доверять|ishonmaslik|ishonsam\s+bo['’]?ladimi|should\s+i\s+(?:not\s+)?trust|can\s+i\s+trust|do\s+not\s+trust)/iu.test(
      tail,
    )
  ) {
    return "trust";
  }
  if (
    /(?:получается|значит|выходит|это|они|он|она).{0,80}(?:развод|обман|мошен|скам)|(?:развод|обман|мошен|скам).{0,80}(?:получается|значит|это|они|он|она)|(?:demak|unda|bu).{0,80}(?:firib|aldov|aldashyap)|(?:firib|aldov|aldashyap).{0,80}(?:mi|demak|unda)|(?:is\s+this|are\s+they|does\s+that\s+mean|so\s+is\s+this).{0,80}(?:scam|fraud|scamming)/iu.test(
      tail,
    )
  ) {
    return "scam_confirmation";
  }
  if (
    /(?:почему|с\s+чего|как\s+ты\s+понял|нега|nega|nimaga|qanday\s+bilding|why|how\s+did\s+you\s+(?:know|decide)).{0,100}(?:так|опас|риск|подозр|мошен|firib|xavf|shubha|risk|suspicious|scam)?/iu.test(
      tail,
    )
  ) {
    return "reason";
  }
  if (
    /(?:что|как).{0,60}(?:(?:теперь|дальше).{0,60}(?:делать|поступить)|(?:делать|поступить).{0,30}(?:теперь|дальше))|(?:куда).{0,60}(?:обращаться|звонить)|(?:endi|keyin).{0,60}(?:nima|qanday).{0,60}(?:qil|murojaat)|(?:what|how).{0,60}(?:should\s+i\s+do|do\s+i\s+do|next)|where.{0,60}(?:report|call|contact)/iu.test(
      tail,
    )
  ) {
    return "next_action";
  }
  return null;
}

function validInlineUrlHost(text: string): string | null {
  const candidates =
    text.match(
      /(?:https?:\/\/|www\.)[^\s<>"']+|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>"']*)?/giu,
    ) ?? [];

  for (const rawCandidate of candidates) {
    const candidate = rawCandidate.replace(/[),.;!?\]}]+$/gu, "");
    try {
      const parsed = new URL(/^https?:\/\//iu.test(candidate) ? candidate : `https://${candidate}`);
      if (
        (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        parsed.hostname.includes(".")
      ) {
        return parsed.hostname;
      }
    } catch {
      // A malformed address is intentionally not presented as a parsed URL.
    }
  }
  return null;
}

function inlineTelegramUsername(text: string): string | null {
  const match = text.match(/(?:^|\s)@([A-Za-z][A-Za-z0-9_]{4,31})(?![A-Za-z0-9_])/u);
  return match?.[1] ?? null;
}

function artifactAwareHumanInlineCopy(
  text: string,
  lang: Lang,
  intent: HumanInlineIntent,
): HumanInlineCopy | null {
  const host = validInlineUrlHost(text);
  if (host && intent === "tax_payment") {
    const base = PREVIEW_COPY[lang].humanIntents[intent];
    if (lang === "uz") {
      return {
        ...base,
        description: `${base.description} Manzil topildi; ko'rinadigan domenni ochmasdan tekshiring.`,
        message: `${base.message}\n\nURL topildi (${host}). Ko'rinadigan domen xabardagi soliq talabi bilan birga baholanadi; havolani ochmang va u orqali to'lamang.`,
      };
    }
    if (lang === "en") {
      return {
        ...base,
        description: `${base.description} The address is present; inspect the visible domain without opening it.`,
        message: `${base.message}\n\nURL found (${host}). The visible domain is assessed together with the tax demand; do not open or pay through the link.`,
      };
    }
    return {
      ...base,
      description: `${base.description} Адрес найден; проверьте видимый домен, не открывая его.`,
      message: `${base.message}\n\nURL найден (${host}). Видимый домен оценивается вместе с требованием оплатить налог; не открывайте ссылку и не платите через неё.`,
    };
  }
  if (host && (intent === "link_request" || intent === "voting_link")) {
    const baseTitle = PREVIEW_COPY[lang].humanIntents[intent].title;
    if (lang === "uz") {
      return {
        title: baseTitle,
        description:
          "Manzil topildi. Havolani ochmang: domen yozilishi va so'rov konteksti o'tmasdan tekshiriladi.",
        message: `URL topildi (${host}). Men havolani ochmasdan faqat ko'rinadigan domen va xabar kontekstini baholayman; bu sayt xavfsizligini kafolatlamaydi. Kod, parol yoki karta ma'lumotini kiritmang.`,
      };
    }
    if (lang === "en") {
      return {
        title: baseTitle,
        description:
          "The address is present. Do not open it; the visible domain spelling and request context are checked without visiting it.",
        message: `URL found (${host}). I assess only the visible domain and message context without opening it; this does not guarantee that the site is safe. Do not enter a code, password, or card details.`,
      };
    }
    return {
      title: baseTitle,
      description:
        "Адрес в запросе есть. Не открывайте его: проверяются написание домена и контекст без перехода на сайт.",
      message: `URL найден (${host}). Я оцениваю только видимый домен и контекст сообщения, не открывая сайт; это не гарантирует его безопасность. Не вводите код, пароль или данные карты.`,
    };
  }

  const username = inlineTelegramUsername(text);
  if (username && intent === "chat_invite") {
    if (lang === "uz") {
      return {
        title: "Kanal username'i topildi: bu hali kafolat emas",
        description: `@${username} ko'rsatilgan. Username kanal xavfsizligini isbotlamaydi; u sizdan nima so'rayotganini tekshiring.`,
        message: `@${username} username'i ko'rsatilgan, lekin nomning o'zi kanal kimga tegishli yoki xavfsiz ekanini isbotlamaydi. Havolani ochmang, qayta kirmang va kanal sizdan nima qilishni so'rayotganini tekshiring.`,
      };
    }
    if (lang === "en") {
      return {
        title: "Channel username found: not proof of safety",
        description: `@${username} is present. A username does not prove who owns the channel; check what it asks you to do.`,
        message: `@${username} is present, but a name alone does not prove who owns the channel or that it is safe. Do not open a link or sign in again; check exactly what the channel asks you to do.`,
      };
    }
    return {
      title: "Username канала найден: это не гарантия",
      description: `@${username} указан. Сам username не доказывает владельца или безопасность канала; проверьте, что он просит сделать.`,
      message: `@${username} указан, но одно имя не доказывает владельца или безопасность канала. Не открывайте ссылку и не входите заново; проверьте, что именно канал просит сделать.`,
    };
  }

  return null;
}

function nextActionHumanInlineCopy(
  lang: Lang,
  intent: HumanInlineIntent,
  base: HumanInlineCopy,
): HumanInlineCopy {
  const isRecoveryPhraseContext = intent === "recovery_phrase_request";
  const isCodeContext = [
    "code_request",
    "gov_service",
    "medical_code",
    "operator_call",
    "sim_swap",
  ].includes(intent);
  const isLinkContext = [
    "link_request",
    "voting_link",
    "chat_invite",
    "telegram_takeover",
  ].includes(intent);
  const isPaymentContext = [
    "transfer_request",
    "job_offer",
    "investment_offer",
    "prize_fee",
    "earning_channel",
    "safe_account_transfer",
    "loan_advance_fee",
    "charity_pressure",
    "delivery_payment",
    "tax_payment",
    "romance_money",
  ].includes(intent);

  if (lang === "uz") {
    const description = isRecoveryPhraseContext
      ? "Tiklash iborasini yubormang. Agar uni oshkor qilgan bo'lsangiz, rasmiy ilovada yangi hamyon yarating va mablag'ni xavfsiz ko'chiring."
      : isCodeContext
        ? "SMS-kodni aytmang. Suhbatni tugating va tashkilotga o'zingiz topgan rasmiy raqam yoki ilova orqali murojaat qiling."
        : isLinkContext
          ? "Havolani ochmang va qayta kirmang. Xabarni saqlang; manzilni ochmasdan tekshiring."
          : isPaymentContext
            ? "Pul yubormang. Yozishmani saqlang va taklifni mustaqil rasmiy manba orqali tekshiring."
            : "Aloqani vaqtincha to'xtating, hech narsa yubormang yoki to'lamang va so'rovni rasmiy kanal orqali tekshiring.";
    return {
      title: `${base.title} — hozir nima qilish kerak`,
      description: `${description} ${base.description}`,
      message: `${description} ${base.message ?? base.description}`,
    };
  }
  if (lang === "en") {
    const description = isRecoveryPhraseContext
      ? "Do not share the recovery phrase. If it was exposed, create a new wallet in the official app and move the assets safely."
      : isCodeContext
        ? "Do not share the SMS code. End the chat or call and contact the organization through an official number or app you find yourself."
        : isLinkContext
          ? "Do not open the link or sign in again. Save the message and check the address without visiting it."
          : isPaymentContext
            ? "Do not send money. Save the conversation and verify the offer through an independent official source."
            : "Pause contact, send or pay nothing, and verify the request through an official channel you find yourself.";
    return {
      title: `${base.title} — what to do now`,
      description: `${description} ${base.description}`,
      message: `${description} ${base.message ?? base.description}`,
    };
  }
  const description = isRecoveryPhraseContext
    ? "Не отправляйте сид-фразу. Если уже раскрыли её, создайте новый кошелёк в официальном приложении и безопасно перенесите активы."
    : isCodeContext
      ? "Не сообщайте SMS-код. Завершите чат или звонок и свяжитесь с организацией по официальному номеру или через приложение, найденные самостоятельно."
      : isLinkContext
        ? "Не открывайте ссылку и не входите заново. Сохраните сообщение и проверьте адрес без перехода на сайт."
        : isPaymentContext
          ? "Не переводите деньги. Сохраните переписку и независимо проверьте предложение через официальный источник."
          : "Приостановите контакт, ничего не отправляйте и не оплачивайте; проверьте просьбу через официальный канал, найденный самостоятельно.";
  return {
    title: `${base.title} — что делать сейчас`,
    description: `${description} ${base.description}`,
    message: `${description} ${base.message ?? base.description}`,
  };
}

function followUpAwareHumanInlineCopy(
  text: string,
  lang: Lang,
  intent: HumanInlineIntent,
): HumanInlineCopy {
  const base = PREVIEW_COPY[lang].humanIntents[intent];
  const artifactAware = artifactAwareHumanInlineCopy(text, lang, intent);
  if (artifactAware) return artifactAware;
  const followUp = classifyInlineFollowUp(text);
  if (!followUp) return base;

  const baseMessage = base.message ?? base.description;
  if (followUp === "bank_chat_number" && intent === "bank_contact") {
    const normalized = normalizeIntentTextForMatching(text);
    const fromSms =
      /(?:sms|смс|xabar|message)/iu.test(normalized) && !/(?:чат|chat)/iu.test(normalized);
    if (lang === "uz") {
      return {
        title: fromSms
          ? "SMSdagi raqamga qo'ng'iroq qilmang"
          : "Chatdagi raqamga qo'ng'iroq qilmang",
        description: `${fromSms ? "SMSdagi" : "Chatdagi"} raqamdan foydalanmang: u almashtirilgan bo'lishi mumkin. Raqamni ilova, karta yoki rasmiy saytdan toping.`,
        message: `Chat yoki SMSdagi raqam bankniki ekanini isbotlamaydi. U almashtirilgan bo'lishi mumkin. ${baseMessage}`,
      };
    }
    if (lang === "en") {
      return {
        title: fromSms
          ? "Do not call the number from the SMS"
          : "Do not call the number from the chat",
        description: `Do not use a number from ${fromSms ? "an SMS" : "a chat"}: it may be substituted. Find it in the bank app, on the card, or official website.`,
        message: `A number from a chat or SMS is not proof that it belongs to the bank; it may be substituted. ${baseMessage}`,
      };
    }
    return {
      title: fromSms ? "По номеру из SMS не звоните" : "По номеру из чата не звоните",
      description: `Не используйте номер из ${fromSms ? "SMS" : "чата"}: он может быть подменён. Найдите номер сами в приложении, на карте или официальном сайте.`,
      message: `Номер из чата или SMS не доказывает, что он принадлежит банку: его могли подменить. ${baseMessage}`,
    };
  }

  if (followUp === "link_verification" && (intent === "voting_link" || intent === "link_request")) {
    if (lang === "uz") {
      return {
        title: "Soxta havolani manzil bo'yicha tekshiring",
        description:
          "Havolaga o'tmang. URLning o'zi bo'lmasa, almashtirilganini aniqlab bo'lmaydi; manzilni to'liq qo'shing.",
        message: `Havolaning o'zi bo'lmasa, uning soxta yoki almashtirilganini aniqlab bo'lmaydi. Hozircha uni ochmang va manzilni to'liq qo'shing. ${baseMessage}`,
      };
    }
    if (lang === "en") {
      return {
        title: "Check a suspicious link by its address",
        description:
          "Do not open the link. Without the actual URL, substitution cannot be checked; add the complete address.",
        message: `Without the actual URL, I cannot tell whether the link was substituted or faked. Do not open it yet; add the complete address. ${baseMessage}`,
      };
    }
    return {
      title: "Подставную ссылку проверяют по адресу",
      description:
        "Не переходите по ссылке. Без самого URL подмену не определить; добавьте адрес целиком.",
      message: `Без самого URL нельзя определить, подставная ли ссылка. Пока не открывайте её и добавьте адрес целиком. ${baseMessage}`,
    };
  }

  if (followUp === "trust") {
    if (intent === "code_request") {
      const normalized = normalizeIntentTextForMatching(text);
      const prizeContext = /(?:выигр|квартир|приз|лотере|yutuq|sovg'a|prize|lottery|won)/iu.test(
        normalized,
      );
      if (lang === "uz") {
        const description = prizeContext
          ? "SMS-kodni aytmang. Yutuq va'dasi kompaniyani tasdiqlamaydi; uni o'zingiz topgan rasmiy kontakt orqali tekshiring."
          : "SMS-kodni aytmang. Suhbatni tugating va tashkilotga o'zingiz topgan rasmiy raqam yoki ilova orqali murojaat qiling.";
        return { title: "Yo'q: kodni unga aytmang", description, message: description };
      }
      if (lang === "en") {
        const description = prizeContext
          ? "Do not share the SMS code. A prize claim does not verify the company; contact it through an official channel you find yourself."
          : "Do not share the SMS code. End the chat or call and contact the organization through an official number or app you find yourself.";
        return { title: "No: do not tell them the code", description, message: description };
      }
      const description = prizeContext
        ? "Не сообщайте SMS-код. Обещание выигрыша не подтверждает компанию; проверьте её по официальным контактам, найденным самостоятельно."
        : "Не сообщайте SMS-код. Завершите чат или звонок и свяжитесь с организацией по официальному номеру или через приложение, найденные самостоятельно.";
      return { title: "Нет: код ему не сообщайте", description, message: description };
    }
    if (lang === "uz") {
      return {
        title: `${base.title} — tekshirmasdan ishonmang`,
        description: base.description,
        message: `So'rovga mustaqil tekshiruvsiz ishonmang. ${baseMessage}`,
      };
    }
    if (lang === "en") {
      return {
        title: `${base.title} — do not trust it without verification`,
        description: base.description,
        message: `Do not trust the request without an independent check. ${baseMessage}`,
      };
    }
    return {
      title: `${base.title} — не доверяйте без проверки`,
      description: base.description,
      message: `Не доверяйте этой просьбе без независимой проверки. ${baseMessage}`,
    };
  }

  if (followUp === "scam_confirmation") {
    if (lang === "uz") {
      return {
        title: `${base.title} — firib belgilariga o'xshaydi`,
        description: base.description,
        message: `Bu yerda odatiy xavf belgilari bor, ammo bitta xabar odamning kimligini isbotlamaydi. ${baseMessage}`,
      };
    }
    if (lang === "en") {
      return {
        title: `${base.title} — it resembles a scam pattern`,
        description: base.description,
        message: `There are common risk signs here, but one message does not prove who the sender is. ${baseMessage}`,
      };
    }
    return {
      title: `${base.title} — похоже на схему обмана`,
      description: base.description,
      message: `Здесь есть типичные признаки рискованной схемы, но одно сообщение не доказывает личность отправителя. ${baseMessage}`,
    };
  }

  if (followUp === "reason") {
    if (lang === "uz") {
      return {
        title: `${base.title} — nega bu shubhali`,
        description: base.description,
        message: `Sabab: ${baseMessage}`,
      };
    }
    if (lang === "en") {
      return {
        title: `${base.title} — why this looks risky`,
        description: base.description,
        message: `Reason: ${baseMessage}`,
      };
    }
    return {
      title: `${base.title} — почему это рискованно`,
      description: base.description,
      message: `Основание: ${baseMessage}`,
    };
  }

  // A follow-up family can be meaningful without belonging to the resolved
  // concrete intent (for example, a code request followed by a phone-number
  // question). Keep the safer concrete card instead of mislabelling it as a
  // generic next-action answer.
  if (followUp !== "next_action") return base;

  return nextActionHumanInlineCopy(lang, intent, base);
}

function isRateLimitedError(value: unknown): value is RateLimitedError {
  return value instanceof Error && (value as Partial<RateLimitedError>).status === 429;
}

function safeInlineDisplay(value: string, type: RunCheckResult["type"]): string {
  const trimmed = value.trim();
  if (type === "url" || type === "apk") {
    try {
      new URL(/^https?:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`);
    } catch {
      return "[link]";
    }
  }
  return maskForDisplay(trimmed, type);
}

function buildArticle(
  id: string,
  title: string,
  description: string,
  messageText: string,
  lang: Lang,
): InlineQueryResultArticle {
  const username = configuredBotUsername();
  const resolvedTitle = applyConfiguredBotMention(title, username);
  const resolvedDescription = applyConfiguredBotMention(description, username);
  const resolvedMessageText = applyConfiguredBotMention(messageText, username);
  const article: InlineQueryResultArticle = {
    type: "article",
    id,
    title: resolvedTitle,
    description: compactInlineDescription(resolvedDescription),
    input_message_content: {
      message_text: escapeMarkdownV2(resolvedMessageText),
      parse_mode: "MarkdownV2",
      disable_web_page_preview: true,
    },
    reply_markup: {
      inline_keyboard: [[{ text: COPY[lang].continueInBot, url: `https://t.me/${username}` }]],
    },
  };
  INLINE_PLAIN_TEXT.set(article, resolvedMessageText);
  return article;
}

function topReason(result: RunCheckResult, lang: Lang, copy: Copy): string {
  const reasons = collectResultReasonCodesForPresentation(result);
  return presentInlineReason(reasons, lang)?.text ?? copy.reasonFallback[result.level];
}

function ensureSentenceEnding(value: string): string {
  return /[.!?…]$/u.test(value) ? value : `${value}.`;
}

function inlineSafeAction(result: RunCheckResult, lang: Lang, copy: Copy): string {
  const reasons = collectResultReasonCodesForPresentation(result);
  const primaryReason = presentInlineReason(reasons, lang)?.reason;
  const reasonBoundAction = primaryReason
    ? filterAdvice(result.level, [primaryReason], lang)[0]
    : undefined;
  return ensureSentenceEnding(reasonBoundAction ?? copy.levels[result.level].step);
}

function formatInlineMessage(result: RunCheckResult, lang: Lang): string {
  const copy = COPY[lang];
  const level = copy.levels[result.level];
  if (result.level === "high_risk" || result.level === "suspicious") {
    return [
      level.title,
      `${copy.stepLabel}: ${inlineSafeAction(result, lang, copy)}`,
      "",
      copy.checkedBy,
      "",
      `${copy.displayLabel}: ${safeInlineDisplay(result.display, result.type)}`,
      `${copy.reasonLabel}: ${topReason(result, lang, copy)}`,
      "",
      "@scamguard_bot",
    ].join("\n");
  }

  const lines = [
    level.title,
    copy.checkedBy,
    "",
    `${copy.displayLabel}: ${safeInlineDisplay(result.display, result.type)}`,
    `${copy.reasonLabel}: ${topReason(result, lang, copy)}`,
    `${copy.stepLabel}: ${level.step}`,
    "",
    "@scamguard_bot",
  ];
  return lines.join("\n");
}

function formatInlinePreviewDescription(result: RunCheckResult, lang: Lang): string {
  const copy = COPY[lang];
  const level = copy.levels[result.level];
  const summary = `${level.description}. ${topReason(result, lang, copy)}`;
  return result.level === "high_risk" || result.level === "suspicious"
    ? `${inlineSafeAction(result, lang, copy)} ${summary}`
    : summary;
}

function formatHumanInlineMessage(
  result: RunCheckResult,
  lang: Lang,
  intentCopy: HumanInlineCopy,
): string {
  const copy = COPY[lang];
  const level = copy.levels[result.level];
  const isElevated = result.level === "high_risk" || result.level === "suspicious";
  const humanAction = firstSentence(intentCopy.description);
  const lines = isElevated
    ? [
        level.title,
        `${copy.stepLabel}: ${humanAction}`,
        intentCopy.title,
        "",
        copy.checkedBy,
        "",
        `${copy.displayLabel}: ${safeInlineDisplay(result.display, result.type)}`,
      ]
    : [
        intentCopy.title,
        copy.checkedBy,
        "",
        `${copy.displayLabel}: ${safeInlineDisplay(result.display, result.type)}`,
      ];
  if (result.level !== "unknown") {
    lines.push(`${copy.reasonLabel}: ${topReason(result, lang, copy)}`);
  }
  lines.push("", intentCopy.message ?? intentCopy.description, "", "@scamguard_bot");
  return lines.join("\n");
}

function firstSentence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^.*?[.!?](?=\s|$)/u);
  return match?.[0] ?? ensureSentenceEnding(trimmed);
}

function formatHumanInlinePreviewDescription(
  result: RunCheckResult,
  lang: Lang,
  intentCopy: HumanInlineCopy,
): string {
  if (result.level === "unknown") return intentCopy.description;
  const copy = COPY[lang];
  const action = firstSentence(intentCopy.description);
  const remainder = intentCopy.description.slice(action.length).trim();
  return `${action} ${topReason(result, lang, copy)}${remainder ? ` ${remainder}` : ""}`;
}

function compactInlineDescription(value: string): string {
  const oneLine = value.replace(/\s+/gu, " ").trim();
  if (oneLine.length <= MAX_INLINE_DESCRIPTION_LENGTH) return oneLine;

  const softLimit = MAX_INLINE_DESCRIPTION_LENGTH - 1;
  const boundary = oneLine.lastIndexOf(" ", softLimit);
  const end = boundary >= 60 ? boundary : softLimit;
  const completeThought = oneLine
    .slice(0, end)
    .trimEnd()
    .replace(/(?:[,;:]?\s+)(?:или|и|либо|or|and|yoki|va)$/iu, "")
    .trimEnd();
  return `${completeThought}…`;
}

function hasSentCodeIntent(normalized: string): boolean {
  return (
    /(?:я|уже|только что|сейчас)?.{0,40}(?:передал|передала|отправил|отправила|сообщил|сообщила|назвал|назвала|продиктовал|продиктовала|ввел|ввёл|ввела|скинул|скинула|дал(?!\p{L})|дала(?!\p{L})).{0,80}(?:код|sms|смс|otp|push|пуш|pin|пин|парол)/iu.test(
      normalized,
    ) ||
    /(?:код|sms|смс|otp|push|пуш|pin|пин|парол).{0,80}(?:передал|передала|отправил|отправила|сообщил|сообщила|назвал|назвала|продиктовал|продиктовала|ввел|ввёл|ввела|скинул|скинула|дал(?!\p{L})|дала(?!\p{L}))/iu.test(
      normalized,
    ) ||
    /(?:men|allaqachon|hozirgina).{0,60}(?:kod|sms|otp|push|pin|parol).{0,60}(?:yubordim|aytdim|aytib\s+bo['’]?ldim|berdim|kiritdim|jo['’]?natdim)/iu.test(
      normalized,
    ) ||
    /(?:kod|sms|otp|push|pin|parol).{0,80}(?:yubordim|aytdim|aytib\s+bo['’]?ldim|berdim|kiritdim|jo['’]?natdim)/iu.test(
      normalized,
    ) ||
    /(?:i|already|just).{0,60}(?:sent|shared|gave|told|read out|entered).{0,80}(?:code|sms|otp|push|pin|password)/iu.test(
      normalized,
    )
  );
}

function hasRecoveryPhraseRequestIntent(normalized: string): boolean {
  const label =
    /(?:seed[\s-]*(?:phrase|phase|pharse|prhase|phras)|recovery[\s-]+(?:phrase|phase|pharse)|mnemonic(?:[\s-]+(?:phrase|phase))?|сид[\s-]*фраз|мнемоническ.{0,20}фраз|tiklash\s+(?:iborasi|so['’]?zlari))/iu;
  const action =
    /(?:прос|треб|отправ|сообщ|назва|покаж|раскры|переда|so['’]?ra|talab|yubor|jo['’]?nat|ayt|ber|ko['’]?rsat|ask|want|need|send|share|reveal|provide|verify)/iu;
  if (!label.test(normalized)) return false;
  return action.test(normalized);
}

function hasCodeRequestIntent(normalized: string): boolean {
  return (
    /(?:просят|просит|просил|попросил|попросили|хочет|хотят|требует|требуют|сказали|говорят|нужно|надо|пришел|пришёл|прислали|дали).{0,80}(?:код|sms|смс|otp|push|пуш|pin|пин|парол)/iu.test(
      normalized,
    ) ||
    /(?:спрашива|спросил|спросили|просит|просят|попросил|попросили).{0,80}(?:одноразов|код подтверждения|код|sms|смс|otp|push|пуш|pin|пин|парол)/iu.test(
      normalized,
    ) ||
    /(?:код|sms|смс|otp|push|пуш|pin|пин|парол).{0,80}(?:назвать|сказать|продиктовать|отправить|ввести|переслать|скинуть|пришел|пришёл|пришл|хочет|хотят|просит|просят|попросил|попросили|спросил|спросили)/iu.test(
      normalized,
    ) ||
    /(?:можно|стоит|надо|нужно).{0,60}(?:отправить|переслать|скинуть|ввести|сказать|назвать).{0,60}(?:код|sms|смс|otp|push|пуш|pin|пин|парол)/iu.test(
      normalized,
    ) ||
    /(?:kod|sms|otp|push|pin|parol|es\s*em\s*es|esemes).{0,80}(?:ayt|ber|yubor|kirit|kel|so['’]?ra|xohla|deyapti|dedi|kerakmi)/iu.test(
      normalized,
    ) ||
    /(?:ayt|ber|yubor|kirit|so['’]?ra|xohla|deyapti|dedi|kerakmi).{0,80}(?:kod|sms|otp|push|pin|parol|es\s*em\s*es|esemes)/iu.test(
      normalized,
    ) ||
    /(?:ask|asked|asks|need|needs|want|wants|sent).{0,80}(?:code|sms|otp|push|pin|password)/iu.test(
      normalized,
    ) ||
    /(?:code|sms|otp|push|pin|password).{0,80}(?:tell|say|share|send|read out|enter|should i|can i)/iu.test(
      normalized,
    ) ||
    /(?:назовите|скажите|сообщите|продиктуйте|отправьте|перешлите|скиньте|введите).{0,60}(?:код|sms|смс|otp|push|пуш|pin|пин|парол)/iu.test(
      normalized,
    ) ||
    /(?:ayting|bering|yuboring|jo['’]?nating|kiriting).{0,60}(?:kod|sms|otp|push|pin|parol|es\s*em\s*es|esemes)/iu.test(
      normalized,
    ) ||
    /(?:tell|say|share|send|read out|enter|provide).{0,60}(?:code|sms|otp|push|pin|password)/iu.test(
      normalized,
    )
  );
}

function hasTransferRequestIntent(normalized: string): boolean {
  return (
    /(?:просят|просит|нужно|надо|сказали).{0,80}(?:перевести|перевод|оплатить|заплатить|пополни|безопасн.{0,20}сч[её]т)/iu.test(
      normalized,
    ) ||
    /(?:перевести|перевод|переведите|оплатить|оплатите|заплатить|заплатите).{0,80}(?:деньг|сум|карт|номер|сч[её]т)/iu.test(
      normalized,
    ) ||
    /(?:pul|to['’]?lov|o['’]?tkaz|hisob).{0,80}(?:yubor|qil|ber|to['’]?la)/iu.test(normalized) ||
    /(?:ask|asked|asks|need|needs|want|wants).{0,80}(?:transfer|pay|payment|send money|safe account)/iu.test(
      normalized,
    ) ||
    /(?:transfer|send|pay).{0,60}(?:money|funds|fee|account)/iu.test(normalized)
  );
}

function hasCardRequestIntent(normalized: string): boolean {
  return (
    !hasTransferRequestIntent(normalized) &&
    (/(?:просят|просит|попросил|попросили|спрашива|спросил|спросили|требует|требуют|нужно|надо|сказали).{0,80}(?:карт|cvv|cvc|срок|оборот|номер карты|реквизит|пин|pin)/iu.test(
      normalized,
    ) ||
      /(?:карт|cvv|cvc|срок|оборот|номер карты|реквизит).{0,80}(?:отправ|назв|ввест|фото|сфот|спрашива|спросил|спросили|просят|просит|требует|требуют)/iu.test(
        normalized,
      ) ||
      /(?:введите|пришлите|отправьте|назовите|сообщите|покажите).{0,60}(?:данн.{0,20})?(?:карт|cvv|cvc|срок|реквизит|пин|pin)/iu.test(
        normalized,
      ) ||
      /(?:karta|cvv|cvc|pin).{0,80}(?:ma['’]?lumot|raqam|ayt|ber|yubor|kirit|so['’]?ra)/iu.test(
        normalized,
      ) ||
      /(?:ayt|ber|yubor|kirit|so['’]?ra).{0,60}(?:karta|cvv|cvc|pin)/iu.test(normalized) ||
      /(?:ask|asked|asks|need|needs|want|wants).{0,80}(?:card|cvv|cvc|expiry|pin)/iu.test(
        normalized,
      ) ||
      /(?:send|share|enter|provide|give).{0,60}(?:card|cvv|cvc|expiry|pin)/iu.test(normalized))
  );
}

function hasAppRequestIntent(normalized: string): boolean {
  return (
    /(?:просят|просит|нужно|надо|сказали).{0,80}(?:установ|скач|постав|прилож|apk|anydesk|teamviewer|rustdesk|доступ|экран)/iu.test(
      normalized,
    ) ||
    /(?:установ|скач|постав).{0,80}(?:прилож|apk|защит|банк|anydesk|teamviewer|rustdesk|доступ)/iu.test(
      normalized,
    ) ||
    /(?:ilova|apk|anydesk|teamviewer|rustdesk|ekran|ruxsat).{0,80}(?:o['’]?rnat|yukla|ber|och)/iu.test(
      normalized,
    ) ||
    /(?:o['’]?rnat|yukla|och).{0,60}(?:ilova|apk|anydesk|teamviewer|rustdesk)/iu.test(normalized) ||
    /(?:install|download|set up).{0,80}(?:app|apk|anydesk|teamviewer|rustdesk|remote|screen)/iu.test(
      normalized,
    )
  );
}

function hasPersonalDataRequestIntent(normalized: string): boolean {
  return (
    /(?:просят|просит|нужно|надо|сказали).{0,80}(?:паспорт|(?:^|[^a-zа-яё])(?:пинфл|инн|стир)(?:$|[^a-zа-яё])|селфи|документ|адрес|пропис)/iu.test(
      normalized,
    ) ||
    /(?:паспорт|(?:^|[^a-zа-яё])(?:пинфл|инн|стир)(?:$|[^a-zа-яё])|селфи|документ|адрес).{0,80}(?:фото|сфот|отправ|назв)/iu.test(
      normalized,
    ) ||
    /(?:пришлите|отправьте|загрузите|покажите|назовите).{0,80}(?:фото\s+)?(?:паспорт|пинфл|инн|стир|селфи|документ|адрес)/iu.test(
      normalized,
    ) ||
    /(?:pasport|pinfl|stir|selfi|hujjat|manzil).{0,80}(?:rasm|yubor|ayt|ber|so['’]?ra)/iu.test(
      normalized,
    ) ||
    /(?:yubor|jo['’]?nat|ber|ko['’]?rsat).{0,60}(?:pasport|pinfl|stir|selfi|hujjat|manzil)/iu.test(
      normalized,
    ) ||
    /(?:ask|asked|asks|need|needs|want|wants).{0,80}(?:passport|tax id|selfie|document|address)/iu.test(
      normalized,
    ) ||
    /(?:send|upload|provide|share|show).{0,60}(?:passport|tax id|selfie|document|address)/iu.test(
      normalized,
    )
  );
}

function hasPriorityInlineDangerIntent(normalized: string): boolean {
  return (
    hasCodeRequestIntent(normalized) ||
    hasCardRequestIntent(normalized) ||
    hasTransferRequestIntent(normalized) ||
    hasPersonalDataRequestIntent(normalized) ||
    hasAppRequestIntent(normalized)
  );
}

function hasInstalledAppAccessIntent(normalized: string): boolean {
  return (
    /(?:я|мы|уже|только\s+что)?.{0,70}(?:установил|установила|поставил|поставила|скачал|скачала|дал(?:а)?\s+доступ|разрешил|разрешила).{0,100}(?:прилож|apk|anydesk|teamviewer|rustdesk|sms|смс|уведом|экран|телефон|доступ)/iu.test(
      normalized,
    ) ||
    /(?:men|allaqachon|hozirgina)?.{0,70}(?:ilova|apk|anydesk|teamviewer|rustdesk|sms|xabar|ruxsat|ekran).{0,100}(?:o['’]?rnatdim|yukladim|berdim|ruxsat)/iu.test(
      normalized,
    ) ||
    /(?:i|already|just)?.{0,70}(?:installed|downloaded|gave|allowed|granted).{0,100}(?:app|apk|anydesk|teamviewer|rustdesk|sms|notification|screen|phone|access)/iu.test(
      normalized,
    )
  );
}

function mapVictimIntentToHumanInlineIntent(kind: VictimIntentKind): HumanInlineIntent | null {
  switch (kind) {
    case "emotional_help":
    case "advice_question":
      return "next_step";
    case "general_scam_concern":
    case "report_question":
      return "general_scam_concern";
    case "unknown_contact":
    case "romance_contact":
      return "unknown_contact";
    case "unknown_call":
      return "unknown_call";
    case "bank_call":
      return "bank_call";
    case "operator_call":
      return "operator_call";
    case "foreign_call":
      return "foreign_call";
    case "identity_uncertain":
      return "identity_uncertain";
    case "telegram_message":
      return "safety_question";
    case "telegram_takeover":
      return "telegram_takeover";
    case "file_received":
      return "malicious_file";
    case "apple_security":
      return "apple_security";
    case "utility_impersonation":
      return "utility_impersonation";
    case "pension_benefit":
      return "pension_benefit";
    case "phone_borrowing":
      return "phone_borrowing";
    case "money_mule":
      return "money_mule";
    case "open_budget":
      return "open_budget";
    case "medical_code":
      return "medical_code";
    case "child_game_bonus":
      return "child_game_bonus";
    case "silent_call":
      return "silent_call";
    case "official_impersonation":
      return "official_impersonation";
    case "link_received":
    case "link_request":
      return "link_request";
    case "code_request":
      return "code_request";
    case "card_request":
      return "card_request";
    case "transfer_request":
      return "transfer_request";
    case "apk_request":
      return "app_request";
    case "personal_data_request":
      return "personal_data";
    case "personal_data_already_shared":
      return "personal_data_aftercare";
    case "friend_money":
      return "relative_distress";
    case "support_impersonation":
      return "support_impersonation";
    case "authority_impersonation":
    case "legal_impersonation":
      return "official_impersonation";
    case "gov_service_login":
      return "gov_service";
    case "romance_money":
      return "romance_money";
    case "job_offer":
      return "job_offer";
    case "investment_offer":
      return "investment_offer";
    case "earning_channel":
      return "earning_channel";
    case "travel_migration_prepayment":
      return "travel_migration_prepayment";
    case "bank_contact_question":
      return "bank_contact";
    case "acknowledgement":
    case "trust_or_greeting":
    case "privacy_question":
      return "next_step";
    case "blackmail_threat":
      return "blackmail_threat";
    case "violence_threat":
    case "identity_loan":
      return "general_scam_concern";
    case "withdrawal_blocked":
      return "investment_offer";
    case "unauthorized_charge":
      return "bank_contact";
    case "account_hacked_other":
      return "safety_question";
    case "scammer_recontact":
      return "unknown_contact";
    case "relative_already_paid":
      return "sent_money";
  }
}

function classifySharedVictimInlineIntent(text: string): HumanInlineIntent | null {
  const match = classifyVictimIntent(text);
  if (!match) return null;
  return mapVictimIntentToHumanInlineIntent(match.kind);
}

function classifyNewsHumanInlineIntent(normalized: string): HumanInlineIntent | null {
  if (
    /(?:telegram|телеграм|телеграмм|teiegram|аккаунт|профиль|premium|премиум).{0,180}(?:галочк|официал|поддержк|блок|удал|замороз|провер|вериф|отмена|спасти|подар|голосован|проголос|мамочк|конкурс|войти|вход|парол|код)|(?:галочк|официал|поддержк|блок|удал|замороз|провер|вериф|отмена|premium|премиум|подар|голосован|проголос|мамочк|конкурс).{0,180}(?:telegram|телеграм|телеграмм|аккаунт|профиль)/iu.test(
      normalized,
    ) ||
    /(?:hurmatli|telegram|akkaunt|hisob).{0,180}(?:muzlat|o['’]?chir|blok|tasdiq|havola|parol|kod|premium|sovg['’]?a|ovoz)/iu.test(
      normalized,
    )
  ) {
    return "telegram_takeover";
  }

  if (
    /(?:голосован|голосовать|проголос|опрос|лучш.{0,30}мам|мамочк|vote|voting).{0,120}(?:канал|групп|чат|ссылк|линк|link|url|перейти|зайти|открыть|кнопк)/iu.test(
      normalized,
    ) ||
    /(?:канал|групп|чат|ссылк|линк|link|url|перейти|зайти|открыть|кнопк).{0,120}(?:голосован|голосовать|проголос|опрос|лучш.{0,30}мам|мамочк|vote|voting)/iu.test(
      normalized,
    )
  ) {
    return "voting_link";
  }

  if (
    /(?:apple|ios|iphone|айфон|эппл|apple\s?id).{0,180}(?:вирус|поврежд|72|парол|провер|блок|установ|окно|баннер|разблок)|(?:вирус|поврежд.{0,20}ios|оповещен.{0,20}apple).{0,140}(?:установ|парол|ok|инструкц)/iu.test(
      normalized,
    )
  ) {
    return "apple_security";
  }

  if (
    /(?:apk|\.apk|exe|\.exe|pdf\.apk|pptx|\.pptx|gif|стикер|открытк|голосов(?:ое|ой)|takvim|таквим|повестк|chaqiruvsud|sudga|so['’]?nggi|последн.{0,20}слов|покидаю.{0,40}мир|ухожу.{0,40}мир|вирус|virus).{0,180}(?:откры|скач|установ|пришл|файл|ссылк|документ|yukla|och|o['’]?rnat)?/iu.test(
      normalized,
    ) ||
    /(?:приш[её]л[ао]?|пришли|поступил[ао]?|получил[аи]?|получили).{0,80}(?:файл|документ|архив|file|document).{0,100}(?:apk|\.apk|exe|\.exe|pdf\.apk|pptx|\.pptx|gif|повестк|takvim|таквим|chaqiruvsud|sudga|вирус|virus)/iu.test(
      normalized,
    )
  ) {
    return "malicious_file";
  }

  if (
    /(?:open\s*budget|openbudget|опен\s*бюджет|open\s+budjet|овоз|ovoz).{0,180}(?:код|sms|смс|голос|100\.?000|деньг|куп|sotib|olamiz|pul)|(?:покупа|купить|сотиб|sotib).{0,90}(?:голос|ovoz).{0,90}(?:open|бюджет|budget)/iu.test(
      normalized,
    )
  ) {
    return "open_budget";
  }

  if (
    /(?:водоканал|сувсоз|suvsoz|счетчик|счётчик|умн.{0,20}датчик|газ|электр|свет|коммунал|нулев.{0,20}баланс|utility).{0,180}(?:паспорт|пинфл|код|sms|смс|ссылк|оплат|звон|данн|адрес|долг|установ|провер)?/iu.test(
      normalized,
    )
  ) {
    return "utility_impersonation";
  }

  if (
    /(?:пенсион|пенси[яию]|нафак|nafaqa|1271|выплат|надбавк|повышен.{0,20}пенс|пособи|грант).{0,180}(?:код|sms|смс|паспорт|пинфл|карт|данн|звон|оформ|увелич)/iu.test(
      normalized,
    )
  ) {
    return "pension_benefit";
  }

  if (
    /(?:дмед|dmed|поликлиник|врач|медработ|медик|осмотр|грипп|shifokor).{0,180}(?:код|sms|смс|запис|вход|систем|просит|ayt|kod)/iu.test(
      normalized,
    )
  ) {
    return "medical_code";
  }

  if (
    /(?:незнаком|посторон|человек|кто.?то).{0,120}(?:просит|попросил|хочет|дал).{0,90}(?:телефон|смартфон).{0,90}(?:позвон|минут|звонок)|(?:телефон|смартфон).{0,100}(?:на\s+минут|позвонить).{0,100}(?:просит|незнаком|посторон)/iu.test(
      normalized,
    )
  ) {
    return "phone_borrowing";
  }

  if (
    /(?:деньг|сум|перевод).{0,120}(?:по\s+ошибк|ошибочн|случайн|вернуть|обратно|друг.{0,20}счет|друг.{0,20}счёт)|(?:вернуть|снять|обнал|банкомат|atm).{0,140}(?:деньг|перевод|карт|счет|счёт)|(?:за\s+дозу|терроризм|оружи|назначени.{0,20}платеж)/iu.test(
      normalized,
    )
  ) {
    return "money_mule";
  }

  if (
    /(?:реб[её]н|дет[ией]|школьник|game|(?<![\p{L}])игр(?:а|ы|у|е|ой|овой|ов|ах)?(?![\p{L}])|robux|roblox|робукс|bonus|бонус|валют).{0,180}(?:код|sms|смс|мессенджер|данн|подар|бесплатн|запуг|вымог)/iu.test(
      normalized,
    )
  ) {
    return "child_game_bonus";
  }

  if (
    /(?:молчащ|молчат|тишина|ничего\s+не\s+говор|сказал.{0,20}алло|сказал.{0,20}да|запис(?:ать|али).{0,30}голос|копи.{0,30}голос|voice\s+clone)/iu.test(
      normalized,
    )
  ) {
    return "silent_call";
  }

  if (
    /(?:родствен|близк|мама|папа|бабушк|дедушк|сын|дочь|брат|сестр|внук|внуч|друг|подруга).{0,160}(?:ии|ai|deepfake|дипфейк|видеосвяз|видео|голос).{0,160}(?:деньг|помощ|перевод|сроч)|(?:ии|ai|deepfake|дипфейк|видеосвяз|голос).{0,160}(?:родствен|близк|мама|папа|брат|сестр|внук|внуч|друг).{0,160}(?:деньг|помощ|перевод|сроч)/iu.test(
      normalized,
    ) ||
    /(?:знаком|одноклассник|коллег|друг|подруг).{0,120}(?:сроч|одолж|займи|занять|верну\s+через).{0,100}(?:деньг|сум|руб|доллар|перевод)|(?:сроч|одолж|займи|занять|верну\s+через).{0,120}(?:знаком|одноклассник|коллег|друг|подруг)/iu.test(
      normalized,
    ) ||
    /(?:бабушк|дедушк|мама|папа|родствен|близк|друг|подруг|сосед|сын|дочь|брат|сестр|внук|внуч).{0,180}(?:мошен|сроч|помощ|деньг|перевод|операци|лечение|авар|больниц)|(?:мошен|звонил|позвонил|пишет|просит).{0,180}(?:бабушк|дедушк|мама|папа|родствен|близк|друг|подруг|сын|дочь|брат|сестр|внук|внуч).{0,120}(?:деньг|помощ|перевод|сроч|лечение|авар|больниц)/iu.test(
      normalized,
    )
  ) {
    return "relative_distress";
  }

  if (
    /(?:\+98|\+988|\+996|\+987|\+989|иран|ирана|нигери|кыргыз|киргиз|таджик|туркмен|зарубеж|иностран|друг(?:ой|ая|ую|ого)?\s+стран|chet\s+el|foreign).{0,140}(?:звон|номер|вызов|call|qo['’]?ng)|(?:звон|номер|вызов|call).{0,140}(?:\+98|\+988|\+996|\+987|\+989|иран|ирана|нигери|кыргыз|киргиз|таджик|туркмен|зарубеж|иностран|друг(?:ой|ая|ую|ого)?\s+стран|foreign)/iu.test(
      normalized,
    )
  ) {
    return "foreign_call";
  }

  if (
    /(?:мвд|миб|бпи|mib|bpi|суд|налогов|солик|солиқ|инспектор|госорган|госслужб|орган).{0,180}(?:код|sms|смс|карта|паспорт|пинфл|налич|деньг|штраф|долг|квитанц|документ|звон|пришел|пришёл)/iu.test(
      normalized,
    )
  ) {
    return "official_impersonation";
  }

  return null;
}

const HIGH_PRIORITY_SHARED_INLINE_INTENTS = new Set<HumanInlineIntent>([
  "personal_data_aftercare",
  "official_impersonation",
  "relative_distress",
  "job_offer",
  "investment_offer",
  "blackmail_threat",
]);

function isHighPrioritySharedInlineIntent(
  intent: HumanInlineIntent | null,
): intent is HumanInlineIntent {
  return intent !== null && HIGH_PRIORITY_SHARED_INLINE_INTENTS.has(intent);
}

function hasEarningChannelInlineIntent(normalized: string): boolean {
  return (
    /(?:приглаша|добавля|зовут|позвали|вступить|подписаться).{0,100}(?:канал|групп|чат).{0,100}(?:заработ|доход|прибыл|легк.{0,20}деньг|ставк|крипт|ton|usdt|wallet|инвест)/iu.test(
      normalized,
    ) ||
    /(?:предлага(?:ют|ет)|зов(?:ут|ет)|приглаша(?:ют|ет)|обеща(?:ют|ет)).{0,120}(?:бот|канал|чат|групп|приложени).{0,160}(?:заработ|доход|легк.{0,20}деньг|сум.{0,30}день|500\s*000|500000)/iu.test(
      normalized,
    ) ||
    /(?:канал|групп|чат).{0,100}(?:заработ|доход|прибыл|легк.{0,20}деньг|ставк|крипт|ton|usdt|wallet|инвест)/iu.test(
      normalized,
    ) ||
    /(?:kanal|guruh|chat).{0,100}(?:daromad|daomad|ishlash|pul|foyda|kripto|ton|usdt|wallet|invest|stavka)/iu.test(
      normalized,
    ) ||
    /(?:daromad|daomad|ishlash|pul|foyda|kripto|ton|usdt|wallet|invest|stavka).{0,100}(?:kanal|guruh|chat)/iu.test(
      normalized,
    ) ||
    /(?:channel|group|chat).{0,100}(?:earn|income|profit|easy money|betting|crypto|ton|usdt|wallet|invest)/iu.test(
      normalized,
    ) ||
    /(?:earn|earning|income|profit|easy money|betting|crypto|ton|usdt|wallet|invest).{0,100}(?:channel|group|chat)/iu.test(
      normalized,
    )
  );
}

function hasVotingLinkInlineIntent(normalized: string): boolean {
  return (
    /(?:голосован|голосовать|проголос|опрос|vote|voting).{0,120}(?:канал|групп|чат|ссылк|линк|link|url|перейти|зайти|открыть)/iu.test(
      normalized,
    ) ||
    /(?:канал|групп|чат|ссылк|линк|link|url).{0,120}(?:голосован|голосовать|проголос|опрос|vote|voting)/iu.test(
      normalized,
    ) ||
    /(?:ovoz|so['’]?rovnoma|vote).{0,120}(?:kanal|guruh|chat|havola|link|kir|o['’]?t)/iu.test(
      normalized,
    )
  );
}

function hasContextualLinkRequestIntent(normalized: string): boolean {
  return (
    /(?:просят|просит|сказали|говорят|нужно|надо|предлагают|скинули|прислали|дали).{0,80}(?:перейти|зайти|открыть|нажать|кликнуть|посмотреть)?.{0,40}(?:ссылк|линк|link|url|кнопк|сайт)/iu.test(
      normalized,
    ) ||
    /(?:перейти|зайти|открыть|нажать|кликнуть).{0,40}(?:по\s+)?(?:ссылк|линк|link|url|кнопк|сайт)/iu.test(
      normalized,
    ) ||
    /(?:so['’]?ra|ayt|kerak|yubor|berdi).{0,80}(?:havola|link|tugma|sayt).{0,40}(?:o['’]?t|kir|och|bos|bosing)?/iu.test(
      normalized,
    ) ||
    /(?:havola|link|tugma|sayt).{0,60}(?:o['’]?t|kir|och|bos|bosing|yubordi)/iu.test(normalized) ||
    /(?:ask|asked|asks|sent|gave|told|want|wants|need|needs).{0,80}(?:open|click|follow|go\s+to)?.{0,40}(?:link|url|button|site|website)/iu.test(
      normalized,
    ) ||
    /(?:open|click|follow|go\s+to).{0,40}(?:the\s+)?(?:link|url|button|site|website)/iu.test(
      normalized,
    )
  );
}

function hasExplicitMoneyTransferInlineIntent(normalized: string): boolean {
  return (
    /(?:перевест|перевод|переведи|скин(?:уть|ьте)|отправ(?:ить|ьте)\s+деньг|на\s+(?:чужую\s+)?карту|на\s+(?:безопасн(?:ый|ого)\s+)?сч[её]т)/iu.test(
      normalized,
    ) ||
    /(?:pul\s+yubor|o['’]?tkaz|kartaga|hisobga|xavfsiz\s+hisob)/iu.test(normalized) ||
    /(?:transfer|send\s+money|wire|bank\s+account|safe\s+account)/iu.test(normalized)
  );
}

function hasRelativeDistressInlineIntent(normalized: string): boolean {
  return (
    /(?:мама|папа|сын|дочь|брат|сестра|родствен|близк|внук|внуч|друг).{0,120}(?:авар|больниц|полици|срочн|деньг|перевед|код|помоги|попал|попала)/iu.test(
      normalized,
    ) ||
    /(?:авар|больниц|полици|срочн|деньг|перевед|помоги|попал|попала).{0,120}(?:мама|папа|сын|дочь|брат|сестра|родствен|близк|внук|внуч|друг)/iu.test(
      normalized,
    ) ||
    /(?:ona|ota|o['’]?g['’]?(?:il|l)|qiz|aka|uka|opa|singil|qarindosh|yaqin).{0,120}(?:avariya|kasalxona|politsiya|shoshilinch|zudlik|pul|o['’]?tkaz|yordam|kod)/iu.test(
      normalized,
    ) ||
    /(?:mom|dad|son|daughter|brother|sister|relative|friend|loved one).{0,120}(?:accident|hospital|police|urgent|money|transfer|send|code|help)/iu.test(
      normalized,
    )
  );
}

function hasJobOfferInlineIntent(normalized: string): boolean {
  return (
    /(?:работ|ваканси|трудоустройств).{0,160}(?:просит|просят|требует|требуют|нужно|надо|обязательн).{0,80}(?:оплат|заплат|взнос|обучен|курс|форм|проверк)/iu.test(
      normalized,
    ) ||
    /(?:оплат|заплат|взнос|предоплат).{0,100}(?:обучен|курс|ваканси|работ|трудоустройств)/iu.test(
      normalized,
    ) ||
    /(?:ish|vakansiya).{0,160}(?:so['’]?ra|kerak|majburiy).{0,80}(?:pul|to['’]?lov|o['’]?qish|kurs|forma|tekshir)/iu.test(
      normalized,
    ) ||
    /(?:job|work|vacancy|employment).{0,160}(?:ask|require|must|mandatory).{0,80}(?:pay|fee|training|course|uniform|check)/iu.test(
      normalized,
    )
  );
}

function hasInvestmentOfferInlineIntent(normalized: string): boolean {
  return (
    /(?:инвест|крипт|ton|usdt|wallet|бирж|трейд|доход|прибыл|процент|x2|икс).{0,160}(?:гарант|влож|депозит|пополни|перевед|платформ|сигнал|доход|быстр)/iu.test(
      normalized,
    ) ||
    /(?:invest|kripto|crypto|ton|usdt|wallet|birja|treyd|daromad|foyda).{0,160}(?:kafolat|depozit|pul|platforma|signal|tez|foiz)/iu.test(
      normalized,
    ) ||
    /(?:invest|crypto|ton|usdt|wallet|exchange|trading|profit|return).{0,160}(?:guarantee|guaranteed|deposit|platform|signal|fast|percent|income)/iu.test(
      normalized,
    )
  );
}

function hasReplySafetyInlineIntent(normalized: string): boolean {
  return (
    /(?:можно|стоит|надо|нужно|безопасно ли).{0,100}(?:отвечать|ответить|написать|писать|переписываться|говорить|разговаривать)/iu.test(
      normalized,
    ) ||
    /(?:javob|yoz|gaplash).{0,100}(?:bersam|beraymi|bo['’]?ladimi|mumkinmi|kerakmi)/iu.test(
      normalized,
    ) ||
    /(?:can|should).{0,80}(?:reply|answer|text|message|talk)/iu.test(normalized) ||
    /(?:what|how).{0,60}(?:reply|answer|say|write)/iu.test(normalized)
  );
}

function hasNextStepInlineIntent(normalized: string): boolean {
  return (
    /(?:что|как).{0,60}(?:делать|поступить|быть|дальше)/iu.test(normalized) ||
    /(?:nima|qanday|keyin).{0,60}(?:qilay|qilish|qilishim|bo['’]?ladi|kerak|keyin)/iu.test(
      normalized,
    ) ||
    /(?:what|how).{0,60}(?:do|should i do|next)/iu.test(normalized)
  );
}

function hasBankContactInlineIntent(normalized: string): boolean {
  return (
    /(?:как|куда|где|можно|нужно|надо).{0,80}(?:связаться|позвонить|написать|обратиться).{0,80}(?:банк|банком|поддержк|служб.{0,20}банк)/iu.test(
      normalized,
    ) ||
    /(?:банк|банком|поддержк|служб.{0,20}банк).{0,80}(?:связаться|позвонить|написать|обратиться|номер)/iu.test(
      normalized,
    ) ||
    /(?:bank|support).{0,80}(?:bog['’]?lan|qo['’]?ng['’]?iroq|telefon|aloqa|murojaat)/iu.test(
      normalized,
    ) ||
    /(?:how|where).{0,80}(?:contact|call|message).{0,80}(?:bank|support)/iu.test(normalized)
  );
}

function hasOfficialLegalInlineIntent(normalized: string): boolean {
  return (
    /(?:рувд|(?<!\p{L})овд(?!\p{L})|мвд|полици|прокуратур|следовател).{0,220}(?:подозрев|обвиня|уголовн.{0,30}дел|розыск|требует.{0,50}документ)/iu.test(
      normalized,
    ) ||
    /(?:iib|ichki\s+ishlar|politsiya|prokuratura|tergovchi).{0,220}(?:jinoyat\s+ishi|gumon|aybl|qidiruv|hujjat.{0,50}talab)/iu.test(
      normalized,
    ) ||
    /(?:police|prosecutor|investigator|detective).{0,220}(?:suspect|accused|criminal\s+case|wanted|warrant|demands?.{0,50}documents?)/iu.test(
      normalized,
    )
  );
}

/**
 * Recognise concrete scam families before generic link, transfer, phone and
 * Telegram heuristics.  The user commonly adds a second/third line or a URL;
 * those generic tails must not erase the scenario stated on the first line.
 */
function classifySpecificHumanInlineIntent(normalized: string): HumanInlineIntent | null {
  if (
    /(?:госуслуг|гос.{0,20}служб|one\s?id|oneid).{0,140}(?:код|смс|sms|продикт|подтверд)|(?:davlat|davat|dalat).{0,30}xizmat.{0,140}(?:kod|sms|ayt|tasdiq)|(?:government|goernment|public).{0,30}services?.{0,140}(?:code|sms|dictate|confirm)/iu.test(
      normalized,
    )
  ) {
    return "gov_service";
  }

  if (
    /(?:мама|папа|сын|дочь|брат|сестр|родствен|близк).{0,150}(?:авар|больниц|полици|сроч|деньг|перевод)|(?:(?<!\p{L})(?:ona|ota|qiz|aka|uka|opa)(?!\p{L})|o['’]?g['’]?(?:il|l)|singil|qarindosh|yaqin).{0,150}(?:avariya|kasalxona|politsiya|zudlik|pul|o['’]?tkaz)|(?:mom|dad|son|daughter|brother|sister|relative|family).{0,150}(?:accident|hospital|police|urgent|money|transfer)/iu.test(
      normalized,
    )
  ) {
    return "relative_distress";
  }

  if (
    /(?:банк|bank).{0,180}(?:(?:номер|sms|смс|сообщени|chat|xabar|raqam|message).{0,120}(?:звон|позвон|call|qo['’]?ng['’]?iroq)|(?:звон|позвон|call|qo['’]?ng['’]?iroq).{0,120}(?:номер|sms|смс|сообщени|chat|xabar|raqam|message))|(?:call|звон|позвон|qo['’]?ng['’]?iroq).{0,120}(?:банк|bank).{0,160}(?:номер|sms|смс|сообщени|xabar|raqam|message)/iu.test(
      normalized,
    )
  ) {
    return "bank_contact";
  }

  if (
    /(?:покупател|по?упател|xaridor|buyer|buer).{0,180}(?:курьер|kuryer|courier|delivery).{0,180}(?:ссылк|havola|link).{0,180}(?:карт|karta|card)|(?:покупател|по?упател|xaridor|buyer|buer).{0,180}(?:ссылк|havola|link).{0,180}(?:карт|karta|card)/iu.test(
      normalized,
    )
  ) {
    return "delivery_payment";
  }

  if (hasVotingLinkInlineIntent(normalized)) {
    return "voting_link";
  }

  if (
    /(?:sim|esim).{0,100}(?:замен|перевыпуск|перенос|код|almashtir|ko['’]?chir|kod|replace|swap|transfer|code)|(?:замен|перевыпуск|перенос|код|almashtir|ko['’]?chir|kod|replace|swap|transfer|code).{0,100}(?:sim|esim)/iu.test(
      normalized,
    )
  ) {
    return "sim_swap";
  }

  if (
    /(?:anydesk|andesk|teamviewer|rustdesk|удал[её]нн.{0,24}доступ).{0,140}(?:установ|экран|доступ|o['’]?rnat|ekran|kirish|install|screen|access|share)/iu.test(
      normalized,
    )
  ) {
    return "app_request";
  }

  if (
    !/(?:выигр|приз|подар|грант|лотере|наследств|yutuq|sovg['’]?a|lotereya|prize|gift|lottery|inheritance)/iu.test(
      normalized,
    ) &&
    /(?:налог|сбор|soliq|tax).{0,140}(?:оплат|заплат|ссылк|havola|to['’]?la|pay|link)|(?:оплат|заплат|to['’]?la|pay).{0,100}(?:налог|soliq|tax)/iu.test(
      normalized,
    )
  ) {
    return "tax_payment";
  }

  if (
    /(?:полици|уголовн.{0,24}дел).{0,180}(?:угрож|треб|деньг)|(?:polits|poits|jinoiy\s+ish).{0,180}(?:qo['’]?rqit|talab|pul)|(?:police|criminal\s+case).{0,180}(?:threat|demand|money)/iu.test(
      normalized,
    )
  ) {
    return "official_impersonation";
  }

  if (
    /(?:шантаж|шатаж|фото|снимк).{0,140}(?:треб|плат|деньг)|(?:shantaj|surat).{0,140}(?:talab|to['’]?la|pul)|(?:blackmail|photo).{0,140}(?:demand|pay|payment|money)/iu.test(
      normalized,
    )
  ) {
    return "blackmail_threat";
  }

  if (
    /(?:безопасн.{0,24}сч[её]т|xavfsiz.{0,24}hisob|safe.{0,12}account)/iu.test(normalized) &&
    /(?:перев|деньг|сч[её]т|pul|o['’]?tkaz|hisob|transfer|money|account)/iu.test(normalized)
  ) {
    return "safe_account_transfer";
  }

  if (
    /(?:кредит|займ|kr(?:e)?dit|qarz|loan).{0,140}(?:комисс|сбор|предоплат|заранее|страхов|оплат|komiss|oldindan|sug['’]?urta|to['’]?lov|advance|upfront|commission|fee|insurance|pay)/iu.test(
      normalized,
    ) ||
    /(?:комисс|сбор|предоплат|заранее|komiss|oldindan|advance|upfront|commission|fee).{0,100}(?:кредит|займ|kr(?:e)?dit|qarz|loan)/iu.test(
      normalized,
    )
  ) {
    return "loan_advance_fee";
  }

  if (
    /(?:фонд|благотвор|пожертв|сбор.{0,30}(?:помощ|лечен|реб[её]н)|jamg['’]?arma|xayriya|ehson|charity|donation|fund).{0,180}(?:сроч|дав|тороп|треб|личн.{0,24}карт|перев|деньг|bosim|shaxsiy.{0,24}karta|o['’]?tkaz|pul|pressure|personal.{0,24}card|transfer|money)/iu.test(
      normalized,
    )
  ) {
    return "charity_pressure";
  }

  if (
    /(?:поддерж|служб.{0,24}помощ).{0,180}(?:отключ|убрат|защит|2fa|доступ|код)|(?:yordam.{0,24}xizmat|qo['’]?llab).{0,180}(?:o['’]?chir|himoya|2fa|kirish|kod)|(?:support|help.{0,16}(?:desk|team|service)).{0,180}(?:disable|turn\s+off|remove|protection|security|2fa|access|code)/iu.test(
      normalized,
    )
  ) {
    return "support_impersonation";
  }

  if (
    /(?:qr).{0,120}(?:скан|вход|войти|telegram|телеграм|s(?:k|c)aner|kirish|sign\s*in|log\s*in)|(?:скан|s(?:k|c)aner).{0,80}(?:qr)/iu.test(
      normalized,
    )
  ) {
    return "qr_login";
  }

  if (
    /(?:доставк|посылк|курьер|почт).{0,120}(?:оплат|пошлин|тамож|комисс|сбор|карта|ссылк)|(?:оплат|пошлин|тамож|комисс|сбор).{0,100}(?:доставк|посылк|курьер|почт)|(?:yetkazib|posilka|kuryer).{0,120}(?:to['’]?lov|boj|komiss|karta|havola)|(?:delivery|parcel|cou?rier|couier|shipping).{0,120}(?:customs|duty|fee|pay|payment|card|link)|(?:customs|duty|fee|payment).{0,100}(?:delivery|parcel|cou?rier|couier|shipping)/iu.test(
      normalized,
    )
  ) {
    return "delivery_payment";
  }

  if (
    /(?:нов.{0,24}знаком|отношен|роман|жених|невест|парень|девушк).{0,160}(?:деньг|перев|билет|виз|лечен)|(?:yangi.{0,24}tanish|munosabat|sevgi).{0,160}(?:pul|o['’]?tkaz|chipta|viza|davol)|(?:new.{0,30}(?:romantic\s+)?contact|dating|relationship|romance|online\s+(?:boyfriend|girlfriend|partner)|boyfriend|girlfriend|fianc(?:e|é)e?|romantic\s+partner).{0,160}(?:money|transfer|ticket|visa|treatment|pay)/iu.test(
      normalized,
    )
  ) {
    return "romance_money";
  }

  if (hasJobOfferInlineIntent(normalized)) return "job_offer";
  if (hasEarningChannelInlineIntent(normalized)) return "earning_channel";
  if (hasInvestmentOfferInlineIntent(normalized)) return "investment_offer";

  if (
    !hasCodeRequestIntent(normalized) &&
    !hasAppRequestIntent(normalized) &&
    !hasSentCodeIntent(normalized) &&
    /(?:приглаша|добавля|зов[её]т|вступить|подписаться).{0,120}(?:telegram.{0,24})?(?:канал|групп|чат)|(?:канал|групп|чат).{0,120}(?:приглаша|добавля|зов[её]т|вступить|подписаться)|(?:taklif|qo['’]?shil|kirish|chaqir).{0,120}(?:telegram.{0,24})?(?:kanal|guruh|chat)|(?:kanal|guruh|chat).{0,120}(?:taklif|qo['’]?shil|kirish|chaqir)|(?:invites?|invited|asks?).{0,160}(?:join|subscribe)?.{0,80}(?:telegram.{0,24})?(?:channel|group|chat)|(?:channel|group|chat).{0,120}(?:invite|join|subscribe)/iu.test(
      normalized,
    )
  ) {
    return "chat_invite";
  }

  if (
    !hasCodeRequestIntent(normalized) &&
    !hasAppRequestIntent(normalized) &&
    !hasSentCodeIntent(normalized) &&
    /(?:незнаком|неизвестн|чужой).{0,140}(?:просит|требует|инструкц|сделать|выполнить)|(?:notanish|noma['’]?lum|begona).{0,140}(?:so['’]?ra|talab|ko['’]?rsatma|bajar)|(?:stranger|unknown\s+(?:person|contact)|random\s+person).{0,140}(?:asks?|requests?|instructions?|follow|do)/iu.test(
      normalized,
    )
  ) {
    return "unknown_contact";
  }

  if (
    /(?:лж.?сотрудник|фальшив.{0,30}(?:банк|сотрудник)|поддельн.{0,30}(?:банк|сотрудник)|сотрудник.{0,30}банк).{0,160}(?:подтверд|операц|код|сроч)|(?:soxta|sota|qalbaki).{0,40}(?:bank|xodim).{0,160}(?:tasdiq|operatsiya|kod|zudlik)|(?:fake|phony|bogus).{0,40}(?:bank|employee|agent).{0,160}(?:confirm|transaction|operation|code|urgent)/iu.test(
      normalized,
    )
  ) {
    return "bank_impersonation";
  }

  return null;
}

function classifyHumanInlineIntent(text: string): HumanInlineIntent | null {
  const normalizedBase = normalizeIntentTextForMatching(text);
  const normalized = uzbekLatinMatchingVariant(normalizedBase) ?? normalizedBase;
  const hasConcreteUrl =
    /https?:\/\/|www\.|t\.me\/|telegram\.me\/|\b[a-z0-9-]+\.[a-z]{2,}\b/iu.test(normalized);
  const hasPriorityDanger = hasPriorityInlineDangerIntent(normalized);
  const sharedVictimIntent = classifySharedVictimInlineIntent(text);

  if (
    /(?:как|можно|надо|нужно|что).{0,80}(?:вернуть|оспорить|заморозить).{0,80}(?:деньг|перевод|плат[её]ж).{0,100}(?:мошен|обман|скам)|(?:деньг|перевод|плат[её]ж).{0,80}(?:вернуть|оспорить|заморозить).{0,100}(?:мошен|обман|скам)/iu.test(
      normalized,
    )
  ) {
    return "sent_money";
  }

  if (hasOfficialLegalInlineIntent(normalized)) {
    return "official_impersonation";
  }

  if (hasRecoveryPhraseRequestIntent(normalized)) {
    return "recovery_phrase_request";
  }

  // Completed incidents must stay above ordinary Telegram, bank and code
  // topics. This also applies to the gated Uzbek-Cyrillic transliteration.
  if (hasSentCodeIntent(normalized) && !hasInstalledAppAccessIntent(normalized)) {
    return "sent_code";
  }

  // A request to move money to a "safe account" is more urgent and specific
  // than the surrounding instruction to call or contact a bank. Preserve that
  // transfer warning before the broad bank-contact helper below.
  if (classifySpecificHumanInlineIntent(normalized) === "safe_account_transfer") {
    return "safe_account_transfer";
  }

  // Preserve the concrete bank-contact task even when a later line mentions an
  // SMS or phone number. Otherwise generic code/phone classifiers can swallow
  // the follow-up and the user never sees the warning about chat-provided numbers.
  if (hasBankContactInlineIntent(normalized)) {
    return "bank_contact";
  }

  if (
    /^\s*(?:привет|здравствуйте|добрый\s+день|спасибо|спс|рахмат|rahmat|salom|assalomu\s+alaykum|hello|hi|а\s+вы\s+кто|кто\s+вы|вы\s+кто)\s*[!.?]*\s*$/iu.test(
      normalized,
    )
  ) {
    return "next_step";
  }

  if (
    sharedVictimIntent === "official_impersonation" &&
    !hasPriorityDanger &&
    /(?:рувд|(?<!\p{L})овд(?!\p{L})|мвд|полици|прокуратур|следовател|iib|ichki\s+ishlar|politsiya|prokuratura|tergovchi|police|prosecutor|investigator|detective)/iu.test(
      normalized,
    )
  ) {
    return sharedVictimIntent;
  }

  if (
    /(?:я|мы|мама|папа|бабушк|дедушк|уже|только\s+что).{0,80}(?:перев[её]л|перевела|отправил|отправила|оплатил|оплатила|заплатил|заплатила|скинул|скинула|кинул|кинула).{0,80}(?:деньг|сум|перевод|на\s+карту|на\s+сч[её]т|плат[её]ж|оплат)|(?:money|transfer|payment).{0,80}(?:already|sent|paid)|(?:pul|sum|to['’]?lov).{0,80}(?:yubord|o['’]?tkazd|to['’]?lad)/iu.test(
      normalized,
    )
  ) {
    return "sent_money";
  }

  if (
    /(?:я|мы|уже|только\s+что).{0,70}(?:дал(?!\p{L})|дала(?!\p{L})|отправил|отправила|назвал|назвала|вв[её]л|ввела|скинул|скинула).{0,90}(?:номер\s+карты|карт[уы]|cvv|cvc|пин|pin|реквизит)|(?:i|we)\s+(?:already\s+)?(?:gave|sent|entered).{0,80}(?:card|cvv|cvc|pin)/iu.test(
      normalized,
    )
  ) {
    return "card_request";
  }

  if (
    /(?:я|мы|уже|только\s+что).{0,70}(?:переш[её]л|перешла|заш[её]л|зашла|открыл|открыла|нажал|нажала|кликнул|кликнула).{0,90}(?:ссылк|линк|url|сайт|кнопк)|(?:already|opened|clicked|followed).{0,80}(?:link|url|site|button)/iu.test(
      normalized,
    )
  ) {
    return "link_request";
  }

  const safeOfficialDocumentHandoff =
    /(?:официальн\p{L}*|official|rasmiy).{0,100}(?:государственн\p{L}*\s+портал|визов\p{L}*\s+центр|приложен\p{L}*\s+банк\p{L}*|government\s+portal|visa\s+application\s+cent(?:er|re)|bank(?:ing)?\s+app|davlat\s+portali|viza\s+markazi|bank\s+ilovasi)/iu.test(
      normalized,
    ) &&
    /(?:я|i|men).{0,90}(?:отправил[аи]?|передал[аи]?|загрузил[аи]?|sent|submitted|uploaded|yubordim|yukladim|topshirdim).{0,120}(?:паспорт|passport|pasport)|(?:я|i|men).{0,90}(?:паспорт|passport|pasport).{0,120}(?:отправил[аи]?|передал[аи]?|загрузил[аи]?|sent|submitted|uploaded|yubordim|yukladim|topshirdim)/iu.test(
      normalized,
    ) &&
    !/(?:незнаком|чуж|мошен|stranger|unknown\s+(?:person|contact)|scammer|notanish|begona|firibgar)/iu.test(
      normalized,
    );

  if (sharedVictimIntent === "personal_data_aftercare" && !safeOfficialDocumentHandoff) {
    return sharedVictimIntent;
  }

  if (
    !safeOfficialDocumentHandoff &&
    /(?:паспорт|пинфл|инн).{0,120}(?:уже|от.?рав|послал|передал)|(?:уже|от.?рав|послал|передал).{0,120}(?:паспорт|пинфл|инн)|(?:pasport|pinfl|stir).{0,120}(?:yubord|berdim)|(?:yubord|berdim).{0,120}(?:pasport|pinfl|stir)|(?:passport|tax\s+id).{0,120}(?:already|sent|shared|gave)|(?:already|sent|shared|gave).{0,120}(?:passport|tax\s+id)/iu.test(
      normalized,
    )
  ) {
    return "personal_data_aftercare";
  }

  if (
    /(?:паспорт|пинфл|инн|pasport|pinfl|stir|passport|tax\s+id).{0,120}(?:фото|присл|отправ|rasm|yubor|send|photo|upload)|(?:фото|присл|отправ|rasm|yubor|send|photo|upload).{0,120}(?:паспорт|пинфл|инн|pasport|pinfl|stir|passport|tax\s+id)/iu.test(
      normalized,
    )
  ) {
    return "personal_data";
  }

  if (sharedVictimIntent === "blackmail_threat") {
    return sharedVictimIntent;
  }

  if (sharedVictimIntent === "phone_borrowing") {
    return sharedVictimIntent;
  }

  const specificIntent = classifySpecificHumanInlineIntent(normalized);
  if (specificIntent) {
    return specificIntent;
  }

  if (hasCardRequestIntent(normalized)) {
    return "card_request";
  }

  const newsIntent = classifyNewsHumanInlineIntent(normalized);
  if (newsIntent) {
    return newsIntent;
  }

  if (hasVotingLinkInlineIntent(normalized)) {
    return "voting_link";
  }

  if (
    !hasPriorityDanger &&
    (/(?:пишет|написал|написала|шл[её]т|прислал|прислала|отправил|отправила|кинул|скинул).{0,120}(?:ссылк|линк|url|сайт|кнопк)|(?:sent|sends|message).{0,100}(?:link|url|site|button)/iu.test(
      normalized,
    ) ||
      /(?:спрашивает|спросил|спросила|просит|попросил|попросила).{0,100}(?:ссылк|линк|url|сайт|кнопк)/iu.test(
        normalized,
      ) ||
      /(?:havola|link|url).{0,80}(?:so['’]?ra|so['’]?rayap|yubor)/iu.test(normalized) ||
      /(?:ask|asks|asked|request|requests|requested).{0,80}(?:link|url|site|button)/iu.test(
        normalized,
      ))
  ) {
    return "link_request";
  }

  if (
    /(?:как|можно|надо|нужно|что).{0,80}(?:вернуть|оспорить|заморозить).{0,80}(?:деньг|перевод|плат[её]ж).{0,100}(?:мошен|обман|скам)|(?:деньг|перевод|плат[её]ж).{0,80}(?:вернуть|оспорить|заморозить).{0,100}(?:мошен|обман|скам)/iu.test(
      normalized,
    )
  ) {
    return "sent_money";
  }

  if (
    /(?:мне|нам|маме|папе|бабушк|дедушк)?.{0,50}(?:звон|позвон).{0,90}(?:тороп|угрож|давят|пугают|не\s+клад|срочно|кричат)|(?:someone|they|unknown|stranger).{0,80}(?:call|calling|called).{0,80}(?:me|us)?|(?:call|calling|called).{0,80}(?:me|us).{0,80}(?:unknown|stranger)?/iu.test(
      normalized,
    )
  ) {
    return "unknown_call";
  }

  if (
    /(?:пишет|написал|написала|шл[её]т|прислал|прислала|отправил|отправила).{0,120}(?:файл|документ|apk|\.apk|pdf|pptx|gif|голосовое|открытк)|(?:sent|sends|message).{0,100}(?:file|apk|pdf|pptx|gif|voice)/iu.test(
      normalized,
    )
  ) {
    return "malicious_file";
  }

  if (
    /(?:пишет|написал|написала|связал|связалась|зов[её]т|предлагает).{0,110}(?:криптоинвестор|инвестор|трейдер|крипт|бирж|ton|usdt|wallet)|(?:криптоинвестор|инвестор|трейдер|крипт|бирж|ton|usdt|wallet).{0,110}(?:пишет|написал|связал|предлагает|заработ)/iu.test(
      normalized,
    )
  ) {
    return "investment_offer";
  }

  if (
    /(?:плохое|дурное|странное).{0,50}предчувств|(?:чувствую|кажется|похоже).{0,90}(?:не\s+то|опасн|подозрительн|обман|мошен|скам)/iu.test(
      normalized,
    )
  ) {
    return "general_scam_concern";
  }

  if (
    /(?:какой|куда|номер|телефон).{0,70}(?:полици|мвд|102|киберполици|cyber\s+police)/iu.test(
      normalized,
    )
  ) {
    return "general_scam_concern";
  }

  if (
    /(?:как|где|можно|надо|нужно).{0,60}провер(?:ить|ю|ять).{0,60}(?:номер|телефон|ссылк|аккаунт|профиль)/iu.test(
      normalized,
    )
  ) {
    return "safety_question";
  }

  if (
    /(?:звон|позвон|пишет|написал|написала|представ).{0,90}(?:майор|полици|мвд|следствен|прокурат|орган|налогов|судеб|суд|миб|бпи|mib|bpi|инспектор)|(?:майор|полици|мвд|следствен|прокурат|орган|налогов|судеб|суд|миб|бпи|mib|bpi|инспектор).{0,90}(?:звон|позвон|пишет|написал|представ|фейк|подмен)/iu.test(
      normalized,
    )
  ) {
    return "official_impersonation";
  }

  if (
    /(?:one\s?id|oneid|my\.gov\.uz|id\.gov\.uz|my\.soliq\.uz|soliq\.uz|soliq|солик|солиқ|gov\.uz|egov|e-gov|налогов|госуслуг|госорган|государственн|электронн.{0,20}правительств|(?:^|[^a-zа-яё])(?:пинфл|стир|инн)(?:$|[^a-zа-яё])).{0,100}(?:код|sms|смс|парол|логин|вход|ссылк|подтверд|заблок|тиклаш|tasdiq|parol|login|kirish)?/iu.test(
      normalized,
    ) ||
    /(?:davlat xizmat|one\s?id|oneid|my\.gov\.uz|id\.gov\.uz|my\.soliq\.uz|soliq\.uz|soliq|gov\.uz|pinfl|stir).{0,100}(?:kod|sms|parol|login|kirish|tasdiq|blok|tiklash)?/iu.test(
      normalized,
    ) ||
    /(?:one\s?id|oneid|my\.gov\.uz|id\.gov\.uz|my\.soliq\.uz|soliq\.uz|soliq|gov\.uz|government|tax service).{0,100}(?:code|sms|password|login|sign in|confirm|blocked|restore)?/iu.test(
      normalized,
    )
  ) {
    return "gov_service";
  }

  if (
    /(?:sim|сим|esim|номер).{0,80}(?:перевыпуск|перевыпуст|замен|дубликат|перенести|восстанов|swap|активир)/iu.test(
      normalized,
    ) ||
    /(?:перевыпуск|перевыпуст|замен|дубликат|перенести|восстанов|активир).{0,80}(?:sim|сим|esim|номер)/iu.test(
      normalized,
    ) ||
    /(?:sim|esim|raqam).{0,80}(?:almashtir|tikla|ko['’]?chir|dublikat|aktiv)/iu.test(normalized) ||
    /(?:sim|esim|number).{0,80}(?:swap|replace|restore|transfer|duplicate|activate)/iu.test(
      normalized,
    ) ||
    /(?:swap|replace|restore|transfer|duplicate|activate).{0,80}(?:sim|esim|number)/iu.test(
      normalized,
    )
  ) {
    return "sim_swap";
  }

  if (hasInstalledAppAccessIntent(normalized)) {
    return "app_request";
  }

  if (hasSentCodeIntent(normalized)) {
    return "sent_code";
  }

  if (
    /(?:оператор|билайн|beeline|ucell|юселл|mobiuz|мобиуз|uzmobile|uztelecom|узмобайл|узтелеком).{0,140}(?:код|sms|смс|договор|истека|продл|блокир|номер|sim|esim)|(?:код|sms|смс|договор|истека|продл|блокир|номер|sim|esim).{0,140}(?:оператор|билайн|beeline|ucell|юселл|mobiuz|мобиуз|uzmobile|uztelecom|узмобайл|узтелеком)/iu.test(
      normalized,
    )
  ) {
    return "operator_call";
  }

  if (hasCodeRequestIntent(normalized)) {
    return "code_request";
  }

  if (hasCardRequestIntent(normalized)) {
    return "card_request";
  }

  if (hasAppRequestIntent(normalized)) {
    return "app_request";
  }

  if (hasPersonalDataRequestIntent(normalized)) {
    return "personal_data";
  }

  if (hasRelativeDistressInlineIntent(normalized)) {
    return "relative_distress";
  }

  const isTaxOrFeeLinkContext =
    hasContextualLinkRequestIntent(normalized) &&
    /(?:налог|пошлин|комисс|сбор|tax|fee|duty|soliq|boj|komiss)/iu.test(normalized);
  if (hasExplicitMoneyTransferInlineIntent(normalized) && !isTaxOrFeeLinkContext) {
    return "transfer_request";
  }

  if (
    !hasConcreteUrl &&
    (/(?:кинул|кинули|сбросил|сбросили|скинул|скинули|отправил|отправили|прислал|прислали|дал|дали).{0,80}(?:ссылк|линк|link|url|сайт)/iu.test(
      normalized,
    ) ||
      /(?:ссылк|линк|link|url|сайт).{0,80}(?:кинул|кинули|сбросил|сбросили|скинул|скинули|отправил|отправили|прислал|прислали|дал|дали)/iu.test(
        normalized,
      ))
  ) {
    return "link_request";
  }

  if (hasBankContactInlineIntent(normalized)) {
    return "bank_contact";
  }

  // A later line that describes a concrete scheme or completed incident must
  // override an earlier generic question such as "is this safe?" or "what do
  // I do?".  The full, original text is deliberately passed to the shared
  // victim classifier so line breaks remain part of the evidence shown back
  // to the user even though regex matching itself is whitespace-tolerant.
  if (hasEarningChannelInlineIntent(normalized)) {
    return "earning_channel";
  }

  if (isHighPrioritySharedInlineIntent(sharedVictimIntent)) {
    return sharedVictimIntent;
  }

  if (hasVotingLinkInlineIntent(normalized)) {
    return "voting_link";
  }

  if (hasContextualLinkRequestIntent(normalized)) {
    return "link_request";
  }

  if (hasJobOfferInlineIntent(normalized)) {
    return "job_offer";
  }

  if (hasInvestmentOfferInlineIntent(normalized)) {
    return "investment_offer";
  }

  if (hasReplySafetyInlineIntent(normalized)) {
    return "reply_safety";
  }

  if (hasNextStepInlineIntent(normalized)) {
    return "next_step";
  }

  if (
    /(?:это|оно|сообщение|ссылка|номер|аккаунт|профиль|канал|чат).{0,100}(?:безопасно|опасно|мошенник|мошенники|скам|обман|развод|фишинг)/iu.test(
      normalized,
    ) ||
    /(?:безопасно|опасно).{0,100}(?:это|сообщение|ссылка|номер|аккаунт|профиль|канал|чат)/iu.test(
      normalized,
    ) ||
    /(?:можно|стоит|надо|нужно).{0,80}(?:доверять|верить|проверить|открывать|переходить|вводить)/iu.test(
      normalized,
    ) ||
    /(?:xavfsiz|xavfli|firib|ishonsa|tekshir).{0,100}(?:mi|xabar|havola|raqam|akkaunt|kanal|chat)?/iu.test(
      normalized,
    ) ||
    /(?:is it|is this|safe|dangerous|scam|fraud).{0,100}(?:message|link|number|account|channel|chat)?/iu.test(
      normalized,
    )
  ) {
    return "safety_question";
  }

  if (
    /(?:меня|нас|маму|папу|его|её|ее).{0,80}(?:пытаются|хотят|могут).{0,60}(?:обмануть|развести|кинуть|взломать)/iu.test(
      normalized,
    ) ||
    /(?:кажется|похоже|думаю|боюсь|подозреваю).{0,80}(?:обман|мошен|скам|развод|фишинг)/iu.test(
      normalized,
    ) ||
    /(?:пишет|написал|писал|звонит|звонил|звонила|обратился).{0,80}(?:мошен|скам|обман|развод|фишинг)/iu.test(
      normalized,
    ) ||
    /(?:мошен|скам|обман|развод|фишинг).{0,80}(?:пишет|написал|писал|звонит|звонил|звонила|обратился)/iu.test(
      normalized,
    ) ||
    /(?:aldamoqchi|firibgar|firib|scam|shubha).{0,100}(?:men|meni|biz|o['’]?xshaydi|bo['’]?lishi mumkin)?/iu.test(
      normalized,
    ) ||
    /(?:scam|fraud|phishing|cheat).{0,100}(?:me|us|looks|seems|suspect|maybe)?/iu.test(normalized)
  ) {
    return "general_scam_concern";
  }

  if (
    /(?:что|как).{0,50}(?:делать|поступить|быть|дальше)/iu.test(normalized) ||
    /(?:помогите|помоги).{0,80}(?:что делать|разобраться|проверить|мошен|скам|обман)?/iu.test(
      normalized,
    ) ||
    /(?:nima|qanday).{0,50}(?:qilay|qilish|bo'ladi|keyin)/iu.test(normalized) ||
    /(?:yordam|yordam bering).{0,80}(?:tekshir|firib|scam)?/iu.test(normalized) ||
    /(?:what|how).{0,50}(?:do|should i do|next)/iu.test(normalized) ||
    /(?:help me|please help).{0,80}(?:check|scam|fraud)?/iu.test(normalized)
  ) {
    return "next_step";
  }

  if (
    /(?:пишет|написал|звонит|аккаунт|профиль|одноклассник|друг|знаком|родствен|близк).{0,140}(?:не уверен|не уверена|сомневаюсь|это он|это она|его ли|её ли|ее ли|взлом|подмен|фейк|не похож)/iu.test(
      normalized,
    ) ||
    /(?:не уверен|не уверена|сомневаюсь|это он|это она|его ли|её ли|ее ли|взлом|подмен|фейк|не похож).{0,140}(?:пишет|написал|звонит|аккаунт|профиль|одноклассник|друг|знаком|родствен|близк)/iu.test(
      normalized,
    ) ||
    /(?:tanish|do['’]?st|sinfdosh|qarindosh|akkaunt|profil).{0,140}(?:ishonmayap|aniq emas|o['’]?zi emas|buzilgan|soxta)/iu.test(
      normalized,
    ) ||
    /(?:friend|classmate|relative|known person|account|profile).{0,140}(?:not sure|unsure|is it him|is it her|hacked|fake|impersonat)/iu.test(
      normalized,
    )
  ) {
    return "identity_uncertain";
  }

  if (
    /(?:мне|меня|со мной|я).{0,80}(?:пишет|написал|связал|добавил).{0,80}(?:незнаком|какой.?то человек|неизвестн|чужой|левый аккаунт)/iu.test(
      normalized,
    ) ||
    /(?:незнаком|какой.?то человек|неизвестн|чужой|левый аккаунт).{0,100}(?:пишет|написал|связал|добавил)/iu.test(
      normalized,
    ) ||
    /(?:notanish|noma['’]?lum|begona).{0,100}(?:yoz|aloqa|qo['’]?sh)/iu.test(normalized) ||
    /(?:unknown|stranger|random person|someone).{0,100}(?:writes|texted|messaged|contacted|added)/iu.test(
      normalized,
    )
  ) {
    return "unknown_contact";
  }

  if (hasEarningChannelInlineIntent(normalized)) {
    return "earning_channel";
  }

  if (hasVotingLinkInlineIntent(normalized)) {
    return "voting_link";
  }

  if (
    /(?:приглаша|добавля|зовут|позвали|вступить|подписаться|перейти).{0,120}(?:канал|групп|чат)/iu.test(
      normalized,
    ) ||
    /(?:канал|групп|чат).{0,120}(?:приглаша|добавля|зовут|вступить|подписаться|перейти)/iu.test(
      normalized,
    ) ||
    /(?:kanal|guruh|chat).{0,120}(?:taklif|qo'sh|kir|obuna)/iu.test(normalized) ||
    /(?:invited|added|join|subscribe|go to).{0,120}(?:channel|group|chat)/iu.test(normalized)
  ) {
    return "chat_invite";
  }

  if (hasContextualLinkRequestIntent(normalized)) {
    return "link_request";
  }

  if (
    /(?:просят|просит|сказали|говорят|нужно|надо).{0,80}(?:подтверд|одобр|разреш|разрешить|согласиться|нажать да)/iu.test(
      normalized,
    ) ||
    /(?:подтверд|одобр|разреш).{0,80}(?:операц|перевод|вход|telegram|банк|карт)/iu.test(
      normalized,
    ) ||
    /(?:tasdiq|ruxsat|rozilik).{0,80}(?:kirish|o['’]?tkaz|operatsiya|telegram|bank|karta)/iu.test(
      normalized,
    ) ||
    /(?:confirm|approve|allow).{0,80}(?:login|transfer|payment|operation|telegram|bank|card)/iu.test(
      normalized,
    )
  ) {
    return "confirm_request";
  }

  if (hasCardRequestIntent(normalized)) {
    return "card_request";
  }

  if (hasAppRequestIntent(normalized)) {
    return "app_request";
  }

  if (
    /(?:звон|позвон|говорят|представил|связал).{0,80}(?:оператор|билайн|beeline|ucell|юселл|mobiuz|мобиуз|uzmobile|uztelecom|узмобайл|узтелеком)/iu.test(
      normalized,
    ) ||
    /(?:оператор|билайн|beeline|ucell|юселл|mobiuz|мобиуз|uzmobile|uztelecom|узмобайл|узтелеком).{0,80}(?:звон|позвон|говорят|связал)/iu.test(
      normalized,
    ) ||
    /(?:operator|beeline|ucell|mobiuz|uzmobile|uztelecom).{0,80}(?:called|calling|call|phone)/iu.test(
      normalized,
    )
  ) {
    return "operator_call";
  }

  if (
    /(?:звон|позвон|говорят|представил).{0,80}(?:банк|служб.{0,20}безопас|оператор|центробанк|цб|полици)/iu.test(
      normalized,
    ) ||
    /(?:bank|operator|markaziy bank|politsiya).{0,80}(?:qo['’]?ng['’]?iroq|telefon|aytyapti)/iu.test(
      normalized,
    ) ||
    /(?:calling|called|call).{0,80}(?:bank|security|operator|police|central bank)/iu.test(
      normalized,
    )
  ) {
    return "bank_call";
  }

  if (hasPersonalDataRequestIntent(normalized)) {
    return "personal_data";
  }

  if (
    /(?:доставк|посылк|курьер|почт).{0,80}(?:оплат|пошлин|комисс|сбор|карта|ссылк)/iu.test(
      normalized,
    ) ||
    /(?:оплат|пошлин|комисс|сбор).{0,80}(?:доставк|посылк|курьер|почт)/iu.test(normalized) ||
    /(?:yetkazib|posilka|kuryer).{0,80}(?:to['’]?lov|boj|komiss|karta|havola)/iu.test(normalized) ||
    /(?:delivery|parcel|courier|shipping).{0,80}(?:fee|pay|payment|card|link)/iu.test(normalized)
  ) {
    return "delivery_payment";
  }

  if (
    /(?:выигр|приз|подар|грант|лотере|наследств).{0,80}(?:налог|комисс|сбор|оплат|залог|предоплат)/iu.test(
      normalized,
    ) ||
    /(?:налог|комисс|сбор|оплат|залог|предоплат).{0,80}(?:выигр|приз|подар|грант|лотере|наследств)/iu.test(
      normalized,
    ) ||
    /(?:yutuq|sovg['’]?a|grant|lotereya).{0,80}(?:soliq|komiss|to['’]?lov|garov)/iu.test(
      normalized,
    ) ||
    /(?:prize|gift|grant|lottery|inheritance).{0,80}(?:tax|fee|commission|deposit|prepay)/iu.test(
      normalized,
    )
  ) {
    return "prize_fee";
  }

  if (
    /(?:мама|папа|сын|дочь|брат|сестра|родствен|близк|внук|внуч|друг).{0,120}(?:авар|больниц|полици|сроч|деньг|перевед|код|помоги|попал|попала)/iu.test(
      normalized,
    ) ||
    /(?:авар|больниц|полици|сроч|деньг|перевед|помоги|попал|попала).{0,120}(?:мама|папа|сын|дочь|брат|сестра|родствен|близк|внук|внуч|друг)/iu.test(
      normalized,
    ) ||
    /(?:ona|ota|o['’]?g['’]?il|qiz|aka|uka|opa|singil|qarindosh|yaqin).{0,120}(?:avariya|kasalxona|politsiya|shoshilinch|pul|yordam|kod)/iu.test(
      normalized,
    ) ||
    /(?:mom|dad|son|daughter|brother|sister|relative|friend|loved one).{0,120}(?:accident|hospital|police|urgent|money|transfer|code|help)/iu.test(
      normalized,
    )
  ) {
    return "relative_distress";
  }

  if (
    /(?:люблю|скучаю|дорог|родн|знаком|отношен|невест|жених|девушк|парен).{0,140}(?:деньг|перевед|помоги|билет|виза|лечение|инвест|крипт|депозит)/iu.test(
      normalized,
    ) ||
    /(?:деньг|перевед|помоги|билет|виза|лечение|инвест|крипт|депозит).{0,140}(?:люблю|скучаю|дорог|родн|знаком|отношен|невест|жених|девушк|парен)/iu.test(
      normalized,
    ) ||
    /(?:sevgi|sog['’]?indim|aziz|tanish|munosabat).{0,140}(?:pul|yordam|chipta|viza|davolanish|invest|kripto)/iu.test(
      normalized,
    ) ||
    /(?:love|miss|dear|dating|relationship).{0,140}(?:money|transfer|ticket|visa|treatment|invest|crypto|deposit)/iu.test(
      normalized,
    )
  ) {
    return "romance_money";
  }

  if (
    /(?:инвест|крипт|ton|usdt|wallet|бирж|трейд|доход|прибыл|процент|x2|икс).{0,140}(?:гарант|влож|депозит|пополни|перевед|платформ|сигнал|доход|быстр)/iu.test(
      normalized,
    ) ||
    /(?:гарант|влож|депозит|пополни|перевед|платформ|сигнал|доход|быстр).{0,140}(?:инвест|крипт|ton|usdt|wallet|бирж|трейд|прибыл|процент)/iu.test(
      normalized,
    ) ||
    /(?:invest|kripto|crypto|ton|usdt|wallet|birja|treyd|daromad|foyda).{0,140}(?:kafolat|depozit|pul|platforma|signal|tez|foiz)/iu.test(
      normalized,
    ) ||
    /(?:invest|crypto|ton|usdt|wallet|exchange|trading|profit|return).{0,140}(?:guarantee|deposit|platform|signal|fast|percent)/iu.test(
      normalized,
    )
  ) {
    return "investment_offer";
  }

  if (
    !hasPriorityDanger &&
    (/(?:можно|стоит|надо|нужно|безопасно ли).{0,80}(?:отвечать|ответить|написать|писать|переписываться|говорить|разговаривать)/iu.test(
      normalized,
    ) ||
      /(?:что|как).{0,50}(?:ответить|сказать|написать)/iu.test(normalized) ||
      /(?:мне|сюда|вам|боту)?.{0,30}(?:ничего|что).{0,30}(?:не\s+)?(?:присылать|отправлять|вставлять|писать)/iu.test(
        normalized,
      ) ||
      /(?:javob|yoz|gaplash).{0,100}(?:bersam|beraymi|bo'ladimi|mumkinmi|kerakmi)/iu.test(
        normalized,
      ) ||
      /(?:bu\s+yerga|sizga)?.{0,30}(?:hech\s+narsa|nima).{0,30}(?:yubormaymi|yuboray|yozay|kiritay)/iu.test(
        normalized,
      ) ||
      /(?:can|should).{0,60}(?:reply|answer|text|message|talk)/iu.test(normalized) ||
      /(?:what|how).{0,50}(?:reply|answer|say|write)/iu.test(normalized) ||
      /(?:should\s+i\s+send\s+nothing|what\s+should\s+i\s+send\s+here)/iu.test(normalized))
  ) {
    return "reply_safety";
  }

  if (sharedVictimIntent) {
    return sharedVictimIntent;
  }

  if (hasTransferRequestIntent(normalized)) {
    return "transfer_request";
  }

  return null;
}

function formatPassportMessage(passport: RiskPassportSummary, lang: Lang): string {
  const copy = COPY[lang];
  const lines = [
    passport.title,
    copy.checkedBy,
    passport.eyebrow,
    "",
    `${copy.displayLabel}: ${safeInlineDisplay(passport.display, passport.kind)}`,
  ];

  for (const section of passport.sections) {
    lines.push("", section.title, ...section.lines.map((line) => `• ${line}`));
  }

  lines.push("", "@scamguard_bot");
  return lines.join("\n");
}

function passportArticle(result: RunCheckResult, lang: Lang): InlineQueryResultArticle | null {
  const passport = buildRiskPassportSummary(result, lang);
  if (!passport) return null;
  const preview = passportPreview(passport, result, lang);

  return buildArticle(
    `passport-${passport.kind}`,
    preview.title,
    compactInlineDescription(preview.description),
    formatPassportMessage(passport, lang),
    lang,
  );
}

function passportPreview(
  passport: RiskPassportSummary,
  result: RunCheckResult,
  lang: Lang,
): { title: string; description: string } {
  const copy = PREVIEW_COPY[lang];

  if (passport.kind === "telegram") {
    return {
      title: copy.telegramTitle,
      description: copy.telegramDescription,
    };
  }

  if (result.phoneReputation || result.knownReports > 0) {
    return {
      title: copy.phoneReportsTitle,
      description: copy.phoneReportsDescription,
    };
  }

  if (result.phoneIntelligence && !result.phoneIntelligence.isValidFormat) {
    return {
      title: copy.phoneWeakTitle,
      description: copy.phoneWeakDescription,
    };
  }

  return {
    title: copy.phoneNoReportsTitle,
    description: copy.phoneNoReportsDescription,
  };
}

function classifyHumanInlineIntentForResult(
  result: RunCheckResult,
  originalQuery: string,
): HumanInlineIntent | null {
  const originalIntent = classifyHumanInlineIntent(originalQuery);
  if (
    originalIntent &&
    !((result.type === "url" || result.type === "apk") && originalIntent === "link_request")
  ) {
    return originalIntent;
  }

  const reasons = collectResultReasonCodesForPresentation(result);
  if (reasons.includes("requests_personal_data")) return "personal_data";

  const intent = classifyHumanInlineIntent(result.display);
  if ((result.type === "url" || result.type === "apk") && intent === "link_request") {
    return null;
  }
  return intent;
}

function resultArticle(
  result: RunCheckResult,
  lang: Lang,
  originalQuery: string,
): InlineQueryResultArticle {
  const passport = passportArticle(result, lang);
  if (passport) return passport;

  const copy = COPY[lang];
  const level = copy.levels[result.level];
  const preview = PREVIEW_COPY[lang];
  const humanIntent = classifyHumanInlineIntentForResult(result, originalQuery);
  if (result.level === "unknown") {
    if (humanIntent) {
      const intentCopy = followUpAwareHumanInlineCopy(originalQuery, lang, humanIntent);
      return buildArticle(
        `check-${result.level}-${humanIntent.replaceAll("_", "-")}`,
        intentCopy.title,
        intentCopy.description,
        formatHumanInlineMessage(result, lang, intentCopy),
        lang,
      );
    }

    return buildArticle(
      `check-${result.level}`,
      preview.unknownTitle,
      preview.unknownDescription,
      formatInlineMessage(result, lang),
      lang,
    );
  }

  if (result.level === "suspicious" && humanIntent) {
    const intentCopy = followUpAwareHumanInlineCopy(originalQuery, lang, humanIntent);
    return buildArticle(
      `check-${result.level}-${humanIntent.replaceAll("_", "-")}`,
      intentCopy.title,
      formatHumanInlinePreviewDescription(result, lang, intentCopy),
      formatHumanInlineMessage(result, lang, intentCopy),
      lang,
    );
  }

  if (result.level === "high_risk" && humanIntent) {
    const intentCopy = followUpAwareHumanInlineCopy(originalQuery, lang, humanIntent);
    return buildArticle(
      `check-${result.level}-${humanIntent.replaceAll("_", "-")}`,
      `${level.title} — ${intentCopy.title}`,
      formatHumanInlinePreviewDescription(result, lang, intentCopy),
      formatHumanInlineMessage(result, lang, intentCopy),
      lang,
    );
  }

  return buildArticle(
    `check-${result.level}`,
    level.title,
    formatInlinePreviewDescription(result, lang),
    formatInlineMessage(result, lang),
    lang,
  );
}

function shouldUsePreflightInlineIntent(
  text: string,
  intent: HumanInlineIntent | null,
): intent is HumanInlineIntent {
  if (!intent || !PREFLIGHT_HUMAN_INLINE_INTENTS.has(intent) || hasConcreteArtifact(text)) {
    return false;
  }
  if (intent === "link_request") {
    if (hasPriorityInlineDangerIntent(normalizeIntentTextForMatching(text))) {
      return false;
    }
  }
  if (intent === "sim_swap") return false;
  return true;
}

function humanIntentArticle(
  display: string,
  lang: Lang,
  intent: HumanInlineIntent,
): InlineQueryResultArticle {
  const intentCopy = followUpAwareHumanInlineCopy(display, lang, intent);
  const result = {
    type: "text",
    display: safeInlineDisplay(display, "text"),
    level: "unknown",
    score: 0,
    reasons: ["unknown_sender"],
    explanation: null,
    knownReports: 0,
    verifiedContact: null,
    brandEvidence: [],
  } as RunCheckResult;

  return buildArticle(
    `check-unknown-${intent.replaceAll("_", "-")}`,
    intentCopy.title,
    intentCopy.description,
    formatHumanInlineMessage(result, lang, intentCopy),
    lang,
  );
}

function metaIntentArticle(intent: MetaIntent, lang: Lang): InlineQueryResultArticle {
  const copy = COPY[lang];
  const response = getMetaIntentResponse(intent, lang);
  return buildArticle(
    `meta-${intent.replaceAll("_", "-")}`,
    copy.helpTitle,
    response,
    `${copy.helpTitle}\n\n${response}\n\n@scamguard_bot`,
    lang,
  );
}

function classifyInlineSmallTalk(text: string): InlineSmallTalkIntent | null {
  const normalized = normalizeIntentTextForMatching(text)
    .replace(/[.!?,;:]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (
    /^(?:спасибо|спс|благодарю|спасибо\s+большое|большое\s+спасибо|огромное\s+спасибо|понял(?:а)?\s+спасибо|ясно\s+спасибо|rahmat|raxmat|rahmat\s+sizga|katta\s+rahmat|juda\s+katta\s+rahmat|tushundim\s+rahmat|thanks|thank\s+you|thx|thanks\s+a\s+lot|thank\s+you\s+so\s+much|many\s+thanks|got\s+it\s+thanks|спасибо\s+за\s+помощь\s+ещё\s+один\s+вопрос\s+(?:ясно\s+спасибо|спс)|yordamingiz\s+uchun\s+rahmat\s+yana\s+bir\s+savol\s+(?:tushundim\s+rahmat|raxmat)|thanks\s+for\s+your\s+help\s+one\s+more\s+question\s+(?:got\s+it\s+thanks|thx))$/iu.test(
      normalized,
    )
  ) {
    return "thanks";
  }
  if (
    /^(?:(?:а\s+)?(?:вы|ты)\s+кто(?:\s+вообще)?|кто\s+(?:вы|ты)(?:\s+такой)?|а\s+ты\s+кто\s+вообще|что\s+это\s+за\s+бот|что\s+(?:ты|вы)\s+за\s+бот|siz\s+kimsiz|sen\s+kimsan(?:\s+o['’]?zi)?|siz\s+kims|bu\s+qanday\s+bot|who\s+are\s+you|who\s+r\s+u|what\s+are\s+you(?:\s+exactly)?|what\s+is\s+this\s+bot|what\s+bot\s+is\s+this|спасибо\s+за\s+помощь\s+ещё\s+один\s+вопрос\s+(?:а\s+ты\s+кто\s+вообще|кто\s+ты\s+такой)|yordamingiz\s+uchun\s+rahmat\s+yana\s+bir\s+savol\s+(?:bu\s+qanday\s+bot|siz\s+kims)|thanks\s+for\s+your\s+help\s+one\s+more\s+question\s+(?:what\s+is\s+this\s+bot|who\s+r\s+u))$/iu.test(
      normalized,
    )
  ) {
    return "identity";
  }
  return null;
}

function smallTalkArticle(intent: InlineSmallTalkIntent, lang: Lang): InlineQueryResultArticle {
  const copy = INLINE_SMALL_TALK_COPY[lang][intent];
  return buildArticle(
    `small-talk-${intent}`,
    copy.title,
    copy.description,
    `${copy.title}\n\n${copy.description}\n\n@scamguard_bot`,
    lang,
  );
}

function isAmbiguousShortNumericQuery(text: string): boolean {
  const compact = text.replace(/[\s()-]/gu, "");
  return /^\d{6,8}$/u.test(compact);
}

function ambiguousNumericArticle(lang: Lang): InlineQueryResultArticle {
  const copy = AMBIGUOUS_NUMERIC_COPY[lang];
  return buildArticle(
    "ambiguous-numeric",
    copy.title,
    copy.description,
    `${copy.title}\n\n${copy.message}\n\n@scamguard_bot`,
    lang,
  );
}

function sensitiveSecretArticle(
  classes: readonly SensitiveSecretClass[],
  lang: Lang,
  sanitizedContext: string,
): InlineQueryResultArticle {
  const guidance = buildSensitiveSecretGuidance(classes, lang);
  const safeContext = maskForDisplay(sanitizedContext, "text")
    .replace(/(?<!\d)\d{4,12}(?!\d)/gu, "••••")
    .trim();
  const contextLabel =
    lang === "uz" ? "Xavfsizlangan matn" : lang === "en" ? "Sanitized text" : "Текст без секрета";
  const message = [
    guidance.title,
    safeContext ? `${contextLabel}: ${safeContext}` : "",
    guidance.description,
    "@scamguard_bot",
  ]
    .filter(Boolean)
    .join("\n\n");
  const id = classes.some((value) => value === "recovery_phrase" || value === "private_key")
    ? "private-recovery-secret"
    : classes.includes("password")
      ? "private-password"
      : "private-code";
  return buildArticle(id, guidance.title, guidance.description, message, lang);
}

function helpArticle(lang: Lang): InlineQueryResultArticle {
  const copy = COPY[lang];
  return buildArticle("help", copy.helpTitle, copy.helpDescription, copy.helpMessage, lang);
}

function staticArticle(
  id: string,
  lang: Lang,
  title: string,
  description: string,
): InlineQueryResultArticle {
  return buildArticle(id, title, description, `${title}\n\n${description}\n\n@scamguard_bot`, lang);
}

function rateLimitDescription(lang: Lang, retryAfter: number): string {
  const seconds = Math.max(1, Math.ceil(retryAfter));
  if (lang === "uz") return `Biroz kuting: ${seconds} soniyadan keyin qayta urinib ko'ring.`;
  if (lang === "en") return `Wait a bit and try again in ${seconds} sec.`;
  return `Подождите немного: попробуйте снова через ${seconds} сек.`;
}

function withoutInlineParseMode(result: InlineQueryResultArticle): InlineQueryResultArticle {
  const { parse_mode: _parseMode, ...inputMessageContent } = result.input_message_content;
  return {
    ...result,
    input_message_content: {
      ...inputMessageContent,
      message_text: INLINE_PLAIN_TEXT.get(result) ?? inputMessageContent.message_text,
    },
  };
}

function isEntityParseFailure(
  errorCode: number | undefined,
  description: string | undefined,
): boolean {
  return errorCode === 400 && /parse|entit(?:y|ies)/iu.test(description ?? "");
}

function isImmediateRetryableInlineAnswerFailure(errorCode: number | undefined): boolean {
  return errorCode === undefined || errorCode >= 500;
}

function isDeferredInlineAnswerFailure(errorCode: number | undefined): boolean {
  return errorCode === 429;
}

function throwInlineAnswerDeliveryError(response: {
  errorCode?: number;
  retryAfterSec?: number;
}): never {
  console.error("telegram inline answer transient", response.errorCode ?? "network");
  throw new TelegramInlineAnswerDeliveryError(
    isDeferredInlineAnswerFailure(response.errorCode)
      ? inlineDeliveryRetryMsFromSeconds(response.retryAfterSec)
      : undefined,
  );
}

function scopeInlineArticle(
  article: InlineQueryResultArticle,
  query: string,
  lang: Lang,
): InlineQueryResultArticle {
  const semanticId = article.id.replace(/[^A-Za-z0-9_-]/gu, "-").slice(0, 47) || "result";
  const plainMessage = INLINE_PLAIN_TEXT.get(article) ?? article.input_message_content.message_text;
  const fingerprint = createHash("sha256")
    .update("inline-result-v1\0")
    .update(semanticId)
    .update("\0")
    .update(lang)
    .update("\0")
    .update(query.normalize("NFKC").trim())
    .update("\0")
    .update(article.title)
    .update("\0")
    .update(article.description ?? "")
    .update("\0")
    .update(plainMessage)
    .digest("base64url")
    .slice(0, 16);

  // Mutate the newly built article instead of cloning it: the WeakMap entry
  // containing the plaintext Markdown fallback must remain attached to this
  // exact object for answerOne's parse-error retry.
  article.id = `${semanticId}-${fingerprint}`;
  return article;
}

async function answerOne(
  inlineQueryId: string,
  result: InlineQueryResultArticle,
  cacheTime = SUCCESS_INLINE_CACHE_SECONDS,
): Promise<void> {
  const options = {
    inlineQueryId,
    results: [result],
    cacheTime,
    isPersonal: true,
  };
  const response = await answerInlineQuery(options);
  if (response.ok) return;

  if (isEntityParseFailure(response.errorCode, response.description)) {
    const retry = await answerInlineQuery({
      ...options,
      results: [withoutInlineParseMode(result)],
    });
    if (retry.ok) return;
    if (
      isDeferredInlineAnswerFailure(retry.errorCode) ||
      isImmediateRetryableInlineAnswerFailure(retry.errorCode)
    ) {
      throwInlineAnswerDeliveryError(retry);
    }
    console.error("telegram inline answer failed", retry.errorCode ?? "unknown");
    return;
  }

  // Telegram explicitly asked us to wait. Retrying the same request now would
  // only extend the flood control window; let the durable polling lifecycle
  // replay it after the bounded delay instead.
  if (isDeferredInlineAnswerFailure(response.errorCode)) {
    throwInlineAnswerDeliveryError(response);
  }

  if (isImmediateRetryableInlineAnswerFailure(response.errorCode)) {
    const retry = await answerInlineQuery(options);
    if (retry.ok) return;
    if (
      isDeferredInlineAnswerFailure(retry.errorCode) ||
      isImmediateRetryableInlineAnswerFailure(retry.errorCode)
    ) {
      throwInlineAnswerDeliveryError(retry);
    }
    console.error("telegram inline answer failed", retry.errorCode ?? "unknown");
    return;
  }

  console.error("telegram inline answer failed", response.errorCode ?? "unknown");
}

export async function handleInlineQuery(
  query: string,
  ctx: InlineQueryCtx,
  inlineQueryId: string,
): Promise<void> {
  const trimmed = query.trim();
  const lang = resolveInlineQueryLanguage(trimmed, ctx.session.lang);
  const copy = COPY[lang];
  const answer = async (
    article: InlineQueryResultArticle,
    cacheTime = SUCCESS_INLINE_CACHE_SECONDS,
  ): Promise<void> => {
    await answerOne(inlineQueryId, scopeInlineArticle(article, trimmed, lang), cacheTime);
  };

  if (trimmed.length === 0) {
    await answer(helpArticle(lang));
    return;
  }

  if (unicodeCodePointLength(trimmed) > MAX_INLINE_QUERY_LENGTH) {
    await answer(staticArticle("too-long", lang, copy.tooLongTitle, copy.tooLongDescription));
    return;
  }

  const sensitive = detectTelegramSensitiveSecret(trimmed);
  if (sensitive) {
    await answer(sensitiveSecretArticle(sensitive.classes, lang, sensitive.value));
    return;
  }

  if (isAmbiguousShortNumericQuery(trimmed)) {
    await answer(ambiguousNumericArticle(lang));
    return;
  }

  const smallTalkIntent = classifyInlineSmallTalk(trimmed);
  if (smallTalkIntent) {
    await answer(smallTalkArticle(smallTalkIntent, lang));
    return;
  }

  const earlyMetaIntent = classifyMetaIntent(trimmed);
  const isSingleLineCapabilityQuestion =
    !/[\r\n]/u.test(trimmed) &&
    earlyMetaIntent !== null &&
    [
      "can_check_link",
      "can_check_phone",
      "can_check_image",
      "can_check_account",
      "can_check_message",
      "can_check_qr",
    ].includes(earlyMetaIntent) &&
    !hasPriorityInlineDangerIntent(normalizeIntentTextForMatching(trimmed));
  if (isSingleLineCapabilityQuestion) {
    await answer(metaIntentArticle(earlyMetaIntent, lang));
    return;
  }

  const preflightIntent = classifyHumanInlineIntent(trimmed);
  const hasMultipleMeaningfulLines =
    trimmed
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean).length >= 2;
  if (hasMultipleMeaningfulLines && shouldUsePreflightInlineIntent(trimmed, preflightIntent)) {
    await answer(humanIntentArticle(trimmed, lang, preflightIntent));
    return;
  }

  const isConcretePreflightIntent =
    preflightIntent !== null &&
    !["next_step", "reply_safety", "safety_question", "general_scam_concern"].includes(
      preflightIntent,
    );
  if (isConcretePreflightIntent && shouldUsePreflightInlineIntent(trimmed, preflightIntent)) {
    await answer(humanIntentArticle(trimmed, lang, preflightIntent));
    return;
  }

  // A concrete first line plus a question on the next line is still a safety
  // request about that concrete situation.  Route it before broad methodology
  // questions such as "why" or "how do I check" so the added line produces a
  // visibly updated answer instead of a generic bot-help card.
  const metaIntent = earlyMetaIntent;
  if (metaIntent) {
    await answer(metaIntentArticle(metaIntent, lang));
    return;
  }

  if (shouldUsePreflightInlineIntent(trimmed, preflightIntent)) {
    await answer(humanIntentArticle(trimmed, lang, preflightIntent));
    return;
  }

  let result: RunCheckResult;
  try {
    result = await runCheck({
      input: trimmed,
      lang,
      rateLimitKey: `tg:inline:${ctx.userId}`,
      channel: "telegram",
      skipAi: true,
      skipUrlReputation: true,
      persist: false,
      rateLimitProfile: "telegram_inline_preview",
    });
  } catch (error) {
    const fallbackIntent = classifyHumanInlineIntent(trimmed);
    if (isRateLimitedError(error) && shouldUsePreflightInlineIntent(trimmed, fallbackIntent)) {
      await answer(humanIntentArticle(trimmed, lang, fallbackIntent));
      return;
    }

    const article = isRateLimitedError(error)
      ? staticArticle(
          "rate-limited",
          lang,
          copy.rateLimitTitle,
          rateLimitDescription(lang, error.retryAfter),
        )
      : staticArticle("error", lang, copy.errorTitle, copy.errorDescription);
    await answer(article, 0);
    return;
  }

  await answer(resultArticle(result, lang, trimmed));
}
