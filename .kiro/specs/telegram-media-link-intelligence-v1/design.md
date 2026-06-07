# Design: Telegram Media & Link Intelligence v1

## Overview

This feature improves the Telegram bot's handling of forwarded media posts and Telegram links. The immediate product bug is that a video with a caption is currently rejected as unsupported media before the caption is analyzed. The second bug is that private invite links and betting promo captions are reduced to weak generic reasons.

## Architecture

1. Router: `decideRoute` keeps the existing priority order, but checks media captions before unsupported media fallbacks.
2. Normalizer: `normalizeTelegram` extracts `+inviteCode` from `t.me/+...` links, including links embedded in longer captions.
3. Risk Rules: `evaluateText` adds `gambling_prediction_promo` only when gambling/prediction context is paired with a private invite, subscription/profit/win prompt, or similar action signal.
4. Formatter/Advice: `filterAdvice` maps the new reason to concrete betting-channel advice.
5. Metadata Boundary: public Telegram metadata enrichment remains a separate follow-up. Bot API limitations must be surfaced honestly.

## Components and Interfaces

- `src/lib/telegram/router.ts`
  - Adds caption-first routing for video/audio/voice/non-image document.
- `src/lib/risk/detect.ts`
  - Extracts private invite codes from Telegram links.
- `src/lib/risk/rules.ts`
  - Adds `gambling_prediction_promo` reason, score, labels, and detection helper.
- `src/lib/telegram/advice-filter.ts`
  - Adds context-specific betting/prediction advice.

## Correctness Properties

1. A video/audio/voice message with non-empty caption routes to `check`.
2. The same media without caption routes to `outOfScope`.
3. Image documents still route to image OCR before caption analysis.
4. `t.me/+code` normalizes to `+code`, not to the whole caption.
5. Betting prediction + private invite triggers `gambling_prediction_promo`.
6. Neutral sports news and restaurant QR menus do not trigger `gambling_prediction_promo`.

## Error Handling

If media has no caption and cannot be analyzed, the bot returns a helpful fallback that asks for the caption link, text, screenshot, QR target, or short description of what the sender promised/requested.

If Telegram metadata lookup is unavailable for a public username, the bot must not fabricate account age, scam labels, or report history.

## Testing Strategy

Use focused unit tests:

- router tests for caption-first media routing;
- detect tests for private invite normalization;
- risk rule tests for positive and negative betting scenarios;
- property fixture update for the full reason-code universe;
- advice-filter tests for non-generic betting advice.
