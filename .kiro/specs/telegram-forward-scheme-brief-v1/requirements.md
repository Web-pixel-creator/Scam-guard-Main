# Requirements: Telegram Forward Scheme Brief v1

## 1. Mini-Brief for Forwarded Telegram Posts

When a user forwards a public Telegram channel/group post, the bot shall include a compact mini-brief in the result explanation:

- visible source;
- likely scheme category;
- likely attacker goal;
- one safe next step;
- explicit limitation that hidden Telegram labels, account age and report history are not visible.

## 2. No False Authority

The bot shall not claim that a channel/user is definitely a scammer, newly created, spam-sending, Telegram-reported or hidden-SCAM-labelled unless a real trusted source exists.

## 3. Privacy Boundary

Forward source metadata shall remain reply-only. It shall not be appended to `runCheck` input and shall not be persisted in `checks`.

## 4. Mobile Readability

The formatted Telegram result shall preserve the useful source/scheme/goal/step lines without becoming a wall of text or exceeding Telegram limits.

## 5. Trilingual Coverage

The mini-brief shall support RU, UZ and EN.
