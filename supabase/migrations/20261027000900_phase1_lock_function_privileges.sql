-- ====================================================================
-- Phase 1 / Migration 9: Siết quyền thực thi hàm
-- Supabase mặc định cấp EXECUTE trên mọi hàm mới cho anon và authenticated, nên
-- REVOKE FROM PUBLIC là chưa đủ. Gỡ toàn bộ rồi chỉ cấp lại đúng các hàm được phép gọi.
-- ====================================================================

-- 1. Hàm tạo sau này mặc định không cấp cho anon/authenticated (phải GRANT rõ ràng)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- 2. Gỡ quyền trên mọi hàm hiện có trong schema public (trừ hàm của extension)
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prokind = 'f'
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

-- 3. API cho khách (không đăng nhập) và người đã đăng nhập
GRANT EXECUTE ON FUNCTION public.get_invitation_public(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_360_submission(text, text, text, smallint, smallint, smallint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_360_questions(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_360_answers(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_360(text) TO anon, authenticated;

-- 4. API chỉ cho người đã đăng nhập
GRANT EXECUTE ON FUNCTION public.decide_submission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_class_grid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_self_assessment(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_my_result(uuid) TO authenticated;

-- 5. Hàm hỗ trợ chính sách RLS (được gọi khi đánh giá policy với quyền của người dùng)
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_teacher(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_result_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_under_guardian_age(date) TO authenticated;

-- 6. service_role (Edge Function, script bảo trì) được gọi mọi hàm, gồm auto_finalize_results
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
  END IF;
END $$;
