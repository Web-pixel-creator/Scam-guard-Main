# Implementation Plan

- [x] 1. Add public app URL helper
  - Read `PUBLIC_APP_URL`, validate HTTPS/HTTP URL, fallback to production URL.

- [x] 2. Add Telegram `/appeal` entrypoint
  - Add command parsing, trilingual copy, URL button, and report fallback.

- [x] 3. Polish `/appeal` page copy
  - Add appeal-vs-report explanation, examples, privacy warnings, and clearer success text.

- [x] 4. Add tests
  - Cover `/appeal` parser and webhook behavior without changing `/start` compact menu.

- [x] 5. Verify and ship
  - Run targeted tests, full test suite, build, commit, push, and production smoke if deployed.
