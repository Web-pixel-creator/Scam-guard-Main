BEGIN;
SELECT plan(18);

INSERT INTO public.admin_allowlist (email)
VALUES ('lifecycle-admin@example.test');

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
  '00000000-0000-4000-8000-000000000901'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'lifecycle-admin@example.test',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-4000-8000-000000000901'::uuid
      AND role = 'admin'
  ),
  'confirmed allowlisted signup receives admin'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-4000-8000-000000000901'::uuid
      AND role = 'user'
  ),
  'admin signup also receives the baseline user role'
);

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000901',
  true
);
SET LOCAL ROLE authenticated;
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::public.app_role
  ),
  'an already-issued authenticated identity is authorized while eligible'
);
RESET ROLE;

DELETE FROM public.admin_allowlist
WHERE email = 'lifecycle-admin@example.test';

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-4000-8000-000000000901'::uuid
      AND role = 'admin'
  ),
  'allowlist deletion revokes admin immediately'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-4000-8000-000000000901'::uuid
      AND role = 'user'
  ),
  'allowlist deletion preserves baseline user'
);

SET LOCAL ROLE authenticated;
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::public.app_role
  ),
  'the same authenticated identity is denied immediately after revocation'
);
RESET ROLE;

INSERT INTO public.admin_allowlist (email)
VALUES ('lifecycle-admin@example.test');
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-4000-8000-000000000901'::uuid
      AND role = 'admin'
  ),
  'restoring allowlist eligibility grants admin idempotently'
);

UPDATE public.admin_allowlist
SET email = '  LIFECYCLE-ADMIN@EXAMPLE.TEST  '
WHERE email = 'lifecycle-admin@example.test';
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-4000-8000-000000000901'::uuid
      AND role = 'admin'
  ),
  'case and surrounding whitespace use the same email identity as preflight'
);

UPDATE public.admin_allowlist
SET email = 'different-admin@example.test'
WHERE pg_catalog.lower(pg_catalog.btrim(email)) = 'lifecycle-admin@example.test';
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-4000-8000-000000000901'::uuid
      AND role = 'admin'
  ),
  'allowlist update to another identity revokes the old admin'
);

UPDATE public.admin_allowlist
SET email = 'lifecycle-admin@example.test'
WHERE email = 'different-admin@example.test';
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-4000-8000-000000000901'::uuid
      AND role = 'admin'
  ),
  'allowlist update back to the eligible identity restores admin'
);

UPDATE auth.users
SET email = '  LIFECYCLE-ADMIN@EXAMPLE.TEST  '
WHERE id = '00000000-0000-4000-8000-000000000901'::uuid;
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-4000-8000-000000000901'::uuid
      AND role = 'admin'
  ),
  'Auth email normalization matches allowlist normalization'
);

UPDATE auth.users
SET email = 'not-allowlisted@example.test'
WHERE id = '00000000-0000-4000-8000-000000000901'::uuid;
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-4000-8000-000000000901'::uuid
      AND role = 'admin'
  ),
  'confirmed email drift revokes admin'
);

UPDATE auth.users
SET email = 'lifecycle-admin@example.test'
WHERE id = '00000000-0000-4000-8000-000000000901'::uuid;
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-4000-8000-000000000901'::uuid
      AND role = 'admin'
  ),
  'returning to the confirmed allowlisted email restores admin'
);

UPDATE auth.users
SET email_confirmed_at = NULL
WHERE id = '00000000-0000-4000-8000-000000000901'::uuid;
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-4000-8000-000000000901'::uuid
      AND role = 'admin'
  ),
  'confirmation loss revokes admin'
);

UPDATE auth.users
SET email_confirmed_at = now()
WHERE id = '00000000-0000-4000-8000-000000000901'::uuid;
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-4000-8000-000000000901'::uuid
      AND role = 'admin'
  ),
  'confirmation restoration grants admin again'
);

SELECT ok(
  NOT has_function_privilege('anon', 'private.reconcile_admin_role(uuid)', 'EXECUTE'),
  'anon cannot execute the reconciler'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'private.reconcile_admin_role(uuid)', 'EXECUTE'),
  'authenticated cannot execute the reconciler'
);
SELECT ok(
  NOT has_function_privilege('service_role', 'private.reconcile_admin_role(uuid)', 'EXECUTE'),
  'service_role cannot bypass the trigger-owned reconciler'
);

SELECT * FROM finish();
ROLLBACK;
