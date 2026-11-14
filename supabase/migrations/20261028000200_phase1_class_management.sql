-- ====================================================================
-- Phase 1 / Migration 13: Quản lý lớp học, bảng lưới chấm điểm, báo cáo lớp và trường
-- Hàm mới đều SECURITY DEFINER và phải GRANT rõ ràng (xem migration 9).
-- ====================================================================

-- 1. Thêm giáo viên / quản trị trường vào trường (tìm theo email) ----------------------------------
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

  INSERT INTO public.school_staff (school_id, user_id, staff_role)
  VALUES (p_school_id, v_user_id, p_staff_role)
  ON CONFLICT (school_id, user_id) DO UPDATE SET staff_role = EXCLUDED.staff_role;

  PERFORM public.write_audit_log(auth.uid(), v_user_id, 'add_school_staff', 'school_staff', p_school_id,
    jsonb_build_object('staff_role', p_staff_role));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 2. Tạo lớp: người tạo là giáo viên thì tự vào lớp với vai trò chủ nhiệm ----------------------------
CREATE OR REPLACE FUNCTION public.create_class(
  p_school_id uuid, p_class_name text, p_grade smallint, p_school_year text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_class_id uuid;
BEGIN
  IF NOT public.is_school_staff(p_school_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(trim(p_class_name), '') = '' OR coalesce(trim(p_school_year), '') = '' THEN
    RAISE EXCEPTION 'invalid_class';
  END IF;

  INSERT INTO public.classes (school_id, class_name, grade, school_year, created_by)
  VALUES (p_school_id, trim(p_class_name), p_grade, trim(p_school_year), auth.uid())
  RETURNING id INTO v_class_id;

  IF EXISTS (SELECT 1 FROM public.school_staff WHERE school_id = p_school_id AND user_id = auth.uid()
                AND staff_role = 'teacher') THEN
    INSERT INTO public.class_members (class_id, user_id, member_role, status, joined_via, joined_at)
    VALUES (v_class_id, auth.uid(), 'homeroom_teacher', 'joined', 'manual', now());
  END IF;

  PERFORM public.write_audit_log(auth.uid(), NULL, 'create_class', 'classes', v_class_id, '{}'::jsonb);
  RETURN v_class_id;
END;
$$;

-- 3. Gán giáo viên vào lớp (giáo viên phải thuộc trường của lớp) ---------------------------------------
CREATE OR REPLACE FUNCTION public.assign_class_teacher(p_class_id uuid, p_email text, p_member_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_school_id uuid;
  v_user_id uuid;
BEGIN
  IF p_member_role NOT IN ('homeroom_teacher', 'subject_teacher') THEN RAISE EXCEPTION 'invalid_member_role'; END IF;
  SELECT school_id INTO v_school_id FROM public.classes WHERE id = p_class_id;
  IF v_school_id IS NULL OR NOT public.is_school_staff(v_school_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

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

-- 4. Học sinh tham gia lớp bằng mã; tham gia là đồng ý đánh giá học đường ---------------------------------
-- p_student_code (tùy chọn) nhận lại dòng đã nhập từ Excel chưa có tài khoản
CREATE OR REPLACE FUNCTION public.join_class_by_code(p_class_code text, p_student_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.classes;
  m public.class_members;
  v_role public.user_role;
  v_roster_id uuid;
BEGIN
  SELECT role INTO v_role FROM public.user_profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('student', 'university_student') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO c FROM public.classes WHERE class_code = upper(trim(p_class_code)) AND NOT is_archived;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'class_not_found'); END IF;

  SELECT * INTO m FROM public.class_members WHERE class_id = c.id AND user_id = auth.uid();
  IF FOUND AND m.status = 'removed' THEN RETURN jsonb_build_object('ok', false, 'reason', 'removed'); END IF;
  IF FOUND AND m.status = 'joined' THEN
    RETURN jsonb_build_object('ok', true, 'class_id', c.id, 'class_name', c.class_name, 'already_joined', true);
  END IF;

  IF FOUND THEN
    UPDATE public.class_members SET status = 'joined', joined_via = 'class_code', joined_at = now() WHERE id = m.id;
  ELSE
    IF p_student_code IS NOT NULL AND trim(p_student_code) <> '' THEN
      SELECT id INTO v_roster_id FROM public.class_members
       WHERE class_id = c.id AND user_id IS NULL AND roster_student_code = trim(p_student_code);
    END IF;
    IF v_roster_id IS NOT NULL THEN
      UPDATE public.class_members
         SET user_id = auth.uid(), status = 'joined', joined_via = 'class_code', joined_at = now()
       WHERE id = v_roster_id;
    ELSE
      INSERT INTO public.class_members (class_id, user_id, member_role, status, joined_via, joined_at)
      VALUES (c.id, auth.uid(), 'student', 'joined', 'class_code', now());
    END IF;
  END IF;

  INSERT INTO public.consent_records (user_id, consent_type, displayed_content)
  VALUES (auth.uid(), 'class_participation',
          'Tham gia lớp ' || c.class_name || ' (' || c.school_year || ') đồng nghĩa với đồng ý để giáo viên của lớp đánh giá.');
  RETURN jsonb_build_object('ok', true, 'class_id', c.id, 'class_name', c.class_name);
END;
$$;

-- 5. Học sinh rời lớp; giáo viên / quản trị trường xóa học sinh khỏi lớp ----------------------------------
CREATE OR REPLACE FUNCTION public.remove_class_member(p_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m public.class_members;
  v_school_id uuid;
BEGIN
  SELECT * INTO m FROM public.class_members WHERE id = p_member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'member_not_found'; END IF;
  SELECT school_id INTO v_school_id FROM public.classes WHERE id = m.class_id;

  IF m.user_id = auth.uid() AND m.member_role = 'student' THEN
    UPDATE public.class_members SET status = 'left' WHERE id = m.id;
  ELSIF public.is_class_teacher(m.class_id) OR public.is_school_staff(v_school_id) THEN
    IF m.user_id IS NULL THEN
      DELETE FROM public.class_members WHERE id = m.id;       -- dòng Excel chưa có tài khoản
    ELSE
      UPDATE public.class_members SET status = 'removed' WHERE id = m.id;
    END IF;
  ELSE
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Dữ liệu chấm lưới đang nháp của em đó không còn ý nghĩa
  IF m.user_id IS NOT NULL THEN
    DELETE FROM public.class_assessment_grid_students s
     USING public.class_assessment_grids g
     WHERE s.grid_id = g.id AND g.class_id = m.class_id AND g.status = 'draft' AND s.student_id = m.user_id;
  END IF;
  PERFORM public.write_audit_log(auth.uid(), m.user_id, 'remove_class_member', 'class_members', m.id, '{}'::jsonb);
END;
$$;

-- 6. Nhập danh sách học sinh từ Excel (client đã đọc tệp): kiểm tra từng dòng, chỉ nhập dòng hợp lệ ---------
-- p_rows: [{"row": 2, "student_code": "...", "full_name": "..."}]; row là số dòng trong tệp để báo lỗi
CREATE OR REPLACE FUNCTION public.import_class_roster(p_class_id uuid, p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school_id uuid;
  r jsonb;
  v_code text;
  v_name text;
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

    IF v_code = '' OR v_name = '' THEN
      v_errors := v_errors || jsonb_build_object('row', v_row, 'reason', 'missing_field');
    ELSIF v_code = ANY (v_seen) THEN
      v_errors := v_errors || jsonb_build_object('row', v_row, 'reason', 'duplicate_in_file', 'student_code', v_code);
    ELSIF EXISTS (SELECT 1 FROM public.class_members
                   WHERE class_id = p_class_id AND roster_student_code = v_code) THEN
      v_errors := v_errors || jsonb_build_object('row', v_row, 'reason', 'already_in_class', 'student_code', v_code);
    ELSE
      INSERT INTO public.class_members (class_id, member_role, status, joined_via, roster_student_code, roster_full_name)
      VALUES (p_class_id, 'student', 'invited', 'excel_import', v_code, v_name);
      v_imported := v_imported + 1;
    END IF;
    v_seen := v_seen || v_code;
  END LOOP;

  PERFORM public.write_audit_log(auth.uid(), NULL, 'import_class_roster', 'classes', p_class_id,
    jsonb_build_object('imported', v_imported, 'skipped', jsonb_array_length(v_errors)));
  RETURN jsonb_build_object('ok', true, 'imported', v_imported, 'errors', v_errors);
END;
$$;

-- 7. Danh sách thành viên và trạng thái từng học sinh -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_class_overview(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school_id uuid;
  v_result jsonb;
BEGIN
  SELECT school_id INTO v_school_id FROM public.classes WHERE id = p_class_id;
  IF v_school_id IS NULL THEN RAISE EXCEPTION 'class_not_found'; END IF;
  IF NOT (public.is_class_teacher(p_class_id) OR public.is_school_staff(v_school_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.member_role, t.full_name), '[]'::jsonb) INTO v_result
  FROM (
    SELECT m.id AS member_id, m.member_role, m.status, m.user_id,
           COALESCE(p.full_name, m.roster_full_name, '') AS full_name,
           m.roster_student_code AS student_code,
           (m.user_id IS NOT NULL AND m.status = 'joined' AND EXISTS (
              SELECT 1 FROM public.assessment_results r WHERE r.user_id = m.user_id)) AS has_result,
           (m.user_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.class_assessment_grid_students s
                JOIN public.class_assessment_grids g ON g.id = s.grid_id
               WHERE g.class_id = p_class_id AND g.status = 'submitted' AND s.student_id = m.user_id)) AS is_graded,
           (m.user_id IS NOT NULL AND public.is_under_guardian_age(p.date_of_birth)
              AND NOT p.guardian_consent_confirmed) AS guardian_pending
      FROM public.class_members m
      LEFT JOIN public.user_profiles p ON p.id = m.user_id
     WHERE m.class_id = p_class_id AND m.status IN ('joined', 'invited')
  ) t;
  RETURN v_result;
END;
$$;

-- 8. Bảng lưới: mở bảng nháp của giáo viên cho lớp và đồng bộ danh sách học sinh -------------------------
CREATE OR REPLACE FUNCTION public.get_class_grid(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.class_assessment_grids;
  v_students jsonb;
BEGIN
  IF NOT public.is_class_teacher(p_class_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO g FROM public.class_assessment_grids
   WHERE class_id = p_class_id AND teacher_id = auth.uid()
   ORDER BY (status = 'draft') DESC, created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.class_assessment_grids (class_id, teacher_id) VALUES (p_class_id, auth.uid()) RETURNING * INTO g;
  END IF;

  IF g.status = 'draft' THEN
    INSERT INTO public.class_assessment_grid_students (grid_id, student_id)
    SELECT g.id, m.user_id FROM public.class_members m
     WHERE m.class_id = p_class_id AND m.member_role = 'student' AND m.status = 'joined' AND m.user_id IS NOT NULL
    ON CONFLICT (grid_id, student_id) DO NOTHING;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'grid_student_id', s.id,
      'student_id', s.student_id,
      'full_name', COALESCE(p.full_name, ''),
      'acquaintance_duration', s.acquaintance_duration,
      'contact_frequency', s.contact_frequency,
      'observation_depth', s.observation_depth,
      'guardian_pending', (public.is_under_guardian_age(p.date_of_birth) AND NOT p.guardian_consent_confirmed),
      'cells', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('criteria_id', d.criteria_id, 'score', d.score,
                                            'is_insufficient_basis', d.is_insufficient_basis))
          FROM public.class_assessment_grid_details d WHERE d.grid_student_id = s.id), '[]'::jsonb)
    ) ORDER BY p.full_name), '[]'::jsonb) INTO v_students
    FROM public.class_assessment_grid_students s
    JOIN public.user_profiles p ON p.id = s.student_id
   WHERE s.grid_id = g.id;

  RETURN jsonb_build_object(
    'grid_id', g.id, 'status', g.status, 'submitted_at', g.submitted_at,
    'default_acquaintance_duration', g.default_acquaintance_duration,
    'default_contact_frequency', g.default_contact_frequency,
    'default_observation_depth', g.default_observation_depth,
    'students', v_students
  );
END;
$$;

-- 9. Nộp bảng lưới: thêm điều kiện giám hộ và đủ ba câu thấu hiểu -----------------------------------------
CREATE OR REPLACE FUNCTION public.submit_class_grid(p_grid_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.class_assessment_grids;
  gs public.class_assessment_grid_students;
  v_short_count integer;
  v_empty integer;
  v_pending uuid[];
  v_missing_understanding integer;
  v_sub_id uuid;
BEGIN
  SELECT * INTO g FROM public.class_assessment_grids WHERE id = p_grid_id FOR UPDATE;
  IF NOT FOUND OR g.teacher_id <> auth.uid() THEN RAISE EXCEPTION 'grid_not_found'; END IF;
  IF g.status = 'submitted' THEN RAISE EXCEPTION 'grid_already_submitted'; END IF;

  SELECT count(*) INTO v_short_count FROM public.criteria WHERE is_short_set AND is_active;
  IF v_short_count = 0 THEN RAISE EXCEPTION 'short_set_not_configured'; END IF;

  -- Học sinh dưới 16 tuổi chưa có xác nhận của người giám hộ: giáo viên chưa nộp được điểm cho em đó
  SELECT array_agg(s.student_id) INTO v_pending
    FROM public.class_assessment_grid_students s
    JOIN public.user_profiles p ON p.id = s.student_id
   WHERE s.grid_id = g.id AND public.is_under_guardian_age(p.date_of_birth) AND NOT p.guardian_consent_confirmed;
  IF v_pending IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'guardian_pending', 'student_ids', to_jsonb(v_pending));
  END IF;

  SELECT count(*) INTO v_missing_understanding
    FROM public.class_assessment_grid_students s
   WHERE s.grid_id = g.id
     AND (COALESCE(s.acquaintance_duration, g.default_acquaintance_duration) IS NULL
          OR COALESCE(s.contact_frequency, g.default_contact_frequency) IS NULL
          OR COALESCE(s.observation_depth, g.default_observation_depth) IS NULL);
  IF v_missing_understanding > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_understanding', 'student_count', v_missing_understanding);
  END IF;

  SELECT count(*) INTO v_empty
    FROM public.class_assessment_grid_students s
    CROSS JOIN public.criteria c
    LEFT JOIN public.class_assessment_grid_details d ON d.grid_student_id = s.id AND d.criteria_id = c.id
   WHERE s.grid_id = g.id AND c.is_short_set AND c.is_active
     AND (d.id IS NULL OR (d.score IS NULL AND NOT d.is_insufficient_basis));
  IF v_empty > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty_cells', 'empty_count', v_empty);
  END IF;

  FOR gs IN SELECT * FROM public.class_assessment_grid_students WHERE grid_id = g.id
  LOOP
    INSERT INTO public.assessment_360_submissions (
      subject_user_id, rater_group, submission_channel, grid_student_id,
      acquaintance_duration, contact_frequency, observation_depth, understanding_score,
      status, submitted_at, decided_at
    ) VALUES (
      gs.student_id, 'teacher', 'classroom_grid', gs.id,
      COALESCE(gs.acquaintance_duration, g.default_acquaintance_duration),
      COALESCE(gs.contact_frequency, g.default_contact_frequency),
      COALESCE(gs.observation_depth, g.default_observation_depth),
      COALESCE(gs.acquaintance_duration, g.default_acquaintance_duration)
        + COALESCE(gs.contact_frequency, g.default_contact_frequency)
        + COALESCE(gs.observation_depth, g.default_observation_depth),
      'accepted', now(), now()
    )
    ON CONFLICT (grid_student_id) DO UPDATE SET status = 'accepted', submitted_at = now(), decided_at = now()
    RETURNING id INTO v_sub_id;

    DELETE FROM public.assessment_360_answers WHERE submission_id = v_sub_id;
    INSERT INTO public.assessment_360_answers (submission_id, question_id, criteria_id, score, is_insufficient_basis)
    SELECT v_sub_id, NULL, d.criteria_id, d.score, d.is_insufficient_basis
      FROM public.class_assessment_grid_details d
      JOIN public.criteria c ON c.id = d.criteria_id AND c.is_short_set AND c.is_active
     WHERE d.grid_student_id = gs.id;

    PERFORM public.recalculate_latest_result(gs.student_id);
  END LOOP;

  UPDATE public.class_assessment_grids SET status = 'submitted', submitted_at = now() WHERE id = g.id;
  PERFORM public.write_audit_log(auth.uid(), NULL, 'submit_class_grid', 'class_assessment_grids', g.id, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 10. Báo cáo tổng hợp: điểm trung bình G1-G7 của nhóm học sinh, chỉ khi có từ 5 học sinh ------------------
-- Hàm nội bộ: mỗi học sinh lấy kết quả mới nhất; ưu tiên điểm tổng hợp 360° nếu có, không thì tự đánh giá
CREATE OR REPLACE FUNCTION public.build_group_report(p_student_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result_ids uuid[];
  v_count integer;
  v_groups jsonb;
BEGIN
  SELECT array_agg(x.id) INTO v_result_ids FROM (
    SELECT DISTINCT ON (r.user_id) r.id FROM public.assessment_results r
     WHERE r.user_id = ANY (p_student_ids) ORDER BY r.user_id, r.created_at DESC
  ) x;
  v_count := COALESCE(array_length(v_result_ids, 1), 0);

  IF v_count < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'below_threshold', 'student_count', v_count);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'group_code', cg.group_code, 'name', cg.name, 'average_percent', t.avg_percent
    ) ORDER BY cg.sort_order), '[]'::jsonb) INTO v_groups
    FROM (
      SELECT x.group_id, round(avg(x.score_percent), 1) AS avg_percent
        FROM (
          SELECT DISTINCT ON (gs.result_id, gs.group_id) gs.group_id, gs.score_percent
            FROM public.assessment_result_group_scores gs
           WHERE gs.result_id = ANY (v_result_ids)
           ORDER BY gs.result_id, gs.group_id, (gs.score_source = 'combined_360') DESC
        ) x
       GROUP BY x.group_id
    ) t
    JOIN public.criteria_groups cg ON cg.id = t.group_id;

  RETURN jsonb_build_object('ok', true, 'student_count', v_count, 'groups', v_groups);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_class_report(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school_id uuid;
  v_ids uuid[];
  v_joined integer;
  v_graded integer;
BEGIN
  SELECT school_id INTO v_school_id FROM public.classes WHERE id = p_class_id;
  IF v_school_id IS NULL THEN RAISE EXCEPTION 'class_not_found'; END IF;
  IF NOT (public.is_class_teacher(p_class_id) OR public.is_school_staff(v_school_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT array_agg(user_id), count(*) INTO v_ids, v_joined FROM public.class_members
   WHERE class_id = p_class_id AND member_role = 'student' AND status = 'joined' AND user_id IS NOT NULL;
  SELECT count(DISTINCT s.student_id) INTO v_graded
    FROM public.class_assessment_grid_students s JOIN public.class_assessment_grids g ON g.id = s.grid_id
   WHERE g.class_id = p_class_id AND g.status = 'submitted';

  RETURN public.build_group_report(COALESCE(v_ids, ARRAY[]::uuid[]))
         || jsonb_build_object('joined_count', v_joined, 'graded_count', v_graded);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_school_report(p_school_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ids uuid[];
  v_joined integer;
BEGIN
  IF NOT public.is_school_admin(p_school_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT array_agg(DISTINCT m.user_id), count(DISTINCT m.user_id) INTO v_ids, v_joined
    FROM public.class_members m JOIN public.classes c ON c.id = m.class_id
   WHERE c.school_id = p_school_id AND NOT c.is_archived
     AND m.member_role = 'student' AND m.status = 'joined' AND m.user_id IS NOT NULL;
  RETURN public.build_group_report(COALESCE(v_ids, ARRAY[]::uuid[])) || jsonb_build_object('joined_count', v_joined);
END;
$$;

-- 11. Phân quyền thực thi: build_group_report chỉ gọi nội bộ --------------------------------------------------
GRANT EXECUTE ON FUNCTION public.add_school_staff(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_class(uuid, text, smallint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_class_teacher(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_class_by_code(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_class_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_class_roster(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_overview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_grid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_class_grid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_school_report(uuid) TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
  END IF;
END $$;
