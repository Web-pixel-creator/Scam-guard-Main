# API

There is **no standalone REST API**. The app uses TanStack Start **server functions** (`createServerFn`) called as typed RPC from React (via `useServerFn` + TanStack Query). Validation is zod; transport is POST.

## Server functions (current "API")

| RPC | Auth | Input (zod) | Returns |
|---|---|---|---|
| `checkInput` | public | `{ input: 1–2000, type?, lang: ru\|uz\|en }` | `{ type, display, level, score, reasons[], explanation, knownReports }` |
| `ocrExtract` | public | `{ image: dataURL ≤6MB, lang }` | `{ text }` |
| `submitReport` | public | `{ value ≤500, type?, description 5–5000, scamType?, city?, amountLostUzs?, lang }` | `{ ok }` or `{ ok:false, error }` |
| `listReports` | admin | `{ status: new\|confirmed\|rejected\|all }` | report rows (≤200) |
| `listEntities` | admin | `{ status }` | entity rows (≤200) |
| `moderateReport` | admin | `{ reportId uuid, decision: confirmed\|rejected, riskLevel }` | `{ ok }` |
| `adminStats` | admin | — | `{ reports_new, reports_confirmed, entities_confirmed, checks_total }` |

Errors: thrown `Error`; rate-limit throws with `status=429` + `retryAfter`. Admin fns throw `Unauthorized` / `Forbidden: admin only`.

## Auth flow

Browser session token (Supabase) is attached by the `attachSupabaseAuth` client middleware on every server-fn call. Admin fns validate it server-side (`requireSupabaseAuth`) and additionally check the `admin` role in `user_roles`.

## Public DB RPC

- `get_check_stats()` — Supabase RPC returning aggregate counts for the homepage counter (`StatsStrip`).

## External integrations

- **Lovable AI Gateway** — `POST https://ai.gateway.lovable.dev/v1/chat/completions`, model `google/gemini-2.5-flash`, Bearer `LOVABLE_API_KEY`. Used by `aiExplain` (text) and `ocrScreenshot` (vision). Both fail gracefully to `null` if the key is missing or the call errors.
- **Supabase** — Postgres/Auth/RLS over the project URL in `.env`.

## Future B2B API (planned, not built)

Per the product plan, a later monetization layer could expose `POST /v1/check/{phone|telegram|url}`, `/v1/risk-score`, `/v1/report` with API-key auth for banks/fintech/marketplaces. See `OPEN_TASKS.md`. Not implemented yet.
