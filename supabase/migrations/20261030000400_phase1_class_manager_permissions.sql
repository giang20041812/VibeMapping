-- ====================================================================
-- Phase 1 / Migration: Phân quyền trong lớp theo vai trò chủ nhiệm / bộ môn
--
-- 1. Tạo lớp, sửa lớp: chỉ quản trị trường (và quản trị hệ thống). Giáo viên không tự tạo lớp nữa;
--    quản trị trường tạo lớp rồi gán chủ nhiệm, bộ môn.
-- 2. Gán giáo viên, nhập danh sách (kể cả tạo tài khoản từ danh sách), xóa thành viên: quản trị trường
--    và giáo viên chủ nhiệm của chính lớp đó. Giáo viên bộ môn chỉ chấm điểm và xem báo cáo.
-- 3. RLS ghi trực tiếp vào class_members theo cùng luật (trước đây mọi giáo viên trong trường đều ghi được).
-- import_class_roster dựng lại từ bản 3 tham số (p_dry_run) và bỏ bản 2 tham số còn sót.
-- ====================================================================

-- 1. Người quản lý lớp ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_class(p_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_school_admin((SELECT school_id FROM public.classes WHERE id = p_class_id))
      OR EXISTS (
        SELECT 1 FROM public.class_members
         WHERE class_id = p_class_id AND user_id = auth.uid()
           AND member_role = 'homeroom_teacher' AND status = 'joined'
      );
$$;

-- 2. Tạo lớp: chỉ quản trị trường -------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_class(
  p_school_id uuid, p_class_name text, p_grade smallint, p_school_year text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_class_id uuid;
BEGIN
  IF NOT public.is_school_admin(p_school_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(trim(p_class_name), '') = '' OR coalesce(trim(p_school_year), '') = '' THEN
    RAISE EXCEPTION 'invalid_class';
  END IF;

  INSERT INTO public.classes (school_id, class_name, grade, school_year, created_by)
  VALUES (p_school_id, trim(p_class_name), p_grade, trim(p_school_year), auth.uid())
  RETURNING id INTO v_class_id;

  PERFORM public.write_audit_log(auth.uid(), NULL, 'create_class', 'classes', v_class_id, '{}'::jsonb);
  RETURN v_class_id;
END;
$$;

DROP POLICY IF EXISTS "Staff create classes" ON public.classes;
CREATE POLICY "Staff create classes" ON public.classes FOR INSERT TO authenticated
  WITH CHECK (public.is_school_admin(school_id));
DROP POLICY IF EXISTS "Staff update classes" ON public.classes;
CREATE POLICY "Staff update classes" ON public.classes FOR UPDATE TO authenticated
  USING (public.can_manage_class(id)) WITH CHECK (public.can_manage_class(id));

-- 3. Gán giáo viên vào lớp (giáo viên phải thuộc trường của lớp) ------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_class_teacher(p_class_id uuid, p_email text, p_member_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_school_id uuid;
  v_user_id uuid;
BEGIN
  IF p_member_role NOT IN ('homeroom_teacher', 'subject_teacher') THEN RAISE EXCEPTION 'invalid_member_role'; END IF;
  SELECT school_id INTO v_school_id FROM public.classes WHERE id = p_class_id;
  IF v_school_id IS NULL OR NOT public.can_manage_class(p_class_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT u.id INTO v_user_id FROM auth.users u WHERE lower(u.email) = lower(trim(p_email));
  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.school_staff WHERE school_id = v_school_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_school_staff');
  END IF;

  INSERT INTO public.class_members (class_id, user_id, member_role, status, joined_via, joined_at)
  VALUES (p_class_id, v_user_id, p_member_role, 'joined', 'manual', now())
  ON CONFLICT (class_id, user_id) WHERE user_id IS NOT NULL
  DO UPDATE SET member_role = EXCLUDED.member_role, status = 'joined';

  PERFORM public.write_audit_log(auth.uid(), v_user_id, 'assign_class_teacher', 'classes', p_class_id,
    jsonb_build_object('member_role', p_member_role));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. Xóa thành viên; học sinh vẫn tự rời lớp được --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_class_member(p_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m public.class_members;
BEGIN
  SELECT * INTO m FROM public.class_members WHERE id = p_member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'member_not_found'; END IF;

  IF m.user_id = auth.uid() AND m.member_role = 'student' THEN
    UPDATE public.class_members SET status = 'left' WHERE id = m.id;
  ELSIF public.can_manage_class(m.class_id) THEN
    IF m.user_id IS NULL THEN
      DELETE FROM public.class_members WHERE id = m.id;       -- dòng Excel chưa có tài khoản
    ELSE
      UPDATE public.class_members SET status = 'removed' WHERE id = m.id;
    END IF;
  ELSE
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF m.user_id IS NOT NULL THEN
    DELETE FROM public.class_assessment_grid_students s
     USING public.class_assessment_grids g
     WHERE s.grid_id = g.id AND g.class_id = m.class_id AND s.submitted_at IS NULL AND s.student_id = m.user_id;
  END IF;
  PERFORM public.write_audit_log(auth.uid(), m.user_id, 'remove_class_member', 'class_members', m.id, '{}'::jsonb);
END;
$$;

-- 5. Nhập danh sách: kiểm tra trước (p_dry_run), nhập sau ------------------------------------------------------
DROP FUNCTION IF EXISTS public.import_class_roster(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.import_class_roster(p_class_id uuid, p_rows jsonb, p_dry_run boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r jsonb;
  v_code text;
  v_name text;
  v_dob_text text;
  v_dob date;
  v_row integer;
  v_valid integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_seen text[] := ARRAY[]::text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id) THEN RAISE EXCEPTION 'class_not_found'; END IF;
  IF NOT public.can_manage_class(p_class_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) > 1000 THEN
    RAISE EXCEPTION 'invalid_rows';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_row := COALESCE((r ->> 'row')::integer, 0);
    v_code := trim(COALESCE(r ->> 'student_code', ''));
    v_name := trim(COALESCE(r ->> 'full_name', ''));
    v_dob_text := trim(COALESCE(r ->> 'date_of_birth', ''));
    v_dob := NULL;

    IF v_dob_text <> '' THEN
      IF v_dob_text ~ '^\d{4}-\d{2}-\d{2}$' THEN
        BEGIN
          v_dob := v_dob_text::date;
          IF v_dob > CURRENT_DATE OR v_dob < DATE '1900-01-01' THEN v_dob := NULL; v_dob_text := 'invalid'; END IF;
        EXCEPTION WHEN others THEN
          v_dob_text := 'invalid';
        END;
      ELSE
        v_dob_text := 'invalid';
      END IF;
    END IF;

    IF v_code = '' OR v_name = '' THEN
      v_errors := v_errors || jsonb_build_object('row', v_row, 'reason', 'missing_field',
                                                 'student_code', v_code, 'full_name', v_name);
    ELSIF v_dob_text = 'invalid' THEN
      v_errors := v_errors || jsonb_build_object('row', v_row, 'reason', 'invalid_date',
                                                 'student_code', v_code, 'full_name', v_name);
    ELSIF v_code = ANY (v_seen) THEN
      v_errors := v_errors || jsonb_build_object('row', v_row, 'reason', 'duplicate_in_file',
                                                 'student_code', v_code, 'full_name', v_name);
    ELSIF EXISTS (SELECT 1 FROM public.class_members
                   WHERE class_id = p_class_id AND roster_student_code = v_code) THEN
      v_errors := v_errors || jsonb_build_object('row', v_row, 'reason', 'already_in_class',
                                                 'student_code', v_code, 'full_name', v_name);
    ELSE
      IF NOT p_dry_run THEN
        INSERT INTO public.class_members (class_id, member_role, status, joined_via, roster_student_code, roster_full_name, roster_date_of_birth)
        VALUES (p_class_id, 'student', 'invited', 'excel_import', v_code, v_name, v_dob);
      END IF;
      v_valid := v_valid + 1;
    END IF;
    IF v_code <> '' THEN v_seen := v_seen || v_code; END IF;
  END LOOP;

  IF NOT p_dry_run THEN
    PERFORM public.write_audit_log(auth.uid(), NULL, 'import_class_roster', 'classes', p_class_id,
      jsonb_build_object('imported', v_valid, 'skipped', jsonb_array_length(v_errors)));
  END IF;
  RETURN jsonb_build_object('ok', true, 'dry_run', p_dry_run, 'imported', v_valid, 'errors', v_errors);
END;
$$;

-- 6. Dòng Excel chưa có tài khoản (để tạo tài khoản hàng loạt) -------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_roster_pending(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.classes;
  v_school_name text;
  v_rows jsonb;
BEGIN
  SELECT * INTO c FROM public.classes WHERE id = p_class_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'class_not_found'; END IF;
  IF NOT public.can_manage_class(c.id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT school_name INTO v_school_name FROM public.schools WHERE id = c.school_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'member_id', m.id, 'student_code', m.roster_student_code,
           'full_name', m.roster_full_name, 'date_of_birth', m.roster_date_of_birth)
         ORDER BY m.roster_student_code), '[]'::jsonb) INTO v_rows
    FROM public.class_members m
   WHERE m.class_id = c.id AND m.member_role = 'student' AND m.user_id IS NULL AND m.status = 'invited'
     AND m.roster_student_code IS NOT NULL;

  RETURN jsonb_build_object('school_id', c.school_id, 'school_name', v_school_name, 'class_id', c.id,
                            'grade', c.grade, 'rows', v_rows);
END;
$$;

-- 7. Ghi trực tiếp vào class_members ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Teacher manages members" ON public.class_members;
CREATE POLICY "Teacher manages members" ON public.class_members FOR ALL TO authenticated
  USING (public.can_manage_class(class_id))
  WITH CHECK (public.can_manage_class(class_id));

-- 8. Phân quyền thực thi ----------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.can_manage_class(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_class(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.import_class_roster(uuid, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_class_roster(uuid, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_class(uuid, text, smallint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_class_teacher(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_class_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_roster_pending(uuid) TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
  END IF;
END $$;
