import { createHash } from "node:crypto";

import type { Lang } from "@/lib/i18n";
import { classifyMetaIntent, getMetaIntentResponse, type MetaIntent } from "@/lib/meta-intent";
import { maskForDisplay } from "@/lib/risk/detect";
import { buildRiskPassportSummary, type RiskPassportSummary } from "@/lib/risk/risk-passport";
import { runCheck, type RateLimitedError, type RunCheckResult } from "@/lib/risk/check-core";
import type { RiskLevel } from "@/lib/risk/rules";
import { filterAdvice } from "@/lib/telegram/advice-filter";
import {
  answerInlineQuery,
  escapeMarkdownV2,
  type InlineQueryResultArticle,
} from "@/lib/telegram/api.server";
import { hasConcreteArtifact } from "@/lib/telegram/concrete-artifact";
import {
  inlineDeliveryRetryMsFromSeconds,
  TelegramInlineAnswerDeliveryError,
} from "@/lib/telegram/inline-answer-delivery-error";
import type { InlineQueryCtx } from "@/lib/telegram/router";
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
  | "general_scam_concern"
  | "voting_link"
  | "next_step"
  | "reply_safety"
  | "safety_question"
  | "chat_invite";

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
  "general_scam_concern",
  "voting_link",
  "next_step",
  "reply_safety",
  "safety_question",
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
          "SMS, push, OTP, PIN и пароли не диктуем. Если это не весь текст просьбы — добавьте его или скрин.",
      },
      sent_code: {
        title: "Код уже отправлен: действуйте срочно",
        description:
          "Сейчас не спорим с мошенником. Заблокируйте карту/доступ через банк и смените пароль с другого устройства.",
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
          "Платить за вакансию или обязательное обучение до договора опасно. Добавьте условия и ссылку — без оплаты и документов.",
        message:
          "Не оплачивайте обучение, форму, проверку или доступ к вакансии до договора и независимой проверки работодателя. Добавьте сюда условия, название компании и ссылку на вакансию — без оплаты и документов.",
      },
      investment_offer: {
        title: "Инвестиции/крипта: осторожно",
        description: "Гарантированный доход и TON/USDT — частый крючок. Не переводите депозит.",
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
          "Не переходите по ссылке и не входите в Telegram заново. Если ссылки или текста ещё нет — добавьте их.",
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
      chat_invite: {
        title: "Канал/чат: сначала проверим",
        description:
          "Не переходите по сомнительной ссылке и не входите в Telegram заново. Пришлите приглашение или ссылку целиком.",
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
          "SMS, push, OTP, PIN va parollarni aytmang. Agar bu to'liq matn bo'lmasa, xabar yoki skrinni qo'shing.",
      },
      sent_code: {
        title: "Kod yuborilgan: tez harakat qiling",
        description:
          "Hozircha javob bermang. Bank orqali kartani/kirishni bloklang va boshqa qurilmadan parolni almashtiring.",
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
        title: "Yetkazib berish: havolani tekshiring",
        description: "Chatdagi boj/to'lovni to'lamang. SMS yoki havolani to'liq yuboring.",
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
          "Shartnomasiz ish yoki majburiy o'qish uchun to'lash xavfli. Shartlar va havolani, to'lovsiz qo'shing.",
        message:
          "Shartnoma va ish beruvchini mustaqil tekshirmasdan o'qish, forma, tekshiruv yoki vakansiyaga kirish uchun to'lamang. Bu yerga shartlar, kompaniya nomi va havolani — pul va hujjatlarsiz qo'shing.",
      },
      investment_offer: {
        title: "Invest/kripto: ehtiyot bo'ling",
        description: "Kafolatlangan TON/USDT daromadi - keng tarqalgan tuzoq. Depozit yubormang.",
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
          "Havolaga o'tmang va Telegramga qayta kirmang. Havola yoki matn hali bo'lmasa, uni qo'shing.",
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
      chat_invite: {
        title: "Kanal/chat: avval tekshiramiz",
        description:
          "Shubhali havolaga o'tmang va Telegramga qayta kirmang. Taklif yoki havolani to'liq yuboring.",
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
          "Do not read out SMS, push, OTP, PIN or passwords. If this is not the full request, add the text or screenshot.",
      },
      sent_code: {
        title: "Code already sent: act now",
        description:
          "Do not argue with the scammer. Block card/access through the bank and change the password from another device.",
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
          "Paying for a job or mandatory training before a contract is risky. Add the terms and link — without paying or sending ID.",
        message:
          "Do not pay for training, uniform, verification or access to a vacancy before a contract and independent employer check. Add the terms, company name and vacancy link here — without payment or documents.",
      },
      investment_offer: {
        title: "Invest/crypto: be careful",
        description: "Guaranteed TON/USDT returns are common bait. Do not send a deposit.",
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
          "Do not open the link or sign in to Telegram again. If the link or text is missing, add it.",
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
      chat_invite: {
        title: "Channel/chat: check it first",
        description:
          "Do not open a suspicious link or sign in to Telegram again. Send the invitation or link.",
      },
    },
    unknownTitle: "More context needed",
    unknownDescription:
      "Paste the full message: what they ask you to do, link, number, code, card or transfer.",
  },
};

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
  const title =
    result.level === "unknown" ? intentCopy.title : `${level.title}\n${intentCopy.title}`;
  const lines = [
    title,
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
    /(?:я|уже|только что|сейчас)?.{0,40}(?:передал|передала|отправил|отправила|сообщил|сообщила|назвал|назвала|продиктовал|продиктовала|ввел|ввёл|ввела|скинул|скинула|дал|дала).{0,80}(?:код|sms|смс|otp|push|пуш|pin|пин|парол)/iu.test(
      normalized,
    ) ||
    /(?:код|sms|смс|otp|push|пуш|pin|пин|парол).{0,80}(?:передал|передала|отправил|отправила|сообщил|сообщила|назвал|назвала|продиктовал|продиктовала|ввел|ввёл|ввела|скинул|скинула|дал|дала)/iu.test(
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
      return "bank_call";
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
    /(?:реб[её]н|дет[ией]|школьник|game|игр|robux|roblox|робукс|bonus|бонус|валют).{0,180}(?:код|sms|смс|мессенджер|данн|подар|бесплатн|запуг|вымог)/iu.test(
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
    /(?:kanal|guruh|chat).{0,100}(?:daromad|ishlash|pul|foyda|kripto|ton|usdt|wallet|invest|stavka)/iu.test(
      normalized,
    ) ||
    /(?:daromad|ishlash|pul|foyda|kripto|ton|usdt|wallet|invest|stavka).{0,100}(?:kanal|guruh|chat)/iu.test(
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
    /(?:работ|ваканси|трудоустройств).{0,160}(?:просят|требуют|нужно|надо|обязательн).{0,80}(?:оплат|заплат|взнос|обучен|курс|форм|проверк)/iu.test(
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

function classifyHumanInlineIntent(text: string): HumanInlineIntent | null {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
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

  const newsIntent = classifyNewsHumanInlineIntent(normalized);
  if (newsIntent) {
    return newsIntent;
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
    /(?:я|мы|уже|только\s+что).{0,70}(?:дал|дала|отправил|отправила|назвал|назвала|вв[её]л|ввела|скинул|скинула).{0,90}(?:номер\s+карты|карт[уы]|cvv|cvc|пин|pin|реквизит)|(?:already|gave|sent|entered).{0,80}(?:card|cvv|cvc|pin)/iu.test(
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

  if (sharedVictimIntent === "personal_data_aftercare") {
    return sharedVictimIntent;
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

  if (
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
  ) {
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

function classifyHumanInlineIntentForResult(result: RunCheckResult): HumanInlineIntent | null {
  const reasons = collectResultReasonCodesForPresentation(result);
  if (reasons.includes("requests_personal_data")) return "personal_data";
  const intent = classifyHumanInlineIntent(result.display);
  if ((result.type === "url" || result.type === "apk") && intent === "link_request") {
    return null;
  }
  return intent;
}

function resultArticle(result: RunCheckResult, lang: Lang): InlineQueryResultArticle {
  const passport = passportArticle(result, lang);
  if (passport) return passport;

  const copy = COPY[lang];
  const level = copy.levels[result.level];
  const preview = PREVIEW_COPY[lang];
  const humanIntent = classifyHumanInlineIntentForResult(result);
  if (result.level === "unknown") {
    if (humanIntent) {
      const intentCopy = preview.humanIntents[humanIntent];
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
    const intentCopy = preview.humanIntents[humanIntent];
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
    if (hasPriorityInlineDangerIntent(text.toLowerCase().replace(/\s+/g, " ").trim())) {
      return false;
    }
  }
  return true;
}

function humanIntentArticle(
  display: string,
  lang: Lang,
  intent: HumanInlineIntent,
): InlineQueryResultArticle {
  const intentCopy = PREVIEW_COPY[lang].humanIntents[intent];
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
  const normalized = text
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
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
  const lang = ctx.session.lang;
  const copy = COPY[lang];
  const trimmed = query.trim();
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

  if (isAmbiguousShortNumericQuery(trimmed)) {
    await answer(ambiguousNumericArticle(lang));
    return;
  }

  const smallTalkIntent = classifyInlineSmallTalk(trimmed);
  if (smallTalkIntent) {
    await answer(smallTalkArticle(smallTalkIntent, lang));
    return;
  }

  const metaIntent = classifyMetaIntent(trimmed);
  if (metaIntent) {
    await answer(metaIntentArticle(metaIntent, lang));
    return;
  }

  const preflightIntent = classifyHumanInlineIntent(trimmed);
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

  await answer(resultArticle(result, lang));
}
