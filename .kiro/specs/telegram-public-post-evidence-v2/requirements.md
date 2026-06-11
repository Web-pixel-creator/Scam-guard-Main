# Requirements: Telegram Public Post Evidence v2

## Overview

Improve public Telegram post checks by extracting more visible evidence from the public `t.me/s/...` page: inline button labels/URLs and link preview titles/descriptions. The goal is to explain promo funnels more concretely without claiming hidden Telegram reputation.

## Requirements

1. For a validated public post link (`t.me/<username>/<postId>` or `t.me/s/<username>/<postId>`), the bot SHALL extract visible message text, visible outbound links, visible link-preview text and visible inline-button labels/URLs from the public web page.
2. The bot SHALL include extracted preview/button evidence in the rules-first check input so existing reason codes can identify casino/free-spins, NFT/Stars giveaways, voting/captcha gates, wallet urgency, task rewards and TON referral schemes.
3. The extractor SHALL redact sensitive digit sequences and clamp all extracted text, URLs, buttons and previews before scoring or rendering.
4. The extractor SHALL remain fail-closed: if Telegram HTML shape changes, parsing fails, the response is too large, or the fetch times out, the bot SHALL fall back to the existing metadata-only path.
5. The feature SHALL NOT fetch private invites, `t.me/c/...`, arbitrary domains, media files, redirect targets or hidden Telegram internals.
6. User-facing copy SHALL say that only visible public web evidence was checked and SHALL NOT claim account age, hidden SCAM labels, Telegram report counts or spam history.
7. Ordinary public news/product/restaurant/menu posts with preview/buttons SHALL NOT become suspicious unless visible risk mechanics are present.
