# Tasks: Telegram Inline Check v1

## 1. Spec

- [x] Define inline-mode boundaries and privacy rules.
- [x] Document no-AI, no-persistence preview behavior.

## 2. Core Persistence Switch

- [x] Add `persist?: boolean` to `RunCheckParams`.
- [x] Keep default behavior unchanged for web and normal Telegram checks.
- [x] Skip `checks` insert only when `persist === false`.

## 3. Bot API Helper

- [x] Add `answerInlineQuery`.
- [x] Support article results with `InputTextMessageContent`.
- [x] Test method and payload shape.

## 4. Router

- [x] Parse `inline_query`.
- [x] Dispatch inline updates before chat-based target extraction.
- [x] Add a stub handler and concrete handler contract.

## 5. Inline Handler

- [x] Return help article for empty query.
- [x] Run rules-only non-persistent check for non-empty query.
- [x] Format compact RU/UZ/EN article and inserted message.
- [x] Handle rate limit and unexpected errors safely.

## 6. Verification

- [x] Add unit and integration tests.
- [x] Update AI docs and roadmap.
- [x] Run test/typecheck/lint/build/security checks.
- [x] Commit, push and deploy.
