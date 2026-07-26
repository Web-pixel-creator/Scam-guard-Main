-- Version metadata for deterministic HMAC identifiers.
--
-- Deployment order:
-- 1. Apply this additive migration while the app still uses HASH_PEPPER_SECRET.
-- 2. Deploy version-aware dual-read/new-write application code.
-- 3. Only in an approved maintenance window configure a new active pepper and
--    keep the old pepper in the single previous slot.
--
-- Existing hashes remain byte-for-byte unchanged and are labelled "legacy".
-- This migration never needs raw identifiers and does not attempt a backfill to
-- a new pepper, which is impossible without seeing the normalized input again.

ALTER TABLE public.checks
  ADD COLUMN input_hash_version TEXT NOT NULL DEFAULT 'legacy'
  CONSTRAINT checks_input_hash_version_format
  CHECK (input_hash_version ~ '^[a-z][a-z0-9_]{0,15}$');

ALTER TABLE public.reports
  ADD COLUMN entity_hash_version TEXT NOT NULL DEFAULT 'legacy'
  CONSTRAINT reports_entity_hash_version_format
  CHECK (entity_hash_version ~ '^[a-z][a-z0-9_]{0,15}$');

ALTER TABLE public.entities
  ADD COLUMN entity_hash_version TEXT NOT NULL DEFAULT 'legacy'
  CONSTRAINT entities_entity_hash_version_format
  CHECK (entity_hash_version ~ '^[a-z][a-z0-9_]{0,15}$');

ALTER TABLE public.telegram_reputation_targets
  ADD COLUMN target_hash_version TEXT NOT NULL DEFAULT 'legacy'
  CONSTRAINT telegram_reputation_target_hash_version_format
  CHECK (target_hash_version ~ '^[a-z][a-z0-9_]{0,15}$');

ALTER TABLE public.reputation_appeals
  ADD COLUMN target_hash_version TEXT NOT NULL DEFAULT 'legacy'
  CONSTRAINT reputation_appeals_target_hash_version_format
  CHECK (target_hash_version ~ '^[a-z][a-z0-9_]{0,15}$'),
  ADD COLUMN contact_hash_version TEXT,
  ADD CONSTRAINT reputation_appeals_contact_hash_version_format
  CHECK (
    contact_hash_version IS NULL
    OR contact_hash_version ~ '^[a-z][a-z0-9_]{0,15}$'
  );

UPDATE public.reputation_appeals
SET contact_hash_version = 'legacy'
WHERE contact_hash IS NOT NULL
  AND contact_hash_version IS NULL;

ALTER TABLE public.reputation_appeals
  ADD CONSTRAINT reputation_appeals_contact_hash_version_consistency
  CHECK (
    (contact_hash IS NULL AND contact_hash_version IS NULL)
    OR (contact_hash IS NOT NULL AND contact_hash_version IS NOT NULL)
  );

ALTER TABLE public.telegram_family_shield
  ADD COLUMN invite_code_hash_version TEXT NOT NULL DEFAULT 'legacy'
  CONSTRAINT telegram_family_shield_invite_hash_version_format
  CHECK (invite_code_hash_version ~ '^[a-z][a-z0-9_]{0,15}$');

COMMENT ON COLUMN public.checks.input_hash_version IS
  'Server-only pepper id for input_hash; never contains the pepper or raw input.';
COMMENT ON COLUMN public.reports.entity_hash_version IS
  'Server-only pepper id for entity_hash; never contains the pepper or raw identifier.';
COMMENT ON COLUMN public.entities.entity_hash_version IS
  'Server-only pepper id for entity_hash; legacy rows are preserved until safely encountered or merged.';
COMMENT ON COLUMN public.telegram_reputation_targets.target_hash_version IS
  'Server-only pepper id for target_hash; one previous version may remain readable during rotation.';
COMMENT ON COLUMN public.reputation_appeals.target_hash_version IS
  'Server-only pepper id for target_hash.';
COMMENT ON COLUMN public.reputation_appeals.contact_hash_version IS
  'Server-only pepper id for contact_hash; NULL when no contact hash exists.';
COMMENT ON COLUMN public.telegram_family_shield.invite_code_hash_version IS
  'Server-only pepper id for invite_code_hash so pending invites survive one approved rotation.';
