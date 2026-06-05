# Design: Telegram Emergency Copilot v2

## Overview

The feature adds a tiny stateful layer between Telegram free-text input and the risk pipeline. It stores only the last selected panic scenario id and timestamp in `telegram_sessions.scenario_data`. Follow-up routing stays deterministic and regex-based; no AI is used.

## Architecture

1. `panic:N` callback saves `{ lastPanicId, lastPanicAt }`.
2. Free text enters `handleCheck`.
3. `buildEmergencyFollowUpResponse(text, session, lang)` checks whether the message is a short follow-up tied to recent panic context.
4. If a response exists, `handleCheck` sends it and stops.
5. Otherwise, existing risk checking runs unchanged.

## Components

- `emergency.ts`
  - Stores panic context helper types.
  - Builds official contact lists.
  - Classifies emergency follow-up prompts.
  - Formats scenario-specific follow-up replies and keyboards.
- `handlers/misc.ts`
  - Saves panic context on panic/live-call callbacks.
  - Handles `panicctx:*` callbacks.
- `handlers/check.ts`
  - Runs emergency follow-up routing before the generic risk pipeline.
- `session.server.ts`
  - Extends `scenarioData` with optional emergency context fields.

## Correctness Properties

1. Follow-up routing requires a recent panic context.
2. Follow-up routing never intercepts messages with URL, phone number, Telegram username, OTP/CVV, APK link, or long suspicious text.
3. Contact responses use only verified contacts already present in the trusted directory.
4. Context state stores no raw user-submitted identifiers.
5. Callback data is stable and prefixed.

## Error Handling

- If session persistence fails, the bot still sends the selected panic checklist.
- If a follow-up cannot be classified, existing risk pipeline behavior is preserved.
- If callback context is missing, `panicctx:*` falls back to a general emergency contact/help response.

## Testing Strategy

- Unit-test the follow-up classifier/formatter.
- Integration-test webhook flows with panic callback followed by free text.
- Regression-test that suspicious payloads still reach `handleCheck` and produce a risk result.
