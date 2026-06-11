# Design: Telegram Public Post Evidence v2

## Architecture

`public-post.server.ts` remains the only module that fetches and parses public Telegram post HTML. It already validates the target and fetches only `https://t.me/s/<username>/<postId>` with strict timeout/body/rate limits. v2 extends the parser output and the generated `checkInput`.

## Components and Interfaces

- `TelegramPublicPostButton`
  - `text`: visible button label, redacted/clamped.
  - `url`: normalized visible URL when Telegram exposes one.
- `TelegramPublicPostPreview`
  - `siteName`, `title`, `description`: visible link-preview fields, redacted/clamped.
  - `url`: normalized preview target URL.
- `parseTelegramPublicPostHtml`
  - Reads only the matched `data-post` block.
  - Extracts:
    - `tgme_widget_message_text js-message_text`
    - `tgme_widget_message_link_preview`
    - `tgme_widget_message_inline_button`
    - all visible outbound anchors.

## Data Flow

1. `handleCheck` receives user text.
2. `buildTelegramPublicPostCheckEvidence` validates public post target and fetches public Telegram web page.
3. Parser builds a bounded evidence object.
4. `checkInput` is composed as text sections:
   - public post URL
   - public post text
   - visible link previews
   - visible buttons
   - visible outbound links
5. `runCheck({ type: "text" })` applies existing deterministic rules and embedded URL analysis.
6. Result is enriched with a public evidence limitation brief.

## Correctness Properties

1. Private/internal Telegram links never trigger web fetch.
2. Fetch URL is always `https://t.me/s/<username>/<postId>`.
3. Redirects are not followed.
4. Extracted evidence is redacted and clamped.
5. Button/preview evidence can trigger existing promo reason codes when visible mechanics are present.
6. Benign preview/button posts do not trigger promo reason codes.
7. Enrichment never changes score, level or reason codes.

## Error Handling

All fetch/parser failures return `null` and the caller uses the metadata-only path. Parser helpers are string-based and defensive: missing blocks produce empty arrays, not exceptions.

## Testing Strategy

- Unit tests for extracting preview/button evidence.
- Unit tests for redaction/clamping/fail-closed behavior.
- Rule-level tests using generated `checkInput` for casino/giveaway/wallet/task/referral patterns.
- False-positive tests for ordinary Telegram/news/product posts.
- Handler integration test remains responsible for routing public post evidence before metadata fallback.
