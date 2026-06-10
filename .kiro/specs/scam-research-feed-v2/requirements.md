# Requirements: Scam Research Feed v2

## Overview

Ishonch Guard SHALL extend the public research-feed pipeline to Telegram/Web3 promo scams seen in forwarded Telegram posts: casino/free-spins funnels, fake CAPTCHA/voting tasks, NFT/Stars giveaways, task-reward campaigns, wallet urgency, and TON referral earning schemes. The implementation MUST stay conservative: topic words such as TON, NFT, wallet, or casino are not enough by themselves to mark a user or channel as a scam.

## Requirements

### R1. Source Handling

1. WHEN public examples are used as research input, THE project SHALL summarize the tactic and avoid copying full posts into user-facing copy.
2. WHEN external research is referenced, THE docs SHALL link to sources and describe the generalized pattern, not individual victims.
3. THE implementation SHALL avoid naming a specific person/channel as a scammer; it SHALL use risk signals only.

### R2. Telegram Casino / Free-Spins Funnels

1. WHEN text combines casino/free-spins/no-KYC/no-limits language with deposit, bonus, link, Telegram Mini App, or signup language, THE risk engine SHALL detect a casino-bonus funnel reason.
2. WHEN the same text also contains a private invite link, weird domain, hidden link, or urgency, THE total risk SHOULD reach `high_risk`.
3. WHEN text is ordinary sports/news/restaurant content without gambling or deposit action, THE casino reason SHALL NOT trigger.

### R3. Fake CAPTCHA / Voting / Engagement Gates

1. WHEN a prize, NFT, Stars, airdrop, or giveaway asks the user to complete CAPTCHA, vote, react, subscribe, verify, or connect a wallet, THE risk engine SHALL detect a fake engagement gate.
2. WHEN the engagement gate also asks for wallet/card/code/seed phrase/login, THE result SHOULD reach `high_risk`.
3. Legitimate news about voting, CAPTCHA technology, or NFT market statistics SHALL NOT trigger without prize/action language.

### R4. Task Reward and Referral Earning Schemes

1. WHEN text promises rewards, points, leaderboard prizes, tokens, or money for easy actions, THE risk engine SHALL detect a task-reward bait.
2. WHEN text promises TON/crypto earnings for inviting friends or referral links, THE risk engine SHALL detect a TON referral earning scheme.
3. The advice SHALL warn about pay-to-unlock, deposit-to-withdraw, wallet connection, and seed phrase/login-code risks.

### R5. Wallet / DeFi Urgency

1. WHEN text combines wallet/DeFi/token operations with urgency, liquidation, security incident, grace period, transfer, top-up, fee payment, or app-link language, THE risk engine SHALL detect wallet-action urgency.
2. The reason SHALL be moderate by itself; it SHALL become stronger with suspicious links or credential/payment requests.
3. Ordinary wallet product news without urgency or requested user action SHALL stay below `high_risk`.

### R6. Verification

1. Unit tests SHALL cover examples derived from the provided screenshots: Twin/Tonplay, TON NFT giveaway, Punk City reward pool, Tonkeeper/Rhea wallet urgency, TON Dating referral, voting.blockchain-life, Summer Operation/EasyCoin, Telegram ad exchange.
2. Negative tests SHALL cover ordinary crypto/news/product announcements.
3. Telegram formatting, advice filtering, public metadata summaries, property fixtures, type-check, lint, full tests, and production smoke SHALL be run before release.
