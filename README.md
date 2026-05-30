# Ishonch Guard

Anti-scam assistant for Uzbekistan. Paste a phone, link, Telegram username
or message and get a risk score in seconds.

---

## Color tokens & usage rules

All colors are defined as CSS variables in [`src/styles.css`](src/styles.css)
under `:root`. **Never invent new red/orange shades in components** — use a
token, or extend the token table first.

### Brand — `orange`

Identity, primary CTAs, our own actions, "what we do / what you get" surfaces.
This is the only decorative accent on the site.

| Token          | Hex      | AA on #FFFFFF | Use for                                                      |
| -------------- | -------- | ------------- | ------------------------------------------------------------ |
| `--brand`      | `#F97316` | 3.31 (large only) | Icons, primary CTA gradient, decorative accents          |
| `--brand-bright` | `#FB923C` | 2.26 (decorative) | Gradient stops, hover glow, dot accents — **never text** |
| `--brand-deep` | `#C2410C` | 5.18 ✓ AA      | Brand-colored body text, links, "→ What we do" labels       |

### Danger — `red`

Reserved for **pain, scam, loss, validation errors**. Red is a status color,
not a decoration. Never use it as a secondary accent or for emphasis that
isn't explicitly negative.

| Token            | Hex      | AA on #FFFFFF | AA on #F4F2EB | Use for                                          |
| ---------------- | -------- | ------------- | ------------- | ------------------------------------------------ |
| `--danger`       | `#DC2626` | 4.83 ✓       | 4.31 ✗ large  | Decorative dots, icons, borders, ≥18px bold text |
| `--danger-strong` | `#B91C1C` | 6.47 ✓       | 5.78 ✓        | Small body text (10–14px) on any light surface  |
| `--danger-deep`  | `#991B1B` | 8.31 ✓ AAA   | 7.42 ✓ AAA    | Chip / badge text on tinted backgrounds          |
| `--danger-soft`  | `#FEF2F2` | —             | —             | Chip / banner background                         |
| `--danger-border` | `#FCA5A5` | —            | —             | Chip / banner border                             |

### The rule (memorize this)

> **Orange = us. Red = the threat.** Green and other accents are gone — do
> not reintroduce them. If small text (under 18px) needs to be red, use
> `--danger-strong` (#B91C1C), not `--danger` (#DC2626) — the latter fails
> WCAG AA on our warm surface colors.

### Other status colors

| Token    | Hex      | Use for                                                |
| -------- | -------- | ------------------------------------------------------ |
| `--safe` | `#059669` | System status pings only (e.g. footer "ONLINE"). Do **not** use in content. |
| `--warn` | `#D97706` | Reserved — currently unused.                          |

### Neutrals

`bg #FCFAF9` · `surface #F4F2EB` · `card #FFFFFF` · `border #E2E0D8` ·
`text #0B0B0F / #18181B / #52525B / #A1A1AA`.

---

## Stack

TanStack Start v1 · React 19 · Vite 7 · Tailwind v4 · Lovable Cloud (Supabase).

Server functions live in `src/lib/*.functions.ts`. Routes live in `src/routes/`.
