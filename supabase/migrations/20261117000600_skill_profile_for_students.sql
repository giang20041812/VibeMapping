-- Hồ sơ năng lực và phân tích khoảng cách mở cho cả học sinh (student), không chỉ sinh viên (university_student)

DROP POLICY IF EXISTS "Owner manages skills" ON public.skill_profile_items;
CREATE POLICY "Owner manages skills" ON public.skill_profile_items FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('student', 'university_student'));

DROP POLICY IF EXISTS "Student saves skill gap analyses" ON public.skill_gap_analyses;
CREATE POLICY "Student saves skill gap analyses" ON public.skill_gap_analyses FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('student', 'university_student'));

CREATE OR REPLACE FUNCTION public.import_verified_soft_skills()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result uuid;
  v_final timestamptz;
  v_count integer;
BEGIN
  IF (SELECT role FROM public.user_profiles WHERE id = auth.uid()) NOT IN ('student', 'university_student') THEN RAISE EXCEPTION 'forbidden'; END IF;
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
