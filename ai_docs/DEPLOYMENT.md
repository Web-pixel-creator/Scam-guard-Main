# Deployment

## Platform

Built and hosted via **Lovable Cloud** (template `tanstack_start_ts_2026-05-29`). The backend (Supabase: Postgres + Auth) is provisioned by Lovable Cloud. Build uses Vite 7 + Nitro; the default Nitro target in the Lovable config is **Cloudflare** (edge workers).

## Local run

Package manager is **Bun** (lockfile present). npm also works.

```bash
bun install          # or: npm install
bun run dev          # vite dev  → local SSR dev server
bun run build        # vite build (production)
bun run build:dev    # build in development mode
bun run preview      # preview a production build
bun run lint         # eslint
bun run format       # prettier --write .
```

> Do not start the dev server from an automated agent in this environment (long-running). Run it manually.

## Environment variables

Public (in `.env`, prefixed `VITE_`, safe for browser):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (server reads these too)

Server-only **secrets** (injected by Lovable Cloud, NOT in `.env`, never shipped to client):
- `SUPABASE_SERVICE_ROLE_KEY` — service-role client (`client.server.ts`). Bypasses RLS.
- `LOVABLE_API_KEY` — AI gateway. If absent, AI explanation/OCR degrade to `null` gracefully.

On Cloudflare Workers, env binds **per request** — always read `process.env.*` inside a handler/function, never at module top level (see `config.server.ts` notes).

## Database migrations

SQL migrations live in `supabase/migrations/`. Apply via the Supabase workflow / Lovable Cloud. The latest consolidated migration defines the full current schema.

## Telegram bot webhook deployment

The Telegram bot is a **new channel** to the same app. There is no separate
service to deploy — the webhook endpoint is bound at the Worker `fetch` entry
(`src/server.ts`), which intercepts `POST /api/telegram/webhook` ahead of the
SSR/server entry. This TanStack Start (1.168.x) + Nitro v3 build exposes **no
file-based server-route API**, so there is intentionally no
`src/routes/api/telegram/webhook.ts` route file — do not look for one.

Deploy target is **Nitro v3 / Cloudflare** (edge workers) via
`@lovable.dev/vite-tanstack-config`. Follow these steps in order:

### 1. Apply the `telegram_sessions` migration

Apply the SQL migration that creates the bot session table (per-user dialog
state, service-role only) through the Supabase / Lovable Cloud migration
workflow:

```
supabase/migrations/20260531090000_0c3c0c8c-225b-435f-9d6f-f6f8363cb56b.sql
```

It creates `public.telegram_sessions` with RLS enabled and **no**
anon/authenticated policies (server-only access via `supabaseAdmin`). After it
is applied, regenerate `src/integrations/supabase/types.ts` (do not hand-edit).

### 2. Set the bot secrets in the server environment

Set these as **server-only** secrets in the deployment environment (Lovable
Cloud / Cloudflare Worker env). **Never** put them in `.env` committed to the
repo, and **never** prefix them with `VITE_` (that would ship them to the
browser bundle):

- `TELEGRAM_BOT_TOKEN` — Bot API auth token.
- `TELEGRAM_WEBHOOK_SECRET` — value compared against the
  `X-Telegram-Bot-Api-Secret-Token` header on every incoming update.
- `LOVABLE_API_KEY` — AI gateway (optional; the bot/check degrade to no
  explanation if missing).
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service-role,
  server-only).

These are read **per request inside handlers** (`config.server.ts`), as
Cloudflare binds env at request time. The webhook fails closed: if
`TELEGRAM_BOT_TOKEN` or `TELEGRAM_WEBHOOK_SECRET` is missing, it returns `401`
without processing the update (R17.4).

### 3. Register the webhook with Telegram

Run the one-shot admin script once per deployment (or whenever the public URL
or secret changes). It calls the Bot API `setWebhook`, pointing Telegram at
`<public-url>/api/telegram/webhook` and installing the secret token. It reads
the bot token and secret from the environment and **never prints their values**.

The repo has no `tsx`/`ts-node` runner, so run it with `vite-node` (ships with
Vitest, resolves the `@/` path alias via the Vite config). Provide the public
base URL as the first argument or via `PUBLIC_APP_URL`:

```bash
# secrets must be present in the environment (same names as step 2)
PUBLIC_APP_URL=https://your-app.example.com \
  npx vite-node scripts/register-telegram-webhook.ts

# or pass the base URL as the first argument:
npx vite-node scripts/register-telegram-webhook.ts https://your-app.example.com
```

The script builds `<base>/api/telegram/webhook`, requires `https`, and exits
non-zero with a clear message if a secret is missing or Telegram returns
not-ok. `setWebhook` does send the secret token to Telegram over HTTPS — that
is by design; Telegram then echoes it back in the request header so the webhook
can authenticate updates.

### 4. Verify no secrets leak to logs or the client bundle

- Confirm logs around webhook registration and runtime show **only** event
  type / `Input_Type` / `Risk_Level`, never raw user content, identifiers, or
  secret values (R19.1–R19.3). The script and `api.server.ts` log method names
  and HTTP statuses only — no token/secret values.
- Confirm the secrets are **not** present in the client bundle: they live in
  `*.server.ts` modules and are read via `config.server.ts`; none are exposed
  as `VITE_*`. A quick check: grep the built client assets for the secret
  variable names — they must not appear.
- Confirm Telegram delivers updates: send `/start` to the bot and verify a
  reply. A `401` from the endpoint means the `TELEGRAM_WEBHOOK_SECRET` in the
  environment does not match what was registered in step 3.

## Deploy checklist

- [ ] Secrets set in Lovable Cloud (service role + AI key).
- [ ] Migrations applied; `admin_allowlist` seeded with admin email(s) before first admin signup.
- [ ] Verify RLS: anon cannot read `checks`, can only read `confirmed` entities.
- [ ] Confirm AI gateway key works (otherwise explanations are blank but the app still scores).
- [ ] `telegram_sessions` migration applied (Telegram bot session state).
- [ ] Telegram bot secrets set server-side (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`), not in `VITE_*`.
- [ ] Webhook registered via `scripts/register-telegram-webhook.ts`.
- [ ] Verified no secrets in logs or client bundle; `/start` returns a reply.
