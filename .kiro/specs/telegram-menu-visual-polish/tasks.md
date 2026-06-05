# Implementation Plan:

## Overview

Implementation of Result Message UX v2 for the Telegram bot. Refactors the check result formatter into a template-driven system with risk-level-specific layouts, verdict lines, truncated AI explanations, context-aware advice, and extended inline buttons.

## Tasks

- [x] 1. Create template router module `src/lib/telegram/templates.ts` with `SectionId` type, `RiskTemplate` type, `TEMPLATES` record (safe/unknown/suspicious/high_risk section orders), `SECTION_EMOJI` mapping, and `SECTION_TITLE_KEY` mapping
- [x] 2. Add verdict line entries to `bot_dict` in `src/lib/telegram/bot-i18n.ts`: `verdict_safe`, `verdict_unknown`, `verdict_suspicious`, `verdict_high_risk` with trilingual (ru/uz/en) text
- [x] 3. Add section title entries to `bot_dict`: `section_brief`, `section_reasons`, `section_noticed`, `section_action_now`, `section_safe_steps`, `section_why_danger`, `section_where_report` (max 15 chars each, all three languages)
- [x] 4. Add context-specific advice strings to `bot_dict`: `advice_crypto_topic_only`, `advice_send_more_context`, `prompt_more_context` in all three languages
- [x] 5. Update button labels in `bot_dict`: change `btn_check_another` text to use 🔁 emoji, update `btn_emergency` to "🆘 Что делать срочно" / trilingual equivalents, add `btn_why` entry "❓ Почему так?" / trilingual
- [x] 6. Create `src/lib/telegram/truncate.ts` with `truncateExplanation(text, options?)` function implementing max 5 lines / 280 chars limit, sentence-boundary preservation, and "…" append on truncation
- [x] 7. Write unit tests for truncation in `src/lib/telegram/__tests__/truncate.test.ts` covering: short text no-op, long text truncation, multi-language text, empty string, single long line edge case
- [x] 8. Create `src/lib/telegram/advice-filter.ts` with `filterAdvice(level, reasons, lang)` function implementing reason-to-advice mapping, topic-only detection for unknown level, and max 3 items limit
- [x] 9. Write unit tests for advice filter in `src/lib/telegram/__tests__/advice-filter.test.ts` covering: high_risk with multiple reasons, unknown with no reasons, unknown with crypto-only context, suspicious with mixed reasons
- [x] 10. Refactor `formatCheckResult` in `src/lib/telegram/format.ts` to use template-driven rendering: look up `TEMPLATES[result.level]`, iterate sections, render each with emoji header + bold title + content
- [x] 11. Implement section sub-renderers in `format.ts`: `renderRiskHeader`, `renderVerdict`, `renderBrief` (uses truncateExplanation), `renderReasons`, `renderAdvice` (uses filterAdvice), `renderWhyDangerous`, `renderWhereReport`, `renderMoreContext`
- [x] 12. Implement section joining with thin separator (┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈) between blocks; no separator before first or after last block
- [x] 13. Add 4096-char overflow protection: if assembled text exceeds limit, progressively drop trailing sections while keeping header + verdict + first action section
- [x] 14. Update `buildResultKeyboard` to use new button labels (📢 Report, 🔁 Check another, ❓ Why?) for all levels, add 🆘 Emergency button for high_risk only
- [x] 15. Create snapshot test file `src/lib/telegram/__tests__/format-v2.test.ts` with 12 snapshot tests (4 risk levels × 3 languages) using representative RunCheckResult fixtures
- [x] 16. Add MarkdownV2 validation helper to test suite that checks for unescaped special characters outside bold markers
- [x] 17. Add property-based test: for any valid RunCheckResult and any Lang, output length ≤ 4096 and passes MarkdownV2 validation
- [x] 18. Remove superseded formatting code from `format.ts` and update any existing snapshot tests that reference old format output
- [x] 19. Verify existing bot router tests pass with new formatted output; fix any broken assertions

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2", "3", "4", "5", "6", "8"] },
    { "id": 1, "tasks": ["7", "9"] },
    { "id": 2, "tasks": ["10", "11", "12", "13"] },
    { "id": 3, "tasks": ["14"] },
    { "id": 4, "tasks": ["15", "16", "17"] },
    { "id": 5, "tasks": ["18", "19"] }
  ]
}
```

## Notes

- All i18n strings (tasks 2–5) can be done in parallel since they are independent bot_dict additions
- Tasks 6–9 (truncator and advice filter) can be done in parallel since they are independent modules
- The core refactor (tasks 10–14) depends on tasks 1–9 being complete
- Testing (tasks 15–19) depends on the refactor being complete
- callback_data values in buttons MUST remain unchanged to avoid breaking the bot router

