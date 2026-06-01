# File Map

Where things live. `src/routeTree.gen.ts` is auto-generated; never edit it by hand.

## Root

| Path | Purpose |
|---|---|
| `package.json` | Scripts: `dev`, `build`, `start`, `preview`, `lint`, `format`, `test`, `test:run`. |
| `vite.config.ts` | TanStack/Vite/Nitro config. Forces Nitro `node-server` preset and `src/server.ts` entry. |
| `Dockerfile`, `.dockerignore` | Multi-stage production image for the Node SSR artifact. |
| `.github/workflows/ci.yml` | GitHub Actions verification: install, typecheck, tests, production build. |
| `railway.toml` | Railway config: Docker builder, `/healthz`, restart policy. |
| `.env.example` | Documented runtime env vars. Real `.env` is local-only and ignored. |
| `bun.lock`, `bunfig.toml` | Bun package manager files. npm also works for scripts. |
| `supabase/config.toml` | Supabase project config. |
| `supabase/migrations/*.sql` | DB schema history. |
| `.kiro/specs/telegram-bot-mvp/` | Kiro requirements/design/tasks for the Telegram bot MVP. |
| `.lovable/project.json` | Historical template marker only; not a production runtime target. |

## `src/` entry points

| Path | Purpose |
|---|---|
| `server.ts` | Node/Nitro server entry. Adds `/healthz`, binds Telegram webhook, then delegates to SSR. |
| `start.ts` | TanStack Start setup: request error middleware and server-function middleware. |
| `router.tsx` | TanStack Router + Query client. |
| `routeTree.gen.ts` | Auto-generated route tree. |
| `styles.css` | Tailwind v4, brand tokens, accessibility modes. |

## `src/routes/`

| File | URL | Notes |
|---|---|---|
| `__root.tsx` | app shell | Providers, Header/Footer, SEO meta, language sync. |
| `index.tsx` | `/` | Main experience and landing content. Large file. |
| `check.tsx` | `/check` | Dedicated check page. |
| `report.tsx` | `/report` | Scam report form. |
| `emergency.tsx` | `/emergency` | First-hours recovery checklist. |
| `privacy.tsx` | `/privacy` | Privacy notice. |
| `login.tsx` | `/login` | Supabase email auth. |
| `admin.tsx` | `/admin` | Moderation dashboard. |

## `src/lib/`

| Path | Purpose |
|---|---|
| `check.functions.ts` | Web server functions wrapping check/OCR core. |
| `report.functions.ts` | Public report server function; redacts descriptions before insert. |
| `admin.functions.ts` | Admin moderation server functions. |
| `risk/check-core.ts` | Transport-independent rules-first check and OCR pipelines. |
| `risk/detect.ts` | Input detection, normalization, masking, redaction. |
| `risk/rules.ts` | Reason codes, weights, regex patterns, scoring, labels, advice. |
| `risk/hash.ts` | Identifier hashing. |
| `risk/rate-limit.ts` | In-memory rate limit. |
| `telegram/*` | Telegram API, router, handlers, webhook and session store. |
| `config.server.ts` | Server-only env helpers read per request. |
| `error-capture.ts`, `error-page.ts`, `lovable-error-reporting.ts` | Error capture/rendering; Lovable name is historical. |

## `src/components/`

`CheckInput`, `RiskResultCard`, `QuickReportForm`, `StatsStrip`, `Layout`, `LanguageSwitcher`, `A11yPanel`, `FancyButton`, `UnicornBackground`; `components/ui/*` are shadcn primitives.

## `src/integrations/supabase/`

Browser client, service-role server client, auth middleware/attacher and generated DB types.
