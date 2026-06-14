# Design - Bot Safety Firewall v1

## Overview

AI is used for explanations, OCR/image understanding and voice transcription. The deterministic risk engine already owns score/level/reasons. This feature adds an output safety boundary for AI-authored user-facing text so prompt injection cannot make the bot request secrets, payments, APK installs or wallet actions.

## Architecture

`runCheck` calls `aiExplain` only after deterministic scoring. The new module `src/lib/risk/ai-output-safety.ts` sanitizes the returned explanation before it is appended to deterministic brand text, persisted in `checks.ai_explanation`, or rendered by Telegram/web.

Image intelligence keeps OCR text as evidence for scoring, but its optional `summary` field is sanitized because it may be shown to users as fallback prose.

## Components

- `findUnsafeAiOutput(text)` returns the first unsafe fragment and reason.
- `sanitizeAiExplanation(text)` returns trimmed safe text or `null`.
- `aiExplain(...)` wraps provider output with `sanitizeAiExplanation`.
- `sanitizeImageIntelligence(...)` sanitizes model `summary` while keeping redacted evidence text.

## Correctness Properties

1. Unsafe AI requests for OTP/CVV/PIN/password/card/seed/passport are blocked.
2. Unsafe AI requests for payment, wallet signing/connection and APK installs are blocked.
3. Prompt-injection leakage is blocked.
4. Safe negated warnings are preserved.
5. Scoring and reason codes are unchanged when an AI explanation is blocked.
6. Blocked AI explanations are not persisted.

## Error Handling

Blocking is fail-closed for the AI explanation only. The product degrades to the existing rules-only response with deterministic advice.

## Testing Strategy

Add unit tests for the safety filter and integration tests around `runCheck` proving blocked output becomes `null` before return/persistence while safe warnings survive.
