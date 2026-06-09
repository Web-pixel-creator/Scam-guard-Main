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
  | { kind: "private_invite"; value: string }
  | { kind: "internal_or_private"; value: string }
  | { kind: "none" };

export type TelegramPublicMetadata =
  | { status: "found"; username: string; chat: TelegramChatFullInfo }
  | { status: "not_found"; username: string }
  | { status: "unavailable"; username: string }
  | { status: "private_invite"; value: string }
  | { status: "internal_or_private"; value: string }
  | { status: "not_telegram" };

export type TelegramChatLookup = (chatId: string) => Promise<GetChatInfoResult>;

const PUBLIC_USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{3,31}$/;
const TELEGRAM_LINK_RE = /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([^\s?#/]+)(?:[/?#]\S*)?/i;
const MENTION_RE = /(?:^|[\s([{"'`])@([a-zA-Z][a-zA-Z0-9_]{3,31})(?=$|[^\w])/;

export function extractTelegramPublicTarget(input: string): TelegramPublicTarget {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "none" };

  const link = TELEGRAM_LINK_RE.exec(trimmed);
  if (link) {
    const path = link[1];
    if (path.startsWith("+") || path.toLowerCase() === "joinchat") {
      return { kind: "private_invite", value: path };
    }
    if (path.toLowerCase() === "c") {
      return { kind: "internal_or_private", value: path };
    }
    if (PUBLIC_USERNAME_RE.test(path)) {
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
  const result = await lookup(`@${username}`);
  if (result.ok) return { status: "found", username, chat: result.chat };

  const description = result.description?.toLowerCase() ?? "";
  if (description.includes("chat not found") || description.includes("username not found")) {
    return { status: "not_found", username };
  }
  return { status: "unavailable", username };
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

  return {
    ...result,
    explanation: result.explanation ? `${brief}\n\n${result.explanation}` : brief,
  };
}

export function buildTelegramPublicMetadataBrief(
  metadata: TelegramPublicMetadata,
  lang: Lang,
  result?: Pick<RunCheckResult, "reasons" | "knownReports">,
): string | null {
  switch (metadata.status) {
    case "found":
      return withTelegramSignals(
        foundBrief(metadata.username, metadata.chat, lang),
        metadata,
        lang,
        result,
      );
    case "not_found":
      return withTelegramSignals(notFoundBrief(metadata.username, lang), metadata, lang, result);
    case "unavailable":
      return withTelegramSignals(unavailableBrief(metadata.username, lang), metadata, lang, result);
    case "private_invite":
      return withTelegramSignals(privateInviteBrief(lang), metadata, lang, result);
    case "internal_or_private":
      return withTelegramSignals(internalLinkBrief(lang), metadata, lang, result);
    case "not_telegram":
      return null;
  }
}

function foundBrief(username: string, chat: TelegramChatFullInfo, lang: Lang): string {
  const label = chatTypeLabel(chat.type, lang);
  const title = publicTitle(chat);
  const titlePart = title ? titleText(title, lang) : "";
  const accessPart = accessHints(chat, lang);

  if (lang === "uz") {
    return `Telegram: @${username} bo'yicha ochiq ma'lumot ko'rinadi — ${label}${titlePart}${accessPart}. Bu kafolat emas: akkaunt yoshi, yashirin shikoyatlar va spam tarixi menga ko'rinmaydi.`;
  }
  if (lang === "en") {
    return `Telegram: public data for @${username} is visible — ${label}${titlePart}${accessPart}. This is not a guarantee: I cannot see account age, hidden reports, or spam history.`;
  }
  return `Telegram: вижу публичные данные @${username} — ${label}${titlePart}${accessPart}. Это не гарантия: возраст аккаунта, скрытые жалобы и spam-история мне недоступны.`;
}

function notFoundBrief(username: string, lang: Lang): string {
  if (lang === "uz") {
    return `Telegram: @${username} Bot API orqali ko'rinmayapti. Bu scam isboti emas: yashirin SCAM belgisi, akkaunt yoshi va spam tarixi menga ko'rinmaydi.`;
  }
  if (lang === "en") {
    return `Telegram: @${username} is not visible through the Bot API. This is not proof of a scam: hidden SCAM labels, account age, and spam history are not visible to me.`;
  }
  return `Telegram: @${username} не виден через Bot API. Это не доказательство скама: скрытая SCAM-метка, возраст аккаунта и spam-история мне недоступны.`;
}

function unavailableBrief(username: string, lang: Lang): string {
  if (lang === "uz") {
    return `Telegram: hozir @${username} bo'yicha ochiq ma'lumotni so'rab bo'lmadi. API xatosi o'zi xavf belgisi emas.`;
  }
  if (lang === "en") {
    return `Telegram: I could not request public data for @${username} right now. An API error alone is not a risk signal.`;
  }
  return `Telegram: сейчас не удалось запросить публичные данные @${username}. Сама ошибка API не означает риск.`;
}

function privateInviteBrief(lang: Lang): string {
  if (lang === "uz") {
    return "Telegram: bu yopiq chat/kanalga invite-havola. Ichidagi postlar, a'zolar va yashirin shikoyatlar menga ko'rinmaydi; faqat havola va yuborgan kontekstingizni baholayman.";
  }
  if (lang === "en") {
    return "Telegram: this is an invite link to a closed chat/channel. I cannot see its posts, members, or hidden reports; I judge only the invite and the context you sent.";
  }
  return "Telegram: это invite-ссылка в закрытый чат/канал. Я не вижу содержимое, участников и скрытые жалобы; оцениваю только ссылку и присланный рядом контекст.";
}

function internalLinkBrief(lang: Lang): string {
  if (lang === "uz") {
    return "Telegram: bu ichki yoki yopiq havolaga o'xshaydi. Yopiq chat ichini ko'ra olmayman; matn, preview yoki skrin yuboring.";
  }
  if (lang === "en") {
    return "Telegram: this looks like an internal or private link. I cannot see closed-chat content; send the text, preview, or screenshot.";
  }
  return "Telegram: это похоже на внутреннюю или закрытую ссылку. Я не вижу содержимое закрытого чата; пришлите текст, превью или скрин.";
}

const TELEGRAM_SIGNAL_ORDER: readonly ReasonCode[] = [
  "known_reported",
  "verified_official",
  "telegram_account_takeover_phishing",
  "gambling_prediction_promo",
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
  const signals = telegramSignalText(result?.reasons ?? [], result?.knownReports ?? 0, lang);
  const next = telegramNextStep(metadata, result?.reasons ?? [], lang);
  return [base, signals, next].filter(Boolean).join("\n");
}

function telegramSignalText(
  reasons: readonly ReasonCode[],
  knownReports: number,
  lang: Lang,
): string {
  const labels = TELEGRAM_SIGNAL_ORDER.filter((reason) => reasons.includes(reason))
    .map((reason) => compactTelegramReason(reason, lang) ?? REASON_LABELS[reason]?.[lang])
    .filter((label): label is string => Boolean(label));

  if (knownReports > 0) {
    const reports: Record<Lang, string> = {
      ru: `${knownReports} подтвержд. жалоб в Ishonch Guard`,
      uz: `Ishonch Guard: ${knownReports} tasdiqlangan shikoyat`,
      en: `${knownReports} confirmed Ishonch Guard reports`,
    };
    labels.unshift(reports[lang]);
  }

  if (labels.length === 0) return "";
  const prefix: Record<Lang, string> = {
    ru: "Что видно:",
    uz: "Nima ko'rinadi:",
    en: "Visible signs:",
  };
  return `${prefix[lang]} ${labels.slice(0, 3).join("; ")}.`;
}

function compactTelegramReason(reason: ReasonCode, lang: Lang): string | null {
  const labels: Partial<Record<ReasonCode, Record<Lang, string>>> = {
    unknown_sender: {
      ru: "отправитель не подтверждён",
      uz: "jo'natuvchi tasdiqlanmagan",
      en: "sender is not verified",
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
    impersonates_official: {
      ru: "похоже на поддержку/официальный аккаунт",
      uz: "qo'llab-quvvatlash/rasmiy akkauntga o'xshaydi",
      en: "looks like support/official account",
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
  const hasBetting = reasons.includes("gambling_prediction_promo");
  const hasInvite =
    metadata.status === "private_invite" || reasons.includes("suspicious_invite_link");
  const hasCredentialRisk =
    reasons.includes("asks_for_sms_code") ||
    reasons.includes("asks_for_otp") ||
    reasons.includes("requests_card_digits") ||
    reasons.includes("asks_to_install_apk");

  if (lang === "uz") {
    if (hasBetting)
      return "Xavfsiz qadam: prognoz/VIP uchun pul to'lamang; kanal tavsifi yoki post skrinini yuboring.";
    if (hasCredentialRisk)
      return "Xavfsiz qadam: kod, karta yoki APK bermang; suhbat skrinini yuboring.";
    if (hasInvite)
      return "Xavfsiz qadam: invite orqali kod/karta kiritmang; Telegram preview, tavsif yoki post skrinini yuboring.";
    return "Aniq tekshiruv uchun xabar/skrin yuboring: kod, pul, karta, APK yoki havola so'rashyaptimi?";
  }
  if (lang === "en") {
    if (hasBetting)
      return "Safe step: do not pay for predictions/VIP access; send a screenshot of the channel description or post.";
    if (hasCredentialRisk)
      return "Safe step: do not share codes, card data, or APK access; send a chat screenshot.";
    if (hasInvite)
      return "Safe step: do not enter codes/card data through the invite; send the Telegram preview, description, or post screenshot.";
    return "For a real check, send the message/screenshot: are they asking for codes, money, card data, APK, or a link?";
  }
  if (hasBetting)
    return "Безопасный шаг: не платите за прогноз/VIP; пришлите скрин описания канала или поста.";
  if (hasCredentialRisk)
    return "Безопасный шаг: не сообщайте код, карту и не ставьте APK; пришлите скрин переписки.";
  if (hasInvite)
    return "Безопасный шаг: не вводите код/карту через invite; пришлите Telegram-превью, описание или скрин поста.";
  return "Для проверки по делу пришлите сообщение/скрин: что просят — код, деньги, карту, APK или ссылку?";
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
