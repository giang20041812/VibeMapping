-- Nối engine tính điểm vào thư viện công thức: các điểm tính dưới đây gọi formula_apply_*,
-- công thức chưa bị thay thì trả đúng kết quả cũ. Các hàm được chép nguyên từ bản trước, chỉ thêm lời gọi.

-- 1. Hàm tính từng bước dùng chung -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calc_rater_weight(p_th_score numeric, p_supplemental numeric, p_floor numeric, p_default numeric)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_th numeric;
BEGIN
  v_th := public.formula_apply_num('th_percent',
    GREATEST((COALESCE(p_th_score, 3) - 3) / 9.0 * 100, p_floor),
    jsonb_build_object('th_score', COALESCE(p_th_score, 3)));
  RETURN public.formula_apply_num('rater_weight',
    v_th * COALESCE(p_supplemental, p_default),
    jsonb_build_object('unreviewed_supplemental_default', p_default),
    jsonb_build_object('th_percent', v_th, 'supplemental_score', p_supplemental));
END;
$$;

CREATE OR REPLACE FUNCTION public.calc_criterion_percent(p_score numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.formula_apply_num('criterion_percent', p_score / 5 * 100, '{}'::jsonb,
                                  jsonb_build_object('criterion_score_360', p_score));
$$;

CREATE OR REPLACE FUNCTION public.calc_competency_level(p_percent numeric, p_levels jsonb)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.formula_apply_label('competency_level',
    CASE WHEN p_percent >= (p_levels ->> 'very_high')::numeric THEN 'very_high'
         WHEN p_percent >= (p_levels ->> 'high')::numeric THEN 'high'
         WHEN p_percent >= (p_levels ->> 'medium')::numeric THEN 'medium'
         ELSE 'low' END,
    '{"Rất cao":"very_high","Cao":"high","Trung bình":"medium","Thấp":"low"}'::jsonb,
    '{}'::jsonb, jsonb_build_object('criterion_percent', p_percent));
$$;

CREATE OR REPLACE FUNCTION public.calc_confidence(p_native text, p_coverage numeric, p_insufficient_ratio numeric)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.formula_apply_label('confidence', p_native,
    '{"Cao":"high","Trung bình":"medium","Thấp":"low"}'::jsonb,
    jsonb_build_object('insufficient_ratio', p_insufficient_ratio),
    jsonb_build_object('coverage', p_coverage));
$$;

REVOKE ALL ON FUNCTION public.calc_rater_weight(numeric, numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calc_criterion_percent(numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calc_competency_level(numeric, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calc_confidence(text, numeric, numeric) FROM PUBLIC, anon, authenticated;

-- 2. Điểm hiểu biết bổ sung ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.supplemental_understanding_score(
  p_group public.rater_group, p_ea smallint[], p_solo smallint[], p_carkhuff numeric
) RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ea numeric;
  v_solo numeric;
  v_carkhuff numeric;
  v_native numeric;
  v_label text;
BEGIN
  IF p_group = 'self' THEN RAISE EXCEPTION 'self_has_no_supplemental_score'; END IF;
  IF p_ea IS NULL OR array_length(p_ea, 1) <> 4 OR EXISTS (SELECT 1 FROM unnest(p_ea) v WHERE v < 0 OR v > 2) THEN
    RAISE EXCEPTION 'invalid_ea';
  END IF;
  IF p_solo IS NULL OR array_length(p_solo, 1) <> 4 OR EXISTS (SELECT 1 FROM unnest(p_solo) v WHERE v < 1 OR v > 5) THEN
    RAISE EXCEPTION 'invalid_solo';
  END IF;
  v_ea := public.formula_apply_num('ea_percent', (SELECT sum(v) FROM unnest(p_ea) v) / 8.0 * 100,
    '{}'::jsonb, '{}'::jsonb,
    jsonb_build_object('ea_items', (SELECT jsonb_agg(jsonb_build_object('ea_item', v)) FROM unnest(p_ea) v)));
  v_solo := public.formula_apply_num('solo_percent', (SELECT sum(v) FROM unnest(p_solo) v) / 20.0 * 100,
    '{}'::jsonb, '{}'::jsonb,
    jsonb_build_object('solo_items', (SELECT jsonb_agg(jsonb_build_object('solo_item', v)) FROM unnest(p_solo) v)));
  IF p_group <> 'friend' THEN
    IF p_carkhuff IS NULL OR p_carkhuff < 1 OR p_carkhuff > 5 THEN RAISE EXCEPTION 'invalid_carkhuff'; END IF;
    v_carkhuff := public.formula_apply_num('carkhuff_percent', p_carkhuff / 5.0 * 100,
      jsonb_build_object('carkhuff_score', p_carkhuff));
  END IF;
  v_native := CASE p_group
    WHEN 'friend' THEN 0.7 * v_ea + 0.3 * v_solo
    WHEN 'parent' THEN 0.5 * v_ea + 0.25 * v_solo + 0.25 * v_carkhuff
    WHEN 'teacher' THEN 0.4 * v_ea + 0.4 * v_solo + 0.2 * v_carkhuff
    ELSE 0.35 * v_ea + 0.35 * v_solo + 0.3 * v_carkhuff END;
  v_label := CASE p_group WHEN 'parent' THEN 'Phụ huynh' WHEN 'friend' THEN 'Bạn bè'
                          WHEN 'teacher' THEN 'Giáo viên' ELSE 'Mentor' END;
  RETURN public.formula_apply_num('supplemental_score', v_native,
    jsonb_build_object('rater_group', v_label),
    jsonb_build_object('ea_percent', v_ea, 'solo_percent', v_solo, 'carkhuff_percent', v_carkhuff));
END;
$$;

-- 3. Nộp bài 360: chỉ số tin cậy ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_360(p_resume_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_360_submissions;
  l public.invitation_links;
  v_required uuid[];
  v_answered uuid[];
  v_missing uuid[];
  v_seconds integer;
  v_n_questions integer;
  v_scored integer;
  v_na integer;
  v_total integer;
  v_most_common integer;
  v_t numeric;
  v_d numeric := 1;
  v_a numeric;
  v_p numeric := 0;
  v_trust numeric;
  v_min_criteria integer := public.param_num('trust_min_criteria', 7)::integer;
  v_force_reject boolean := false;
  v_flag text := 'ok';
  v_label text;
BEGIN
  SELECT * INTO s FROM public.assessment_360_submissions WHERE resume_token = p_resume_token FOR UPDATE;
  IF NOT FOUND OR s.status <> 'draft' THEN RAISE EXCEPTION 'submission_not_editable'; END IF;
  SELECT * INTO l FROM public.invitation_links WHERE id = s.invitation_link_id;
  IF l.revoked_at IS NOT NULL OR l.expires_at <= now() THEN RAISE EXCEPTION 'invitation_unavailable'; END IF;

  SELECT array_agg((x ->> 'question_id')::uuid) INTO v_required
    FROM jsonb_array_elements(public.get_360_questions(p_resume_token)) x;
  SELECT array_agg(question_id) INTO v_answered FROM public.assessment_360_answers WHERE submission_id = s.id;
  SELECT array_agg(q) INTO v_missing
    FROM unnest(COALESCE(v_required, ARRAY[]::uuid[])) q
   WHERE q <> ALL (COALESCE(v_answered, ARRAY[]::uuid[]));
  IF v_missing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_answers', 'missing_question_ids', to_jsonb(v_missing));
  END IF;

  -- T: thời gian làm thực / (số câu x thời gian tối thiểu mỗi câu). Chưa đo được quãng bỏ máy nên dùng tổng thời gian.
  v_seconds := extract(epoch FROM (now() - s.started_at))::integer;
  v_n_questions := COALESCE(array_length(v_required, 1), 0);
  v_t := CASE WHEN v_n_questions = 0 THEN 1
              ELSE LEAST(v_seconds::numeric / (v_n_questions * public.param_num('trust_seconds_per_question', 3)), 1) END;

  SELECT count(*) FILTER (WHERE score IS NOT NULL), count(*) FILTER (WHERE is_insufficient_basis), count(*)
    INTO v_scored, v_na, v_total
    FROM public.assessment_360_answers WHERE submission_id = s.id;

  -- D: độ phân tán; p = tỷ lệ tiêu chí cùng mức điểm phổ biến nhất
  IF v_scored >= v_min_criteria THEN
    SELECT max(c) INTO v_most_common FROM (
      SELECT count(*) AS c FROM public.assessment_360_answers
       WHERE submission_id = s.id AND score IS NOT NULL GROUP BY score) t;
    v_p := v_most_common::numeric / v_scored;
    v_d := LEAST((1 - v_p) / public.param_num('trust_dispersion_coefficient', 0.3), 1);
  END IF;

  v_a := CASE WHEN v_total = 0 THEN 1 ELSE 1 - v_na::numeric / v_total END;

  v_t := public.formula_apply_num('trust_time_ratio', v_t,
    jsonb_build_object('n_questions', v_n_questions), jsonb_build_object('trust_effective_seconds', v_seconds));
  v_d := public.formula_apply_num('trust_dispersion', v_d,
    jsonb_build_object('valid_count', v_scored, 'same_share', v_p));
  v_a := public.formula_apply_num('trust_answer_ratio', v_a,
    jsonb_build_object('na_count', v_na, 'n_questions', v_total));
  v_trust := public.formula_apply_num('trust_index', (v_t + v_d + v_a) / 3 * 100, '{}'::jsonb,
    jsonb_build_object('trust_time_ratio', v_t, 'trust_dispersion', v_d, 'trust_answer_ratio', v_a)) / 100;

  -- Luôn "Đề xuất loại": mọi tiêu chí cùng một mức (đủ số tiêu chí), hoặc làm quá nhanh
  v_force_reject := (v_scored >= v_min_criteria AND v_p = 1) OR v_t < public.param_num('trust_min_time_ratio', 0.5);
  v_flag := CASE WHEN v_t < public.param_num('trust_min_time_ratio', 0.5) AND v_scored >= v_min_criteria AND v_p = 1 THEN 'both'
                 WHEN v_t < public.param_num('trust_min_time_ratio', 0.5) THEN 'too_fast'
                 WHEN v_scored >= v_min_criteria AND v_p = 1 THEN 'uniform_scores' ELSE 'ok' END;
  v_label := CASE WHEN v_force_reject OR v_trust < public.param_num('trust_label_consider', 0.4) THEN 'suggest_reject'
                  WHEN v_trust >= public.param_num('trust_label_trusted', 0.7) THEN 'trusted'
                  ELSE 'consider' END;
  v_label := public.formula_apply_label('trust_label', v_label,
    '{"Tin cậy":"trusted","Cần cân nhắc":"consider","Đề xuất loại":"suggest_reject"}'::jsonb,
    jsonb_build_object('same_share', v_p, 'valid_count', v_scored),
    jsonb_build_object('trust_time_ratio', v_t, 'trust_index', v_trust * 100));

  UPDATE public.assessment_360_submissions
     SET status = 'pending', quality_flag = v_flag, trust_index = round(v_trust * 100, 2), trust_label = v_label,
         completion_seconds = v_seconds, submitted_at = now()
   WHERE id = s.id;

  PERFORM public.push_notification(s.subject_user_id, 'new_submission', 'Có bài đánh giá mới',
    NULL, jsonb_build_object('submission_id', s.id, 'rater_group', s.rater_group));
  PERFORM public.write_audit_log(NULL, s.subject_user_id, 'submit_360', 'assessment_360_submissions', s.id,
    jsonb_build_object('quality_flag', v_flag, 'trust_label', v_label));

  RETURN jsonb_build_object('ok', true, 'quality_flag', v_flag, 'trust_label', v_label,
                            'trust_index', round(v_trust * 100, 2));
END;
$$;

-- 4. Tính lại kết quả -----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_result(p_result_id uuid, p_finalizing boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.assessment_results;
  p3 numeric := public.param_num('self_weight', 0.5);
  p26 integer := public.param_num('min_submissions_group_display', 2)::integer;
  p27 integer := public.param_num('min_submissions_other_display', 2)::integer;
  v_levels jsonb := COALESCE(public.get_parameter('competency_levels'), '{"very_high":80,"high":65,"medium":50}'::jsonb);
  v_warn_ratio numeric := public.param_num('insufficient_basis_warning_ratio', 0.4);
  v_prev_final timestamptz;
  v_accepted integer;
  v_groups integer;
  v_expected integer;
  v_total_criteria integer;
  v_null_criteria integer;
  v_weight_sum numeric := 0;
  v_weight_status text;
  v_label public.result_status_label;
  v_s_default numeric := CASE
    WHEN public.get_parameter('unreviewed_supplemental_default') IS NULL THEN 100
    WHEN jsonb_typeof(public.get_parameter('unreviewed_supplemental_default')) = 'null' THEN NULL
    ELSE public.param_num('unreviewed_supplemental_default', 100) END;
  v_th_floor numeric := public.param_num('understanding_percent_floor', 0);
  v_equal_fallback boolean := COALESCE((public.get_parameter('zero_weight_equal_fallback') #>> '{}')::boolean, true);
BEGIN
  SELECT * INTO r FROM public.assessment_results WHERE id = p_result_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'result_not_found'; END IF;
  IF r.finalized_at IS NOT NULL AND NOT p_finalizing THEN RETURN; END IF;

  PERFORM set_config('app.internal_write', '1', true);

  SELECT max(finalized_at) INTO v_prev_final
    FROM public.assessment_results WHERE user_id = r.user_id AND id <> r.id AND finalized_at IS NOT NULL;

  DELETE FROM public.assessment_result_weights WHERE result_id = r.id;
  DELETE FROM public.assessment_result_scores WHERE result_id = r.id;
  DELETE FROM public.assessment_result_group_scores WHERE result_id = r.id;

  CREATE TEMP TABLE IF NOT EXISTS _calc_base (
    submission_id uuid, rater_group text, w numeric
  ) ON COMMIT DROP;
  TRUNCATE _calc_base;
  INSERT INTO _calc_base
  SELECT s2.id, s2.rater_group::text,
         public.calc_rater_weight(s2.understanding_score, s2.understanding_quality_score, v_th_floor, v_s_default)
    FROM public.assessment_360_submissions s2
   WHERE s2.subject_user_id = r.user_id AND s2.status = 'accepted'
     AND s2.decided_at > COALESCE(v_prev_final, '-infinity'::timestamptz)
     AND (s2.understanding_quality_score IS NOT NULL OR v_s_default IS NOT NULL);

  SELECT COALESCE(SUM(w), 0) INTO v_weight_sum FROM _calc_base;
  SELECT count(*) INTO v_accepted
    FROM public.assessment_360_submissions s2
   WHERE s2.subject_user_id = r.user_id AND s2.status = 'accepted'
     AND s2.decided_at > COALESCE(v_prev_final, '-infinity'::timestamptz);

  v_weight_status := CASE
    WHEN v_accepted = 0 THEN 'not_applicable'
    WHEN v_weight_sum > 0 THEN 'included'
    WHEN EXISTS (SELECT 1 FROM _calc_base) AND v_equal_fallback THEN 'equal_fallback'
    ELSE 'pending_review'
  END;
  IF v_weight_status = 'equal_fallback' THEN
    UPDATE _calc_base SET w = 1;
    v_weight_sum := (SELECT count(*) FROM _calc_base);
  END IF;
  SELECT count(DISTINCT rater_group) INTO v_groups FROM _calc_base WHERE w > 0;

  IF v_weight_sum > 0 THEN
    INSERT INTO public.assessment_result_weights (result_id, submission_id, weight)
    SELECT r.id, b.submission_id, round(b.w / v_weight_sum * (1 - p3), 6)
      FROM _calc_base b WHERE b.w > 0;
  END IF;

  WITH self_rs AS (
    SELECT a.criteria_id, avg(a.score)::numeric AS rs
      FROM public.assessment_answers a WHERE a.session_id = r.session_id AND a.score IS NOT NULL
     GROUP BY a.criteria_id
  ), sub_rs AS (
    SELECT b.submission_id, b.rater_group, b.w, a.criteria_id, avg(a.score)::numeric AS rs
      FROM _calc_base b
      JOIN public.assessment_360_answers a ON a.submission_id = b.submission_id AND a.score IS NOT NULL
     WHERE b.w > 0
     GROUP BY b.submission_id, b.rater_group, b.w, a.criteria_id
  ), ext AS (
    SELECT criteria_id, rater_group, rs,
           (w / SUM(w) OVER (PARTITION BY criteria_id)) * (1 - p3) AS ww
      FROM sub_rs
  ), combined AS (
    SELECT criteria_id, SUM(w * rs) / NULLIF(SUM(w), 0) AS score
      FROM (SELECT criteria_id, p3 AS w, rs FROM self_rs
            UNION ALL SELECT criteria_id, ww, rs FROM ext) x
     GROUP BY criteria_id
  ), src AS (
    SELECT s.criteria_id, s.rs, s.w, s.submission_id,
           CASE WHEN g.n >= p26 THEN s.rater_group ELSE 'others' END AS source
      FROM sub_rs s JOIN (SELECT rater_group, count(*) AS n FROM _calc_base WHERE w > 0 GROUP BY rater_group) g
        ON g.rater_group = s.rater_group
  ), src_cnt AS (
    SELECT CASE WHEN g.n >= p26 THEN b.rater_group ELSE 'others' END AS source, count(*) AS cnt
      FROM _calc_base b JOIN (SELECT rater_group, count(*) AS n FROM _calc_base WHERE w > 0 GROUP BY rater_group) g
        ON g.rater_group = b.rater_group
     WHERE b.w > 0
     GROUP BY 1
  ), group_scores AS (
    SELECT s.criteria_id, s.source AS score_source, SUM(s.rs * s.w) / NULLIF(SUM(s.w), 0) AS score
      FROM src s JOIN src_cnt c ON c.source = s.source
     WHERE c.cnt >= CASE WHEN s.source = 'others' THEN p27 ELSE p26 END
     GROUP BY s.criteria_id, s.source
  ), all_scores AS (
    SELECT criteria_id, 'self'::text AS score_source, rs AS score FROM self_rs
    UNION ALL SELECT criteria_id, score_source, score FROM group_scores
    UNION ALL SELECT criteria_id, 'combined_360', score FROM combined WHERE v_weight_sum > 0
  )
  INSERT INTO public.assessment_result_scores (result_id, criteria_id, score_source, score_1_5, score_percent, competency_level)
  SELECT r.id, criteria_id, score_source, round(score, 3), round(public.calc_criterion_percent(score), 2),
         public.calc_competency_level(public.calc_criterion_percent(score), v_levels)
    FROM all_scores WHERE score IS NOT NULL;

  INSERT INTO public.assessment_result_group_scores (result_id, group_id, score_source, score_1_5, score_percent, competency_level)
  SELECT r.id, c.group_id, sc.score_source, round(avg(sc.score_1_5), 3), round(avg(sc.score_1_5) / 5 * 100, 2),
         public.calc_competency_level(avg(sc.score_1_5) / 5 * 100, v_levels)
    FROM public.assessment_result_scores sc JOIN public.criteria c ON c.id = sc.criteria_id
   WHERE sc.result_id = r.id AND sc.score_source IN ('self', 'combined_360')
   GROUP BY c.group_id, sc.score_source;

  SELECT COALESCE(sum(l.expected_count), 0) INTO v_expected
    FROM public.invitation_links l WHERE l.user_id = r.user_id AND l.revoked_at IS NULL;

  SELECT count(*) INTO v_total_criteria FROM public.criteria WHERE is_active;
  SELECT count(*) INTO v_null_criteria FROM public.criteria c
   WHERE c.is_active AND NOT EXISTS (
     SELECT 1 FROM public.assessment_result_scores sc
      WHERE sc.result_id = r.id AND sc.criteria_id = c.id
        AND sc.score_source = CASE WHEN v_weight_sum > 0 THEN 'combined_360' ELSE 'self' END);

  -- Coverage: tử và mẫu đều là nhóm vai trò trên ma trận hiển thị.
  -- Nhóm chưa chấm S_i hoặc trọng số 0 không tính vào tử số.
  UPDATE public.assessment_result_scores sc SET
    coverage = round(LEAST(cv.valid_groups::numeric / GREATEST(cv.expected, 1), 1), 3),
    confidence = CASE
      WHEN v_total_criteria > 0 AND v_null_criteria::numeric / v_total_criteria > v_warn_ratio THEN 'low'
      WHEN cv.valid_groups::numeric / GREATEST(cv.expected, 1) >= public.param_num('confidence_high_coverage', 0.8) THEN 'high'
      WHEN cv.valid_groups::numeric / GREATEST(cv.expected, 1) >= public.param_num('confidence_medium_coverage', 0.6) THEN 'medium'
      ELSE 'low' END
  FROM (
    SELECT c.id AS criteria_id,
           (SELECT count(*) FROM public.criteria_rater_visibility v WHERE v.criteria_id = c.id AND v.is_visible) AS expected,
           (SELECT CASE WHEN count(*) > 0 THEN 1 ELSE 0 END FROM public.assessment_answers a
             WHERE a.session_id = r.session_id AND a.criteria_id = c.id AND a.score IS NOT NULL)
           + (SELECT count(DISTINCT b.rater_group) FROM _calc_base b
               JOIN public.assessment_360_answers a ON a.submission_id = b.submission_id
                AND a.criteria_id = c.id AND a.score IS NOT NULL
              WHERE b.w > 0) AS valid_groups
      FROM public.criteria c WHERE c.is_active
  ) cv
  WHERE sc.result_id = r.id AND sc.criteria_id = cv.criteria_id
    AND sc.score_source = CASE WHEN v_weight_sum > 0 THEN 'combined_360' ELSE 'self' END;

  -- Trigger apply_person_coverage ghi lại độ phủ và độ tin cậy theo số người chấm; công thức độ tin cậy
  -- bị thay thì áp dụng sau trigger, trên độ phủ đã lưu. Cột confidence không kích hoạt lại trigger.
  IF public.formula_is_live('confidence') THEN
    UPDATE public.assessment_result_scores sc SET
      confidence = public.calc_confidence(sc.confidence, sc.coverage,
        CASE WHEN v_total_criteria > 0 THEN v_null_criteria::numeric / v_total_criteria ELSE 0 END)
     WHERE sc.result_id = r.id AND sc.score_source IN ('self', 'combined_360') AND sc.coverage IS NOT NULL;
  END IF;

  v_label := CASE WHEN p_finalizing THEN 'final_360'
                  WHEN v_accepted > 0 THEN 'temporary' ELSE 'self_assessment' END;

  UPDATE public.assessment_results SET
    status_label = v_label, accepted_count = v_accepted, expected_count = v_expected, groups_count = v_groups,
    thin_data_flag = (v_accepted = 1),
    insufficient_basis_warning = (v_total_criteria > 0 AND v_null_criteria::numeric / v_total_criteria > v_warn_ratio),
    qualitative_weight_status = v_weight_status,
    calculated_at = now()
  WHERE id = r.id;

  INSERT INTO public.assessment_result_snapshots (result_id, user_id, status_label, snapshot_data)
  SELECT r.id, r.user_id, v_label, jsonb_build_object(
    'parameters', jsonb_build_object('self_weight', p3, 'competency_levels', v_levels,
                                     'min_submissions_group_display', p26, 'min_submissions_other_display', p27),
    'framework_version_id', r.framework_version_id,
    'accepted_count', v_accepted,
    'qualitative_weight_status', v_weight_status,
    'coverage_unit', 'rater_group',
    'versions', jsonb_build_object(
      'framework', (SELECT version_code FROM public.framework_versions WHERE id = r.framework_version_id),
      'question_bank', COALESCE(public.get_parameter('question_bank_version') #>> '{}', 'CH-1.0'),
      'parameters', COALESCE(public.get_parameter('parameter_book_version') #>> '{}', 'TS-1.0'),
      'career_matrix', (SELECT version_code FROM public.career_matrix_versions WHERE is_current)),
    'parameter_snapshot', COALESCE((SELECT jsonb_object_agg(param_code, param_value)
                                      FROM public.operation_parameters WHERE is_current), '{}'::jsonb),
    'weights', COALESCE((SELECT jsonb_agg(jsonb_build_object('submission_id', w.submission_id, 'weight', w.weight))
                           FROM public.assessment_result_weights w WHERE w.result_id = r.id), '[]'::jsonb),
    'scores', COALESCE((SELECT jsonb_agg(jsonb_build_object('criteria_id', sc.criteria_id, 'source', sc.score_source,
                                         'score_1_5', sc.score_1_5, 'score_percent', sc.score_percent, 'level', sc.competency_level,
                                         'coverage', sc.coverage, 'confidence', sc.confidence))
                          FROM public.assessment_result_scores sc WHERE sc.result_id = r.id), '[]'::jsonb),
    'group_scores', COALESCE((SELECT jsonb_agg(jsonb_build_object('group_id', gs.group_id, 'source', gs.score_source,
                                         'score_1_5', gs.score_1_5, 'score_percent', gs.score_percent, 'level', gs.competency_level))
                          FROM public.assessment_result_group_scores gs WHERE gs.result_id = r.id), '[]'::jsonb));
END;
$$;

-- 5. Trạng thái tiến độ lộ trình -------------------------------------------------------------------------
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
        FROM public.roadmap_milestones WHERE roadmap_id = p_roadmap_id GROUP BY pillar
    ) p WHERE p.pct IS NOT NULL;

  IF public.formula_is_live('roadmap_actual_percent') THEN
    v_actual := COALESCE(round(public.formula_apply_num('roadmap_actual_percent', v_actual, '{}'::jsonb, '{}'::jsonb,
      jsonb_build_object('pillars', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('roadmap_pillar_percent', q.pct))
          FROM (SELECT COALESCE(sum(weight) FILTER (WHERE done), 0) / NULLIF(sum(weight), 0) * 100 AS pct
                  FROM public.roadmap_milestones WHERE roadmap_id = p_roadmap_id GROUP BY pillar) q), '[]'::jsonb))), 1), 0);
  END IF;

  IF v_target IS NOT NULL THEN
    v_planned := CASE
      WHEN v_target <= v_start THEN 100
      ELSE round(greatest(0, least(1, (v_today - v_start)::numeric / (v_target - v_start))) * 100, 1)
    END;
    v_planned := round(public.formula_apply_num('roadmap_planned_percent', v_planned,
      jsonb_build_object('elapsed_days', v_today - v_start, 'total_days', v_target - v_start)), 1);
  END IF;
  IF v_total > 0 THEN
    v_delay := round(public.formula_apply_num('roadmap_delay', greatest(0, v_planned - v_actual), '{}'::jsonb,
      jsonb_build_object('roadmap_planned_percent', v_planned, 'roadmap_actual_percent', v_actual)), 1);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'title', title) ORDER BY due_date), '[]'::jsonb) INTO v_missed
    FROM public.roadmap_milestones
   WHERE roadmap_id = p_roadmap_id AND is_checkpoint AND NOT done AND due_date IS NOT NULL AND due_date < v_today;

  RETURN jsonb_build_object(
    'actual_percent', v_actual,
    'planned_percent', v_planned,
    'delay_percent', v_delay,
    'missed_checkpoints', v_missed,
    'off_track', public.formula_apply_label('roadmap_off_track',
      CASE WHEN v_delay > v_limit OR jsonb_array_length(v_missed) > 0 THEN 'true' ELSE 'false' END,
      '{"Chệch hướng":"true","Đúng hướng":"false"}'::jsonb,
      jsonb_build_object('missed_checkpoints', jsonb_array_length(v_missed)),
      jsonb_build_object('roadmap_delay', v_delay)) = 'true'
  );
END;
$$;
