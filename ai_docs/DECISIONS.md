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

## D-012 - Research-feed scam rules and `known_reported`

Added dedicated reason codes for recurring local patterns from the research-feed process: `known_reported` (50), `fake_delivery_payment` (35), `fake_boss_request` (30), and `malicious_file_bait` (35). `payment_before_service` received concrete marketplace/prepayment patterns. Confirmed high-risk entities now use `known_reported` instead of the old APK proxy boost, so explanations and analytics describe the real reason for the verdict.

## D-013 - Direct Vite/TanStack/Nitro config

Removed the historical `@lovable.dev/vite-tanstack-config` build wrapper and replaced it with explicit Vite plugins: TanStack Start, React, Tailwind, tsconfig paths, and Nitro `node-server`. This keeps the original Lovable-authored design while removing Lovable-specific build tooling from the production path.

## D-014 - Heuristic `payment` input detector

Added `looksLikePaymentInput` in `risk/detect.ts` so payment-flow messages can be classified as `payment` instead of generic `text` or accidental `url`. The detector is conservative: pure URLs/APKs/Telegram links keep their primary type, while mixed payment text needs payment action/context plus amount, currency, card, QR or provider signals.

## D-015 - Sensitive writes only through server functions

Direct `anon`/`authenticated` inserts into `checks` and `reports` are disabled.
Those tables can contain sensitive scam evidence even after masking, so all
writes must pass through server functions that validate, redact and hash before
using the service-role client. This also prevents public stat pollution through
direct `checks` inserts.

## D-016 - Panic mode is a contextual copilot

After a user selects a `/panic` scenario, the Telegram bot stores only the
scenario id and timestamp so short follow-up questions can stay contextual
("what next?", "bank number", "what should I say?"). The router remains
conservative: URLs, phone numbers, Telegram usernames, code-like secrets and
long suspicious text still go through the risk pipeline. This gives stressed or
elderly users guided next steps without storing raw emergency evidence.

## D-017 - Telegram images use structured evidence, not raw OCR scoring

Telegram photos/screenshots now pass through `analyzeImageCore` and
`image-intelligence.ts` before `runCheck`. The model returns JSON evidence, but
the app sanitizes it, merges deterministic risk hints from visible text, and
builds a rules-safe input. Benign restaurant/menu QR and delivery pickup SMS
screenshots can be shown as safe only when no reason codes match. QR login,
QR payment, OTP, APK and card-data requests still trigger normal scoring.

## D-018 - Research feed v1 remains narrow and test-backed

Public news/Telegram feeds are research input, not product copy. The first
v1 pack adds two generalized tactics only after tests: Telegram account
deletion/"Cancel" phishing (`telegram_account_takeover_phishing`, 50) and
card/SIM/account transfer recruitment (`dropper_recruitment`, 35). The first is
high-risk because it is an account-takeover action request. The second is
suspicious by itself and uses legally soft wording about financial/legal risk.

## D-019 - Telegram public metadata is presentation-only

Public `@username` and `t.me/...` checks may call Bot API `getChat` after the
rules-first verdict. The result can improve the explanation, but it must not
change score/level/reasons and must not invent account age, hidden scam labels,
spam history or report counts. Unknown or inaccessible Telegram targets should
ask for visible evidence: message text, screenshot, URL, payment request or code
request.

## D-020 - Telegram link intelligence must not hide limits

Telegram Link & Account Intelligence v2 originally kept limitations first
because result cards truncate long explanations. Telegram Evidence Brief v1
refines this: profile-only or unavailable usernames without scam context still
show the limitation first, but when local reason codes reveal a concrete
scenario (betting, casino, giveaway, wallet urgency, account takeover or
credential request), the scenario and safe next step come first. The limitation
must still appear in the brief, and the bot still must not invent account age,
hidden scam labels, Telegram report counts or spam history.

## D-021 - Situation-only reports do not affect entity reputation

When a user reports a situation without a concrete phone, URL, Telegram username
or payment target, the report is stored as incident evidence but must not create
or increment an `entities` row. This keeps the report flow useful for scared or
elderly users while protecting unrelated people/accounts from description-only
public reputation.

## D-022 - Telegram reputation is app-owned and moderated

Telegram Bot API does not expose reliable account age, hidden SCAM labels,
Telegram report counts or spam-recipient history. Ishonch Guard therefore stores
its own Telegram reputation in `telegram_reputation_targets` using HMAC-hashed
targets and masked display hints. Checks may update observation timestamps, and
unverified reports may create admin-review candidates, but user-facing
reputation labels require confirmed moderated reports or a future official
source. The bot must label the source and confidence and must not present this
as a hidden Telegram-internal verdict.

## D-023 - Web3 promo funnels are contextual, not automatic guilt

Telegram/Web3 casino, NFT, Stars, task-reward, wallet and referral posts are
handled as recurring tactics from a research feed. They add deterministic reason
codes and contextual advice, but most are suspicious rather than high-risk until
paired with stronger signals such as private invite links, deposits, credential
requests, wallet signing or code/card prompts. This keeps the bot useful without
overclaiming that every promo post is definitely fraud.
