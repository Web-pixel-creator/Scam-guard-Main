# Architecture

## Stack

- **Framework:** TanStack Start v1 (full-stack React, SSR) + TanStack Router + TanStack Query.
- **UI:** React 19, Tailwind CSS v4, shadcn/ui on Radix UI, lucide icons.
- **Backend:** TanStack server functions (`createServerFn`) plus a Node SSR entry at `src/server.ts`.
- **Runtime:** Nitro v3 `node-server` preset. The production artifact is `dist/server/index.mjs`; it runs on Node 22+ and is Docker/Railway/Render/Fly/VPS-friendly.
- **Data:** Supabase Postgres + Auth + RLS. The project owns its Supabase project; no Lovable Cloud runtime dependency.
- **AI:** Provider-neutral OpenAI-compatible Chat Completions plus optional audio transcription and speech output. `OPENAI_API_KEY` enables explanations, screenshot OCR/image understanding and Telegram voice STT; `OPENAI_MODEL`, `OPENAI_BASE_URL` and `OPENAI_TRANSCRIBE_MODEL` are optional. Opt-in Telegram Voice-out prefers Gemini TTS via `GEMINI_TTS_API_KEY`/`GEMINI_TTS_*`, can fall back to `OPENAI_TTS_API_KEY`/`OPENAI_TTS_*`, and otherwise falls back to text.
- **Tooling:** Vite 7, Bun lockfile, TypeScript, Vitest, ESLint/Prettier.

## Clients and channels

- Web SSR app: `/`, `/check`, `/report`, `/emergency`, `/privacy`, `/login`, `/admin`.
- Telegram bot channel: webhook endpoint `POST /api/telegram/webhook` is intercepted in `src/server.ts` before SSR and delegated to `src/lib/telegram/webhook.server.ts`.
- Planned later: mobile app and B2B API.

## Main data flow: a check

1. User submits text/phone/Telegram/url/apk/payment-like text or screenshot.
2. Web screenshot OCR path: `ocrExtract` -> `ocrExtractCore` -> `ocrScreenshot`; the AI output is passed through deterministic `redactText` before returning.
3. Telegram image path: `analyzeImageCore` returns structured, redacted image evidence (visual category, QR purpose, risk hints, OCR text). The bot builds a safe rules-input from that evidence, runs `runCheck(skipAi=true)`, and uses the image evidence explanation for the reply.
4. Telegram voice/audio path: `handleVoice` accepts short voice notes, native
   audio attachments and audio documents such as `.ogg`/`.m4a` only (60 seconds
   / 2 MB), checks a separate 5/day STT budget, downloads the file only in
   memory, calls `transcribeVoiceCore`, redacts/clips the transcript and then
   either runs the same `runCheck` pipeline or routes obvious already-happened
   emergency statements to the matching `/panic` scenario. Raw audio is never
   stored; repeated Telegram `file_unique_id` values can reuse a short-lived
   in-memory redacted transcript cache to avoid paying for duplicate STT. Slow
   STT calls show only a Telegram activity indicator, not extra chat messages.
5. Short questions to the bot itself go through `meta-intent.ts` before scoring; concrete URLs, phones, usernames, forwarded text, bank/payment terms, APK mentions and long text bypass this and still reach `runCheck`.
6. `runCheck` performs shared rate-limit, input detection, normalization, display masking, `redactText`, rule evaluation, entity lookup, scoring, optional AI explanation and a redacted `checks` insert. AI-authored explanations pass through `ai-output-safety.ts` before return or persistence; unsafe requests for OTP/CVV/PIN/password/card/seed data, APK installs, wallet signing or payments degrade to `null` while the deterministic verdict remains. Negation is evaluated per action clause so a safe warning cannot shield a sibling unsafe command. Repeated unsafe provider outputs for the same rate-limit key open a short cooldown that skips further AI explanation calls for that key but still runs deterministic scoring, advice and persistence. For phone/short-code inputs it also builds an honest `PhoneIntelligencePassport` with country/calling-code, Uzbekistan prefix/operator hints, official-directory status and optional verified-contact lookalike evidence; this is explanatory metadata and does not claim an owner or change scoring. If a phone `entities` row is confirmed, it also returns `PhoneReputationSummary` with Ishonch Guard moderated report count/confidence only. Risk Passport renderers never parse model `explanation` as evidence: optional Telegram sections require a separate typed deterministic evidence object.
7. `RiskResultCard` or Telegram formatting shows level, score, reason labels, advice and optional explanation. If the request came from `/embed/check`, the web server function may also write a service-role-only `embed_origin_events` row containing partner/referrer origin metadata and aggregate result shape only.
8. User reports go through `submitReport`; both the identifier and the free-form description are redacted/hashed as appropriate before persistence.
9. Admins moderate reports in `/admin`; public `entities` reputation changes only after moderation.

## Risk engine

The engine is rules-first. `src/lib/risk/rules.ts` maps matched patterns to weighted `ReasonCode`s. Thresholds: score >= 50 => `high_risk`, score >= 20 => `suspicious`, score > 0 => `unknown`. `verified_official` may produce `safe` only when every sibling reason is informational/protective; it never overrides a risk-classified reason.

Telegram presentation treats the deterministic reason union as a policy input,
not a best-effort copy lookup. `REASON_PROTECTIVE_ACTION` is exhaustive across
all `ReasonCode`s and resolves each code to a typed action or intentional null.
High-risk single/pair reason combinations are regression-tested to always
produce an immediate action; the generic request-for-context fallback is not a
valid high-risk response.

Brand normalization is a two-sided comparison boundary. URL labels are decoded
from IDNA/Punycode, NFKC-normalized, lowercased and converted to classifier-only
visual/transliteration keys; registry aliases receive the same transforms.
Exactly one DNS root dot is removed before official/subdomain checks. Text brand
mentions use Unicode-aware token lookarounds so Cyrillic aliases participate in
the same rules-first scoring path without matching inside longer words.

Moderation spans report/entity state and the Telegram reputation aggregate but
is not a single database transaction. The aggregate sync validates both count
queries and the upsert response and throws `TelegramReputationSyncError` on any
partial failure. Admin callers therefore receive an explicit retryable failure
instead of a false success; stage-only telemetry avoids target/DB-message leaks.

AI never decides the score. It only explains the deterministic verdict or performs OCR extraction. If AI is unavailable, its user-facing explanation fails the safety firewall, or a per-key unsafe-output cooldown is active, the verdict still works with rules-only advice.

## Telegram bot architecture

- Webhook auth fails closed when `TELEGRAM_BOT_TOKEN` or `TELEGRAM_WEBHOOK_SECRET` is missing.
- The secret header is checked before body parsing.
- Invalid bodies after a valid token return 200 so Telegram stops retrying.
- Telegram update delivery has an explicit webhook compatibility mode and a
  durable polling mode. Polling elects one Postgres-fenced leader and calls
  `getUpdates` in batches of 20 by default (the Bot API wrapper clamps an
  explicit limit to `1..100`). Before any lease or handler side effect, the
  complete batch must contain safe-integer, strictly increasing `update_id`
  values at or above the requested offset.
- Stateful message, callback, hybrid and unsupported-shape updates never reorder
  relative to one another. Strict-Inline-only work runs in chunks of at most
  four. While one stateful update is in flight, the poller may read ahead only
  through the following Inline window and only for known different users; an
  Inline update for the same or unknown user waits so session language/order is
  preserved. Each chunk acquires metadata-only lifecycle leases just in time.
  The local offset advances only through the contiguous acknowledged frontier.
  If a later Inline sibling completed after an earlier sibling failed, replay
  observes its DB `completed` state and skips redispatch without jumping the
  failed frontier.
- The lifecycle table and private leader table store operational metadata only,
  never Telegram payload/user content. Session I/O and outbound Telegram effects
  require the current processing fence; polling work also requires the current
  leader fence. Leader renewal has a bounded deadline and a conservative local
  expiry, so an uncertain old process stops new long polls. The current polling
  leader can reclaim an active processing lease left by a superseded leader only
  after a 15-second outbound-effect drain grace; reclaim increments the
  processing fence and attempt count, while current owners and webhook leases
  remain protected. Failure keeps the update retryable.
- Bot session state is stored in Supabase `telegram_sessions`, not memory.
  Same-user work remains serialized inside each process for webhook and every
  stateful update. A polling-scoped execution option bypasses that serializer
  only for strict Inline-only updates, whose handler is stateless. Fenced
  load/save RPCs and monotonic `last_update_id` writes provide defense in depth.
- Images are downloaded in memory, capped at 6 MB, analyzed/OCR'd, and discarded. Local PNG/JPEG QR decode has a stricter 4 MiB/4-megapixel boundary and runs in one isolated worker with a four-job backlog, 900 ms deadline and bounded scan work, so untrusted pixel processing does not block the Node request/event-loop thread. Telegram image scoring uses structured evidence so benign delivery SMS and restaurant/menu QR screenshots do not become high-risk unless a real dangerous request is visible.
- Short Telegram voice notes, native audio attachments and audio documents are
  downloaded in memory, capped at 60 seconds / 2 MB before transcription,
  transcribed through the configured AI provider and discarded. Voice STT has a
  separate 5/day per-user budget and a short-lived in-memory cache keyed by
  Telegram `file_unique_id`; only the redacted transcript is reused or sent into
  `runCheck`. When STT is unavailable the bot gives an actionable fallback
  instead of pretending to understand the audio.
- Telegram `@username` / `t.me/...` checks use a best-effort Bot API enrichment layer after deterministic scoring. It classifies public usernames, public links, private invite links and internal/private links; summarizes public chat type/title/access hints when visible; adds compact visible risk signals and next steps; and explicitly does not infer account age, hidden Telegram scam labels, Telegram report counts or spam history.
- Public forwarded Telegram channel/group source context is presentation-only. The router may pass a sanitized source title/public username into the reply so users understand where a forwarded post came from. When reason codes reveal a concrete tactic, the bot renders a compact mini-brief: source, scheme, attacker goal, safe step and Telegram visibility limit. Source metadata is not appended to `runCheck` input, does not affect score/level/reasons and is not persisted in `checks`.
- Telegram reputation is stored separately in `telegram_reputation_targets` using HMAC-hashed targets and masked display hints. New checks can record first/last seen observations, but user-facing reputation labels are shown only after admin-moderated Ishonch Guard reports or future official sources.
- Public check/report throttling uses a shared Supabase `rate_limit_buckets`
  table via service-role-only `claim_rate_limit()`, with raw rate-limit keys
  HMAC-hashed before persistence. Production/Railway fails closed if shared
  configuration, hashing, RPC transport or response validation fails, so a
  deployment-wide quota cannot silently become one allowance per process.
  Local/test environments use a bounded in-memory fallback with at most 4096
  TTL/LRU-refreshed keys; new identities fail closed at capacity and a bounded
  full expiry scan runs at most once per second.
- Partner iframe usage telemetry uses service-role-only `embed_origin_events`.
  It stores partner, referrer origin/host, language and aggregate result shape,
  not raw checked input, full URLs, paths, query strings, fragments, phone
  numbers, Telegram ids, screenshots or OCR text.

## Auth and roles

Supabase Auth powers browser sessions. Client middleware attaches the bearer token to server-function calls. Admin functions validate the session server-side (`requireSupabaseAuth`) and check `user_roles` via `assertAdmin`.

## Constraints

- Telegram private chats and live calls cannot be silently inspected. The model is user-forward/paste/screenshot.
- Rate limits are shared through Supabase for the current production topology.
  Redis/KV remains a later option only if traffic outgrows Postgres-backed
  buckets.
- Do not reintroduce Lovable Cloud/runtime coupling. Vite/TanStack/Nitro are configured directly in `vite.config.ts`. The development server is loopback-only by default; external access is an explicit operator CLI choice, while the built Nitro production server keeps its separate deployment `HOST`.
