-- Học sinh và sinh viên tự đổi nhóm của mình (cả tài khoản ẩn danh lẫn tài khoản email, Google, số điện thoại).
-- Trigger chặn đổi vai trò từ phase 3 đã chặn luôn set_my_learner_role nên không ai đổi được nhóm.
-- Nay trigger cho qua khi chính hàm set_my_learner_role đổi giữa student và university_student; mọi đổi vai trò khác vẫn chỉ quản trị hệ thống.

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Script bảo trì / service role không có phiên người dùng
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.is_system_admin()
     AND NOT (
       current_setting('app.learner_role_switch', true) = '1'
       AND OLD.role IN ('student', 'university_student')
       AND NEW.role IN ('student', 'university_student')
       AND NEW.id = auth.uid()
     ) THEN
    RAISE EXCEPTION 'role_change_forbidden';
  END IF;
  IF NEW.guardian_consent_confirmed IS DISTINCT FROM OLD.guardian_consent_confirmed
     AND current_setting('app.allow_guardian_flag', true) IS DISTINCT FROM '1'
     AND NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'guardian_consent_not_self_service';
  END IF;
  RETURN NEW;
END;
$$;

-- Khối lớp của học sinh (Lớp 9–12) và sinh viên (Năm 1–4, Mới đi làm) khác nhau nên đổi nhóm thì xóa lựa chọn cũ
CREATE OR REPLACE FUNCTION public.set_my_learner_role(p_role public.user_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current public.user_role;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_role NOT IN ('student', 'university_student') THEN RAISE EXCEPTION 'role_not_allowed'; END IF;

  SELECT role INTO v_current FROM public.user_profiles WHERE id = auth.uid();
  IF v_current IS NULL OR v_current NOT IN ('student', 'university_student') THEN
    RAISE EXCEPTION 'role_not_allowed';
  END IF;

  IF v_current <> p_role THEN
    PERFORM set_config('app.learner_role_switch', '1', true);
    UPDATE public.user_profiles SET role = p_role, grade_or_major = NULL WHERE id = auth.uid();
    PERFORM set_config('app.learner_role_switch', '0', true);
  END IF;
END;
$$;
