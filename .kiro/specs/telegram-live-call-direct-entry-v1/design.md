# Design

## Overview

`/call` reuses the existing live-call copilot primitives instead of introducing a second flow. The command handler saves a minimal panic context for scenario `6` and sends the same active-call message and keyboard currently used by the `panic:6` callback.

## Architecture

1. `router.ts` recognizes `/call` as a `BotCommand`.
2. `handlers/commands.ts` handles `/call` before generic panic menu commands.
3. The command handler calls `saveSession` with:
   - `scenario: "none"`
   - `scenarioStep: 0`
   - `scenarioData: withPanicContextData(undefined, 6)`
4. The response uses `bt("live_call_header")`, `bt("live_call_hangup")` and `buildLiveCallActiveKeyboard`.
5. Existing `livecall:*` callbacks and Emergency Copilot follow-ups continue to run through `handlers/misc.ts`.

## Data Model

No new table or persisted raw evidence is needed. The only session fields written by `/call` are the already documented panic context fields:

```ts
{
  lastPanicId: 6,
  lastPanicAt: string
}
```

## Error Handling

If session storage fails, the existing command error boundary returns a Telegram-safe success response path through the webhook. The feature does not require Supabase schema changes.

## Testing Strategy

- Router unit test recognizes `/call`.
- Webhook integration test verifies `/call` sends the active live-call keyboard and stores panic context `6`.
- Command menu tests verify localized `setMyCommands` payloads include `/call`.
