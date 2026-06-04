# Implementation Plan: Telegram UX Polish

## Overview

Пять независимых улучшений UX Telegram-бота Ishonch Guard, организованные как отдельные PR для удобства ревью. Каждый PR — самодостаточный набор задач: command menu localization, перезапись «Как я решаю?», фикс ложных срабатываний card-детектора, редизайн panic-меню, и сокращение emergency-текстов + финальные тесты. Язык реализации — TypeScript (Vitest + fast-check).

## Tasks

- [x] 1. PR 1: Telegram Command Menu (script + localization)
  - [x] 1.1 Rewrite `scripts/set-bot-commands.ts` with per-language `setMyCommands`
    - Refactor existing `set-bot-commands.ts`: export `buildCommandPayloads()` returning 4 payloads (ru, uz, en + default without `language_code`)
    - Register commands: `start`, `check`, `report`, `panic`, `safety`, `lang`
    - Use `/report` with description "Сообщить о случае" (NOT "Сообщить о мошеннике") — match across all langs
    - Remove 3-language combined descriptions from command menu — each language_code gets its own single-language description
    - Read token via `getTelegramBotToken()` from `@/lib/config.server`; exit non-zero on missing token (no secrets printed)
    - Send one `setMyCommands` API request per payload with `language_code` BCP-47 parameter
    - Keep inline language buttons on `/start` for onboarding unchanged — this task does NOT modify the /start handler
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x]* 1.2 Write unit tests for `buildCommandPayloads`
    - Verify exactly 4 payloads (ru, uz, en, default)
    - Verify each payload contains the 6 required commands
    - Verify `language_code` set correctly per payload (absent for default)
    - Verify descriptions are single-language (no multi-language combined strings)
    - Verify `/report` description uses "Сообщить о случае" (ru), not "мошеннике"
    - Verify descriptions are within Telegram 3–256 char limit
    - _Requirements: 5.7_

  - [x]* 1.3 Write test that `/start` still has inline language buttons
    - Verify `/start` handler still sends inline keyboard with language selection buttons (ru/uz/en)
    - Ensure command menu changes do not affect onboarding flow
    - _Requirements: 1.1_

- [x] 2. Checkpoint — PR 1 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. PR 2: "Как я решаю?" rewrite (bot-i18n text change)
  - [x] 3.1 Rewrite `why_explanation` text in `src/lib/telegram/bot-i18n.ts`
    - Replace existing `why_explanation` entries for all 3 langs (ru, uz, en)
    - Use a numbered list of ≤5 plain-language steps explaining what the bot checks in simple words:
      - OTP/PIN/CVV requests, APK file links, money transfer pressure, fake bank calls, caller ID spoofing patterns
    - MUST NOT mention: numeric weights, score thresholds, hashes, masks, "30+ rules", or any internal scoring
    - Preserve the 🔒 privacy note at the end
    - Keep each variant within 800 characters
    - Technical/admin explanation can exist separately if needed, but the default user-facing text must be plain language only
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x]* 3.2 Write property test for Why_Explanation well-formedness
    - **Property 1: Why_Explanation well-formedness**
    - For all 3 langs verify: ≤800 chars, no weight/threshold patterns (digits + "≥", "=", "score", "вес", "порог", "hash", "mask", "30+" patterns), ≤5 numbered items, ends with 🔒 privacy note
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

  - [x]* 3.3 Write test that "Как я решаю?" has no technical jargon
    - Verify text does not contain: "score", "weight", "threshold", "hash", "mask", "вес", "порог", "хеш", "маск", "30+"
    - Verify for all 3 langs (ru, uz, en)
    - _Requirements: 2.1_

- [x] 4. Checkpoint — PR 2 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. PR 3: OCR/barcode false-positive fix (detect.ts card logic)
  - [x] 5.1 Implement `luhnCheck` function in `src/lib/risk/detect.ts`
    - Export a pure `luhnCheck(digits: string): boolean` implementing the Luhn algorithm
    - _Requirements: 3.4_

  - [x] 5.2 Implement `shouldRedactAsCard` with context-word gating in `src/lib/risk/detect.ts`
    - Export `CARD_CONTEXT_WORDS` array with payment/card context words (case-insensitive): карта, карту, банк, пин, cvv, cvc, pin, karta, bank, card, uzcard, humo, оплата, перевод, реквизиты, срок действия
    - Export `shouldRedactAsCard(digitSequence, surroundingText, matchStart, matchEnd): boolean`
    - Context-required detection: 13–19 digit sequences are flagged as card ONLY when context words appear within 120 chars
    - Exception: 16-digit Luhn-valid sequences are redacted unconditionally (high confidence)
    - Barcode/EAN sequences (no payment context) must NOT trigger card redaction
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 5.3 Refactor `redactText` to use context-aware card detection
    - Replace current `CARD_RE` blanket replacement with `shouldRedactAsCard` call
    - Phone (`PHONE_INLINE_RE`) and OTP (`OTP_RE`) patterns remain unchanged and applied before card logic
    - Beverage ad / barcode screenshots with digit sequences must NOT trigger card risk
    - _Requirements: 3.1, 3.2, 3.5_

  - [x]* 5.4 Write property test for context-word gated card redaction
    - **Property 2: Context-word gated card redaction**
    - Generate random 13–19 digit sequences (non-Luhn-16-passing) with/without context words at varying distances; verify redaction occurs iff context word within 120 chars
    - **Validates: Requirements 3.1, 3.2, 3.3, 5.6**

  - [x]* 5.5 Write property test for Luhn-16 unconditional redaction
    - **Property 3: Luhn-16 unconditional redaction**
    - Generate Luhn-valid 16-digit sequences in arbitrary surrounding text (no context words); verify always redacted
    - **Validates: Requirements 3.4, 5.6**

  - [x]* 5.6 Write property test for phone/OTP redaction invariance
    - **Property 5: Phone and OTP redaction invariance**
    - Generate phone-like (7+ digits with +prefix) and OTP-like (4-8 digit) patterns; verify still masked after card-detection refactor
    - **Validates: Requirements 3.5**

  - [x]* 5.7 Write test that barcode/ad OCR does not trigger card risk
    - Test with real-world-like inputs: EAN-13 barcode digits, tracking numbers, beverage ad screenshots — verify no card redaction without payment context
    - _Requirements: 3.1, 3.2_

- [x] 6. Checkpoint — PR 3 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. PR 4: Panic/live-call flow redesign (handlers + emergency)
  - [x] 7.1 Add `editMessageText` helper to `src/lib/telegram/api.server.ts`
    - Export `editMessageText(opts: EditMessageOptions): Promise<{ok: boolean}>` following `sendMessage` pattern
    - Accept `chatId`, `messageId`, `text`, optional `keyboard` and `parseMode`
    - Return `{ok: false}` on error (no throw) — same convention as sendMessage
    - _Requirements: 4.2, 4.3_

  - [x] 7.2 Extend `HandlerCtx` in `src/lib/telegram/router.ts` with `messageId`
    - Add optional `messageId?: number` populated from `callback_query.message.message_id`
    - Wire in `dispatchUpdate` when processing callback queries
    - _Requirements: 4.2, 4.3_

  - [x] 7.3 Implement paginated panic keyboard builders in `src/lib/telegram/emergency.ts`
    - Export `buildPanicKeyboardPage1(lang): InlineKeyboard` — 6 scenario buttons (1–6, 2 per row) + "Другие ситуации" / "Boshqa vaziyatlar" / "Other situations" button (callback: `panic:more`)
    - Export `buildPanicKeyboardPage2(lang): InlineKeyboard` — 4 scenario buttons (7–10, 2 per row) + "← Назад" / "← Orqaga" / "← Back" button (callback: `panic:back`)
    - All callback_data strings remain `panic:` prefixed
    - Do NOT show all 10 buttons at once
    - _Requirements: 4.1, 4.2, 4.3, 4.6_

  - [x] 7.4 Reframe scenario 6 (live-call) header and button text in `emergency.ts`
    - Update scenario 6 text to lead with: "Завершите звонок. Скажите: Я сам перезвоню по официальному номеру." (ru) / equivalents for uz/en
    - Rename the "Положить трубку" button to "Я положил трубку" / "Что делать после звонка" — the bot cannot hang up for the user
    - Keep copilot sub-buttons for post-call actions
    - _Requirements: 4.4_

  - [x] 7.5 Update panic callback handler in `src/lib/telegram/handlers/misc.ts`
    - Handle `panic:more` → `editMessageText` with page 2 keyboard
    - Handle `panic:back` → `editMessageText` with page 1 keyboard
    - Fallback: if `editMessageText` returns `{ok: false}`, send a new message instead (graceful degradation)
    - Handle `panic:N` → send scenario text as NEW message (preserve menu for further interaction)
    - Wire through `messageId` from `HandlerCtx`
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [x] 7.6 Update `/panic` command handler in `src/lib/telegram/handlers/commands.ts`
    - Use `buildPanicKeyboardPage1(lang)` instead of current flat layout
    - Send via `sendMessage` (initial message)
    - _Requirements: 4.1_

  - [x]* 7.7 Write tests for panic menu submenu/edit flow
    - Verify `panic:more` triggers `editMessageText` with page 2
    - Verify `panic:back` triggers `editMessageText` with page 1
    - Verify fallback: when edit fails, a new message is sent
    - Verify `panic:N` sends a new message (not edit)
    - _Requirements: 4.2, 4.3, 4.5_

  - [x]* 7.8 Write test that live-call first message tells user to end the call
    - Verify scenario 6 text starts with "Завершите звонок" (ru) / equivalents (uz, en)
    - Verify button text is "Я положил трубку" or "Что делать после звонка", not "Положить трубку"
    - _Requirements: 4.4_

- [x] 8. Checkpoint — PR 4 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. PR 5: Emergency text shortening + all tests
  - [x] 9.1 Shorten emergency scenario texts in `src/lib/telegram/emergency.ts`
    - Rewrite each scenario's steps to stay within 1500 characters per lang
    - Structure each response as: **Что произошло** → **Что сделать сейчас** → **Официальные контакты** → **Disclaimer**
    - Start each scenario with the single most important action in UPPERCASE/bold
    - Remove filler phrases and redundant safety reminders
    - Keep victim-friendly language for sextortion/romance scenarios
    - Avoid guarantee-like claims (e.g., "most blackmailers will not publish") — use careful wording instead
    - Keep contact numbers pulled dynamically from verified-contacts module
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x]* 9.2 Write property test for emergency text well-formedness
    - **Property 4: Emergency text well-formedness**
    - For all 10 scenarios × 3 langs: verify ≤1500 chars, first content line starts with uppercase action word, contains at least one phone/short-code from VERIFIED_CONTACTS
    - **Validates: Requirements 5.1, 5.2, 5.4, 5.5**

  - [x]* 9.3 Write unit tests for panic keyboard structure
    - Verify `buildPanicKeyboardPage1` returns 7 buttons (6 scenarios + "more")
    - Verify `buildPanicKeyboardPage2` returns 5 buttons (4 scenarios + "back")
    - Verify all callback_data strings are `panic:` prefixed
    - Test for all 3 langs (ru, uz, en)
    - _Requirements: 4.1, 4.6_

  - [x]* 9.4 Write tests for RU/UZ/EN string completeness
    - Verify all user-facing strings in emergency.ts, bot-i18n.ts, and command payloads exist for all 3 langs
    - Verify no lang variant is empty or falls back to a different lang silently
    - _Requirements: 1.2, 2.3, 5.1_

- [x] 10. Final checkpoint — all PRs complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each PR is self-contained and can be merged independently
- Property tests use fast-check with minimum 100 iterations, tagged `Feature: telegram-ux-polish, Property N: <title>`
- The existing `set-bot-commands.ts` is refactored in-place (same file)
- All changes are server-side TypeScript — no client bundle impact
- `editMessageText` follows the same error-handling pattern as existing `sendMessage`
- `/start` inline language buttons are preserved — command menu localization is separate from onboarding
- Live-call scenario reframes the action as post-call guidance since the bot cannot literally hang up for the user
- Emergency text uses victim-friendly language and avoids guarantee-like promises

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1", "5.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "3.2", "3.3", "5.2"] },
    { "id": 2, "tasks": ["5.3", "7.1", "7.2"] },
    { "id": 3, "tasks": ["5.4", "5.5", "5.6", "5.7", "7.3", "7.4"] },
    { "id": 4, "tasks": ["7.5", "7.6"] },
    { "id": 5, "tasks": ["7.7", "7.8", "9.1"] },
    { "id": 6, "tasks": ["9.2", "9.3", "9.4"] }
  ]
}
```
