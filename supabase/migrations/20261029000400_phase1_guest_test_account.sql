-- ====================================================================
-- Phase 1 / Migration: Khách làm bài test rồi tạo tài khoản
-- Khách đăng nhập ẩn danh (Supabase Auth, bật "Allow anonymous sign-ins"), làm bài như người dùng thường
-- (tài khoản ẩn danh dùng vai trò `authenticated`, nên mọi chính sách RLS hiện có áp dụng nguyên vẹn).
-- Làm xong, khách điền thông tin và gắn email + mật khẩu vào chính tài khoản đó nên kết quả được giữ nguyên.
-- Tài khoản ẩn danh mới có vai trò `student`; bước này cho đổi giữa hai nhóm làm bài.
-- ====================================================================

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
    UPDATE public.user_profiles SET role = p_role WHERE id = auth.uid();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_learner_role(public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_learner_role(public.user_role) TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.set_my_learner_role(public.user_role) TO service_role;
  END IF;
END $$;
