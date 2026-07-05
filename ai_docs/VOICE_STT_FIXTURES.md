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
- expected route (`panic` with `panicId`, `negated_ack`, or `normal_check`)
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

If the provider is slow for longer or non-English audio, pass a bounded timeout:

```bash
npm run stt:transcribe-fixtures -- --manifest private/voice-stt-fixtures/manifest.json --timeout-ms 60000
```

After manual review, copy safe transcript rows into
`src/lib/telegram/voice-stt-provider-fixtures.ts` and add the expected route.
Then run:

```bash
npm run test:run -- src/lib/telegram/handlers/check.voice.test.ts
npm run test:run -- src/lib/telegram/voice-stt-fixture-collector.test.ts
```

## Live Telegram Transcript Capture

When a user sends a live QA voice note to the production bot, only copy the
short transcript that the bot itself displays back to the chat. Do not store
raw audio, Telegram file ids, request payloads, provider responses, or private
metadata.

2026-07-04 / 2026-07-05 live examples added to the committed replay corpus:

- `uz-live-sms-code-telegram-001`: provider rendered Uzbek
  `yubordim` as `yubardim`; this must still route to SOS `panic:1`.
- `ru-live-not-sent-code-telegram-001`: negated Russian "did not send SMS
  code" must not open an already-happened SOS flow.
- `uz-live-not-sent-code-telegram-001`: provider rendered the negated Uzbek
  transcript as `Men SMS-kod yubormadim.`; this must receive a calm
  `negated_ack`, not the already-sent-code SOS flow or the generic
  insufficient-data card.
- `uz-live-not-sent-code-telegram-002`: provider rendered the negated Uzbek
  transcript as `Men esa SMS-kod yubormadim.`; filler words before the object
  must still receive the same `negated_ack`.
- `uz-live-stt-language-drift-telegram-003`: provider rendered the user saying
  `Men SMS kod yubormadim` as `Men SMS-kort, jo, hvorfor med dem.` when the
  UI language was Russian. Voice STT must not treat UI language as a hard
  speech-language constraint; the captured artifact is normalized to the
  negated Uzbek code phrase.

## Review Rules

- Keep "I did not..." negated phrases in `negated_ack` unless the transcript
  clearly says the risky action already happened.
- Treat Telegram UI language as reply-language context, not proof of the voice
  note's spoken language. Voice QA should include Uzbek speech while the bot UI
  is Russian.
- Prefer route expectations only for emergency statements that already happened:
  sent code, installed remote access, transferred money, entered card data,
  scanned Telegram login QR, or currently on a suspicious call.
- If transcript confidence is unclear or too short, use a normal-check/uncertain
  flow instead of forcing SOS.
