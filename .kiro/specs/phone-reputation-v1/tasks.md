# Tasks: Phone Reputation v1

## 1. Spec And Scope

- [x] Define reputation as confirmed Ishonch Guard moderated reports only.
- [x] Document no-owner, no-carrier-data, no-hidden-label limits.

## 2. Core Risk Layer

- [x] Add `PhoneReputationSummary`.
- [x] Build phone reputation from confirmed `entities` rows only.
- [x] Preserve existing `known_reported` scoring behavior.

## 3. Telegram Formatting

- [x] Render source, count and confidence for confirmed phone reports.
- [x] Prefer phone-specific wording over generic known-reports wording.
- [x] Keep raw phone numbers out of user-facing output.

## 4. Tests

- [x] Test moderation gate and confidence thresholds.
- [x] Test `runCheck` enrichment.
- [x] Test Telegram wording and limits.

## 5. Verification

- [x] Run full test/typecheck/lint/build suite.
- [x] Run production smoke after deploy.
