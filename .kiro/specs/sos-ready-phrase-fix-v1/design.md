# Design

## Overview

SOS Ready Phrase Fix v1 changes only Telegram panic follow-up presentation. It introduces a scenario profile layer in `src/lib/telegram/emergency.ts` so the same `panicctx:*` actions can render different copy for financial emergencies, APK installs, Telegram takeover, live-call, blackmail, romance and minor-safety cases.

## Architecture

The existing flow stays intact:

1. User selects a panic scenario.
2. The bot stores `lastPanicId` in the session.
3. Callback buttons and natural follow-up questions route through `panicctx:*`.
4. `buildEmergencyFollowUpText(action, panicId, lang)` renders the answer.

This feature adds:

- `followUpProfile(panicId)` to group panic IDs into safety profiles.
- `contactsButtonText(lang, panicId)` to show safe callback or help-directory wording.
- Scenario-specific branches inside `guidedCallbackDirectory`, `guidedTrustedPersonText` and `guidedScriptText`.
- Expanded follow-up classifier keywords for "куда обратиться", police, support and UZCERT.

## Components And Interfaces

### `followUpProfile`

Maps current panic IDs:

- `1, 3, 4` -> financial
- `2` -> malware
- `5` -> telegram_recovery
- `6` -> live_call
- `7, 9` -> blackmail
- `8` -> romance
- `10` -> minor

### `guidedCallbackDirectory`

Accepts `(panicId, lang)`. Financial/live/APK scenarios keep bank callback copy. Telegram/blackmail/romance/minor scenarios receive a help-directory response that points to trusted people, platform support, police/MIA or UZCERT as appropriate.

### `guidedTrustedPersonText`

Returns a ready-to-send trusted-person message that matches the scenario and never requests secrets.

### `guidedScriptText`

Returns one short phrase the user can say or send. Non-bank scenarios do not mention "call the bank".

## Data Models

No database or session schema changes.

## Error Handling

If an unknown panic ID somehow reaches the renderer, existing `asPanicScenarioId` rejects it before rendering. If a verified contact is missing, the contact list filters nullable entries before joining text.

## Testing Strategy

Unit tests cover:

- routing "куда обратиться" to `contacts`;
- non-bank contact guidance contains police/UZCERT and no bank callback phrase;
- blackmail, romance and Telegram ready phrases are scenario-specific;
- trusted-person guidance differs for blackmail, romance and APK;
- non-bank panic keyboards show "Куда обратиться".

