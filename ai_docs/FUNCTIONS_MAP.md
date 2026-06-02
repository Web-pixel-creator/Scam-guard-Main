# Functions Map

Signatures and intent only. See file paths for source.

## Server functions

| Function | File | Auth | Purpose |
|---|---|---|---|
| `checkInput({ input, type?, lang })` | `src/lib/check.functions.ts` | public | Web wrapper around `runCheck`; rate-limited 10/min/IP. |
| `ocrExtract({ image, lang })` | `src/lib/check.functions.ts` | public | Web wrapper around `ocrExtractCore`; screenshot OCR + deterministic redaction. |
| `submitReport({ value, type?, description, scamType?, city?, amountLostUzs?, lang })` | `src/lib/report.functions.ts` | public | Inserts a redacted report and upserts/bumps `entities`. |
| `listReports({ status })` | `src/lib/admin.functions.ts` | admin | Lists reports by status. |
| `listEntities({ status })` | `src/lib/admin.functions.ts` | admin | Lists moderated/known entities. |
| `moderateReport({ reportId, decision, riskLevel })` | `src/lib/admin.functions.ts` | admin | Confirms/rejects a report and syncs entity reputation. |
| `adminStats()` | `src/lib/admin.functions.ts` | admin | Dashboard counts. |

## Risk engine

**`src/lib/risk/detect.ts`**
- `detectInputType(raw) -> InputType`
- `normalizePhone`, `normalizeTelegram`, `normalizeUrl`, `normalize(input, type)`
- `maskForDisplay(value, type)`
- `redactText(s)` masks full cards, inline phones and OTP-like digit runs.

**`src/lib/risk/rules.ts`**
- `ReasonCode` union + weights.
- `evaluateText`, `evaluateUrl`, `evaluatePhone`, `evaluateTelegram`.
- `scoreFromCodes(codes) -> { score, level }`.
- `REASON_LABELS`, `ADVICE` in RU/UZ/EN.

**`src/lib/risk/check-core.ts`**
- `runCheck(params)` is the transport-independent check pipeline.
- `ocrExtractCore(dataUrl, lang, rateLimitKey)` is the transport-independent OCR pipeline.
- Private AI helpers call an OpenAI-compatible Chat Completions provider and degrade to `null`.

**`src/lib/risk/hash.ts`**: `hashIdentifier(value)`.

**`src/lib/risk/rate-limit.ts`**: in-memory sliding-window limiter.

## Telegram

- `src/lib/telegram/webhook.server.ts`: framework-agnostic webhook handler.
- `src/server.ts`: binds `POST /api/telegram/webhook` and `/healthz` before SSR.
- `src/lib/telegram/router.ts`: parses updates and routes commands/content; forwards `callback_query.id` so inline-button spinners are acknowledged.
- `src/lib/telegram/handlers/*`: `/start`, `/check`, `/report`, safety/help, images, contacts, out-of-scope handling.
- `src/lib/telegram/session.server.ts`: Supabase-backed `telegram_sessions` state.
- `src/lib/telegram/api.server.ts`: Telegram Bot API calls.

## Auth and integration

- `requireSupabaseAuth` (`src/integrations/supabase/auth-middleware.ts`) validates Bearer tokens.
- `attachSupabaseAuth` (`src/integrations/supabase/auth-attacher.ts`) attaches the session token client-side.
- `supabase` / `supabaseAdmin`: browser RLS client vs server service-role client.

## DB functions

`has_role(uuid, app_role)`, `handle_new_user_role()`, `get_check_stats()`, `prune_telegram_sessions()`.
