import type { Lang } from "@/lib/i18n";
import { buildRiskPassportSummary, type RiskPassportSummary } from "@/lib/risk/risk-passport";
import { runCheck, type RateLimitedError, type RunCheckResult } from "@/lib/risk/check-core";
import type { RiskLevel, ReasonCode } from "@/lib/risk/rules";
import {
  answerInlineQuery,
  escapeMarkdownV2,
  type InlineQueryResultArticle,
} from "@/lib/telegram/api.server";
import type { InlineQueryCtx } from "@/lib/telegram/router";
import { classifyVictimIntent, type VictimIntentKind } from "@/lib/telegram/victim-intent";

const MAX_INLINE_QUERY_LENGTH = 2000;
const MAX_INLINE_DESCRIPTION_LENGTH = 120;
const BOT_URL = "https://t.me/scamguard_bot";

type HumanInlineIntent =
  | "link_request"
  | "code_request"
  | "sent_code"
  | "confirm_request"
  | "card_request"
  | "transfer_request"
  | "app_request"
  | "bank_call"
  | "personal_data"
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
  reasonHints: Partial<Record<ReasonCode, string>>;
};

const COPY: Record<Lang, Copy> = {
  ru: {
    helpTitle: "Проверить через Ishonch Guard",
    helpDescription: "Введите номер, ссылку, username или текст сообщения",
    helpMessage:
      "Проверю номер, ссылку, Telegram username или текст сообщения.\n\nПример: @scamguard_bot +998901234567\n\nЯ не прошу SMS-коды, PIN, CVV или пароли.",
    tooLongTitle: "Слишком длинный текст",
    tooLongDescription: "Сократите сообщение до 2000 символов",
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
        step: "Не отправляйте SMS-код, карту, деньги и не устанавливайте приложение.",
      },
    },
    reasonFallback: {
      safe: "Опасных сигналов в видимом тексте нет.",
      unknown: "Одного значения мало для уверенного вывода.",
      suspicious: "Есть признаки давления, неизвестного источника или подозрительной ссылки.",
      high_risk: "Есть признаки кражи кода, карты, денег или доступа.",
    },
    reasonHints: {
      asks_for_sms_code: "Просят SMS-код подтверждения",
      asks_for_otp: "Просят одноразовый код",
      asks_for_card_cvv: "Просят CVV/CVC карты",
      asks_for_pin: "Просят PIN или пароль",
      asks_to_install_apk: "Просят установить приложение/APK",
      apk_download_link: "Есть ссылка на APK",
      asks_to_transfer_to_safe_account: "Просят перевод на «безопасный счёт»",
      asks_to_scan_qr: "Просят сканировать QR",
      suspicious_invite_link: "Подозрительная invite-ссылка Telegram",
      gambling_prediction_promo: "Промо ставок/казино/прогнозов",
      giveaway_engagement_bait: "Розыгрыш/подарок как приманка",
      fake_captcha_or_voting: "Капча или голосование как приманка",
      known_reported: "Есть подтверждённые жалобы в Ishonch Guard",
      non_uz_phone: "Номер не похож на узбекский",
      verified_official: "Совпадает с официальным контактом",
    },
  },
  uz: {
    helpTitle: "Ishonch Guard orqali tekshirish",
    helpDescription: "Raqam, havola, username yoki xabar matnini kiriting",
    helpMessage:
      "Raqam, havola, Telegram username yoki xabar matnini tekshiraman.\n\nMisol: @scamguard_bot +998901234567\n\nMen SMS-kod, PIN, CVV yoki parol so'ramayman.",
    tooLongTitle: "Matn juda uzun",
    tooLongDescription: "Xabarni 2000 belgigacha qisqartiring",
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
        step: "SMS-kod, karta, pul yubormang va ilova o'rnatmang.",
      },
    },
    reasonFallback: {
      safe: "Ko'rinib turgan matnda xavfli signal yo'q.",
      unknown: "Bitta qiymat ishonchli xulosa uchun yetarli emas.",
      suspicious: "Bosim, noma'lum manba yoki shubhali havola belgilari bor.",
      high_risk: "Kod, karta, pul yoki akkauntga kirishni o'g'irlash belgilari bor.",
    },
    reasonHints: {
      asks_for_sms_code: "SMS tasdiqlash kodini so'rashyapti",
      asks_for_otp: "Bir martalik kod so'ralmoqda",
      asks_for_card_cvv: "Karta CVV/CVC so'ralmoqda",
      asks_for_pin: "PIN yoki parol so'ralmoqda",
      asks_to_install_apk: "Ilova/APK o'rnatish so'ralmoqda",
      apk_download_link: "APK havolasi bor",
      asks_to_transfer_to_safe_account: "Pulni «xavfsiz hisob»ga o'tkazish so'ralmoqda",
      asks_to_scan_qr: "QR skan qilish so'ralmoqda",
      suspicious_invite_link: "Shubhali Telegram invite-havolasi",
      gambling_prediction_promo: "Stavka/kazino/prognoz promosiga o'xshaydi",
      giveaway_engagement_bait: "Sovg'a yoki yutuq orqali jalb qilish",
      fake_captcha_or_voting: "Kapcha yoki ovoz berish orqali jalb qilish",
      known_reported: "Ishonch Guardda tasdiqlangan shikoyatlar bor",
      non_uz_phone: "Raqam O'zbekiston raqamiga o'xshamaydi",
      verified_official: "Rasmiy kontakt bilan mos",
    },
  },
  en: {
    helpTitle: "Check with Ishonch Guard",
    helpDescription: "Type a number, link, username or message text",
    helpMessage:
      "I can check a number, link, Telegram username or message text.\n\nExample: @scamguard_bot +998901234567\n\nI never ask for SMS codes, PINs, CVV or passwords.",
    tooLongTitle: "Text is too long",
    tooLongDescription: "Shorten it to 2000 characters",
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
        step: "Do not send an SMS code, card data, money or install an app.",
      },
    },
    reasonFallback: {
      safe: "No dangerous signal is visible in the provided text.",
      unknown: "One value is not enough for a confident conclusion.",
      suspicious: "There are signs of pressure, unknown source or suspicious link.",
      high_risk: "There are signs of code, card, money or account-access theft.",
    },
    reasonHints: {
      asks_for_sms_code: "They ask for an SMS confirmation code",
      asks_for_otp: "They ask for a one-time code",
      asks_for_card_cvv: "They ask for card CVV/CVC",
      asks_for_pin: "They ask for a PIN or password",
      asks_to_install_apk: "They ask to install an app/APK",
      apk_download_link: "APK link detected",
      asks_to_transfer_to_safe_account: "They ask for transfer to a safe account",
      asks_to_scan_qr: "They ask to scan a QR code",
      suspicious_invite_link: "Suspicious Telegram invite link",
      gambling_prediction_promo: "Betting/casino/prediction promo",
      giveaway_engagement_bait: "Gift or giveaway bait",
      fake_captcha_or_voting: "Captcha or voting bait",
      known_reported: "Confirmed Ishonch Guard reports exist",
      non_uz_phone: "Number does not look Uzbek",
      verified_official: "Matches an official contact",
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
    humanIntents: Record<HumanInlineIntent, { title: string; description: string }>;
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
      "Это не гарантия безопасности. Добавьте, что вас просят: код, карту, перевод, APK или QR.",
    phoneWeakTitle: "Номер выглядит неполным",
    phoneWeakDescription:
      "Проверьте полный номер или добавьте текст просьбы: код, карта, перевод, APK или QR.",
    telegramTitle: "Telegram: нужен контекст",
    telegramDescription:
      "Username сам не доказывает риск. Добавьте текст просьбы, ссылку на пост или скрин.",
    humanIntents: {
      link_request: {
        title: "Ссылка: сначала проверим",
        description:
          "Пока не открывайте и ничего не вводите. Пришлите саму ссылку или полный текст просьбы.",
      },
      code_request: {
        title: "Код: никому не называйте",
        description:
          "SMS, push, OTP, PIN и пароли не диктуем. Пришлите полный текст просьбы или скрин.",
      },
      sent_code: {
        title: "Код уже отправлен: действуйте срочно",
        description:
          "Сейчас не спорим с мошенником. Заблокируйте карту/доступ через банк и смените пароль с другого устройства.",
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
          "Не переводите незнакомцам или на «безопасный счёт». Пришлите кому, куда и зачем просят перевести.",
      },
      app_request: {
        title: "Приложение: не устанавливайте",
        description:
          "Не ставьте APK, AnyDesk, RustDesk или «защитное» приложение по просьбе из чата/звонка.",
      },
      bank_call: {
        title: "Звонок из банка: перезвоните сами",
        description:
          "Не называйте коды и данные карты. Завершите разговор и звоните по номеру с карты/приложения.",
      },
      personal_data: {
        title: "Документы: не отправляйте фото",
        description:
          "Паспорт, ПИНФЛ/ИНН, селфи и адрес не отправляем незнакомым. Пришлите текст просьбы.",
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
          "За вакансию, обучение, форму или проверку не платят заранее. Пришлите условия целиком.",
      },
      investment_offer: {
        title: "Инвестиции/крипта: осторожно",
        description:
          "Гарантированный доход, TON/USDT/wallet и быстрый процент — частый крючок. Не переводите депозит незнакомым.",
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
          "Вы правильно остановились. Пришлите сообщение, ссылку, номер или что именно вас просят сделать.",
      },
      voting_link: {
        title: "Голосование/канал: сначала проверим",
        description:
          "Не переходите по ссылке и не входите в Telegram заново. Пришлите ссылку или текст приглашения целиком.",
      },
      next_step: {
        title: "Что делать: остановитесь и пришлите просьбу",
        description:
          "Пока ничего не отправляйте. Пришлите текст, ссылку, номер или что уже произошло — я подскажу безопасный шаг.",
      },
      reply_safety: {
        title: "Ответ: не раскрывайте данные",
        description:
          "Можно отвечать только нейтрально. Не отправляйте коды, карту, деньги или документы; пришлите просьбу целиком.",
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
      "Bu xavfsizlik kafolati emas. Nima so'ralganini qo'shing: kod, karta, pul, APK yoki QR.",
    phoneWeakTitle: "Raqam to'liq emas",
    phoneWeakDescription:
      "To'liq raqamni yoki so'rov matnini yuboring: kod, karta, pul, APK yoki QR.",
    telegramTitle: "Telegram: kontekst kerak",
    telegramDescription:
      "Username o'zi xavfni isbotlamaydi. So'rov matni, post havolasi yoki skrin yuboring.",
    humanIntents: {
      link_request: {
        title: "Havola: avval tekshiramiz",
        description:
          "Hozircha ochmang va hech narsa kiritmang. Havolani yoki so'rov matnini to'liq yuboring.",
      },
      code_request: {
        title: "Kod: hech kimga aytmang",
        description: "SMS, push, OTP, PIN va parollarni aytmang. To'liq xabar yoki skrin yuboring.",
      },
      sent_code: {
        title: "Kod yuborilgan: tez harakat qiling",
        description:
          "Hozircha javob bermang. Bank orqali kartani/kirishni bloklang va boshqa qurilmadan parolni almashtiring.",
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
          "Notanish odamga yoki «xavfsiz hisob»ga pul o'tkazmang. Kimga va nega so'ralganini yuboring.",
      },
      app_request: {
        title: "Ilova: o'rnatmang",
        description:
          "Chat/qo'ng'iroq bo'yicha APK, AnyDesk, RustDesk yoki «himoya» ilovasini o'rnatmang.",
      },
      bank_call: {
        title: "Bankdan qo'ng'iroq: o'zingiz qayta qo'ng'iroq qiling",
        description:
          "Kod va karta ma'lumotlarini aytmang. Suhbatni tugating va rasmiy raqamga qo'ng'iroq qiling.",
      },
      personal_data: {
        title: "Hujjatlar: rasm yubormang",
        description:
          "Pasport, PINFL/STIR, selfi yoki manzilni notanishlarga yubormang. So'rov matnini yuboring.",
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
          "Vakansiya, o'qish, forma yoki tekshiruv uchun avval pul to'lamang. Shartlarni to'liq yuboring.",
      },
      investment_offer: {
        title: "Invest/kripto: ehtiyot bo'ling",
        description:
          "Kafolatlangan daromad, TON/USDT/wallet va tez foyda - keng tarqalgan tuzoq. Depozit yubormang.",
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
          "To'xtaganingiz to'g'ri. Xabar, havola, raqam yoki sizdan aynan nima so'ralayotganini yuboring.",
      },
      voting_link: {
        title: "Ovoz berish/kanal: avval tekshiramiz",
        description:
          "Havolaga o'tmang va Telegramga qayta kirmang. Havola yoki taklif matnini to'liq yuboring.",
      },
      next_step: {
        title: "Nima qilish kerak: to'xtang va so'rovni yuboring",
        description:
          "Hozircha hech narsa yubormang. Matn, havola, raqam yoki nima bo'lganini yuboring - xavfsiz qadamni aytaman.",
      },
      reply_safety: {
        title: "Javob: ma'lumot bermang",
        description:
          "Faqat neytral javob bering. Kod, karta, pul yoki hujjat yubormang; so'rovni to'liq yuboring.",
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
      "This is not a safety guarantee. Add what they ask for: code, card, transfer, APK or QR.",
    phoneWeakTitle: "Number looks incomplete",
    phoneWeakDescription:
      "Send the full number or add the request text: code, card, transfer, APK or QR.",
    telegramTitle: "Telegram: context needed",
    telegramDescription:
      "A username alone cannot prove risk. Add the request text, post link or screenshot.",
    humanIntents: {
      link_request: {
        title: "Link: check it first",
        description:
          "Do not open it or enter anything yet. Send the actual link or the full request text.",
      },
      code_request: {
        title: "Code: do not share it with anyone",
        description:
          "Do not read out SMS, push, OTP, PIN or passwords. Send the full request text or screenshot.",
      },
      sent_code: {
        title: "Code already sent: act now",
        description:
          "Do not argue with the scammer. Block card/access through the bank and change the password from another device.",
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
          "Do not transfer to strangers or a “safe account”. Send who, where and why they ask you to pay.",
      },
      app_request: {
        title: "App: do not install it",
        description:
          "Do not install APK, AnyDesk, RustDesk or a “security” app from a chat or call.",
      },
      bank_call: {
        title: "Bank call: call back yourself",
        description:
          "Do not share codes or card data. Hang up and call the number from your card/app.",
      },
      personal_data: {
        title: "Documents: do not send photos",
        description:
          "Do not send passport, tax ID, selfie or address to strangers. Send the request text.",
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
          "Do not prepay for a job, training, uniform or verification. Send the full terms.",
      },
      investment_offer: {
        title: "Invest/crypto: be careful",
        description:
          "Guaranteed income, TON/USDT/wallet and fast returns are common bait. Do not send a deposit.",
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
          "Good that you paused. Send the message, link, number or what exactly they ask you to do.",
      },
      voting_link: {
        title: "Voting/channel: check it first",
        description:
          "Do not open the link or sign in to Telegram again. Send the link or invitation text.",
      },
      next_step: {
        title: "What to do: pause and send the request",
        description:
          "Do not send anything yet. Send the text, link, number or what already happened - I will give a safe step.",
      },
      reply_safety: {
        title: "Reply: do not reveal data",
        description:
          "Only reply neutrally. Do not send codes, card data, money or documents; send the full request.",
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

function buildArticle(
  id: string,
  title: string,
  description: string,
  messageText: string,
  lang: Lang,
): InlineQueryResultArticle {
  return {
    type: "article",
    id,
    title,
    description,
    input_message_content: {
      message_text: escapeMarkdownV2(messageText),
      parse_mode: "MarkdownV2",
      disable_web_page_preview: true,
    },
    reply_markup: {
      inline_keyboard: [[{ text: COPY[lang].continueInBot, url: BOT_URL }]],
    },
  };
}

function topReason(result: RunCheckResult, copy: Copy): string {
  const significant = result.reasons.find((reason) => reason !== "hosted_app_platform");
  if (significant && copy.reasonHints[significant]) return copy.reasonHints[significant];
  if (result.verifiedContact) return copy.reasonHints.verified_official ?? copy.reasonFallback.safe;
  if (result.phoneReputation)
    return copy.reasonHints.known_reported ?? copy.reasonFallback.suspicious;
  return copy.reasonFallback[result.level];
}

function formatInlineMessage(result: RunCheckResult, lang: Lang): string {
  const copy = COPY[lang];
  const level = copy.levels[result.level];
  const lines = [
    level.title,
    copy.checkedBy,
    "",
    `${copy.displayLabel}: ${result.display}`,
    `${copy.reasonLabel}: ${topReason(result, copy)}`,
    `${copy.stepLabel}: ${level.step}`,
    "",
    "@scamguard_bot",
  ];
  return lines.join("\n");
}

function formatHumanInlineMessage(
  result: RunCheckResult,
  lang: Lang,
  intentCopy: { title: string; description: string },
): string {
  const copy = COPY[lang];
  const level = copy.levels[result.level];
  const title =
    result.level === "unknown" ? intentCopy.title : `${level.title}\n${intentCopy.title}`;
  const lines = [
    title,
    copy.checkedBy,
    "",
    `${copy.displayLabel}: ${result.display}`,
    "",
    intentCopy.description,
    "",
    "@scamguard_bot",
  ];
  return lines.join("\n");
}

function compactInlineDescription(value: string): string {
  const oneLine = value.replace(/\s+/gu, " ").trim();
  if (oneLine.length <= MAX_INLINE_DESCRIPTION_LENGTH) return oneLine;

  const softLimit = MAX_INLINE_DESCRIPTION_LENGTH - 3;
  const boundary = oneLine.lastIndexOf(" ", softLimit);
  const end = boundary >= 60 ? boundary : softLimit;
  return `${oneLine.slice(0, end).trimEnd()}...`;
}

function hasSentCodeIntent(normalized: string): boolean {
  return (
    /(?:я|уже|только что|сейчас)?.{0,40}(?:передал|передала|отправил|отправила|сообщил|сообщила|назвал|назвала|продиктовал|продиктовала|ввел|ввёл|ввела|скинул|скинула|дал|дала).{0,80}(?:код|sms|смс|otp|push|пуш|pin|пин|парол)/iu.test(
      normalized,
    ) ||
    /(?:код|sms|смс|otp|push|пуш|pin|пин|парол).{0,80}(?:передал|передала|отправил|отправила|сообщил|сообщила|назвал|назвала|продиктовал|продиктовала|ввел|ввёл|ввела|скинул|скинула|дал|дала)/iu.test(
      normalized,
    ) ||
    /(?:men|allaqachon|hozirgina).{0,60}(?:kod|sms|otp|push|pin|parol)?.{0,60}(?:yubordim|aytdim|berdim|kiritdim|jo['’]?natdim)/iu.test(
      normalized,
    ) ||
    /(?:kod|sms|otp|push|pin|parol).{0,80}(?:yubordim|aytdim|berdim|kiritdim|jo['’]?natdim)/iu.test(
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
    case "bank_call":
      return "bank_call";
    case "identity_uncertain":
      return "identity_uncertain";
    case "telegram_message":
    case "file_received":
      return "safety_question";
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
    case "friend_money":
      return "relative_distress";
    case "support_impersonation":
      return "bank_call";
    case "authority_impersonation":
    case "legal_impersonation":
      return "general_scam_concern";
    case "gov_service_login":
      return "gov_service";
    case "romance_money":
      return "romance_money";
    case "job_offer":
      return "job_offer";
    case "investment_offer":
      return "investment_offer";
    case "travel_migration_prepayment":
      return "travel_migration_prepayment";
    case "bank_contact_question":
      return "bank_contact";
    case "acknowledgement":
    case "trust_or_greeting":
      return null;
  }
}

function classifySharedVictimInlineIntent(text: string): HumanInlineIntent | null {
  const match = classifyVictimIntent(text);
  if (!match) return null;
  return mapVictimIntentToHumanInlineIntent(match.kind);
}

function classifyHumanInlineIntent(text: string): HumanInlineIntent | null {
  const normalized = text.toLowerCase();
  const hasConcreteUrl =
    /https?:\/\/|www\.|t\.me\/|telegram\.me\/|\b[a-z0-9-]+\.[a-z]{2,}\b/iu.test(normalized);

  if (
    /(?:one\s?id|oneid|my\.gov\.uz|id\.gov\.uz|soliq\.uz|gov\.uz|egov|e-gov|госуслуг|госорган|государственн|электронн.{0,20}правительств|(?:^|[^a-zа-яё])(?:пинфл|стир|инн)(?:$|[^a-zа-яё])).{0,100}(?:код|sms|смс|парол|логин|вход|ссылк|подтверд|заблок|тиклаш|tasdiq|parol|login|kirish)?/iu.test(
      normalized,
    ) ||
    /(?:davlat xizmat|one\s?id|oneid|my\.gov\.uz|id\.gov\.uz|soliq\.uz|gov\.uz|pinfl|stir).{0,100}(?:kod|sms|parol|login|kirish|tasdiq|blok|tiklash)?/iu.test(
      normalized,
    ) ||
    /(?:one\s?id|oneid|my\.gov\.uz|id\.gov\.uz|soliq\.uz|gov\.uz|government|tax service).{0,100}(?:code|sms|password|login|sign in|confirm|blocked|restore)?/iu.test(
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
    )
  ) {
    return "sim_swap";
  }

  if (hasSentCodeIntent(normalized)) {
    return "sent_code";
  }

  if (hasCodeRequestIntent(normalized)) {
    return "code_request";
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
    /(?:можно|стоит|надо|нужно|безопасно ли).{0,80}(?:отвечать|ответить|написать|писать|переписываться|говорить|разговаривать)/iu.test(
      normalized,
    ) ||
    /(?:что|как).{0,50}(?:ответить|сказать|написать)/iu.test(normalized) ||
    /(?:javob|yoz|gaplash).{0,100}(?:bersam|beraymi|bo'ladimi|mumkinmi|kerakmi)/iu.test(
      normalized,
    ) ||
    /(?:can|should).{0,60}(?:reply|answer|text|message|talk)/iu.test(normalized) ||
    /(?:what|how).{0,50}(?:reply|answer|say|write)/iu.test(normalized)
  ) {
    return "reply_safety";
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

  if (
    /(?:приглаша|добавля|зовут|позвали|вступить|подписаться).{0,100}(?:канал|групп|чат).{0,100}(?:заработ|доход|прибыл|легк.{0,20}деньг|ставк|крипт|ton|usdt|wallet|инвест)/iu.test(
      normalized,
    ) ||
    /(?:канал|групп|чат).{0,100}(?:заработ|доход|прибыл|легк.{0,20}деньг|ставк|крипт|ton|usdt|wallet|инвест)/iu.test(
      normalized,
    ) ||
    /(?:kanal|guruh|chat).{0,100}(?:daromad|ishlash|pul|foyda|kripto|ton|usdt|wallet|invest|stavka)/iu.test(
      normalized,
    ) ||
    /(?:channel|group|chat).{0,100}(?:earn|income|profit|easy money|betting|crypto|ton|usdt|wallet|invest)/iu.test(
      normalized,
    )
  ) {
    return "earning_channel";
  }

  if (
    /(?:голосован|голосовать|проголос|опрос|vote|voting).{0,120}(?:канал|групп|чат|ссылк|линк|link|url|перейти|зайти|открыть)/iu.test(
      normalized,
    ) ||
    /(?:канал|групп|чат|ссылк|линк|link|url).{0,120}(?:голосован|голосовать|проголос|опрос|vote|voting)/iu.test(
      normalized,
    ) ||
    /(?:ovoz|so['’]?rovnoma|vote).{0,120}(?:kanal|guruh|chat|havola|link|kir|o['’]?t)/iu.test(
      normalized,
    )
  ) {
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

  if (
    !hasConcreteUrl &&
    (/(?:просят|просит|сказали|говорят|нужно|надо|предлагают|скинули|прислали|дали).{0,80}(?:перейти|зайти|открыть|нажать|кликнуть|посмотреть)?.{0,40}(?:ссылк|линк|link|url|кнопк|сайт)/iu.test(
      normalized,
    ) ||
      /(?:перейти|зайти|открыть|нажать|кликнуть).{0,40}(?:по\s+)?(?:ссылк|линк|link|url|кнопк|сайт)/iu.test(
        normalized,
      ) ||
      /(?:so['’]?ra|ayt|kerak|yubor|berdi).{0,80}(?:havola|link|tugma|sayt).{0,40}(?:o['’]?t|kir|och|bos|bosing)?/iu.test(
        normalized,
      ) ||
      /(?:havola|link|tugma|sayt).{0,60}(?:o['’]?t|kir|och|bos|bosing|yubordi)/iu.test(
        normalized,
      ) ||
      /(?:ask|asked|asks|sent|gave|told|want|wants|need|needs).{0,80}(?:open|click|follow|go\s+to)?.{0,40}(?:link|url|button|site|website)/iu.test(
        normalized,
      ) ||
      /(?:open|click|follow|go\s+to).{0,40}(?:the\s+)?(?:link|url|button|site|website)/iu.test(
        normalized,
      ))
  ) {
    return "link_request";
  }

  if (hasSentCodeIntent(normalized)) {
    return "sent_code";
  }

  if (hasCodeRequestIntent(normalized)) {
    return "code_request";
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

  if (
    /(?:просят|просит|попросил|попросили|спрашива|спросил|спросили|требует|требуют|нужно|надо|сказали).{0,80}(?:карт|cvv|cvc|срок|оборот|номер карты|реквизит|пин|pin)/iu.test(
      normalized,
    ) ||
    /(?:карт|cvv|cvc|срок|оборот|номер карты|реквизит).{0,80}(?:отправ|назв|ввест|фото|сфот|спрашива|спросил|спросили|просят|просит|требует|требуют)/iu.test(
      normalized,
    ) ||
    /(?:karta|cvv|cvc|pin).{0,80}(?:ma['’]?lumot|raqam|ayt|ber|yubor|kirit)/iu.test(normalized) ||
    /(?:ask|asked|asks|need|needs|want|wants).{0,80}(?:card|cvv|cvc|expiry|pin)/iu.test(normalized)
  ) {
    return "card_request";
  }

  if (
    /(?:просят|просит|нужно|надо|сказали).{0,80}(?:установить|скачать|поставить|прилож|apk|anydesk|teamviewer|rustdesk|доступ|экран)/iu.test(
      normalized,
    ) ||
    /(?:установить|скачать|поставить).{0,80}(?:прилож|apk|защит|банк|доступ)/iu.test(normalized) ||
    /(?:ilova|apk|anydesk|teamviewer|rustdesk|ekran|ruxsat).{0,80}(?:o['’]?rnat|yukla|ber|och)/iu.test(
      normalized,
    ) ||
    /(?:install|download|set up).{0,80}(?:app|apk|anydesk|teamviewer|rustdesk|remote|screen)/iu.test(
      normalized,
    )
  ) {
    return "app_request";
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

  if (
    /(?:просят|просит|нужно|надо|сказали).{0,80}(?:паспорт|(?:^|[^a-zа-яё])(?:пинфл|инн|стир)(?:$|[^a-zа-яё])|селфи|документ|адрес|пропис)/iu.test(
      normalized,
    ) ||
    /(?:паспорт|(?:^|[^a-zа-яё])(?:пинфл|инн|стир)(?:$|[^a-zа-яё])|селфи|документ|адрес).{0,80}(?:фото|сфот|отправ|назв)/iu.test(
      normalized,
    ) ||
    /(?:pasport|pinfl|stir|selfi|hujjat|manzil).{0,80}(?:rasm|yubor|ayt|ber)/iu.test(normalized) ||
    /(?:ask|asked|asks|need|needs|want|wants).{0,80}(?:passport|tax id|selfie|document|address)/iu.test(
      normalized,
    )
  ) {
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
    /(?:работ|ваканс|подработ|заработ|л[её]гк.{0,20}доход|удаленн.{0,20}работ|стажиров).{0,120}(?:взнос|обуч|форма|провер|предоплат|комисс|депозит|оплат|карта)/iu.test(
      normalized,
    ) ||
    /(?:взнос|обуч|форма|провер|предоплат|комисс|депозит|оплат).{0,120}(?:работ|ваканс|подработ|заработ|доход|стажиров)/iu.test(
      normalized,
    ) ||
    /(?:ish|vakans|daromad|oylik|masofaviy).{0,120}(?:to['’]?lov|o['’]?qish|forma|tekshir|garov|depozit|karta)/iu.test(
      normalized,
    ) ||
    /(?:job|work|vacancy|income|remote).{0,120}(?:fee|training|uniform|verification|deposit|prepay|card)/iu.test(
      normalized,
    )
  ) {
    return "job_offer";
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

  const sharedVictimIntent = classifySharedVictimInlineIntent(normalized);
  if (sharedVictimIntent) {
    return sharedVictimIntent;
  }

  if (
    /(?:просят|просит|нужно|надо|сказали).{0,80}(?:перевести|перевод|оплатить|заплатить|пополни|безопасн.{0,20}сч[её]т)/iu.test(
      normalized,
    ) ||
    /(?:перевести|перевод|оплатить|заплатить).{0,80}(?:деньг|сум|карт|номер|сч[её]т)/iu.test(
      normalized,
    ) ||
    /(?:pul|to['’]?lov|o['’]?tkaz|hisob).{0,80}(?:yubor|qil|ber|to['’]?la)/iu.test(normalized) ||
    /(?:ask|asked|asks|need|needs|want|wants).{0,80}(?:transfer|pay|payment|send money|safe account)/iu.test(
      normalized,
    )
  ) {
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
    `${copy.displayLabel}: ${passport.display}`,
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

function resultArticle(result: RunCheckResult, lang: Lang): InlineQueryResultArticle {
  const passport = passportArticle(result, lang);
  if (passport) return passport;

  const copy = COPY[lang];
  const level = copy.levels[result.level];
  const preview = PREVIEW_COPY[lang];
  const humanIntent = classifyHumanInlineIntent(result.display);
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
      `${level.description}. ${intentCopy.description}`,
      formatHumanInlineMessage(result, lang, intentCopy),
      lang,
    );
  }

  return buildArticle(
    `check-${result.level}`,
    level.title,
    `${level.description}. ${topReason(result, copy)}`,
    formatInlineMessage(result, lang),
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

async function answerOne(inlineQueryId: string, result: InlineQueryResultArticle): Promise<void> {
  await answerInlineQuery({
    inlineQueryId,
    results: [result],
    cacheTime: 2,
    isPersonal: true,
  });
}

export async function handleInlineQuery(
  query: string,
  ctx: InlineQueryCtx,
  inlineQueryId: string,
): Promise<void> {
  const lang = ctx.session.lang;
  const copy = COPY[lang];
  const trimmed = query.trim();

  if (trimmed.length === 0) {
    await answerOne(inlineQueryId, helpArticle(lang));
    return;
  }

  if (trimmed.length > MAX_INLINE_QUERY_LENGTH) {
    await answerOne(
      inlineQueryId,
      staticArticle("too-long", lang, copy.tooLongTitle, copy.tooLongDescription),
    );
    return;
  }

  try {
    const result = await runCheck({
      input: trimmed,
      lang,
      rateLimitKey: `tg:inline:${ctx.userId}`,
      channel: "telegram",
      skipAi: true,
      persist: false,
    });
    await answerOne(inlineQueryId, resultArticle(result, lang));
  } catch (error) {
    const article = isRateLimitedError(error)
      ? staticArticle(
          "rate-limited",
          lang,
          copy.rateLimitTitle,
          rateLimitDescription(lang, error.retryAfter),
        )
      : staticArticle("error", lang, copy.errorTitle, copy.errorDescription);
    await answerOne(inlineQueryId, article);
  }
}
