-- ====================================================================
-- Lộ trình mẫu: phần bổ sung nhóm Lãnh đạo & Tổ chức (sheet "LD - Kế hoạch mẫu") và quản trị mục mẫu
--  - Mỗi mục LD: gợi ý chọn cấp, cần biết trước, trải nghiệm, giờ phụ thêm, đường lui, ranh giới với nhóm khác
--  - Kế hoạch mẫu (2 mẫu mỗi mục, lịch theo 3 cấp), quy tắc chung từng lộ trình
--  - Kiểm tra nhanh 5 câu, dùng chung cho mọi lộ trình theo đuôi mã mục (LD-B2-02…), đạt khi đúng >= 80%
--  - Người dùng đổi cấp bất kỳ lúc nào: hạn hoạt động tính lại theo số tuần của cấp
--  - Mục do quản trị sửa trong ứng dụng ghi người sửa; nạp lại từ Excel không ghi đè các mục này
-- ====================================================================

-- 1. Thông tin bổ sung của mục ---------------------------------------------------------------------------
ALTER TABLE public.roadmap_template_items
  ADD COLUMN IF NOT EXISTS level_guide text,
  ADD COLUMN IF NOT EXISTS prior_knowledge text,
  ADD COLUMN IF NOT EXISTS experience_task text,
  ADD COLUMN IF NOT EXISTS extra_hours_text text,
  ADD COLUMN IF NOT EXISTS fallback_options text,
  ADD COLUMN IF NOT EXISTS group_boundary text,
  ADD COLUMN IF NOT EXISTS supplement_note text,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 2. Kế hoạch mẫu ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roadmap_sample_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_code text NOT NULL UNIQUE,
  item_code text NOT NULL REFERENCES public.roadmap_template_items(item_code) ON UPDATE CASCADE ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  fit_when text,
  schedule_level_1 text,
  schedule_level_2 text,
  schedule_level_3 text,
  suggested_output text,
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_roadmap_sample_plans_item ON public.roadmap_sample_plans (item_code, sort_order);

-- 3. Quy tắc chung của nhóm theo lộ trình -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roadmap_template_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_code text NOT NULL REFERENCES public.roadmap_templates(template_code) ON UPDATE CASCADE ON DELETE CASCADE,
  group_code text NOT NULL DEFAULT 'G5' CHECK (group_code IN ('G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7')),
  rule_code text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (template_code, rule_code)
);

-- 4. Kiểm tra nhanh -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roadmap_quiz_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Đuôi mã mục, dùng chung cho mọi lộ trình: LD-B2-02 ứng với RM1-LD-B2-02, RM2-LD-B2-02…
  item_suffix text NOT NULL CHECK (item_suffix ~ '^[A-Z]{2}-B[1-4]-[0-9]{2}$'),
  question_no integer NOT NULL CHECK (question_no > 0),
  question_text text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  correct_option text NOT NULL CHECK (correct_option IN ('A', 'B', 'C')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (item_suffix, question_no)
);

ALTER TABLE public.roadmap_milestones
  ADD COLUMN IF NOT EXISTS quiz_score smallint,
  ADD COLUMN IF NOT EXISTS quiz_total smallint,
  ADD COLUMN IF NOT EXISTS quiz_passed_at timestamptz;

-- 5. Quyền --------------------------------------------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['roadmap_sample_plans', 'roadmap_template_rules', 'roadmap_quiz_questions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin writes %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Admin writes %1$s" ON public.%1$I FOR ALL TO authenticated
                      USING (public.is_system_admin()) WITH CHECK (public.is_system_admin())', t);
    EXECUTE format('DROP TRIGGER IF EXISTS set_%1$s_updated_at ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER set_%1$s_updated_at BEFORE UPDATE ON public.%1$I
                      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Read roadmap sample plans" ON public.roadmap_sample_plans;
CREATE POLICY "Read roadmap sample plans" ON public.roadmap_sample_plans FOR SELECT TO authenticated
  USING (is_active OR public.is_system_admin());
DROP POLICY IF EXISTS "Read roadmap template rules" ON public.roadmap_template_rules;
CREATE POLICY "Read roadmap template rules" ON public.roadmap_template_rules FOR SELECT TO authenticated USING (true);
-- Câu hỏi kiểm tra nhanh chỉ quản trị đọc trực tiếp; người học lấy câu hỏi (không kèm đáp án) qua hàm

-- Quản trị sửa trong ứng dụng thì ghi người sửa; nạp bằng khóa dịch vụ (không có người dùng) giữ nguyên
CREATE OR REPLACE FUNCTION public.mark_roadmap_template_editor()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN NEW.updated_by := auth.uid(); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS mark_roadmap_template_items_editor ON public.roadmap_template_items;
CREATE TRIGGER mark_roadmap_template_items_editor BEFORE UPDATE ON public.roadmap_template_items
  FOR EACH ROW EXECUTE FUNCTION public.mark_roadmap_template_editor();
DROP TRIGGER IF EXISTS mark_roadmap_sample_plans_editor ON public.roadmap_sample_plans;
CREATE TRIGGER mark_roadmap_sample_plans_editor BEFORE UPDATE ON public.roadmap_sample_plans
  FOR EACH ROW EXECUTE FUNCTION public.mark_roadmap_template_editor();

-- 6. Đổi cấp của hoạt động: hạn = ngày bắt đầu + số tuần của cấp ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_roadmap_milestone_level(p_milestone_id uuid, p_level integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m public.roadmap_milestones%ROWTYPE;
  v_weeks integer;
  v_due date;
BEGIN
  IF p_level IS NULL OR p_level NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'invalid_level'; END IF;
  SELECT x.* INTO m FROM public.roadmap_milestones x
   WHERE x.id = p_milestone_id
     AND EXISTS (SELECT 1 FROM public.roadmaps r WHERE r.id = x.roadmap_id AND r.owner_id = auth.uid() AND r.is_active);
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT (t.level_duration_weeks ->> p_level::text)::integer INTO v_weeks
    FROM public.roadmap_template_items t WHERE t.id = m.template_item_id;
  IF v_weeks IS NULL THEN RAISE EXCEPTION 'level_not_supported'; END IF;
  v_due := CASE WHEN m.start_date IS NOT NULL THEN m.start_date + v_weeks * 7 - 1 ELSE m.due_date END;
  UPDATE public.roadmap_milestones SET item_level = p_level, due_date = v_due WHERE id = m.id;
  RETURN jsonb_build_object('item_level', p_level, 'due_date', v_due);
END;
$$;

-- 7. Kiểm tra nhanh: lấy câu hỏi (không có đáp án), nộp bài và chấm trên máy chủ ---------------------------------------
CREATE OR REPLACE FUNCTION public.roadmap_quiz_suffix(p_milestone_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT substring(t.item_code FROM '^RM[0-9]+-(.*)$')
    FROM public.roadmap_milestones m
    JOIN public.roadmaps r ON r.id = m.roadmap_id AND r.owner_id = auth.uid()
    JOIN public.roadmap_template_items t ON t.id = m.template_item_id
   WHERE m.id = p_milestone_id;
$$;

CREATE OR REPLACE FUNCTION public.get_roadmap_quiz(p_milestone_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_suffix text := public.roadmap_quiz_suffix(p_milestone_id);
BEGIN
  IF v_suffix IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('question_no', q.question_no, 'question_text', q.question_text,
             'options', jsonb_build_object('A', q.option_a, 'B', q.option_b, 'C', q.option_c)) ORDER BY q.question_no)
      FROM public.roadmap_quiz_questions q WHERE q.item_suffix = v_suffix AND q.is_active
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_roadmap_quiz(p_milestone_id uuid, p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_suffix text := public.roadmap_quiz_suffix(p_milestone_id);
  v_total integer;
  v_correct integer;
  v_passed boolean;
  v_results jsonb;
BEGIN
  IF v_suffix IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN RAISE EXCEPTION 'invalid_answers'; END IF;
  SELECT count(*), count(*) FILTER (WHERE upper(p_answers ->> q.question_no::text) = q.correct_option),
         jsonb_agg(jsonb_build_object('question_no', q.question_no, 'chosen', upper(p_answers ->> q.question_no::text),
                   'correct_option', q.correct_option) ORDER BY q.question_no)
    INTO v_total, v_correct, v_results
    FROM public.roadmap_quiz_questions q WHERE q.item_suffix = v_suffix AND q.is_active;
  IF v_total = 0 THEN RAISE EXCEPTION 'quiz_not_found'; END IF;
  v_passed := v_correct >= ceil(v_total * 0.8);
  UPDATE public.roadmap_milestones SET
    quiz_score = GREATEST(COALESCE(quiz_score, 0), v_correct),
    quiz_total = v_total,
    quiz_passed_at = CASE WHEN v_passed THEN COALESCE(quiz_passed_at, now()) ELSE quiz_passed_at END
   WHERE id = p_milestone_id;
  RETURN jsonb_build_object('correct', v_correct, 'total', v_total, 'passed', v_passed, 'results', v_results);
END;
$$;

-- 8. Danh sách lộ trình: thêm phần bổ sung, kế hoạch mẫu và kiểm tra nhanh của từng hoạt động ------------------------------
CREATE OR REPLACE FUNCTION public.list_my_roadmaps()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'title', r.title, 'career_id', r.career_id, 'career_name', c.career_name,
    'training_program_id', r.training_program_id,
    'program_title', CASE WHEN tp.id IS NULL THEN NULL ELSE
      concat_ws(' – ', i.institution_name, m.major_name) ||
      CASE WHEN tp.specialization_name IS NOT NULL THEN ' (' || tp.specialization_name || ')' ELSE '' END END,
    'template_code', r.template_code, 'template_name', rt.template_name, 'group_snapshot', r.group_snapshot,
    'is_active', r.is_active, 'target_date', r.target_date, 'created_at', r.created_at,
    'education_level', r.education_level, 'school_year', r.school_year,
    'current_skills', r.current_skills, 'certificates', r.certificates, 'extracurricular', r.extracurricular,
    'hours_per_week', r.hours_per_week, 'regenerate_reason', r.regenerate_reason, 'previous_roadmap_id', r.previous_roadmap_id,
    'careers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', tc.career_id, 'name', k.career_name) ORDER BY tc.sort_order)
        FROM public.roadmap_target_careers tc JOIN public.careers k ON k.id = tc.career_id WHERE tc.roadmap_id = r.id
    ), '[]'::jsonb),
    'milestones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', ms.id, 'pillar', ms.pillar, 'criteria_group', ms.criteria_group,
               'template_item_id', ms.template_item_id, 'item_level', ms.item_level, 'title', ms.title, 'done', ms.done,
               'start_date', ms.start_date, 'due_date', ms.due_date, 'weight', ms.weight, 'is_checkpoint', ms.is_checkpoint,
               'note', ms.note, 'done_at', ms.done_at, 'source', ms.source,
               'pass_criteria', ms.pass_criteria, 'fail_criteria', ms.fail_criteria,
               'activity_type', ms.activity_type, 'is_partner', ms.is_partner, 'expected_result', ms.expected_result,
               'quiz_score', ms.quiz_score, 'quiz_total', ms.quiz_total, 'quiz_passed_at', ms.quiz_passed_at,
               'detail', CASE WHEN ti.id IS NULL THEN NULL ELSE jsonb_build_object(
                 'band_code', ti.band_code, 'stage_name', ti.stage_name, 'how_to', ti.how_to,
                 'skills_gained', ti.skills_gained, 'completion_evidence', ti.completion_evidence,
                 'duration_text', ti.duration_text, 'reference_source', ti.reference_source,
                 'level_duration_weeks', ti.level_duration_weeks, 'level_guide', ti.level_guide,
                 'prior_knowledge', ti.prior_knowledge, 'experience_task', ti.experience_task,
                 'extra_hours_text', ti.extra_hours_text, 'fallback_options', ti.fallback_options,
                 'has_quiz', EXISTS (SELECT 1 FROM public.roadmap_quiz_questions q
                                      WHERE q.is_active AND q.item_suffix = substring(ti.item_code FROM '^RM[0-9]+-(.*)$')),
                 'plans', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object('id', sp.id, 'title', sp.title, 'fit_when', sp.fit_when,
                            'schedule_level_1', sp.schedule_level_1, 'schedule_level_2', sp.schedule_level_2,
                            'schedule_level_3', sp.schedule_level_3, 'suggested_output', sp.suggested_output, 'note', sp.note)
                          ORDER BY sp.sort_order)
                     FROM public.roadmap_sample_plans sp WHERE sp.item_code = ti.item_code AND sp.is_active
                 ), '[]'::jsonb)) END
             ) ORDER BY ms.due_date NULLS LAST, ms.created_at)
        FROM public.roadmap_milestones ms
        LEFT JOIN public.roadmap_template_items ti ON ti.id = ms.template_item_id
       WHERE ms.roadmap_id = r.id
    ), '[]'::jsonb)
  ) ORDER BY r.is_active DESC, r.created_at DESC), '[]'::jsonb)
  FROM public.roadmaps r
  LEFT JOIN public.careers c ON c.id = r.career_id
  LEFT JOIN public.roadmap_templates rt ON rt.template_code = r.template_code
  LEFT JOIN public.training_programs tp ON tp.id = r.training_program_id
  LEFT JOIN public.institutions i ON i.id = tp.institution_id
  LEFT JOIN public.majors m ON m.id = tp.major_id
  WHERE r.owner_id = auth.uid();
$$;

-- 9. Quyền hàm -------------------------------------------------------------------------------------------------------------
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'set_roadmap_milestone_level(uuid, integer)', 'get_roadmap_quiz(uuid)', 'submit_roadmap_quiz(uuid, jsonb)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  REVOKE ALL ON FUNCTION public.roadmap_quiz_suffix(uuid) FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.mark_roadmap_template_editor() FROM PUBLIC, anon, authenticated;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.set_roadmap_milestone_level(uuid, integer), public.get_roadmap_quiz(uuid),
      public.submit_roadmap_quiz(uuid, jsonb), public.roadmap_quiz_suffix(uuid) TO service_role;
  END IF;
END $$;
