# Report Screenshot Evidence v1 Requirements

## Overview

Telegram users should be able to attach a screenshot while filing a `/report` complaint, without turning Ishonch Guard into a raw evidence vault. The first version uses screenshots only as transient evidence: the bot downloads the image in memory, extracts structured/redacted evidence, stores only a short safe summary in the report draft, and never persists the image bytes, data URL, QR raw payload, or full OCR text.

## Requirements

### Requirement 1: Screenshot Accepted During Report Description

**User Story:** As a user filing a complaint, I want to send a screenshot instead of typing a long description, so that reporting is easier when I am stressed.

#### Acceptance Criteria

1. WHEN a Telegram user is in `report_desc` and sends a photo or image document, THE Bot SHALL route it to the report screenshot evidence handler.
2. THE Bot SHALL preserve normal caption-as-text behavior when a caption is present.
3. THE Bot SHALL keep other report steps text-only.

### Requirement 2: Privacy-Safe Evidence Extraction

**User Story:** As a privacy-conscious user, I want screenshots to be processed without permanent file storage, so that sensitive data is not retained unnecessarily.

#### Acceptance Criteria

1. THE Bot SHALL download image bytes only in memory.
2. THE Bot SHALL NOT store raw image bytes, data URLs, full OCR text, decoded QR values, card data, OTPs, URLs, or phone numbers in `telegram_sessions` or `reports`.
3. THE Bot SHALL store only a short redacted summary of the screenshot in the draft description.
4. IF no usable evidence can be extracted, THE Bot SHALL ask for a short typed description instead of guessing.

### Requirement 3: Existing Check Flow Is Unchanged

**User Story:** As a user checking a screenshot outside `/report`, I still want the normal risk-check result.

#### Acceptance Criteria

1. WHEN no report scenario is active, THE Bot SHALL route images to the existing check image pipeline.
2. WHEN `await_check` is active, THE Bot SHALL route images to the existing check image pipeline and reset the scenario.
3. Existing image size limits and rate limits SHALL apply.

### Requirement 4: Verification

#### Acceptance Criteria

1. Router tests SHALL cover report screenshot routing.
2. Report handler tests SHALL cover successful evidence extraction, OCR failure fallback, and no raw sensitive data in saved drafts.
3. The implementation SHALL pass TypeScript and targeted Telegram tests.
