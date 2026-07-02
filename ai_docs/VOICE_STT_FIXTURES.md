# Voice STT Fixture Workflow

Purpose: expand Voice-in/STT QA with real provider transcripts without
committing raw user audio.

## Committed Replay Corpus

The committed regression corpus lives in
`src/lib/telegram/voice-stt-provider-fixtures.ts`.

Each row stores only:

- `id`
- `lang`
- sanitized `transcript`
- `sourceKind`
- expected route (`panic` with `panicId`, or `normal_check`)
- short review note

Do not commit raw audio, Telegram file ids, phone numbers, card numbers, OTPs,
screenshots, or provider request/response bodies.

## Local Provider Capture

Keep local audio under the ignored folder:

```text
private/voice-stt-fixtures/
```

Example manifest:

```json
{
  "cases": [
    {
      "id": "ru-sms-code-live-001",
      "lang": "ru",
      "audioPath": "./ru-sms-code-live-001.ogg",
      "expectedIncludes": ["sms", "код"],
      "note": "Live QA voice note, sanitized transcript only"
    }
  ]
}
```

Run:

```bash
npm run stt:transcribe-fixtures -- --manifest private/voice-stt-fixtures/manifest.json --output private/voice-stt-fixtures/transcripts.json
```

The script requires `OPENAI_API_KEY` and uses the same `transcribeVoiceCore`
path as Telegram voice notes. It prints/writes sanitized transcripts only.
Manifest `audioPath` values must be relative paths that stay inside the manifest
directory; this prevents accidentally reading and sending unrelated local files
to the STT provider.

After manual review, copy safe transcript rows into
`src/lib/telegram/voice-stt-provider-fixtures.ts` and add the expected route.
Then run:

```bash
npm run test:run -- src/lib/telegram/handlers/check.voice.test.ts
npm run test:run -- src/lib/telegram/voice-stt-fixture-collector.test.ts
```

## Review Rules

- Keep "I did not..." negated phrases in `normal_check` unless the transcript
  clearly says the risky action already happened.
- Prefer route expectations only for emergency statements that already happened:
  sent code, installed remote access, transferred money, entered card data,
  scanned Telegram login QR, or currently on a suspicious call.
- If transcript confidence is unclear or too short, use a normal-check/uncertain
  flow instead of forcing SOS.
