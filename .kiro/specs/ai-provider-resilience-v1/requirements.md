# Requirements: AI Provider Resilience v1

## Overview

AI explanations and screenshot intelligence are useful, but the risk engine must remain rules-first and reliable when the configured OpenAI-compatible provider returns a transient error. This feature reduces blank explanations caused by short provider outages without changing scoring, storing secrets, or weakening degradation.

## Requirements

### R1. Transient Retry

1. WHEN the AI provider returns HTTP 429, 500, 502, 503, or 504, THE system SHALL retry the request with a short bounded backoff.
2. THE system SHALL retry at most two additional attempts per AI call.
3. THE retry behavior SHALL apply to explanations, OCR, and structured image analysis because they share the same chat completion helper.

### R2. Non-Retryable Errors

1. WHEN the AI provider returns HTTP 400, 401, 403, or 404, THE system SHALL NOT retry.
2. WHEN an AI request is aborted by the local timeout, THE system SHALL NOT retry the aborted request.
3. THE system SHALL continue to return `null` for AI output on non-retryable errors.
4. THE risk score and deterministic reason codes SHALL remain unaffected by any AI failure.

### R3. Circuit Breaker Compatibility

1. A completed successful retry SHALL count as AI success and reset the consecutive failure counter.
2. A call SHALL count as one AI failure only after all retry attempts are exhausted.
3. The existing fallback provider behavior SHALL continue to work when the primary circuit is open.

### R4. Logging And Secrets

1. Logs SHALL include only the AI label, HTTP status, attempt count, and provider failure class.
2. Logs SHALL NOT include request bodies, response bodies, API keys, user evidence, OCR text, or raw image data.

### R5. Tests

1. Tests SHALL verify a transient 503 followed by 200 returns the AI explanation.
2. Tests SHALL verify a 401 is not retried and degrades to `null`.
3. Tests SHALL verify an aborted request is not retried and degrades to `null`.
4. Tests SHALL verify repeated transient failures still degrade safely without changing scoring.
