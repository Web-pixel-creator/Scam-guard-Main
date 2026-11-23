import type { Lang } from "./i18n";

// The visitor's language must be known while the server renders: a value kept
// only in localStorage made UZ/EN visitors see Russian until hydration and then
// re-laid out the page. The cookie is written only when the visitor picks a
// language; without it the server follows the browser's language list.
export const LANG_COOKIE = "ig_lang";
export const LANGS: readonly Lang[] = ["ru", "uz", "en"];
export const DEFAULT_LANG: Lang = "ru";
const LANG_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

/** Reads `ig_lang` from a Cookie header or `document.cookie`. */
export function langFromCookieHeader(header: string | null | undefined): Lang | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0 || part.slice(0, eq).trim() !== LANG_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    return isLang(value) ? value : null;
  }
  return null;
}

/**
 * First supported language in the visitor's preference order
 * (`uz-UZ,uz;q=0.9,ru;q=0.8` -> uz). Regions and scripts are ignored, so
 * `uz-Cyrl` still selects the Uzbek interface.
 */
export function langFromAcceptLanguage(header: string | null | undefined): Lang | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((entry, index) => {
      const [tag = "", ...params] = entry.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return {
        primary: tag.trim().toLowerCase().split("-")[0],
        weight: Number.isFinite(weight) ? weight : 0,
        index,
      };
    })
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (const entry of ranked) if (isLang(entry.primary)) return entry.primary;
  return null;
}

/** An explicit choice wins over the browser's languages; Russian otherwise. */
export function resolveLang(input: {
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Lang {
  const chosen = isLang(input.cookie) ? input.cookie : null;
  return chosen ?? langFromAcceptLanguage(input.acceptLanguage) ?? DEFAULT_LANG;
}

export function langCookie(lang: Lang, secure: boolean): string {
  return `${LANG_COOKIE}=${lang}; Path=/; Max-Age=${LANG_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${
    secure ? "; Secure" : ""
  }`;
}
