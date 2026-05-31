# Functions Map

> Signatures and intent only — no full code. See file paths for the source.

## Server functions (RPC endpoints) — `createServerFn`

| Function | File | Auth | Purpose |
|---|---|---|---|
| `checkInput({ input, type?, lang })` | `lib/check.functions.ts` | public | Full risk check pipeline; returns `{ type, display, level, score, reasons, explanation, knownReports }`. Rate-limited 10/min/IP. |
| `ocrExtract({ image, lang })` | `lib/check.functions.ts` | public | Gemini Vision OCR + redaction of a screenshot data URL → `{ text }`. Rate-limited. |
| `submitReport({ value, type?, description, scamType?, city?, amountLostUzs?, lang })` | `lib/report.functions.ts` | public | Insert a report; upsert/bump the matching `entities` row. |
| `listReports({ status })` | `lib/admin.functions.ts` | admin | List reports (≤200) by status. |
| `listEntities({ status })` | `lib/admin.functions.ts` | admin | List entities (≤200). |
| `moderateReport({ reportId, decision, riskLevel })` | `lib/admin.functions.ts` | admin | Confirm/reject a report; sync entity risk + moderation status. |
| `adminStats()` | `lib/admin.functions.ts` | admin | Counts: new/confirmed reports, confirmed entities, total checks. |

Input validation: all use **zod** schemas. Admin fns use `requireSupabaseAuth` middleware + `assertAdmin(userId)`.

## Risk engine — `lib/risk/`

**`detect.ts`**
- `detectInputType(raw) -> InputType` — regex-based (apk/telegram/url/phone/text).
- `normalizePhone / normalizeTelegram / normalizeUrl / normalize(input, type)` — canonical forms (UZ phones → `+998…`).
- `maskForDisplay(value, type)` — display-safe masked string.
- `redactText(s)` — strips card numbers, inline phones, OTP-like digits.

**`rules.ts`**
- `ReasonCode` union + `WEIGHTS` map (e.g. `asks_for_otp`=45, `verified_official`=-100).
- `evaluateText(text)`, `evaluateUrl(url)`, `evaluatePhone(phone)`, `evaluateTelegram(handle)` → `ReasonCode[]`.
- `scoreFromCodes(codes) -> { score, level }` — thresholds: ≥50 high_risk, ≥20 suspicious, >0 unknown; any `verified_official` → safe.
- `REASON_LABELS`, `ADVICE` — RU/UZ/EN strings per code / per risk level.

**`hash.ts`** — `hashIdentifier(value): Promise<string>` (SHA-256 via Web Crypto, FNV-1a fallback).

**`rate-limit.ts`** — `checkRateLimit(key, limit, windowMs) -> { ok, remaining, retryAfterSec }` (in-memory).

## AI helpers (private, in `check.functions.ts`)

- `aiExplain({ lang, type, level, redacted, reasons })` — calls Lovable AI Gateway; returns explanation or `null` (graceful). Needs `LOVABLE_API_KEY`.
- `ocrScreenshot(dataUrl, lang)` — Gemini Vision OCR with a redaction system prompt.

## Auth / integration

- `requireSupabaseAuth` (`auth-middleware.ts`) — validates Bearer token, injects `{ supabase, userId, claims }`.
- `attachSupabaseAuth` (`auth-attacher.ts`) — client middleware attaching the session token to server-fn calls.
- `supabase` / `supabaseAdmin` — lazy Proxy clients (browser RLS vs server service-role).

## Frontend contexts / i18n

- `useLang()` / `LangProvider` — active language state.
- `useAuth()` / `AuthProvider` — `{ user, session, loading, isAdmin, signOut }`.
- `t(key, lang)` — dictionary lookup over `t_dict`.

## DB functions (Postgres) — see `DATABASE.md`

`has_role(uuid, app_role)`, `handle_new_user_role()` (signup trigger, allowlist-based), `get_check_stats()` (public aggregate counts RPC).
