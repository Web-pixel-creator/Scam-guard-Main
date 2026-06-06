# Tasks: Phone Directory v1

## 1. Spec And Scope

- [x] Define Phone Directory v1 as official-only, not crowd-sourced.
- [x] Document no-owner-inference rule for unknown numbers.

## 2. Core Metadata

- [x] Enrich verified contact result with localized display metadata.
- [x] Keep dangerous signals overriding official matches.

## 3. Telegram Formatting

- [x] Improve official-contact badge with source/confidence context.
- [x] Improve unknown phone brief and next-step prompt.

## 4. Regression Tests

- [x] Test localized official-contact names.
- [x] Test unknown phone does not claim an owner.
- [x] Test spoofing warning remains visible.
- [x] Test dangerous behavior overrides verified match.

## 5. Verification And Release

- [x] Run targeted tests.
- [x] Run full tests, typecheck, lint, build and audit.
- [x] Run diff-focused security review.
- [x] Open PR, merge after CI, deploy to Railway and smoke-test production.
