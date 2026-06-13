# Design Document

## Overview

Website Trust Surface v1 adds a public route `/official-numbers` and a compact homepage trust block. The feature is static-first: verified contacts come from `src/lib/risk/verified-contacts.ts`, while existing public stats still come through `getPublicStats()`.

## Architecture

- `src/lib/trust/official-directory.ts` provides pure helpers for grouping, searching, filtering and rendering contact actions.
- `src/components/OfficialContactsDirectory.tsx` renders the searchable/filterable contact directory.
- `src/components/HomeTrustSurface.tsx` renders a homepage trust block linking to the directory.
- `src/routes/official-numbers.tsx` provides SEO metadata and page layout.
- `src/components/StatsStrip.tsx` adds the verified-contact count and safer labels.

No new database tables, secrets, providers or persistence are required.

## Components and Interfaces

### Official Directory Helpers

```ts
type OfficialContactFilter = "all" | OrgType;

function getOfficialDirectoryStats(): {
  total: number;
  callable: number;
  banks: number;
  paymentSystems: number;
  telecoms: number;
  government: number;
};

function filterOfficialContacts(query: string, filter: OfficialContactFilter): VerifiedContact[];
function getContactAction(contact: VerifiedContact): { href: string; label: string } | null;
```

### Directory UI

The UI has:

- a short safety banner;
- search input;
- type filters;
- repeated contact cards;
- call/open-source actions.

### Homepage Trust Block

The block shows:

- verified official contacts count;
- active protection wording;
- a link to `/official-numbers`;
- a link to `/check`.

## Data Models

Reuses `VerifiedContact` exactly. No raw user input, reports, OCR text, phone checks or session data are stored or exposed.

## Correctness Properties

1. Directory rendering uses every contact from `VERIFIED_CONTACTS` when no filter is active.
2. Search is case-insensitive across organization names, display value, descriptions and source.
3. `tel:` links are created only for `phone`, `short_code` and `toll_free`.
4. External source links are marked as external in the UI.
5. Homepage count equals `VERIFIED_CONTACTS_COUNT`.
6. User-facing labels never say a listed number proves an incoming call is safe.

## Error Handling

- Empty search results show a safe fallback and check CTA.
- Unknown contact types show no action button rather than a broken link.
- The directory does not depend on Supabase, so DB outages do not affect it.

## Testing Strategy

- Unit tests for directory helper filtering, grouping and action generation.
- TypeScript/build verification for route integration.
- Browser visual smoke test for `/official-numbers` desktop and mobile.
