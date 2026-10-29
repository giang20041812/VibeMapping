-- ====================================================================
-- Phase 1 / Migration: Thông tin cá nhân nhập ngay lúc đăng ký
-- Trigger tạo user_profiles đọc thêm ngày sinh, tên hiển thị, trường, khối lớp / ngành học từ raw_user_meta_data.
-- Chỉ áp dụng cho học sinh và sinh viên. Giá trị sai định dạng được bỏ qua (để trống) để không chặn việc tạo tài khoản;
-- người dùng vẫn bổ sung được ở trang hồ sơ.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.user_role;
  v_meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_date_of_birth date;
  v_display_name text;
  v_school_name text;
  v_grade_or_major text;
BEGIN
  BEGIN
    v_role := COALESCE(v_meta ->> 'role', 'student')::public.user_role;
  EXCEPTION WHEN invalid_text_representation THEN
    v_role := 'student';
  END;
  -- Quản trị chỉ được cấp thủ công, không cho tự đăng ký
  IF v_role IN ('system_admin', 'school_admin') THEN
    v_role := 'student';
  END IF;

  IF v_role IN ('student', 'university_student') THEN
    BEGIN
      v_date_of_birth := NULLIF(btrim(v_meta ->> 'date_of_birth'), '')::date;
    EXCEPTION WHEN others THEN
      v_date_of_birth := NULL;
    END;
    IF v_date_of_birth IS NOT NULL AND (v_date_of_birth > current_date OR v_date_of_birth < DATE '1900-01-01') THEN
      v_date_of_birth := NULL;
    END IF;

    -- Cùng ràng buộc user_profiles_display_name_format
    v_display_name := NULLIF(btrim(v_meta ->> 'display_name'), '');
    IF v_display_name IS NOT NULL AND (
      char_length(v_display_name) > 20
      OR v_display_name ~ '[\x21-\x2c.\/\x3a-\x40\x5b-\x5e\x60\x7b-\x7e]'
    ) THEN
      v_display_name := NULL;
    END IF;

    v_school_name := left(NULLIF(btrim(v_meta ->> 'school_name'), ''), 200);
    v_grade_or_major := left(NULLIF(btrim(v_meta ->> 'grade_or_major'), ''), 50);
  END IF;

  INSERT INTO public.user_profiles (id, role, full_name, date_of_birth, display_name, school_name, grade_or_major)
  VALUES (NEW.id, v_role, v_meta ->> 'full_name', v_date_of_birth, v_display_name, v_school_name, v_grade_or_major)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
