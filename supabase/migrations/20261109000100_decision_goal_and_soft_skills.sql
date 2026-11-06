-- Chuyển phương án ưu tiên thành nghề mục tiêu (FR06.03.04) và giới hạn kỹ năng mềm lấy từ 360° ở G2–G5.

-- Nghề mục tiêu = nghề của phương án ưu tiên. Giới hạn 2 nghề mục tiêu do trigger đã có (target_career_limit).
-- Báo cáo đã chia sẻ cho phụ huynh thì cần ít nhất một phụ huynh đồng thuận trước khi chốt (UI_06).
-- Giả định của dev: chưa chia sẻ cho phụ huynh nào thì vẫn được chốt.
CREATE OR REPLACE FUNCTION public.set_decision_goal(p_plan_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan public.comparison_plans;
  v_career uuid;
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_plan FROM public.comparison_plans WHERE id = p_plan_id AND owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_plan.preferred_option_id IS NULL THEN RAISE EXCEPTION 'no_preferred_option'; END IF;
  SELECT NULLIF(o ->> 'careerId', '')::uuid INTO v_career
    FROM jsonb_array_elements(COALESCE(v_plan.options, '[]'::jsonb)) o
   WHERE o ->> 'id' = v_plan.preferred_option_id LIMIT 1;
  IF v_career IS NULL OR NOT EXISTS (SELECT 1 FROM public.careers WHERE id = v_career) THEN RAISE EXCEPTION 'option_without_career'; END IF;
  IF EXISTS (SELECT 1 FROM public.decision_report_shares s JOIN public.decision_reports r ON r.id = s.report_id WHERE r.plan_id = p_plan_id)
     AND NOT EXISTS (SELECT 1 FROM public.decision_report_shares s JOIN public.decision_reports r ON r.id = s.report_id
                      WHERE r.plan_id = p_plan_id AND s.consensus_at IS NOT NULL) THEN
    RAISE EXCEPTION 'consensus_required';
  END IF;
  PERFORM public.save_career_bookmark(v_career, 'target');
  SELECT career_name INTO v_name FROM public.careers WHERE id = v_career;
  INSERT INTO public.decision_history (owner_id, plan_id, action, note) VALUES (auth.uid(), p_plan_id, 'goal_set', v_name);
  RETURN v_career;
END;
$$;
REVOKE ALL ON FUNCTION public.set_decision_goal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_decision_goal(uuid) TO authenticated;

-- Kỹ năng mềm lấy từ kết quả Cuối cùng 360° chỉ gồm G2–G5 (bảng kỹ năng mềm của hồ sơ năng lực)
CREATE OR REPLACE FUNCTION public.import_verified_soft_skills()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result uuid;
  v_final timestamptz;
  v_count integer;
BEGIN
  IF (SELECT role FROM public.user_profiles WHERE id = auth.uid()) <> 'university_student' THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT id, finalized_at INTO v_result, v_final FROM public.assessment_results
   WHERE user_id = auth.uid() AND status_label = 'final_360' ORDER BY finalized_at DESC LIMIT 1;
  IF v_result IS NULL THEN RAISE EXCEPTION 'no_final_360'; END IF;
  PERFORM set_config('app.skill_import', '1', true);
  DELETE FROM public.skill_profile_items WHERE owner_id = auth.uid() AND verified_360;
  INSERT INTO public.skill_profile_items (owner_id, kind, title, criteria_id, self_level, verified_360, verified_until, evidence)
  SELECT auth.uid(), 'soft_skill', c.name, c.id, GREATEST(1, LEAST(5, round(sc.score_1_5)))::smallint, true,
         (v_final + make_interval(months => public.param_num('result_validity_months', 12)::integer))::date,
         'Từ kết quả Cuối cùng 360°'
    FROM public.assessment_result_scores sc
    JOIN public.criteria c ON c.id = sc.criteria_id
    JOIN public.criteria_groups g ON g.id = c.group_id
   WHERE sc.result_id = v_result AND sc.score_source = 'combined_360' AND g.group_code IN ('G2','G3','G4','G5')
     AND sc.score_1_5 IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM set_config('app.skill_import', '0', true);
  RETURN v_count;
END;
$$;
