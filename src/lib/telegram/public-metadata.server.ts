import type { Lang } from "@/lib/i18n";
import type { RunCheckResult } from "@/lib/risk/check-core";
import { redactText } from "@/lib/risk/detect";
import { REASON_LABELS, type ReasonCode } from "@/lib/risk/rules";
import {
  getChatInfo,
  type GetChatInfoResult,
  type TelegramChatFullInfo,
} from "@/lib/telegram/api.server";

export type TelegramPublicTarget =
  | { kind: "public_username"; username: string }
  | { kind: "public_post"; username: string; postId: string }
  | { kind: "private_invite"; value: string }
  | { kind: "internal_or_private"; value: string }
  | { kind: "none" };

export type TelegramPublicMetadata =
  | { status: "found"; username: string; chat: TelegramChatFullInfo; postId?: string }
  | { status: "not_found"; username: string; postId?: string }
  | { status: "unavailable"; username: string; postId?: string }
  | { status: "private_invite"; value: string }
  | { status: "internal_or_private"; value: string }
  | { status: "not_telegram" };

export type TelegramChatLookup = (chatId: string) => Promise<GetChatInfoResult>;

const PUBLIC_USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{3,31}$/;
const TELEGRAM_LINK_RE =
  /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?:s\/)?([^\s?#/]+)(?:\/(\d+))?(?:[?#]\S*)?/i;
const MENTION_RE = /(?:^|[\s([{"'`])@([a-zA-Z][a-zA-Z0-9_]{3,31})(?=$|[^\w])/;

export function extractTelegramPublicTarget(input: string): TelegramPublicTarget {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "none" };

  const link = TELEGRAM_LINK_RE.exec(trimmed);
  if (link) {
    const path = link[1];
    const postId = link[2];
    if (path.startsWith("+") || path.toLowerCase() === "joinchat") {
      return { kind: "private_invite", value: path };
    }
    if (path.toLowerCase() === "c") {
      return { kind: "internal_or_private", value: path };
    }
    if (PUBLIC_USERNAME_RE.test(path)) {
      if (postId) return { kind: "public_post", username: path, postId };
      return { kind: "public_username", username: path };
    }
    return { kind: "internal_or_private", value: path };
  }

  const mention = MENTION_RE.exec(trimmed);
  if (mention) return { kind: "public_username", username: mention[1] };

  if (trimmed.startsWith("@")) {
    const username = trimmed.slice(1);
    if (PUBLIC_USERNAME_RE.test(username)) return { kind: "public_username", username };
  }

  return { kind: "none" };
}

export async function lookupTelegramPublicMetadata(
  input: string,
  lookup: TelegramChatLookup = getChatInfo,
): Promise<TelegramPublicMetadata> {
  const target = extractTelegramPublicTarget(input);
  if (target.kind === "none") return { status: "not_telegram" };
  if (target.kind === "private_invite") {
    return { status: "private_invite", value: target.value };
  }
  if (target.kind === "internal_or_private") {
    return { status: "internal_or_private", value: target.value };
  }

  const username = target.username;
  const postId = target.kind === "public_post" ? target.postId : undefined;
  const result = await lookup(`@${username}`);
  if (result.ok) return { status: "found", username, chat: result.chat, postId };

  const description = result.description?.toLowerCase() ?? "";
  if (description.includes("chat not found") || description.includes("username not found")) {
    return { status: "not_found", username, postId };
  }
  return { status: "unavailable", username, postId };
}

export async function enrichTelegramPublicMetadata(
  input: string,
  result: RunCheckResult,
  lang: Lang,
  lookup: TelegramChatLookup = getChatInfo,
): Promise<RunCheckResult> {
  if (result.type !== "telegram" || result.verifiedContact) return result;

  const metadata = await lookupTelegramPublicMetadata(input, lookup);
  const brief = buildTelegramPublicMetadataBrief(metadata, lang, result);
  if (!brief) return result;

  const shouldAppendOriginal = shouldAppendOriginalTelegramExplanation(result);

  return {
    ...result,
    explanation: shouldAppendOriginal ? `${brief}\n\n${result.explanation}` : brief,
  };
}

const LOW_SIGNAL_TELEGRAM_REASONS = new Set<ReasonCode>(["unknown_sender", "new_telegram_account"]);

function shouldAppendOriginalTelegramExplanation(result: RunCheckResult): boolean {
  if (!result.explanation) return false;
  if (result.level === "suspicious" || result.level === "high_risk") return true;
  if (result.knownReports > 0) return true;
  return result.reasons.some((reason) => !LOW_SIGNAL_TELEGRAM_REASONS.has(reason));
}

export function buildTelegramPublicMetadataBrief(
  metadata: TelegramPublicMetadata,
  lang: Lang,
  result?: Pick<RunCheckResult, "reasons" | "knownReports">,
): string | null {
  switch (metadata.status) {
    case "found":
      return withTelegramSignals(
        foundBrief(metadata.username, metadata.chat, lang, metadata.postId),
        metadata,
        lang,
        result,
      );
    case "not_found":
      return withTelegramSignals(
        notFoundBrief(metadata.username, lang, metadata.postId),
        metadata,
        lang,
        result,
      );
    case "unavailable":
      return withTelegramSignals(
        unavailableBrief(metadata.username, lang, metadata.postId),
        metadata,
        lang,
        result,
      );
    case "private_invite":
      return withTelegramSignals(privateInviteBrief(lang), metadata, lang, result);
    case "internal_or_private":
      return withTelegramSignals(internalLinkBrief(lang), metadata, lang, result);
    case "not_telegram":
      return null;
  }
}

function foundBrief(
  username: string,
  chat: TelegramChatFullInfo,
  lang: Lang,
  postId?: string,
): string {
  const label = chatTypeLabel(chat.type, lang);
  const title = publicTitle(chat);
  const titlePart = title ? titleText(title, lang) : "";
  const accessPart = accessHints(chat, lang);
  const postPart = postLimitationText(postId, lang);

  if (lang === "uz") {
    return `📋 Telegram pasport: @${username}\n\n👁 Ko'rinadi\n• ${label}${titlePart}${accessPart}\n\n🚫 Ko'rinmaydi\n• akkaunt yoshi, yashirin SCAM belgisi, Telegram shikoyatlari va kimga yozgani\n\n📌 Xulosa\nBu xavfsizlik kafolati emas. Muhimi — sizdan nima so'ralyapti.${postPart}`;
  }
  if (lang === "en") {
    return `📋 Telegram passport: @${username}\n\n👁 Visible\n• ${label}${titlePart}${accessPart}\n\n🚫 Not visible\n• account age, hidden SCAM labels, Telegram reports, or who they messaged\n\n📌 Bottom line\nThis is not a safety guarantee. The key is what they ask you to do.${postPart}`;
  }
  return `📋 Telegram-паспорт: @${username}\n\n👁 Что видно\n• ${label}${titlePart}${accessPart}\n\n🚫 Что недоступно\n• возраст аккаунта, скрытая SCAM-метка, жалобы Telegram и кому он писал\n\n📌 Вывод\nЭто не гарантия безопасности. Главное — что именно он просит сделать.${postPart}`;
}

function notFoundBrief(username: string, lang: Lang, postId?: string): string {
  const postPart = postLimitationText(postId, lang);
  if (lang === "uz") {
    return `📋 Telegram pasport: @${username}\n\n👁 Ko'rinadi\n• Bot API bu username'ni ko'rsatmayapti\n• Bu scam isboti emas\n\n🚫 Ko'rinmaydi\n• yashirin SCAM belgisi, akkaunt yoshi, Telegram shikoyatlari va kimga yozgani\n\n📌 Xulosa\nBitta username bo'yicha «xavfsiz» yoki «scam» deb halol aytib bo'lmaydi.${postPart}`;
  }
  if (lang === "en") {
    return `📋 Telegram passport: @${username}\n\n👁 Visible\n• The Bot API cannot see this username\n• This is not proof of a scam\n\n🚫 Not visible\n• hidden SCAM labels, account age, Telegram reports, or who they messaged\n\n📌 Bottom line\nA username alone cannot honestly prove “safe” or “scam”.${postPart}`;
  }
  return `📋 Telegram-паспорт: @${username}\n\n👁 Что видно\n• Bot API не видит этот username\n• Это не доказательство скама\n\n🚫 Что недоступно\n• скрытая SCAM-метка, возраст аккаунта, жалобы Telegram и кому он писал\n\n📌 Вывод\nПо одному username нельзя честно сказать «безопасно» или «скам».${postPart}`;
}

function unavailableBrief(username: string, lang: Lang, postId?: string): string {
  const postPart = postLimitationText(postId, lang);
  if (lang === "uz") {
    return `📋 Telegram pasport: @${username}\n\n👁 Ko'rinadi\n• Hozir ochiq ma'lumotni so'rab bo'lmadi\n• API xatosi o'zi xavf belgisi emas\n\n🚫 Ko'rinmaydi\n• yashirin SCAM belgisi, akkaunt yoshi, Telegram shikoyatlari va kimga yozgani\n\n📌 Xulosa\nAniqroq tekshiruv uchun xabar matni yoki skrin kerak.${postPart}`;
  }
  if (lang === "en") {
    return `📋 Telegram passport: @${username}\n\n👁 Visible\n• I could not request public data right now\n• An API error alone is not a risk signal\n\n🚫 Not visible\n• hidden SCAM labels, account age, Telegram reports, or who they messaged\n\n📌 Bottom line\nSend the message text or screenshot for a more useful check.${postPart}`;
  }
  return `📋 Telegram-паспорт: @${username}\n\n👁 Что видно\n• Сейчас не удалось запросить публичные данные\n• Сама ошибка API не означает риск\n\n🚫 Что недоступно\n• скрытая SCAM-метка, возраст аккаунта, жалобы Telegram и кому он писал\n\n📌 Вывод\nДля полезной проверки нужен текст сообщения или скрин.${postPart}`;
}

function postLimitationText(postId: string | undefined, lang: Lang): string {
  if (!postId) return "";
  if (lang === "uz") {
    return ` Havola ${postId}-postga o'xshaydi; agar ochiq web-sahifani o'qib bo'lmasa, aniq tekshiruv uchun postni forward qiling yoki skrin yuboring.`;
  }
  if (lang === "en") {
    return ` The link looks like post #${postId}; if the public web page cannot be read, forward the post or send a screenshot for a real check.`;
  }
  return ` Ссылка похожа на пост #${postId}; если публичную web-страницу не удалось прочитать, для точной проверки перешлите пост или пришлите скрин.`;
}

function privateInviteBrief(lang: Lang): string {
  if (lang === "uz") {
    return "Telegram pasport invite-havola:\n• Bu yopiq chat/kanal. Ichidagi postlar, a'zolar va yashirin shikoyatlar menga ko'rinmaydi.\nXulosa: faqat havola va yonidagi matn/skrin bo'yicha baholayman.";
  }
  if (lang === "en") {
    return "Telegram invite passport:\n• This is a closed chat/channel. I cannot see posts, members, or hidden reports inside.\nConclusion: I judge only the invite and the text/screenshot you send with it.";
  }
  return "Telegram-паспорт invite-ссылки:\n• Это закрытый чат/канал. Я не вижу содержимое, участников и скрытые жалобы внутри.\nВывод: оцениваю только ссылку и текст/скрин, который вы прислали рядом.";
}

function internalLinkBrief(lang: Lang): string {
  if (lang === "uz") {
    return "Telegram pasport:\n• Bu ichki yoki yopiq havolaga o'xshaydi. Yopiq chat ichini ko'ra olmayman.\nXulosa: matn, preview yoki skrin yuboring.";
  }
  if (lang === "en") {
    return "Telegram passport:\n• This looks like an internal or private link. I cannot see closed-chat content.\nConclusion: send the text, preview, or screenshot.";
  }
  return "Telegram-паспорт:\n• Это похоже на внутреннюю или закрытую ссылку. Я не вижу содержимое закрытого чата.\nВывод: пришлите текст, превью или скрин.";
}

const TELEGRAM_SIGNAL_ORDER: readonly ReasonCode[] = [
  "known_reported",
  "verified_official",
  "telegram_account_takeover_phishing",
  "fake_captcha_or_voting",
  "giveaway_engagement_bait",
  "crypto_casino_bonus_funnel",
  "gambling_prediction_promo",
  "wallet_action_urgency",
  "task_reward_engagement_bait",
  "ton_referral_earning_scheme",
  "suspicious_invite_link",
  "impersonates_official",
  "telegram_bank_contact",
  "asks_for_sms_code",
  "asks_for_otp",
  "requests_card_digits",
  "asks_to_install_apk",
  "asks_to_transfer_to_safe_account",
  "payment_before_service",
  "unknown_sender",
];

function withTelegramSignals(
  base: string,
  metadata: TelegramPublicMetadata,
  lang: Lang,
  result?: Pick<RunCheckResult, "reasons" | "knownReports">,
): string {
  const reasons = result?.reasons ?? [];
  const knownReports = result?.knownReports ?? 0;
  const scenario = telegramScenarioBrief(metadata, reasons, knownReports, lang);
  const signals = telegramSignalText(reasons, knownReports, lang, Boolean(result));
  const next = telegramNextStep(metadata, reasons, lang);

  if (scenario) {
    return [scenario, signals, next, base].filter(Boolean).join("\n");
  }

  return [base, signals, next].filter(Boolean).join("\n");
}

function telegramScenarioBrief(
  metadata: TelegramPublicMetadata,
  reasons: readonly ReasonCode[],
  knownReports: number,
  lang: Lang,
): string {
  const hasAccountTakeover = reasons.includes("telegram_account_takeover_phishing");
  const hasCasino = reasons.includes("crypto_casino_bonus_funnel");
  const hasBetting = reasons.includes("gambling_prediction_promo");
  const hasGiveaway =
    reasons.includes("giveaway_engagement_bait") ||
    reasons.includes("fake_captcha_or_voting") ||
    reasons.includes("task_reward_engagement_bait") ||
    reasons.includes("ton_referral_earning_scheme");
  const hasWallet = reasons.includes("wallet_action_urgency");
  const hasOfficialOrCredential =
    reasons.includes("impersonates_official") ||
    reasons.includes("telegram_bank_contact") ||
    reasons.includes("asks_for_sms_code") ||
    reasons.includes("asks_for_otp") ||
    reasons.includes("requests_card_digits") ||
    reasons.includes("asks_to_install_apk");
  const hasInvite =
    metadata.status === "private_invite" || reasons.includes("suspicious_invite_link");

  if (lang === "uz") {
    if (hasAccountTakeover)
      return "Bu Telegram akkauntini egallashga o'xshaydi: kirish, QR, o'chirish/bekor qilish yoki kod-parol so'rovi ko'rinyapti.";
    if (hasWallet)
      return "Bu Web3/hamyon tuzog'iga o'xshaydi: foydalanuvchini hamyon ulash, tranzaksiya imzolash yoki seed phrase kiritishga shoshirishadi.";
    if (hasCasino)
      return "Bu kazino/frispin/depozit bonusi voronkasiga o'xshaydi. Ayniqsa to'lov, Mini App yoki yopiq kanalga olib kirsa ehtiyot bo'ling.";
    if (hasBetting)
      return "Bu prognoz/VIP-stavka yoki kafolatlangan yutuq taklifiga o'xshaydi. Bunday kanallar ko'pincha oldindan to'lov yoki obunaga olib boradi.";
    if (hasGiveaway)
      return "Bu sovg'a/NFT/Stars uchun captcha, ovoz, reaksiya, obuna yoki referral harakatlariga o'xshaydi.";
    if (hasOfficialOrCredential)
      return "Bu bank yoki qo'llab-quvvatlash nomidan yozishga o'xshaydi. Muhimi avatar emas, so'ralgan harakat: kod, karta, APK yoki pul.";
    if (hasInvite)
      return "Bu yopiq Telegram invite. Invite o'zi scam isboti emas, lekin ichidagi postlar menga ko'rinmaydi.";
    if (knownReports > 0)
      return "Ishonch Guard'da bu Telegram nishoni bo'yicha tasdiqlangan shikoyatlar bor; baribir faqat ko'rinadigan belgilarni aytaman.";
    return "";
  }

  if (lang === "en") {
    if (hasAccountTakeover)
      return "This looks like a Telegram account-takeover attempt: login, QR, delete/cancel, code, or password language is visible.";
    if (hasWallet)
      return "This looks like a Web3/wallet trap: it pushes you to connect a wallet, sign a transaction, or enter a seed phrase.";
    if (hasCasino)
      return "This looks like a casino/free-spins/deposit-bonus funnel, especially risky if it leads to payment, a Mini App, or a closed channel.";
    if (hasBetting)
      return "This looks like predictions/VIP betting or a guaranteed-win offer. These channels often lead to prepayment or paid access.";
    if (hasGiveaway)
      return "This looks like a giveaway/NFT/Stars gate tied to captcha, voting, reactions, subscription, or referrals.";
    if (hasOfficialOrCredential)
      return "This looks like contact in the name of a bank or support. The key issue is the requested action: code, card, APK, or money.";
    if (hasInvite)
      return "This is a closed Telegram invite. The invite alone is not proof of scam, but I cannot see the content inside.";
    if (knownReports > 0)
      return "Ishonch Guard has confirmed reports for this Telegram target; I still describe only visible, source-backed signs.";
    return "";
  }

  if (hasAccountTakeover)
    return "Похоже на попытку угона Telegram: видны вход, QR, удаление/отмена, код или пароль.";
  if (hasWallet)
    return "Похоже на Web3/кошелёк-ловушку: подталкивают подключить кошелёк, подписать транзакцию или ввести seed phrase.";
  if (hasCasino)
    return "Похоже на казино/фриспины/депозитный бонус. Особенно рискованно, если ведут к оплате, Mini App или закрытому каналу.";
  if (hasBetting)
    return "Похоже на прогнозы/VIP-ставки или «гарантированный выигрыш». Такие каналы часто ведут к предоплате или платному доступу.";
  if (hasGiveaway)
    return "Похоже на розыгрыш/NFT/Stars, где приз привязан к капче, голосованию, реакциям, подписке или приглашениям.";
  if (hasOfficialOrCredential)
    return "Похоже на контакт от имени банка или поддержки. Важнее не аватарка, а просьба: код, карта, APK или деньги.";
  if (hasInvite)
    return "Это закрытый Telegram invite. Сам invite не доказывает скам, но содержимое внутри мне недоступно.";
  if (knownReports > 0)
    return "В Ishonch Guard есть подтверждённые жалобы по этому Telegram-объекту; ниже показываю только видимые и подтверждённые признаки.";
  return "";
}

function telegramSignalText(
  reasons: readonly ReasonCode[],
  knownReports: number,
  lang: Lang,
  hasKnownReportContext: boolean,
): string {
  const labels = TELEGRAM_SIGNAL_ORDER.filter((reason) => reasons.includes(reason))
    .map((reason) => compactTelegramReason(reason, lang) ?? REASON_LABELS[reason]?.[lang])
    .filter((label): label is string => Boolean(label));

  if (hasKnownReportContext) {
    const reports =
      knownReports > 0
        ? ({
            ru: `${knownReports} подтвержд. жалоб в Ishonch Guard`,
            uz: `Ishonch Guard: ${knownReports} tasdiqlangan shikoyat`,
            en: `${knownReports} confirmed Ishonch Guard reports`,
          } satisfies Record<Lang, string>)
        : ({
            ru: "0 подтвержд. жалоб в Ishonch Guard",
            uz: "Ishonch Guard: 0 tasdiqlangan shikoyat",
            en: "0 confirmed Ishonch Guard reports",
          } satisfies Record<Lang, string>);
    labels.unshift(reports[lang]);
  }

  if (labels.length === 0) return "";
  const prefix: Record<Lang, string> = {
    ru: "🛡 Репутация и признаки",
    uz: "🛡 Reputatsiya va belgilar",
    en: "🛡 Reputation and signs",
  };
  return `${prefix[lang]}\n${labels
    .slice(0, 3)
    .map((label) => `• ${label}`)
    .join("\n")}`;
}

function compactTelegramReason(reason: ReasonCode, lang: Lang): string | null {
  const labels: Partial<Record<ReasonCode, Record<Lang, string>>> = {
    unknown_sender: {
      ru: "отправитель не подтверждён",
      uz: "jo'natuvchi tasdiqlanmagan",
      en: "sender is not verified",
    },
    telegram_account_takeover_phishing: {
      ru: "риск угона Telegram",
      uz: "Telegram egallanishi xavfi",
      en: "Telegram takeover risk",
    },
    suspicious_invite_link: {
      ru: "закрытая invite-ссылка",
      uz: "yopiq invite-havola",
      en: "closed invite link",
    },
    gambling_prediction_promo: {
      ru: "ставки/прогнозы/выигрыш",
      uz: "stavka/prognoz/yutuq",
      en: "betting/prediction/win promo",
    },
    giveaway_engagement_bait: {
      ru: "розыгрыш/подарок за действие",
      uz: "sovg'a/yutuq uchun harakat",
      en: "giveaway/prize action bait",
    },
    crypto_casino_bonus_funnel: {
      ru: "казино/фриспины/депозит",
      uz: "kazino/frispin/depozit",
      en: "casino/free-spins/deposit",
    },
    fake_captcha_or_voting: {
      ru: "капча/голосование ради приза",
      uz: "sovrin uchun captcha/ovoz",
      en: "captcha/voting for prize",
    },
    task_reward_engagement_bait: {
      ru: "награда за простые действия",
      uz: "oddiy harakat uchun mukofot",
      en: "reward for simple tasks",
    },
    wallet_action_urgency: {
      ru: "срочное действие с кошельком",
      uz: "hamyon bilan shoshilinch amal",
      en: "urgent wallet action",
    },
    ton_referral_earning_scheme: {
      ru: "TON/крипто за приглашения",
      uz: "takliflar uchun TON/kripto",
      en: "TON/crypto referral earning",
    },
    impersonates_official: {
      ru: "похоже на поддержку/официальный аккаунт",
      uz: "qo'llab-quvvatlash/rasmiy akkauntga o'xshaydi",
      en: "looks like support/official account",
    },
    telegram_bank_contact: {
      ru: "контакт от имени банка в Telegram",
      uz: "Telegram'da bank nomidan kontakt",
      en: "bank contact in Telegram",
    },
    asks_for_sms_code: {
      ru: "просят SMS-код",
      uz: "SMS-kod so'rashyapti",
      en: "asks for SMS code",
    },
    asks_for_otp: {
      ru: "просят OTP-код",
      uz: "OTP-kod so'rashyapti",
      en: "asks for OTP code",
    },
    requests_card_digits: {
      ru: "просят данные карты",
      uz: "karta ma'lumotini so'rashyapti",
      en: "asks for card data",
    },
    asks_to_install_apk: {
      ru: "просят установить APK",
      uz: "APK o'rnatishni so'rashyapti",
      en: "asks to install APK",
    },
    known_reported: {
      ru: "есть подтверждённые жалобы",
      uz: "tasdiqlangan shikoyatlar bor",
      en: "confirmed reports exist",
    },
  };
  return labels[reason]?.[lang] ?? null;
}

function telegramNextStep(
  metadata: TelegramPublicMetadata,
  reasons: readonly ReasonCode[],
  lang: Lang,
): string {
  const hasBetting =
    reasons.includes("gambling_prediction_promo") || reasons.includes("crypto_casino_bonus_funnel");
  const hasGiveaway =
    reasons.includes("giveaway_engagement_bait") ||
    reasons.includes("fake_captcha_or_voting") ||
    reasons.includes("task_reward_engagement_bait") ||
    reasons.includes("ton_referral_earning_scheme");
  const hasWallet = reasons.includes("wallet_action_urgency");
  const hasAccountTakeover = reasons.includes("telegram_account_takeover_phishing");
  const hasOfficialRisk =
    reasons.includes("impersonates_official") || reasons.includes("telegram_bank_contact");
  const hasInvite =
    metadata.status === "private_invite" || reasons.includes("suspicious_invite_link");
  const hasCredentialRisk =
    reasons.includes("asks_for_sms_code") ||
    reasons.includes("asks_for_otp") ||
    reasons.includes("requests_card_digits") ||
    reasons.includes("asks_to_install_apk");

  if (lang === "uz") {
    if (hasAccountTakeover)
      return "🧭 Xavfsiz qadam\nTelegram kod/parol kiritmang, QR skaner qilmang va 'cancel/delete' havolasini ochmang. Suhbat skrinini yuboring.";
    if (hasBetting)
      return "🧭 Xavfsiz qadam\nPrognoz/VIP/kazino bonus uchun pul to'lamang. Kanal tavsifi yoki post skrinini yuboring.";
    if (hasWallet)
      return "🧭 Xavfsiz qadam\nHamyon ulamang, tranzaksiya imzolamang, seed phrase kiritmang. Domen yoki post skrinini yuboring.";
    if (hasGiveaway)
      return "🧭 Xavfsiz qadam\nSovrin uchun captcha/ovoz/reaksiya qilmang va hamyon/kodni kiritmang. Post skrinini yuboring.";
    if (hasOfficialRisk)
      return "🧭 Xavfsiz qadam\nRasmiy sayt/raqam orqali tekshiring. Kod yoki karta yubormang, xabar/skrin yuboring.";
    if (hasCredentialRisk)
      return "🧭 Xavfsiz qadam\nKod, karta yoki APK bermang. Suhbat skrinini yuboring.";
    if (hasInvite)
      return "🧭 Xavfsiz qadam\nInvite orqali kod/karta kiritmang. Telegram preview, tavsif yoki post skrinini yuboring.";
    return "🧭 Keyingi qadam\nXabar/skrin yuboring: kod, pul, karta, APK yoki havola so'rashyaptimi?";
  }
  if (lang === "en") {
    if (hasAccountTakeover)
      return "🧭 Safe step\nDo not enter Telegram codes/passwords, scan QR login codes, or open 'cancel/delete' links. Send a chat screenshot.";
    if (hasBetting)
      return "🧭 Safe step\nDo not pay for predictions/VIP/casino bonuses. Send a screenshot of the channel description or post.";
    if (hasWallet)
      return "🧭 Safe step\nDo not connect a wallet, sign a transaction, or enter a seed phrase. Send the domain or post screenshot.";
    if (hasGiveaway)
      return "🧭 Safe step\nDo not complete captcha/voting/reactions for a prize or enter wallet/code data. Send the post screenshot.";
    if (hasOfficialRisk)
      return "🧭 Safe step\nVerify through the official site or number. Do not send codes/card data; send the message/screenshot.";
    if (hasCredentialRisk)
      return "🧭 Safe step\nDo not share codes, card data, or APK access. Send a chat screenshot.";
    if (hasInvite)
      return "🧭 Safe step\nDo not enter codes/card data through the invite. Send the Telegram preview, description, or post screenshot.";
    return "🧭 Next step\nSend the message/screenshot: are they asking for codes, money, card data, APK, or a link?";
  }
  if (hasAccountTakeover)
    return "🧭 Безопасный шаг\nНе вводите Telegram-код/пароль, не сканируйте QR-вход и не открывайте ссылки «cancel/delete». Пришлите скрин переписки.";
  if (hasBetting)
    return "🧭 Безопасный шаг\nНе платите за прогноз/VIP/казино-бонус. Пришлите скрин описания канала или поста.";
  if (hasWallet)
    return "🧭 Безопасный шаг\nНе подключайте кошелёк, не подписывайте транзакцию и не вводите seed phrase. Пришлите домен или скрин поста.";
  if (hasGiveaway)
    return "🧭 Безопасный шаг\nНе проходите капчу/голосование/реакции ради приза и не вводите кошелёк/код. Пришлите скрин поста.";
  if (hasOfficialRisk)
    return "🧭 Безопасный шаг\nПроверяйте через официальный сайт/номер. Не отправляйте коды или карту, пришлите сообщение/скрин.";
  if (hasCredentialRisk)
    return "🧭 Безопасный шаг\nНе сообщайте код, карту и не ставьте APK. Пришлите скрин переписки.";
  if (hasInvite)
    return "🧭 Безопасный шаг\nНе вводите код/карту через invite. Пришлите Telegram-превью, описание или скрин поста.";
  return "🧭 Следующий шаг\nПришлите сообщение/скрин: что просят — код, деньги, карту, APK или ссылку?";
}

function chatTypeLabel(type: TelegramChatFullInfo["type"], lang: Lang): string {
  const labels: Record<TelegramChatFullInfo["type"], Record<Lang, string>> = {
    private: { ru: "публичный профиль", uz: "ochiq profil", en: "public profile" },
    group: { ru: "группа", uz: "guruh", en: "group" },
    supergroup: { ru: "группа/супергруппа", uz: "guruh/superguruh", en: "group/supergroup" },
    channel: { ru: "канал", uz: "kanal", en: "channel" },
  };
  return labels[type][lang];
}

function publicTitle(chat: TelegramChatFullInfo): string | null {
  const source = chat.type === "private" ? null : (chat.title ?? null);
  if (!source) return null;
  const cleaned = redactText(source).replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > 60 ? `${cleaned.slice(0, 57)}...` : cleaned;
}

function titleText(title: string, lang: Lang): string {
  if (lang === "uz") return `, nomi: "${title}"`;
  if (lang === "en") return `, title: "${title}"`;
  return `, название: «${title}»`;
}

function accessHints(chat: TelegramChatFullInfo, lang: Lang): string {
  if (chat.join_by_request || chat.join_to_send_messages) {
    if (lang === "uz") return ", kirish/yozish cheklangan";
    if (lang === "en") return ", joining or posting is restricted";
    return ", вход или отправка сообщений ограничены";
  }
  if (chat.has_protected_content) {
    if (lang === "uz") return ", kontent himoyalangan";
    if (lang === "en") return ", protected content";
    return ", контент защищён от пересылки";
  }
  return "";
}
