# File Map

Where things live. `src/routeTree.gen.ts` is auto-generated; never edit it by hand.

## Root

| Path                                  | Purpose                                                                                                                                                                                                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                        | Scripts: `dev`, `build`, `start`, `preview`, `lint`, `format`, `test`, `test:run`.                                                                                                                                                                                    |
| `vite.config.ts`                      | TanStack/Vite/Nitro config. Forces Nitro `node-server` preset and `src/server.ts` entry.                                                                                                                                                                              |
| `Dockerfile`, `.dockerignore`         | Multi-stage production image for the Node SSR artifact.                                                                                                                                                                                                               |
| `.github/workflows/ci.yml`            | GitHub Actions verification: install, typecheck, tests, production build.                                                                                                                                                                                             |
| `railway.toml`                        | Railway config: Docker builder, `/healthz`, restart policy.                                                                                                                                                                                                           |
| `.env.example`                        | Documented runtime env vars. Real `.env` is local-only and ignored.                                                                                                                                                                                                   |
| `bun.lock`, `bunfig.toml`             | Bun package manager files. npm also works for scripts.                                                                                                                                                                                                                |
| `supabase/config.toml`                | Supabase project config.                                                                                                                                                                                                                                              |
| `supabase/migrations/*.sql`           | DB schema history.                                                                                                                                                                                                                                                    |
| `scripts/prod-smoke.ts`               | One-shot production smoke test for the public app, Telegram webhook, Telegram pending state and AI provider; can optionally send one live Telegram synthetic update.                                                                                                  |
| `scripts/prod-monitor.ts`             | Recurring production monitor for public app, `/healthz`, Telegram webhook state and AI provider; can send sanitized Telegram alerts to an operator chat.                                                                                                              |
| `scripts/prod-family-shield-smoke.ts` | One-shot production smoke test for Family Shield invite/accept/notify/revoke storage paths using synthetic Telegram ids and no secret output.                                                                                                                         |
| `.kiro/specs/telegram-bot-mvp/`       | Kiro requirements/design/tasks for the Telegram bot MVP.                                                                                                                                                                                                              |
| `.kiro/specs/*/`                      | Feature specs for Telegram UX, brand impersonation, meta intent, image/link intelligence, inline check, menu/result polish, emergency copilot, response compression, phone directory, webhook dedup, shared rate limits, research-feed and website trust/trends work. |
| `.lovable/project.json`               | Historical template marker only; not a production runtime target.                                                                                                                                                                                                     |

## `src/` entry points

| Path               | Purpose                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `server.ts`        | Node/Nitro server entry. Adds `/healthz`, binds Telegram webhook, then delegates to SSR. |
| `start.ts`         | TanStack Start setup: request error middleware and server-function middleware.           |
| `router.tsx`       | TanStack Router + Query client.                                                          |
| `routeTree.gen.ts` | Auto-generated route tree.                                                               |
| `styles.css`       | Tailwind v4, brand tokens, accessibility modes.                                          |

## `src/routes/`

| File                   | URL                 | Notes                                                                                               |
| ---------------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| `__root.tsx`           | app shell           | Providers, Header/Footer, SEO meta, language sync.                                                  |
| `index.tsx`            | `/`                 | Main experience and landing content. Large file.                                                    |
| `check.tsx`            | `/check`            | Dedicated check page.                                                                               |
| `report.tsx`           | `/report`           | Scam report form.                                                                                   |
| `emergency.tsx`        | `/emergency`        | First-hours recovery checklist.                                                                     |
| `official-numbers.tsx` | `/official-numbers` | Public verified-contact directory for safe callback numbers and official Telegram/email contacts.   |
| `scam-trends.tsx`      | `/scam-trends`      | Public non-personal map of current scam tactics, hooks, goals, safe steps and reason-code coverage. |
| `privacy.tsx`          | `/privacy`          | Privacy notice.                                                                                     |
| `login.tsx`            | `/login`            | Supabase email auth.                                                                                |
| `admin.tsx`            | `/admin`            | Moderation dashboard.                                                                               |

## `src/lib/`

| Path                                 | Purpose                                                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check.functions.ts`                 | Web server functions wrapping check/OCR core plus service-role-backed public stats.                                                                                          |
| `report.functions.ts`                | Public report server function; redacts descriptions before insert and keeps situation-only reports out of entity reputation.                                                 |
| `report-boundary.ts`                 | Shared incident-only report marker/helpers used by report submission and admin moderation.                                                                                   |
| `admin.functions.ts`                 | Admin moderation server functions; skips entity sync for situation-only reports.                                                                                             |
| `risk/check-core.ts`                 | Transport-independent rules-first check, OCR and structured image-analysis pipelines.                                                                                        |
| `risk/image-intelligence.ts`         | Structured Telegram image evidence: visual category, QR purpose, risk hints, safe input.                                                                                     |
| `risk/detect.ts`                     | Input detection, normalization, masking, redaction.                                                                                                                          |
| `risk/rules.ts`                      | Reason codes, weights, regex patterns, scoring, labels, advice.                                                                                                              |
| `risk/phone-intelligence.ts`         | Honest phone-number passport: country/calling code, Uzbekistan prefix/operator hint, official-directory status and verified-contact lookalike hints without owner inference. |
| `risk/phone-reputation.ts`           | Confirmed, moderated phone reputation summary built from `entities`; no owner/carrier/hidden-label claims.                                                                   |
| `risk/hash.ts`                       | Identifier hashing.                                                                                                                                                          |
| `risk/rate-limit.ts`                 | In-memory sliding-window rate limit used as local/test fallback.                                                                                                             |
| `risk/shared-rate-limit.server.ts`   | Service-role shared rate limit backed by Supabase `claim_rate_limit()`, persisting only HMAC-hashed bucket keys and falling back locally.                                    |
| `risk/verified-contacts.ts`          | Official Uzbekistan contacts (banks, telecom, gov, payments). Lookup for pipeline.                                                                                           |
| `trust/official-directory.ts`        | Static public-directory helpers: stats, search/filter, contact actions and source-link detection for verified contacts.                                                      |
| `trust/scheme-trends.ts`             | Static public scheme-trend helpers: non-personal tactic entries, stats, category/search filters and severity ordering.                                                       |
| `meta-intent.ts`                     | Deterministic classifier for questions to the bot itself, including Telegram-account visibility limits.                                                                      |
| `telegram/emergency.ts`              | Dynamic emergency checklist builder, panic menus and Emergency Copilot follow-up routing.                                                                                    |
| `telegram/router.ts`                 | Telegram update router (dispatch, parseCommand, decideRoute).                                                                                                                |
| `telegram/handlers/index.ts`         | Handler aggregator — wires commands/check/report/misc into the router.                                                                                                       |
| `telegram/handlers/commands.ts`      | /start, /lang, /help, /safety, /emergency, /panic, /check, /report.                                                                                                          |
| `telegram/handlers/check.ts`         | Text/image/contact check pipeline handlers.                                                                                                                                  |
| `telegram/handlers/inline.ts`        | Telegram inline-mode handler for `@scamguard_bot <query>`; returns compact rules-only non-persistent result articles.                                                        |
| `telegram/handlers/report.ts`        | Multi-step /report scenario.                                                                                                                                                 |
| `telegram/handlers/misc.ts`          | Callbacks (language, report, check_another, emergency, panic) + out-of-scope.                                                                                                |
| `telegram/webhook.server.ts`         | Framework-agnostic webhook handler (token-first, fail-closed, `update_id` dedup).                                                                                            |
| `telegram/webhook-dedup.server.ts`   | Service-role shared Telegram `update_id` claim helper backed by `telegram_webhook_updates`; fails open to local dedup if storage is unavailable.                             |
| `telegram/api.server.ts`             | Telegram Bot API helpers (sendMessage, getFile, escapeMarkdownV2, etc.).                                                                                                     |
| `telegram/public-metadata.server.ts` | Best-effort Telegram username/link enrichment: target extraction, public `getChat`, private-link limitations, visible signals and next steps.                                |
| `telegram/public-post.server.ts`     | Best-effort public Telegram post web fetch/parser for `t.me/<channel>/<post>` links; extracts visible text, links, buttons and previews.                                     |
| `telegram/reputation.server.ts`      | Privacy-safe Telegram reputation helpers: hashed target observation, moderated report sync, source/confidence user-facing brief.                                             |
| `telegram/family-shield.server.ts`   | Family Shield trusted-contact helpers: hashed invites, active-link guard, invite TTL, redacted alerts, cooldowns and opt-out.                                                |
| `telegram/forward-context.ts`        | Reply-only context for public forwarded Telegram channel/group sources; sanitized title/username, no scoring or persistence impact.                                          |
| `telegram/image-fallback.ts`         | Unreadable-image triage callbacks/keyboards for gift, casino, wallet, bank/code and menu/QR scenarios.                                                                       |
| `telegram/session.server.ts`         | Session store (telegram_sessions table via supabaseAdmin).                                                                                                                   |
| `telegram/bot-i18n.ts`               | Bot-specific trilingual strings (ru/uz/en).                                                                                                                                  |
| `telegram/format.ts`                 | Telegram response formatter (MarkdownV2, keyboards, verified badge).                                                                                                         |
| `config.server.ts`                   | Server-only env helpers read per request.                                                                                                                                    |
| `error-capture.ts`, `error-page.ts`  | Error capture/rendering.                                                                                                                                                     |

## `src/components/`

`CheckInput`, `RiskResultCard`, `QuickReportForm`, `StatsStrip`, `HomeTrustSurface`, `HomeSchemeTrends`, `OfficialContactsDirectory`, `SchemeTrendsPanel`, `Layout`, `LanguageSwitcher`, `A11yPanel`, `FancyButton`, `UnicornBackground`; `components/ui/*` are shadcn primitives.

## `src/integrations/supabase/`

Browser client, service-role server client, auth middleware/attacher and generated DB types.

## `scripts/`

Production smoke scripts:

- `prod-smoke.ts`: public app, `/healthz`, webhook auth, Telegram pending state and AI provider.
- `prod-monitor.ts`: recurring public app/webhook/AI monitor with optional sanitized Telegram alerting.
- `prod-family-shield-smoke.ts`: synthetic Family Shield invite/accept/notify/revoke/cleanup.
- `prod-security-smoke.ts`: RLS/security checks for sensitive tables, shared rate-limit buckets and maintenance/stat/rate-limit RPC access.
