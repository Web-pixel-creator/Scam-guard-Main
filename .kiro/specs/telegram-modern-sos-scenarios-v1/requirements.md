# Requirements

## Introduction

Modern Telegram scam pressure is not limited to bank calls. Users also meet fake job offers, delivery/top-up fees, crypto/TON wallet funnels and fake government benefit links. Ishonch Guard must give these users a dedicated SOS path that stays honest, short and actionable without claiming hidden Telegram facts or external provider intelligence.

## Requirements

### Requirement 1: Dedicated Modern SOS Scenarios

**User Story:** As a user under pressure from a non-bank scam, I want a matching emergency scenario, so that I do not receive irrelevant bank-call guidance.

#### Acceptance Criteria

1. WHEN the user opens the third `/panic` page THEN the bot SHALL show fake job/easy money, fake delivery/top-up, crypto/TON/wallet and government grant/benefit scenarios.
2. The scenarios SHALL be available as `panic:12`, `panic:13`, `panic:14` and `panic:15`.
3. The first card for each scenario SHALL lead with one urgent "do not" action and no more than a short set of next steps.
4. The detailed checklist for each scenario SHALL include at least one verified official contact path.

### Requirement 2: Scenario-Specific Guidance

**User Story:** As a stressed user, I want the bot to tell me the exact safe action for the current scam pattern, so that I can stop before sending money, codes or wallet access.

#### Acceptance Criteria

1. Fake job/easy-money guidance SHALL warn against paying for hiring, access, activation, withdrawal or document/KYC links from chat.
2. Delivery/top-up guidance SHALL warn against chat payment links, APKs and SMS/PIN/CVV/full-card entry.
3. Crypto/TON/wallet guidance SHALL warn against wallet connect, seed/private key entry and withdrawal/unlock fees.
4. Government grant/benefit guidance SHALL warn against benefit fees, Telegram links, SMS/Telegram codes, CVV/PIN/card data and passport/ID photos in chat.

### Requirement 3: Follow-Up Context

**User Story:** As a user who asks "what next" or "what should I say" after selecting a scenario, I want the answer to keep the same context, so that the bot does not fall back to a generic incoming-call script.

#### Acceptance Criteria

1. `panicctx:more` SHALL render next steps for the selected modern scenario.
2. `panicctx:script` SHALL provide a calm pause phrase for chat-link/payment/data pressure.
3. `panicctx:trusted_person` SHALL help the user involve a trusted person without forwarding secrets.
4. `panicctx:contacts` SHALL route to an appropriate help directory for payment, crypto, delivery or benefit pressure.

### Requirement 4: Privacy And Honesty

**User Story:** As the project owner, I want these scenarios to stay safe, so that the bot cannot be used to solicit secrets or make unsupported accusations.

#### Acceptance Criteria

1. The bot SHALL NOT ask the user to enter or repeat SMS codes, Telegram codes, PIN, CVV, full card numbers, seed phrases, private keys or passwords.
2. The bot SHALL NOT claim that a job, delivery, grant or crypto source is definitely a scam without evidence.
3. The bot SHALL phrase the result as pressure/risk guidance and safe next steps.
4. The bot SHALL preserve existing rules-first scoring boundaries; these SOS cards are emergency guidance, not hidden-provider reputation claims.

### Requirement 5: Regression Coverage

**User Story:** As the project owner, I want this SOS expansion locked by tests, so that future menu changes do not silently drop or misroute scenarios.

#### Acceptance Criteria

1. Tests SHALL assert page 3 contains `panic:12` through `panic:15` plus a back button.
2. Tests SHALL assert callback parsing accepts scenario ids through `15`.
3. Tests SHALL assert modern scenario copy avoids generic bank-first ready phrases where they do not apply.
4. Tests SHALL assert all panic scenarios remain well-formed across RU/UZ/EN.
