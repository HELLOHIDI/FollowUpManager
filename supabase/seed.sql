-- Local development only. Keep the single internal administrator available
-- after every `supabase db reset`; E2E cleanup must not delete this fixed user.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  phone,
  phone_change,
  phone_change_token,
  reauthentication_token,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
values (
  '00000000-0000-0000-0000-000000000000',
  '2a9d9ca7-50b5-4f59-bd52-a65cc8c9756e',
  'authenticated',
  'authenticated',
  'admin@example.com',
  extensions.crypt('admin1234', extensions.gen_salt('bf')),
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"email_verified":true}'::jsonb,
  now(),
  now(),
  false,
  false
)
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  confirmation_token = excluded.confirmation_token,
  recovery_token = excluded.recovery_token,
  email_change_token_new = excluded.email_change_token_new,
  email_change = excluded.email_change,
  phone = excluded.phone,
  phone_change = excluded.phone_change,
  phone_change_token = excluded.phone_change_token,
  reauthentication_token = excluded.reauthentication_token,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now(),
  deleted_at = null,
  banned_until = null;

insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  created_at,
  updated_at
)
values (
  '2a9d9ca7-50b5-4f59-bd52-a65cc8c9756e',
  '2a9d9ca7-50b5-4f59-bd52-a65cc8c9756e',
  '{"sub":"2a9d9ca7-50b5-4f59-bd52-a65cc8c9756e","email":"admin@example.com","email_verified":true,"phone_verified":false}'::jsonb,
  'email',
  now(),
  now()
)
on conflict (provider_id, provider) do update
set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = now();
