-- ====================================================================
-- Phase 1 / Migration 18: Kiểm tra trước khi nhập danh sách; tiến độ tham gia khi báo cáo chưa đủ ngưỡng
--
-- 1. import_class_roster có chế độ kiểm tra (p_dry_run = true): trả về số dòng hợp lệ và danh sách lỗi, không ghi gì.
-- 2. Báo cáo lớp và trường trả thêm member_count (số học sinh trong danh sách) để hiện phần trăm tiến độ
--    tham gia khi nhóm chưa đủ 5 học sinh.
-- ====================================================================

-- 1. Nhập danh sách: kiểm tra trước, nhập sau ---------------------------------------------------------------
DROP FUNCTION IF EXISTS public.import_class_roster(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.import_class_roster(p_class_id uuid, p_rows jsonb, p_dry_run boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school_id uuid;
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
  SELECT school_id INTO v_school_id FROM public.classes WHERE id = p_class_id;
  IF v_school_id IS NULL THEN RAISE EXCEPTION 'class_not_found'; END IF;
  IF NOT (public.is_class_teacher(p_class_id) OR public.is_school_staff(v_school_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
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

-- 2. Báo cáo: thêm số học sinh trong danh sách ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_class_report(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school_id uuid;
  v_ids uuid[];
  v_joined integer;
  v_members integer;
  v_graded integer;
BEGIN
  SELECT school_id INTO v_school_id FROM public.classes WHERE id = p_class_id;
  IF v_school_id IS NULL THEN RAISE EXCEPTION 'class_not_found'; END IF;
  IF NOT (public.is_class_teacher(p_class_id) OR public.is_school_staff(v_school_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT array_agg(user_id), count(*) INTO v_ids, v_joined FROM public.class_members
   WHERE class_id = p_class_id AND member_role = 'student' AND status = 'joined' AND user_id IS NOT NULL;
  SELECT count(*) INTO v_members FROM public.class_members
   WHERE class_id = p_class_id AND member_role = 'student' AND status IN ('joined', 'invited');
  SELECT count(DISTINCT s.student_id) INTO v_graded
    FROM public.class_assessment_grid_students s JOIN public.class_assessment_grids g ON g.id = s.grid_id
   WHERE g.class_id = p_class_id AND g.status = 'submitted';

  RETURN public.build_group_report(COALESCE(v_ids, ARRAY[]::uuid[]))
         || jsonb_build_object('joined_count', v_joined, 'member_count', v_members, 'graded_count', v_graded);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_school_report(p_school_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ids uuid[];
  v_joined integer;
  v_members integer;
BEGIN
  IF NOT public.is_school_admin(p_school_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT array_agg(DISTINCT m.user_id), count(DISTINCT m.user_id) INTO v_ids, v_joined
    FROM public.class_members m JOIN public.classes c ON c.id = m.class_id
   WHERE c.school_id = p_school_id AND NOT c.is_archived
     AND m.member_role = 'student' AND m.status = 'joined' AND m.user_id IS NOT NULL;
  SELECT count(*) INTO v_members
    FROM public.class_members m JOIN public.classes c ON c.id = m.class_id
   WHERE c.school_id = p_school_id AND NOT c.is_archived
     AND m.member_role = 'student' AND m.status IN ('joined', 'invited');
  RETURN public.build_group_report(COALESCE(v_ids, ARRAY[]::uuid[]))
         || jsonb_build_object('joined_count', v_joined, 'member_count', v_members);
END;
$$;

-- 3. Phân quyền thực thi (hàm mới tạo lại nên cấp lại) --------------------------------------------------------
REVOKE ALL ON FUNCTION public.import_class_roster(uuid, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_class_roster(uuid, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_school_report(uuid) TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
  END IF;
END $$;
