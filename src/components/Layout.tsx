import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLang } from "@/lib/lang-context";
import { t } from "@/lib/i18n";

export function Header() {
  const { lang } = useLang();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#E2E0D8] bg-background/70 backdrop-blur-2xl apex-stripes">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 text-foreground group">
          <span className="relative grid h-7 w-7 place-items-center rounded-[4px] bg-[#0B0B0F] text-white transition-transform group-hover:scale-[1.04]">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>
          <span className="font-display text-[15px] font-extrabold tracking-tight">{t("brand", lang)}</span>
          <span className="hidden sm:inline-flex ml-2 items-center gap-1.5 px-2 py-0.5 rounded-[3px] border border-[#E2E0D8] bg-white/60 apex-mono">
            <span className="h-1 w-1 rounded-full bg-emerald-500" />
            V1.0
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 apex-mono">
          <Link to="/check" className="hover:text-[#18181B] transition-colors">{t("nav_check", lang)}</Link>
          <Link to="/report" className="hover:text-[#18181B] transition-colors">{t("nav_report", lang)}</Link>
          <Link to="/emergency" className="hover:text-[#18181B] transition-colors">{t("nav_emergency", lang)}</Link>
          <Link to="/privacy" className="hover:text-[#18181B] transition-colors">{t("nav_privacy", lang)}</Link>
        </nav>
        <LanguageSwitcher />
      </div>
    </header>
  );
}

export function Footer() {
  const { lang } = useLang();
  return (
    <footer className="border-t border-[#E2E0D8] mt-16 apex-stripes">
      <div className="container mx-auto px-4 sm:px-6 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 apex-mono">
        <div className="flex items-center gap-2 text-[#18181B]">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{t("brand", lang)} — {t("footer_made", lang)}</span>
        </div>
        <div className="flex gap-6">
          <Link to="/privacy" className="hover:text-[#18181B] transition-colors">{t("nav_privacy", lang)}</Link>
          <Link to="/emergency" className="hover:text-[#18181B] transition-colors">{t("nav_emergency", lang)}</Link>
        </div>
      </div>
    </footer>
  );
}
