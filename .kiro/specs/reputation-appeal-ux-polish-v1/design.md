# Design Document

## Overview

The appeal UX polish is intentionally small: it does not change moderation, hashing, RLS, or admin review logic. It only improves entrypoints and copy so users understand that appeals correct existing reputation labels, while reports submit new scam evidence.

## Architecture

Flow:

1. A user types `/appeal` or reads `/help`.
2. The bot sends a short explanation and an inline URL button to `/appeal`.
3. The appeal page explains valid use cases, privacy boundaries, and examples.
4. Existing `submitReputationAppeal` continues to validate, redact, hash, dedupe, and rate-limit requests.

## Components and Interfaces

- `config.server.ts`: adds `getPublicAppUrl()` for server-side public links.
- `bot-i18n.ts`: adds trilingual appeal copy and button text.
- `commands.ts`: handles `/appeal` with a URL button and a report fallback button.
- `router.ts`: recognizes `/appeal` as a known command.
- `appeal.tsx`: improves the public form with examples and report-vs-appeal guidance.
- Tests: parser, `/help`, and webhook integration coverage.

## Data Model

No database changes. The existing `reputation_appeals` table and admin review flow remain unchanged.

## Correctness Properties

1. `/appeal` never starts the report scenario.
2. The `/start` quick-action menu remains compact and unchanged.
3. Appeal links are public URLs only and contain no tokens.
4. The bot never asks users to paste sensitive secrets into an appeal.
5. New scam incidents are routed toward `/report`, not the appeal form.

## Error Handling

If `PUBLIC_APP_URL` is missing or invalid, the bot falls back to the known production URL. Telegram send failures continue to degrade through the existing best-effort Bot API wrapper.

## Testing Strategy

- Unit: `parseCommand("/appeal")`.
- Integration: `/appeal` webhook response includes a URL button and report fallback.
- Regression: `/start` main menu structure stays unchanged.
- Build verification: TypeScript, vitest, and Vite production build.
