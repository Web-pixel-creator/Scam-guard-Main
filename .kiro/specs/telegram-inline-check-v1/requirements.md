# Requirements: Telegram Inline Check v1

## Overview

Telegram Inline Check v1 lets a user type `@scamguard_bot <number/link/text>` in any Telegram chat and insert a short Ishonch Guard risk card without opening the bot. This is a viral, Telegram-first safety feature, but it must stay fast, private and honest.

## Requirements

### R1. Inline Query Support

1. WHEN Telegram sends an `inline_query` update, THE webhook SHALL parse it and route it before chat-based message routing.
2. THE inline route SHALL use `inline_query.from.id` as the user id.
3. THE inline route SHALL NOT require a chat id.

### R2. Fast Rules-Only Preview

1. Inline checks SHALL use deterministic rules and existing reputation/verified-contact lookups.
2. Inline checks SHALL NOT call AI explanations or image/OCR providers.
3. Inline checks SHALL return within Telegram inline-mode expectations with a compact result set.

### R3. Privacy And Persistence

1. Inline checks SHALL NOT persist every typed query into `checks`.
2. Inline results SHALL render only masked/redacted display values.
3. Inline results SHALL NOT store raw phone numbers, URLs, OTP codes, card data or message text in session state.

### R4. User-Facing Result

1. Empty inline query SHALL return one help article explaining what to type.
2. Non-empty query SHALL return one primary result article with risk level, short reason and one safe next step.
3. The inserted message SHALL include `@scamguard_bot` as the place to continue detailed checking.
4. The copy SHALL be available in RU, UZ and EN using the user's saved language when available.

### R5. Safety Limits

1. Inline results SHALL not claim hidden Telegram SCAM labels, account age, spam history or private complaints.
2. Unknown results SHALL ask for more context instead of pretending certainty.
3. High-risk results SHALL lead with "do not send code/card/money/install apps" style action.

### R6. Tests

1. Tests SHALL cover inline query dispatch without chat id.
2. Tests SHALL cover Bot API `answerInlineQuery` payload shape.
3. Tests SHALL cover inline handler behavior for empty, suspicious/high-risk and unknown queries.
4. Tests SHALL prove inline preview calls `runCheck` with `skipAi=true` and `persist=false`.
