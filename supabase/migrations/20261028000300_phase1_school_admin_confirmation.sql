-- ====================================================================
-- Phase 1 / Migration 14: Quản trị trường phải xác nhận lời mời trước khi có quyền
-- Quản trị hệ thống gán quản trị trường -> trạng thái 'pending'; người được gán xác nhận -> 'active'.
-- Chỉ nhân sự 'active' mới có quyền của trường (is_school_staff / is_school_admin).
-- Giáo viên do quản trị trường thêm vào có hiệu lực ngay.
-- ====================================================================

ALTER TABLE public.school_staff
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active'));

-- 1. Hàm hỗ trợ RLS chỉ tính nhân sự đã xác nhận ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_school_admin(p_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_system_admin() OR EXISTS (
    SELECT 1 FROM public.school_staff
     WHERE school_id = p_school_id AND user_id = auth.uid() AND staff_role = 'school_admin' AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_school_staff(p_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_system_admin() OR EXISTS (
    SELECT 1 FROM public.school_staff
     WHERE school_id = p_school_id AND user_id = auth.uid() AND status = 'active'
  );
$$;

-- 2. Thêm nhân sự: quản trị trường mới ở trạng thái chờ xác nhận ----------------------------------------
CREATE OR REPLACE FUNCTION public.add_school_staff(p_school_id uuid, p_email text, p_staff_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_user_id uuid;
  v_role public.user_role;
BEGIN
  IF p_staff_role NOT IN ('school_admin', 'teacher') THEN RAISE EXCEPTION 'invalid_staff_role'; END IF;
  IF p_staff_role = 'school_admin' THEN
    IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  ELSIF NOT public.is_school_admin(p_school_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT u.id INTO v_user_id FROM auth.users u WHERE lower(u.email) = lower(trim(p_email));
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'user_not_found'); END IF;
  SELECT role INTO v_role FROM public.user_profiles WHERE id = v_user_id;
  IF v_role IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'user_not_found'); END IF;

  IF p_staff_role = 'teacher' AND v_role NOT IN ('teacher', 'school_admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_teacher');
  END IF;
  -- Quản trị trường không tự đăng ký được: quản trị hệ thống nâng vai trò khi gán
  IF p_staff_role = 'school_admin' AND v_role <> 'school_admin' THEN
    UPDATE public.user_profiles SET role = 'school_admin' WHERE id = v_user_id;
  END IF;

  INSERT INTO public.school_staff (school_id, user_id, staff_role, status)
  VALUES (p_school_id, v_user_id, p_staff_role, CASE WHEN p_staff_role = 'school_admin' THEN 'pending' ELSE 'active' END)
  ON CONFLICT (school_id, user_id) DO UPDATE
    SET staff_role = EXCLUDED.staff_role,
        status = CASE
          WHEN EXCLUDED.staff_role = 'school_admin' AND public.school_staff.staff_role <> 'school_admin' THEN 'pending'
          ELSE public.school_staff.status
        END;

  PERFORM public.write_audit_log(auth.uid(), v_user_id, 'add_school_staff', 'school_staff', p_school_id,
    jsonb_build_object('staff_role', p_staff_role));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3. Lời mời đang chờ của chính người dùng (chưa đọc được bảng schools nên trả kèm tên trường) ------------
CREATE OR REPLACE FUNCTION public.get_my_school_invitations()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('school_id', s.id, 'school_name', s.school_name) ORDER BY s.school_name), '[]'::jsonb)
    FROM public.school_staff st JOIN public.schools s ON s.id = st.school_id
   WHERE st.user_id = auth.uid() AND st.staff_role = 'school_admin' AND st.status = 'pending';
$$;

-- 4. Người được gán xác nhận làm quản trị trường ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_school_admin(p_school_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.school_staff SET status = 'active'
   WHERE school_id = p_school_id AND user_id = auth.uid() AND staff_role = 'school_admin' AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  PERFORM public.write_audit_log(auth.uid(), auth.uid(), 'confirm_school_admin', 'school_staff', p_school_id, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_school_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_school_admin(uuid) TO authenticated;
