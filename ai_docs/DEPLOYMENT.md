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

## Deploy checklist

- [ ] Secrets set in Lovable Cloud (service role + AI key).
- [ ] Migrations applied; `admin_allowlist` seeded with admin email(s) before first admin signup.
- [ ] Verify RLS: anon cannot read `checks`, can only read `confirmed` entities.
- [ ] Confirm AI gateway key works (otherwise explanations are blank but the app still scores).
