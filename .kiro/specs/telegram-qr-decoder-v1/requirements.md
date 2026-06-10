# Requirements: Telegram QR Decoder v1

## Overview

Ishonch Guard SHALL decode QR codes from Telegram images when possible, without saving images and without relying only on AI vision guesses. The implementation MUST stay bounded, private, and conservative.

## Requirements

### R1. Pixel QR Decoding

1. WHEN a Telegram photo or image document contains a readable QR code, THE bot SHALL attempt to decode the QR from image pixels before final risk scoring.
2. THE decoder SHALL support PNG and JPEG images downloaded as data URLs.
3. THE decoder SHALL return at most a small bounded set of unique decoded values.
4. THE decoder SHALL not guess QR contents when decoding fails.

### R2. Safety and Privacy

1. THE decoder SHALL process images only in memory and SHALL NOT persist raw bytes, file paths, or data URLs.
2. THE decoder SHALL enforce decoded pixel limits to reduce decompression-bomb risk.
3. THE decoder SHALL clamp and redact decoded values before they are passed to scoring or persistence.
4. Unsupported MIME types or malformed data URLs SHALL fail closed.

### R3. Risk Integration

1. WHEN a decoded QR contains a URL, THE image evidence SHALL expose it as visible/decoded QR evidence.
2. WHEN a decoded QR URL is risky, THE normal rules pipeline SHALL score it using existing URL/text reason codes.
3. WHEN the QR is a normal menu/info URL and no other dangerous signals exist, THE result SHALL remain calm and not high risk.

### R4. Verification

1. Unit tests SHALL generate real QR PNG fixtures at runtime and verify URL extraction.
2. Integration tests SHALL verify decoded QR evidence flows through the Telegram image handler.
3. Tests SHALL verify malformed images and over-large decoded dimensions fail closed.
