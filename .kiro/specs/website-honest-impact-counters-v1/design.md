# Design Document

## Overview

Honest Impact Counters v1 extends the existing homepage stats surface. It keeps the current server-only Supabase access model: public clients call a TanStack server function, and the server uses the service-role client to load aggregate counts. The browser never receives raw check/report rows.

## Architecture

```
Homepage
  -> HomeImpactCounters
    -> getPublicStats server function
      -> get_check_stats RPC when available
      -> service-role exact count fallbacks
      -> normalizePublicStatsRow
```

The SQL migration updates `public.get_check_stats()` to include dangerous-result and report-loss aggregates. The application also computes exact counts server-side so production remains backward-compatible if the database migration is applied later than the web deploy.

## Data Model

`PublicStats` contains only aggregate fields:

- `total`
- `today`
- `confirmed_entities`
- `high_risk`
- `suspicious`
- `dangerous`
- `reports_total`
- `reports_with_loss_amount`
- `reported_loss_uzs`

No raw identifiers, descriptions, hashes, screenshots, OCR text, city or language are part of the public contract.

## Components

- `src/lib/trust/impact-stats.ts` normalizes rows and formats money.
- `src/lib/check.functions.ts` returns the extended `PublicStats`.
- `src/components/HomeImpactCounters.tsx` renders a compact homepage section.
- `src/routes/index.tsx` places the section after the existing top stats strip.

## Error Handling

- Missing new RPC columns default to `0`.
- Count query failures leave the corresponding counter at the RPC/fallback value.
- UI loading placeholders keep stable card dimensions.
- The money card uses conservative wording when no total is available.

## Testing Strategy

- Unit tests for stat normalization and safe key enumeration.
- Unit tests for compact UZS formatting.
- Existing `tsc`, lint, full Vitest and production build verify integration.
- Browser checks validate homepage desktop/mobile rendering and overflow.
