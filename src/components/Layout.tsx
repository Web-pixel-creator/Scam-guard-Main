import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLang } from "@/lib/lang-context";
import { t } from "@/lib/i18n";

function BackButton() {
  const { lang } = useLang();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/") return null;
  const label = { ru: "Назад", uz: "Orqaga", en: "Back" }[lang];
  const onClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      router.navigate({ to: "/" });
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-[6px] border border-[#E2E0D8] bg-white/70 text-[12.5px] font-semibold text-[#18181B] hover:border-[#F97316] hover:text-[#C2410C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316] transition-colors"
    >
      <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export function Header() {
  const { lang } = useLang();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#E2E0D8] bg-background/70 backdrop-blur-2xl apex-stripes">
      <div className="container mx-auto flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <BackButton />
          <Link to="/" className="flex items-center gap-2.5 text-foreground group min-w-0">
            <span className="relative grid h-7 w-7 place-items-center rounded-[4px] bg-[#0B0B0F] text-white transition-transform group-hover:scale-[1.04]">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
            <span className="font-display text-[15px] font-extrabold tracking-tight truncate">
              {t("brand", lang)}
            </span>
            <span className="hidden sm:inline-flex ml-2 items-center gap-1.5 px-2 py-0.5 rounded-[3px] border border-[#E2E0D8] bg-white/60 apex-mono">
              <span className="h-1 w-1 rounded-full bg-emerald-500" />
              V1.0
            </span>
          </Link>
        </div>
        <nav className="hidden md:flex items-center gap-1 apex-mono">
          <Link to="/check" className="nav-link">
            {t("nav_check", lang)}
          </Link>
          <Link to="/report" className="nav-link">
            {t("nav_report", lang)}
          </Link>
          <Link to="/emergency" className="nav-link">
            {t("nav_emergency", lang)}
          </Link>
          <Link to="/official-numbers" className="nav-link">
            {{ ru: "Номера", uz: "Raqamlar", en: "Numbers" }[lang]}
          </Link>
          <Link to="/scam-trends" className="nav-link">
            {{ ru: "Схемы", uz: "Sxemalar", en: "Trends" }[lang]}
          </Link>
          <Link to="/privacy" className="nav-link">
            {t("nav_privacy", lang)}
          </Link>
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
          <span>
            {t("brand", lang)} — {t("footer_made", lang)}
          </span>
        </div>
        <div className="flex gap-6">
          <Link to="/privacy" className="hover:text-[#18181B] transition-colors">
            {t("nav_privacy", lang)}
          </Link>
          <Link to="/emergency" className="hover:text-[#18181B] transition-colors">
            {t("nav_emergency", lang)}
          </Link>
          <Link to="/official-numbers" className="hover:text-[#18181B] transition-colors">
            {{ ru: "Номера", uz: "Raqamlar", en: "Numbers" }[lang]}
          </Link>
          <Link to="/scam-trends" className="hover:text-[#18181B] transition-colors">
            {{ ru: "Схемы", uz: "Sxemalar", en: "Trends" }[lang]}
          </Link>
        </div>
      </div>
    </footer>
  );
}
