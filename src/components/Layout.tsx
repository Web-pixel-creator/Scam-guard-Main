import { useState } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Menu, ShieldCheck, X } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { FancyShell } from "./FancyButton";
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
    <button type="button" onClick={onClick} aria-label={label} className="header-back">
      <ArrowLeft aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

export function Header() {
  const { lang } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="site-brand-row">
          <BackButton />
          <Link to="/" className="brand" onClick={closeMenu}>
            <span className="brand-mark">
              <ShieldCheck strokeWidth={2.25} />
            </span>
            <span>{t("brand", lang)}</span>
          </Link>
        </div>
        <nav className={`main-nav${menuOpen ? " is-open" : ""}`} aria-label="Main navigation">
          <Link to="/check" onClick={closeMenu}>
            {t("nav_check", lang)}
          </Link>
          <Link to="/scam-trends" onClick={closeMenu}>
            {{ ru: "Схемы", uz: "Sxemalar", en: "Trends" }[lang]}
          </Link>
          <Link to="/official-numbers" onClick={closeMenu}>
            {{ ru: "Официальные номера", uz: "Rasmiy raqamlar", en: "Official numbers" }[lang]}
          </Link>
          <Link to="/emergency" onClick={closeMenu}>
            {t("nav_emergency", lang)}
          </Link>
          <Link to="/report" onClick={closeMenu}>
            {t("nav_report", lang)}
          </Link>
        </nav>
        <div className="header-actions">
          <LanguageSwitcher />
          <Link to="/check" className="fancy-btn header-cta" onClick={closeMenu}>
            <FancyShell showArrow={false}>{t("nav_check", lang)}</FancyShell>
          </Link>
          <button
            type="button"
            className="menu-button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { lang } = useLang();
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <Link to="/" className="brand footer-brand">
          <span className="brand-mark">
            <ShieldCheck strokeWidth={2.25} />
          </span>
          <span>{t("brand", lang)}</span>
        </Link>
        <h2>
          {
            {
              ru: (
                <>
                  Проверяйте до того,
                  <br />
                  как поверить.
                </>
              ),
              uz: (
                <>
                  Ishonishdan oldin
                  <br />
                  tekshiring.
                </>
              ),
              en: (
                <>
                  Check before
                  <br />
                  you trust.
                </>
              ),
            }[lang]
          }
        </h2>
        <Link to="/check" className="fancy-btn footer-check">
          <FancyShell>
            {{ ru: "Проверить риск", uz: "Xavfni tekshirish", en: "Check risk" }[lang]}
          </FancyShell>
        </Link>
      </div>
      <div className="footer-meta">
        <p>
          {t("brand", lang)} — {t("footer_made", lang)}
          <br />
          {lang === "ru"
            ? "Без регистрации · за секунды · RU / UZ / EN"
            : lang === "uz"
              ? "Ro‘yxatdan o‘tmasdan · soniyalarda · RU / UZ / EN"
              : "No signup · in seconds · RU / UZ / EN"}
        </p>
        <nav>
          <Link to="/privacy">{t("nav_privacy", lang)}</Link>
          <Link to="/emergency">{t("nav_emergency", lang)}</Link>
          <Link to="/appeal">{t("nav_appeal", lang)}</Link>
          <Link to="/official-numbers">
            {{ ru: "Номера", uz: "Raqamlar", en: "Numbers" }[lang]}
          </Link>
          <Link to="/scam-trends">{{ ru: "Схемы", uz: "Sxemalar", en: "Trends" }[lang]}</Link>
          <Link to="/embed">{{ ru: "Виджет", uz: "Vidjet", en: "Widget" }[lang]}</Link>
        </nav>
        <span>© 2026 ISHONCH GUARD · TASHKENT, UZ</span>
      </div>
    </footer>
  );
}
