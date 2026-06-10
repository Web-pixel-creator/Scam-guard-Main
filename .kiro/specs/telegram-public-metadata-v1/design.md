# Design: Telegram Public Metadata v1

## Overview

The feature adds a Telegram-channel-only enrichment step after `runCheck`. The risk core remains transport-independent and deterministic; the Telegram handler uses Bot API `getChat` only to add a short, honest explanation to the result before formatting.

## Architecture

Flow:

1. `handleCheck` receives free text.
2. `runCheck` computes type, reasons, score and level.
3. If the result type is `telegram`, `enrichTelegramPublicMetadata` inspects the raw input.
4. For a public username or public post link, it calls `getChatInfo("@username")`.
5. It merges a localized metadata brief into `RunCheckResult.explanation`.
6. `formatCheckResult` renders the result. The suspicious template includes `brief` so the metadata boundary is visible.

## Components and Interfaces

### `api.server.ts`

- `getChatInfo(chatId: string)`: best-effort Bot API `getChat` wrapper.
- Returns `{ ok: true, chat }` or `{ ok: false, errorCode?, description? }`.
- Never exposes the bot token and never throws.

### `public-metadata.server.ts`

- `extractTelegramPublicTarget(input)`: pure parser for public usernames, public post links and inaccessible invite/internal links.
- `lookupTelegramPublicMetadata(input, lookup?)`: best-effort lookup with injectable dependency for tests.
- `buildTelegramPublicMetadataBrief(metadata, lang)`: localized safe explanation.
- `enrichTelegramPublicMetadata(input, result, lang)`: returns a cloned result with explanation merged; never changes score, level or reasons.

## Data Models

```ts
type TelegramPublicTarget =
  | { kind: "public_username"; username: string }
  | { kind: "public_post"; username: string; postId: string }
  | { kind: "private_invite"; value: string }
  | { kind: "internal_or_private"; value: string }
  | { kind: "none" };

type TelegramPublicMetadata =
  | { status: "found"; username: string; chat: TelegramChatFullInfo; postId?: string }
  | { status: "not_found"; username: string; postId?: string }
  | { status: "unavailable"; username: string; postId?: string }
  | { status: "private_invite"; value: string }
  | { status: "internal_or_private"; value: string }
  | { status: "not_telegram" };
```

## Correctness Properties

1. Enrichment never changes `level`, `score`, `reasons`, `knownReports`, `verifiedContact`, or `brandEvidence`.
2. Private invite links never claim that closed content was inspected.
3. Bot API failures never throw out of the check handler.
4. Metadata briefs never mention account age, hidden scam labels, spam history, or report counts.
5. Public channel/group titles are truncated and redacted before rendering.
6. Public post links preserve the post id for limitation wording, but do not claim the post body was read unless the user forwarded/pasted/screenshot the content.
7. Follow-up context stores only a coarse `telegram_profile` tag.

## Error Handling

- Missing token, network failure, HTTP errors and malformed Bot API responses become `unavailable`.
- `chat not found` descriptions become `not_found`.
- Private invite/internal links skip network calls.
- The original check result is returned unchanged when enrichment cannot produce a useful brief.

## Testing Strategy

- Pure unit tests for extraction and brief generation.
- Stubbed lookup tests for found/not-found/unavailable metadata.
- Regression tests for `t.me/username/123` and `t.me/s/username/123` post-link wording.
- Handler unit test verifies enrichment is invoked and preserves the deterministic verdict.
- Snapshot update verifies the `suspicious` template can render a brief block.
