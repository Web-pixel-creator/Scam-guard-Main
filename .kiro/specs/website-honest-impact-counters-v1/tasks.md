# Implementation Plan

- [x] 1. Define the feature boundary
  - [x] Add requirements/design/tasks spec
  - [x] State aggregate-only privacy constraints

- [x] 2. Add aggregate stats support
  - [x] Add migration for extended `get_check_stats()`
  - [x] Add TypeScript normalization and tests
  - [x] Extend the web server function with safe fallbacks

- [x] 3. Add homepage impact UI
  - [x] Add compact impact cards
  - [x] Add honest loss wording
  - [x] Link the component into the homepage

- [ ] 4. Verify and ship
  - [x] Run targeted tests, typecheck, lint, full tests and build
  - [x] Browser-check homepage on desktop/mobile
  - [x] Update AI docs
  - [ ] Commit, push and verify Railway production
