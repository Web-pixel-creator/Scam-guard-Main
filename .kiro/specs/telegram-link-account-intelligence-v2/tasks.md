# Implementation Plan

## Completed in no-DB phase

- [x] 1. Classify Telegram usernames, public links, private invites, and internal links.
- [x] 2. Skip network lookup for private invite and internal/private Telegram links.
- [x] 3. Add public metadata enrichment after deterministic risk scoring.
- [x] 4. Add honest found/not-found/unavailable/private/internal metadata briefs.
- [x] 5. Add compact Telegram-specific visible risk signals.
- [x] 6. Add Telegram-specific next-step sentences.
- [x] 7. Ensure not-found/unavailable usernames are not treated as proof of scam.
- [x] 8. Preserve deterministic risk fields during enrichment.
- [x] 9. Add regression tests for target extraction, metadata lookup, private invite behavior, and rendered Telegram handler output.
- [x] 10. Add risk-core regression test for private invite links with betting/prediction surrounding text.

## DB-backed reputation phase

- [x] 11. Design a DB-backed `telegram_reputation_targets` table using hashed identifiers, first_seen_at, last_seen_at, source_type, confidence, moderated report counters, and RLS.
- [x] 12. Add an admin moderation flow for Telegram reputation labels via report moderation sync.
- [x] 13. Add source labels in user-facing answers: official, Telegram-public, Ishonch Guard moderated reports, user-submitted unverified.
- [x] 14. Add a small "what I can/cannot check" help screen for Telegram account checks.
- [ ] 15. Add live QA scenarios for public channel, private invite, bot username, unavailable username, and official-looking support username.
