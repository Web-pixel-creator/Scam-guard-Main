# Implementation Plan

- [x] 1. Add private Family Shield migration
  - Create `telegram_family_shield` with RLS, service-role-only grants, indexes, and one active/pending contact per guardian.

- [x] 2. Implement server-side Family Shield module
  - Generate hashed invite tokens, accept invites, revoke relationships, and send redacted trusted-contact notifications.

- [x] 3. Wire Telegram commands and callbacks
  - Add `/family`, `/start family_<token>`, `family:invite`, `family:notify`, and `family:revoke`.

- [x] 4. Add high-risk and panic entry points
  - Add trusted-contact action to high-risk check results and live-call/follow-up flows.

- [x] 5. Add tests and verification
  - Cover privacy, self-link rejection, cooldown, degradation, command routing, and callback routing.

- [x] 6. Deploy code and smoke-test production
  - Run tests/build, commit, push, deploy to Railway, register Telegram commands, and run production smoke.

- [ ] 7. Apply production Supabase migration
  - Apply `20260612053155_telegram_family_shield.sql` to the linked Supabase project once `SUPABASE_ACCESS_TOKEN`/SQL Editor access is available.
