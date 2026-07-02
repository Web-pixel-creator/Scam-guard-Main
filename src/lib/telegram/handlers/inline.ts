import type { Lang } from "@/lib/i18n";
import {
  buildRiskPassportSummary,
  type RiskPassportSection,
  type RiskPassportSummary,
} from "@/lib/risk/risk-passport";
import { runCheck, type RateLimitedError, type RunCheckResult } from "@/lib/risk/check-core";
import type { RiskLevel, ReasonCode } from "@/lib/risk/rules";
import {
  answerInlineQuery,
  escapeMarkdownV2,
  type InlineQueryResultArticle,
} from "@/lib/telegram/api.server";
import type { InlineQueryCtx } from "@/lib/telegram/router";

const MAX_INLINE_QUERY_LENGTH = 2000;
const MAX_INLINE_DESCRIPTION_LENGTH = 120;
const BOT_URL = "https://t.me/scamguard_bot";

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

function compactInlineDescription(value: string): string {
  const oneLine = value.replace(/\s+/gu, " ").trim();
  if (oneLine.length <= MAX_INLINE_DESCRIPTION_LENGTH) return oneLine;

  const softLimit = MAX_INLINE_DESCRIPTION_LENGTH - 3;
  const boundary = oneLine.lastIndexOf(" ", softLimit);
  const end = boundary >= 60 ? boundary : softLimit;
  return `${oneLine.slice(0, end).trimEnd()}...`;
}

function firstUsefulPassportLine(sections: RiskPassportSection[]): string {
  return (
    sections.find((section) => section.id === "reputation")?.lines[0] ??
    sections.find((section) => section.id === "bottom_line")?.lines[0] ??
    sections.find((section) => section.id === "meaning")?.lines[0] ??
    sections[0]?.lines[0] ??
    ""
  );
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

  return buildArticle(
    `passport-${passport.kind}`,
    passport.title,
    compactInlineDescription(`${passport.eyebrow}. ${firstUsefulPassportLine(passport.sections)}`),
    formatPassportMessage(passport, lang),
    lang,
  );
}

function resultArticle(result: RunCheckResult, lang: Lang): InlineQueryResultArticle {
  const passport = passportArticle(result, lang);
  if (passport) return passport;

  const copy = COPY[lang];
  const level = copy.levels[result.level];
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
      ? staticArticle("rate-limited", lang, copy.rateLimitTitle, copy.rateLimitDescription)
      : staticArticle("error", lang, copy.errorTitle, copy.errorDescription);
    await answerOne(inlineQueryId, article);
  }
}
