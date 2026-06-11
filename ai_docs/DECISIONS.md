# Decisions

Architecture and product decisions. Newest entries can be appended; keep them short.

## D-029 - Emergency first cards are compressed

`/panic` first responses should pass a 5-second panic test: one urgent action,
a calm human cue and a maximum of three immediate steps. Full contacts,
evidence guidance and disclaimers remain available through explicit follow-up
buttons, especially `panicctx:full` and `panicctx:contacts`. This preserves
safety information while avoiding a wall of text for stressed users.

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

## D-024 - Video thumbnails are evidence, full videos are not downloaded

Telegram video messages may expose a small preview frame. If a video has no
caption, hidden link or inline-button URL, the bot may route that thumbnail to
the same in-memory image/QR pipeline used for photos. The video file itself is
not fetched, decoded or stored. If Telegram gives no usable thumbnail, the bot
keeps the media-specific fallback asking for a link, screenshot frame or short
description.

## D-025 - Forwarded source context is reply-only

Telegram forwarded posts can expose a public channel/group title and username.
The bot may show that visible source in the answer to help the user understand
context. When deterministic reason codes identify a tactic, the reply should
explain the scheme, likely attacker goal and one safe next step in compact
language. It must not append source metadata to the scored input, persist it in
`checks`, or use it as reputation evidence. Hidden/private user origins stay
excluded, and the copy must keep the limitation boundary: no hidden SCAM label,
account-age, report-history or spam-history claims.

## D-026 - Unreadable images get triage, not guessed verdicts

When photo/OCR/QR analysis cannot produce usable evidence, the bot should not
invent a risk result from the image. Instead, it keeps the explicit unreadable
fallback, stores only the safe `image_unreadable` session snapshot, and offers
scenario triage buttons for common visual categories: NFT/Stars gifts,
casino/free-spins, TON/wallet, bank/code and menu/QR. Triage callbacks are
presentation-only: they provide safe next steps and ask for the next concrete
evidence, but they do not run scoring, create `checks` rows, persist image
bytes, or claim hidden Telegram reputation.

## D-027 - Telegram promo image explanations are scenario-first

When a Telegram screenshot is readable, the reply should explain the visible
mechanic instead of falling back to generic "code/card/APK" wording. Casino and
free-spins posts mention deposits/top-ups; NFT/Stars giveaways mention
captcha/voting/bot/spin/claim mechanics; wallet/DeFi posts mention
connect/sign/seed-phrase risk; TON referrals mention invite/reward loops.
Ordinary Telegram news, product posts and advertising-exchange posts remain
non-accusatory and ask for the next screen or link if a later step requests
sensitive data.

## D-028 - Telegram public post links keep the post-body boundary visible

Public links such as `t.me/channel/123` and `t.me/s/channel/123` are not the
same as forwarded posts. The bot may use Bot API `getChat` to identify the
public channel/account, and it may preserve the post id for user-facing wording,
but it must not claim that it read the body of that post through the link. For
precise analysis the reply should ask the user to forward the post, paste the
text, or send a screenshot. This keeps link checks helpful without inventing
hidden Telegram capabilities.

## D-029 - Public Telegram post web fetch is visible evidence only

The bot may fetch `https://t.me/s/<username>/<postId>` for validated public
Telegram post links before falling back to Bot API metadata. This is best-effort
visible web evidence only: extract short text, visible outbound links, link
previews and inline buttons, redact sensitive digits, score through the existing
rules-first pipeline, and clearly say that hidden SCAM labels, account age,
Telegram reports and spam history are not visible. Private invites, internal
`t.me/c/...` links and arbitrary URLs are never fetched by this feature.
