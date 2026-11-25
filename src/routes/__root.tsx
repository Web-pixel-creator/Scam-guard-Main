import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { LangProvider, useLang } from "@/lib/lang-context";
import type { Lang } from "@/lib/i18n";
import { detectPublicOrigin, detectRequestLang } from "@/lib/lang-request";
import { PAGE_META, SITE_NAME, pageForPath, pageHead, pageUrl } from "@/lib/page-meta";
import { HOME_COPY } from "@/components/home/home-copy";
import display500Cyrillic from "../assets/fonts/inter/inter-display-500-cyrillic.woff2?url";
import display500Latin from "../assets/fonts/inter/inter-display-500-latin.woff2?url";
import display600Cyrillic from "../assets/fonts/inter/inter-display-600-cyrillic.woff2?url";
import display600Latin from "../assets/fonts/inter/inter-display-600-latin.woff2?url";
import { Header, Footer } from "@/components/Layout";
import { A11yPanel } from "@/components/A11yPanel";
import { useEffect } from "react";
import { safeClientErrorReason } from "@/lib/client-error";
import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";
import { Pill, PillButton } from "@/components/viper/kit";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");

// Homepage only: its lead and headline re-wrapped when Inter swapped in (lab
// CLS 0.39). Preloading on every page cost 0.15-0.3 s of first paint on slow
// 4G for little gain there; the metric-matched fallbacks cover the rest.
const HOME_PRELOAD_FONTS = [
  display500Cyrillic,
  display500Latin,
  display600Cyrillic,
  display600Latin,
];

type HeadMatch = { pathname: string };

const ADMIN_PATHS = new Set(["/login", "/admin", "/admin-mfa"]);
function isAdminPath(matches: readonly HeadMatch[]) {
  return ADMIN_PATHS.has(matches[matches.length - 1]?.pathname ?? "");
}

// Title, description, social tags, canonical and robots for the current page
// in the visitor's language; the homepage also gets font preloads and JSON-LD.
function pageHeadFor(matches: readonly HeadMatch[], data?: { lang: Lang; origin: string }) {
  const lang = data?.lang ?? "ru";
  const origin = data?.origin ?? "";
  const path = pageForPath(matches[matches.length - 1]?.pathname ?? "/");
  if (!path) {
    return {
      meta: [
        { title: PAGE_META["/"].ogTitle[lang] },
        { name: "description", content: PAGE_META["/"].description[lang] },
      ],
      links: [],
      scripts: [],
    };
  }
  const head = pageHead(path, { lang, origin });
  if (path !== "/") return { ...head, scripts: [] };
  const home = pageUrl("/", origin);
  return {
    meta: head.meta,
    links: [
      ...head.links,
      ...HOME_PRELOAD_FONTS.map((href) => ({
        rel: "preload",
        href,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous" as const,
      })),
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: SITE_NAME,
              url: home,
              description: PAGE_META["/"].description[lang],
              areaServed: "UZ",
            },
            { "@type": "WebSite", name: SITE_NAME, url: home, inLanguage: ["ru", "uz", "en"] },
            {
              "@type": "FAQPage",
              inLanguage: lang,
              // Same text as the visible FAQ, so structured data never drifts.
              mainEntity: HOME_COPY[lang].faq.items.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            },
          ],
        }),
      },
    ],
  };
}

const FALLBACK_COPY = {
  ru: {
    notFound: "Страница не найдена",
    notFoundText: "Возможно, она была перемещена или никогда не существовала.",
    home: "На главную",
    check: "Проверить сообщение",
    failed: "Не удалось загрузить страницу",
    failedText: "Что-то пошло не так. Попробуйте обновить или вернитесь на главную.",
    retry: "Повторить",
  },
  uz: {
    notFound: "Sahifa topilmadi",
    notFoundText: "Ehtimol, u ko‘chirilgan yoki umuman bo‘lmagan.",
    home: "Bosh sahifa",
    check: "Xabarni tekshirish",
    failed: "Sahifani yuklab bo‘lmadi",
    failedText: "Nimadir xato ketdi. Sahifani yangilang yoki bosh sahifaga qayting.",
    retry: "Qayta urinish",
  },
  en: {
    notFound: "Page not found",
    notFoundText: "It may have moved or never existed.",
    home: "Home",
    check: "Check a message",
    failed: "The page could not load",
    failedText: "Something went wrong. Reload the page or go back home.",
    retry: "Try again",
  },
} as const;

function NotFoundComponent() {
  const copy = FALLBACK_COPY[useLang().lang];
  return (
    <div className="vp-home vp-page">
      <div className="vp-shell">
        <div className="vp-done">
          <span className="vp-done-code">404</span>
          <h1>{copy.notFound}</h1>
          <p>{copy.notFoundText}</p>
          <div className="vp-actions">
            <Pill to="/">{copy.home}</Pill>
            <Pill to="/check" tone="outline">
              {copy.check}
            </Pill>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error("route render failed", safeClientErrorReason(error));
  const router = useRouter();
  // Outside LangProvider (a root failure) this falls back to Russian.
  const copy = FALLBACK_COPY[useLang().lang];

  return (
    <div className="vp-home vp-page">
      <div className="vp-shell">
        <div className="vp-done">
          <span className="vp-done-icon vp-done-icon--alert" aria-hidden="true">
            <WarningCircle weight="fill" />
          </span>
          <h1>{copy.failed}</h1>
          <p>{copy.failedText}</p>
          <div className="vp-actions">
            <PillButton
              icon={<ArrowClockwise weight="bold" />}
              onClick={() => {
                router.invalidate();
                reset();
              }}
            >
              {copy.retry}
            </PillButton>
            <Pill href="/" tone="outline">
              {copy.home}
            </Pill>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Resolved once per document on the server and dehydrated: later client
  // navigations keep it, language switches go through LangProvider.
  loader: () => ({ lang: detectRequestLang(), origin: detectPublicOrigin() }),
  staleTime: Infinity,
  shouldReload: false,
  head: ({ loaderData, matches }) => {
    const page = pageHeadFor(matches, loaderData);
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        ...page.meta,
        { name: "author", content: SITE_NAME },
        { property: "og:site_name", content: SITE_NAME },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        ...page.links,
        { rel: "stylesheet", href: appCss },
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='15' fill='%230B0B0F'/%3E%3Cpath d='M32 10L50 17v13c0 12.2-7.6 21.8-18 24.5C21.6 51.8 14 42.2 14 30V17l18-7z' fill='%23FFFFFF'/%3E%3Cpath d='M23.5 32.5l6 6 12.5-14' fill='none' stroke='%23FF462E' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='49' cy='15' r='4.5' fill='%23FF462E'/%3E%3C/svg%3E",
        },
        // Only the login/admin pages talk to Supabase from the browser (public
        // checks go through server functions), so only they preconnect.
        ...(supabaseUrl && isAdminPath(matches)
          ? [
              {
                rel: "preconnect",
                href: supabaseUrl,
                crossOrigin: "anonymous" as const,
              },
              { rel: "dns-prefetch", href: supabaseUrl },
            ]
          : []),
      ],
      scripts: page.scripts,
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  const { lang } = Route.useLoaderData();
  return (
    <html lang={lang}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { lang } = Route.useLoaderData();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isEmbedCheck = pathname === "/embed/check";
  const isAdmin = pathname === "/admin" || pathname === "/admin-mfa";
  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider initialLang={lang}>
        <LangSync />
        {!isEmbedCheck && <SkipLink />}
        <div className={isEmbedCheck ? "min-h-screen" : "min-h-screen flex flex-col"}>
          {!isEmbedCheck && !isAdmin && <Header />}
          <main id="content" tabIndex={-1} className="flex-1">
            <Outlet />
          </main>
          {!isEmbedCheck && !isAdmin && <Footer />}
        </div>
        {!isEmbedCheck && !isAdmin && <A11yPanel />}
      </LangProvider>
    </QueryClientProvider>
  );
}

// First Tab stop on every page: jumps past the header straight to the content.
function SkipLink() {
  const { lang } = useLang();
  return (
    <a href="#content" className="vp-skip">
      {{ ru: "Перейти к содержанию", uz: "Asosiy qismga o‘tish", en: "Skip to content" }[lang]}
    </a>
  );
}

// Keeps <html lang> in step with a language switch until the root loader
// re-runs; titles and descriptions come from each route's head (page-meta).
function LangSync() {
  const { lang } = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
