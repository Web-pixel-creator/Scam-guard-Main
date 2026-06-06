# Requirements: Scam Research Feed v1

## Overview

Ishonch Guard SHALL use public Uzbekistan scam news and Telegram feeds as research input, not as copied app content. The first implementation wave focuses on two recurring, locally relevant tactics: Telegram account-takeover phishing disguised as "account deletion/cancel" and recruitment into bank-card/SIM/account transfer schemes.

## Requirements

### R1. Research Source Handling

1. WHEN a public feed item is used as input, THE project SHALL summarize the tactic and source URL in documentation without copying full posts into product copy.
2. WHEN a tactic is added to scoring, THE implementation SHALL include a reason-code mapping, RU/UZ/EN labels, and tests before the rule is enabled.
3. IF a source contains a named individual, phone, card, username, or victim detail, THE product copy SHALL omit that identifying detail.

### R2. Telegram Account-Takeover Phishing

1. WHEN text claims a Telegram account/profile will be deleted, blocked, cancelled, or "saved" by pressing a button/link, THE risk engine SHALL detect `telegram_account_takeover_phishing`.
2. WHEN the same text asks the user to enter a phone number, SMS/OTP code, password, or open a link, THE result SHOULD reach `high_risk`.
3. WHEN a user asks a general meta-question about account deletion without an action request, THE rule SHALL NOT trigger by itself.

### R3. Dropper Recruitment Warning

1. WHEN text asks the user to sell, rent, open, or transfer a bank card, SIM card, e-wallet, crypto wallet, OneID, or account to another person for money, THE risk engine SHALL detect `dropper_recruitment`.
2. THE bot SHALL explain that the safe step is not to transfer cards, SIMs, accounts, passwords, or identity access to third parties.
3. The wording SHALL avoid legal certainty. It may say the action can create serious financial/legal risk, not that the user has committed a crime.

### R4. UX and Safety

1. Telegram and web results SHALL continue to use calm, factual language and SHALL NOT accuse a specific person.
2. Advice for these two tactics SHALL be context-aware and not reuse unrelated "safe account" or "APK" advice as the primary step.
3. All new user-facing labels SHALL be localized for `ru`, `uz`, and `en`.

### R5. Verification

1. Unit tests SHALL cover positive and negative examples in Russian, Uzbek Latin, and English where practical.
2. Integration tests SHALL prove that dangerous examples reach the expected risk level.
3. MarkdownV2 formatting SHALL remain valid for Telegram replies.
