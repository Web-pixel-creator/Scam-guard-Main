# Design: Official Number Lookalike v1

## Overview

The feature extends `phone-intelligence.ts` with an offline, deterministic comparison against `VERIFIED_CONTACTS`. It enriches the existing `PhoneIntelligencePassport` with an optional `officialLookalike` object. Scoring remains unchanged.

## Architecture

Pipeline:

1. `runCheck` detects and normalizes a phone input.
2. `findVerifiedContactForCheck` runs first.
3. `buildPhoneIntelligencePassport(raw, normalized, verifiedContact)` builds country/operator/directory metadata.
4. If `verifiedContact` is null, the passport compares digits to verified phone/short-code/toll-free contacts.
5. `formatCheckResult` renders a short caution inside the brief phone section.

## Components And Interfaces

### `OfficialContactLookalike`

Fields:

- `org`: trilingual organization name from the verified contact.
- `display`: verified contact display value.
- `contactType`: verified contact type.
- `reason`: `full_number_near_miss`, `short_code_near_miss`, or `short_code_suffix`.
- `confidence`: `medium` for edit-distance near misses, `low` for suffix resemblance.

### Detection Rules

- Full number near miss: candidate and verified digits both have length at least 9, same length, and Levenshtein distance is 1 or 2.
- Short-code near miss: both sides are 3-5 digits, same length, and distance is exactly 1.
- Short-code suffix resemblance: candidate length is at least 9 and ends with a verified short code or toll-free contact of length at least 4.
- Exact verified matches are excluded by receiving `verifiedContact`.

## Correctness Properties

1. Exact verified contacts never produce `officialLookalike`.
2. A regular mobile number with no near match produces no lookalike.
3. A one-digit short-code typo produces a medium-confidence lookalike.
4. A one/two-digit full-number typo produces a medium-confidence lookalike.
5. A full number ending with a verified 4+ digit short code produces only low confidence.
6. Lookalike presence does not change `score`, `level`, or `reasons`.

## Error Handling

The comparison is pure and cannot fail under normal conditions. If a malformed verified contact exists, it is ignored by digit-length guards.

## Testing Strategy

- Unit tests in `phone-intelligence.test.ts`.
- Integration test in `check-core.property.test.ts` to ensure `runCheck` exposes passport data without changing risk level.
- Formatter tests in `format.test.ts` for RU wording and no raw number/accusation leakage.
