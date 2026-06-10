# Requirements: Telegram Forward Source Context v1

## 1. Public Forward Source Capture

When a user forwards a Telegram channel/group post, the bot shall capture only visible public source context: source type, title, and public username when present.

The bot shall not capture private sender names, hidden-user names, Telegram user IDs, chat IDs, message IDs, or author signatures for user-facing enrichment.

## 2. Contextual Explanation

When a forwarded post or forwarded media has a visible public source, the bot shall add a short explanation line that says the content was forwarded from that channel/group and that the verdict is based only on visible content.

When scam patterns are already detected in the forwarded content or image evidence, the source note shall support the scenario-specific explanation without changing score, level, or reason codes.

## 3. Privacy Boundary

Forward-source context shall be used for the immediate Telegram reply only. It shall not be appended to the user input sent to `runCheck`, and shall not be persisted in the `checks.redacted_input` row as raw source data.

## 4. Routing Priority

Existing routing priority shall remain unchanged: callback, command, active scenario, text/caption/link/button evidence, image/video-thumbnail OCR, unsupported fallback.

Forward-source context shall never cause a media-only message to skip OCR. If an image has no caption, it still goes through image analysis.

## 5. Honest Limits

The bot shall not infer hidden SCAM labels, account age, Telegram report counts, spam history, or mass-DM behavior from a forwarded source.

## 6. Tests

The implementation shall include router, pure helper, and webhook regression tests for forwarded channel text, forwarded image source context, hidden-user exclusion, unchanged scoring, and non-persistence of source context.
