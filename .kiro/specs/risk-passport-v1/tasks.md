# Tasks

- [ ] 1. Inventory existing passport-related code
  - Find current Telegram username passport, phone passport, reputation and
    official-number formatting code.
  - Identify duplicated strings that should move behind a shared builder.

- [ ] 2. Add pure Risk Passport builder
  - Implement target selection for Telegram username/link, phone and short code.
  - Preserve normal high-risk/suspicious result rendering when strong scam
    evidence exists.
  - Keep builder free of Telegram send/edit side effects.

- [ ] 3. Add Telegram formatting and i18n
  - Add RU/UZ/EN copy for visible facts, unavailable facts, reputation facts and
    next evidence prompts.
  - Keep common no-report passport under roughly 900 characters.
  - Replace "Проверить ещё" with a clearer "Новая проверка" meaning.

- [ ] 4. Add contextual passport buttons
  - Add code, card, transfer, APK/app, link/QR, live call and new-check buttons.
  - Route each context button to concrete safety guidance.
  - Prevent context button taps from re-running the same shallow check.

- [ ] 5. Update web/embed compact rendering where relevant
  - Reuse the same passport data for web and iframe summaries.
  - Keep partner embed output compact and privacy-preserving.

- [ ] 6. Add tests
  - Unit-test builder evidence boundaries.
  - Snapshot-test RU/UZ/EN Telegram copy.
  - Regression-test that Telegram account age, hidden scam labels, spam history,
    DC/country and unmoderated reports are never claimed.
  - Regression-test that OTP/card/APK/payment evidence remains high risk.

- [ ] 7. Verify and document
  - Run targeted tests, full tests, typecheck/build and bot smoke scenarios.
  - Update `ROADMAP.md`, `OPEN_TASKS.md`, `FILE_MAP.md`, `FUNCTIONS_MAP.md` and
    `CHANGELOG_AI.md` when implemented.
