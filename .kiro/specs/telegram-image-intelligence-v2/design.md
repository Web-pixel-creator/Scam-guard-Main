# Design Document

## Overview

Image Intelligence v2 adds a structured evidence layer between Telegram image download and `runCheck`. Instead of passing free-form OCR text directly to the risk engine, the bot asks the vision provider for a strict JSON object, sanitizes it, adds deterministic fallback classification, then builds a redacted check input. The risk engine still owns scoring.

## Architecture

```
Telegram photo
  -> getFile / size check
  -> downloadFileAsDataUrl (memory only)
  -> analyzeImageCore(dataUrl, lang, rateLimitKey)
  -> buildImageCheckInput(evidence)
  -> runCheck(skipAi=true)
  -> buildImageUserExplanation(evidence, result)
  -> formatCheckResult
```

## Components

- `src/lib/risk/image-intelligence.ts`
  - Types for visual categories, QR purpose, risk hints, and sanitized evidence.
  - JSON parsing and sanitization.
  - Deterministic fallback classifier.
  - User-facing explanation builder.
  - Redacted risk-input builder.
- `src/lib/risk/check-core.ts`
  - Adds `analyzeImageCore`, using the existing OpenAI-compatible vision call and circuit breaker.
- `src/lib/telegram/handlers/check.ts`
  - Replaces direct OCR-only photo path with Image Intelligence v2.

## Data Models

`ImageIntelligenceResult` contains:

- `text: string | null`
- `visualCategory`
- `confidence`
- `qr.present`
- `qr.visibleUrl`
- `qr.purpose`
- `riskHints`
- `summary`

## Correctness Properties

1. Restaurant/menu QR without dangerous hints never produces `asks_to_scan_qr`.
2. QR login/payment evidence produces a risk input that can trigger `asks_to_scan_qr`.
3. Delivery pickup SMS without link/payment/OTP/APK is not high-risk.
4. Sanitized evidence never contains raw full card numbers or OTP-like digit runs.
5. Invalid model JSON does not throw.

## Testing Strategy

- Unit tests for sanitizer/fallback/check-input builder.
- Telegram webhook integration tests for benign menu QR, delivery SMS, dangerous QR login, OCR failure, and no raw image persistence.
- Existing full suite remains required before deploy.
