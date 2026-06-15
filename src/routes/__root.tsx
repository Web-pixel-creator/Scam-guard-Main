import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { LangProvider, useLang } from "@/lib/lang-context";
import { AuthProvider } from "@/lib/auth-context";
import { Header, Footer } from "@/components/Layout";
import { A11yPanel } from "@/components/A11yPanel";
import { useEffect } from "react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Страница не найдена</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Возможно, она была перемещена или никогда не существовала.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Не удалось загрузить страницу
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Что-то пошло не так. Попробуйте обновить или вернитесь на главную.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Повторить
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            На главную
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ishonch Guard — антискам-помощник для Узбекистана" },
      {
        name: "description",
        content:
          "Проверьте номер, Telegram, ссылку или текст сообщения и получите понятный risk score. Защитите себя от телефонных и SMS-мошенников в Узбекистане.",
      },
      { name: "author", content: "Ishonch Guard" },
      { property: "og:title", content: "Ishonch Guard — антискам-помощник для Узбекистана" },
      {
        property: "og:description",
        content: "Распознайте мошенников до того, как потеряете деньги. Бесплатно, на 3 языках.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230f172a'/%3E%3Cpath d='M32 10l18 7v13c0 12-7.5 21.5-18 24-10.5-2.5-18-12-18-24V17l18-7z' fill='%2314b8a6'/%3E%3Cpath d='M24 32l5 5 12-14' fill='none' stroke='white' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E",
      },
      // Preconnect to font CDNs so the display font lands before LCP
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Load display fonts once; CSS variables in styles.css reference these families.
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,500;1,400;1,500&display=swap",
      },
      // Preconnect to backend (Supabase) so the first check request opens TCP/TLS in parallel
      {
        rel: "preconnect",
        href: "https://keacrmbtxccnernxhfhn.supabase.co",
        crossOrigin: "anonymous",
      },
      { rel: "dns-prefetch", href: "https://keacrmbtxccnernxhfhn.supabase.co" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isEmbedCheck = pathname === "/embed/check";
  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <AuthProvider>
          <LangSync />
          <div className={isEmbedCheck ? "min-h-screen" : "min-h-screen flex flex-col"}>
            {!isEmbedCheck && <Header />}
            <main className="flex-1">
              <Outlet />
            </main>
            {!isEmbedCheck && <Footer />}
          </div>
          {!isEmbedCheck && <A11yPanel />}
        </AuthProvider>
      </LangProvider>
    </QueryClientProvider>
  );
}

// Keeps <html lang>, document.title and meta description in sync with the
// active language. SSR sets a default "ru" shell; this runs on the client and
// re-applies on every language change so /, /check, etc. show the right
// language metadata without per-route head() duplication.
function LangSync() {
  const { lang } = useLang();
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    const titles = {
      ru: "Ishonch Guard — проверьте номер, Telegram или ссылку до того, как вас обманут",
      uz: "Ishonch Guard — aldanishdan oldin raqam, Telegram yoki havolani tekshiring",
      en: "Ishonch Guard — check a number, Telegram or link before you get scammed",
    } as const;
    const descs = {
      ru: "Бесплатный антискам-помощник для Узбекистана. Проверьте подозрительный номер, ссылку, Telegram или текст за секунды.",
      uz: "O‘zbekiston uchun bepul antiskam-yordamchi. Shubhali raqam, havola, Telegram yoki matnni soniyalarda tekshiring.",
      en: "Free anti-scam helper for Uzbekistan. Check a suspicious number, link, Telegram or text in seconds.",
    } as const;
    document.title = titles[lang];
    const setMeta = (sel: string, content: string) => {
      const el = document.head.querySelector<HTMLMetaElement>(sel);
      if (el) el.setAttribute("content", content);
    };
    setMeta('meta[name="description"]', descs[lang]);
    setMeta('meta[property="og:title"]', titles[lang]);
    setMeta('meta[property="og:description"]', descs[lang]);
  }, [lang]);
  return null;
}
