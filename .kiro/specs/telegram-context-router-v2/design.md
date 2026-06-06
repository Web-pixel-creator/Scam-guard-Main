# Design: Telegram Context Router v2

## Overview

Context Router v2 is a small deterministic layer inside the existing Telegram check handler. It builds on `src/lib/telegram/check-followup.ts` and the existing emergency copilot. It does not introduce AI routing and does not persist raw evidence.

## Architecture

Telegram router priority remains unchanged:

1. callback
2. command
3. active scenario
4. meta-intent
5. content check

Inside `handleCheck`, after emergency follow-up classification and before `runCheck`, the last-check classifier may respond to short follow-up questions. If it returns `null`, the message continues to `runCheck`.

## Data Model

`LastCheckSnapshot`:

- `level`: risk level from the previous check
- `type`: input type from the previous check
- `context`: coarse label (`qr_menu`, `delivery`, `crypto`, `phone`, `generic`)
- `at`: ISO timestamp

No raw message content, OCR text, URL, phone, username, code, card data or image bytes are stored.

## Components

- `classifyLastCheckFollowUp(text, scenarioData, now)`: pure classifier for short follow-up actions.
- `buildLastCheckSnapshot(result, now)`: converts a check result to safe metadata.
- `buildLastCheckFollowUpText(action, snapshot, lang)`: renders a short answer for the selected action.
- `sendCheckResult(ctx, result)`: sends formatted result and persists the safe snapshot.

## Correctness Properties

1. Payload-like text always returns `null`.
2. Missing or stale last-check context returns `null`.
3. Newer emergency context wins over older last-check context.
4. Callback updates never reach `handleCheck`, so callbacks cannot be intercepted.
5. Snapshot JSON never contains raw display values such as phone numbers.

## Error Handling

If session persistence fails, the bot still sends the check result. Follow-up routing simply degrades to normal risk-check behavior later.

## Testing Strategy

- Unit tests for classifier actions, payload override, expiry and privacy.
- Webhook integration tests for QR/menu, phone/contact guidance, high-risk next steps, explanation follow-up and callback separation.
- Full project verification: tests, typecheck, lint, build, audit and smoke checks after deployment.
