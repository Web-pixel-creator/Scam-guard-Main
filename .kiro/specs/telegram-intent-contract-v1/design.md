# Telegram Intent Contract v1 Design

## Source of truth

- `ALL_META_INTENTS`, `ALL_VICTIM_INTENTS`,
  `ALL_LAST_CHECK_FOLLOW_UP_ACTIONS` and `PANIC_SCENARIO_IDS` are typed value
  lists from which their TypeScript unions derive.
- `intent-contract.ts` maps those lists to one registry. Duplicate ids fail at
  module initialization and tests verify complete cardinality.
- `dialogue-corpus.ts` expands one reviewed phrase per action/language through
  casing, padding and punctuation surfaces across eight conversation contexts.

## Channel effects

| Action                      | Direct                                                 | Inline                             |
| --------------------------- | ------------------------------------------------------ | ---------------------------------- |
| Meta/victim/follow-up reply | no persistence; no trusted contact                     | unsupported                        |
| Panic                       | safe metadata only                                     | unsupported                        |
| Risk check                  | check row; trusted contact only under high-risk policy | no persistence; no trusted contact |

## Corpus

Thirteen post-check actions x three languages x four surface variants x eight
contexts produce 1,248 deterministic rows. The 238 older live first-contact
rows remain a separate end-to-end handler regression and are mapped into the
same contract.

The corpus is not a claim that 1,248 independently authored sentences exist;
it is a reproducible dialogue-state matrix over reviewed phrases.
