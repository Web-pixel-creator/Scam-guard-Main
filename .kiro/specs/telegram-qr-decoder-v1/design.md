# Design: Telegram QR Decoder v1

## Overview

Add a small server-only QR layer between Telegram image download and AI image analysis. It decodes QR pixels from the in-memory data URL and merges decoded values into the structured image evidence before `buildImageCheckInput`.

## Architecture

1. Telegram downloads the image as a data URL in memory.
2. `decodeQrFromDataUrl` parses the data URL and decodes PNG/JPEG pixels.
3. The QR decoder runs `jsqr` on the full image and overlapping tiles.
4. Decoded values are normalized, redacted, deduplicated and capped.
5. `mergeDecodedQrEvidence` injects decoded QR URL/text into `ImageIntelligenceResult`.
6. The existing `runCheck` pipeline scores the resulting check input.

## Components

- `src/lib/risk/qr-decoder.ts`
  - `decodeQrFromDataUrl(dataUrl): DecodedQrEvidence`
  - `mergeDecodedQrEvidence(evidence, qr): ImageIntelligenceResult`
  - bounded PNG/JPEG decode helpers
- `src/lib/telegram/handlers/check.ts`
  - calls QR decode after download and before `analyzeImageCore`

## Correctness Properties

1. A valid QR PNG containing a URL is decoded.
2. Duplicate QR scan results are deduplicated.
3. Unsupported MIME/data URL input returns no values.
4. Oversized decoded dimensions return no values.
5. Decoded QR URLs reach `buildImageCheckInput`.
6. Raw image bytes/data URLs are not persisted.

## Error Handling

All decoder errors fail closed and return empty evidence. The bot continues with existing AI image analysis or unreadable-image fallback.

## Testing Strategy

Use the `qrcode` package to create QR PNGs in tests, so no binary fixtures are committed.
