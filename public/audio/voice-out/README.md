# Voice-out prerecorded audio

Static SOS voice tips live here. The Telegram bot checks this directory before
calling Gemini/OpenAI TTS for main panic voice callbacks.

File naming:

- `panic-{id}-{lang}.ogg`
- `id`: `1` through `15`
- `lang`: `ru`, `uz`, or `en`

Example:

- `panic-4-ru.ogg`

Operational notes:

- Keep files short and under 1.5 MB.
- Do not include user evidence, phone numbers, codes, card data, links, or
  passwords.
- The directory can be overridden with `VOICE_OUT_PRERECORDED_DIR`.
- Missing files fall back to the existing live TTS provider chain and then to
  text.
