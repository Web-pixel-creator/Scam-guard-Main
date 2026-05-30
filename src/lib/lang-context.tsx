import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Lang } from "./i18n";

type Ctx = { lang: Lang; setLang: (l: Lang) => void };
const LangCtx = createContext<Ctx>({ lang: "ru", setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("ru");
  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("ig_lang")) as Lang | null;
    if (saved && ["ru", "uz", "en"].includes(saved)) setLang(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("ig_lang", lang);
  }, [lang]);
  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}
