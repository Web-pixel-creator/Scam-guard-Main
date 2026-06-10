# Design: Telegram Image Intelligence v3

## Overview

Image Intelligence v3 adds deterministic post-processing around the existing vision extraction. The AI still extracts visible text and structured fields, but `image-intelligence.ts` becomes responsible for recognizing Telegram promo categories and translating them into safe, rule-engine-readable evidence.

## Architecture

1. `analyzeImageCore` asks the AI for visible text, category, QR info, risk hints, and summary.
2. `sanitizeImageIntelligence` validates the model output and merges deterministic hints from visible text.
3. `buildImageCheckInput` converts structured evidence into compact text for the existing `evaluateText` pipeline.
4. `runCheck` scores the generated evidence with existing reason codes and formats the answer through current Telegram UX.

No new scoring engine is added. The implementation reuses the scam-research-feed-v2 reason codes.

## Components

### Extended Image Types

`ImageVisualCategory` gains Telegram-specific categories:

- `telegram_promo_post`
- `casino_or_betting_promo`
- `crypto_giveaway_or_nft`
- `wallet_or_defi_action`
- `news_or_channel_post`

`ImageRiskHint` gains Telegram/Web3 promo hints:

- `casino_bonus_or_free_spins`
- `fake_captcha_or_voting`
- `giveaway_or_prize_actions`
- `task_reward_or_engagement`
- `wallet_or_defi_urgency`
- `ton_referral_or_earning`
- `telegram_invite_or_private_link`

### Deterministic Classifier

Regex groups mirror existing rule-engine predicates:

- casino/free-spins plus deposit/bonus/link/signup
- prize/NFT/Stars plus captcha/vote/reaction/subscribe
- task/reward/leaderboard/easy actions plus money/tokens/prizes
- wallet/DeFi/token plus urgency/top-up/liquidation/fees
- TON/crypto plus referral/invite earning
- betting/prediction plus invite/channel/free/VIP/profit

### Check Input Builder

The builder appends concise evidence lines for risk hints. These lines intentionally contain natural-language phrases already covered by `rules.ts`, so scoring remains centralized.

## Correctness Properties

1. Benign restaurant/menu QR screenshots stay below `high_risk`.
2. Normal delivery pickup SMS screenshots stay below `high_risk`.
3. Unreadable image output is not usable evidence by itself.
4. Telegram casino bonus screenshots produce casino/betting reason codes.
5. Giveaway/captcha screenshots produce engagement-gate reason codes.
6. Wallet urgency screenshots produce wallet urgency reason codes.
7. Ordinary news/product Telegram screenshots do not produce v2 promo reason codes.
8. No raw image bytes or data URLs are persisted.

## Error Handling

Invalid JSON, low-confidence text, or unsupported categories degrade to existing fallback behavior. The bot must ask for a link/text instead of inventing channel reputation, account age, scam labels, or QR contents.

## Testing Strategy

Add unit tests for `image-intelligence.ts`, integration tests for the Telegram image handler, and run full project validation before deployment.
