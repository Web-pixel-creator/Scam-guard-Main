# Requirements: Telegram Voice-in v2

## Overview

Voice-in v2 improves the short voice-note flow without storing audio or raw sensitive evidence. The first shipped slice focuses on transcript recovery: when STT is imperfect, the user can send a corrected text version and the bot checks that text through the existing deterministic pipeline.

## Requirements

### Requirement 1: Transcript Preview

1. When a voice note is transcribed, the bot shall show a short sanitized transcript preview before the risk result.
2. The preview shall redact URLs, usernames and long digit runs.
3. The preview shall not store or expose raw audio.
4. If the transcript has too little reliable signal, the bot shall ask the user to correct or type the text instead of producing a risk verdict.

### Requirement 2: Correct Transcript Recovery

1. The transcript preview shall include a clear "correct text" action.
2. When the user selects that action, the bot shall ask for the corrected text.
3. The next text message shall be checked through the normal text check pipeline.
4. Correcting text shall not trigger another STT provider call.

### Requirement 3: Privacy Boundary

1. The correction flow shall store only short session state required to route the next message.
2. It shall not store raw audio, file paths, full OCR text, codes, cards, passwords, seed phrases or screenshots.

### Requirement 4: Emergency Priority

1. Obvious voice emergency transcripts shall still route directly to the relevant `/panic` scenario.
2. The correction action shall remain available for non-emergency voice checks.
3. RU/UZ mixed-speech transcripts for sent codes, money transfers and active calls shall be covered by regression tests.

### Requirement 5: Tests

1. Tests shall verify the correction button appears on voice transcript previews.
2. Tests shall verify selecting correction sets `await_check`.
3. Tests shall verify corrected text uses `runCheck` and does not call STT again.
4. Tests shall verify low-signal transcripts do not run the risk pipeline.
5. Tests shall verify mixed RU/UZ emergency phrases route to the matching panic scenario.
