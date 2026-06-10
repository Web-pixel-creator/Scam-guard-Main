# Tasks: Scam Research Feed v2

- [x] 1. Document Web3/Telegram promo scam coverage
  - Add categories to `ai_docs/SCAM_COVERAGE.md`.
  - Record external source links and the conservative scoring rule.

- [x] 2. Add reason codes and scoring
  - Extend `ReasonCode`, weights and labels.
  - Add two-part detectors for casino, CAPTCHA/vote, task reward, wallet urgency and TON referral earning.

- [x] 3. Add context-aware advice and Telegram metadata labels
  - Reuse gambling/giveaway advice where appropriate.
  - Add wallet-specific advice.
  - Add compact Telegram public metadata labels.

- [x] 4. Add regression tests
  - Cover screenshot-derived examples.
  - Cover negatives for ordinary news/product posts.
  - Update property/formatter code universes.

- [x] 5. Verify and release
  - Run targeted tests.
  - Run full tests, type-check, lint, build and secret sanity checks.
  - Commit, push, wait for Railway deploy and run production smoke.
