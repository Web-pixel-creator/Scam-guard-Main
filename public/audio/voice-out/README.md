# Voice-out prerecorded audio

Static SOS voice tips live here. The Telegram bot checks this directory before
calling Gemini/OpenAI TTS for main panic voice callbacks.

File naming:

- preferred: `panic-{id}-{lang}.ogg`
- generated Gemini fallback: `panic-{id}-{lang}.wav`
- `id`: `1` through `15`
- `lang`: `ru`, `uz`, or `en`

Example:

- `panic-4-ru.ogg`
- `panic-4-ru.wav`

Generation:

```bash
railway run npm run tts:generate-assets -- --force
```

Validation:

```bash
npm run tts:validate-assets
```

Operational notes:

- Committed `.ogg` files are the production-preferred Telegram Voice-out assets.
  The `.wav` files are retained as source/fallback assets for environments that
  regenerate or inspect Gemini audio.
- Keep files short and under 1.5 MB.
- Do not include user evidence, phone numbers, codes, card data, links, or
  passwords.
- The directory can be overridden with `VOICE_OUT_PRERECORDED_DIR`.
- Missing files fall back to the existing live TTS provider chain and then to
  text.
