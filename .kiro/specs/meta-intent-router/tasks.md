# Implementation Plan: Meta Intent Router

## Overview

Implement a lightweight, deterministic meta-intent classification layer that detects when a user is asking a question TO the bot itself (about capabilities, methodology, or prior failures) rather than submitting text for scam-risk analysis. The classifier is a pure synchronous TypeScript function using keyword/regex matching across three languages (ru, uz, en) with a strict scam-context signal override to ensure security coverage is never reduced.

## Tasks

- [x] 1. Create meta-intent classifier module
  - [x] 1.1 Create `src/lib/meta-intent.ts` with types, scam-context signal detection, and classification logic
    - Define `MetaIntent` type union: `how_to_use | what_can_you_do | how_do_you_check | why_failed | explain_risk | telegram_account_limits | help`
    - Define `ClassifyOptions` interface with `isForwarded?: boolean`
    - Implement `hasScamContextSignal(text)` — detect URLs, phone numbers, Telegram links, bank/payment terms, APK references, text >200 chars
    - Implement `hasScamWordingPattern(text)` — detect scam phrases like "безопасный счёт", "не кладите трубку", "xavfsiz hisob"
    - Implement intent keyword/regex patterns for all 7 intents across ru/uz/en
    - Implement `classifyMetaIntent(text, options?)` — check forwarded → scam signals → scam wording → keyword match → null
    - Implement `getMetaIntentResponse(intent, lang)` — lookup response template from `bot_dict`
    - Export `classifyMetaIntent` and `getMetaIntentResponse`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2_

  - [x]\* 1.2 Write property test: known meta-intent patterns are correctly classified (Property 1)
    - **Property 1: Known meta-intent patterns are correctly classified**
    - **Validates: Requirements 1.1, 1.2, 1.3, 2.5**
    - Create `src/lib/meta-intent.property.test.ts`
    - Use `fc.constantFrom(...canonicalPatterns)` × `fc.constantFrom("ru","uz","en")` with random casing/padding
    - Verify classifier returns the correct MetaIntent for each canonical phrase when no scam signal is present

  - [x]\* 1.3 Write property test: scam context signals always override meta-intent detection (Property 2)
    - **Property 2: Scam context signals always override meta-intent detection**
    - **Validates: Requirements 2.1, 2.3**
    - Use `fc.oneof(urlArb, phoneArb, tgLinkArb, bankTermArb, longTextArb, scamWordingArb)` combined with meta-intent keywords
    - Verify classifier returns `null` regardless of keyword presence

  - [x]\* 1.4 Write property test: forwarded messages always bypass meta-intent detection (Property 3)
    - **Property 3: Forwarded messages always bypass meta-intent detection**
    - **Validates: Requirements 2.2**
    - Use `fc.string()` with `{ isForwarded: true }`
    - Verify classifier always returns `null`

  - [x]\* 1.5 Write property test: non-matching text returns null (Property 4)
    - **Property 4: Non-matching text returns null**
    - **Validates: Requirements 1.4**
    - Use `fc.string()` filtered to exclude all known meta-intent keywords
    - Verify classifier returns `null`

  - [x]\* 1.6 Write unit tests for meta-intent classifier
    - Create `src/lib/meta-intent.test.ts`
    - Test specific scenarios from Requirement 6.7: (a) URL + help wording → null; (b) "почему это опасно?" → explain_risk; (c) "как проверить номер?" → how_do_you_check; (d) forwarded text → null; (e) URL + help → null; (f) all 7 intents in RU/UZ/EN; (g) Telegram account visibility limits → `telegram_account_limits`; (h) empty/whitespace → null
    - _Requirements: 6.7_

- [x] 2. Add response templates to bot-i18n
  - [x] 2.1 Add seven `meta_*` entries to `bot_dict` in `src/lib/telegram/bot-i18n.ts`
    - Add `meta_how_to_use` — explain how to use the bot (ru/uz/en)
    - Add `meta_what_can_you_do` — explain bot capabilities (ru/uz/en)
    - Add `meta_how_do_you_check` — explain methodology without exposing scoring weights (ru/uz/en)
    - Add `meta_why_failed` — explain OCR/image limitations, suggest sending text manually (ru/uz/en)
    - Add `meta_explain_risk` — describe risk levels (safe, unknown, suspicious, high_risk) in practical terms (ru/uz/en)
    - Add `meta_telegram_account_limits` — explain visible Telegram account checks and hidden-data limitations (ru/uz/en)
    - Add `meta_help` — general help response (ru/uz/en)
    - Each template must be under 1000 characters per language
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.6_

  - [x]\* 2.2 Write property test: classification-to-response round trip (Property 5)
    - **Property 5: Classification-to-response round trip**
    - **Validates: Requirements 3.1, 6.5**
    - Use `fc.constantFrom(...ALL_INTENTS)` × `fc.constantFrom("ru","uz","en")`
    - Verify `getMetaIntentResponse(intent, lang)` produces a non-empty string

  - [x]\* 2.3 Write property test: response template length constraint (Property 6)
    - **Property 6: Response template length constraint**
    - **Validates: Requirements 6.6**
    - Use `fc.constantFrom(...ALL_INTENTS)` × `fc.constantFrom("ru","uz","en")`
    - Verify each template string is under 1000 characters

- [x] 3. Checkpoint - Verify classifier and templates
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate with Telegram router
  - [x] 4.1 Add meta-intent classification step in `dispatchUpdate` within `src/lib/telegram/router.ts`
    - Import `classifyMetaIntent` and `getMetaIntentResponse` from `src/lib/meta-intent.ts`
    - In `dispatchUpdate`, when `action.kind === "check"`, invoke `classifyMetaIntent(action.content, { isForwarded: !!update.message?.forward_origin })`
    - If intent is matched, send the response template via `sendMessage` and return early
    - If null, proceed to `handleCheck` unchanged
    - Ensure meta-intent classification is AFTER callback, command, and scenario checks (priority order preserved)
    - Pass `forward_origin` flag correctly to classifier
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x]\* 4.2 Write integration tests for router meta-intent handling
    - Create `src/lib/telegram/handlers/meta-intent.integration.test.ts`
    - Test router priority: commands, callbacks, scenarios all bypass meta-intent
    - Test that plain text meta-question triggers classifier before handleCheck
    - Test that `forward_origin` flag is passed correctly
    - Test that non-matching text still routes to handleCheck
    - _Requirements: 4.1, 4.6, 6.7g, 6.7h_

- [x] 5. Integrate with web channel
  - [x] 5.1 Add meta-intent classification to `checkInput` in `src/lib/check.functions.ts`
    - Import `classifyMetaIntent` and `getMetaIntentResponse` from `src/lib/meta-intent.ts`
    - Before calling `runCheck`, invoke `classifyMetaIntent(data.input)`
    - If intent is matched, return `{ metaIntent: intent, response: getMetaIntentResponse(intent, data.lang) }` instead of risk result
    - If null, proceed to `runCheck` unchanged
    - Ensure texts with Scam_Context_Signals still route to `runCheck`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x]\* 5.2 Write unit tests for web channel meta-intent integration
    - Test that meta-questions return template text instead of risk result
    - Test that texts with URLs/phones/etc. still route to runCheck
    - Test that the same classifier function is used as Telegram channel
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The classifier is a pure synchronous function — no async, no I/O, no external dependencies
- All response templates must be under 1000 characters per language for mobile readability
- The `forward_origin` flag from Telegram updates must be passed to the classifier to ensure forwarded scam messages are never intercepted

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "1.2", "1.3", "1.4", "1.5", "1.6"] },
    { "id": 2, "tasks": ["2.2", "2.3", "4.1", "5.1"] },
    { "id": 3, "tasks": ["4.2", "5.2"] }
  ]
}
```
