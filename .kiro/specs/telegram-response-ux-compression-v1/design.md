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
- `TEMPLATES.high_risk`: uses `verdict`, `action_now`, and `what_noticed` for the first card, leaving long explanation/reporting detail out of the initial message. Public forwarded Telegram source briefs remain visible as short evidence summaries.
- `TEMPLATES.unknown`: keeps `verdict`, `brief`, optional meaningful `what_noticed`, and one context prompt; weak topic-only reasons are filtered from the observation section.
- `TEMPLATES.suspicious`: uses `what_noticed` plus `safe_steps`, so the card reads as evidence + next step rather than a dry reasons list.
- `CB.why` callback: reuses `lastCheck` and `buildLastCheckFollowUpText("explain", ...)` when a recent check exists, otherwise falls back to `why_explanation`.
- `LastCheckSnapshot.reasons`: stores only short reason codes for contextual explanations; it never stores raw evidence.

## Correctness Properties

1. Compact cards are below 900 characters for each scenario and language.
2. Compact cards start with the highest-priority action after the title.
3. Detailed cards contain at least one verified contact where the scenario requires official follow-up.
4. `panicctx:full` never returns the compact card.
5. Legacy `share_advice` callback remains routable.
6. Image triage category answers do not repeat `imgtriage:*` category buttons.
7. High-risk first cards do not include `why_dangerous`, `where_report`, or the full AI explanation.
8. Unknown cards do not surface weak topic-only reason labels as standalone evidence.
9. The `why` callback after a recent check explains that check context and does not expose score/threshold/weight details.

## Error Handling

If a compact card is missing for a scenario, fallback to the detailed scenario text. This keeps emergency mode functional even if a translation is incomplete.

## Testing Strategy

- Unit tests for compact card length and urgent-action first line.
- Unit tests for detailed checklist contact preservation.
- Router/webhook tests updated for lighter keyboard.
- Existing follow-up routing tests kept unchanged where behavior is still valid.
- Bot QA matrix and webhook fallback tests cover unreadable-image triage and non-accusatory wording.
- Formatter snapshots cover compact unknown/suspicious cards.
- Webhook tests cover contextual `why` callback routing.
