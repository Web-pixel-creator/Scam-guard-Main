# Requirements: Telegram Public Metadata v1

## Overview

Users expect `@username` and `t.me/...` checks to say more than "not enough data." This feature enriches Telegram checks with public Bot API metadata when available, while clearly explaining hard platform limits and avoiding invented account age, report counts, hidden scam labels, or spam history.

## Requirements

### R1. Public Username Extraction

1. WHEN input is `@username`, `t.me/username`, `telegram.me/username`, or a message containing one such public Telegram link, THE Bot SHALL extract the public username.
2. WHEN input is `t.me/+...`, `telegram.me/+...`, `joinchat/...`, or an internal `t.me/c/...` link, THE Bot SHALL classify it as inaccessible/private for metadata purposes.
3. THE extractor SHALL ignore non-Telegram URLs and shall not treat emails as Telegram usernames.

### R2. Bot API Metadata Lookup

1. WHEN a public username is extracted, THE Telegram channel MAY call Bot API `getChat` with `@username`.
2. WHEN `getChat` returns chat data, THE Bot SHALL summarize only safe public metadata: chat type, public title for channels/groups, username, public description/bio presence, and access hints.
3. WHEN `getChat` fails or the chat is not found, THE Bot SHALL explain that public metadata could not be retrieved and ask for the actual message, screenshot, link, or payment/code request.
4. THE lookup SHALL be best-effort and SHALL NOT make check processing fail.

### R3. Safety Boundaries

1. THE Bot SHALL NOT claim it knows account age, number of reports, spam history, hidden Telegram scam markers, or whether a person is a scammer unless that information comes from Ishonch Guard's moderated database.
2. THE Bot SHALL NOT accuse named people. It shall use risk labels and "visible signs" language.
3. THE Bot SHALL treat public metadata as supporting context only; it SHALL NOT change the deterministic risk score.
4. THE Bot SHALL redact sensitive text before rendering public metadata snippets.

### R4. User-Facing Reply

1. WHEN metadata is available, THE result message SHALL include a short explanation of what was checked and what it does not prove.
2. WHEN metadata is unavailable, THE result message SHALL include a helpful limitation message instead of a generic "not enough data" answer.
3. WHEN the input is an invite/private link, THE result message SHALL state that the bot cannot inspect a closed chat/channel unless the user sends visible content.
4. THE reply SHALL be localized in RU/UZ/EN and remain readable on mobile.

### R5. Follow-Up Context

1. WHEN a Telegram-profile check is saved as the last check, THE Bot SHALL answer short follow-ups like "точно?", "что дальше?", or "почему?" based on that Telegram-profile context.
2. THE session snapshot SHALL store only non-sensitive metadata: risk level, input type, coarse context and timestamp.

### R6. Tests

1. Unit tests SHALL cover public username extraction, private invite classification, not-found fallback text, found metadata summary, and safe boundaries.
2. Handler tests SHALL verify that Telegram checks are enriched without changing score, level, or reason codes.
3. Formatter tests SHALL verify that suspicious results can show a short explanation block.
