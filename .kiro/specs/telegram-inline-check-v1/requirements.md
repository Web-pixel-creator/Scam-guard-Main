# Requirements: Telegram Inline Check v1

## Overview

Telegram Inline Check lets a user type `@scamguard_bot <number/link/text>` in
any Telegram chat and insert a compact Ishonch Guard risk card without opening
the bot. Inline previews must remain fast, non-persistent, privacy-safe and
explicit about what evidence was and was not checked.

## Requirements

### R1. Inline Query Support

1. WHEN Telegram sends an `inline_query` update, the webhook SHALL parse and
   route it before chat-based message routing.
2. The inline route SHALL use `inline_query.from.id` as the user id and SHALL
   NOT require a chat id.
3. The route SHALL use the saved RU/UZ/EN language when available and may use
   Telegram's language hint only for first contact.

### R2. Fast Rules-only Preview

1. A trimmed inline query SHALL be limited to Telegram's 256-character input
   boundary. Longer input SHALL return a localized shorten-query article.
2. Non-empty checks SHALL call the deterministic pipeline with `skipAi=true`,
   `skipUrlReputation=true` and `persist=false`.
3. Inline checks SHALL NOT call AI explanation, OCR/image or configured external
   URL-reputation providers.
4. Local verified-directory and moderated reputation evidence may be used only
   with its explicit source and scope.

### R3. Privacy And Persistence

1. Inline queries SHALL NOT create `checks` rows or chat-scoped session state.
2. Every displayed value SHALL pass through the Inline presentation masking
   boundary even when it was already masked upstream.
3. A malformed URL/APK display SHALL fail closed to a generic `[link]` value.
4. Titles, descriptions, inserted messages and preflight human-intent articles
   SHALL NOT expose raw phone numbers, URLs, OTP/SMS codes, card data,
   passwords, private identifiers or message evidence.

### R4. User-facing Result Bounds

1. An empty query SHALL return one localized help article.
2. A non-empty query SHALL return one primary article with risk level, one
   ranked reason explanation and one safe next step.
3. Every article description SHALL be at most 120 characters after whitespace
   compaction.
4. Every inserted message SHALL be at most Telegram's 4096-character message
   boundary and SHALL retain the complete selected evidence explanation and
   limitation.
5. The inserted message SHALL include the configured bot mention as the place
   to continue detailed checking.
6. Copy SHALL be available in RU, UZ and EN.

### R5. Exhaustive Reason Presentation

1. `INLINE_REASON_POLICY` SHALL be a typed `Record<ReasonCode,
InlineReasonPolicy>` covering all 55 current reason codes.
2. Every policy row SHALL define an explicit numeric priority, typed evidence
   method/source class and typed limitation.
3. Lower numeric priorities SHALL win. Equal priorities SHALL use a stable
   lexical `ReasonCode` tie-break, independent of detector array order.
4. The localized explanation SHALL state the actual evidence method/source:
   visible text, URL/domain/phone/Telegram structure, official directory,
   moderated local reports, configured external reputation evidence or visible
   context.
5. The localized limitation SHALL avoid claims of hidden Telegram data, owner
   identity, proof of fraud, complete page analysis or evidence outside the
   selected source's scope.
6. Official-directory and moderated-report metadata SHALL participate in the
   same canonical ranked reason set even when the scoring reason array does not
   contain an extra presentation code.

### R6. Safety And Failure Handling

1. Unknown results SHALL ask for more context instead of pretending certainty.
2. High-risk results SHALL lead with an immediate protective action and SHALL
   not ask the user to provide a secret.
3. Bot API failures SHALL not leak the query/result into logs.
4. Telegram entity-parse failures MAY retry once with equivalent plain text.
5. Rate-limit and unexpected failures SHALL return localized safe articles.

### R7. Tests

1. Tests SHALL cover inline dispatch without a chat id and Bot API payload
   shape.
2. Tests SHALL prove `skipAi=true`, `skipUrlReputation=true` and `persist=false`.
3. Tests SHALL exercise every one of the 55 reason codes in RU/UZ/EN through the
   real Inline presentation adapter.
4. Tests SHALL verify deterministic multi-reason ordering, the 256/120/4096
   bounds, re-masking and malformed-link fail-closed behavior.
