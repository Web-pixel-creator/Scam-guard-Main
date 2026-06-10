# Design: Telegram Forward Scheme Brief v1

## Overview

This feature improves the existing forward-source context layer. Instead of a generic warning sentence, forwarded Telegram posts now receive a short structured brief: source, scheme, goal, step and limitation.

## Architecture

- `router.ts` continues to extract only sanitized public forward source metadata.
- `forward-context.ts` maps existing deterministic reason codes to concise scenario briefs.
- `format.ts` gives forward-source briefs a slightly larger truncation budget so the user can actually read the scheme/goal/step lines.
- `runCheck` input, scoring and persistence stay unchanged.

## Components

- Source sanitizer: keeps only public title/username.
- Scenario mapper: turns reason-code families into scheme/goal/step copy.
- Formatter truncation guard: detects forward-source briefs and preserves enough lines.
- Regression tests: helper, formatter QA and webhook non-persistence.

## Correctness Properties

- Existing score, level, reasons and knownReports are preserved.
- No hidden Telegram reputation claims are generated.
- Hidden/private origins produce no source brief.
- Formatted messages include source/scheme/goal/step for forwarded suspicious posts.
- Source title/username do not appear in persisted `checks`.

## Error Handling

If no public source or no scenario mapping is available, the bot falls back to source plus limitation only. If source fields are malformed, the source context is dropped.

## Testing Strategy

Run targeted Telegram tests plus full test, typecheck, lint and production build. Use webhook integration tests to prove non-persistence.
