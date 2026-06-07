import type { Lang } from "@/lib/i18n";
import type { RunCheckResult } from "@/lib/risk/check-core";
import { redactText } from "@/lib/risk/detect";
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
  const brief = buildTelegramPublicMetadataBrief(metadata, lang);
  if (!brief) return result;

  return {
    ...result,
    explanation: result.explanation ? `${brief}\n\n${result.explanation}` : brief,
  };
}

export function buildTelegramPublicMetadataBrief(
  metadata: TelegramPublicMetadata,
  lang: Lang,
): string | null {
  switch (metadata.status) {
    case "found":
      return foundBrief(metadata.username, metadata.chat, lang);
    case "not_found":
      return notFoundBrief(metadata.username, lang);
    case "unavailable":
      return unavailableBrief(metadata.username, lang);
    case "private_invite":
      return privateInviteBrief(lang);
    case "internal_or_private":
      return internalLinkBrief(lang);
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
    return `Telegram @${username} bo'yicha ochiq ma'lumot qaytardi: ${label}${titlePart}${accessPart}. Bu xavfsizlik kafolati emas: menga akkaunt yoshi, yashirin shikoyatlar va spam tarixi ko'rinmaydi. Kod, karta, pul, APK yoki bosim bo'lsa, xavf oshadi.`;
  }
  if (lang === "en") {
    return `Telegram returned public data for @${username}: ${label}${titlePart}${accessPart}. This is not a safety guarantee: I cannot see account age, hidden reports, or spam history. Risk depends on requests for codes, cards, money, APKs, or pressure.`;
  }
  return `Telegram вернул публичные данные для @${username}: ${label}${titlePart}${accessPart}. Это не гарантия безопасности: мне недоступны возраст аккаунта, скрытые жалобы и spam-история. Риск зависит от просьб про код, карту, деньги, APK или давления.`;
}

function notFoundBrief(username: string, lang: Lang): string {
  if (lang === "uz") {
    return `@${username} bo'yicha ochiq Telegram ma'lumotlarini ololmadim. Bu scam isboti emas: profil yopiq, o'zgartirilgan yoki botga ko'rinmas bo'lishi mumkin. Xabar/skrin yuboring: kod, pul, karta, APK yoki havola so'ralganmi?`;
  }
  if (lang === "en") {
    return `I could not retrieve public Telegram data for @${username}. This is not proof of a scam: the profile may be private, renamed, or unavailable to the bot. Send the message/screenshot showing any code, money, card, APK, or link request.`;
  }
  return `Не удалось получить публичные данные @${username} через Telegram. Это не доказательство скама: профиль может быть приватным, переименованным или недоступным боту. Пришлите текст/скрин, где просят код, деньги, карту, APK или ссылку.`;
}

function unavailableBrief(username: string, lang: Lang): string {
  if (lang === "uz") {
    return `Hozir @${username} bo'yicha Telegram metama'lumotlarini so'rash imkoni bo'lmadi. API xatosi o'zi xavf belgisi emas. Ko'rinib turgan xabar/skrin yoki aniq so'rovni yuboring.`;
  }
  if (lang === "en") {
    return `I could not request Telegram metadata for @${username} right now. An API error alone is not a risk signal. Send the visible message, screenshot, or exact request for context.`;
  }
  return `Сейчас не удалось запросить Telegram-метаданные @${username}. Сама ошибка API не означает риск. Пришлите видимое сообщение, скриншот или точную просьбу для проверки.`;
}

function privateInviteBrief(lang: Lang): string {
  if (lang === "uz") {
    return "Bu yopiq chat/kanalga invite-havola. Men uning ichini Telegram Bot API orqali ko'ra olmayman. Faqat ko'rinib turgan matnni baholayman: yutuq, kafolatlangan daromad, to'lov, kod yoki karta so'ralsa, ehtiyot bo'ling.";
  }
  if (lang === "en") {
    return "This is an invite link to a closed chat/channel. I cannot inspect its contents through the Telegram Bot API. I can only assess visible text: be careful if it promises winnings, guaranteed profit, payment access, codes, or card data.";
  }
  return "Это invite-ссылка в закрытый чат/канал. Я не могу видеть его содержимое через Telegram Bot API. Оцениваю только видимый текст: опаснее, если обещают выигрыш/доход, просят оплату, код или карту.";
}

function internalLinkBrief(lang: Lang): string {
  if (lang === "uz") {
    return "Bu Telegram ichki yoki yopiq havolasiga o'xshaydi. Men yopiq chat ma'lumotlarini ko'ra olmayman. Tekshiruv uchun xabar matni, skrinshot yoki aniq so'rovni yuboring.";
  }
  if (lang === "en") {
    return "This looks like an internal or private Telegram link. I cannot see closed-chat data. Send the message text, screenshot, or exact request for a better check.";
  }
  return "Это похоже на внутреннюю или закрытую Telegram-ссылку. Я не вижу данные закрытого чата. Для точной проверки пришлите текст сообщения, скриншот или конкретную просьбу.";
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
