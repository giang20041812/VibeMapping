-- Quản trị nghề: thêm/sửa thông tin nghề, mức yêu cầu G1–G5 và G7, hồ sơ Holland (SRS FR04.01.05–07, R16, R18).

ALTER TABLE public.careers
  ADD COLUMN IF NOT EXISTS career_description text,
  ADD COLUMN IF NOT EXISTS key_skills text,
  ADD COLUMN IF NOT EXISTS salary_range_text text,
  ADD COLUMN IF NOT EXISTS career_path_text text,
  ADD COLUMN IF NOT EXISTS data_source_note text;

-- R18: cập nhật mức yêu cầu là thay đổi nhỏ -> NGHE-X.(Y+1). Sao chép toàn bộ yêu cầu sang phiên bản mới
-- để bản chụp đã chốt vẫn tính lại được theo phiên bản cũ.
CREATE OR REPLACE FUNCTION public.bump_matrix_version(p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old public.career_matrix_versions;
  v_new uuid;
  v_code text;
  v_major integer;
  v_minor integer;
BEGIN
  SELECT * INTO v_old FROM public.career_matrix_versions WHERE is_current FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_current_matrix_version'; END IF;
  v_major := COALESCE(substring(v_old.version_code FROM 'NGHE-(\d+)\.')::integer, 1);
  v_minor := COALESCE(substring(v_old.version_code FROM 'NGHE-\d+\.(\d+)')::integer, 0) + 1;
  v_code := format('NGHE-%s.%s', v_major, v_minor);
  UPDATE public.career_matrix_versions SET is_current = false, updated_at = now() WHERE id = v_old.id;
  INSERT INTO public.career_matrix_versions (version_code, is_current, note)
  VALUES (v_code, true, COALESCE(NULLIF(trim(p_note), ''), 'Quản trị cập nhật mức yêu cầu'))
  RETURNING id INTO v_new;
  INSERT INTO public.career_requirements (career_id, criteria_id, matrix_version_id, required_score, career_weight, jd_count, verification_level)
  SELECT career_id, criteria_id, v_new, required_score, career_weight, jd_count, verification_level
    FROM public.career_requirements WHERE matrix_version_id = v_old.id;
  RETURN v_new;
END;
$$;

-- Tạo (p_career_id NULL) hoặc sửa thông tin nghề. Nghề mới ở trạng thái Nháp.
CREATE OR REPLACE FUNCTION public.admin_save_career(p_career_id uuid, p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid := p_career_id;
  v_name text := NULLIF(trim(p_payload ->> 'career_name'), '');
  v_field uuid := NULLIF(p_payload ->> 'career_field_id', '')::uuid;
  v_date date := NULLIF(p_payload ->> 'data_checked_at', '')::date;
  v_kind text := NULLIF(p_payload ->> 'data_checked_kind', '');
  v_code text;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_kind IS NOT NULL AND v_kind NOT IN ('checked', 'posted') THEN RAISE EXCEPTION 'invalid_checked_kind'; END IF;
  IF v_date IS NOT NULL AND v_date > current_date THEN RAISE EXCEPTION 'invalid_checked_date'; END IF;
  IF v_id IS NULL THEN
    IF v_name IS NULL OR length(v_name) < 3 OR v_field IS NULL THEN RAISE EXCEPTION 'invalid_career'; END IF;
    LOOP
      v_code := 'QT-' || lpad((floor(random() * 1000000))::int::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.careers WHERE career_code = v_code);
    END LOOP;
    INSERT INTO public.careers (career_code, career_field_id, career_name, source_group_id, status)
    VALUES (v_code, v_field, v_name, 'QT', 'draft') RETURNING id INTO v_id;
  ELSIF NOT EXISTS (SELECT 1 FROM public.careers WHERE id = v_id) THEN
    RAISE EXCEPTION 'career_not_found';
  END IF;
  UPDATE public.careers SET
    career_name = COALESCE(v_name, career_name),
    career_field_id = COALESCE(v_field, career_field_id),
    career_description = CASE WHEN p_payload ? 'career_description' THEN NULLIF(trim(p_payload ->> 'career_description'), '') ELSE career_description END,
    key_skills = CASE WHEN p_payload ? 'key_skills' THEN NULLIF(trim(p_payload ->> 'key_skills'), '') ELSE key_skills END,
    salary_range_text = CASE WHEN p_payload ? 'salary_range_text' THEN NULLIF(trim(p_payload ->> 'salary_range_text'), '') ELSE salary_range_text END,
    career_path_text = CASE WHEN p_payload ? 'career_path_text' THEN NULLIF(trim(p_payload ->> 'career_path_text'), '') ELSE career_path_text END,
    growth_level = CASE WHEN p_payload ? 'growth_level' THEN NULLIF(trim(p_payload ->> 'growth_level'), '') ELSE growth_level END,
    data_source_note = CASE WHEN p_payload ? 'data_source_note' THEN NULLIF(trim(p_payload ->> 'data_source_note'), '') ELSE data_source_note END,
    data_checked_at = CASE WHEN p_payload ? 'data_checked_at' THEN v_date ELSE data_checked_at END,
    data_checked_kind = CASE WHEN p_payload ? 'data_checked_at' THEN (CASE WHEN v_date IS NULL THEN NULL ELSE COALESCE(v_kind, 'checked') END) ELSE data_checked_kind END,
    updated_at = now()
  WHERE id = v_id;
  PERFORM public.write_audit_log(auth.uid(), NULL, CASE WHEN p_career_id IS NULL THEN 'create_career' ELSE 'update_career' END,
    'careers', v_id, jsonb_build_object('fields', (SELECT jsonb_agg(k) FROM jsonb_object_keys(p_payload) k)));
  RETURN v_id;
END;
$$;

-- Thay toàn bộ mức yêu cầu của nghề: [{dimension_code, required_score, career_weight}].
-- Chỉ G1–G5 và G7; Req trong 1–5; CW được chuẩn hóa để tổng bằng 1 trong G1–G5 và trong G7.
-- Tạo phiên bản ma trận mới (R18); dòng lưu ở mức "Chuyên gia duyệt" nên lần nạp JD sau không ghi đè.
CREATE OR REPLACE FUNCTION public.admin_save_career_requirements(p_career_id uuid, p_rows jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_version uuid;
  v_code text;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.careers WHERE id = p_career_id) THEN RAISE EXCEPTION 'career_not_found'; END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'invalid_requirements'; END IF;

  CREATE TEMP TABLE _req ON COMMIT DROP AS
    SELECT c.id AS criteria_id, g.group_code, (x ->> 'required_score')::numeric AS req, (x ->> 'career_weight')::numeric AS cw
      FROM jsonb_array_elements(p_rows) x
      JOIN public.criteria c ON c.dimension_code = x ->> 'dimension_code'
      JOIN public.criteria_groups g ON g.id = c.group_id;
  IF (SELECT count(*) FROM _req) <> jsonb_array_length(p_rows) THEN RAISE EXCEPTION 'unknown_dimension'; END IF;
  IF EXISTS (SELECT 1 FROM _req GROUP BY criteria_id HAVING count(*) > 1) THEN RAISE EXCEPTION 'duplicate_dimension'; END IF;
  IF EXISTS (SELECT 1 FROM _req WHERE group_code NOT IN ('G1', 'G2', 'G3', 'G4', 'G5', 'G7')) THEN RAISE EXCEPTION 'dimension_not_allowed'; END IF;
  IF EXISTS (SELECT 1 FROM _req WHERE req IS NULL OR req < 1 OR req > 5) THEN RAISE EXCEPTION 'invalid_required_score'; END IF;
  IF EXISTS (SELECT 1 FROM _req WHERE cw IS NULL OR cw <= 0) THEN RAISE EXCEPTION 'invalid_career_weight'; END IF;

  v_version := public.bump_matrix_version('Quản trị sửa mức yêu cầu của nghề');
  DELETE FROM public.career_requirements WHERE career_id = p_career_id AND matrix_version_id = v_version;
  INSERT INTO public.career_requirements (career_id, criteria_id, matrix_version_id, required_score, career_weight, jd_count, verification_level)
  SELECT p_career_id, r.criteria_id, v_version, round(r.req, 2),
         round(r.cw / sum(r.cw) OVER (PARTITION BY (r.group_code = 'G7')), 5),
         COALESCE((SELECT o.jd_count FROM public.career_requirements o
                    WHERE o.career_id = p_career_id AND o.criteria_id = r.criteria_id AND o.matrix_version_id <> v_version
                    ORDER BY o.created_at DESC LIMIT 1), 0),
         'expert_reviewed'
    FROM _req r;
  PERFORM public.refresh_career_standard(ARRAY[p_career_id]);
  SELECT version_code INTO v_code FROM public.career_matrix_versions WHERE id = v_version;
  PERFORM public.write_audit_log(auth.uid(), NULL, 'update_career_requirements', 'careers', p_career_id,
    jsonb_build_object('matrix_version', v_code, 'rows', jsonb_array_length(p_rows)));
  RETURN v_code;
END;
$$;

-- Hồ sơ Holland: {"R":0.5,"I":0.2,...} cường độ 0–1 cho cả sáu chữ. Top 3 tự tính.
CREATE OR REPLACE FUNCTION public.admin_save_career_holland(p_career_id uuid, p_profile jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l text;
  v numeric;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.careers WHERE id = p_career_id) THEN RAISE EXCEPTION 'career_not_found'; END IF;
  FOREACH l IN ARRAY ARRAY['R', 'I', 'A', 'S', 'E', 'C'] LOOP
    v := COALESCE((p_profile ->> l)::numeric, 0);
    IF v < 0 OR v > 1 THEN RAISE EXCEPTION 'invalid_holland_strength'; END IF;
    INSERT INTO public.career_holland_profiles (career_id, holland_code, strength, jd_count, verification_level)
    VALUES (p_career_id, l, round(v, 3), 0, 'expert_reviewed')
    ON CONFLICT (career_id, holland_code) DO UPDATE
      SET strength = EXCLUDED.strength, verification_level = 'expert_reviewed', updated_at = now();
  END LOOP;
  UPDATE public.careers SET holland_top3 = NULL WHERE id = p_career_id;
  PERFORM public.refresh_career_standard(ARRAY[p_career_id]);
  PERFORM public.write_audit_log(auth.uid(), NULL, 'update_career_holland', 'careers', p_career_id, COALESCE(p_profile, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.bump_matrix_version(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_save_career(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_save_career_requirements(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_save_career_holland(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_career(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_career_requirements(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_career_holland(uuid, jsonb) TO authenticated;
