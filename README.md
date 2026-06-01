# Ishonch Guard

Anti-scam assistant for Uzbekistan. Paste a phone, link, Telegram username,
APK URL, screenshot or suspicious message and get a risk score in seconds.

## Stack

TanStack Start v1, React 19, Vite 7, Tailwind v4, Supabase, Nitro `node-server`.

Server functions live in `src/lib/*.functions.ts`. Routes live in `src/routes/`.
Production build emits `dist/server/index.mjs`; run it with `npm run start`.

Lovable was used only for the original UI design/template. Production runtime is
self-hosted Node/Docker/Railway-ready and does not depend on Lovable Cloud.

## Color tokens and usage rules

All colors are defined as CSS variables in `src/styles.css` under `:root`.
Never invent new red/orange shades in components; use a token or extend the
token table first.

### Brand: orange

Orange is our identity: primary CTAs, our actions, and "what we do" surfaces.
It is the only decorative accent on the site.

| Token | Hex | Use |
|---|---|---|
| `--brand` | `#F97316` | Icons, primary CTA gradient, decorative accents |
| `--brand-bright` | `#FB923C` | Gradient stops, hover glow, dot accents; never text |
| `--brand-deep` | `#C2410C` | Brand-colored body text, links, labels |

### Danger: red

Red is reserved for pain, scam, loss, validation errors and dangerous states.
It is a status color, not a secondary decorative accent.

| Token | Hex | Use |
|---|---|---|
| `--danger` | `#DC2626` | Decorative dots, icons, borders, large bold text |
| `--danger-strong` | `#B91C1C` | Small body text on light surfaces |
| `--danger-deep` | `#991B1B` | Chip/badge text on tinted backgrounds |
| `--danger-soft` | `#FEF2F2` | Chip/banner background |
| `--danger-border` | `#FCA5A5` | Chip/banner border |

The rule: **Orange = us. Red = the threat.**

### Other status colors

| Token | Hex | Use |
|---|---|---|
| `--safe` | `#059669` | System status pings only |
| `--warn` | `#D97706` | Reserved |

Neutrals: `#FCFAF9`, `#F4F2EB`, `#FFFFFF`, `#E2E0D8`,
`#0B0B0F`, `#18181B`, `#52525B`, `#A1A1AA`.
