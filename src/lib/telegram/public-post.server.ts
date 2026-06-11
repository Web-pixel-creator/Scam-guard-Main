import type { Lang } from "@/lib/i18n";
import type { RunCheckResult } from "@/lib/risk/check-core";
import { redactText } from "@/lib/risk/detect";
import { checkRateLimit } from "@/lib/risk/rate-limit";
import { extractTelegramPublicTarget } from "@/lib/telegram/public-metadata.server";

export interface TelegramPublicPostTarget {
  username: string;
  postId: string;
}

export interface TelegramPublicPostEvidence {
  target: TelegramPublicPostTarget;
  text: string;
  links: string[];
  checkInput: string;
}

export type PublicPostFetcher = (url: string, init?: RequestInit) => Promise<Response>;

const FETCH_LIMIT = 5;
const FETCH_WINDOW_MS = 60_000;
const FETCH_TIMEOUT_MS = 2500;
const MAX_HTML_CHARS = 1_000_000;
const MAX_TEXT_CHARS = 1400;
const MAX_LINKS = 6;
const MAX_LINK_CHARS = 180;

export function extractTelegramPublicPostTarget(input: string): TelegramPublicPostTarget | null {
  const target = extractTelegramPublicTarget(input);
  if (target.kind !== "public_post") return null;
  return { username: target.username, postId: target.postId };
}

export async function buildTelegramPublicPostCheckEvidence(
  input: string,
  rateLimitKey: string,
  fetcher: PublicPostFetcher = fetch,
): Promise<TelegramPublicPostEvidence | null> {
  const target = extractTelegramPublicPostTarget(input);
  if (!target) return null;

  const rl = checkRateLimit(`tgpost:${rateLimitKey}`, FETCH_LIMIT, FETCH_WINDOW_MS);
  if (!rl.ok) return null;

  return fetchTelegramPublicPost(target, fetcher);
}

export async function fetchTelegramPublicPost(
  target: TelegramPublicPostTarget,
  fetcher: PublicPostFetcher = fetch,
): Promise<TelegramPublicPostEvidence | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetcher(publicPostUrl(target), {
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "IshonchGuardBot/1.0 (+https://scam-guard-main-production.up.railway.app)",
      },
    });

    if (!res.ok) return null;
    const contentLength = Number(res.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_HTML_CHARS) return null;

    const html = await readResponseTextWithLimit(res, MAX_HTML_CHARS);
    if (html === null) return null;
    return parseTelegramPublicPostHtml(html, target);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function parseTelegramPublicPostHtml(
  html: string,
  target: TelegramPublicPostTarget,
): TelegramPublicPostEvidence | null {
  const block = findPostBlock(html, target);
  if (!block) return null;

  const textHtml = extractMessageTextHtml(block);
  const text = clampText(redactText(normalizePlainText(stripHtml(textHtml))));
  const links = extractVisibleLinks(block, target);

  if (!text && links.length === 0) return null;

  const checkInput = [
    `Telegram public post: https://t.me/${target.username}/${target.postId}`,
    text ? `Public post text:\n${text}` : "",
    links.length > 0 ? `Visible post links:\n${links.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { target, text, links, checkInput };
}

export function enrichTelegramPublicPostResult(
  result: RunCheckResult,
  evidence: TelegramPublicPostEvidence | null,
  lang: Lang,
): RunCheckResult {
  if (!evidence) return result;
  const brief = publicPostBrief(evidence, lang);
  return {
    ...result,
    explanation: result.explanation ? `${brief}\n\n${result.explanation}` : brief,
  };
}

function publicPostUrl(target: TelegramPublicPostTarget): string {
  return `https://t.me/s/${target.username}/${target.postId}`;
}

async function readResponseTextWithLimit(res: Response, limit: number): Promise<string | null> {
  if (!res.body) {
    const text = await res.text();
    return text.length > limit ? null : text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        return null;
      }

      text += decoder.decode(value, { stream: true });
      if (text.length > limit) {
        await reader.cancel();
        return null;
      }
    }

    text += decoder.decode();
    return text.length > limit ? null : text;
  } finally {
    reader.releaseLock();
  }
}

function findPostBlock(html: string, target: TelegramPublicPostTarget): string | null {
  const postRe = new RegExp(
    `data-post=["']${escapeRegExp(target.username)}\\/${escapeRegExp(target.postId)}["']`,
    "i",
  );
  const match = postRe.exec(html);
  if (!match) return null;

  const startMarker = '<div class="tgme_widget_message_wrap';
  const start = html.lastIndexOf(startMarker, match.index);
  const safeStart = start >= 0 ? start : match.index;
  const next = html.indexOf(startMarker, match.index + match[0].length);
  const fallbackEnd = html.indexOf("</section>", match.index);
  const end =
    next >= 0 ? next : fallbackEnd >= 0 ? fallbackEnd : Math.min(html.length, safeStart + 80_000);

  return html.slice(safeStart, end);
}

function extractMessageTextHtml(block: string): string {
  const match =
    /<div class=["']tgme_widget_message_text js-message_text["'][^>]*>([\s\S]*?)<\/div>/i.exec(
      block,
    );
  return match?.[1] ?? "";
}

function extractVisibleLinks(block: string, target: TelegramPublicPostTarget): string[] {
  const links = new Set<string>();
  for (const match of block.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
    const href = decodeHtmlEntities(match[1]).trim();
    const normalized = normalizeHref(href);
    if (!normalized || isTelegramSelfLink(normalized, target)) continue;
    links.add(normalized.slice(0, MAX_LINK_CHARS));
    if (links.size >= MAX_LINKS) break;
  }
  return [...links];
}

function normalizeHref(href: string): string | null {
  if (!href || href.startsWith("#") || /^javascript:/i.test(href)) return null;
  if (/^https?:\/\//i.test(href)) return href;
  if (/^(?:t\.me|telegram\.me)\//i.test(href)) return `https://${href}`;
  if (/^\/[a-zA-Z][a-zA-Z0-9_]{3,31}/.test(href)) return `https://t.me${href}`;
  return null;
}

function isTelegramSelfLink(href: string, target: TelegramPublicPostTarget): boolean {
  try {
    const url = new URL(href);
    const host = url.hostname.toLowerCase();
    if (host !== "t.me" && host !== "telegram.me") return false;
    const path = url.pathname.replace(/^\/s\//, "/").toLowerCase();
    return (
      path === `/${target.username.toLowerCase()}` ||
      path === `/${target.username.toLowerCase()}/${target.postId}`
    );
  } catch {
    return false;
  }
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function normalizePlainText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200f\ufeff]/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function clampText(text: string): string {
  return text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS - 1)}…` : text;
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
    const lower = body.toLowerCase();
    if (lower.startsWith("#x")) {
      const code = Number.parseInt(lower.slice(2), 16);
      return isValidCodePoint(code) ? String.fromCodePoint(code) : entity;
    }
    if (lower.startsWith("#")) {
      const code = Number.parseInt(lower.slice(1), 10);
      return isValidCodePoint(code) ? String.fromCodePoint(code) : entity;
    }
    return named[lower] ?? entity;
  });
}

function isValidCodePoint(code: number): boolean {
  return Number.isFinite(code) && code >= 0 && code <= 0x10ffff;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function publicPostBrief(evidence: TelegramPublicPostEvidence, lang: Lang): string {
  const post = `@${evidence.target.username}/${evidence.target.postId}`;
  if (lang === "uz") {
    return `Manba: Telegram ochiq posti ${post}. Men faqat ochiq web-sahifadagi ko'rinadigan matn/havolalarni tekshirdim; yashirin SCAM belgisi, akkaunt yoshi va Telegram shikoyatlari menga ko'rinmaydi.`;
  }
  if (lang === "en") {
    return `Source: public Telegram post ${post}. I checked only visible text/links from the public web page; hidden SCAM labels, account age and Telegram reports are not visible to me.`;
  }
  return `Источник: публичный Telegram-пост ${post}. Я проверил только видимый текст/ссылки с публичной web-страницы; скрытые SCAM-метки, возраст аккаунта и жалобы Telegram мне не видны.`;
}
