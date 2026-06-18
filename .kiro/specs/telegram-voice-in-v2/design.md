# Design: Telegram Voice-in v2

## Overview

The feature reuses the existing `handleVoice -> transcribeVoiceCore -> runCheck` pipeline. It adds a small recovery branch: after a transcript preview, the user can press a callback button and send corrected text. The existing `await_check` scenario then routes the next message through `handleCheck`.

## Architecture

1. `handleVoice` transcribes audio in memory.
2. `sendVoiceTranscriptNote` sends the sanitized preview with a recovery keyboard.
3. `handleCallback` handles `voice_correct`, stores `scenario="await_check"` and prompts for corrected text.
4. `handlers/index.ts` routes the next message to `handleCheck`, which runs normal scoring.

## Data Model

No new database table is required.

Session state:

- `scenario = "await_check"`
- existing `scenarioData` is preserved

The corrected text is not stored as a dedicated voice artifact.

## Error Handling

If the user never sends corrected text, the session behaves like the existing `/check` prompt. Commands reset the scenario using the existing router behavior.

## Testing Strategy

Add focused tests around `check.voice.test.ts` and callback handling:

- voice transcript preview keyboard includes `voice_correct`;
- callback stores `await_check` and sends a correction prompt;
- a corrected text message runs `runCheck` without any voice download/STT call.
