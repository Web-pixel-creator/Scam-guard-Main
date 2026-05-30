import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLang } from "@/lib/lang-context";
import { t } from "@/lib/i18n";

export function Header() {
  const { lang } = useLang();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5 text-foreground">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_20px_-8px_rgba(59,130,246,0.6)]">
            <ShieldCheck className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <span className="font-display text-base font-extrabold tracking-tight">{t("brand", lang)}</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-foreground/60">
          <Link to="/check" className="hover:text-foreground transition-colors">{t("nav_check", lang)}</Link>
          <Link to="/report" className="hover:text-foreground transition-colors">{t("nav_report", lang)}</Link>
          <Link to="/emergency" className="hover:text-foreground transition-colors">{t("nav_emergency", lang)}</Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">{t("nav_privacy", lang)}</Link>
        </nav>
        <LanguageSwitcher />
      </div>
    </header>
  );
}

export function Footer() {
  const { lang } = useLang();
  return (
    <footer className="border-t border-border mt-24">
      <div className="container mx-auto px-6 py-10 text-[12px] text-foreground/50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>{t("brand", lang)} — {t("footer_made", lang)}</span>
        </div>
        <div className="flex gap-6">
          <Link to="/privacy" className="hover:text-foreground transition-colors">{t("nav_privacy", lang)}</Link>
          <Link to="/emergency" className="hover:text-foreground transition-colors">{t("nav_emergency", lang)}</Link>
        </div>
      </div>
    </footer>
  );
}
