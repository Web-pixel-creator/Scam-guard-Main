# Design: Telegram Response UX Compression v1

## Overview

Split emergency scenario rendering into two layers:

- `buildPanicScenarioText` returns a compact first card for the panic menu.
- `buildDetailedPanicScenarioText` returns the previous full checklist for `panicctx:full`.

The router keeps existing callback data and session memory. Only presentation changes.

## Architecture

1. User taps `panic:N`.
2. Router remembers `lastPanicId`.
3. Router sends compact `buildPanicScenarioText(N, lang)` with a lighter follow-up keyboard.
4. If user taps `panicctx:full`, router sends `buildDetailedPanicScenarioText(N, lang)`.
5. Follow-up classifier remains unchanged for natural language questions.

## Components And Interfaces

- `COMPACT_PANIC_CARDS`: per-scenario, per-language short card strings.
- `buildPanicScenarioText(id, lang)`: compact public API kept for existing callers.
- `buildDetailedPanicScenarioText(id, lang)`: full checklist for explicit detail requests and tests.
- `buildEmergencyFollowUpKeyboard(lang)`: removes repeated generic share advice while preserving all `panicctx:` actions.
- `bot_dict.ocr_failed*` and `bot_dict.image_triage_*`: compressed image fallback copy using hook/risk/safe-step wording.
- `buildImageTriageFollowUpKeyboard(lang)`: compact post-category keyboard with only check-another, media tips, and emergency actions.

## Correctness Properties

1. Compact cards are below 900 characters for each scenario and language.
2. Compact cards start with the highest-priority action after the title.
3. Detailed cards contain at least one verified contact where the scenario requires official follow-up.
4. `panicctx:full` never returns the compact card.
5. Legacy `share_advice` callback remains routable.
6. Image triage category answers do not repeat `imgtriage:*` category buttons.

## Error Handling

If a compact card is missing for a scenario, fallback to the detailed scenario text. This keeps emergency mode functional even if a translation is incomplete.

## Testing Strategy

- Unit tests for compact card length and urgent-action first line.
- Unit tests for detailed checklist contact preservation.
- Router/webhook tests updated for lighter keyboard.
- Existing follow-up routing tests kept unchanged where behavior is still valid.
- Bot QA matrix and webhook fallback tests cover unreadable-image triage and non-accusatory wording.
