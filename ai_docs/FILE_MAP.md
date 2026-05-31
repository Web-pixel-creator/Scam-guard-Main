# File Map

> Where things live. Update when structure changes. `routeTree.gen.ts` is auto-generated — never edit by hand.

## Root

| Path | Purpose |
|---|---|
| `package.json` | Scripts (`dev`, `build`, `preview`, `lint`, `format`) + deps. Project name is template default `tanstack_start_ts`. |
| `vite.config.ts` | Thin wrapper over `@lovable.dev/vite-tanstack-config`; redirects server entry to `src/server.ts`. Don't re-add bundled plugins. |
| `components.json` | shadcn/ui config (new-york, css vars, aliases `@/...`). |
| `bun.lock`, `bunfig.toml` | Bun package manager. |
| `.env` | Public Supabase URL + publishable key (VITE_*). Secrets (service role, AI key) are injected by Lovable Cloud, not here. |
| `README.md` | Brand + **color token rules** (orange = us, red = the threat). Read before touching UI colors. |
| `supabase/config.toml` | Supabase project id. |
| `supabase/migrations/*.sql` | DB schema history. See `DATABASE.md`. |
| `.lovable/project.json` | Lovable template marker. |

## `src/` — entry points & app shell

| Path | Purpose |
|---|---|
| `server.ts` | SSR server entry + catastrophic-error normalizer. |
| `start.ts` | `createStart`: request error middleware + global `attachSupabaseAuth` function middleware. |
| `router.tsx` | Builds the TanStack Router + Query client. |
| `routeTree.gen.ts` | **Auto-generated** route tree. |
| `styles.css` | Tailwind v4 + brand CSS variables (color tokens). |

## `src/routes/` — pages (file-based routing)

| File | URL | Notes |
|---|---|---|
| `__root.tsx` | shell | Providers (Lang/Auth/Query), Header/Footer, SEO meta, `LangSync`. |
| `index.tsx` | `/` | Landing + hero check form, stats, capability/example sections (large file). |
| `check.tsx` | `/check` | Dedicated check page. |
| `report.tsx` | `/report` | Scam report form. |
| `emergency.tsx` | `/emergency` | "Already sent code/money?" steps. |
| `privacy.tsx` | `/privacy` | Privacy notice. |
| `login.tsx` | `/login` | Supabase email auth. |
| `admin.tsx` | `/admin` | Moderation dashboard (noindex). |
| `README.md` | — | Routing conventions. |

## `src/lib/` — logic

| Path | Purpose |
|---|---|
| `check.functions.ts` | Server fns `checkInput`, `ocrExtract` + `aiExplain`/`ocrScreenshot` helpers. |
| `report.functions.ts` | Server fn `submitReport` (+ entity upsert). |
| `admin.functions.ts` | Admin server fns: `listReports`, `listEntities`, `moderateReport`, `adminStats`, `assertAdmin`. |
| `risk/detect.ts` | Input detection, normalization, masking, redaction. |
| `risk/rules.ts` | Reason codes, weights, regex patterns, scoring, RU/UZ/EN labels & advice. |
| `risk/hash.ts` | `hashIdentifier` (SHA-256, FNV-1a fallback). |
| `risk/rate-limit.ts` | In-memory sliding-window limiter. |
| `i18n.ts` | `Lang` type, `LANGS`, `t_dict`, `t()`. |
| `lang-context.tsx` / `auth-context.tsx` | React contexts for language + auth/role. |
| `config.server.ts` | Server-only config helper (per-request env reads). |
| `error-capture.ts`, `error-page.ts`, `lovable-error-reporting.ts` | Error capture/rendering. |
| `api/example.functions.ts` | Template sample (not core). |

## `src/components/`

App components: `CheckInput`, `RiskResultCard`, `QuickReportForm`, `StatsStrip`, `Layout` (Header/Footer), `LanguageSwitcher`, `A11yPanel`, `FancyButton`, `UnicornBackground`. `components/ui/*` = shadcn primitives. `hooks/use-mobile.tsx` = breakpoint hook.

## `src/integrations/supabase/`

`client.ts` (browser, RLS), `client.server.ts` (service-role, server-only), `auth-middleware.ts` (`requireSupabaseAuth`), `auth-attacher.ts` (`attachSupabaseAuth`), `types.ts` (generated DB types). Files marked "automatically generated — do not edit."
