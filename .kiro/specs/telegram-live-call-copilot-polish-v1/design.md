# Design: Telegram Live-Call Copilot Polish v1

## Overview

The current live-call flow reuses the same broad emergency follow-up keyboard after several actions. This design adds small state-specific keyboard builders and shortens the live-call copy so the user always sees one primary next action.

## Architecture

The change stays inside the Telegram emergency layer:

- `emergency.ts` owns text builders, callback parsing, and reusable inline keyboards.
- `handlers/misc.ts` selects the right keyboard for `panic:6` and `livecall:*`.
- Existing `panicctx:*` follow-up callbacks continue to route through `buildEmergencyFollowUpText`.

No database changes are required.

## Components

### Active Call Keyboard

`buildLiveCallActiveKeyboard(lang)` returns a compact keyboard for an ongoing call:

- `livecall:hangup`
- `livecall:what_to_say`
- `livecall:sent_code`
- `livecall:tell_family`

It intentionally excludes `livecall:call_bank`.

### Post-Call Keyboard

`buildLiveCallPostHangupKeyboard(lang)` returns:

- `panicctx:contacts`
- `family:notify`
- `panicctx:script`
- `panicctx:full`

This gives one safe next path without losing the detailed checklist.

### Phrase Keyboard

`buildLiveCallPhraseKeyboard(lang)` returns:

- `livecall:hangup`
- `livecall:tell_family`

It keeps the user focused on ending the call after reading the phrase.

### Follow-Up Keyboard Selection

`buildEmergencyFollowUpKeyboard(lang, panicId?)` keeps existing behavior for non-live scenarios and returns the post-call keyboard for `panicId === 6`.

## Data Model

No persistent data changes. Session context remains `lastPanicId` and `lastPanicAt`.

## Error Handling

If a legacy `livecall:call_bank` callback arrives, it still routes to the safe-callback text. If Family Shield storage is unavailable, existing manual trusted-person fallback remains.

## Testing

Unit tests cover:

- active-call keyboard does not show call-bank before hangup;
- live-call follow-up keyboard is compact;
- full checklist remains accessible;
- ready phrase stays short and routes back to hangup/trusted help.
