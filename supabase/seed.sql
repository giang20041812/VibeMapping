-- Dữ liệu khởi tạo được nạp bằng script: npm run import:ba (tiêu chí, câu hỏi từ file Excel của team BA).
-- Tham số vận hành mặc định và danh mục Holland / giá trị cốt lõi đã nằm trong migration.

-- Tài khoản quản trị mẫu: admin@admin.com / 12345678 (chạy lại nhiều lần vẫn an toàn)
DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE email = 'admin@admin.com';
  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      'admin@admin.com', crypt('12345678', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"full_name":"Admin"}', now(), now(),
      '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_id, v_id::text, 'email',
            jsonb_build_object('sub', v_id::text, 'email', 'admin@admin.com', 'email_verified', true),
            now(), now(), now());
  END IF;

  -- Trigger đăng ký luôn tạo vai trò học sinh; quản trị phải nâng quyền thủ công
  INSERT INTO public.user_profiles (id, role, full_name)
  VALUES (v_id, 'system_admin', 'Admin')
  ON CONFLICT (id) DO UPDATE SET role = 'system_admin', full_name = 'Admin';
END $$;
