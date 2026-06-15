# Requirements

## Introduction

SOS follow-up answers must feel like a live helper, not a generic bank script. The previous "ready phrase" and trusted-person guidance reused bank/callback wording for every panic scenario, which was wrong for blackmail, romance scams, Telegram takeover and minors.

## Requirements

### Requirement 1: Scenario-Specific Ready Phrases

**User Story:** As a stressed user, I want the ready phrase to match my exact situation, so that I do not receive irrelevant bank/call wording.

#### Acceptance Criteria

1. WHEN the panic scenario is SMS-code, transfer, card data or live call THEN the ready phrase SHALL keep official callback/bank wording.
2. WHEN the panic scenario is suspicious APK THEN the ready phrase SHALL mention isolating the phone and checking through an official channel.
3. WHEN the panic scenario is lost Telegram THEN the ready phrase SHALL help warn contacts and recover Telegram without sharing codes.
4. WHEN the panic scenario is blackmail, publication threat or under-18 safety THEN the ready phrase SHALL tell the user to stop the chat, not pay/send more material, save evidence and get help.
5. WHEN the panic scenario is relationship money request THEN the ready phrase SHALL pause transfers/loans/gifts/crypto and ask a trusted person to review the chat.

### Requirement 2: Scenario-Specific Trusted-Person Guidance

**User Story:** As an elderly, young or frightened user, I want a message for a trusted person that fits the situation, so that I can ask for help safely.

#### Acceptance Criteria

1. WHEN the scenario is financial or live-call related THEN trusted-person guidance MAY mention bank callback.
2. WHEN the scenario is personal safety, blackmail or minor safety THEN trusted-person guidance SHALL NOT instruct the user to call a bank.
3. WHEN the scenario is Telegram takeover THEN trusted-person guidance SHALL focus on warning contacts and account recovery.
4. WHEN the scenario is APK THEN trusted-person guidance SHALL recommend using another device and keeping the phone isolated.
5. All trusted-person guidance SHALL warn not to share codes, passwords, card photos or additional private material.

### Requirement 3: Correct Help Destination

**User Story:** As a user in a non-bank emergency, I want the follow-up button to show the right destination, so that I do not tap "call bank" for blackmail or minor-safety cases.

#### Acceptance Criteria

1. WHEN the scenario is bank/card/APK/live-call THEN the contact button SHALL remain safe callback guidance.
2. WHEN the scenario is Telegram takeover, romance, blackmail, publication threat or minor safety THEN the contact button SHALL read as a help directory.
3. WHEN the user asks "куда обратиться" or mentions police/support in a recent panic context THEN the bot SHALL route to contact/help guidance.
4. Non-bank help guidance SHALL include police/MIA and UZCERT where relevant, without exposing private user data.

### Requirement 4: Privacy And Anti-Manipulation

**User Story:** As the project owner, I want SOS texts to resist scammer manipulation, so that the bot never asks for secrets or escalates harm.

#### Acceptance Criteria

1. The bot SHALL NOT ask the user to send SMS codes, Telegram codes, PIN, CVV, passwords, card photos, seed phrases or intimate material.
2. The bot SHALL NOT advise paying blackmailers or sending more material.
3. The bot SHALL NOT claim hidden Telegram scam labels, account age or complaint history.
4. The implementation SHALL preserve deterministic routing and not add AI-dependent behavior.

