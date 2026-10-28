-- ====================================================================
-- Phase 1 / Migration 15: Giáo viên chấm và nộp điểm từng học sinh, được sửa và nộp lại
-- Trạng thái nộp chuyển từ cả bảng lưới sang từng dòng học sinh (submitted_at).
-- Cột class_assessment_grids.status / submitted_at không còn được dùng.
-- ====================================================================

-- 1. Trạng thái nộp của từng học sinh ----------------------------------------------------------------------
ALTER TABLE public.class_assessment_grid_students ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

UPDATE public.class_assessment_grid_students s
   SET submitted_at = COALESCE(g.submitted_at, now())
  FROM public.class_assessment_grids g
 WHERE g.id = s.grid_id AND g.status = 'submitted' AND s.submitted_at IS NULL;

-- 2. Mở bảng điểm của giáo viên: luôn dùng một bảng cho mỗi (lớp, giáo viên), luôn đồng bộ học sinh mới ----
CREATE OR REPLACE FUNCTION public.get_class_grid(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.class_assessment_grids;
  v_students jsonb;
BEGIN
  IF NOT public.is_class_teacher(p_class_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO g FROM public.class_assessment_grids
   WHERE class_id = p_class_id AND teacher_id = auth.uid()
   ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.class_assessment_grids (class_id, teacher_id) VALUES (p_class_id, auth.uid()) RETURNING * INTO g;
  END IF;

  INSERT INTO public.class_assessment_grid_students (grid_id, student_id)
  SELECT g.id, m.user_id FROM public.class_members m
   WHERE m.class_id = p_class_id AND m.member_role = 'student' AND m.status = 'joined' AND m.user_id IS NOT NULL
  ON CONFLICT (grid_id, student_id) DO NOTHING;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'grid_student_id', s.id,
      'student_id', s.student_id,
      'full_name', COALESCE(p.full_name, ''),
      'acquaintance_duration', s.acquaintance_duration,
      'contact_frequency', s.contact_frequency,
      'observation_depth', s.observation_depth,
      'submitted_at', s.submitted_at,
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
    'grid_id', g.id,
    'default_acquaintance_duration', g.default_acquaintance_duration,
    'default_contact_frequency', g.default_contact_frequency,
    'default_observation_depth', g.default_observation_depth,
    'students', v_students
  );
END;
$$;

-- 3. Nộp điểm một học sinh; nộp lại sau khi sửa thì ghi đè bài cũ và tính lại kết quả -----------------------
CREATE OR REPLACE FUNCTION public.submit_class_grid_student(p_grid_student_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.class_assessment_grids;
  gs public.class_assessment_grid_students;
  p public.user_profiles;
  v_short_count integer;
  v_empty integer;
  v_duration smallint;
  v_frequency smallint;
  v_depth smallint;
  v_sub_id uuid;
BEGIN
  SELECT * INTO gs FROM public.class_assessment_grid_students WHERE id = p_grid_student_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'grid_student_not_found'; END IF;
  SELECT * INTO g FROM public.class_assessment_grids WHERE id = gs.grid_id;
  IF g.teacher_id <> auth.uid() OR NOT public.is_class_teacher(g.class_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT count(*) INTO v_short_count FROM public.criteria WHERE is_short_set AND is_active;
  IF v_short_count = 0 THEN RAISE EXCEPTION 'short_set_not_configured'; END IF;

  -- Học sinh dưới 16 tuổi chưa có xác nhận của người giám hộ thì chưa nộp được điểm
  SELECT * INTO p FROM public.user_profiles WHERE id = gs.student_id;
  IF public.is_under_guardian_age(p.date_of_birth) AND NOT p.guardian_consent_confirmed THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'guardian_pending');
  END IF;

  v_duration := COALESCE(gs.acquaintance_duration, g.default_acquaintance_duration);
  v_frequency := COALESCE(gs.contact_frequency, g.default_contact_frequency);
  v_depth := COALESCE(gs.observation_depth, g.default_observation_depth);
  IF v_duration IS NULL OR v_frequency IS NULL OR v_depth IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_understanding');
  END IF;

  SELECT count(*) INTO v_empty
    FROM public.criteria c
    LEFT JOIN public.class_assessment_grid_details d ON d.grid_student_id = gs.id AND d.criteria_id = c.id
   WHERE c.is_short_set AND c.is_active
     AND (d.id IS NULL OR (d.score IS NULL AND NOT d.is_insufficient_basis));
  IF v_empty > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty_cells', 'empty_count', v_empty);
  END IF;

  INSERT INTO public.assessment_360_submissions (
    subject_user_id, rater_group, submission_channel, grid_student_id,
    acquaintance_duration, contact_frequency, observation_depth, understanding_score,
    status, submitted_at, decided_at
  ) VALUES (
    gs.student_id, 'teacher', 'classroom_grid', gs.id,
    v_duration, v_frequency, v_depth, v_duration + v_frequency + v_depth,
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
  PERFORM public.write_audit_log(auth.uid(), gs.student_id, 'submit_class_grid_student',
    'class_assessment_grid_students', gs.id, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Nộp cả bảng không còn: mỗi học sinh nộp riêng
DROP FUNCTION IF EXISTS public.submit_class_grid(uuid);

-- 4. Các hàm đọc trạng thái "đã chấm" theo dòng học sinh thay vì theo cả bảng -------------------------------
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
               WHERE g.class_id = p_class_id AND s.submitted_at IS NOT NULL AND s.student_id = m.user_id)) AS is_graded,
           (m.user_id IS NOT NULL AND public.is_under_guardian_age(p.date_of_birth)
              AND NOT p.guardian_consent_confirmed) AS guardian_pending
      FROM public.class_members m
      LEFT JOIN public.user_profiles p ON p.id = m.user_id
     WHERE m.class_id = p_class_id AND m.status IN ('joined', 'invited')
  ) t;
  RETURN v_result;
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
   WHERE g.class_id = p_class_id AND s.submitted_at IS NOT NULL;

  RETURN public.build_group_report(COALESCE(v_ids, ARRAY[]::uuid[]))
         || jsonb_build_object('joined_count', v_joined, 'graded_count', v_graded);
END;
$$;

-- Xóa học sinh khỏi lớp: chỉ bỏ dòng chấm chưa nộp (bài đã nộp còn được bài đánh giá tham chiếu)
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

  IF m.user_id IS NOT NULL THEN
    DELETE FROM public.class_assessment_grid_students s
     USING public.class_assessment_grids g
     WHERE s.grid_id = g.id AND g.class_id = m.class_id AND s.submitted_at IS NULL AND s.student_id = m.user_id;
  END IF;
  PERFORM public.write_audit_log(auth.uid(), m.user_id, 'remove_class_member', 'class_members', m.id, '{}'::jsonb);
END;
$$;

-- 5. Phân quyền thực thi -----------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_class_grid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_class_grid_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_overview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_class_member(uuid) TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
  END IF;
END $$;
