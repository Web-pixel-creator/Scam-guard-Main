# Coding Rules

## Privacy and security

1. Never store or log raw OTP/SMS codes, full card numbers, PINs, passwords, passport data or raw screenshot images.
2. Run `redactText` before persisting free-form user text, including report descriptions and OCR output.
3. Hash sensitive identifiers with `hashIdentifier` and store only `entity_hash` / `input_hash` plus masked display strings.
4. `client.server.ts` and anything `*.server.ts` must never be imported into client/browser code.
5. Public-facing data must respect RLS. Do not add public SELECT policies to `checks`, `reports`, `telegram_sessions` or unconfirmed `entities`.
6. Entities become publicly visible only after `moderation_status='confirmed'`.
7. Never name a specific person as a scammer. Use risk labels only.
8. Read secrets inside server handlers/helpers, not at module scope.

## Risk engine

- Rules are deterministic and decide the score; AI only explains or OCRs.
- New scam patterns require: `ReasonCode`, weight, regex/pattern, RU/UZ/EN labels, advice if needed, tests, and a `SCAM_COVERAGE.md` update.
- Keep `scoreFromCodes` thresholds stable unless the change is explicitly documented in `DECISIONS.md`.

## AI provider

- Use the OpenAI-compatible env contract: `OPENAI_API_KEY`, optional `OPENAI_MODEL`, optional `OPENAI_BASE_URL`.
- Missing or failing AI must degrade to `null`; scoring must still work.
- Never log prompts, secrets, raw screenshots or sensitive user input.

## i18n

- App language set: `ru`, `uz`, `en`.
- Every user-facing string needs all three languages.
- Default language is `ru`.

## UI / styling

- Orange = us. Red = the threat.
- Use CSS variables in `src/styles.css`; do not invent ad hoc red/orange shades.
- Use shadcn/ui primitives from `components/ui`.
- Preserve accessibility controls, aria labels and focus states.

## Routing

- File-based routing only.
- Never hand-edit `src/routeTree.gen.ts`.

## Server functions

- Validate all input with zod.
- Fail gracefully without leaking internals.
- Admin functions always require `requireSupabaseAuth` + `assertAdmin`.

## Tooling

- Run TypeScript and tests before merging.
- Do not add runtime coupling to Lovable Cloud. `@lovable.dev/vite-tanstack-config` is a build-time wrapper only.
- Files marked generated should be changed at their source, not manually edited.
