# Report Screenshot Evidence v1 Design

## Overview

The feature adds one narrow route: image evidence during the `/report` description step. It intentionally avoids Supabase Storage and new tables. The raw screenshot remains transient, and only a compact redacted report description is stored.

## Architecture

`router.ts` decides whether an incoming image belongs to a report description step:

1. callback
2. command
3. active scenario
4. normal content

Inside active scenario routing:

- `report_desc + caption` stays `scenarioStep` so typed descriptions remain simple.
- `report_desc + photo/image-document` becomes `scenarioImage`.
- `await_check + photo/image-document` becomes the normal `image` route.
- all other report steps remain text-only `scenarioStep`.

`handlers/index.ts` routes `scenarioImage` into `report.handleScenarioImage`.

`handlers/report.ts` uses existing Telegram file helpers and `analyzeImageCore`:

`getFile -> size check -> downloadFileAsDataUrl -> analyzeImageCore -> shortEvidenceSummary -> saveSession(report_scamType)`

The summary is built from sanitized `ImageIntelligenceResult.summary`, `visualCategory`, and non-sensitive risk hints. It is clipped and redacted again before saving.

## Data Model

No new database tables.

The existing `ReportDraft.description` may contain a generated line such as:

```text
Скриншот: похоже на промо/розыгрыш; видны признаки: приз/подарок, закрытый Telegram-инвайт.
```

It must not contain raw OCR, raw URLs, decoded QR contents, phone numbers, card numbers, OTPs, or data URLs.

## Error Handling

- Missing file metadata -> ask for a typed description.
- Oversized image -> reuse `image_too_large`.
- Unreadable image -> ask for a typed description.
- AI/rate-limit failure -> existing guarded handler returns a friendly error/rate-limit message.

## Testing Strategy

- Unit tests for route priority and `scenarioImage`.
- Handler tests with mocked Telegram API and `analyzeImageCore`.
- Regression assertion that saved drafts do not contain obvious raw secrets.
