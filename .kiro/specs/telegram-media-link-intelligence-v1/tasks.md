# Tasks: Telegram Media & Link Intelligence v1

- [x] 1. Route media captions before unsupported-media fallback
  - [x] 1.1 Add caption helper in `router.ts`
  - [x] 1.2 Route video/audio/voice/non-image document captions to `check`
  - [x] 1.3 Keep image/photo routing unchanged

- [x] 2. Improve unsupported media text
  - [x] 2.1 Explain that video/voice are not analyzed yet
  - [x] 2.2 Ask for caption link, text, QR target, screenshot, or short situation summary
  - [x] 2.3 Provide ru/uz/en strings

- [x] 3. Normalize private Telegram invites
  - [x] 3.1 Extract `+inviteCode` from `t.me/+...`
  - [x] 3.2 Support links embedded in longer captions

- [x] 4. Add betting/prediction promo signal
  - [x] 4.1 Add `gambling_prediction_promo` reason code
  - [x] 4.2 Add weight and trilingual labels
  - [x] 4.3 Require gambling context plus invite/subscription/win/profit action signal
  - [x] 4.4 Add neutral false-positive guards

- [x] 5. Add context-aware advice
  - [x] 5.1 Add betting-channel advice
  - [x] 5.2 Ensure private invite links also get link-safety advice

- [x] 6. Verify
  - [x] 6.1 Add router tests
  - [x] 6.2 Add detect tests
  - [x] 6.3 Add risk-rule tests
  - [x] 6.4 Add advice-filter tests
- [x] 6.5 Run targeted tests, full tests, typecheck, build

- [x] 7. Live-feedback polish for unsupported video/audio
  - [x] 7.1 Replace the generic "how it works" fallback button with a media-specific "What to send?" action.
  - [x] 7.2 Add RU/UZ/EN capture instructions: screenshot frame, caption/comment link, QR target, username, payment details, promise/action summary.
  - [x] 7.3 Add webhook and QA matrix regression tests.
