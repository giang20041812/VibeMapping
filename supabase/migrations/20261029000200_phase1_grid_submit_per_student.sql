-- ====================================================================
-- Phase 1 / Migration 21: Nộp bảng điểm từng học sinh
--
-- Giáo viên nộp điểm từng em; em đã nộp thì khóa dòng đó, các em khác vẫn chấm tiếp.
-- "Nộp tất cả" nộp mọi em đủ điều kiện, bỏ qua và báo lại các em chưa đủ (BRD: học sinh dưới 16 tuổi chưa có
-- xác nhận thì không ghi nhận điểm của em đó, các em khác vẫn ghi nhận).
-- Bảng không còn chuyển sang 'submitted'; bảng đã khóa cả bảng từ trước giữ nguyên.
-- Đổi gói câu hỏi bị chặn khi đã có em được nộp, để mọi em trong bảng cùng một bộ câu hỏi.
-- ====================================================================

-- 1. Lý do một học sinh chưa nộp được; NULL là nộp được -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.grid_student_block_reason(p_grid_student_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.class_assessment_grids;
  gs public.class_assessment_grid_students;
  v_empty integer;
BEGIN
  SELECT * INTO gs FROM public.class_assessment_grid_students WHERE id = p_grid_student_id;
  SELECT * INTO g FROM public.class_assessment_grids WHERE id = gs.grid_id;

  IF gs.submitted_at IS NOT NULL OR g.status = 'submitted' THEN
    RETURN jsonb_build_object('reason', 'already_submitted');
  END IF;
  IF g.package_size IS NULL OR NOT EXISTS (SELECT 1 FROM public.class_assessment_grid_questions WHERE grid_id = g.id) THEN
    RETURN jsonb_build_object('reason', 'package_not_selected');
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_profiles p
              WHERE p.id = gs.student_id AND public.is_under_guardian_age(p.date_of_birth) AND NOT p.guardian_consent_confirmed) THEN
    RETURN jsonb_build_object('reason', 'guardian_pending');
  END IF;
  IF COALESCE(gs.acquaintance_duration, g.default_acquaintance_duration) IS NULL
     OR COALESCE(gs.contact_frequency, g.default_contact_frequency) IS NULL
     OR COALESCE(gs.observation_depth, g.default_observation_depth) IS NULL THEN
    RETURN jsonb_build_object('reason', 'missing_understanding');
  END IF;

  SELECT count(*) INTO v_empty
    FROM public.class_assessment_grid_questions gq
    LEFT JOIN public.class_assessment_grid_details d ON d.grid_student_id = gs.id AND d.question_id = gq.question_id
   WHERE gq.grid_id = g.id
     AND (d.id IS NULL OR (d.score IS NULL AND NOT d.is_insufficient_basis));
  IF v_empty > 0 THEN
    RETURN jsonb_build_object('reason', 'empty_cells', 'empty_count', v_empty);
  END IF;
  RETURN NULL;
END;
$$;

-- 2. Ghi điểm một học sinh vào bài 360° rồi khóa dòng; chỉ gọi sau khi đã kiểm tra đủ điều kiện -------------
CREATE OR REPLACE FUNCTION public.record_grid_student(p_grid_student_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.class_assessment_grids;
  gs public.class_assessment_grid_students;
  v_sub_id uuid;
BEGIN
  SELECT * INTO gs FROM public.class_assessment_grid_students WHERE id = p_grid_student_id;
  SELECT * INTO g FROM public.class_assessment_grids WHERE id = gs.grid_id;

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

  -- Điểm tiêu chí = trung bình đáp án các câu cùng tiêu chí (recalculate_result)
  DELETE FROM public.assessment_360_answers WHERE submission_id = v_sub_id;
  INSERT INTO public.assessment_360_answers (submission_id, question_id, criteria_id, score, is_insufficient_basis)
  SELECT v_sub_id, d.question_id, d.criteria_id, d.score, d.is_insufficient_basis
    FROM public.class_assessment_grid_details d
    JOIN public.class_assessment_grid_questions gq ON gq.grid_id = g.id AND gq.question_id = d.question_id
   WHERE d.grid_student_id = gs.id;

  UPDATE public.class_assessment_grid_students SET submitted_at = now() WHERE id = gs.id;
  PERFORM public.recalculate_latest_result(gs.student_id);
END;
$$;

-- 3. Nộp một học sinh ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_class_grid_student(p_grid_student_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.class_assessment_grids;
  gs public.class_assessment_grid_students;
  v_block jsonb;
BEGIN
  SELECT * INTO gs FROM public.class_assessment_grid_students WHERE id = p_grid_student_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'grid_not_found'; END IF;
  SELECT * INTO g FROM public.class_assessment_grids WHERE id = gs.grid_id;
  IF g.teacher_id <> auth.uid() OR NOT public.is_class_teacher(g.class_id) THEN RAISE EXCEPTION 'grid_not_found'; END IF;

  v_block := public.grid_student_block_reason(gs.id);
  IF v_block IS NOT NULL THEN RETURN jsonb_build_object('ok', false) || v_block; END IF;

  PERFORM public.record_grid_student(gs.id);
  PERFORM public.write_audit_log(auth.uid(), gs.student_id, 'submit_class_grid_student', 'class_assessment_grid_students', gs.id,
    jsonb_build_object('grid_id', g.id, 'package_size', g.package_size));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. Nộp tất cả: nộp mọi em đủ điều kiện, trả về các em bị bỏ qua kèm lý do ---------------------------------
CREATE OR REPLACE FUNCTION public.submit_class_grid(p_grid_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.class_assessment_grids;
  gs public.class_assessment_grid_students;
  v_block jsonb;
  v_submitted integer := 0;
  v_skipped jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO g FROM public.class_assessment_grids WHERE id = p_grid_id FOR UPDATE;
  IF NOT FOUND OR g.teacher_id <> auth.uid() OR NOT public.is_class_teacher(g.class_id) THEN
    RAISE EXCEPTION 'grid_not_found';
  END IF;
  IF g.status = 'submitted' THEN RAISE EXCEPTION 'grid_already_submitted'; END IF;
  IF g.package_size IS NULL OR NOT EXISTS (SELECT 1 FROM public.class_assessment_grid_questions WHERE grid_id = g.id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'package_not_selected');
  END IF;

  -- Chỉ học sinh còn trong lớp; em đã bị xóa khỏi lớp mà chưa nộp thì đã bị bỏ khỏi bảng
  FOR gs IN
    SELECT s.* FROM public.class_assessment_grid_students s
     WHERE s.grid_id = g.id AND s.submitted_at IS NULL
       AND EXISTS (SELECT 1 FROM public.class_members m
                    WHERE m.class_id = g.class_id AND m.user_id = s.student_id
                      AND m.member_role = 'student' AND m.status = 'joined')
     FOR UPDATE
  LOOP
    v_block := public.grid_student_block_reason(gs.id);
    IF v_block IS NULL THEN
      PERFORM public.record_grid_student(gs.id);
      v_submitted := v_submitted + 1;
    ELSE
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('student_id', gs.student_id) || v_block);
    END IF;
  END LOOP;

  IF v_submitted = 0 AND jsonb_array_length(v_skipped) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_students');
  END IF;
  IF v_submitted > 0 THEN
    PERFORM public.write_audit_log(auth.uid(), NULL, 'submit_class_grid', 'class_assessment_grids', g.id,
      jsonb_build_object('student_count', v_submitted, 'skipped_count', jsonb_array_length(v_skipped), 'package_size', g.package_size));
  END IF;
  RETURN jsonb_build_object('ok', true, 'submitted_count', v_submitted, 'skipped', v_skipped);
END;
$$;

-- 5. Đổi gói bị chặn khi đã có em được nộp ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_grid_package(p_grid_id uuid, p_package_size smallint, p_question_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.class_assessment_grids;
  v_valid integer;
BEGIN
  SELECT * INTO g FROM public.class_assessment_grids WHERE id = p_grid_id FOR UPDATE;
  IF NOT FOUND OR g.teacher_id <> auth.uid() OR NOT public.is_class_teacher(g.class_id) THEN
    RAISE EXCEPTION 'grid_not_found';
  END IF;
  IF g.status = 'submitted' THEN RAISE EXCEPTION 'grid_already_submitted'; END IF;
  IF EXISTS (SELECT 1 FROM public.class_assessment_grid_students WHERE grid_id = g.id AND submitted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'grid_has_submitted_students';
  END IF;
  IF p_package_size NOT IN (35, 50, 75) THEN RAISE EXCEPTION 'invalid_package_size'; END IF;
  IF COALESCE(array_length(p_question_ids, 1), 0) = 0 THEN RAISE EXCEPTION 'empty_package'; END IF;

  SELECT count(DISTINCT q.id) INTO v_valid
    FROM public.questions q
    JOIN public.criteria c ON c.id = q.criteria_id AND c.is_active
   WHERE q.id = ANY (p_question_ids) AND q.is_active AND q.rater_group = 'self'
     AND NOT EXISTS (SELECT 1 FROM public.criteria_rater_visibility v
                      WHERE v.criteria_id = c.id AND v.rater_group = 'teacher' AND NOT v.is_visible);
  IF v_valid <> (SELECT count(DISTINCT x) FROM unnest(p_question_ids) x) THEN
    RAISE EXCEPTION 'invalid_package_questions';
  END IF;

  DELETE FROM public.class_assessment_grid_details d
   USING public.class_assessment_grid_students s
   WHERE d.grid_student_id = s.id AND s.grid_id = g.id
     AND (d.question_id IS NULL OR d.question_id <> ALL (p_question_ids));

  DELETE FROM public.class_assessment_grid_questions WHERE grid_id = g.id AND question_id <> ALL (p_question_ids);
  INSERT INTO public.class_assessment_grid_questions (grid_id, question_id, sort_order)
  SELECT g.id, x.question_id, min(x.ord)::integer
    FROM unnest(p_question_ids) WITH ORDINALITY AS x(question_id, ord)
   GROUP BY x.question_id
  ON CONFLICT (grid_id, question_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;

  UPDATE public.class_assessment_grids SET package_size = p_package_size WHERE id = g.id;
END;
$$;

-- 6. Mở bảng lưới: thêm thời điểm nộp của từng học sinh -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_class_grid(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.class_assessment_grids;
  v_students jsonb;
  v_questions jsonb;
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
      'question_id', q.id,
      'question_code', q.question_code,
      'content', q.content,
      'answer_options', q.answer_options,
      'criteria_id', c.id,
      'dimension_code', c.dimension_code,
      'criteria_name', c.name,
      'group_code', cg.group_code,
      'group_name', cg.name
    ) ORDER BY gq.sort_order), '[]'::jsonb) INTO v_questions
    FROM public.class_assessment_grid_questions gq
    JOIN public.questions q ON q.id = gq.question_id
    JOIN public.criteria c ON c.id = q.criteria_id
    JOIN public.criteria_groups cg ON cg.id = c.group_id
   WHERE gq.grid_id = g.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'grid_student_id', s.id,
      'student_id', s.student_id,
      'full_name', COALESCE(p.full_name, ''),
      'acquaintance_duration', s.acquaintance_duration,
      'contact_frequency', s.contact_frequency,
      'observation_depth', s.observation_depth,
      'guardian_pending', (public.is_under_guardian_age(p.date_of_birth) AND NOT p.guardian_consent_confirmed),
      'submitted_at', COALESCE(s.submitted_at, g.submitted_at),
      'cells', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('question_id', d.question_id, 'score', d.score,
                                            'is_insufficient_basis', d.is_insufficient_basis))
          FROM public.class_assessment_grid_details d
         WHERE d.grid_student_id = s.id AND d.question_id IS NOT NULL), '[]'::jsonb)
    ) ORDER BY p.full_name), '[]'::jsonb) INTO v_students
    FROM public.class_assessment_grid_students s
    JOIN public.user_profiles p ON p.id = s.student_id
   WHERE s.grid_id = g.id;

  RETURN jsonb_build_object(
    'grid_id', g.id, 'status', g.status, 'submitted_at', g.submitted_at,
    'package_size', g.package_size,
    'default_acquaintance_duration', g.default_acquaintance_duration,
    'default_contact_frequency', g.default_contact_frequency,
    'default_observation_depth', g.default_observation_depth,
    'questions', v_questions,
    'students', v_students
  );
END;
$$;

-- 7. Khóa dòng đã nộp: ô điểm và mức thấu hiểu của em đã nộp không sửa được ----------------------------------
DROP POLICY IF EXISTS "Teacher edits own draft grid students" ON public.class_assessment_grid_students;
DROP POLICY IF EXISTS "Teacher deletes own draft grid students" ON public.class_assessment_grid_students;
CREATE POLICY "Teacher edits own draft grid students" ON public.class_assessment_grid_students FOR UPDATE TO authenticated
  USING (submitted_at IS NULL AND EXISTS (SELECT 1 FROM public.class_assessment_grids g
                  WHERE g.id = grid_id AND g.teacher_id = auth.uid() AND g.status = 'draft'))
  WITH CHECK (submitted_at IS NULL AND EXISTS (SELECT 1 FROM public.class_assessment_grids g
                       WHERE g.id = grid_id AND g.teacher_id = auth.uid() AND g.status = 'draft'));
CREATE POLICY "Teacher deletes own draft grid students" ON public.class_assessment_grid_students FOR DELETE TO authenticated
  USING (submitted_at IS NULL AND EXISTS (SELECT 1 FROM public.class_assessment_grids g
                  WHERE g.id = grid_id AND g.teacher_id = auth.uid() AND g.status = 'draft'));

DROP POLICY IF EXISTS "Teacher creates own grid details" ON public.class_assessment_grid_details;
DROP POLICY IF EXISTS "Teacher edits own draft grid details" ON public.class_assessment_grid_details;
DROP POLICY IF EXISTS "Teacher deletes own draft grid details" ON public.class_assessment_grid_details;
CREATE POLICY "Teacher creates own grid details" ON public.class_assessment_grid_details FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.class_assessment_grid_students s
      JOIN public.class_assessment_grids g ON g.id = s.grid_id
     WHERE s.id = grid_student_id AND s.submitted_at IS NULL AND g.teacher_id = auth.uid() AND g.status = 'draft'));
CREATE POLICY "Teacher edits own draft grid details" ON public.class_assessment_grid_details FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.class_assessment_grid_students s
      JOIN public.class_assessment_grids g ON g.id = s.grid_id
     WHERE s.id = grid_student_id AND s.submitted_at IS NULL AND g.teacher_id = auth.uid() AND g.status = 'draft'))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.class_assessment_grid_students s
      JOIN public.class_assessment_grids g ON g.id = s.grid_id
     WHERE s.id = grid_student_id AND s.submitted_at IS NULL AND g.teacher_id = auth.uid() AND g.status = 'draft'));
CREATE POLICY "Teacher deletes own draft grid details" ON public.class_assessment_grid_details FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.class_assessment_grid_students s
      JOIN public.class_assessment_grids g ON g.id = s.grid_id
     WHERE s.id = grid_student_id AND s.submitted_at IS NULL AND g.teacher_id = auth.uid() AND g.status = 'draft'));

-- 8. Phân quyền thực thi ------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.grid_student_block_reason(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_grid_student(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_class_grid_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_class_grid_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_class_grid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_grid_package(uuid, smallint, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_grid(uuid) TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
  END IF;
END $$;
