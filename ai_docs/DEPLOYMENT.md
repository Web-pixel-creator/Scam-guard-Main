# Deployment

## Platform

Self-hosted **Node SSR** server. The app is built with Vite 7 + Nitro v3 using
the **`node-server`** preset, which emits a standalone HTTP server at
`dist/server/index.mjs` (listens on `$PORT`, default 3000). It runs anywhere
Node 22+ runs — Docker on a VPS, Railway, Render, Fly.io, etc. There is **no
dependency on Lovable Cloud or Cloudflare** at runtime. (Lovable was used only
to author the initial UI design.)

The backend datastore is **Supabase** (Postgres + Auth) — a standalone Supabase
project you control; provision it directly via the Supabase dashboard/CLI.

Override the Nitro preset at build time with `NITRO_PRESET=<preset>` if you ever
target a different platform (e.g. `vercel`, `netlify`, `cloudflare-module`).

## Local run

Package manager is **Bun** (lockfile present). npm also works.

```bash
bun install          # or: npm install
bun run dev          # vite dev  → local SSR dev server
bun run build        # vite build (production)  → dist/ (client + Nitro server)
bun run start        # node dist/server/index.mjs  → run the production server
bun run preview      # vite preview (Nitro preview)
bun run lint         # eslint
bun run format       # prettier --write .
bun run test:run     # vitest run (full suite)
```

> Do not start the dev server from an automated agent in this environment (long-running). Run it manually.

## Docker

A two-stage `Dockerfile` is included (build → slim runtime). It runs the Nitro
`node-server` bundle as the non-root `node` user.

```bash
docker build -t scam-guard .
docker run --rm -p 3000:3000 --env-file .env.production scam-guard
```

Provide the server-only secrets (below) at runtime via `--env-file` or your
platform's secret manager — never bake them into the image.

## Railway (first deploy target)

Railway builds straight from the repo `Dockerfile` and injects `$PORT` at
runtime, which the Nitro node-server already honours. Config-as-code lives in
`railway.toml` (Dockerfile builder + healthcheck on `/healthz` + restart policy).

1. Create a project from the GitHub repo (`New Project → Deploy from GitHub`),
   pointing at the deploy branch. Railway auto-detects `Dockerfile` and
   `railway.toml`.
2. Add the service variables (Railway dashboard → service → Variables) — the
   same names listed under **Environment variables** below. At minimum:
   `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `VITE_SUPABASE_PROJECT_ID`, `HASH_PEPPER_SECRET`, `TELEGRAM_BOT_TOKEN`,
   `TELEGRAM_WEBHOOK_SECRET`, and optionally `OPENAI_API_KEY` / `OPENAI_MODEL`
   / `OPENAI_BASE_URL` / `OPENAI_TRANSCRIBE_MODEL` /
   `GEMINI_TTS_API_KEY` / `OPENAI_TTS_API_KEY` /
   `EMBED_ALLOWED_FRAME_ANCESTORS`. Do **not** set `PORT` — Railway provides
   it.
3. Deploy. Once a public domain is assigned (service → Settings → Networking →
   Generate Domain), use it as `PUBLIC_APP_URL` for the webhook registration
   step below.

Or via the CLI:

```bash
railway init           # link/create the project
railway up             # build & deploy from the Dockerfile
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
railway variables set HASH_PEPPER_SECRET=...
railway variables set TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=...
```

## Environment variables

Public (in `.env`, prefixed `VITE_`, safe for browser):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (server reads these too)

Server-only **secrets** (set in the host/orchestrator environment, NOT in a
committed `.env`, never shipped to client):

- `SUPABASE_SERVICE_ROLE_KEY` — service-role client (`client.server.ts`). Bypasses RLS.
- `HASH_PEPPER_SECRET` — HMAC pepper for identifier hashes. Required in
  production; without it, identifier checks/reports fail closed.
- `OPENAI_API_KEY` — AI explanation provider (optional, OpenAI-compatible). If
  absent, AI explanation/OCR degrade to `null` gracefully and scoring continues
  by rules.
- `OPENAI_MODEL` — chat model (default `gpt-4o-mini`; must be vision-capable for
  screenshot OCR).
- `OPENAI_BASE_URL` — OpenAI-compatible endpoint (default
  `https://api.openai.com/v1`; point at OpenAI, OpenRouter, Together, a local
  server, etc.).
- `OPENAI_TRANSCRIBE_MODEL` / `OPENAI_AUDIO_MODEL` — optional model override for
  Telegram voice-note transcription. If unset, Gemini-native audio uses
  `OPENAI_MODEL`; OpenAI-compatible audio transcription defaults to
  `gpt-4o-mini-transcribe`.
- `TELEGRAM_AI_EXPLANATION_TIMEOUT_MS` / `TELEGRAM_AI_EXPLANATION_MAX_ATTEMPTS` -
  optional Telegram-only budget for non-critical AI explanations (defaults:
  `2500` ms / `1` attempt). Low-signal username, phone and generic URL
  passports skip AI automatically to keep replies fast and avoid hallucinated
  explanations.
- `GOOGLE_SAFE_BROWSING_KEY` / `GOOGLE_SAFE_BROWSING_API_KEY` - optional Google
  Safe Browsing key for additive URL reputation checks. Matches add
  `external_phishing_url` or `external_malware_url`; local rules remain
  authoritative when the provider is absent or unavailable.
- `URLHAUS_ENABLED=true` or `URL_REPUTATION_PROVIDERS=urlhaus` - optional
  URLhaus checks. `URLHAUS_AUTH_KEY` is optional if the deployment has one.
- `PHISHTANK_API_KEY` - optional PhishTank check key. URL reputation calls use
  only normalized URL tokens and strip credentials, query strings and fragments
  before provider requests.
- `TELEGRAM_IMAGE_ANALYSIS_TIMEOUT_MS` / `TELEGRAM_IMAGE_ANALYSIS_MAX_ATTEMPTS` -
  optional Telegram image-intelligence budget (defaults: `6500` ms / `1`
  attempt). If the provider is slow, the bot falls back to QR/OCR-safe guidance.
- `TELEGRAM_VOICE_TRANSCRIBE_TIMEOUT_MS` - optional Telegram voice STT budget
  (default: `8000` ms). Voice notes still keep the 60 seconds / 2 MB / daily
  per-user caps.
- `GEMINI_TTS_API_KEY` — optional Google AI Studio / Gemini API key for opt-in
  Telegram Voice-out audio tips. When present, Gemini TTS is tried first.
- `GEMINI_TTS_MODEL` / `GEMINI_TTS_VOICE` — optional Gemini speech model and
  voice overrides (defaults: `gemini-3.1-flash-tts-preview` / `Kore`).
- `VOICE_OUT_PRERECORDED_DIR` — optional directory for static Voice-out audio
  files. Defaults to `public/audio/voice-out`. Main SOS voice tips look for
  `panic-{id}-{lang}` in `.ogg`, `.oga`, `.mp3` or `.wav` form, for example
  `panic-4-ru.wav`; static audio is sent before any TTS provider call and does
  not spend the daily TTS budget.
- `OPENAI_TTS_API_KEY` — optional dedicated fallback key for opt-in Telegram
  Voice-out audio tips. Without a TTS provider, the bot keeps the same buttons
  but replies with a short text fallback instead of audio.
- `OPENAI_TTS_BASE_URL` — optional speech endpoint base URL (default
  `https://api.openai.com/v1`). Do not point this at Gemini's
  `generativelanguage.googleapis.com` OpenAI-compatible chat endpoint.
- `OPENAI_TTS_MODEL` / `OPENAI_TTS_VOICE` — optional OpenAI speech model and voice
  overrides (defaults: `gpt-4o-mini-tts` / `alloy`).
- `TTS_PROVIDER` / `VOICE_OUT_TTS_PROVIDER` — optional provider preference
  (`gemini` or `openai`). If unset, Gemini is preferred when configured.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` — Telegram bot (see below).
- `TELEGRAM_BOT_USERNAME` - optional public username used for Family Shield
  invite links; defaults to `scamguard_bot` if unset.
- `TELEGRAM_MODERATION_CHAT_ID` - optional private operator chat for new
  report/appeal moderation alerts. This must be set explicitly; it is not
  inferred from monitor alert settings. Alerts contain only redacted targets,
  high-level fields and an admin link, never raw report text, screenshots,
  OCR, codes, card data, full phone numbers or full URLs.
- `TELEGRAM_QA_CHAT_ID` - dedicated private QA chat for production Telegram
  user-flow smoke scripts (`prod:telegram-live-qa-smoke`,
  `prod:telegram-false-positive-smoke`, `prod:telegram-user-story-smoke`,
  `prod:telegram-voice-out-smoke`). It must not equal
  `TELEGRAM_MODERATION_CHAT_ID`; otherwise ordinary risk cards and test audio
  would be sent to the operator chat.
- `EMBED_ALLOWED_FRAME_ANCESTORS` - optional comma/space-separated HTTPS origins
  allowed to frame `/embed/check`, for example
  `https://partner.example,https://bank.example`. If unset, the embed runtime is
  frameable only by the app itself plus localhost development origins. Query
  parameter `partner` is a display label only and does not grant framing access.

To get the private moderation chat id without third-party bots, create a
private Telegram group, add `@scamguard_bot`, then send `/chatid` in that group.
Copy the returned `Chat ID` value into `TELEGRAM_MODERATION_CHAT_ID`.

To verify the private moderation chat after adding `TELEGRAM_MODERATION_CHAT_ID`
and adding the bot to that chat, run:

```powershell
railway run npm run moderation:smoke
```

The smoke test sends a clearly marked non-user test alert. It does not send
real report text, screenshots, OCR, codes, card data, phone numbers or URLs.
To verify the high-signal research moderation wording as well, run:

```powershell
railway run npm run moderation:smoke -- --research
```

The research smoke uses only public scheme-trend metadata and reason-code ids.

For live Telegram user-flow smoke tests, set `TELEGRAM_QA_CHAT_ID` to the
existing main/test chat where ordinary bot replies are acceptable. Create a
separate private QA group only if you do not already have such a chat. Do not
reuse the moderation chat id for QA traffic.

Before release, apply migration
`20260629153000_entities_report_count_confirmed_only.sql` so public
`entities.report_count` values are backfilled to moderated confirmed report
counts only. Also apply
`20260629163000_public_impact_counters_confirmed_reports.sql` so public
report/loss impact counters include confirmed reports only. Before broad embed
distribution, apply `20260702063847_embed_origin_analytics_v1.sql` so
`/embed/check` usage telemetry is stored in the RLS-protected
`embed_origin_events` table with no raw input or full referrer URLs.

Runtime env (Node server): `PORT` (default 3000) and `HOST` (default 0.0.0.0).
Leave `TRUST_PROXY_IP_HEADERS` unset/false unless the deployment sits behind a
trusted edge proxy that overwrites or strips spoofed forwarding headers. Enabling
it without that proxy-chain proof lets clients partition public check/report/
appeal rate-limit buckets by sending fake IP headers. If it must be enabled,
set `TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED=true` only after that edge behavior is
verified; `prod:security-smoke` fails when the trust opt-in lacks this proof
flag.

Env is read **per request inside handlers** (`config.server.ts`), never at
module top level — this keeps the secret reads correct across runtimes.

## Database migrations

SQL migrations live in `supabase/migrations/`. Apply them to your Supabase
project via the Supabase CLI (`supabase db push`) or the dashboard SQL editor.
The latest consolidated migration defines the full current schema.

Recommended CLI flow:

```bash
supabase migration list --linked
supabase db push --linked --include-all --dry-run
supabase db push --linked --include-all --yes
```

After DB/RLS migrations, run:

```bash
railway run npm run prod:security-smoke
```

After adding or rotating `GEMINI_TTS_API_KEY` or `OPENAI_TTS_API_KEY`, verify
the Voice-out provider without printing secrets:

```bash
railway run npm run tts:smoke
```

Retention cleanup runs through Supabase/Postgres Cron job
`ishonch_prune_app_retention_daily` at `17 20 * * *` (daily 20:17 UTC). The job
executes `select private.prune_app_retention();` and deletes only rows eligible
under the documented retention windows. After changing retention SQL, verify the
job still exists and then run `prod:security-smoke`.

Shared public rate limits are stored in `rate_limit_buckets` through the
service-role-only `claim_rate_limit()` RPC. `HASH_PEPPER_SECRET` is required in
production so raw IPs, Telegram ids and other rate-limit keys are HMAC-hashed
before persistence. If Supabase or the pepper is missing in local/test
environments, the app falls back to the in-memory limiter.
Public web rate-limit identity ignores proxy IP headers by default. Set
`TRUST_PROXY_IP_HEADERS=true` only after confirming the edge proxy overwrites
`CF-Connecting-IP`, `X-Real-IP` and `X-Forwarded-For`, then set
`TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED=true` so `prod:security-smoke` records the
review.

Telegram voice STT is cost-capped in the app before provider calls: maximum
60 seconds / 2 MB per voice note, 5 STT calls per Telegram user per 24 hours,
and a short-lived in-memory cache for repeated Telegram `file_unique_id` values.
The cache stores only the redacted transcript, never raw audio.

Telegram text/image/voice handlers emit sanitized `telegram_timing` records for
slow stages. By default, only stages at or above
`TELEGRAM_TIMING_LOG_THRESHOLD_MS` are logged (`1000` ms default). Set
`TELEGRAM_TIMING_LOGS=1` only during short investigations to log every stage.
These records must stay metadata-only: event name, duration, result type,
risk level, reason count, file size/duration and similar non-content fields.
Do not log raw transcripts, links, phone numbers, usernames, OCR text or QR
payloads.

Latency defaults are conservative for Telegram UX: AI explanations use
`TELEGRAM_AI_EXPLANATION_TIMEOUT_MS=2500`, image intelligence uses
`TELEGRAM_IMAGE_ANALYSIS_TIMEOUT_MS=6500`, and voice STT uses
`TELEGRAM_VOICE_TRANSCRIBE_TIMEOUT_MS=8000`. Raise these only if quality matters
more than responsiveness for a specific production incident.

## Production monitor / alerting

For recurring checks, use the lightweight production monitor. It checks the
public homepage, `/healthz`, Telegram webhook auth, Bot API `getMe`, Telegram
`getWebhookInfo` (`url`, pending updates and recent errors), and the configured
AI provider. It exits non-zero on hard failures and does not print secrets.

```bash
railway run npm run monitor:prod -- https://your-app.example.com
```

Useful environment variables:

- `PUBLIC_APP_URL` - optional fallback instead of passing the URL argument.
- `MONITOR_LABEL` - label in console/alerts, for example `production`.
- `MONITOR_TIMEOUT_MS` - per-check timeout, default `8000`.
- `MONITOR_MAX_PENDING_UPDATES` - allowed Telegram pending update count, default
  `0`.
- `MONITOR_STALE_TELEGRAM_ERROR_MS` - how long a Telegram last-error can remain
  before it is ignored as stale, default `900000` (15 minutes).
- `MONITOR_REQUIRE_SECRET_CHECKS=true` - fail if Telegram bot/webhook secrets are
  missing. Use this for private schedulers such as Railway; keep it unset for
  public GitHub cron until all secrets are configured there.
- `MONITOR_FAIL_ON_WARN=true` - make warnings fail the command.

Optional Telegram alerting:

```powershell
$env:MONITOR_ALERT_CHAT_ID = "<admin-chat-id>"
railway run npm run monitor:prod -- https://your-app.example.com
```

`MONITOR_ALERT_CHAT_ID` enables alerts. The script uses `TELEGRAM_BOT_TOKEN` by
default for delivery, or `MONITOR_ALERT_BOT_TOKEN` if you want a separate
operations bot. Set `MONITOR_ALERT_ON_WARN=true` if provider quota warnings
should also send alerts. Alert messages include only check names and sanitized
details; they do not include tokens, webhook secrets, chat ids, user content or
Supabase keys.

Operator triage steps live in `ai_docs/ON_CALL_RUNBOOK.md`. Keep that runbook
up to date when monitor checks, alert routing or production recovery commands
change.

The repository also includes `.github/workflows/prod-monitor.yml`, which runs
the monitor on a 30-minute GitHub Actions schedule. By default it always checks
the public app and `/healthz`; secret-backed checks become active after these
GitHub repository secrets are added:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- optional `OPENAI_BASE_URL`
- optional `OPENAI_MODEL`
- optional `MONITOR_ALERT_CHAT_ID`
- optional `MONITOR_ALERT_BOT_TOKEN`

## Telegram bot webhook deployment

The Telegram bot is a **new channel** to the same app. There is no separate
service to deploy — the webhook endpoint is bound at the server `fetch` entry
(`src/server.ts`), which intercepts `POST /api/telegram/webhook` ahead of the
SSR/server entry. This TanStack Start (1.168.x) + Nitro v3 build exposes **no
file-based server-route API**, so there is intentionally no
`src/routes/api/telegram/webhook.ts` route file — do not look for one.

Once the Node server is deployed behind a public HTTPS URL, follow these steps
in order:

### 1. Apply database migrations

Apply pending SQL migrations to your Supabase project. At minimum the Telegram
bot requires `telegram_sessions`; newer deployments also include Family Shield,
retention cleanup and security-definer hardening migrations.
Telegram chat-scoped session hardening stores its boundary inside existing
`telegram_sessions.scenario_data`, so it does not require an additional SQL
migration. After deploy, any old active/contextual session row without a
matching `chatScope` is reset on the user's next update.

```bash
supabase db push --linked --include-all --yes
```

After migrations that change table/function shapes, regenerate
`src/integrations/supabase/types.ts` when the project workflow needs fresh DB
types (do not hand-edit that file).

### 2. Set the bot secrets in the server environment

Set these as **server-only** secrets in the deployment environment (host env
vars / your orchestrator's secret manager / Docker `--env-file`). **Never** put
them in a `.env` committed to the repo, and **never** prefix them with `VITE_`
(that would ship them to the browser bundle):

- `TELEGRAM_BOT_TOKEN` — Bot API auth token.
- `TELEGRAM_WEBHOOK_SECRET` — value compared against the
  `X-Telegram-Bot-Api-Secret-Token` header on every incoming update.
- `TELEGRAM_BOT_USERNAME` - optional public username for deep links such as
  Family Shield invites. Set it without `@`; defaults to `scamguard_bot`.
- `OPENAI_API_KEY` — AI explanation provider (optional, OpenAI-compatible; the
  bot/check degrade to no explanation if missing). Optionally `OPENAI_MODEL` /
  `OPENAI_BASE_URL`.
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service-role,
  server-only).
- `HASH_PEPPER_SECRET` — required for HMAC identifier hashing.

These are read **per request inside handlers** (`config.server.ts`). The
webhook fails closed: if `TELEGRAM_BOT_TOKEN` or `TELEGRAM_WEBHOOK_SECRET` is
missing, it returns `401` without processing the update (R17.4).

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

### 4. Enable Telegram inline mode

The code can answer `inline_query` updates, but Telegram requires inline mode
to be enabled for the bot in BotFather:

1. Open BotFather.
2. Run `/setinline`.
3. Choose `@scamguard_bot`.
4. Set a short placeholder such as `Введите номер, ссылку или текст для проверки`.

After that, users can type `@scamguard_bot <number/link/text>` in any Telegram
chat and insert a compact risk card. Inline previews are rules-only and
non-persistent.

### 5. Verify no secrets leak to logs or the client bundle

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

### 6. Run the production smoke script

After every Railway deploy or important env change, run the smoke script from a
shell that has the production variables available. It checks the public app,
`/healthz`, Telegram webhook auth, Telegram pending errors and the configured AI
provider. It never prints secret values.

```bash
railway run npm run prod:smoke -- https://your-app.example.com
```

After Family Shield migrations or related bot secret changes, also run the
dedicated Family Shield smoke. It creates and revokes a synthetic relationship,
verifies service-role DB access, and checks the safe notification failure path
without printing tokens, invite URLs or chat ids.

```bash
railway run npm run prod:family-smoke
```

After DB/RLS/security migrations, run the dedicated security smoke. It verifies
anon cannot read/write sensitive tables or execute maintenance/stat/rate-limit
RPCs, while service-role can read required operational tables, including
`embed_origin_events`, and claim a shared rate-limit bucket.
For service-role-only tables that are fully hidden from anon PostgREST schema,
`PGRST205` is an accepted deny result; the paired service-role count still
proves the table exists.

```bash
railway run npm run prod:security-smoke
```

If the AI check fails with `status=429` on a Gemini/OpenAI-compatible endpoint,
the app should still degrade to rules-only scoring, but production AI
explanations/OCR will be unreliable until the provider quota is restored. Treat
that as an operational issue: enable billing/credits for the provider, reduce
manual probes, or configure an `OPENAI_FALLBACK_*` provider. If fallback env is
present, the app tries it immediately after the primary provider fails.

To also send one synthetic high-risk text through the latest Telegram session
(this sends a real bot reply to that latest chat), add:

```bash
railway run npx vite-node scripts/prod-smoke.ts https://your-app.example.com --live-telegram
```

## Deploy checklist

- [ ] CI is green (`.github/workflows/ci.yml`: type-check · tests · build).
- [ ] Build succeeds (`npm run build`) and `npm run start` boots on `$PORT`.
- [ ] Liveness probe responds: `GET /healthz` → `200 ok` (used by `railway.toml`).
- [ ] Server-only secrets set in the host environment (Supabase service role + `HASH_PEPPER_SECRET` + optional AI key), not in `VITE_*`.
- [ ] Migrations applied to the Supabase project; `admin_allowlist` seeded with
      admin email(s), and Supabase email confirmation kept enabled so
      allowlisted admins receive `admin` only after verifying mailbox ownership.
- [ ] Public impact counter migration applied so report/loss totals count only
      `reports.status='confirmed'`.
- [ ] `TRUST_PROXY_IP_HEADERS` is unset/false, or the edge proxy has been
      verified to overwrite spoofed forwarding headers and
      `TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED=true` is set before enabling it.
- [ ] Verify RLS/security smoke passes (`npm run prod:security-smoke`).
- [ ] Confirm the AI provider key works (`OPENAI_API_KEY`); otherwise explanations are blank but the app still scores.
- [ ] `telegram_sessions` migration applied (Telegram bot session state).
- [ ] Telegram bot secrets set server-side (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`), not in `VITE_*`.
- [ ] Partner iframe origins, if any, are set in
      `EMBED_ALLOWED_FRAME_ANCESTORS` before distributing `/embed/check`
      snippets.
- [ ] Embed origin analytics migration is applied before broad partner
      distribution (`embed_origin_events` exists and `prod:security-smoke`
      passes).
- [ ] Webhook registered via `scripts/register-telegram-webhook.ts`.
- [ ] Verified no secrets in logs or client bundle; `/start` returns a reply.
- [ ] Production smoke passes (`npm run prod:smoke -- <public-url>`; optionally
      `--live-telegram` after user approval).
- [ ] Family Shield smoke passes after its migration or related env changes
      (`npm run prod:family-smoke`).
