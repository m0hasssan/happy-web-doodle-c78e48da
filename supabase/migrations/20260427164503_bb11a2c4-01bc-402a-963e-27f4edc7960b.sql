
-- Create a test admin user with confirmed email
DO $$
DECLARE
  user_id uuid := gen_random_uuid();
  encrypted_pw text;
BEGIN
  -- Skip if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@admin.com') THEN
    RETURN;
  END IF;

  encrypted_pw := crypt('123456', gen_salt('bf'));

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, recovery_sent_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    user_id,
    'authenticated',
    'authenticated',
    'admin@admin.com',
    encrypted_pw,
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), user_id,
    format('{"sub":"%s","email":"%s"}', user_id::text, 'admin@admin.com')::jsonb,
    'email', user_id::text, now(), now(), now()
  );
END $$;
