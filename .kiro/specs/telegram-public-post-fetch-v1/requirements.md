# Requirements: Telegram Public Post Fetch v1

## Overview

When a user sends a public Telegram post link such as `https://t.me/channel/123`, the bot should try to analyze the visible public post body instead of only checking the channel username. This must remain best-effort, conservative and privacy-safe.

## Requirements

### R1. Public Post Fetch Scope

1. WHEN input contains a public post link `t.me/username/postId` or `t.me/s/username/postId`, THE Bot SHALL identify it as a public post fetch candidate.
2. THE Bot SHALL fetch only `https://t.me/s/<username>/<postId>` for validated usernames and numeric post ids.
3. THE Bot SHALL NOT fetch private invite links, internal `t.me/c/...` links, arbitrary domains, user-provided redirect URLs, media files or closed chat content.

### R2. Safe Extraction

1. WHEN the public Telegram web page contains the requested post, THE Bot SHALL extract visible post text and visible outbound links from that post block.
2. THE Bot SHALL strip HTML, decode basic HTML entities, redact sensitive digits and clamp extracted evidence before passing it to scoring.
3. THE Bot SHALL NOT store raw HTML, images, videos or full page content.

### R3. Scoring Integration

1. WHEN useful public post text is extracted, THE Bot SHALL run the normal rules-first Check Pipeline on a text evidence payload containing the post text and visible links.
2. THE Bot SHALL add a short reply-only brief explaining that the analysis used visible public Telegram web content.
3. THE Bot SHALL preserve the no-false-authority boundary: no hidden Telegram SCAM labels, account age, report counts or spam history are inferred from the web page.

### R4. Failure And Fallback

1. WHEN fetch fails, times out, the page is too large, or the post text is empty, THE Bot SHALL fall back to existing Telegram public metadata behavior.
2. THE fallback SHALL remain helpful and ask the user to forward the post, paste the text or send a screenshot.
3. Fetch errors SHALL NOT fail the webhook.

### R5. Abuse Limits

1. Public post fetch SHALL be rate-limited separately from the normal check pipeline.
2. Timeouts and body-size limits SHALL keep webhook latency bounded.

### R6. Tests

1. Unit tests SHALL cover public post extraction from Telegram HTML.
2. Unit tests SHALL cover timeout/fetch failure fallback.
3. Handler/integration tests SHALL verify that public post text changes the verdict when it contains risky mechanics, and that no hidden Telegram reputation claims are invented.
