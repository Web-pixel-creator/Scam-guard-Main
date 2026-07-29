BEGIN;

SELECT plan(23);

SELECT ok(
  NOT has_schema_privilege('anon', 'private', 'USAGE'),
  'anon cannot resolve private helpers directly'
);
SELECT ok(
  NOT has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated cannot resolve private helpers directly'
);

-- Fixed fixtures are isolated by this transaction and disappear on ROLLBACK.
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-4000-8000-000000000a21'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'mfa-rls-admin@example.test',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

INSERT INTO public.user_roles (user_id, role)
VALUES (
  '00000000-0000-4000-8000-000000000a21'::uuid,
  'admin'::public.app_role
)
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.checks (
  id,
  input_type,
  redacted_input,
  input_hash,
  risk_level,
  risk_score,
  reason_codes,
  language
)
VALUES (
  '00000000-0000-4000-8000-000000000c21'::uuid,
  'text'::public.input_type,
  '[redacted test input]',
  'mfa-rls-check-hash',
  'unknown'::public.risk_level,
  0,
  '{}'::text[],
  'en'
);

INSERT INTO public.reports (
  id,
  entity_type,
  redacted_value,
  entity_hash,
  description,
  status,
  language
)
VALUES (
  '00000000-0000-4000-8000-000000000d21'::uuid,
  'text'::public.input_type,
  '[redacted report target]',
  'mfa-rls-report-hash',
  '[redacted test report]',
  'new'::public.report_status,
  'en'
);

INSERT INTO public.entities (
  id,
  entity_type,
  entity_hash,
  display_mask,
  risk_level,
  report_count,
  moderation_status
)
VALUES
  (
    '00000000-0000-4000-8000-000000000e21'::uuid,
    'text'::public.input_type,
    'mfa-rls-private-entity-hash',
    '[private entity]',
    'suspicious'::public.risk_level,
    0,
    'new'::public.report_status
  ),
  (
    '00000000-0000-4000-8000-000000000e22'::uuid,
    'text'::public.input_type,
    'mfa-rls-public-entity-hash',
    '[public entity]',
    'suspicious'::public.risk_level,
    1,
    'confirmed'::public.report_status
  );

INSERT INTO public.admin_actions (
  id,
  admin_user_id,
  action,
  target_type,
  target_id,
  reason
)
VALUES (
  '00000000-0000-4000-8000-000000000f21'::uuid,
  '00000000-0000-4000-8000-000000000a21'::uuid,
  'mfa_rls_test',
  'report',
  '00000000-0000-4000-8000-000000000d21'::uuid,
  '[redacted test reason]'
);

INSERT INTO public.telegram_reputation_targets (
  id,
  target_hash,
  target_type,
  display_hint,
  source_type,
  confidence,
  risk_level,
  moderation_status,
  unverified_report_count,
  moderated_report_count
)
VALUES
  (
    '00000000-0000-4000-8000-000000000b21'::uuid,
    'mfa-rls-private-telegram-hash',
    'public_username',
    '@pr***te',
    'system_observed',
    'low',
    'unknown'::public.risk_level,
    'new'::public.report_status,
    1,
    0
  ),
  (
    '00000000-0000-4000-8000-000000000b22'::uuid,
    'mfa-rls-public-telegram-hash',
    'public_username',
    '@pu***ic',
    'moderated_report',
    'high',
    'high_risk'::public.risk_level,
    'confirmed'::public.report_status,
    0,
    1
  );

-- The grants are local to this rolled-back test transaction. They isolate RLS
-- behavior even if a restored database snapshot has stricter table grants.
GRANT SELECT ON
  public.checks,
  public.reports,
  public.entities,
  public.admin_actions,
  public.telegram_reputation_targets
TO authenticated;
GRANT UPDATE ON public.reports, public.entities TO authenticated;

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000a21',
  true
);
SELECT set_config(
  'request.jwt.claim',
  '{"sub":"00000000-0000-4000-8000-000000000a21","role":"authenticated","aal":"aal1"}',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000a21","role":"authenticated","aal":"aal1"}',
  true
);

SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.checks
   WHERE id = '00000000-0000-4000-8000-000000000c21'::uuid),
  0::bigint,
  'an AAL1 admin cannot read checks'
);
SELECT is(
  (SELECT count(*) FROM public.reports
   WHERE id = '00000000-0000-4000-8000-000000000d21'::uuid),
  0::bigint,
  'an AAL1 admin cannot read reports'
);
SELECT is(
  (SELECT count(*) FROM public.entities
   WHERE id = '00000000-0000-4000-8000-000000000e21'::uuid),
  0::bigint,
  'an AAL1 admin cannot read an unconfirmed entity'
);
SELECT is(
  (SELECT count(*) FROM public.entities
   WHERE id = '00000000-0000-4000-8000-000000000e22'::uuid),
  1::bigint,
  'an AAL1 admin keeps ordinary public access to a confirmed entity'
);
SELECT is(
  (SELECT count(*) FROM public.admin_actions
   WHERE id = '00000000-0000-4000-8000-000000000f21'::uuid),
  0::bigint,
  'an AAL1 admin cannot read the audit log'
);
SELECT is(
  (SELECT count(*) FROM public.telegram_reputation_targets
   WHERE id = '00000000-0000-4000-8000-000000000b21'::uuid),
  0::bigint,
  'an AAL1 admin cannot read an unconfirmed Telegram reputation row'
);
SELECT is(
  (SELECT count(*) FROM public.telegram_reputation_targets
   WHERE id = '00000000-0000-4000-8000-000000000b22'::uuid),
  1::bigint,
  'an AAL1 admin keeps ordinary public access to a confirmed Telegram row'
);
WITH changed AS (
  UPDATE public.reports
  SET status = 'reviewing'::public.report_status
  WHERE id = '00000000-0000-4000-8000-000000000d21'::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM changed),
  0::bigint,
  'an AAL1 admin cannot update reports'
);
WITH changed AS (
  UPDATE public.entities
  SET risk_level = 'high_risk'::public.risk_level
  WHERE id = '00000000-0000-4000-8000-000000000e22'::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM changed),
  0::bigint,
  'an AAL1 admin cannot update even a publicly readable entity'
);

RESET ROLE;

SELECT set_config(
  'request.jwt.claim',
  '{"sub":"00000000-0000-4000-8000-000000000a21","role":"authenticated","aal":"aal2"}',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000a21","role":"authenticated","aal":"aal2"}',
  true
);

SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.checks
   WHERE id = '00000000-0000-4000-8000-000000000c21'::uuid),
  1::bigint,
  'an AAL2 admin can read checks'
);
SELECT is(
  (SELECT count(*) FROM public.reports
   WHERE id = '00000000-0000-4000-8000-000000000d21'::uuid),
  1::bigint,
  'an AAL2 admin can read reports'
);
SELECT is(
  (SELECT count(*) FROM public.entities
   WHERE id = '00000000-0000-4000-8000-000000000e21'::uuid),
  1::bigint,
  'an AAL2 admin can read unconfirmed entities'
);
SELECT is(
  (SELECT count(*) FROM public.admin_actions
   WHERE id = '00000000-0000-4000-8000-000000000f21'::uuid),
  1::bigint,
  'an AAL2 admin can read the audit log'
);
SELECT is(
  (SELECT count(*) FROM public.telegram_reputation_targets
   WHERE id = '00000000-0000-4000-8000-000000000b21'::uuid),
  1::bigint,
  'an AAL2 admin can read unconfirmed Telegram reputation'
);
WITH changed AS (
  UPDATE public.reports
  SET status = 'reviewing'::public.report_status
  WHERE id = '00000000-0000-4000-8000-000000000d21'::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM changed),
  1::bigint,
  'an AAL2 admin can update reports'
);
WITH changed AS (
  UPDATE public.entities
  SET risk_level = 'high_risk'::public.risk_level
  WHERE id = '00000000-0000-4000-8000-000000000e21'::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM changed),
  1::bigint,
  'an AAL2 admin can update entities'
);

RESET ROLE;

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000a22',
  true
);
SELECT set_config(
  'request.jwt.claim',
  '{"sub":"00000000-0000-4000-8000-000000000a22","role":"authenticated","aal":"aal2"}',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000a22","role":"authenticated","aal":"aal2"}',
  true
);

SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.checks
   WHERE id = '00000000-0000-4000-8000-000000000c21'::uuid),
  0::bigint,
  'an AAL2 authenticated user without the admin role cannot read checks'
);

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config(
  'request.jwt.claim',
  '{"role":"anon","aal":"aal1"}',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"anon","aal":"aal1"}',
  true
);

SET LOCAL ROLE anon;

SELECT is(
  (SELECT count(*) FROM public.entities
   WHERE id IN (
     '00000000-0000-4000-8000-000000000e21'::uuid,
     '00000000-0000-4000-8000-000000000e22'::uuid
   )),
  1::bigint,
  'anon still sees only the confirmed public entity'
);
SELECT is(
  (SELECT count(*) FROM public.telegram_reputation_targets
   WHERE id IN (
     '00000000-0000-4000-8000-000000000b21'::uuid,
     '00000000-0000-4000-8000-000000000b22'::uuid
   )),
  1::bigint,
  'anon still sees only the confirmed public Telegram reputation row'
);

RESET ROLE;

SELECT set_config(
  'request.jwt.claim',
  '{"role":"service_role"}',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"service_role"}',
  true
);

SET LOCAL ROLE service_role;

SELECT is(
  (SELECT count(*) FROM public.checks
   WHERE id = '00000000-0000-4000-8000-000000000c21'::uuid),
  1::bigint,
  'service_role keeps its RLS-bypass read access without an AAL claim'
);
WITH changed AS (
  UPDATE public.reports
  SET status = 'confirmed'::public.report_status
  WHERE id = '00000000-0000-4000-8000-000000000d21'::uuid
  RETURNING id
)
SELECT is(
  (SELECT count(*) FROM changed),
  1::bigint,
  'service_role keeps its RLS-bypass write access without an AAL claim'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
