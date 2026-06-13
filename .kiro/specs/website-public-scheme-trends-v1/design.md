# Design

## Overview

Website Public Scheme Trends v1 adds `/scam-trends` plus a small homepage teaser.
It is a static-first public education layer backed by a structured helper module.
The first version does not query raw reports. It summarizes already-shipped
coverage and research-feed categories into short, actionable public entries.

## Architecture

```
SCAM_COVERAGE / rules reason codes
        |
        v
src/lib/trust/scheme-trends.ts
        |
        +--> helper tests
        |
        +--> SchemeTrendsPanel component
        |
        +--> /scam-trends route
        |
        +--> HomeSchemeTrends teaser on /
```

## Components and Interfaces

- `scheme-trends.ts`
  - exports `PUBLIC_SCHEME_TRENDS`
  - exports `getSchemeTrendStats()`
  - exports `filterSchemeTrends({ category, query })`
  - exports labels for category and status
- `SchemeTrendsPanel.tsx`
  - renders stats, search, filters and trend cards
  - shows hook, goal, safe step, evidence labels and reason codes
- `HomeSchemeTrends.tsx`
  - compact homepage teaser linking to `/scam-trends`
- `scam-trends.tsx`
  - public route with honest privacy and source wording

## Data Model

Each trend entry contains only public educational metadata:

- stable ID
- category
- status (`active_watch` or `baseline`)
- source label (`research_feed`, `coverage`, `moderated_aggregate`)
- severity
- reason-code families
- localized title, hook, goal, safe step and user action

Forbidden fields:

- raw phone number
- raw username
- raw URL
- raw report description
- screenshot or OCR text
- Telegram account age, hidden labels or private report history

## Correctness Properties

1. Trend IDs are unique.
2. Every trend has at least one reason code.
3. Public stats match the entries.
4. Filtering by category never returns other categories.
5. Search is case-insensitive across RU/UZ/EN text.
6. No entry exposes private-evidence keys.
7. Every entry has a safe next step in all supported languages.

## Error Handling

The feature is static data. Empty filters render a calm empty state and do not
fall back to private data. Missing or malformed data should fail tests before
deployment.

## Testing Strategy

- Unit tests for stats, uniqueness, search/filter and privacy keys.
- Existing full test suite, typecheck, lint and build.
- Browser checks for desktop and mobile `/scam-trends` and homepage teaser.
