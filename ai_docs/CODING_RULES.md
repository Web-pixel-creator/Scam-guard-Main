# Coding Rules

## Privacy & security (non-negotiable)

1. Never store or log raw OTP/SMS codes, full card numbers, PINs, passwords, passport data. Run `redactText` before persisting; rely on hashed `entity_hash`/`input_hash` for identifiers.
2. `client.server.ts` (service-role) and anything `*.server.ts` must never be imported into client/browser code — it bypasses RLS.
3. Public-facing data must respect RLS. Don't add public SELECT policies to `checks`, `reports`, or unconfirmed `entities`.
4. Entities become publicly visible only after `moderation_status='confirmed'`. Never auto-confirm from raw user reports.
5. Never name a specific person as a scammer. Use risk labels only.
6. Read env secrets inside handlers (per-request on Cloudflare), never at module scope.

## Risk engine

- Rules are deterministic and decide the score; AI only explains. Keep it that way.
- New scam patterns: add a `ReasonCode`, a `WEIGHTS` entry, a regex in `PATTERNS` (with RU **and** UZ Latin variants), and RU/UZ/EN strings in `REASON_LABELS`.
- Keep thresholds in `scoreFromCodes` consistent; document any change in `DECISIONS.md`.

## i18n

- App is trilingual **ru / uz / en**. Every user-facing string needs all three. Use `t()` / `t_dict` in `lib/i18n.ts`, or inline `{ ru, uz, en }[lang]` objects (pattern used in routes).
- Default language is `ru`; `LangSync` keeps `<html lang>`, title and meta in sync.

## UI / styling (see root `README.md`)

- **Orange = us (brand). Red = the threat (danger).** Don't reintroduce green/other accents in content.
- Never invent new red/orange shades. Use CSS variable tokens in `styles.css`; small red text (<18px) must use `--danger-strong`, not `--danger` (WCAG AA).
- Use shadcn/ui primitives from `components/ui`; respect aliases (`@/components`, `@/lib`, ...).
- Keep accessibility intact (`A11yPanel`, aria labels, focus states).

## Routing (see `src/routes/README.md`)

- File-based routing only. Don't create `src/pages/` or Next/Remix conventions.
- Never hand-edit `routeTree.gen.ts`.

## Server functions

- Validate all input with zod. Fail gracefully (return `{ ok:false }` or `null`) rather than leaking internals.
- Admin fns: always `requireSupabaseAuth` + `assertAdmin`.

## Tooling

- Lint with ESLint, format with Prettier before committing. TypeScript strict — no `any` leaks across boundaries.
- Don't manually re-add plugins already bundled by `@lovable.dev/vite-tanstack-config`.
- Files marked "automatically generated — do not edit" (supabase integration, route tree) are generated; change the source instead.
