# Requirements

## Introduction

AI voice-clone scams create a specific panic pattern: the user hears a familiar voice and may send money before verifying the person. Ishonch Guard must give a dedicated SOS flow that is honest about limits: the bot does not prove whether a voice is real; it helps the user verify identity through an independent channel.

## Requirements

### Requirement 1: Dedicated AI Voice-Clone SOS Scenario

**User Story:** As a user who heard a familiar voice asking for money, I want a dedicated panic scenario, so that I get advice for voice-clone pressure instead of generic bank guidance.

#### Acceptance Criteria

1. WHEN the user opens the second `/panic` page THEN the bot SHALL show an AI voice-clone / loved-one voice scenario.
2. WHEN the user selects the scenario THEN the first card SHALL lead with not sending money based on voice alone.
3. The first card SHALL tell the user to end the call or voice chat, call the person back using a saved number and ask a family code word or private question.
4. The scenario SHALL be available as `panic:11`.

### Requirement 2: Honest Voice Boundary

**User Story:** As a user, I want the bot to be honest about what it can and cannot verify, so that I do not overtrust a false "voice analysis" claim.

#### Acceptance Criteria

1. The bot SHALL NOT claim it can prove that a voice is real or fake from Telegram Bot API evidence.
2. The bot SHALL frame the safe action as verifying the person, not verifying the voice.
3. The bot SHALL mention a saved number, another messenger, family code word or private question as verification methods.
4. The bot SHALL NOT ask the user to forward secret codes, card data, passwords or private media.

### Requirement 3: Scenario-Specific Follow-Ups

**User Story:** As a stressed user, I want every follow-up button to stay relevant to voice-clone pressure, so that I do not get an unrelated "call the bank" answer unless money was already at risk.

#### Acceptance Criteria

1. WHEN the user taps "What next" THEN the answer SHALL focus on saved-number callback and code-word verification.
2. WHEN the user taps "Ready phrase" THEN the answer SHALL provide a calm sentence for the suspicious caller and a short message for a trusted person.
3. WHEN the user taps "Trusted person" THEN the answer SHALL help involve another relative or family friend.
4. WHEN the user taps "Where to get help" THEN the answer SHALL show police/UZCERT and bank/payment contacts only as escalation if money, threats or extortion are present.

### Requirement 4: Regression Coverage

**User Story:** As the project owner, I want this scenario locked by tests, so that future SOS work does not accidentally route it back to generic financial wording.

#### Acceptance Criteria

1. Tests SHALL assert `panic:11` is present on the second panic menu page and parses correctly.
2. Tests SHALL assert the first card contains saved-number and code-word guidance.
3. Tests SHALL assert ready phrase and contact guidance do not use generic incoming-call/bank-first wording.
