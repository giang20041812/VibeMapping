-- ====================================================================
-- Phase 3 / Lộ trình phát triển (M07): hoàn thiện theo đặc tả
--  - Hoạt động: ghi chú kết quả, thời điểm xong, nguồn, tiêu chí đạt/chưa đạt, loại, nhãn đối tác, kết quả kỳ vọng
--  - Lộ trình: số giờ mỗi tuần, lý do tạo lại, lộ trình trước; tối đa 2 nghề mục tiêu
--  - Lưu tiến độ nhiều hoạt động một lần; sửa hạn kèm danh sách cột mốc bị ảnh hưởng
--  - Kỹ năng mềm G1–G7 điểm thấp hoặc lệch tự đánh giá / người khác
--  - Quét chệch hướng 3 lần/ngày (8h, 12h, 20h giờ Việt Nam), thông báo trong ứng dụng, tự xóa khi cập nhật hoặc tạo lại
-- ====================================================================

-- 1. Cột mới ------------------------------------------------------------------------------------
ALTER TABLE public.roadmaps
  ADD COLUMN IF NOT EXISTS hours_per_week integer CHECK (hours_per_week IS NULL OR hours_per_week > 0),
  ADD COLUMN IF NOT EXISTS regenerate_reason text
    CHECK (regenerate_reason IS NULL OR regenerate_reason IN ('off_track', 'circumstances', 'career_changed', 'not_admitted')),
  ADD COLUMN IF NOT EXISTS previous_roadmap_id uuid REFERENCES public.roadmaps(id) ON DELETE SET NULL;

ALTER TABLE public.roadmap_milestones
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS done_at timestamptz,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'user')),
  ADD COLUMN IF NOT EXISTS pass_criteria text,
  ADD COLUMN IF NOT EXISTS fail_criteria text,
  ADD COLUMN IF NOT EXISTS activity_type text CHECK (activity_type IS NULL OR activity_type IN ('course', 'book', 'exercise', 'project')),
  ADD COLUMN IF NOT EXISTS is_partner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expected_result text;

ALTER TABLE public.approved_roadmap_activities
  ADD COLUMN IF NOT EXISTS activity_type text CHECK (activity_type IS NULL OR activity_type IN ('course', 'book', 'exercise', 'project')),
  ADD COLUMN IF NOT EXISTS is_partner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS expected_result text;

UPDATE public.approved_roadmap_activities SET activity_type = 'exercise', expected_result = 'Nắm được kiến thức nền của nghề mục tiêu'
 WHERE title = 'Ôn kiến thức nền của nghề mục tiêu' AND activity_type IS NULL;
UPDATE public.approved_roadmap_activities SET activity_type = 'project', expected_result = 'Hoàn thành một sản phẩm nhỏ liên quan đến nghề'
 WHERE title = 'Thực hành một sản phẩm/mini project liên quan' AND activity_type IS NULL;
UPDATE public.approved_roadmap_activities SET activity_type = 'exercise', expected_result = 'Hiểu công việc thực tế của nghề'
 WHERE title = 'Phỏng vấn hoặc quan sát một người đang làm nghề' AND activity_type IS NULL;

-- 2. Tối đa 2 nghề mục tiêu cho mỗi lộ trình (BR-018); roadmaps.career_id là nghề chính ---------------
CREATE TABLE IF NOT EXISTS public.roadmap_target_careers (
  roadmap_id uuid NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  career_id uuid NOT NULL REFERENCES public.careers(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (roadmap_id, career_id)
);
ALTER TABLE public.roadmap_target_careers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads roadmap careers" ON public.roadmap_target_careers;
CREATE POLICY "Owner reads roadmap careers" ON public.roadmap_target_careers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.roadmaps r WHERE r.id = roadmap_id AND r.owner_id = auth.uid()));

INSERT INTO public.roadmap_target_careers (roadmap_id, career_id, sort_order)
SELECT id, career_id, 0 FROM public.roadmaps WHERE career_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Cảnh báo chệch hướng (BR-027) -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roadmap_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  roadmap_id uuid NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  delay_percent numeric NOT NULL DEFAULT 0,
  last_slot text,
  created_at timestamptz DEFAULT now() NOT NULL,
  cleared_at timestamptz,
  clear_reason text CHECK (clear_reason IS NULL OR clear_reason IN ('progress_updated', 'regenerated', 'recovered'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_roadmap_alerts_open ON public.roadmap_alerts(roadmap_id) WHERE cleared_at IS NULL;
ALTER TABLE public.roadmap_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads roadmap alerts" ON public.roadmap_alerts;
CREATE POLICY "Owner reads roadmap alerts" ON public.roadmap_alerts FOR SELECT TO authenticated USING (user_id = auth.uid());

DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.notifications'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%notification_type%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', c); END IF;
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_notification_type_check CHECK (notification_type IN (
    'new_submission', 'result_changed', 'result_finalized', 'link_expiring', 'class_update',
    'career_ranking_changed', 'decision_report_shared', 'decision_consensus', 'mentor_connection',
    'roadmap_off_track'));
END $$;

-- 4. Tham số vận hành (giá trị Demo, chờ PO chốt) -------------------------------------------------------
INSERT INTO public.operation_parameters (param_code, param_name, param_value)
SELECT v.c, v.n, v.val::jsonb
FROM (VALUES
  ('roadmap_soft_skill_low_percent', 'Ngưỡng % kỹ năng mềm cần rèn trước', '50'),
  ('roadmap_self_other_gap_percent', 'Độ lệch % giữa tự đánh giá và người khác coi là lớn', '20'),
  ('roadmap_off_track_percent', 'Ngưỡng chậm tiến độ (điểm phần trăm) để cảnh báo chệch hướng', '20')
) AS v(c, n, val)
WHERE NOT EXISTS (SELECT 1 FROM public.operation_parameters p WHERE p.param_code = v.c);

UPDATE public.operation_parameters SET srs_code = 'BR-026', verification_level = 'demo'
 WHERE param_code IN ('roadmap_soft_skill_low_percent', 'roadmap_self_other_gap_percent');
UPDATE public.operation_parameters SET srs_code = 'BR-027', verification_level = 'demo'
 WHERE param_code = 'roadmap_off_track_percent';

CREATE OR REPLACE FUNCTION public.roadmap_param(p_code text, p_default numeric)
RETURNS numeric LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE((SELECT (param_value #>> '{}')::numeric FROM public.operation_parameters WHERE param_code = p_code), p_default);
$$;

-- 5. Tính trạng thái tiến độ (cùng công thức với giao diện) ---------------------------------------------
-- % tổng thể = trung bình các trụ cột có hoạt động; % thời gian = phần thời gian đã trôi; chệch hướng khi
-- (% thời gian - % hoàn thành) lớn hơn ngưỡng hoặc có cột mốc quan trọng quá hạn mà chưa xong.
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
      SELECT sum(weight) FILTER (WHERE done) / NULLIF(sum(weight), 0) * 100 AS pct
        FROM public.roadmap_milestones WHERE roadmap_id = p_roadmap_id GROUP BY pillar
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

CREATE OR REPLACE FUNCTION public.clear_roadmap_alert(p_roadmap_id uuid, p_reason text)
RETURNS void LANGUAGE sql SET search_path = public AS $$
  UPDATE public.roadmap_alerts SET cleared_at = now(), clear_reason = p_reason
   WHERE roadmap_id = p_roadmap_id AND cleared_at IS NULL;
$$;

-- 6. Tạo lộ trình: thêm số giờ mỗi tuần, lý do tạo lại, lộ trình trước ----------------------------------
DROP FUNCTION IF EXISTS public.create_roadmap(uuid, text, date);
CREATE OR REPLACE FUNCTION public.create_roadmap(
  p_career_id uuid, p_title text, p_target_date date DEFAULT NULL,
  p_hours_per_week integer DEFAULT NULL, p_reason text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_prev uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;
  IF p_career_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.careers WHERE id = p_career_id) THEN
    RAISE EXCEPTION 'career_not_found';
  END IF;
  IF p_hours_per_week IS NOT NULL AND p_hours_per_week <= 0 THEN RAISE EXCEPTION 'hours_per_week'; END IF;
  IF p_reason IS NOT NULL AND p_reason NOT IN ('off_track', 'circumstances', 'career_changed', 'not_admitted') THEN
    RAISE EXCEPTION 'invalid_reason';
  END IF;
  -- BR-028: chỉ một lộ trình kích hoạt, bản cũ giữ làm lịch sử; BR-027: cảnh báo cũ tự xóa
  SELECT id INTO v_prev FROM public.roadmaps WHERE owner_id = auth.uid() AND is_active ORDER BY created_at DESC LIMIT 1;
  UPDATE public.roadmaps SET is_active = false WHERE owner_id = auth.uid() AND is_active;
  PERFORM public.clear_roadmap_alert(r.id, 'regenerated') FROM public.roadmaps r WHERE r.owner_id = auth.uid();
  INSERT INTO public.roadmaps (owner_id, career_id, title, target_date, hours_per_week, regenerate_reason, previous_roadmap_id)
  VALUES (auth.uid(), p_career_id, trim(p_title), p_target_date, p_hours_per_week, p_reason, v_prev)
  RETURNING id INTO v_id;
  IF p_career_id IS NOT NULL THEN
    INSERT INTO public.roadmap_target_careers (roadmap_id, career_id, sort_order) VALUES (v_id, p_career_id, 0);
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_roadmap_careers(p_roadmap_id uuid, p_career_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ids uuid[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmaps WHERE id = p_roadmap_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_ids FROM unnest(COALESCE(p_career_ids, '{}')) x;
  -- BR-018: tối đa 2 nghề mục tiêu
  IF cardinality(v_ids) < 1 OR cardinality(v_ids) > 2 THEN RAISE EXCEPTION 'careers_limit'; END IF;
  IF (SELECT count(*) FROM public.careers WHERE id = ANY (v_ids)) <> cardinality(v_ids) THEN RAISE EXCEPTION 'career_not_found'; END IF;
  DELETE FROM public.roadmap_target_careers WHERE roadmap_id = p_roadmap_id;
  INSERT INTO public.roadmap_target_careers (roadmap_id, career_id, sort_order)
  SELECT p_roadmap_id, u.id, u.ord - 1 FROM unnest(p_career_ids) WITH ORDINALITY AS u(id, ord) WHERE u.id = ANY (v_ids)
  ON CONFLICT DO NOTHING;
  UPDATE public.roadmaps SET career_id = p_career_ids[1] WHERE id = p_roadmap_id;
END;
$$;

-- 7. Thêm hoạt động / cột mốc ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.add_roadmap_milestone(uuid, text, text, date, numeric, boolean);
CREATE OR REPLACE FUNCTION public.add_roadmap_milestone(
  p_roadmap_id uuid, p_pillar text, p_title text,
  p_due_date date DEFAULT NULL, p_weight numeric DEFAULT 1, p_is_checkpoint boolean DEFAULT false,
  p_pass_criteria text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_pillar NOT IN ('knowledge', 'experience', 'exploration') THEN RAISE EXCEPTION 'invalid_pillar'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.roadmaps WHERE id = p_roadmap_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;
  IF COALESCE(p_weight, 1) <= 0 THEN RAISE EXCEPTION 'invalid_weight'; END IF;
  INSERT INTO public.roadmap_milestones (roadmap_id, pillar, title, due_date, weight, is_checkpoint, source, pass_criteria)
  VALUES (p_roadmap_id, p_pillar, trim(p_title), p_due_date, COALESCE(p_weight, 1), COALESCE(p_is_checkpoint, false), 'user',
          NULLIF(trim(COALESCE(p_pass_criteria, '')), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_roadmap_milestones_bulk(p_roadmap_id uuid, p_items jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item jsonb;
  v_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmaps WHERE id = p_roadmap_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    IF COALESCE(v_item->>'title', '') = '' THEN CONTINUE; END IF;
    IF COALESCE(v_item->>'pillar', '') NOT IN ('knowledge', 'experience', 'exploration') THEN
      RAISE EXCEPTION 'invalid_pillar';
    END IF;
    INSERT INTO public.roadmap_milestones
      (roadmap_id, pillar, title, due_date, weight, is_checkpoint, source, pass_criteria, fail_criteria, activity_type, is_partner, expected_result)
    VALUES (
      p_roadmap_id,
      v_item->>'pillar',
      trim(v_item->>'title'),
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

-- 8. Lưu tiến độ nhiều hoạt động một lần (FR07.01.12); cập nhật hoàn thành xóa cảnh báo (BR-027) ----------
CREATE OR REPLACE FUNCTION public.save_roadmap_progress(p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item jsonb;
  v_roadmap uuid;
  v_first uuid;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    UPDATE public.roadmap_milestones m SET
      done = COALESCE((v_item->>'done')::boolean, m.done),
      done_at = CASE WHEN COALESCE((v_item->>'done')::boolean, m.done) THEN COALESCE(m.done_at, now()) ELSE NULL END,
      note = CASE WHEN v_item ? 'note' THEN NULLIF(trim(v_item->>'note'), '') ELSE m.note END
     WHERE m.id = (v_item->>'id')::uuid
       AND EXISTS (SELECT 1 FROM public.roadmaps r WHERE r.id = m.roadmap_id AND r.owner_id = auth.uid() AND r.is_active)
    RETURNING m.roadmap_id INTO v_roadmap;
    IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_first := COALESCE(v_first, v_roadmap);
    v_count := v_count + 1;
  END LOOP;
  IF v_first IS NOT NULL THEN PERFORM public.clear_roadmap_alert(v_first, 'progress_updated'); END IF;
  RETURN jsonb_build_object('updated', v_count, 'status', public.roadmap_status(v_first));
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_roadmap_milestone(p_milestone_id uuid, p_done boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_roadmap uuid;
BEGIN
  UPDATE public.roadmap_milestones m SET
    done = p_done,
    done_at = CASE WHEN p_done THEN COALESCE(m.done_at, now()) ELSE NULL END
   WHERE m.id = p_milestone_id
     AND EXISTS (SELECT 1 FROM public.roadmaps r WHERE r.id = m.roadmap_id AND r.owner_id = auth.uid())
  RETURNING m.roadmap_id INTO v_roadmap;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public.clear_roadmap_alert(v_roadmap, 'progress_updated');
END;
$$;

-- 9. Sửa hạn hoạt động (FR07.01.11): p_apply = false chỉ trả về cột mốc bị ảnh hưởng -----------------------
-- Bị ảnh hưởng: cột mốc chưa xong có hạn nằm trong khoảng từ hạn cũ đến hạn mới (hoạt động nay kết thúc sau cột mốc).
CREATE OR REPLACE FUNCTION public.update_roadmap_milestone_due(p_milestone_id uuid, p_due_date date, p_apply boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m public.roadmap_milestones%ROWTYPE;
  v_conflicts jsonb := '[]'::jsonb;
BEGIN
  SELECT x.* INTO m FROM public.roadmap_milestones x
   WHERE x.id = p_milestone_id
     AND EXISTS (SELECT 1 FROM public.roadmaps r WHERE r.id = x.roadmap_id AND r.owner_id = auth.uid() AND r.is_active);
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_due_date IS NULL THEN RAISE EXCEPTION 'due_required'; END IF;

  IF m.due_date IS NOT NULL AND p_due_date > m.due_date THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'due_date', c.due_date) ORDER BY c.due_date), '[]'::jsonb)
      INTO v_conflicts
      FROM public.roadmap_milestones c
     WHERE c.roadmap_id = m.roadmap_id AND c.id <> m.id AND c.is_checkpoint AND NOT c.done
       AND c.due_date >= m.due_date AND c.due_date < p_due_date;
  END IF;

  IF p_apply THEN
    UPDATE public.roadmap_milestones SET due_date = p_due_date WHERE id = m.id;
  END IF;
  RETURN jsonb_build_object('applied', p_apply, 'previous_due', m.due_date, 'conflicts', v_conflicts);
END;
$$;

-- 10. Danh sách lộ trình ----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_my_roadmaps()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'title', r.title, 'career_id', r.career_id, 'career_name', c.career_name,
    'is_active', r.is_active, 'target_date', r.target_date, 'created_at', r.created_at,
    'education_level', r.education_level, 'school_year', r.school_year,
    'current_skills', r.current_skills, 'certificates', r.certificates, 'extracurricular', r.extracurricular,
    'hours_per_week', r.hours_per_week, 'regenerate_reason', r.regenerate_reason, 'previous_roadmap_id', r.previous_roadmap_id,
    'careers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', tc.career_id, 'name', k.career_name) ORDER BY tc.sort_order)
        FROM public.roadmap_target_careers tc JOIN public.careers k ON k.id = tc.career_id WHERE tc.roadmap_id = r.id
    ), '[]'::jsonb),
    'milestones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', m.id, 'pillar', m.pillar, 'title', m.title, 'done', m.done,
               'due_date', m.due_date, 'weight', m.weight, 'is_checkpoint', m.is_checkpoint,
               'note', m.note, 'done_at', m.done_at, 'source', m.source,
               'pass_criteria', m.pass_criteria, 'fail_criteria', m.fail_criteria,
               'activity_type', m.activity_type, 'is_partner', m.is_partner, 'expected_result', m.expected_result
             ) ORDER BY m.due_date NULLS LAST, m.created_at)
        FROM public.roadmap_milestones m WHERE m.roadmap_id = r.id
    ), '[]'::jsonb)
  ) ORDER BY r.is_active DESC, r.created_at DESC), '[]'::jsonb)
  FROM public.roadmaps r
  LEFT JOIN public.careers c ON c.id = r.career_id
  WHERE r.owner_id = auth.uid();
$$;

-- 11. Kỹ năng mềm G1–G7 cần rèn (BR-026) --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_roadmap_soft_skills()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH latest AS (
    SELECT id FROM public.assessment_results WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 1
  ),
  s AS (
    SELECT c.id AS criteria_id, c.name, g.group_code, g.name AS group_name, c.sort_order,
           max(sc.score_percent) FILTER (WHERE sc.score_source = 'combined_360') AS combined,
           max(sc.score_percent) FILTER (WHERE sc.score_source = 'self') AS self_score
      FROM latest
      JOIN public.assessment_result_scores sc ON sc.result_id = latest.id
      JOIN public.criteria c ON c.id = sc.criteria_id AND c.is_active
      JOIN public.criteria_groups g ON g.id = c.group_id
     WHERE g.group_code IN ('G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7')
     GROUP BY c.id, c.name, g.group_code, g.name, c.sort_order
  ),
  f AS (
    SELECT s.*, COALESCE(s.combined, s.self_score) AS overall,
           CASE WHEN s.combined IS NOT NULL AND s.self_score IS NOT NULL THEN abs(s.self_score - s.combined) END AS gap
      FROM s
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'criteria_id', f.criteria_id, 'name', f.name, 'group_name', f.group_name,
           'score_percent', round(f.overall, 1), 'self_percent', round(f.self_score, 1),
           'others_percent', round(f.combined, 1), 'gap', round(f.gap, 1),
           'reasons', to_jsonb(array_remove(ARRAY[
              CASE WHEN f.overall < public.roadmap_param('roadmap_soft_skill_low_percent', 50) THEN 'low' END,
              CASE WHEN f.gap >= public.roadmap_param('roadmap_self_other_gap_percent', 20) THEN 'gap' END
           ], NULL))
         ) ORDER BY f.overall NULLS LAST, f.sort_order), '[]'::jsonb)
    FROM f
   WHERE f.overall < public.roadmap_param('roadmap_soft_skill_low_percent', 50)
      OR f.gap >= public.roadmap_param('roadmap_self_other_gap_percent', 20);
$$;

-- 12. Trạng thái và cảnh báo hiện tại của lộ trình đang chạy ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_roadmap_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.roadmap_status(r.id) || jsonb_build_object('roadmap_id', r.id)
    FROM public.roadmaps r WHERE r.owner_id = auth.uid() AND r.is_active ORDER BY r.created_at DESC LIMIT 1;
$$;

-- 13. Trình giám sát: quét hằng ngày, nhắc tối đa 3 lần/ngày lúc 8h, 12h, 20h (giờ Việt Nam) -----------------------
CREATE OR REPLACE FUNCTION public.scan_roadmap_alerts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  s jsonb;
  v_open uuid;
  v_last text;
  v_reasons jsonb;
  v_body text;
  v_count integer := 0;
  v_now timestamp := now() AT TIME ZONE 'Asia/Ho_Chi_Minh';
  -- mỗi mốc nhắc là một khung 4 giờ để chạy lệch vài phút vẫn tính đúng mốc
  v_slot text := to_char(v_now, 'YYYY-MM-DD') || '-' || (CASE WHEN extract(hour FROM v_now) < 10 THEN '8' WHEN extract(hour FROM v_now) < 16 THEN '12' ELSE '20' END);
BEGIN
  FOR r IN SELECT id, owner_id FROM public.roadmaps WHERE is_active LOOP
    s := public.roadmap_status(r.id);
    SELECT id, last_slot INTO v_open, v_last FROM public.roadmap_alerts WHERE roadmap_id = r.id AND cleared_at IS NULL;
    IF (s->>'off_track')::boolean THEN
      v_reasons := (
        CASE WHEN (s->>'delay_percent')::numeric > public.roadmap_param('roadmap_off_track_percent', 20)
             THEN jsonb_build_array(jsonb_build_object('type', 'delay', 'delay_percent', s->'delay_percent')) ELSE '[]'::jsonb END
      ) || COALESCE((
        SELECT jsonb_agg(jsonb_build_object('type', 'missed_checkpoint', 'id', x->'id', 'title', x->'title'))
          FROM jsonb_array_elements(s->'missed_checkpoints') x
      ), '[]'::jsonb);
      IF v_open IS NULL THEN
        INSERT INTO public.roadmap_alerts (roadmap_id, user_id, reasons, delay_percent)
        VALUES (r.id, r.owner_id, v_reasons, (s->>'delay_percent')::numeric) RETURNING id INTO v_open;
      ELSE
        UPDATE public.roadmap_alerts SET reasons = v_reasons, delay_percent = (s->>'delay_percent')::numeric WHERE id = v_open;
      END IF;
      IF COALESCE(v_last, '') <> v_slot THEN
        v_body := concat_ws('. ',
          CASE WHEN (s->>'delay_percent')::numeric > public.roadmap_param('roadmap_off_track_percent', 20)
               THEN 'Chậm ' || round((s->>'delay_percent')::numeric) || ' điểm phần trăm so với kế hoạch' END,
          CASE WHEN jsonb_array_length(s->'missed_checkpoints') > 0
               THEN 'Trễ cột mốc quan trọng: ' || (SELECT string_agg(x->>'title', ', ') FROM jsonb_array_elements(s->'missed_checkpoints') x) END);
        PERFORM public.push_notification(r.owner_id, 'roadmap_off_track', 'Lộ trình đang chệch hướng', v_body,
          jsonb_build_object('roadmap_id', r.id, 'href', '/lo-trinh?tab=canh-bao'));
        UPDATE public.roadmap_alerts SET last_slot = v_slot WHERE id = v_open;
        v_count := v_count + 1;
      END IF;
    ELSIF v_open IS NOT NULL THEN
      PERFORM public.clear_roadmap_alert(r.id, 'recovered');
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- 01:00, 05:00, 13:00 UTC = 8h, 12h, 20h giờ Việt Nam
    PERFORM cron.schedule('roadmap-off-track-scan', '0 1,5,13 * * *', $job$SELECT public.scan_roadmap_alerts()$job$);
  ELSE
    RAISE NOTICE 'pg_cron chưa có: bật extension pg_cron rồi chạy lại migration này';
  END IF;
END $$;

-- 14. Quyền hàm -----------------------------------------------------------------------------------------------
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'create_roadmap(uuid, text, date, integer, text)',
    'set_roadmap_careers(uuid, uuid[])',
    'add_roadmap_milestone(uuid, text, text, date, numeric, boolean, text)',
    'add_roadmap_milestones_bulk(uuid, jsonb)',
    'save_roadmap_progress(jsonb)',
    'toggle_roadmap_milestone(uuid, boolean)',
    'update_roadmap_milestone_due(uuid, date, boolean)',
    'list_my_roadmaps()',
    'get_roadmap_soft_skills()',
    'get_my_roadmap_status()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  -- Hàm nội bộ và trình giám sát chỉ chạy bằng cron / các hàm khác
  FOREACH f IN ARRAY ARRAY[
    'roadmap_param(text, numeric)', 'roadmap_status(uuid)', 'clear_roadmap_alert(uuid, text)', 'scan_roadmap_alerts()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
  END IF;
END $$;
