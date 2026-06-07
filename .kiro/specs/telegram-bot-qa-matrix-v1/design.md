# Telegram Bot QA Matrix v1 Design

## Overview

The QA matrix is a regression suite over pure Telegram formatter/router helpers. It does not send messages to real Telegram users. Network-facing Telegram API checks remain separate smoke tests, while this suite validates the exact product behavior that users see.

## Architecture

The test suite imports stable public helpers:

- `formatWelcome`, `formatHelp`, `formatCheckResult`, and `CB`
- `bt` for localized bot strings
- `buildLastCheckSnapshot`, `classifyLastCheckFollowUp`, and `buildLastCheckFollowUpText`
- `classifyEmergencyFollowUp`, `buildEmergencyFollowUpText`, and `withPanicContextData`
- `buildTelegramPublicMetadataBrief`
- `buildDescriptionPayloads`

It uses deterministic `RunCheckResult` fixtures and fixed timestamps so session recency behavior is reproducible.

## Components And Interfaces

### QA Fixtures

`baseResult(overrides)` creates a valid `RunCheckResult` with safe defaults.

`recentScenarioData(result)` stores a `lastCheck` snapshot in the same shape used by Telegram sessions.

`plain(text)` removes MarkdownV2 escaping only for assertion readability.

### QA Scenarios

The suite covers:

- main menu callbacks
- unsupported video/audio/voice copy
- QR/menu confidence follow-up
- high-risk next-step follow-up
- bank contact follow-up
- explanation follow-up
- emergency copilot follow-ups
- Telegram public metadata limitations
- result keyboard invariants and length limits
- localized bot profile descriptions

## Data Models

No new production data models are introduced. The suite reuses existing `RunCheckResult`, `LastCheckSnapshot`, and `ReportDraft` types.

The bot profile script exposes:

```ts
interface DescriptionPayload {
  description: string;
  short_description: string;
  language_code?: "ru" | "uz" | "en";
}
```

## Error Handling

The tests intentionally assert conservative behavior:

- new suspicious payloads must not be swallowed by follow-up routers
- unavailable Telegram metadata must not become an accusation
- unknown neutral contexts must remain cautious

## Testing Strategy

Run with:

```bash
npm run test:run -- src/lib/telegram/bot-qa-matrix.test.ts
npm run test:run -- src/lib/telegram/set-bot-description.test.ts
```

The full verification remains:

```bash
npm run test:run
npx tsc --noEmit
npm run lint
npm run build
npm audit --audit-level=moderate
```
