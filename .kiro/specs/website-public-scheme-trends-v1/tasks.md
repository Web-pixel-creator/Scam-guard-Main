# Implementation Plan

- [x] 1. Add public scheme-trends data helper
  - [x] Define safe trend entries and labels
  - [x] Add stats/filter helpers
  - [x] Add focused tests

- [x] 2. Add public trends UI
  - [x] Create route `/scam-trends`
  - [x] Create searchable/filterable trends panel
  - [x] Add honest source/privacy wording

- [x] 3. Add homepage and navigation entry points
  - [x] Add homepage teaser
  - [x] Link header/footer to the trends page
  - [x] Keep existing `/scams` knowledge base intact

- [ ] 4. Verify and ship
  - [x] Run targeted tests, typecheck, lint, full tests and build
  - [x] Browser-check homepage and trends route on desktop/mobile
  - [x] Update AI docs
  - [ ] Commit, push and verify Railway production
