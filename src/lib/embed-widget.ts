import type { Lang } from "@/lib/i18n";

export const EMBED_WIDGET_PATH = "/embed/check";
export const EMBED_WIDGET_HEIGHT = 560;
export const EMBED_WIDGET_SANDBOX = "allow-scripts allow-forms allow-same-origin allow-popups";

export type EmbedWidgetOptions = {
  lang?: Lang | string | null;
  partner?: string | null;
};

export function normalizeEmbedLang(value: unknown): Lang {
  return value === "uz" || value === "en" || value === "ru" ? value : "ru";
}

export function sanitizePartner(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .trim()
    .replace(/[^\p{L}\p{N}\s._-]/gu, "")
    .replace(/\s+/g, " ")
    .slice(0, 48);
  return cleaned.length > 0 ? cleaned : null;
}

export function buildEmbedWidgetUrl(baseUrl: string, options: EmbedWidgetOptions = {}): string {
  const url = new URL(EMBED_WIDGET_PATH, normalizeBaseUrl(baseUrl));
  url.searchParams.set("lang", normalizeEmbedLang(options.lang));
  const partner = sanitizePartner(options.partner);
  if (partner) url.searchParams.set("partner", partner);
  return url.toString();
}

export function buildEmbedIframeSnippet(baseUrl: string, options: EmbedWidgetOptions = {}): string {
  const src = escapeHtmlAttribute(buildEmbedWidgetUrl(baseUrl, options));
  return [
    `<iframe`,
    `  src="${src}"`,
    `  title="Ishonch Guard scam check"`,
    `  width="100%"`,
    `  height="${EMBED_WIDGET_HEIGHT}"`,
    `  style="border:0;max-width:520px;width:100%;border-radius:8px;overflow:hidden;"`,
    `  loading="lazy"`,
    `  referrerpolicy="strict-origin-when-cross-origin"`,
    `  sandbox="${EMBED_WIDGET_SANDBOX}"`,
    `></iframe>`,
  ].join("\n");
}

function normalizeBaseUrl(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "https://scam-guard-main-production.up.railway.app";
  }
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
