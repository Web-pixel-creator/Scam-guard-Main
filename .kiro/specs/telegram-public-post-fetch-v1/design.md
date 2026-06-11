# Design: Telegram Public Post Fetch v1

## Overview

Add a server-only public Telegram post fetcher that runs before `runCheck` only for validated public post links. If visible post evidence is extracted, the Telegram check handler scores that evidence as text. If not, the current metadata-only path remains unchanged.

## Architecture

Flow:

1. `handleCheck` receives user text.
2. `buildTelegramPublicPostCheckEvidence` checks whether the text is a public post link.
3. A small per-user fetch rate limit is applied.
4. The fetcher requests `https://t.me/s/<username>/<postId>` with timeout and size limits.
5. The parser finds the requested `data-post="<username>/<postId>"` message block.
6. Visible text and outbound links are decoded, stripped, redacted and clamped.
7. `runCheck({ type: "text" })` scores the extracted evidence.
8. A reply-only public-post brief is prepended to the explanation.

## Components

### `public-post.server.ts`

- `extractTelegramPublicPostTarget(input)`: uses `extractTelegramPublicTarget` and returns only `{ username, postId }`.
- `fetchTelegramPublicPost(target, fetcher?)`: best-effort Telegram web fetch with strict host, timeout and size limits.
- `parseTelegramPublicPostHtml(html, target)`: pure parser for Telegram message blocks.
- `buildTelegramPublicPostCheckEvidence(input, rateLimitKey, fetcher?)`: rate-limited orchestration for the handler.
- `enrichTelegramPublicPostResult(result, evidence, lang)`: reply-only brief; does not change scoring fields.

## Data Model

```ts
type TelegramPublicPostTarget = {
  username: string;
  postId: string;
};

type TelegramPublicPostEvidence = {
  target: TelegramPublicPostTarget;
  text: string;
  links: string[];
  checkInput: string;
};
```

## Correctness Properties

1. Only validated Telegram usernames and numeric post ids can be fetched.
2. Non-public Telegram links never produce a fetch URL.
3. Fetch failure returns `null`, never throws into the webhook.
4. Extracted evidence contains no HTML tags and is clamped.
5. Result enrichment never changes `level`, `score`, `reasons`, `knownReports`, `verifiedContact` or `brandEvidence`.
6. Reply text never claims hidden Telegram SCAM labels, account age, Telegram report counts or spam history.

## Error Handling

- Network error, non-200, timeout, oversized page, missing post and empty text all return `null`.
- The handler falls back to `enrichTelegramPublicMetadata`.
- Logs must not include raw post body or secret values.

## Testing Strategy

- Pure parser tests with representative Telegram HTML snippets.
- Fetch orchestration tests with mocked `fetch`.
- Telegram webhook/handler integration test for a public post link containing NFT/captcha/voting text.
- Full test, typecheck, lint, build and production smoke before release.
