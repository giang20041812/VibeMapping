-- ====================================================================
-- Phase 1 / Migration 20: Bảng lưới của giáo viên chấm theo gói câu hỏi
--
-- Giáo viên chọn gói (Cơ bản / Tiêu chuẩn / Chuyên sâu) như học sinh tự đánh giá; mỗi câu hỏi của gói là một cột,
-- ô là đáp án của câu hỏi (điểm 1–5 hoặc không đủ cơ sở). Khi nộp, đáp án đi vào bài 360° kèm câu hỏi và tiêu chí,
-- điểm 360° tính theo tiêu chí nên không phụ thuộc học sinh và giáo viên trả lời bộ câu hỏi nào.
-- Câu hỏi thuộc tiêu chí ẩn với giáo viên (ma trận thang đo) không vào bảng lưới.
-- Thay cho bộ tiêu chí rút gọn (criteria.is_short_set) ở các migration trước.
-- ====================================================================

-- 1. Gói và danh sách câu hỏi của bảng lưới ----------------------------------------------------------------------
ALTER TABLE public.class_assessment_grids
  ADD COLUMN IF NOT EXISTS package_size smallint CHECK (package_size IN (35, 50, 75));

CREATE TABLE IF NOT EXISTS public.class_assessment_grid_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  grid_id uuid NOT NULL REFERENCES public.class_assessment_grids(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT class_assessment_grid_questions_unique UNIQUE (grid_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_grid_questions_grid ON public.class_assessment_grid_questions(grid_id, sort_order);

ALTER TABLE public.class_assessment_grid_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Teacher reads own grid questions" ON public.class_assessment_grid_questions;
CREATE POLICY "Teacher reads own grid questions" ON public.class_assessment_grid_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_assessment_grids g WHERE g.id = grid_id AND g.teacher_id = auth.uid()));

-- 2. Ô điểm theo câu hỏi -----------------------------------------------------------------------------------------
ALTER TABLE public.class_assessment_grid_details
  ADD COLUMN IF NOT EXISTS question_id uuid REFERENCES public.questions(id) ON DELETE RESTRICT;

-- Ô chấm theo tiêu chí của bảng còn nháp không dùng được nữa; bảng đã nộp giữ nguyên làm lịch sử
DELETE FROM public.class_assessment_grid_details d
 USING public.class_assessment_grid_students s, public.class_assessment_grids g
 WHERE d.grid_student_id = s.id AND s.grid_id = g.id AND g.status = 'draft' AND d.question_id IS NULL;

ALTER TABLE public.class_assessment_grid_details DROP CONSTRAINT IF EXISTS class_assessment_grid_details_unique;
ALTER TABLE public.class_assessment_grid_details DROP CONSTRAINT IF EXISTS class_assessment_grid_details_question_unique;
ALTER TABLE public.class_assessment_grid_details
  ADD CONSTRAINT class_assessment_grid_details_question_unique UNIQUE (grid_student_id, question_id);

-- Tiêu chí của ô lấy theo câu hỏi; câu hỏi phải thuộc gói của bảng
CREATE OR REPLACE FUNCTION public.set_grid_detail_criteria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.question_id IS NULL THEN RAISE EXCEPTION 'grid_question_required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.class_assessment_grid_students s
      JOIN public.class_assessment_grid_questions q ON q.grid_id = s.grid_id
     WHERE s.id = NEW.grid_student_id AND q.question_id = NEW.question_id
  ) THEN
    RAISE EXCEPTION 'grid_question_not_in_package';
  END IF;
  SELECT criteria_id INTO NEW.criteria_id FROM public.questions WHERE id = NEW.question_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_grid_detail_criteria ON public.class_assessment_grid_details;
CREATE TRIGGER set_grid_detail_criteria
  BEFORE INSERT OR UPDATE OF question_id, criteria_id ON public.class_assessment_grid_details
  FOR EACH ROW EXECUTE FUNCTION public.set_grid_detail_criteria();

-- 3. Chọn gói: thay danh sách câu hỏi, bỏ ô của câu không còn trong gói ------------------------------------------
-- Danh sách câu do giao diện chọn theo đúng quy tắc gói của học sinh; ở đây chỉ kiểm tra câu hợp lệ.
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

-- 4. Mở bảng lưới: trả thêm gói, câu hỏi và ô theo câu hỏi -------------------------------------------------------
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

-- 5. Nộp cả bảng: đủ đáp án mọi câu của gói cho mọi học sinh; đáp án vào bài 360° kèm câu hỏi --------------------
CREATE OR REPLACE FUNCTION public.submit_class_grid(p_grid_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.class_assessment_grids;
  gs public.class_assessment_grid_students;
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

  IF g.package_size IS NULL OR NOT EXISTS (SELECT 1 FROM public.class_assessment_grid_questions WHERE grid_id = g.id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'package_not_selected');
  END IF;

  SELECT count(*) INTO v_student_count FROM public.class_assessment_grid_students WHERE grid_id = g.id;
  IF v_student_count = 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_students'); END IF;

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
        JOIN public.class_assessment_grid_questions gq ON gq.grid_id = s.grid_id
        LEFT JOIN public.class_assessment_grid_details d ON d.grid_student_id = s.id AND d.question_id = gq.question_id
       WHERE s.grid_id = g.id
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

    -- Điểm tiêu chí = trung bình đáp án các câu cùng tiêu chí (recalculate_result)
    DELETE FROM public.assessment_360_answers WHERE submission_id = v_sub_id;
    INSERT INTO public.assessment_360_answers (submission_id, question_id, criteria_id, score, is_insufficient_basis)
    SELECT v_sub_id, d.question_id, d.criteria_id, d.score, d.is_insufficient_basis
      FROM public.class_assessment_grid_details d
      JOIN public.class_assessment_grid_questions gq ON gq.grid_id = g.id AND gq.question_id = d.question_id
     WHERE d.grid_student_id = gs.id;

    UPDATE public.class_assessment_grid_students SET submitted_at = now() WHERE id = gs.id;
    PERFORM public.recalculate_latest_result(gs.student_id);
  END LOOP;

  UPDATE public.class_assessment_grids SET status = 'submitted', submitted_at = now() WHERE id = g.id;
  PERFORM public.write_audit_log(auth.uid(), NULL, 'submit_class_grid', 'class_assessment_grids', g.id,
    jsonb_build_object('student_count', v_student_count, 'package_size', g.package_size));
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_grid_package(uuid, smallint, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_grid_detail_criteria() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_grid_package(uuid, smallint, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_grid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_class_grid(uuid) TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
  END IF;
END $$;
