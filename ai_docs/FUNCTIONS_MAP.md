# Functions Map

Signatures and intent only. See file paths for source.

## Server functions

| Function                                                                              | File                          | Auth   | Purpose                                                                        |
| ------------------------------------------------------------------------------------- | ----------------------------- | ------ | ------------------------------------------------------------------------------ |
| `checkInput({ input, type?, lang })`                                                  | `src/lib/check.functions.ts`  | public | Web wrapper around `runCheck`; rate-limited 10/min/IP.                         |
| `ocrExtract({ image, lang })`                                                         | `src/lib/check.functions.ts`  | public | Web wrapper around `ocrExtractCore`; screenshot OCR + deterministic redaction. |
| `submitReport({ value, type?, description, scamType?, city?, amountLostUzs?, lang })` | `src/lib/report.functions.ts` | public | Inserts a redacted report and upserts/bumps `entities`.                        |
| `listReports({ status })`                                                             | `src/lib/admin.functions.ts`  | admin  | Lists reports by status.                                                       |
| `listEntities({ status })`                                                            | `src/lib/admin.functions.ts`  | admin  | Lists moderated/known entities.                                                |
| `moderateReport({ reportId, decision, riskLevel })`                                   | `src/lib/admin.functions.ts`  | admin  | Confirms/rejects a report and syncs entity reputation.                         |
| `adminStats()`                                                                        | `src/lib/admin.functions.ts`  | admin  | Dashboard counts.                                                              |

## Risk engine

**`src/lib/risk/detect.ts`**

- `detectInputType(raw) -> InputType`
- `normalizePhone`, `normalizeTelegram`, `normalizeUrl`, `normalize(input, type)`
- `maskForDisplay(value, type)`
- `redactText(s)` masks full cards, inline phones and OTP-like digit runs.

**`src/lib/risk/rules.ts`**

- `ReasonCode` union + weights.
- `evaluateText`, `evaluateUrl`, `evaluatePhone`, `evaluateTelegram`.
- Research-feed text rules include `telegram_account_takeover_phishing`, `dropper_recruitment` and `gambling_prediction_promo`.
- `scoreFromCodes(codes) -> { score, level }`.
- `REASON_LABELS`, `ADVICE` in RU/UZ/EN.

**`src/lib/risk/check-core.ts`**

- `runCheck(params)` is the transport-independent check pipeline.
- `ocrExtractCore(dataUrl, lang, rateLimitKey)` is the transport-independent OCR pipeline.
- `analyzeImageCore(dataUrl, lang, rateLimitKey)` returns structured, redacted image evidence for Telegram photos/screenshots.
- Private AI helpers call an OpenAI-compatible Chat Completions provider and degrade to `null`.

**`src/lib/risk/image-intelligence.ts`**

- `sanitizeImageIntelligence(raw)` parses/clamps model JSON and merges deterministic risk hints.
- `fallbackImageIntelligence(text)` builds deterministic evidence when model JSON is invalid.
- `buildImageCheckInput(evidence)` converts benign/dangerous image evidence into a rules-safe input string.
- `buildImageUserExplanation(evidence, level, lang)` creates the short Telegram explanation for image results.

**`src/lib/risk/hash.ts`**: `hashIdentifier(value)`.

**`src/lib/risk/rate-limit.ts`**: in-memory sliding-window limiter.

## Telegram

- `src/lib/telegram/webhook.server.ts`: framework-agnostic webhook handler.
- `src/server.ts`: binds `POST /api/telegram/webhook` and `/healthz` before SSR.
- `src/lib/telegram/router.ts`: parses updates and routes commands/content; forwards `callback_query.id` so inline-button spinners are acknowledged; analyzes media captions before unsupported-media fallback.
- `src/lib/telegram/handlers/*`: `/start`, `/check`, `/report`, safety/help, images, contacts, out-of-scope handling.
- `src/lib/telegram/session.server.ts`: Supabase-backed `telegram_sessions` state.
- `src/lib/telegram/api.server.ts`: Telegram Bot API calls.
- `src/lib/telegram/emergency.ts`: `buildPanicScenarioText`, panic keyboard builders, live-call callback parser, plus Emergency Copilot helpers: `classifyEmergencyFollowUp`, `buildEmergencyFollowUpText`, `buildEmergencyFollowUpKeyboard`.
- `src/lib/telegram/handlers/check.ts`: routes short post-panic follow-up questions before `runCheck`, handles structured image intelligence for photos, while URL/phone/username/code/long payloads still reach the risk pipeline.
- `src/lib/telegram/handlers/misc.ts`: stores minimal panic context (`lastPanicId`, `lastPanicAt`) and handles `panicctx:*` follow-up callbacks.

## Auth and integration

- `requireSupabaseAuth` (`src/integrations/supabase/auth-middleware.ts`) validates Bearer tokens.
- `attachSupabaseAuth` (`src/integrations/supabase/auth-attacher.ts`) attaches the session token client-side.
- `supabase` / `supabaseAdmin`: browser RLS client vs server service-role client.

## DB functions

`has_role(uuid, app_role)`, `handle_new_user_role()`, `get_check_stats()`, `prune_telegram_sessions()`.
