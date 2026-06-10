# Requirements: Telegram Image Intelligence v3

## Overview

Ishonch Guard SHALL improve screenshot analysis for forwarded Telegram promo posts and video frames. The bot MUST turn visible Telegram-post evidence into existing risk-engine signals while staying conservative for ordinary news, restaurant/menu, product announcements, and unreadable images.

## Requirements

### R1. Telegram Promo Evidence

1. WHEN a screenshot contains visible Telegram channel/post content, THE image evidence builder SHALL preserve channel names, usernames, domains, button labels, reward amounts, and promo conditions in the check input.
2. WHEN a screenshot contains casino/free-spins/no-KYC/no-limits/deposit/bonus language, THE builder SHALL surface enough context for `crypto_casino_bonus_funnel` and/or `gambling_prediction_promo`.
3. WHEN a screenshot contains NFT/Stars/gift/giveaway plus vote/captcha/reaction/subscribe/spin/lucky-draw/777/bot/claim actions, THE builder SHALL surface enough context for `giveaway_engagement_bait`, `fake_captcha_or_voting`, and/or `task_reward_engagement_bait`.
4. WHEN a screenshot contains wallet/DeFi/token operations plus urgency, liquidation, grace period, top-up, fees, or app-link language, THE builder SHALL surface enough context for `wallet_action_urgency`.
5. WHEN a screenshot contains TON/crypto earning for invites or referral links, THE builder SHALL surface enough context for `ton_referral_earning_scheme`.

### R2. Conservative False-Positive Guard

1. Ordinary news posts SHALL NOT become suspicious only because they mention Telegram, apps, TON, NFT, wallet, or voting.
2. Restaurant/menu QR, delivery SMS, and informational QR behavior from v2 SHALL remain unchanged.
3. If the model cannot read useful text and no visible URL/purpose/hint is available, THE bot SHALL use the unreadable-image fallback and SHALL NOT invent risk.

### R3. User-Facing Output

1. The bot SHALL explain Telegram promo screenshots in concrete language: what was visible, why it is suspicious, and what safe next step to take.
2. The bot SHALL avoid naming channels or people as scammers; it SHALL say that the content has suspicious signs.
3. For low-confidence screenshots, the bot SHALL ask for the text/link under the post instead of overclaiming.
4. Casino/free-spins, NFT/Stars, wallet/DeFi, TON referral, task-reward and ordinary Telegram post outputs SHALL use scenario-specific explanations instead of one generic image-analysis paragraph.

### R4. Verification

1. Unit tests SHALL cover Twin/Tonplay free-spins, TON NFT/Stars giveaway, Stars spin/lucky-draw, public voting/contest domains, task reward campaign, wallet urgency, TON referral earning, betting invite, and ordinary news/product negative cases.
2. Telegram integration tests SHALL verify that a structured image evidence object reaches the normal check pipeline and persists reason codes without storing image bytes.
3. Full tests, typecheck, lint, build, security review, deployment, and production smoke SHALL be run before release.
