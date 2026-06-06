# Requirements: Phone Directory v1

## Overview

Users often paste a phone number while stressed and expect the bot to say more than "not enough data." Phone Directory v1 improves phone-number answers without pretending to know the owner of unknown numbers. The directory is a verified callback directory: exact official matches are shown with source confidence and spoofing warnings; unknown numbers remain neutral and ask for conversation context.

## Requirements

### R1. Verified Official Contacts

1. WHEN a phone number or short code exactly matches an entry in `VERIFIED_CONTACTS`, THE Bot SHALL show an official-contact badge with the localized organization name.
2. THE badge SHALL include enough context for the user to understand that this is a callback directory, not proof that an incoming call is safe.
3. WHEN the match is safe and there are no dangerous reason codes, THE risk level SHALL remain or become `safe`.
4. WHEN the same input also contains dangerous behavior (OTP, card data, APK, payment or QR coercion), THE dangerous behavior SHALL override the official match.

### R2. Unknown Phone Guidance

1. WHEN a valid Uzbek phone number has no verified directory match, THE Bot SHALL NOT infer an organization name, operator, bank or owner.
2. THE Bot SHALL explain that a number alone is not enough and that the request made during the call matters.
3. THE Bot SHALL ask for the conversation context: whether the caller requested an SMS code, card data, money, APK, QR login or remote access.
4. THE answer SHALL remain short and readable on mobile.

### R3. Privacy And Safety

1. THE directory layer SHALL NOT store raw phone numbers in Telegram session state.
2. THE persisted `checks` row SHALL continue to use masked display text and HMAC-hashed identifiers.
3. THE formatter SHALL never render a full raw user-submitted phone number unless it is a verified official directory display value.
4. THE system SHALL not add crowd-sourced labels until moderation and source confidence are designed.

### R4. Tests

1. Tests SHALL verify localized official-contact names for RU/UZ/EN.
2. Tests SHALL verify unknown Uzbek phone answers do not claim an organization.
3. Tests SHALL verify verified official contacts still include spoofing warnings.
4. Tests SHALL verify dangerous signals override verified contact safety.
