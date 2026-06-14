# Requirements — Reputation Appeals v1

## Overview

Ishonch Guard can show public reputation only after moderation. Before broader launch, users need a safe way to ask for correction or removal when a phone, Telegram target or URL is incorrectly represented.

## Requirements

### R1. Public Appeal Submission

1. WHEN a user submits an appeal, THE system SHALL accept only phone, Telegram, URL or APK targets.
2. THE system SHALL reject free-form text-only appeals and guide users toward the report flow instead.
3. THE system SHALL rate-limit submissions to reduce abuse.

### R2. Privacy Boundary

1. THE system SHALL NOT store raw phone numbers, Telegram handles, URLs or contact details in the appeals table.
2. THE system SHALL store HMAC hashes for the target and optional contact.
3. THE system SHALL store only masked display values and redacted reasons.
4. THE system SHALL NOT expose appeal rows to anon or authenticated clients directly.

### R3. Admin Review

1. Admins SHALL be able to list appeals by status.
2. Admins SHALL be able to remove public reputation after review.
3. Admins SHALL be able to keep public reputation after review.
4. Each admin decision SHALL be written to the admin audit log.

### R4. Reputation Removal Semantics

1. Removing reputation SHALL hide the public entity by moving it to `rejected` and `unknown`.
2. Removing reputation SHALL NOT delete the original reports.
3. Removing Telegram reputation SHALL also disable the app-owned Telegram reputation target label.

### R5. User-Facing Appeal Page

1. The website SHALL provide a `/appeal` page.
2. The page SHALL explain when to use appeals and what data is stored.
3. The page SHALL warn users not to submit OTP, PIN, CVV, passwords or document photos.

### R6. Documentation

1. Project docs SHALL record moderation and appeal rules.
2. The roadmap/open tasks SHALL reflect that appeal/removal v1 exists.
