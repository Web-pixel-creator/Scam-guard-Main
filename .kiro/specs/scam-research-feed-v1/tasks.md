# Tasks: Scam Research Feed v1

- [x] 1. Add source-backed coverage notes
  - Update `SCAM_COVERAGE.md` with Telegram account-takeover phishing and dropper recruitment.
  - Note that pressauz/pressa.uz is research input only.

- [x] 2. Add reason codes
  - Extend `ReasonCode`, weights, labels, and patterns.
  - Keep thresholds unchanged.

- [x] 3. Add context-aware advice
  - Add account-takeover advice.
  - Add card/SIM/account transfer advice.
  - Keep advice max 3 bullets.

- [x] 4. Add tests
  - Positive/negative examples for both patterns.
  - Scoring assertions.
  - Telegram formatting sanity check.

- [x] 5. Verify and release
  - Run targeted tests.
  - Run full tests, type-check, lint, audit, build.
  - Open PR, merge after CI, deploy, smoke test Railway.
