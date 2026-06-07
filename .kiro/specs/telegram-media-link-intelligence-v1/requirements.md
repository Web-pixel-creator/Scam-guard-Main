# Requirements: Telegram Media & Link Intelligence v1

## 1. Caption-First Media Routing

When a Telegram user sends video, audio, voice, or non-image document with a non-empty caption, the bot shall analyze the caption through the normal Check Pipeline before using the unsupported-media fallback.

When the same media has no caption, the bot shall answer with a helpful unsupported-media message that explains what the user can send instead.

## 2. Private Invite Link Handling

When input contains `t.me/+...` or `telegram.me/+...`, the bot shall normalize the invite code as the Telegram identifier under review.

The bot shall not claim that it inspected the private group/channel contents unless the bot actually has access to the chat metadata.

## 3. Betting / Prediction Promo Detection

When the user sends text that combines betting/prediction/gambling terms with a private invite, subscription prompt, promised win, or profit claim, the bot shall add a specific reason code for a closed betting or prediction channel.

Ordinary sports news, match schedules, restaurant menus, and neutral QR promotions shall not trigger this reason code.

## 4. User-Facing Advice

For betting/prediction promo signals, the bot shall provide concrete advice: do not pay for predictions, closed-channel access, or guaranteed wins; do not enter card data or Telegram codes after following the invite.

## 5. Telegram Account Metadata Limits

For public `@username` links, the system may use Bot API metadata when available. For inaccessible/private accounts or invite links, it shall clearly state the limitation and request more context instead of inventing account age, report counts, or spam history.

## 6. Tests

The implementation shall include unit tests for media caption routing, invite normalization, betting promo positive/negative cases, scoring fixture updates, and context-aware advice.
