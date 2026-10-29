-- ====================================================================
-- Phase 1 / Migration 16: Ngày sinh trong danh sách học sinh nhập từ Excel
-- Mẫu nhập danh sách có cột Ngày sinh (DD/MM/YYYY, có thể để trống). Client đổi sang yyyy-mm-dd trước khi gửi.
-- ====================================================================

ALTER TABLE public.class_members ADD COLUMN IF NOT EXISTS roster_date_of_birth date;

CREATE OR REPLACE FUNCTION public.import_class_roster(p_class_id uuid, p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school_id uuid;
  r jsonb;
  v_code text;
  v_name text;
  v_dob_text text;
  v_dob date;
  v_row integer;
  v_imported integer := 0;
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
      v_errors := v_errors || jsonb_build_object('row', v_row, 'reason', 'missing_field');
    ELSIF v_dob_text = 'invalid' THEN
      v_errors := v_errors || jsonb_build_object('row', v_row, 'reason', 'invalid_date', 'student_code', v_code);
    ELSIF v_code = ANY (v_seen) THEN
      v_errors := v_errors || jsonb_build_object('row', v_row, 'reason', 'duplicate_in_file', 'student_code', v_code);
    ELSIF EXISTS (SELECT 1 FROM public.class_members
                   WHERE class_id = p_class_id AND roster_student_code = v_code) THEN
      v_errors := v_errors || jsonb_build_object('row', v_row, 'reason', 'already_in_class', 'student_code', v_code);
    ELSE
      INSERT INTO public.class_members (class_id, member_role, status, joined_via, roster_student_code, roster_full_name, roster_date_of_birth)
      VALUES (p_class_id, 'student', 'invited', 'excel_import', v_code, v_name, v_dob);
      v_imported := v_imported + 1;
    END IF;
    v_seen := v_seen || v_code;
  END LOOP;

  PERFORM public.write_audit_log(auth.uid(), NULL, 'import_class_roster', 'classes', p_class_id,
    jsonb_build_object('imported', v_imported, 'skipped', jsonb_array_length(v_errors)));
  RETURN jsonb_build_object('ok', true, 'imported', v_imported, 'errors', v_errors);
END;
$$;
