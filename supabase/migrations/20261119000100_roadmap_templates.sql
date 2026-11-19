-- ====================================================================
-- Lộ trình mẫu theo band (file BA "[VIBE MAPPING] ROADMAP.xlsx")
--  - 5 lộ trình mẫu theo đối tượng: học sinh thi đại học trong nước, học sinh du học, sinh viên chung,
--    sinh viên ngành Phân tích nghiệp vụ, sinh viên ngành Lập trình
--  - 7 nhóm tiêu chí G1–G7 × 4 band theo % đạt của nhóm: B1 [0,25), B2 [25,50), B3 [50,80), B4 [80,100]
--  - Trọng số nghề chỉ dùng xếp ưu tiên: điểm thiếu = trọng số × (1 − % đạt), không quyết định band
--  - Hoạt động của lộ trình gắn nhóm tiêu chí thay cho ba trụ cột; hoạt động cũ theo trụ cột vẫn giữ nguyên
-- Nội dung (mục, mô tả band, trọng số) nạp bằng: npm run import:roadmap-templates
-- ====================================================================

-- 1. Lộ trình mẫu ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roadmap_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_code text NOT NULL UNIQUE,
  template_name text NOT NULL CHECK (length(trim(template_name)) > 0),
  learner_level text NOT NULL CHECK (learner_level IN ('high_school', 'university')),
  -- Mẫu tự chọn khi nghề mục tiêu có mã khớp một trong các mẫu ILIKE này
  career_code_patterns text[] NOT NULL DEFAULT '{}',
  is_level_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

INSERT INTO public.roadmap_templates (template_code, template_name, learner_level, career_code_patterns, is_level_default, sort_order)
VALUES
  ('RM1', 'Học sinh thi đại học trong nước', 'high_school', '{}', true, 1),
  ('RM2', 'Học sinh chuẩn bị du học', 'high_school', '{}', false, 2),
  ('RM3', 'Sinh viên các ngành', 'university', '{}', true, 3),
  ('RM4', 'Sinh viên ngành Phân tích nghiệp vụ', 'university', '{%phan-tich-nghiep-vu%}', false, 4),
  ('RM5', 'Sinh viên ngành Lập trình', 'university',
   '{%lap-trinh-vien%,%ky-su-phan-mem%,%ky-su-phat-trien-phan-mem%}', false, 5)
ON CONFLICT (template_code) DO NOTHING;

-- 2. Band của từng nhóm tiêu chí ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roadmap_group_bands (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_code text NOT NULL CHECK (group_code IN ('G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7')),
  band_code text NOT NULL CHECK (band_code IN ('B1', 'B2', 'B3', 'B4')),
  stage_name text NOT NULL,
  -- Ranh giới thuộc band cao hơn: % đạt >= min_percent và < max_percent (B4 gồm cả 100)
  min_percent numeric NOT NULL CHECK (min_percent >= 0 AND min_percent <= 100),
  max_percent numeric NOT NULL CHECK (max_percent > min_percent AND max_percent <= 100),
  band_summary text,
  roadmap_summary text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (group_code, band_code)
);

INSERT INTO public.roadmap_group_bands (group_code, band_code, stage_name, min_percent, max_percent)
SELECT g.code, b.code, b.stage, b.lo, b.hi
FROM (VALUES ('G1'), ('G2'), ('G3'), ('G4'), ('G5'), ('G6'), ('G7')) AS g(code)
CROSS JOIN (VALUES ('B1', 'Khởi động', 0, 25), ('B2', 'Xây nền', 25, 50), ('B3', 'Vận dụng', 50, 80), ('B4', 'Bứt phá', 80, 100)) AS b(code, stage, lo, hi)
ON CONFLICT (group_code, band_code) DO NOTHING;

-- 3. Trọng số nghề theo lộ trình mẫu (tổng 100; mẫu không có trọng số riêng thì chia đều) ---------------
CREATE TABLE IF NOT EXISTS public.roadmap_template_weights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_code text NOT NULL REFERENCES public.roadmap_templates(template_code) ON UPDATE CASCADE ON DELETE CASCADE,
  group_code text NOT NULL CHECK (group_code IN ('G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7')),
  weight numeric NOT NULL CHECK (weight >= 0),
  note text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (template_code, group_code)
);

-- 4. Mục của lộ trình mẫu ----------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roadmap_template_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_code text NOT NULL UNIQUE,
  template_code text NOT NULL REFERENCES public.roadmap_templates(template_code) ON UPDATE CASCADE ON DELETE CASCADE,
  group_code text NOT NULL CHECK (group_code IN ('G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7')),
  band_code text NOT NULL CHECK (band_code IN ('B1', 'B2', 'B3', 'B4')),
  stage_name text NOT NULL,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  how_to text,
  skills_gained text,
  completion_evidence text,
  pass_criteria text,
  duration_weeks integer NOT NULL CHECK (duration_weeks > 0),
  -- Nhóm Lãnh đạo & Tổ chức có 3 cấp: {"1": tuần, "2": tuần, "3": tuần}
  level_duration_weeks jsonb,
  duration_text text,
  prerequisite_codes text[] NOT NULL DEFAULT '{}',
  prerequisite_required boolean NOT NULL DEFAULT true,
  parallel_codes text[] NOT NULL DEFAULT '{}',
  reference_source text,
  confidence_label text,
  check_status text,
  check_note text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_roadmap_template_items_cell
  ON public.roadmap_template_items (template_code, group_code, band_code, sort_order);

-- 5. Quyền đọc/ghi -------------------------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['roadmap_templates', 'roadmap_group_bands', 'roadmap_template_weights', 'roadmap_template_items'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin writes %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Admin writes %1$s" ON public.%1$I FOR ALL TO authenticated
                      USING (public.is_system_admin()) WITH CHECK (public.is_system_admin())', t);
    EXECUTE format('DROP TRIGGER IF EXISTS set_%1$s_updated_at ON public.%1$I', t);
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at' AND pronamespace = 'public'::regnamespace) THEN
      EXECUTE format('CREATE TRIGGER set_%1$s_updated_at BEFORE UPDATE ON public.%1$I
                        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', t);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Read roadmap templates" ON public.roadmap_templates;
CREATE POLICY "Read roadmap templates" ON public.roadmap_templates FOR SELECT TO authenticated
  USING (is_active OR public.is_system_admin());
DROP POLICY IF EXISTS "Read roadmap group bands" ON public.roadmap_group_bands;
CREATE POLICY "Read roadmap group bands" ON public.roadmap_group_bands FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Read roadmap template weights" ON public.roadmap_template_weights;
CREATE POLICY "Read roadmap template weights" ON public.roadmap_template_weights FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Read roadmap template items" ON public.roadmap_template_items;
CREATE POLICY "Read roadmap template items" ON public.roadmap_template_items FOR SELECT TO authenticated
  USING (is_active OR public.is_system_admin());

-- 6. Lộ trình và hoạt động: gắn mẫu, nhóm tiêu chí, mục mẫu ---------------------------------------------------
ALTER TABLE public.roadmaps
  ADD COLUMN IF NOT EXISTS template_code text REFERENCES public.roadmap_templates(template_code) ON UPDATE CASCADE ON DELETE SET NULL,
  -- % đạt và band từng nhóm lúc tạo lộ trình: [{"group_code","percent","band_code","weight","gap"}]
  ADD COLUMN IF NOT EXISTS group_snapshot jsonb;

ALTER TABLE public.roadmap_milestones
  ALTER COLUMN pillar DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS criteria_group text CHECK (criteria_group IS NULL OR criteria_group IN ('G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7')),
  ADD COLUMN IF NOT EXISTS template_item_id uuid REFERENCES public.roadmap_template_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS item_level smallint CHECK (item_level IS NULL OR item_level BETWEEN 1 AND 3);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roadmap_milestones_track_check') THEN
    ALTER TABLE public.roadmap_milestones
      ADD CONSTRAINT roadmap_milestones_track_check CHECK (pillar IS NOT NULL OR criteria_group IS NOT NULL);
  END IF;
END $$;

-- Thời lượng mỗi mục chiếm bao nhiêu giờ/tuần, để tính số mục chạy song song từ số giờ người dùng khai
INSERT INTO public.operation_parameters (param_code, param_name, param_value)
SELECT 'roadmap_item_hours_per_week', 'Số giờ mỗi tuần một mục lộ trình cần', '2'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.operation_parameters WHERE param_code = 'roadmap_item_hours_per_week');
UPDATE public.operation_parameters SET verification_level = 'demo' WHERE param_code = 'roadmap_item_hours_per_week';

-- 7. Tính trạng thái tiến độ: mỗi nhóm tiêu chí (hoặc trụ cột với hoạt động cũ) nặng như nhau -----------------
CREATE OR REPLACE FUNCTION public.roadmap_status(p_roadmap_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_start date;
  v_target date;
  v_today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_total integer;
  v_actual numeric;
  v_planned numeric := 0;
  v_delay numeric := 0;
  v_missed jsonb;
  v_limit numeric := public.roadmap_param('roadmap_off_track_percent', 20);
BEGIN
  SELECT (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, target_date INTO v_start, v_target
    FROM public.roadmaps WHERE id = p_roadmap_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_total FROM public.roadmap_milestones WHERE roadmap_id = p_roadmap_id;

  SELECT COALESCE(round(avg(p.pct), 1), 0) INTO v_actual
    FROM (
      SELECT COALESCE(sum(weight) FILTER (WHERE done), 0) / NULLIF(sum(weight), 0) * 100 AS pct
        FROM public.roadmap_milestones WHERE roadmap_id = p_roadmap_id
       GROUP BY COALESCE(criteria_group, pillar)
    ) p WHERE p.pct IS NOT NULL;

  IF v_target IS NOT NULL THEN
    v_planned := CASE
      WHEN v_target <= v_start THEN 100
      ELSE round(greatest(0, least(1, (v_today - v_start)::numeric / (v_target - v_start))) * 100, 1)
    END;
  END IF;
  IF v_total > 0 THEN v_delay := round(greatest(0, v_planned - v_actual), 1); END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'title', title) ORDER BY due_date), '[]'::jsonb) INTO v_missed
    FROM public.roadmap_milestones
   WHERE roadmap_id = p_roadmap_id AND is_checkpoint AND NOT done AND due_date IS NOT NULL AND due_date < v_today;

  RETURN jsonb_build_object(
    'actual_percent', v_actual,
    'planned_percent', v_planned,
    'delay_percent', v_delay,
    'missed_checkpoints', v_missed,
    'off_track', v_delay > v_limit OR jsonb_array_length(v_missed) > 0
  );
END;
$$;

-- 8. Gắn mẫu và ảnh chụp % đạt từng nhóm vào lộ trình -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_roadmap_template(p_roadmap_id uuid, p_template_code text, p_group_snapshot jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_template_code IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.roadmap_templates WHERE template_code = p_template_code AND is_active) THEN
    RAISE EXCEPTION 'template_not_found';
  END IF;
  IF p_group_snapshot IS NOT NULL AND jsonb_typeof(p_group_snapshot) <> 'array' THEN RAISE EXCEPTION 'invalid_snapshot'; END IF;
  UPDATE public.roadmaps SET template_code = p_template_code, group_snapshot = p_group_snapshot
   WHERE id = p_roadmap_id AND owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
END;
$$;

-- 9. Thêm hoạt động: chọn nhóm tiêu chí (hoặc trụ cột như cũ) -------------------------------------------------------
DROP FUNCTION IF EXISTS public.add_roadmap_milestone(uuid, text, text, date, numeric, boolean, text);
CREATE OR REPLACE FUNCTION public.add_roadmap_milestone(
  p_roadmap_id uuid, p_pillar text, p_title text,
  p_due_date date DEFAULT NULL, p_weight numeric DEFAULT 1, p_is_checkpoint boolean DEFAULT false,
  p_pass_criteria text DEFAULT NULL, p_criteria_group text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_pillar text := NULLIF(p_pillar, '');
  v_group text := NULLIF(p_criteria_group, '');
BEGIN
  IF v_pillar IS NULL AND v_group IS NULL THEN RAISE EXCEPTION 'invalid_pillar'; END IF;
  IF v_pillar IS NOT NULL AND v_pillar NOT IN ('knowledge', 'experience', 'exploration') THEN RAISE EXCEPTION 'invalid_pillar'; END IF;
  IF v_group IS NOT NULL AND v_group NOT IN ('G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7') THEN RAISE EXCEPTION 'invalid_group'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.roadmaps WHERE id = p_roadmap_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;
  IF COALESCE(p_weight, 1) <= 0 THEN RAISE EXCEPTION 'invalid_weight'; END IF;
  INSERT INTO public.roadmap_milestones (roadmap_id, pillar, criteria_group, title, due_date, weight, is_checkpoint, source, pass_criteria)
  VALUES (p_roadmap_id, v_pillar, v_group, trim(p_title), p_due_date, COALESCE(p_weight, 1), COALESCE(p_is_checkpoint, false), 'user',
          NULLIF(trim(COALESCE(p_pass_criteria, '')), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_roadmap_milestones_bulk(p_roadmap_id uuid, p_items jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item jsonb;
  v_pillar text;
  v_group text;
  v_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmaps WHERE id = p_roadmap_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    IF COALESCE(v_item->>'title', '') = '' THEN CONTINUE; END IF;
    v_pillar := NULLIF(v_item->>'pillar', '');
    v_group := NULLIF(v_item->>'criteria_group', '');
    IF v_pillar IS NULL AND v_group IS NULL THEN RAISE EXCEPTION 'invalid_pillar'; END IF;
    IF v_pillar IS NOT NULL AND v_pillar NOT IN ('knowledge', 'experience', 'exploration') THEN RAISE EXCEPTION 'invalid_pillar'; END IF;
    IF v_group IS NOT NULL AND v_group NOT IN ('G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7') THEN RAISE EXCEPTION 'invalid_group'; END IF;
    INSERT INTO public.roadmap_milestones
      (roadmap_id, pillar, criteria_group, template_item_id, item_level, title, start_date, due_date, weight, is_checkpoint, source,
       pass_criteria, fail_criteria, activity_type, is_partner, expected_result)
    VALUES (
      p_roadmap_id,
      v_pillar,
      v_group,
      (SELECT t.id FROM public.roadmap_template_items t WHERE t.id = NULLIF(v_item->>'template_item_id', '')::uuid),
      NULLIF(v_item->>'item_level', '')::smallint,
      trim(v_item->>'title'),
      NULLIF(v_item->>'start_date', '')::date,
      NULLIF(v_item->>'due_date', '')::date,
      COALESCE((v_item->>'weight')::numeric, 1),
      COALESCE((v_item->>'is_checkpoint')::boolean, false),
      'system',
      NULLIF(v_item->>'pass_criteria', ''),
      NULLIF(v_item->>'fail_criteria', ''),
      NULLIF(v_item->>'activity_type', ''),
      COALESCE((v_item->>'is_partner')::boolean, false),
      NULLIF(v_item->>'expected_result', '')
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 10. Danh sách lộ trình: thêm mẫu, ảnh chụp nhóm và chi tiết mục mẫu của từng hoạt động ----------------------------
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
               'detail', CASE WHEN ti.id IS NULL THEN NULL ELSE jsonb_build_object(
                 'band_code', ti.band_code, 'stage_name', ti.stage_name, 'how_to', ti.how_to,
                 'skills_gained', ti.skills_gained, 'completion_evidence', ti.completion_evidence,
                 'duration_text', ti.duration_text, 'reference_source', ti.reference_source) END
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

-- 11. Quyền hàm -------------------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.set_roadmap_template(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_roadmap_template(uuid, text, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.add_roadmap_milestone(uuid, text, text, date, numeric, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_roadmap_milestone(uuid, text, text, date, numeric, boolean, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.roadmap_status(uuid) FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.set_roadmap_template(uuid, text, jsonb) TO service_role;
    GRANT EXECUTE ON FUNCTION public.add_roadmap_milestone(uuid, text, text, date, numeric, boolean, text, text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.roadmap_status(uuid) TO service_role;
  END IF;
END $$;
