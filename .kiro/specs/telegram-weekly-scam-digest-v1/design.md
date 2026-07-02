# Telegram Weekly Scam Digest v1 Design

## Overview

The digest is a deterministic Telegram-only feature for now. It adds `/digest`, a main-menu button, and a compact localized digest card with actionable next buttons.

## Architecture

```mermaid
flowchart LR
  User["Telegram user"] --> Command["/digest or main menu button"]
  Command --> Handler["commands/misc handler"]
  Handler --> Digest["telegram/digest.ts"]
  Digest --> Model["manual source/status/updated-at records"]
  Model --> Text["localized digest text or safe stale fallback"]
  Digest --> Keyboard["check/report/panic keyboard"]
  Handler --> API["sendMessage MarkdownV2"]
```

## Components And Interfaces

- `src/lib/telegram/digest.ts`
  - `formatWeeklyScamDigest(lang): { text, keyboard }`
  - `getWeeklyScamDigestSnapshot(lang, { now?, entries? })`
  - `WEEKLY_SCAM_DIGEST_ENTRIES`
  - `buildWeeklyScamDigestKeyboard(lang)`
- `src/lib/telegram/handlers/commands.ts`
  - handles `/digest`
- `src/lib/telegram/handlers/misc.ts`
  - handles callback `digest`
- `src/lib/telegram/format.ts`
  - adds `CB.digest`
  - adds digest quick action to welcome keyboard
- `scripts/set-bot-commands.ts`
  - adds command menu registration

## Data Model

The digest uses manual-publish records in `WEEKLY_SCAM_DIGEST_ENTRIES`. Each
record has:

- `source`: internal source label/type for auditability; not rendered publicly.
- `status`: only `published` records are eligible for output.
- `updatedAt`: freshness gate for weekly relevance.
- `publishMode: "manual"`: automation from research feeds is intentionally not
  enabled yet.
- localized hook / attacker-goal / safe-step copy.

No user data is read. No database table is needed. Future versions may generate
a weekly ranked digest from aggregated reports/checks only after a separate
privacy review and moderation design.

## Error Handling

- Digest formatting is pure and cannot fail on network or AI provider errors.
- If fewer than three fresh manually published topics are available, the digest
  falls back to evergreen safety guidance instead of presenting stale trends as
  current.
- Telegram send failures follow the existing `sendMessage` handling path.
- Callback routing clears the spinner before sending the digest.

## Testing Strategy

- Unit-test digest text length, safety wording, and keyboard callbacks.
- Unit-test manual metadata, draft filtering, stale fallback and no raw
  report-shaped evidence in public text.
- Unit-test `/start` contains the digest quick action.
- Unit-test `setMyCommands` includes `/digest`.
- Existing integration tests cover command/callback routing shape.
