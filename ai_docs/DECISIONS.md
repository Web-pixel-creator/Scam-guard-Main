# Decisions

Architecture and product decisions. Newest entries can be appended; keep them short.

## D-001 - Consumer-first, Telegram-first

Local pain is consumer scams: calls, SMS, Telegram pressure and fake payment flows. Build a consumer check/report tool first; keep B2B APIs as a later path.

## D-002 - Rules decide, AI explains

The numeric risk score comes from deterministic weighted reason codes, not the LLM. AI only explains the result or performs OCR. If AI is unavailable, verdicts still work.

## D-003 - Privacy by hashing and redaction

Store only hashed identifiers plus masked display strings. Redact OTP/card/phone/passport-like data before persistence. Screenshots are OCR'd in memory and discarded.

## D-004 - Moderation gate before public exposure

Reported entities become publicly visible only after admin confirmation. This prevents doxxing and weaponized false reports.

## D-005 - Allowlist-based admin bootstrap

Admin grants are explicit via `admin_allowlist`; first-user-is-admin behavior is not safe for production.

## D-006 - Two Supabase clients

Browser code uses the publishable key under RLS. Server code uses service-role only in server-only modules.

## D-007 - RU + UZ scam patterns

Rules include Russian and Uzbek-Latin variants because local scams operate in both languages.

## D-008 - TanStack Start server functions instead of a separate API

Typed server functions keep the app single-deployable. The Telegram webhook is bound at the server entry and delegates to a testable core handler.

## D-009 - Four local-scam reason codes

Added `asks_to_scan_qr`, `relative_in_distress`, `requests_card_digits`, and `threatens_account_block` without changing score thresholds.

## D-010 - Off Lovable: self-hosted Node/Docker deploy + provider-neutral AI

Lovable was used only to author the initial UI design. Production runtime is self-hosted Node SSR via Nitro `node-server`, shippable with Docker and Railway-ready. AI uses the OpenAI-compatible env contract: `OPENAI_API_KEY`, optional `OPENAI_MODEL`, optional `OPENAI_BASE_URL`.

## D-011 - Research feed and deterministic privacy hardening

`pressauz` is treated as a local research feed, not a raw content source. New posts should be summarized into recurring tactics, mapped to `SCAM_COVERAGE.md`, then converted into reason-code proposals or education-only guidance with RU/UZ/EN copy and tests. Privacy is reinforced: report descriptions and OCR provider output are passed through deterministic `redactText`, so user safety does not depend only on prompt compliance.
