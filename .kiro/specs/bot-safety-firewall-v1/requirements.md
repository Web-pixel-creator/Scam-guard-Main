# Requirements - Bot Safety Firewall v1

## 1. Unsafe AI Output Blocking

**User story:** As a user, I want Ishonch Guard to stay safe even if a scammer tries to manipulate the bot prompt, so that the bot never asks me for secrets or money.

### Acceptance criteria

1. The system SHALL treat all AI-authored user-facing text as untrusted output.
2. The system SHALL block AI-authored explanations that ask the user to send, enter, share, name or provide SMS codes, OTP, PIN, CVV/CVC, passwords, seed phrases, private keys, full card numbers or passport data.
3. The system SHALL block AI-authored explanations that ask the user to install APKs/protective apps, connect wallets, sign transactions, transfer money, deposit funds, pay fees or top up balances.
4. The system SHALL block AI-authored text that leaks or follows prompt-injection language such as "ignore previous instructions" or "system prompt".
5. When an AI-authored explanation is blocked, the check result SHALL keep deterministic score, level, reason codes and safe advice, but `explanation` SHALL become `null`.

## 2. Safe Warning Preservation

**User story:** As a user, I still need clear warnings about SMS codes, CVV and APKs, so the safety filter must not remove legitimate "do not share" advice.

### Acceptance criteria

1. The system SHALL allow safe warnings such as "Do not share the SMS code" or "Never enter CVV".
2. The system SHALL allow deterministic non-AI emergency templates and rule-based advice to continue working.
3. The system SHALL preserve OCR/STT/check input evidence for scoring; the firewall applies only to AI-authored user-facing text.

## 3. Persistence Boundary

**User story:** As an operator, I do not want unsafe AI text stored in the database.

### Acceptance criteria

1. Unsafe AI explanations SHALL NOT be returned to Telegram or web callers.
2. Unsafe AI explanations SHALL NOT be inserted into `checks.ai_explanation`.
3. Structured image AI summaries SHALL be sanitized before they can become fallback user-facing text.
