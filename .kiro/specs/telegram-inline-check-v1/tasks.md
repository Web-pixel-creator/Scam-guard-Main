# Tasks: Telegram Inline Check v1

## Baseline

- [x] Parse and route `inline_query` without a chat id.
- [x] Add `answerInlineQuery` article support.
- [x] Keep Inline checks rules-only and non-persistent.
- [x] Add RU/UZ/EN help, result and failure articles.

## Privacy And Protocol Hardening

- [x] Enforce the 256-character input boundary.
- [x] Pass `skipAi=true`, `skipUrlReputation=true` and `persist=false` to
      `runCheck`.
- [x] Re-mask result and human-intent displays at the final Inline boundary.
- [x] Fail malformed URL/APK displays closed to `[link]`.
- [x] Bound descriptions to 120 characters and inserted messages to 4096.
- [x] Retry Telegram entity-parse failures once with safe plain text.

## Exhaustive Reason Presentation

- [x] Define `INLINE_REASON_POLICY` as an exhaustive typed record for all 55
      reason codes.
- [x] Assign every reason an explicit priority, evidence method/source class and
      limitation.
- [x] Add deterministic priority plus lexical tie-break ordering.
- [x] Include official-directory and moderated-report result metadata in the
      canonical ranked presentation set.
- [x] Add the 55 × 3 RU/UZ/EN real-adapter regression matrix.
- [x] Add ordering, masking and 256/120/4096 boundary regressions.

## Release Evidence

- [x] Deploy the current exhaustive Inline presentation hardening. Revision
      `4bd9403` is running as Railway deployment `8064b403` and the synthetic
      Inline production smoke passes.
- [ ] Run the real Telegram Desktop/Android/iOS RU/UZ/EN visual and insertion
      matrix.
- [ ] Capture sanitized screenshots and confirm no `checks`, session or
      moderator side effects.
