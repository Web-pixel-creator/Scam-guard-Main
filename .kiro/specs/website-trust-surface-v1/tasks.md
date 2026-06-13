# Implementation Plan

- [x] 1. Add official-directory helper module
  - [x] Implement stats, grouping, search/filter and action helpers
  - [x] Add focused unit tests

- [x] 2. Add public directory route
  - [x] Create `/official-numbers`
  - [x] Render searchable/filterable directory
  - [x] Add honest callback/spoofing guidance

- [x] 3. Improve homepage trust surface
  - [x] Add verified-contact count to stats strip
  - [x] Add homepage trust block linking to the directory
  - [x] Avoid accusatory wording in aggregate labels

- [x] 4. Verify and ship
  - [x] Run targeted tests, typecheck, lint, full tests and build
  - [x] Browser-check homepage and directory on desktop/mobile
  - [x] Update AI docs
  - [x] Commit, push and verify Railway production
