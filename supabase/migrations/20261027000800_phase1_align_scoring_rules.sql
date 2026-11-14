-- ====================================================================
-- Phase 1 / Migration 8: Đồng bộ với quy tắc tính điểm (Scoring Rule) của tài liệu đặc tả
-- R02B trọng số bài w = TH% x S | R03 chuẩn hóa trọng số theo từng tiêu chí | R04 điểm nhóm
-- R14 chỉ số tin cậy | R21 ngưỡng ẩn danh nhóm | P07 số câu mỗi tiêu chí của người được mời
-- ====================================================================

-- 1. Tham số vận hành (P05, P07-P13, P26, P27, P39) -------------------------------
INSERT INTO public.operation_parameters (param_code, param_name, param_value)
SELECT v.c, v.n, v.val::jsonb
FROM (VALUES
  ('trust_seconds_per_question', 'Thời gian tối thiểu mỗi câu (giây)', '3'),
  ('trust_idle_gap_seconds', 'Quãng bỏ máy không tính vào thời gian (giây)', '120'),
  ('trust_dispersion_coefficient', 'Hệ số phân tán D', '0.3'),
  ('trust_min_criteria', 'Số tiêu chí tối thiểu để xét D', '7'),
  ('trust_label_trusted', 'Ngưỡng nhãn Tin cậy', '0.7'),
  ('trust_label_consider', 'Ngưỡng nhãn Cần cân nhắc', '0.4'),
  ('trust_min_time_ratio', 'T tối thiểu', '0.5'),
  ('invitee_questions_per_criterion', 'Số câu mỗi tiêu chí của người được mời', '1'),
  ('min_submissions_group_display', 'Số bài tối thiểu để hiện điểm nhóm người chấm', '2'),
  ('min_submissions_other_display', 'Số bài tối thiểu của nhóm Người khác', '2'),
  ('min_accepted_to_finalize', 'Số bài tối thiểu để cho phép chốt', '1'),
  ('confidence_high_coverage', 'Ngưỡng độ tin cậy mức Cao (Coverage)', '0.8'),
  ('confidence_medium_coverage', 'Ngưỡng độ tin cậy mức Trung bình (Coverage)', '0.6')
) AS v(c, n, val)
WHERE NOT EXISTS (SELECT 1 FROM public.operation_parameters p WHERE p.param_code = v.c);

CREATE OR REPLACE FUNCTION public.param_num(p_code text, p_default numeric)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v jsonb;
BEGIN
  SELECT param_value INTO v FROM public.operation_parameters WHERE param_code = p_code AND is_current;
  IF v IS NULL OR jsonb_typeof(v) <> 'number' THEN RETURN p_default; END IF;
  RETURN (v #>> '{}')::numeric;
END;
$$;
REVOKE ALL ON FUNCTION public.param_num(text, numeric) FROM PUBLIC;

-- 2. Cột và bảng bổ sung ---------------------------------------------------------------
-- S: điểm hiểu biết bổ sung (0-100) chấm từ câu hỏi mở; chưa có thì coi là 100 (trung tính)
ALTER TABLE public.assessment_360_submissions
  ADD COLUMN IF NOT EXISTS understanding_quality_score numeric(5,2)
    CHECK (understanding_quality_score IS NULL OR understanding_quality_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS trust_index numeric(5,2),
  ADD COLUMN IF NOT EXISTS trust_label text CHECK (trust_label IN ('trusted', 'consider', 'suggest_reject'));

DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.assessment_result_scores'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%score_source%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.assessment_result_scores DROP CONSTRAINT %I', c);
  END IF;
  ALTER TABLE public.assessment_result_scores ADD CONSTRAINT assessment_result_scores_score_source_check
    CHECK (score_source IN ('self', 'parent', 'friend', 'teacher', 'mentor', 'others', 'combined_360'));
END $$;

-- Độ phủ và độ tin cậy của từng tiêu chí (R10, R11; BR-041, BR-042)
ALTER TABLE public.assessment_result_scores
  ADD COLUMN IF NOT EXISTS coverage numeric(4,3),
  ADD COLUMN IF NOT EXISTS confidence text CHECK (confidence IN ('high', 'medium', 'low'));

-- Điểm nhóm năng lực G1-G7 (R04) cho biểu đồ radar
CREATE TABLE IF NOT EXISTS public.assessment_result_group_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  result_id uuid NOT NULL REFERENCES public.assessment_results(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.criteria_groups(id) ON DELETE RESTRICT,
  score_source text NOT NULL CHECK (score_source IN ('self', 'combined_360')),
  score_1_5 numeric(4,3),
  score_percent numeric(5,2),
  competency_level text CHECK (competency_level IN ('very_high', 'high', 'medium', 'low')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT assessment_result_group_scores_unique UNIQUE (result_id, group_id, score_source)
);
DROP TRIGGER IF EXISTS set_assessment_result_group_scores_updated_at ON public.assessment_result_group_scores;
CREATE TRIGGER set_assessment_result_group_scores_updated_at
  BEFORE UPDATE ON public.assessment_result_group_scores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.assessment_result_group_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read permitted group scores" ON public.assessment_result_group_scores;
CREATE POLICY "Read permitted group scores" ON public.assessment_result_group_scores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessment_results r WHERE r.id = result_id AND public.can_view_result_of(r.user_id)));

-- 3. Câu hỏi cho người được mời: P07 câu mỗi tiêu chí, chọn ổn định theo resume_token ---------
CREATE OR REPLACE FUNCTION public.get_360_questions(p_resume_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_360_submissions;
  v_segment text;
  v_per_criterion integer := public.param_num('invitee_questions_per_criterion', 1)::integer;
BEGIN
  SELECT * INTO s FROM public.assessment_360_submissions WHERE resume_token = p_resume_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'submission_not_found'; END IF;
  SELECT CASE role WHEN 'university_student' THEN 'university_student' ELSE 'student' END
    INTO v_segment FROM public.user_profiles WHERE id = s.subject_user_id;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'question_id', x.id, 'criteria_id', x.criteria_id,
             'dimension_code', x.dimension_code, 'content', x.content, 'answer_options', x.answer_options
           ) ORDER BY x.sort_order, x.question_code)
      FROM (
        SELECT q.id, q.criteria_id, c.dimension_code, c.sort_order, q.question_code, q.content, q.answer_options,
               row_number() OVER (PARTITION BY q.criteria_id ORDER BY md5(p_resume_token || q.question_code)) AS rn
          FROM public.questions q
          JOIN public.criteria c ON c.id = q.criteria_id AND c.is_active
          JOIN public.criteria_rater_visibility v
            ON v.criteria_id = c.id AND v.rater_group = s.rater_group AND v.is_visible
         WHERE q.rater_group = s.rater_group AND q.is_active
           AND q.respondent_segment IN ('all', v_segment)
      ) x WHERE x.rn <= v_per_criterion
  ), '[]'::jsonb);
END;
$$;

-- 4. Nộp bài + chỉ số tin cậy R14 -----------------------------------------------------------------
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
  v_trust := (v_t + v_d + v_a) / 3;

  -- Luôn "Đề xuất loại": mọi tiêu chí cùng một mức (đủ số tiêu chí), hoặc làm quá nhanh
  v_force_reject := (v_scored >= v_min_criteria AND v_p = 1) OR v_t < public.param_num('trust_min_time_ratio', 0.5);
  v_flag := CASE WHEN v_t < public.param_num('trust_min_time_ratio', 0.5) AND v_scored >= v_min_criteria AND v_p = 1 THEN 'both'
                 WHEN v_t < public.param_num('trust_min_time_ratio', 0.5) THEN 'too_fast'
                 WHEN v_scored >= v_min_criteria AND v_p = 1 THEN 'uniform_scores' ELSE 'ok' END;
  v_label := CASE WHEN v_force_reject OR v_trust < public.param_num('trust_label_consider', 0.4) THEN 'suggest_reject'
                  WHEN v_trust >= public.param_num('trust_label_trusted', 0.7) THEN 'trusted'
                  ELSE 'consider' END;

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

-- 5. Chốt: số bài tối thiểu theo tham số (P39) ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_my_result(p_result_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.assessment_results;
  v_min integer := public.param_num('min_accepted_to_finalize', 1)::integer;
BEGIN
  SELECT * INTO r FROM public.assessment_results WHERE id = p_result_id;
  IF NOT FOUND OR r.user_id <> auth.uid() THEN RAISE EXCEPTION 'result_not_found'; END IF;
  IF r.finalized_at IS NOT NULL THEN RAISE EXCEPTION 'already_finalized'; END IF;
  IF r.accepted_count < v_min THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_accepted_submission');
  END IF;
  PERFORM public.finalize_result_internal(r.id, 'manual');
  RETURN jsonb_build_object('ok', true, 'thin_data', r.accepted_count = 1);
END;
$$;

-- 6. Tính lại kết quả theo R02, R02B, R03, R04, R21 -----------------------------------------------
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
  v_label public.result_status_label;
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

  -- w_i = TH%_i x S_i ; S chưa có thì coi là 100 ; tổng bằng 0 thì chia đều
  CREATE TEMP TABLE IF NOT EXISTS _calc_base (
    submission_id uuid, rater_group text, w numeric
  ) ON COMMIT DROP;
  TRUNCATE _calc_base;
  INSERT INTO _calc_base
  SELECT s.id, s.rater_group::text,
         CASE WHEN SUM(raw) OVER () > 0 THEN raw ELSE 1 END
    FROM (
      SELECT s2.id, s2.rater_group,
             ((COALESCE(s2.understanding_score, 3) - 3) / 9.0 * 100) * COALESCE(s2.understanding_quality_score, 100) AS raw
        FROM public.assessment_360_submissions s2
       WHERE s2.subject_user_id = r.user_id AND s2.status = 'accepted'
         AND s2.decided_at > COALESCE(v_prev_final, '-infinity'::timestamptz)
    ) s(id, rater_group, raw);

  -- Trọng số tổng quát mỗi bài (hiển thị/bản chụp); điểm tiêu chí dùng trọng số chuẩn hóa riêng từng tiêu chí
  INSERT INTO public.assessment_result_weights (result_id, submission_id, weight)
  SELECT r.id, b.submission_id, round(b.w / SUM(b.w) OVER () * (1 - p3), 6) FROM _calc_base b;

  SELECT count(*), count(DISTINCT rater_group) INTO v_accepted, v_groups FROM _calc_base;

  WITH self_rs AS (
    SELECT a.criteria_id, avg(a.score)::numeric AS rs
      FROM public.assessment_answers a WHERE a.session_id = r.session_id AND a.score IS NOT NULL
     GROUP BY a.criteria_id
  ), sub_rs AS (
    SELECT b.submission_id, b.rater_group, b.w, a.criteria_id, avg(a.score)::numeric AS rs
      FROM _calc_base b
      JOIN public.assessment_360_answers a ON a.submission_id = b.submission_id AND a.score IS NOT NULL
     GROUP BY b.submission_id, b.rater_group, b.w, a.criteria_id
  ), ext AS (   -- R03: chuẩn hóa trọng số các nguồn ngoài hợp lệ về (1 - P03) tại mỗi tiêu chí
    SELECT criteria_id, rater_group, rs,
           CASE WHEN SUM(w) OVER (PARTITION BY criteria_id) > 0
                THEN w / SUM(w) OVER (PARTITION BY criteria_id)
                ELSE 1.0 / count(*) OVER (PARTITION BY criteria_id) END * (1 - p3) AS ww
      FROM sub_rs
  ), combined AS (
    SELECT criteria_id, SUM(w * rs) / NULLIF(SUM(w), 0) AS score
      FROM (SELECT criteria_id, p3 AS w, rs FROM self_rs
            UNION ALL SELECT criteria_id, ww, rs FROM ext) x
     GROUP BY criteria_id
  ), src AS (   -- R21: nhóm đủ P26 bài hiện riêng; nhóm ít bài gộp vào "Người khác" (cần P27 bài)
    SELECT s.criteria_id, s.rs, s.w, s.submission_id,
           CASE WHEN g.n >= p26 THEN s.rater_group ELSE 'others' END AS source
      FROM sub_rs s JOIN (SELECT rater_group, count(*) AS n FROM _calc_base GROUP BY rater_group) g
        ON g.rater_group = s.rater_group
  ), src_cnt AS (
    SELECT CASE WHEN g.n >= p26 THEN b.rater_group ELSE 'others' END AS source, count(*) AS cnt
      FROM _calc_base b JOIN (SELECT rater_group, count(*) AS n FROM _calc_base GROUP BY rater_group) g
        ON g.rater_group = b.rater_group
     GROUP BY 1
  ), group_scores AS (
    SELECT s.criteria_id, s.source AS score_source, SUM(s.rs * s.w) / NULLIF(SUM(s.w), 0) AS score
      FROM src s JOIN src_cnt c ON c.source = s.source
     WHERE c.cnt >= CASE WHEN s.source = 'others' THEN p27 ELSE p26 END
     GROUP BY s.criteria_id, s.source
  ), all_scores AS (
    SELECT criteria_id, 'self'::text AS score_source, rs AS score FROM self_rs
    UNION ALL SELECT criteria_id, score_source, score FROM group_scores
    UNION ALL SELECT criteria_id, 'combined_360', score FROM combined WHERE v_accepted > 0
  )
  INSERT INTO public.assessment_result_scores (result_id, criteria_id, score_source, score_1_5, score_percent, competency_level)
  SELECT r.id, criteria_id, score_source, round(score, 3), round(score / 5 * 100, 2),
         CASE WHEN score / 5 * 100 >= (v_levels ->> 'very_high')::numeric THEN 'very_high'
              WHEN score / 5 * 100 >= (v_levels ->> 'high')::numeric THEN 'high'
              WHEN score / 5 * 100 >= (v_levels ->> 'medium')::numeric THEN 'medium'
              ELSE 'low' END
    FROM all_scores WHERE score IS NOT NULL;

  -- R04: điểm nhóm = trung bình cộng điểm các tiêu chí có dữ liệu trong nhóm (trọng số đều, P36)
  INSERT INTO public.assessment_result_group_scores (result_id, group_id, score_source, score_1_5, score_percent, competency_level)
  SELECT r.id, c.group_id, sc.score_source, round(avg(sc.score_1_5), 3), round(avg(sc.score_1_5) / 5 * 100, 2),
         CASE WHEN avg(sc.score_1_5) / 5 * 100 >= (v_levels ->> 'very_high')::numeric THEN 'very_high'
              WHEN avg(sc.score_1_5) / 5 * 100 >= (v_levels ->> 'high')::numeric THEN 'high'
              WHEN avg(sc.score_1_5) / 5 * 100 >= (v_levels ->> 'medium')::numeric THEN 'medium'
              ELSE 'low' END
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
        AND sc.score_source = CASE WHEN v_accepted > 0 THEN 'combined_360' ELSE 'self' END);

  -- R10/R11: Coverage = số nhóm người đánh giá cốt lõi có điểm hợp lệ / số nhóm được phân công (Ma trận tiêu chí).
  -- Tỷ lệ "không đủ cơ sở" vượt ngưỡng thì mọi tiêu chí hạ xuống Low (không đổi điểm).
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
                AND a.criteria_id = c.id AND a.score IS NOT NULL) AS valid_groups
      FROM public.criteria c WHERE c.is_active
  ) cv
  WHERE sc.result_id = r.id AND sc.criteria_id = cv.criteria_id
    AND sc.score_source = CASE WHEN v_accepted > 0 THEN 'combined_360' ELSE 'self' END;

  v_label := CASE WHEN p_finalizing THEN 'final_360'
                  WHEN v_accepted > 0 THEN 'temporary' ELSE 'self_assessment' END;

  UPDATE public.assessment_results SET
    status_label = v_label, accepted_count = v_accepted, expected_count = v_expected, groups_count = v_groups,
    thin_data_flag = (v_accepted = 1),
    insufficient_basis_warning = (v_total_criteria > 0 AND v_null_criteria::numeric / v_total_criteria > v_warn_ratio),
    calculated_at = now()
  WHERE id = r.id;

  INSERT INTO public.assessment_result_snapshots (result_id, user_id, status_label, snapshot_data)
  SELECT r.id, r.user_id, v_label, jsonb_build_object(
    'parameters', jsonb_build_object('self_weight', p3, 'competency_levels', v_levels,
                                     'min_submissions_group_display', p26, 'min_submissions_other_display', p27),
    'framework_version_id', r.framework_version_id,
    'accepted_count', v_accepted,
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
REVOKE ALL ON FUNCTION public.recalculate_result(uuid, boolean) FROM PUBLIC;
