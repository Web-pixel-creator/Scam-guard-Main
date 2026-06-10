# Design: Telegram Forward Source Context v1

## Overview

Telegram already sends `forward_origin` metadata for some forwarded channel/group posts. The current bot ignores it, so a user can forward a suspicious post and receive a technically correct but less grounded answer. This feature uses only public, visible source context to make replies feel more situational while preserving privacy and the deterministic scoring model.

## Architecture

`router.ts` extracts a sanitized `TelegramForwardSourceContext` from public channel/chat origins and attaches it to `check` or `image` route actions. It does not add the source to the scored input.

`handlers/check.ts` passes the source context into a pure presentation helper after `runCheck` or image analysis finishes. The helper prepends a compact source note to `result.explanation`, preserving all verdict fields.

## Components and Interfaces

- `src/lib/telegram/forward-context.ts`
  - `normalizeForwardSource(raw) -> TelegramForwardSourceContext | null`
  - `buildForwardSourceBrief(source, lang, result) -> string | null`
  - `enrichForwardSourceContext(result, source, lang) -> RunCheckResult`
- `src/lib/telegram/router.ts`
  - Parses public `forward_origin.chat` / `forward_origin.sender_chat` / top-level `sender_chat`.
  - Adds optional `source` to `check` and `image` route actions.
- `src/lib/telegram/handlers/check.ts`
  - Applies the enrichment after public metadata/reputation enrichment for text checks.
  - Applies the enrichment after structured image evidence explanations for images/video thumbnails.

## Data Models

```ts
interface TelegramForwardSourceContext {
  kind: "channel" | "chat";
  title: string | null;
  username: string | null;
}
```

The model intentionally excludes IDs, private sender names and signatures.

## Correctness Properties

1. Forward-source enrichment preserves `level`, `score`, `reasons`, `type`, `display`, `knownReports`, `verifiedContact`, and `brandEvidence`.
2. Hidden-user and private user forward origins produce no source context.
3. A forwarded image without caption still routes to image analysis, not text check.
4. Public source title/username are not appended to the text passed into `runCheck`.
5. Output never claims hidden Telegram facts.

## Error Handling

Malformed `forward_origin` data is ignored. If title and username are both absent, no source note is rendered. Source note generation is pure and must not throw.

## Testing Strategy

Add focused tests:

- router tests for public channel source on text and image routes;
- helper tests for preservation and no hidden-user claims;
- webhook integration proving source appears in reply but not in persisted `checks` payload.
