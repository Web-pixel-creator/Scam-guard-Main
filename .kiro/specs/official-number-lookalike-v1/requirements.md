# Requirements: Official Number Lookalike v1

## Overview

Official Number Lookalike v1 helps users when an unknown phone number resembles a verified bank, payment, telecom, cybersecurity, or government contact. It must be useful in a live-call situation without claiming that the number owner is a scammer or that hidden caller data is available.

## Requirements

### R1. Near-Miss Detection

1. WHEN a checked phone or short code does not exactly match the verified contacts directory, THE system SHALL compare it with verified phone, short-code, and toll-free contacts.
2. THE system SHALL detect a near miss when a full number is one or two digits away from a verified full number of the same length.
3. THE system SHALL detect a near miss when a 3-5 digit short code is one digit away from a verified short code of the same length.
4. THE system MAY detect that a full number ends with a verified short code of at least four digits as a low-confidence visual resemblance.

### R2. False Positive Protection

1. Exact verified contacts SHALL remain exact matches, not lookalikes.
2. Lookalike detection SHALL NOT by itself raise the result to `suspicious` or `high_risk`.
3. Short-code suffix matches SHALL be labelled low-confidence and SHALL NOT include emergency 3-digit codes.
4. The user-facing text SHALL say "похож, но не совпадает" / equivalents, not "scammer", "fake owner", or hidden spam-history claims.

### R3. User Guidance

1. WHEN a lookalike is detected, THE Telegram result SHALL show the official organization and official contact it resembles.
2. The guidance SHALL tell the user not to call back via the incoming number/SMS and to use the bank app, card, official website, or the verified contact shown.
3. If dangerous reason codes are also present, existing high-risk behavior SHALL remain dominant.

### R4. Privacy And Persistence

1. The feature SHALL use only the normalized digits already processed by the phone pipeline and the local verified directory.
2. The feature SHALL NOT store raw phone numbers, screenshots, or new personal data.
3. The feature SHALL NOT call external providers.

### R5. Tests

1. Tests SHALL cover exact verified contacts not being marked as lookalikes.
2. Tests SHALL cover full-number near misses, short-code near misses, and low-confidence suffix resemblance.
3. Tests SHALL cover random regular Uzbek numbers not being labelled as official lookalikes.
4. Formatter tests SHALL cover the "not exact, call official source" wording and absence of accusation.
