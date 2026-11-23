import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import type { Lang } from "./i18n";
import {
  DEFAULT_LANG,
  LANG_COOKIE,
  isLang,
  langCookie,
  langFromCookieHeader,
} from "./lang-preference";

type Ctx = { lang: Lang; setLang: (l: Lang) => void };
const LangCtx = createContext<Ctx>({ lang: DEFAULT_LANG, setLang: () => {} });

function rememberLang(lang: Lang) {
  document.cookie = langCookie(lang, window.location.protocol === "https:");
}

/** `initialLang` comes from the request (root loader), so SSR and hydration agree. */
export function LangProvider({
  children,
  initialLang = DEFAULT_LANG,
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const router = useRouter();

  useEffect(() => {
    // One-time move of a choice saved before the cookie existed.
    try {
      const legacy = localStorage.getItem(LANG_COOKIE);
      if (legacy === null) return;
      localStorage.removeItem(LANG_COOKIE);
      if (isLang(legacy) && !langFromCookieHeader(document.cookie)) {
        rememberLang(legacy);
        setLangState(legacy);
      }
    } catch {
      // Storage can be blocked; the cookie path still works.
    }
  }, []);

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      rememberLang(next);
      // Root loader reads the new cookie; page titles and <html lang> follow.
      void router.invalidate();
    },
    [router],
  );

  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}
