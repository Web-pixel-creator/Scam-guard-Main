# Requirements Document

## Introduction

Telegram Image Intelligence v2 upgrades the bot screenshot/photo flow from plain OCR to structured image understanding. The goal is to avoid hallucinated high-risk verdicts for benign restaurant menus, delivery pickup SMS screenshots, QR menus, and promotional posters while still catching dangerous QR login/payment, OTP, APK, and card-data scenarios.

## Requirements

### Requirement 1: Structured Image Evidence

**User Story:** As a user sending a screenshot, I want the bot to understand what kind of image it is, so that it can give a precise answer instead of generic fallback text.

#### Acceptance Criteria

1. WHEN an image is processed, THE system SHALL produce a structured object containing redacted OCR text, visual category, confidence, QR presence/purpose, and risk hints.
2. THE structured object SHALL NOT include raw image bytes, full phone numbers, OTP codes, full card numbers, PINs, passwords, or passport data.
3. IF AI returns invalid JSON, THE system SHALL fall back to a deterministic text-only image evidence object rather than throwing.

### Requirement 2: Benign QR Suppression

**User Story:** As a user checking a restaurant QR menu or loyalty poster, I want the bot to avoid calling it high risk unless there is a real dangerous request.

#### Acceptance Criteria

1. WHEN image evidence is restaurant/menu/loyalty QR and no OTP, login, payment, transfer, APK, or card request is present, THE result SHALL NOT contain `asks_to_scan_qr`.
2. WHEN image evidence asks the user to scan QR for account login, verification, payment, transfer, or prize claim, THE result SHALL contain an appropriate dangerous reason code.
3. THE user explanation SHALL distinguish "QR menu/info" from "QR login/payment".

### Requirement 3: Delivery SMS Handling

**User Story:** As a user sending a normal delivery pickup SMS screenshot, I want the bot to say what it sees and what is missing, not invent a scam.

#### Acceptance Criteria

1. WHEN the image is a delivery pickup SMS with order/pickup text but no link, payment, OTP, APK, or card request, THE result SHALL be `unknown` or `safe`, never `high_risk`.
2. THE explanation SHALL say that delivery context is visible but there is no dangerous request in the screenshot.
3. IF payment/link/fee pressure is present, THE normal risk pipeline SHALL still flag delivery/payment risks.

### Requirement 4: Telegram Integration

**User Story:** As a Telegram user, I want photo replies to be calm, short, and actionable.

#### Acceptance Criteria

1. THE Telegram image handler SHALL download images only in memory, analyze them, run the risk pipeline on redacted evidence, and discard the image.
2. WHEN image analysis cannot read enough data, THE bot SHALL explain what to resend: text from SMS/chat, the QR URL, or what the sender asked the user to do.
3. Existing rate limits, file-size limits, MarkdownV2 escaping, and no-image-storage guarantees SHALL remain intact.
