import { useEffect, useRef, useState } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Menu, X } from "lucide-react";
import { PersonArmsSpread } from "@phosphor-icons/react";
import { requestA11yPanel } from "@/lib/a11y-panel-bus";
import { useLang } from "@/lib/lang-context";
import { t, type Lang } from "@/lib/i18n";

const LANGS: readonly Lang[] = ["ru", "uz", "en"];

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
    <button type="button" onClick={onClick} aria-label={label} className="vp-back">
      <ArrowLeft aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function LanguageToggle({ className }: { className: string }) {
  const { lang, setLang } = useLang();
  return (
    <div
      className={className}
      role="group"
      aria-label={{ ru: "Выбор языка", uz: "Tilni tanlash", en: "Choose language" }[lang]}
    >
      {LANGS.map((code) => (
        <button key={code} type="button" aria-pressed={lang === code} onClick={() => setLang(code)}>
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function CheckPill({ isHomepage, onClick }: { isHomepage: boolean; onClick: () => void }) {
  const { lang } = useLang();
  const label = { ru: "Проверить", uz: "Tekshirish", en: "Check" }[lang];
  const content = (
    <>
      <span className="vp-pill-dot vp-pill-dot--arrow" aria-hidden="true">
        <ArrowRight />
      </span>
      {label}
    </>
  );
  return isHomepage ? (
    <a href="#checker" className="vp-pill vp-pill--dark vp-pill--small" onClick={onClick}>
      {content}
    </a>
  ) : (
    <Link to="/check" className="vp-pill vp-pill--dark vp-pill--small" onClick={onClick}>
      {content}
    </Link>
  );
}

export function Header() {
  const { lang } = useLang();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHomepage = pathname === "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // The menu sits before its button in the DOM: move focus into it on open,
  // and let Esc close it and return to the button.
  useEffect(() => {
    if (!menuOpen) return;
    navRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const homeLinks = [
    { href: "#how", label: { ru: "Как работает", uz: "Qanday ishlaydi", en: "How it works" } },
    { href: "#help", label: { ru: "Срочная помощь", uz: "Shoshilinch yordam", en: "Urgent help" } },
    { href: "#official", label: { ru: "Номера", uz: "Raqamlar", en: "Numbers" } },
    { href: "#faq", label: { ru: "Вопросы", uz: "Savollar", en: "FAQ" } },
  ];
  const pageLinks = [
    { to: "/check", label: t("nav_check", lang) },
    { to: "/scam-trends", label: { ru: "Схемы", uz: "Sxemalar", en: "Trends" }[lang] },
    {
      to: "/official-numbers",
      label: { ru: "Официальные номера", uz: "Rasmiy raqamlar", en: "Official numbers" }[lang],
    },
    {
      to: "/emergency",
      label: { ru: "Срочная помощь", uz: "Shoshilinch yordam", en: "Urgent help" }[lang],
    },
    { to: "/report", label: t("nav_report", lang) },
  ] as const;

  // Viper-style wordmark; the link keeps the full brand name for screen readers.
  const brand = (
    <span aria-hidden="true">
      Ishonch<b>*</b>
    </span>
  );

  return (
    <>
      <div className="vp-topbar" aria-hidden="true" />
      <header className="vp-header">
        <div className="vp-shell vp-header-inner">
          <BackButton />
          {isHomepage ? (
            <a href="#top" className="vp-brand" aria-label={t("brand", lang)} onClick={closeMenu}>
              {brand}
            </a>
          ) : (
            <Link to="/" className="vp-brand" aria-label={t("brand", lang)} onClick={closeMenu}>
              {brand}
            </Link>
          )}
          <nav
            ref={navRef}
            className={`vp-nav${menuOpen ? " is-open" : ""}`}
            aria-label={
              { ru: "Основная навигация", uz: "Asosiy navigatsiya", en: "Main navigation" }[lang]
            }
          >
            {isHomepage
              ? homeLinks.map((link, index) => (
                  <a key={link.href} href={link.href} onClick={closeMenu}>
                    {link.label[lang]}
                    <sup>{String(index + 1).padStart(2, "0")}</sup>
                  </a>
                ))
              : pageLinks.map((link) => (
                  <Link key={link.to} to={link.to} onClick={closeMenu}>
                    {link.label}
                  </Link>
                ))}
            {/* Phones/tablets: the accessibility panel opens from the menu, so no
                floating button covers the text. */}
            <button
              type="button"
              className="vp-menu-a11y"
              onClick={() => {
                closeMenu();
                requestA11yPanel();
              }}
            >
              <PersonArmsSpread weight="bold" aria-hidden="true" />
              {{ ru: "Доступность", uz: "Maxsus imkoniyatlar", en: "Accessibility" }[lang]}
            </button>
          </nav>
          <div className="vp-header-actions">
            <LanguageToggle className="vp-langs" />
            <CheckPill isHomepage={isHomepage} onClick={closeMenu} />
            <button
              ref={menuButtonRef}
              type="button"
              className="vp-menu-button"
              aria-label={
                menuOpen
                  ? { ru: "Закрыть меню", uz: "Menyuni yopish", en: "Close menu" }[lang]
                  : { ru: "Открыть меню", uz: "Menyuni ochish", en: "Open menu" }[lang]
              }
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

export function Footer() {
  const { lang } = useLang();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHomepage = pathname === "/";
  const links = [
    { to: "/check", label: t("nav_check", lang) },
    {
      to: "/emergency",
      label: { ru: "Срочная помощь", uz: "Shoshilinch yordam", en: "Urgent help" }[lang],
    },
    {
      to: "/official-numbers",
      label: { ru: "Официальные номера", uz: "Rasmiy raqamlar", en: "Official numbers" }[lang],
    },
    { to: "/scam-trends", label: { ru: "Схемы", uz: "Sxemalar", en: "Trends" }[lang] },
    { to: "/report", label: t("nav_report", lang) },
    { to: "/appeal", label: t("nav_appeal", lang) },
    { to: "/privacy", label: t("nav_privacy", lang) },
    {
      to: "/embed",
      label: { ru: "Виджет для сайтов", uz: "Saytlar uchun vidjet", en: "Site widget" }[lang],
    },
  ] as const;
  const copy = {
    ru: {
      title: ["Проверяйте до того, ", "как поверить."],
      text: "Бесплатная проверка на мошенников для Узбекистана. Без регистрации, на русском, узбекском и английском.",
      cta: "Проверить риск",
      city: "Ташкент, Узбекистан",
    },
    uz: {
      title: ["Ishonishdan oldin ", "tekshiring."],
      text: "O‘zbekiston uchun firibgarlikka bepul tekshiruv. Ro‘yxatdan o‘tmasdan, rus, o‘zbek va ingliz tillarida.",
      cta: "Xavfni tekshirish",
      city: "Toshkent, O‘zbekiston",
    },
    en: {
      title: ["Check before ", "you trust."],
      text: "A free scam checker for Uzbekistan. No signup, in Russian, Uzbek and English.",
      cta: "Check the risk",
      city: "Tashkent, Uzbekistan",
    },
  }[lang];
  const ctaContent = (
    <>
      <span className="vp-pill-dot vp-pill-dot--arrow" aria-hidden="true">
        <ArrowRight />
      </span>
      {copy.cta}
    </>
  );

  return (
    <footer className="vp-footer">
      <div className="vp-shell">
        <div className="vp-footer-top">
          <div>
            <h2>
              {copy.title[0]}
              <span>{copy.title[1]}</span>
            </h2>
            <p>{copy.text}</p>
            {isHomepage ? (
              <a href="#checker" className="vp-pill vp-pill--dark">
                {ctaContent}
              </a>
            ) : (
              <Link to="/check" className="vp-pill vp-pill--dark">
                {ctaContent}
              </Link>
            )}
          </div>
          <nav
            className="vp-footer-nav"
            aria-label={
              { ru: "Навигация в подвале", uz: "Pastki navigatsiya", en: "Footer navigation" }[lang]
            }
          >
            {links.map((link, index) => (
              <Link key={link.to} to={link.to}>
                <span>{String(index + 1).padStart(2, "0")}/</span>
                {link.label}
                <ArrowRight aria-hidden="true" />
              </Link>
            ))}
          </nav>
        </div>
        <p className="vp-wordmark" aria-hidden="true">
          Ishonch<span>*</span>
        </p>
        <div className="vp-footer-bottom">
          <span>© 2026 {t("brand", lang)}</span>
          <span>{copy.city}</span>
        </div>
      </div>
    </footer>
  );
}
