# Design

## Overview

Guardian Angel v1 is a Telegram-only companion layer for high-risk check results. It does not change scoring, AI decisions or report/reputation data. The risk engine still produces the verdict; Guardian Angel only turns a dangerous verdict into a short sequence of safe actions.

## Architecture

Flow:

1. `handleCheck`, `handleImage`, `handleVoice` call the existing `runCheck` pipeline.
2. `formatCheckResult` renders the normal result card.
3. If `result.level === "high_risk"`, `buildGuardianAngelSnapshot(result)` stores a safe summary in `telegram_sessions.scenario_data.guardian`.
4. The bot sends a second short companion message with `guardian:*` callbacks.
5. `handleCallback` routes `guardian:next`, `guardian:done`, `guardian:safe_call` and `guardian:full_plan`.
6. Natural-language follow-ups route through `classifyGuardianAngelFollowUp` before generic last-check follow-up routing, while emergency/panic context still has priority.

## Components And Interfaces

### `src/lib/telegram/guardian-angel.ts`

- `buildGuardianAngelSnapshot(result, now)`
- `buildGuardianAngelIntro(snapshot, lang)`
- `buildGuardianAngelText(action, snapshot, lang)`
- `buildGuardianAngelKeyboard(lang)`
- `parseGuardianAngelCallback(data)`
- `classifyGuardianAngelFollowUp(text, scenarioData, now)`

### `src/lib/telegram/session.server.ts`

Adds `ReportDraft.guardian?: GuardianAngelSnapshot`.

### `src/lib/telegram/handlers/check.ts`

Saves/clears the safe context and sends the companion card only after high-risk results.

### `src/lib/telegram/handlers/misc.ts`

Handles `guardian:*` callbacks and gracefully explains when no active high-risk context exists.

## Data Models

```ts
interface GuardianAngelSnapshot {
  level: "high_risk";
  type: InputType;
  reasons: ReasonCode[];
  at: string;
}
```

Explicitly forbidden fields:

- raw input text
- URLs
- phone numbers
- card data
- OTP/SMS/Telegram codes
- OCR text
- image bytes/data URLs
- screenshots/files

## Correctness Properties

1. Non-high-risk results never create a Guardian Angel snapshot.
2. Guardian Angel snapshot JSON never includes `result.display` or `result.explanation`.
3. A new artifact in user text is never swallowed by Guardian Angel follow-up routing.
4. Panic/live-call follow-up routing remains higher priority than Guardian Angel.
5. Missing Guardian Angel context produces an honest no-context response.
6. All Guardian Angel user-facing flows have RU/UZ/EN copy.

## Error Handling

- If session saving fails, the normal risk result is still delivered.
- If the second companion message fails, the risk result remains usable.
- If Family Shield is not linked, the existing Family Shield setup flow handles it.
- If Guardian context is stale or missing, the bot asks for a fresh check instead of pretending to remember.

## Testing Strategy

- Pure unit tests for snapshot privacy, keyboard callbacks and follow-up classification.
- Handler tests for high-risk result continuation and safe session persistence.
- Callback tests for `guardian:*` actions with and without stored context.
- Existing full bot tests remain responsible for panic/live-call priority and Family Shield behavior.
