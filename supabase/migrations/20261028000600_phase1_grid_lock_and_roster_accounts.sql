-- ====================================================================
-- Phase 1 / Migration 17: Nộp cả bảng điểm rồi khóa; tạo tài khoản học sinh từ danh sách Excel
--
-- 1. Bảng điểm: nộp cả bảng một lần khi đủ 100% ô, sau đó khóa vĩnh viễn (thay nộp từng học sinh ở migration 15).
-- 2. Danh sách Excel: Edge Function create-roster-accounts tạo tài khoản đăng nhập cho học sinh chưa có tài khoản.
--    Ba hàm bên dưới là phần cơ sở dữ liệu của chức năng đó.
-- ====================================================================

-- 1. Bảng điểm ---------------------------------------------------------------------------------------------

-- 1.1 Mở bảng điểm: trả thêm trạng thái; chỉ đồng bộ học sinh mới khi bảng còn nháp
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

-- 1.2 Nộp cả bảng: chỉ nộp được khi mọi học sinh trong bảng đủ điều kiện; nộp xong khóa bảng
-- Lỗi trả về kèm student_id của các em bị chặn để giao diện nêu tên
CREATE OR REPLACE FUNCTION public.submit_class_grid(p_grid_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.class_assessment_grids;
  gs public.class_assessment_grid_students;
  v_short_count integer;
  v_student_count integer;
  v_ids uuid[];
  v_empty integer;
  v_sub_id uuid;
BEGIN
  SELECT * INTO g FROM public.class_assessment_grids WHERE id = p_grid_id FOR UPDATE;
  IF NOT FOUND OR g.teacher_id <> auth.uid() OR NOT public.is_class_teacher(g.class_id) THEN
    RAISE EXCEPTION 'grid_not_found';
  END IF;
  IF g.status = 'submitted' THEN RAISE EXCEPTION 'grid_already_submitted'; END IF;

  SELECT count(*) INTO v_short_count FROM public.criteria WHERE is_short_set AND is_active;
  IF v_short_count = 0 THEN RAISE EXCEPTION 'short_set_not_configured'; END IF;

  SELECT count(*) INTO v_student_count FROM public.class_assessment_grid_students WHERE grid_id = g.id;
  IF v_student_count = 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_students'); END IF;

  -- Học sinh dưới 16 tuổi chưa có xác nhận của người giám hộ: giáo viên chưa nộp được điểm cho em đó
  SELECT array_agg(s.student_id) INTO v_ids
    FROM public.class_assessment_grid_students s
    JOIN public.user_profiles p ON p.id = s.student_id
   WHERE s.grid_id = g.id AND public.is_under_guardian_age(p.date_of_birth) AND NOT p.guardian_consent_confirmed;
  IF v_ids IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'guardian_pending', 'student_ids', to_jsonb(v_ids));
  END IF;

  SELECT array_agg(s.student_id) INTO v_ids
    FROM public.class_assessment_grid_students s
   WHERE s.grid_id = g.id
     AND (COALESCE(s.acquaintance_duration, g.default_acquaintance_duration) IS NULL
          OR COALESCE(s.contact_frequency, g.default_contact_frequency) IS NULL
          OR COALESCE(s.observation_depth, g.default_observation_depth) IS NULL);
  IF v_ids IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_understanding', 'student_ids', to_jsonb(v_ids));
  END IF;

  SELECT count(*), array_agg(DISTINCT t.student_id) INTO v_empty, v_ids
    FROM (
      SELECT s.student_id
        FROM public.class_assessment_grid_students s
        CROSS JOIN public.criteria c
        LEFT JOIN public.class_assessment_grid_details d ON d.grid_student_id = s.id AND d.criteria_id = c.id
       WHERE s.grid_id = g.id AND c.is_short_set AND c.is_active
         AND (d.id IS NULL OR (d.score IS NULL AND NOT d.is_insufficient_basis))
    ) t;
  IF v_empty > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty_cells', 'empty_count', v_empty, 'student_ids', to_jsonb(v_ids));
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
    ON CONFLICT (grid_student_id) DO UPDATE SET
      acquaintance_duration = EXCLUDED.acquaintance_duration,
      contact_frequency = EXCLUDED.contact_frequency,
      observation_depth = EXCLUDED.observation_depth,
      understanding_score = EXCLUDED.understanding_score,
      status = 'accepted', submitted_at = now(), decided_at = now()
    RETURNING id INTO v_sub_id;

    DELETE FROM public.assessment_360_answers WHERE submission_id = v_sub_id;
    INSERT INTO public.assessment_360_answers (submission_id, question_id, criteria_id, score, is_insufficient_basis)
    SELECT v_sub_id, NULL, d.criteria_id, d.score, d.is_insufficient_basis
      FROM public.class_assessment_grid_details d
      JOIN public.criteria c ON c.id = d.criteria_id AND c.is_short_set AND c.is_active
     WHERE d.grid_student_id = gs.id;

    UPDATE public.class_assessment_grid_students SET submitted_at = now() WHERE id = gs.id;
    PERFORM public.recalculate_latest_result(gs.student_id);
  END LOOP;

  UPDATE public.class_assessment_grids SET status = 'submitted', submitted_at = now() WHERE id = g.id;
  PERFORM public.write_audit_log(auth.uid(), NULL, 'submit_class_grid', 'class_assessment_grids', g.id,
    jsonb_build_object('student_count', v_student_count));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Nộp từng học sinh không còn
DROP FUNCTION IF EXISTS public.submit_class_grid_student(uuid);

-- 1.3 Khóa bảng điểm đã nộp: chỉ sửa được khi bảng còn nháp (hàm nộp là SECURITY DEFINER nên không bị chặn)
DROP POLICY IF EXISTS "Teacher manages own grids" ON public.class_assessment_grids;
DROP POLICY IF EXISTS "Teacher reads own grids" ON public.class_assessment_grids;
DROP POLICY IF EXISTS "Teacher creates own grids" ON public.class_assessment_grids;
DROP POLICY IF EXISTS "Teacher edits own draft grids" ON public.class_assessment_grids;
DROP POLICY IF EXISTS "Teacher deletes own draft grids" ON public.class_assessment_grids;
CREATE POLICY "Teacher reads own grids" ON public.class_assessment_grids FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() AND public.is_class_teacher(class_id));
CREATE POLICY "Teacher creates own grids" ON public.class_assessment_grids FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND public.is_class_teacher(class_id) AND status = 'draft');
CREATE POLICY "Teacher edits own draft grids" ON public.class_assessment_grids FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid() AND public.is_class_teacher(class_id) AND status = 'draft')
  WITH CHECK (teacher_id = auth.uid() AND public.is_class_teacher(class_id) AND status = 'draft');
CREATE POLICY "Teacher deletes own draft grids" ON public.class_assessment_grids FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() AND public.is_class_teacher(class_id) AND status = 'draft');

DROP POLICY IF EXISTS "Teacher manages own grid students" ON public.class_assessment_grid_students;
DROP POLICY IF EXISTS "Teacher reads own grid students" ON public.class_assessment_grid_students;
DROP POLICY IF EXISTS "Teacher creates own grid students" ON public.class_assessment_grid_students;
DROP POLICY IF EXISTS "Teacher edits own draft grid students" ON public.class_assessment_grid_students;
DROP POLICY IF EXISTS "Teacher deletes own draft grid students" ON public.class_assessment_grid_students;
CREATE POLICY "Teacher reads own grid students" ON public.class_assessment_grid_students FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_assessment_grids g WHERE g.id = grid_id AND g.teacher_id = auth.uid()));
CREATE POLICY "Teacher creates own grid students" ON public.class_assessment_grid_students FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.class_assessment_grids g
                       WHERE g.id = grid_id AND g.teacher_id = auth.uid() AND g.status = 'draft'));
CREATE POLICY "Teacher edits own draft grid students" ON public.class_assessment_grid_students FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_assessment_grids g
                  WHERE g.id = grid_id AND g.teacher_id = auth.uid() AND g.status = 'draft'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.class_assessment_grids g
                       WHERE g.id = grid_id AND g.teacher_id = auth.uid() AND g.status = 'draft'));
CREATE POLICY "Teacher deletes own draft grid students" ON public.class_assessment_grid_students FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_assessment_grids g
                  WHERE g.id = grid_id AND g.teacher_id = auth.uid() AND g.status = 'draft'));

DROP POLICY IF EXISTS "Teacher manages own grid details" ON public.class_assessment_grid_details;
DROP POLICY IF EXISTS "Teacher reads own grid details" ON public.class_assessment_grid_details;
DROP POLICY IF EXISTS "Teacher creates own grid details" ON public.class_assessment_grid_details;
DROP POLICY IF EXISTS "Teacher edits own draft grid details" ON public.class_assessment_grid_details;
DROP POLICY IF EXISTS "Teacher deletes own draft grid details" ON public.class_assessment_grid_details;
CREATE POLICY "Teacher reads own grid details" ON public.class_assessment_grid_details FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.class_assessment_grid_students s
      JOIN public.class_assessment_grids g ON g.id = s.grid_id
     WHERE s.id = grid_student_id AND g.teacher_id = auth.uid()));
CREATE POLICY "Teacher creates own grid details" ON public.class_assessment_grid_details FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.class_assessment_grid_students s
      JOIN public.class_assessment_grids g ON g.id = s.grid_id
     WHERE s.id = grid_student_id AND g.teacher_id = auth.uid() AND g.status = 'draft'));
CREATE POLICY "Teacher edits own draft grid details" ON public.class_assessment_grid_details FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.class_assessment_grid_students s
      JOIN public.class_assessment_grids g ON g.id = s.grid_id
     WHERE s.id = grid_student_id AND g.teacher_id = auth.uid() AND g.status = 'draft'))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.class_assessment_grid_students s
      JOIN public.class_assessment_grids g ON g.id = s.grid_id
     WHERE s.id = grid_student_id AND g.teacher_id = auth.uid() AND g.status = 'draft'));
CREATE POLICY "Teacher deletes own draft grid details" ON public.class_assessment_grid_details FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.class_assessment_grid_students s
      JOIN public.class_assessment_grids g ON g.id = s.grid_id
     WHERE s.id = grid_student_id AND g.teacher_id = auth.uid() AND g.status = 'draft'));

-- 2. Tài khoản học sinh từ danh sách Excel -------------------------------------------------------------------

-- 2.1 Danh sách dòng Excel chưa có tài khoản của một lớp; giáo viên của lớp hoặc nhân sự trường mới gọi được
CREATE OR REPLACE FUNCTION public.list_roster_pending(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.classes;
  v_school_name text;
  v_rows jsonb;
BEGIN
  SELECT * INTO c FROM public.classes WHERE id = p_class_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'class_not_found'; END IF;
  IF NOT (public.is_class_teacher(c.id) OR public.is_school_staff(c.school_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
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

-- 2.2 Tìm tài khoản theo email (Auth Admin API chỉ liệt kê được theo trang); chỉ service_role gọi
CREATE OR REPLACE FUNCTION public.find_auth_user_id(p_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

-- 2.3 Gắn tài khoản vào dòng Excel: học sinh vào lớp ngay; ghi nhận đồng ý tham gia lớp do nhà trường lập.
-- p_is_new_user: tài khoản vừa tạo thì điền hồ sơ từ danh sách; tài khoản có sẵn thì giữ nguyên hồ sơ.
CREATE OR REPLACE FUNCTION public.link_roster_member(p_member_id uuid, p_user_id uuid, p_is_new_user boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m public.class_members;
  c public.classes;
  v_school_name text;
  v_role public.user_role;
BEGIN
  SELECT * INTO m FROM public.class_members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND OR m.user_id IS NOT NULL OR m.member_role <> 'student' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_pending');
  END IF;

  SELECT role INTO v_role FROM public.user_profiles WHERE id = p_user_id;
  IF v_role IS NULL OR v_role NOT IN ('student', 'university_student') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_student');
  END IF;
  IF EXISTS (SELECT 1 FROM public.class_members WHERE class_id = m.class_id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_member');
  END IF;

  SELECT * INTO c FROM public.classes WHERE id = m.class_id;
  SELECT school_name INTO v_school_name FROM public.schools WHERE id = c.school_id;

  IF p_is_new_user THEN
    UPDATE public.user_profiles
       SET full_name = m.roster_full_name,
           date_of_birth = m.roster_date_of_birth,
           school_name = v_school_name,
           grade_or_major = c.grade::text
     WHERE id = p_user_id;
  END IF;

  UPDATE public.class_members
     SET user_id = p_user_id, status = 'joined', joined_via = 'excel_import', joined_at = now()
   WHERE id = m.id;

  INSERT INTO public.consent_records (user_id, consent_type, displayed_content)
  VALUES (p_user_id, 'class_participation',
          'Nhà trường đưa vào lớp ' || c.class_name || ' (' || c.school_year || ') từ danh sách nhập; tham gia lớp đồng nghĩa với đồng ý để giáo viên của lớp đánh giá.');

  PERFORM public.write_audit_log(NULL, p_user_id, 'create_roster_account', 'class_members', m.id,
    jsonb_build_object('is_new_user', p_is_new_user));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3. Phân quyền thực thi -----------------------------------------------------------------------------------
-- Migration 9 chỉ gỡ quyền mặc định trong schema public; quyền EXECUTE mặc định của PUBLIC (mọi vai trò, gồm anon)
-- vẫn còn trên mọi hàm tạo sau đó. Gỡ PUBLIC trên mọi hàm hiện có và đặt mặc định cho hàm tương lai.
-- Hàm nào cần cho anon/authenticated đã có GRANT riêng ở cuối migration của nó nên không bị ảnh hưởng.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- Hàm nội bộ: chỉ service_role hoặc hàm khác gọi
REVOKE ALL ON FUNCTION public.find_auth_user_id(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_roster_member(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.build_group_report(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_admin_change() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_class_grid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_class_grid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_roster_pending(uuid) TO authenticated;
-- find_auth_user_id và link_roster_member chỉ dành cho service_role (Edge Function)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
  END IF;
END $$;
