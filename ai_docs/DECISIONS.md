# Decisions

> Architecture & product decisions and the reasoning behind them. Append new entries; don't rewrite history.

## D-001 — Consumer-first, Telegram-first (not a 1Lookup clone)
1Lookup is B2B data-validation. Local pain is consumer scams (calls + Telegram + pressure). Build a consumer check/report tool first; keep B2B API as a later revenue path. Model: ScamShield (Singapore).

## D-002 — Rules decide, AI explains
The numeric risk score comes from deterministic weighted reason codes (`rules.ts`), not the LLM. The LLM (Gemini 2.5 Flash via Lovable gateway) only produces the human explanation, and degrades to `null` if unavailable. Keeps results predictable, testable and cheap; avoids hallucinated verdicts.

## D-003 — Privacy by hashing + redaction
Store only hashed identifiers + masked display strings. Redact OTP/card/phone before persistence. Screenshots are OCR'd then discarded. Protects users and limits legal exposure under UZ data law.

## D-004 — Moderation gate before public exposure
Reported entities are public only after an admin confirms (`moderation_status='confirmed'`). Prevents doxxing and weaponized mass-false-reporting.

## D-005 — Allowlist-based admin bootstrap
Originally the first signup became admin; replaced with `admin_allowlist` + DB trigger so admin grants are explicit and safe in production.

## D-006 — Two Supabase clients (RLS vs service-role)
Browser uses the publishable key under RLS; the server uses a service-role client that bypasses RLS for trusted writes/admin reads. Strict separation via `*.server.ts` naming.

## D-007 — Bilingual rule patterns (RU + UZ)
Scam detection regexes include Russian and Uzbek-Latin variants because local scams operate in both languages.

## D-008 — TanStack Start server functions instead of a separate API
No standalone backend service; typed RPC server functions keep the stack single-deployable on Lovable Cloud / Cloudflare edge.
