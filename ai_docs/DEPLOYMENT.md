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

Backup/restore, application rollback, credential rotation and Supabase Auth
hardening are release drills, not ad-hoc incident commands. Follow
`ai_docs/RECOVERY_AND_KEY_ROTATION.md`; never test a restore by overwriting the
production project and never rotate `HASH_PEPPER_SECRET` until versioned
dual-read migration support exists.

The public-release canary follows `ai_docs/CANARY_72H.md`. It starts only after
the exact RC deployment and every required migration are fixed; any code,
schema, secret or runtime-config change restarts the 72-hour clock.

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
  would be sent to the operator chat. `prod:telegram-inline-smoke` does not need
  this variable because synthetic inline queries have no chat target and send no
  chat messages.
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
This production `HOST` is separate from the Vite development listener. Local
`npm run dev` binds only `127.0.0.1:8080` by default. Exposing it requires an
explicit trusted-network CLI override such as
`npm run dev -- --host 0.0.0.0`; never make an external bind the committed
default.
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
before persistence. Production and Railway fail closed to rate-limited responses
if shared configuration, hashing, RPC transport or response validation fails;
there is no process-local production allowance. If Supabase or the pepper is
missing in local/test environments, the app uses the bounded 4096-key in-memory
limiter. Release validation must force missing-config, hash exception, RPC error
and invalid-shape cases and confirm `429`/safe failure before any AI/media/fetch,
report or appeal sink work.
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
  missing. The committed GitHub schedule sets this explicitly. Keep it unset
  only for an intentionally limited local/operator run that is allowed to emit
  warning-only skips.
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
the monitor on a 30-minute GitHub Actions schedule. That workflow commits
`MONITOR_REQUIRE_SECRET_CHECKS=true`: a missing Telegram bot token or webhook
secret is a hard failure, not a skipped green check. It always checks the public
app and `/healthz`; secret-backed checks use these GitHub repository secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- optional `OPENAI_BASE_URL`
- optional `OPENAI_MODEL`
- optional `MONITOR_ALERT_CHAT_ID`
- optional `MONITOR_ALERT_BOT_TOKEN`

Before release, prove this policy in a controlled Actions environment: one run
with all required secrets present, one intentionally missing-secret run that
must fail, then a restored-secrets run that must pass. Do not remove a live
production secret merely to create evidence when a protected test environment
or temporary workflow copy can isolate the drill.

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
The session-ordering release additionally requires
`20260711010000_telegram_session_update_sequence.sql`, which adds
`telegram_sessions.last_update_id` and the service-role-only
`save_telegram_session_sequenced` RPC. Do not deploy application instances that
expect this RPC before the migration is applied.
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

The session migration is only the monotonic last-write layer; it is not evidence
that stale-read routing or crash recovery is solved. Production must also have
`20260711050337_telegram_update_lifecycle.sql` and the fenced polling lifecycle.
In a protected environment, force session SELECT and sequencing-RPC failures
and confirm one localized retry warning while logs contain only stage codes.
Also force Bot API `{ok:false}` for a result and verify no guardian or
trusted-contact follow-on action occurs and the previous snapshot is restored.
Before scaling, repeat queued-before-dispatch crash/restart and true out-of-order
two-instance probes; at most one polling leader may be active.

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

Webhook registration (including rollback from polling) sends
`max_connections=1`. Immediately after registration, run the production monitor
and verify the `telegram webhook info` check reports `max_connections=1` and
`concurrency_ok=true`. A higher or missing value is a failed monitor check. This
is conservative webhook delivery configuration; it does not replace the durable
lifecycle/crash-recovery gate.

### 4. Enable Telegram inline mode

The code can answer `inline_query` updates, but Telegram requires inline mode
to be enabled for the bot in BotFather:

1. Open BotFather.
2. Run `/setinline`.
3. Choose `@scamguard_bot`.
4. Set a short placeholder such as `Введите номер, ссылку или текст для проверки`.

After that, users can type `@scamguard_bot <number/link/text>` in any Telegram
chat and insert a compact risk card. Inline previews are rules-only and
non-persistent. The production webhook/non-persistence path can be checked with:

```bash
railway run npm run prod:telegram-inline-smoke -- https://your-app.example.com
```

This uses synthetic inline query ids, so it validates deployed webhook handling
and privacy invariants, not visual Telegram-client rendering.

For real Telegram-client rendering, use `ai_docs/TELEGRAM_INLINE_QA.md`. That
checklist does not require a third chat: use an existing non-moderator place
where test messages are safe, such as the main bot chat if inline results are
available there, Saved Messages, or a private QA chat. Inline preview/insert
must not send messages to the moderator chat; moderator delivery is expected
only for explicit report/appeal flows.

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

To include live HTTP security-header checks for the public app, pass the public
URL. This verifies `/healthz` keeps `X-Frame-Options: DENY` and
`frame-ancestors 'none'`, while `/embed/check` removes `X-Frame-Options` and
uses an explicit `frame-ancestors` policy without broad `https:`.

```bash
railway run npm run prod:security-smoke -- https://your-app.example.com
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

## Telegram polling cutover

Do not delete the webhook first. Deploy in this order:

1. Apply `20260711010000_telegram_session_update_sequence.sql` and
   `20260711050337_telegram_update_lifecycle.sql`.
2. Deploy the application with `TELEGRAM_UPDATE_DELIVERY_MODE=polling` while the
   existing Telegram webhook still owns pending delivery.
3. Call `GET /api/telegram/polling-health` with the
   `X-Telegram-Bot-Api-Secret-Token` header and require HTTP 200.
4. Run `railway run npm run telegram:switch-to-polling`. It refuses cutover
   without an active leader and uses `drop_pending_updates=false`.
5. Set the scheduled monitor's `TELEGRAM_UPDATE_DELIVERY_MODE=polling`; require
   empty `getWebhookInfo.url`, bounded pending updates and polling-health 200.
6. Send one approved `/start`/safe QA update, restart one app instance, and
   verify no update is lost. Keep handlers retry-safe because delivery is
   at-least-once, not exactly-once.

Rollback: set the app to `webhook`, re-register with
`scripts/register-telegram-webhook.ts`, verify `max_connections=1`, and only
then stop polling mode. Never use `drop_pending_updates=true`.

### Polling-compatible Telegram response smoke

After cutover, webhook-injection smoke scripts correctly receive 503 and must
not be used as polling success evidence. Use the production dispatch harness:

```powershell
railway run npm run prod:telegram-polling-dispatch-smoke -- https://your-app.example.com
```

It requires `TELEGRAM_UPDATE_DELIVERY_MODE=polling`, authenticated
`/api/telegram/polling-health` 200 and a dedicated `TELEGRAM_QA_CHAT_ID` that is
not the moderation chat. Synthetic inbound payloads stay in the CLI process; it
does not acquire the polling leader or persist a fake update payload. Real
handler replies are transport-guarded to the QA chat, then deleted. Synthetic
`checks` and `telegram_sessions` rows are deleted and read back as absent.

This validates production configuration, Supabase writes, router/handler copy
and Bot API delivery. It does not validate Telegram's `getUpdates` ingress with
a fake payload; restart/re-election and an approved real-client update cover
that boundary. It also cannot validate Inline visual delivery because Telegram
requires a real client-generated `inline_query_id`.

### Shared rate-limit forced-failure probe

The production image contains a short-lived, network-isolated probe for the
shared limiter. Run it inside the exact Railway deployment:

```powershell
railway ssh node dist/ops/shared-rate-limit-failure-smoke.mjs
```

Require `RATE_LIMIT_FAILURE_SMOKE_FINAL.passed=true`, all six cases
(`missing_config`, `hash_error`, `rpc_error`, `invalid_shape`,
`transport_error`, `consumer_429_before_sinks`) and zero external network
calls, database writes and unexpected sink calls. The probe must remain an
operator-only bundle with no application route. It changes only process-local
synthetic values and restores its WebCrypto override before exit.

The recorded 2026-07-14 run used exact main `00f3b11d`, Railway deployment
`6a8ec5f6-e758-4574-8d15-34eb1206ca43` and image
`sha256:b4cc9f1138528cb698ca5d26cec136b8ab1bf5c2d7ec7e111371c358564741b9`.
All six cases passed; the normal production smoke passed immediately afterward.
See `SHARED_RATE_LIMIT_FAILURE_SMOKE_2026-07-14.md`.

### QR worker runtime corpus and crash probe

The production QR decoder worker resolves three packages at runtime. Verify the
deployed image contains exactly the required decoder dependencies, then run the
isolated corpus/resource profile inside that same Railway runtime:

```powershell
railway ssh node --require=jsqr --require=jpeg-js --require=pngjs -p 1
railway ssh node dist/ops/qr-worker-resource-soak.mjs --duration-minutes=10
```

Require `QR_SOAK_FINAL.passed=true`, zero corpus failures, successful PNG and
JPEG decoding, four accepted queue jobs plus one rejected overflow job, an
observed in-flight worker termination and a successful decode after worker
recreation. Retain only the sanitized CPU/RSS/event-loop/latency counters. The
runner creates its fixtures in memory and makes no Telegram, Supabase, AI or
reputation-provider calls and performs no persistent writes.

#### Recorded production run (2026-07-14)

PR #94 merged as exact main
`f1ddf3490573e667907beed2a027e468298f954d` and deployed as Railway
`09f984bd-1930-4a2b-a04a-4f4ef46e2058`, image
`sha256:abbba9cf1cb45f7ca4e4e6c5a40a6d78d37ef1c5672aab6def2dbba641a038e5`.
The live require probe loaded all three decoder packages. A direct SSH attempt
was transport-interrupted after 360 seconds with 3,002 cases and zero failures;
the required full profile was repeated in a detached `tmux` session.

The uninterrupted detached run completed 600.03 seconds and 5,055 cases with
`QR_SOAK_FINAL.passed=true`: zero failures, PNG 2,087, JPEG 693, queue
accepted/rejected 4/1, forced interruption fail-closed and worker recovery true,
final/max RSS 165.88/234.60 MiB, RSS growth 110.08 MiB, event-loop p99/max
21.04/28.26 ms and decode-latency p95/p99/max 50.09/225.53/279.47 ms. The
session was deleted and the full production smoke passed afterward. Sanitized
evidence is recorded in `ai_docs/QR_WORKER_RESOURCE_SOAK_2026-07-14.md`.

### Polling/resource soak

The production image contains a self-contained, non-secret soak runner. It uses
the real `runTelegramPollingCycle` code path with controlled in-memory updates;
it does not call Telegram, Supabase, a reputation service or the AI provider and
does not persist user data. Run the 60-minute profile inside a Railway runtime:

```powershell
railway ssh node dist/ops/polling-resource-soak.mjs --duration-minutes=60
```

The default profile generates ten updates per second and admits a bounded 3 MiB
PNG/JPEG/WebP fixture every 200 updates. It probes a pre-effect failure,
completion-acknowledgement loss, stale-leader rejection and recovery after loss
of the process-local offset. `SOAK_FINAL.passed` is true only when there are no
lost updates or duplicate modeled outward effects and the queue, RSS growth,
event-loop p99 and update latency stay within their configured bounds.

This is production-shaped resource and failure-model evidence, not by itself a
claim that the operating-system process physically restarted or that Telegram
delivered a real update. That separate gate passed on 2026-07-14: deployment
`c2b98732` replaced the Railway instance, the polling leader was healthy, and an
approved real greeting produced one reply with one stable completed lifecycle
attempt and no retry/failure. See `TELEGRAM_RESTART_QA_2026-07-14.md`. The
delivery guarantee remains at-least-once with bounded idempotent handling,
never exactly-once.

#### Recorded production-shaped run (2026-07-14)

The exact deployed image for main
`868eb18d410f2616030a92b410a36b6bc3784c4e` completed an uninterrupted
60-minute run with `SOAK_FINAL.passed=true`: 36,000/36,000 completed, zero lost
updates, zero duplicate modeled effects, final/max queue 0/35, final/max RSS
98.00/101.41 MiB, event-loop p99 21.84 ms and update-latency p99 2.57 ms. The
sanitized build identity, metrics, isolation boundary and remaining physical
restart/QR-worker gates are recorded in
`ai_docs/POLLING_RESOURCE_SOAK_2026-07-14.md`.

The general `prod:smoke` and synthetic `prod:telegram-inline-smoke` are also
delivery-mode aware. With `TELEGRAM_UPDATE_DELIVERY_MODE=polling`, both require
the authenticated webhook to remain disabled with `503`; `prod:smoke` also
requires an empty webhook URL and polling-leader health `200`. The Inline smoke
then proves only the transport shutdown and absence of `checks`/session side
effects. It is not evidence that Telegram delivered or rendered an Inline
article; use the Desktop/Android/iOS real-client matrix for that claim.

## Deploy checklist

- [ ] CI is green (`.github/workflows/ci.yml`: lint, type-check, full tests,
      build, coverage floors and clean database checks).
- [ ] Security Gates are green (`.github/workflows/security.yml`: CodeQL,
      Gitleaks, release-container High/Critical Trivy scan and CycloneDX SBOM).
      SBOM generation is not a claim of signed provenance; add attestation only
      when the published release artifact has a stable digest/registry owner.
- [ ] Build succeeds (`npm run build`) and `npm run start` boots on `$PORT`.
- [ ] Liveness probe responds: `GET /healthz` → `200 ok` (used by `railway.toml`).
- [ ] Server-only secrets set in the host environment (Supabase service role + `HASH_PEPPER_SECRET` + optional AI key), not in `VITE_*`.
- [ ] Before applying the exact admin-role reconciliation migration, run
      `npm run admin-role:preflight` in the production environment and require
      `staleAdminRoleCount=0` and `missingAdminRoleCount=0`; retain counts only.
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
- [ ] `telegram_sessions` migrations applied, including
      `20260711010000_telegram_session_update_sequence.sql` and its
      service-role-only sequencing RPC.
- [ ] `20260711050337_telegram_update_lifecycle.sql` is applied; production
      service-role RPC and anon-deny smoke checks pass.
- [ ] Polling leader health is 200 before the fail-closed webhook cutover;
      `getWebhookInfo.url` is empty afterward and pending updates were preserved.
- [ ] Restart/completion-before-offset/stale-leader probes pass before horizontal
      application scaling. At most one polling leader may be active.
- [x] The 60-minute `polling-resource-soak` passes in a Railway runtime; retain
      the sanitized `SOAK_FINAL` metrics. Evidence: 2026-07-14, exact main
      `868eb18d`, 36,000/36,000, zero loss/duplicates.
- [x] The deployed image resolves `jsqr`, `jpeg-js` and `pngjs`, and the
      ten-minute `qr-worker-resource-soak` passes in that Railway runtime with
      PNG/JPEG decode, queue-bound and worker termination/recovery evidence.
      Evidence: exact main `f1ddf349`, Railway `09f984bd`, 5,055 cases, zero
      failures.
- [x] Capture a real Railway instance replacement/polling-leader re-election
      with one approved QA update, then prove health, empty pending queue and no
      observed duplicate reply. Evidence: 2026-07-14, main `128e27d2`, Railway
      `c2b98732`, one client-visible reply, one completed attempt, zero retries
      or failures across two stable read-backs.
- [ ] Telegram bot secrets set server-side (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`), not in `VITE_*`.
- [ ] Partner iframe origins, if any, are set in
      `EMBED_ALLOWED_FRAME_ANCESTORS` before distributing `/embed/check`
      snippets.
- [ ] Embed origin analytics migration is applied before broad partner
      distribution (`embed_origin_events` exists and `prod:security-smoke`
      passes).
- [ ] Delivery mode is explicit: polling cutover completed, or webhook registered
      via `scripts/register-telegram-webhook.ts` with `max_connections=1`.
- [ ] Verified no secrets in logs or client bundle; `/start` returns a reply.
- [ ] Production smoke passes (`npm run prod:smoke -- <public-url>`; optionally
      `--live-telegram` after user approval).
- [ ] In polling mode, `prod:telegram-polling-dispatch-smoke` passes and cleanup
      read-back finds no synthetic checks or sessions.
- [ ] Family Shield smoke passes after its migration or related env changes
      (`npm run prod:family-smoke`).
