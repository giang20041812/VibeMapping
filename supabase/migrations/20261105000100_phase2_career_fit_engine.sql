-- Phase 2 – Gợi ý nghề: Career Fit tính trên máy chủ.
-- R06 Fit, R07 Gap, R08 Career Fit (40/30/30, chia lại khi thiếu thành phần – R13), R05 G6 (Demo),
-- R20 xếp hạng, R19 bản chụp, FR04.02.07–08 tự tính lại và báo thay đổi thứ hạng.

-- 1. Kết quả theo cặp (kết quả đánh giá, nghề, phiên bản NGHE) ------------------------------------
CREATE TABLE IF NOT EXISTS public.career_fit_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  result_id uuid NOT NULL REFERENCES public.assessment_results(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  career_id uuid NOT NULL REFERENCES public.careers(id) ON DELETE CASCADE,
  matrix_version_id uuid NOT NULL REFERENCES public.career_matrix_versions(id) ON DELETE RESTRICT,
  match_g1_g5 numeric,
  match_g6 numeric,
  match_g7 numeric,
  applied_weight_g1_g5 numeric,
  applied_weight_g6 numeric,
  applied_weight_g7 numeric,
  riasec_method text NOT NULL,
  career_fit_raw numeric NOT NULL,
  component_completeness numeric NOT NULL,
  rank_band integer NOT NULL,
  highest_weight_gap numeric NOT NULL DEFAULT 0,
  unmet_criteria_count integer NOT NULL DEFAULT 0,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT career_fit_results_unique UNIQUE (result_id, career_id, matrix_version_id)
);
CREATE INDEX IF NOT EXISTS idx_career_fit_results_user ON public.career_fit_results(user_id);
ALTER TABLE public.career_fit_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read permitted career fit" ON public.career_fit_results;
CREATE POLICY "Read permitted career fit" ON public.career_fit_results FOR SELECT TO authenticated
  USING (public.can_view_result_of(user_id));

-- Lần tính gần nhất của mỗi kết quả; fingerprint đổi khi nghề, ma trận hoặc tham số đổi
CREATE TABLE IF NOT EXISTS public.career_fit_runs (
  result_id uuid PRIMARY KEY REFERENCES public.assessment_results(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  reason text NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.career_fit_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read permitted career fit runs" ON public.career_fit_runs;
CREATE POLICY "Read permitted career fit runs" ON public.career_fit_runs FOR SELECT TO authenticated
  USING (public.can_view_result_of(user_id));

-- 2. Tham số đang hiệu lực (P06, P23–P25, P28, P32–P34, P40, P41, P45) ---------------------------------
CREATE OR REPLACE FUNCTION public.career_fit_policy()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'w_main', public.param_num('career_fit_weight_competency', 0.4),
    'w_g6', public.param_num('career_fit_weight_interest', 0.3),
    'w_g7', public.param_num('career_fit_weight_motivation', 0.3),
    'min_fit', public.param_num('career_fit_min_percent', 50),
    'near_fit', public.param_num('career_near_fit_percent', 40),
    'top_n', public.param_num('career_top_n', 5),
    'band', public.param_num('career_rank_band_percent', 1),
    'gap_percent', public.param_num('perception_gap_percent', 25),
    'priority_p1', public.param_num('gap_priority_p1', 0.5),
    'priority_p2', public.param_num('gap_priority_p2', 0.25),
    'decimals', public.param_num('career_fit_decimals', 1),
    'riasec_method', COALESCE(public.get_parameter('riasec_match_method') #>> '{}', 'profile_6d_demo'));
$$;

CREATE OR REPLACE FUNCTION public.career_fit_fingerprint()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT md5(concat_ws('|',
    (SELECT id::text FROM public.career_matrix_versions WHERE is_current),
    (SELECT count(*)::text || ':' || COALESCE(max(updated_at)::text, '')
       FROM public.careers WHERE status = 'published' AND is_standard_complete),
    (SELECT count(*)::text || ':' || COALESCE(max(updated_at)::text, '') FROM public.career_requirements),
    (SELECT count(*)::text || ':' || COALESCE(max(updated_at)::text, '') FROM public.career_holland_profiles),
    public.career_fit_policy()::text));
$$;

-- 3. Điểm người học: ưu tiên điểm tổng hợp 360°, chưa có thì điểm tự đánh giá -----------------------
CREATE OR REPLACE FUNCTION public.career_fit_learner_scores(p_result_id uuid)
RETURNS TABLE (criteria_id uuid, dimension_code text, group_code text, score numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sc.criteria_id, cr.dimension_code, g.group_code,
         COALESCE(max(sc.score_1_5) FILTER (WHERE sc.score_source = 'combined_360'),
                  max(sc.score_1_5) FILTER (WHERE sc.score_source = 'self'))
    FROM public.assessment_result_scores sc
    JOIN public.criteria cr ON cr.id = sc.criteria_id AND cr.is_active
    JOIN public.criteria_groups g ON g.id = cr.group_id
   WHERE sc.result_id = p_result_id
     AND sc.score_source IN ('self', 'combined_360')
     AND sc.score_1_5 IS NOT NULL
   GROUP BY sc.criteria_id, cr.dimension_code, g.group_code;
$$;

-- 4. R06, R07 theo từng tiêu chí của nghề (G1–G5, G7; CW > 0; ma trận NGHE hiện hành) ---------------
CREATE OR REPLACE FUNCTION public.career_fit_criteria(p_result_id uuid, p_career_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  career_id uuid, criteria_id uuid, dimension_code text, criteria_name text, group_code text,
  required_score numeric, career_weight numeric, user_score numeric, fit numeric, gap numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH us AS (SELECT * FROM public.career_fit_learner_scores(p_result_id))
  SELECT r.career_id, r.criteria_id, cr.dimension_code, cr.name, g.group_code,
         r.required_score, r.career_weight, us.score,
         CASE WHEN us.score IS NULL OR r.required_score <= 0 THEN NULL
              ELSE LEAST(us.score / r.required_score, 1) END,
         CASE WHEN us.score IS NULL THEN NULL
              ELSE round(GREATEST(r.required_score - us.score, 0), 2) END
    FROM public.career_requirements r
    JOIN public.career_matrix_versions v ON v.id = r.matrix_version_id AND v.is_current
    JOIN public.criteria cr ON cr.id = r.criteria_id AND cr.is_active
    JOIN public.criteria_groups g ON g.id = cr.group_id
    LEFT JOIN us ON us.criteria_id = r.criteria_id
   WHERE r.career_weight > 0
     AND g.group_code IN ('G1', 'G2', 'G3', 'G4', 'G5', 'G7')
     AND (p_career_ids IS NULL OR r.career_id = ANY (p_career_ids));
$$;

-- 5. R05 + R08 + R13: ba thành phần và Career Fit (giá trị gốc, không làm tròn) ----------------------
-- Chỉ nghề Đang hiển thị và đủ chuẩn nghề (R16). G6 theo tham số riasec_match_method (Demo).
CREATE OR REPLACE FUNCTION public.career_fit_compute(p_result_id uuid, p_career_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  career_id uuid,
  match_g1_g5 numeric, match_g6 numeric, match_g7 numeric,
  applied_weight_g1_g5 numeric, applied_weight_g6 numeric, applied_weight_g7 numeric,
  riasec_method text, career_fit_raw numeric, component_completeness numeric,
  rank_band integer, highest_weight_gap numeric, unmet_criteria_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pol AS (SELECT public.career_fit_policy() AS p),
  cand AS (
    SELECT c.id, c.holland_top3 FROM public.careers c
     WHERE c.status = 'published' AND c.is_standard_complete
       AND (p_career_ids IS NULL OR c.id = ANY (p_career_ids))
  ),
  crit AS (
    SELECT f.* FROM public.career_fit_criteria(p_result_id, p_career_ids) f JOIN cand ON cand.id = f.career_id
  ),
  part AS (
    SELECT f.career_id,
           sum(f.fit * f.career_weight) FILTER (WHERE f.group_code <> 'G7' AND f.fit IS NOT NULL)
             / NULLIF(sum(f.career_weight) FILTER (WHERE f.group_code <> 'G7' AND f.fit IS NOT NULL), 0) AS m_main,
           sum(f.fit * f.career_weight) FILTER (WHERE f.group_code = 'G7' AND f.fit IS NOT NULL)
             / NULLIF(sum(f.career_weight) FILTER (WHERE f.group_code = 'G7' AND f.fit IS NOT NULL), 0) AS m_g7,
           (count(*) FILTER (WHERE f.gap > 0))::integer AS unmet,
           max(f.career_weight) FILTER (WHERE f.gap > 0) AS top_cw
      FROM crit f GROUP BY f.career_id
  ),
  hwg AS (
    SELECT f.career_id, max(f.gap) AS gap
      FROM crit f JOIN part p ON p.career_id = f.career_id
     WHERE f.gap > 0 AND f.career_weight = p.top_cw
     GROUP BY f.career_id
  ),
  lh AS (
    SELECT h.letter, h.ord, s.score, LEAST(GREATEST(s.score / 5, 0), 1) AS l
      FROM (VALUES ('R', 'D6.1', 1), ('I', 'D6.2', 2), ('A', 'D6.3', 3),
                   ('S', 'D6.4', 4), ('E', 'D6.5', 5), ('C', 'D6.6', 6)) h(letter, dim, ord)
      LEFT JOIN public.career_fit_learner_scores(p_result_id) s ON s.dimension_code = h.dim
  ),
  ltop AS (
    SELECT CASE WHEN (SELECT count(*) FROM lh WHERE score IS NOT NULL) >= 3
                THEN (SELECT array_agg(t.letter) FROM (
                        SELECT letter FROM lh WHERE score IS NOT NULL ORDER BY score DESC, ord LIMIT 3) t)
           END AS letters
  ),
  g6p AS (
    SELECT hp.career_id,
           sum(LEAST(lh.l / GREATEST(hp.strength, 0.2), 1) * hp.strength) / NULLIF(sum(hp.strength), 0) AS m
      FROM public.career_holland_profiles hp
      JOIN cand ON cand.id = hp.career_id
      JOIN lh ON lh.letter = hp.holland_code::text
     WHERE lh.l IS NOT NULL AND hp.strength > 0
     GROUP BY hp.career_id
  ),
  g6t AS (
    SELECT cand.id AS career_id,
           (SELECT count(DISTINCT x) FROM unnest(lt.letters) x WHERE position(x IN upper(cand.holland_top3)) > 0)::numeric
             / GREATEST(1, LEAST(3, (SELECT count(DISTINCT y) FROM regexp_split_to_table(upper(cand.holland_top3), '') y))) AS m
      FROM cand CROSS JOIN ltop lt
     WHERE lt.letters IS NOT NULL AND cand.holland_top3 IS NOT NULL
  ),
  comb AS (
    SELECT cand.id AS career_id, p.m_main, p.m_g7,
           CASE WHEN pol.p ->> 'riasec_method' = 'top3_overlap_demo' THEN g6t.m ELSE COALESCE(g6p.m, g6t.m) END AS m_g6,
           CASE WHEN pol.p ->> 'riasec_method' <> 'top3_overlap_demo' AND g6p.m IS NOT NULL THEN 'profile_6d_demo'
                WHEN g6t.m IS NOT NULL THEN 'top3_overlap_demo'
                ELSE 'missing' END AS method,
           (pol.p ->> 'w_main')::numeric AS w_main,
           (pol.p ->> 'w_g6')::numeric AS w_g6,
           (pol.p ->> 'w_g7')::numeric AS w_g7,
           GREATEST((pol.p ->> 'band')::numeric, 0.0001) AS band,
           COALESCE(p.unmet, 0) AS unmet,
           COALESCE(h.gap, 0) AS hgap
      FROM cand CROSS JOIN pol
      LEFT JOIN part p ON p.career_id = cand.id
      LEFT JOIN hwg h ON h.career_id = cand.id
      LEFT JOIN g6p ON g6p.career_id = cand.id
      LEFT JOIN g6t ON g6t.career_id = cand.id
  ),
  act AS (
    SELECT c.*,
           CASE WHEN c.m_main IS NOT NULL AND c.w_main > 0 THEN c.w_main ELSE 0 END AS a_main,
           CASE WHEN c.m_g6 IS NOT NULL AND c.w_g6 > 0 THEN c.w_g6 ELSE 0 END AS a_g6,
           CASE WHEN c.m_g7 IS NOT NULL AND c.w_g7 > 0 THEN c.w_g7 ELSE 0 END AS a_g7
      FROM comb c
  ),
  fit AS (
    SELECT a.*, a.a_main + a.a_g6 + a.a_g7 AS completeness,
           (COALESCE(a.m_main * a.a_main, 0) + COALESCE(a.m_g6 * a.a_g6, 0) + COALESCE(a.m_g7 * a.a_g7, 0))
             / NULLIF(a.a_main + a.a_g6 + a.a_g7, 0) * 100 AS fit_raw
      FROM act a
  )
  SELECT f.career_id, f.m_main, f.m_g6, f.m_g7,
         CASE WHEN f.a_main > 0 THEN f.a_main / f.completeness END,
         CASE WHEN f.a_g6 > 0 THEN f.a_g6 / f.completeness END,
         CASE WHEN f.a_g7 > 0 THEN f.a_g7 / f.completeness END,
         f.method, f.fit_raw, f.completeness,
         floor(f.fit_raw / f.band)::integer,
         f.hgap, f.unmet
    FROM fit f
   WHERE f.completeness > 0;
$$;

-- 6. R20: Top N (B2 ngưỡng > P06, B3 bậc P24, B4 tiêu chí phụ, B5 cắt Top; bổ sung Nghề gần đạt từ P25) ---
CREATE OR REPLACE FUNCTION public.career_fit_ranked(p_result_id uuid)
RETURNS TABLE (
  career_id uuid, career_code text, career_name text, rank integer, career_fit_raw numeric,
  rank_band integer, near_threshold boolean, highest_weight_gap numeric, unmet_criteria_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pol AS (SELECT public.career_fit_policy() AS p),
  ordered AS (
    SELECT r.career_id, c.career_code, c.career_name, r.career_fit_raw, r.rank_band,
           r.career_fit_raw <= (pol.p ->> 'min_fit')::numeric AS near,
           r.highest_weight_gap, r.unmet_criteria_count,
           row_number() OVER (
             ORDER BY (r.career_fit_raw > (pol.p ->> 'min_fit')::numeric) DESC, r.rank_band DESC,
                      r.highest_weight_gap, r.unmet_criteria_count, c.career_code) AS rn,
           (pol.p ->> 'top_n')::integer AS top_n
      FROM public.career_fit_results r
      JOIN public.career_matrix_versions v ON v.id = r.matrix_version_id AND v.is_current
      JOIN public.careers c ON c.id = r.career_id AND c.status = 'published'
      CROSS JOIN pol
     WHERE r.result_id = p_result_id
       AND r.career_fit_raw >= (pol.p ->> 'near_fit')::numeric
  )
  SELECT o.career_id, o.career_code, o.career_name, o.rn::integer, o.career_fit_raw, o.rank_band, o.near,
         o.highest_weight_gap, o.unmet_criteria_count
    FROM ordered o
   WHERE o.rn <= o.top_n
   ORDER BY o.rn;
$$;

-- 7. Tính lại, lưu bản chụp R19 và báo khi Top thực sự đổi (BR-017, FR04.02.07–08) -------------------
CREATE OR REPLACE FUNCTION public.refresh_career_ranking(p_result_id uuid, p_reason text DEFAULT 'result_recalculated')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.assessment_results;
  v_pol jsonb := public.career_fit_policy();
  v_version uuid;
  v_version_code text;
  v_prev jsonb;
  v_prev_ids uuid[];
  v_new_ids uuid[];
  v_ranking jsonb;
  v_details jsonb;
  v_entered text;
  v_left text;
  v_mover text;
  v_body text;
BEGIN
  SELECT * INTO r FROM public.assessment_results WHERE id = p_result_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT id, version_code INTO v_version, v_version_code FROM public.career_matrix_versions WHERE is_current;
  IF v_version IS NULL THEN RETURN; END IF;

  DELETE FROM public.career_fit_results WHERE result_id = r.id AND matrix_version_id = v_version;
  INSERT INTO public.career_fit_results (
    result_id, user_id, career_id, matrix_version_id, match_g1_g5, match_g6, match_g7,
    applied_weight_g1_g5, applied_weight_g6, applied_weight_g7, riasec_method, career_fit_raw,
    component_completeness, rank_band, highest_weight_gap, unmet_criteria_count)
  SELECT r.id, r.user_id, f.career_id, v_version, f.match_g1_g5, f.match_g6, f.match_g7,
         f.applied_weight_g1_g5, f.applied_weight_g6, f.applied_weight_g7, f.riasec_method, f.career_fit_raw,
         f.component_completeness, f.rank_band, f.highest_weight_gap, f.unmet_criteria_count
    FROM public.career_fit_compute(r.id) f;

  INSERT INTO public.career_fit_runs (result_id, user_id, fingerprint, reason, calculated_at)
  VALUES (r.id, r.user_id, public.career_fit_fingerprint(), p_reason, now())
  ON CONFLICT (result_id) DO UPDATE
    SET fingerprint = EXCLUDED.fingerprint, reason = EXCLUDED.reason, calculated_at = EXCLUDED.calculated_at;

  SELECT COALESCE(array_agg(k.career_id ORDER BY k.rank), '{}'::uuid[]),
         COALESCE(jsonb_agg(jsonb_build_object(
           'career_id', k.career_id, 'rank', k.rank, 'band', k.rank_band,
           'fit_raw', k.career_fit_raw,
           'fit_display', round(k.career_fit_raw, (v_pol ->> 'decimals')::integer),
           'near', k.near_threshold,
           'tie_break', jsonb_build_object('highest_weight_gap', k.highest_weight_gap, 'unmet', k.unmet_criteria_count)
         ) ORDER BY k.rank), '[]'::jsonb)
    INTO v_new_ids, v_ranking
    FROM public.career_fit_ranked(r.id) k;

  SELECT payload INTO v_prev FROM public.career_match_snapshots
   WHERE user_id = r.user_id ORDER BY created_at DESC LIMIT 1;
  SELECT COALESCE(array_agg((x.e ->> 'career_id')::uuid ORDER BY x.ord), '{}'::uuid[]) INTO v_prev_ids
    FROM jsonb_array_elements(COALESCE(v_prev -> 'ranking', '[]'::jsonb)) WITH ORDINALITY x(e, ord);

  -- Không đổi Top và đã có bản chụp cho kết quả này: giữ nguyên
  IF v_prev_ids = v_new_ids AND EXISTS (SELECT 1 FROM public.career_match_snapshots WHERE result_id = r.id) THEN
    RETURN;
  END IF;
  IF v_prev IS NULL AND cardinality(v_new_ids) = 0 THEN RETURN; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'career_id', f.career_id,
           'match_g1_g5', f.match_g1_g5, 'match_g6', f.match_g6, 'match_g7', f.match_g7,
           'applied_weights', jsonb_build_object('g1_g5', f.applied_weight_g1_g5, 'g6', f.applied_weight_g6, 'g7', f.applied_weight_g7),
           'completeness', f.component_completeness, 'riasec_method', f.riasec_method,
           'criteria', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                          'd', c.dimension_code, 'req', c.required_score, 'us', c.user_score,
                          'cw', c.career_weight, 'fit', c.fit, 'gap', c.gap) ORDER BY c.dimension_code), '[]'::jsonb)
                          FROM public.career_fit_criteria(r.id, ARRAY[f.career_id]) c)
         )), '[]'::jsonb)
    INTO v_details
    FROM public.career_fit_results f
   WHERE f.result_id = r.id AND f.matrix_version_id = v_version AND f.career_id = ANY (v_new_ids);

  INSERT INTO public.career_match_snapshots (result_id, user_id, career_matrix_version, payload)
  VALUES (r.id, r.user_id, v_version_code, jsonb_build_object(
    'reason', p_reason,
    'calculated_at', now(),
    'versions', jsonb_build_object(
      'framework', (SELECT version_code FROM public.framework_versions WHERE id = r.framework_version_id),
      'question_bank', COALESCE(public.get_parameter('question_bank_version') #>> '{}', 'CH-1.0'),
      'parameters', COALESCE(public.get_parameter('parameter_book_version') #>> '{}', 'TS-1.0'),
      'career_matrix', v_version_code),
    'policy', v_pol,
    'statuses', jsonb_build_object('assessment_status', r.status_label, 'result_validity', 'active'),
    'top_before', to_jsonb(v_prev_ids),
    'top_after', to_jsonb(v_new_ids),
    'ranking', v_ranking,
    'details', v_details));

  IF v_prev IS NULL OR v_prev_ids = v_new_ids THEN RETURN; END IF;

  SELECT string_agg(c.career_name, ', ' ORDER BY x.ord) INTO v_entered
    FROM unnest(v_new_ids) WITH ORDINALITY x(id, ord) JOIN public.careers c ON c.id = x.id
   WHERE NOT (x.id = ANY (v_prev_ids));
  SELECT string_agg(c.career_name, ', ' ORDER BY x.ord) INTO v_left
    FROM unnest(v_prev_ids) WITH ORDINALITY x(id, ord) JOIN public.careers c ON c.id = x.id
   WHERE NOT (x.id = ANY (v_new_ids));
  SELECT c.career_name || ' ' || CASE WHEN t.d > 0 THEN '+' ELSE '' END
           || replace(round(t.d, 1)::text, '.', ',') || ' điểm'
    INTO v_mover
    FROM (
      SELECT (n.e ->> 'career_id')::uuid AS id,
             (n.e ->> 'fit_raw')::numeric - COALESCE(o.e ->> 'fit_raw', o.e ->> 'fit')::numeric AS d
        FROM jsonb_array_elements(v_ranking) n(e)
        JOIN jsonb_array_elements(v_prev -> 'ranking') o(e) ON o.e ->> 'career_id' = n.e ->> 'career_id'
       WHERE COALESCE(o.e ->> 'fit_raw', o.e ->> 'fit') IS NOT NULL
    ) t JOIN public.careers c ON c.id = t.id
   WHERE abs(t.d) >= 0.1
   ORDER BY abs(t.d) DESC LIMIT 1;

  v_body := concat_ws('. ', 'Mới vào: ' || v_entered, 'Rời danh sách: ' || v_left, 'Thay đổi nhiều nhất: ' || v_mover);
  PERFORM public.push_notification(r.user_id, 'career_ranking_changed', 'Danh sách nghề gợi ý đã thay đổi',
    COALESCE(NULLIF(v_body, ''), 'Thứ hạng các nghề gợi ý đã thay đổi'),
    jsonb_build_object('result_id', r.id, 'href', '/nghe',
      'entered', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM unnest(v_new_ids) x WHERE NOT (x = ANY (v_prev_ids))),
      'left', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM unnest(v_prev_ids) x WHERE NOT (x = ANY (v_new_ids)))));
END;
$$;

-- Kết quả mới nhất của người học được tính lại (tự đánh giá, chấp nhận/loại bài 360°, chốt) → tính lại nghề.
-- Lỗi phần nghề không làm hỏng việc tính điểm đánh giá.
CREATE OR REPLACE FUNCTION public.trg_refresh_career_ranking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.assessment_results o
                  WHERE o.user_id = NEW.user_id AND o.created_at > NEW.created_at) THEN
    BEGIN
      PERFORM public.refresh_career_ranking(NEW.id, 'result_recalculated');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'refresh_career_ranking: %', SQLERRM;
    END;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_refresh_career_ranking ON public.assessment_results;
CREATE TRIGGER trg_refresh_career_ranking
  AFTER UPDATE OF calculated_at ON public.assessment_results
  FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_career_ranking();

-- Tính lại khi nghề, ma trận hoặc tham số đổi kể từ lần tính trước
CREATE OR REPLACE FUNCTION public.career_fit_ensure(p_result_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run public.career_fit_runs;
  v_calc timestamptz;
BEGIN
  SELECT COALESCE(calculated_at, created_at) INTO v_calc FROM public.assessment_results WHERE id = p_result_id;
  SELECT * INTO v_run FROM public.career_fit_runs WHERE result_id = p_result_id;
  IF v_run.result_id IS NULL THEN
    PERFORM public.refresh_career_ranking(p_result_id, 'first_view');
  ELSIF v_run.fingerprint <> public.career_fit_fingerprint() THEN
    PERFORM public.refresh_career_ranking(p_result_id, 'catalog_changed');
  ELSIF v_run.calculated_at < v_calc THEN
    PERFORM public.refresh_career_ranking(p_result_id, 'result_recalculated');
  END IF;
END;
$$;

-- 8. RPC đọc ------------------------------------------------------------------------------------
-- Danh sách gợi ý của chính mình, hoặc của con/người đã chia sẻ kết quả (R21)
CREATE OR REPLACE FUNCTION public.get_career_recommendations(p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := COALESCE(p_user_id, auth.uid());
  v_pol jsonb := public.career_fit_policy();
  r public.assessment_results;
  v_package smallint;
  v_version uuid;
  v_learner numeric;
  v_has_scores boolean;
  v_items jsonb;
  v_targets jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_view_result_of(v_user) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.assessment_results WHERE user_id = v_user ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_result', false, 'has_scores', false, 'policy', v_pol,
                              'items', '[]'::jsonb, 'targets', '[]'::jsonb);
  END IF;
  PERFORM public.career_fit_ensure(r.id);
  SELECT id INTO v_version FROM public.career_matrix_versions WHERE is_current;
  SELECT package_size INTO v_package FROM public.assessment_sessions WHERE id = r.session_id;

  SELECT count(*) > 0,
         (CASE WHEN bool_or(group_code IN ('G1', 'G2', 'G3', 'G4', 'G5')) THEN (v_pol ->> 'w_main')::numeric ELSE 0 END
          + CASE WHEN bool_or(group_code = 'G6') THEN (v_pol ->> 'w_g6')::numeric ELSE 0 END
          + CASE WHEN bool_or(group_code = 'G7') THEN (v_pol ->> 'w_g7')::numeric ELSE 0 END)
    INTO v_has_scores, v_learner
    FROM public.career_fit_learner_scores(r.id);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'career_id', k.career_id, 'career_code', k.career_code, 'career_name', k.career_name,
           'holland_top3', c.holland_top3, 'rank', k.rank, 'fit', k.career_fit_raw, 'band', k.rank_band,
           'near', k.near_threshold, 'highest_weight_gap', k.highest_weight_gap, 'unmet', k.unmet_criteria_count,
           'match_g1_g5', f.match_g1_g5, 'match_g6', f.match_g6, 'match_g7', f.match_g7,
           'applied_g1_g5', f.applied_weight_g1_g5, 'applied_g6', f.applied_weight_g6, 'applied_g7', f.applied_weight_g7,
           'completeness', f.component_completeness, 'riasec_method', f.riasec_method,
           'is_target', EXISTS (SELECT 1 FROM public.user_saved_careers s
                                 WHERE s.user_id = v_user AND s.career_id = k.career_id AND s.kind = 'target')
         ) ORDER BY k.rank), '[]'::jsonb)
    INTO v_items
    FROM public.career_fit_ranked(r.id) k
    JOIN public.careers c ON c.id = k.career_id
    JOIN public.career_fit_results f ON f.result_id = r.id AND f.career_id = k.career_id AND f.matrix_version_id = v_version;

  -- R20: nghề mục tiêu không bị bỏ khỏi danh sách khi có nghề khác thay thế
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'career_id', c.id, 'career_code', c.career_code, 'career_name', c.career_name,
           'holland_top3', c.holland_top3, 'fit', f.career_fit_raw,
           'match_g1_g5', f.match_g1_g5, 'match_g6', f.match_g6, 'match_g7', f.match_g7,
           'completeness', f.component_completeness,
           'near', f.career_fit_raw IS NOT NULL AND f.career_fit_raw <= (v_pol ->> 'min_fit')::numeric,
           'in_top', EXISTS (SELECT 1 FROM jsonb_array_elements(v_items) i WHERE i ->> 'career_id' = c.id::text)
         ) ORDER BY s.created_at), '[]'::jsonb)
    INTO v_targets
    FROM public.user_saved_careers s
    JOIN public.careers c ON c.id = s.career_id
    LEFT JOIN public.career_fit_results f ON f.result_id = r.id AND f.career_id = c.id AND f.matrix_version_id = v_version
   WHERE s.user_id = v_user AND s.kind = 'target';

  RETURN jsonb_build_object(
    'has_result', true,
    'has_scores', COALESCE(v_has_scores, false),
    'result_id', r.id,
    'status_label', r.status_label,
    'accepted_count', r.accepted_count,
    'finalized', r.finalized_at IS NOT NULL,
    'result_created_at', r.created_at,
    'package_size', v_package,
    'learner_completeness', COALESCE(v_learner, 0),
    'policy', v_pol,
    'items', v_items,
    'targets', v_targets);
END;
$$;

-- Chi tiết một nghề: thành phần, từng tiêu chí (tầng 2 R19), lệch góc nhìn (BR-016, P28)
CREATE OR REPLACE FUNCTION public.get_career_fit_detail(p_career_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := COALESCE(p_user_id, auth.uid());
  v_pol jsonb := public.career_fit_policy();
  r public.assessment_results;
  f public.career_fit_results;
  v_version uuid;
  v_has_scores boolean;
  v_rank integer;
  v_criteria jsonb;
  v_gaps jsonb;
  v_has_groups boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_view_result_of(v_user) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.assessment_results WHERE user_id = v_user ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_result', false, 'has_scores', false, 'policy', v_pol,
                              'fit', NULL, 'criteria', '[]'::jsonb, 'perception_gaps', '[]'::jsonb);
  END IF;
  PERFORM public.career_fit_ensure(r.id);
  SELECT id INTO v_version FROM public.career_matrix_versions WHERE is_current;
  SELECT EXISTS (SELECT 1 FROM public.career_fit_learner_scores(r.id)) INTO v_has_scores;
  SELECT * INTO f FROM public.career_fit_results
   WHERE result_id = r.id AND career_id = p_career_id AND matrix_version_id = v_version;
  SELECT k.rank INTO v_rank FROM public.career_fit_ranked(r.id) k WHERE k.career_id = p_career_id;

  WITH c AS (
    SELECT x.*, CASE WHEN x.group_code = 'G7' THEN 'g7' ELSE 'g1_g5' END AS part
      FROM public.career_fit_criteria(r.id, ARRAY[p_career_id]) x
  ), w AS (
    SELECT c.*,
           sum(c.career_weight) FILTER (WHERE c.fit IS NOT NULL) OVER (PARTITION BY c.part) AS ready_cw,
           avg(c.career_weight) OVER (PARTITION BY c.part) AS avg_cw,
           CASE WHEN c.part = 'g7' THEN f.applied_weight_g7 ELSE f.applied_weight_g1_g5 END AS applied
      FROM c
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'criteria_id', w.criteria_id, 'dimension_code', w.dimension_code, 'name', w.criteria_name,
           'group_code', w.group_code, 'required_score', w.required_score, 'career_weight', w.career_weight,
           'user_score', w.user_score, 'fit', w.fit, 'gap', w.gap,
           'is_core', w.career_weight >= w.avg_cw,
           'priority', CASE WHEN w.gap IS NULL OR w.gap <= 0 THEN NULL
                            WHEN w.gap >= (v_pol ->> 'priority_p1')::numeric THEN 'P1'
                            WHEN w.gap >= (v_pol ->> 'priority_p2')::numeric THEN 'P2'
                            ELSE 'P3' END,
           'penalty_points', CASE WHEN w.fit IS NULL OR w.applied IS NULL OR w.ready_cw IS NULL OR w.ready_cw = 0 THEN 0
                                  ELSE (1 - w.fit) * w.career_weight / w.ready_cw * w.applied * 100 END,
           'contribution_points', CASE WHEN w.fit IS NULL OR w.applied IS NULL OR w.ready_cw IS NULL OR w.ready_cw = 0 THEN 0
                                       ELSE w.fit * w.career_weight / w.ready_cw * w.applied * 100 END
         ) ORDER BY w.group_code, w.dimension_code), '[]'::jsonb)
    INTO v_criteria
    FROM w;

  -- Lệch góc nhìn: tiêu chí cốt lõi của nghề (CW ≥ trung bình trong phần), nhóm đã qua ngưỡng ẩn danh P26/P27
  SELECT EXISTS (SELECT 1 FROM public.assessment_result_scores
                  WHERE result_id = r.id AND score_source IN ('parent', 'friend', 'teacher', 'mentor', 'others'))
    INTO v_has_groups;
  WITH c AS (
    SELECT x.*, avg(x.career_weight) OVER (PARTITION BY (x.group_code = 'G7')) AS avg_cw
      FROM public.career_fit_criteria(r.id, ARRAY[p_career_id]) x
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'dimension_code', c.dimension_code, 'name', c.criteria_name, 'group', g.score_source,
           'self_percent', s.score_percent, 'group_percent', g.score_percent,
           'delta_percent', round(g.score_percent - s.score_percent, 1)
         ) ORDER BY abs(g.score_percent - s.score_percent) DESC), '[]'::jsonb)
    INTO v_gaps
    FROM c
    JOIN public.assessment_result_scores s ON s.result_id = r.id AND s.criteria_id = c.criteria_id
     AND s.score_source = 'self' AND s.score_percent IS NOT NULL
    JOIN public.assessment_result_scores g ON g.result_id = r.id AND g.criteria_id = c.criteria_id
     AND g.score_source IN ('parent', 'friend', 'teacher', 'mentor', 'others') AND g.score_percent IS NOT NULL
   WHERE c.career_weight >= c.avg_cw
     AND abs(g.score_percent - s.score_percent) >= (v_pol ->> 'gap_percent')::numeric;

  RETURN jsonb_build_object(
    'has_result', true,
    'has_scores', v_has_scores,
    'result_id', r.id,
    'status_label', r.status_label,
    'accepted_count', r.accepted_count,
    'policy', v_pol,
    'rank', v_rank,
    'fit', CASE WHEN f.id IS NULL THEN NULL ELSE jsonb_build_object(
      'career_fit_raw', f.career_fit_raw, 'rank_band', f.rank_band,
      'match_g1_g5', f.match_g1_g5, 'match_g6', f.match_g6, 'match_g7', f.match_g7,
      'applied_g1_g5', f.applied_weight_g1_g5, 'applied_g6', f.applied_weight_g6, 'applied_g7', f.applied_weight_g7,
      'completeness', f.component_completeness, 'riasec_method', f.riasec_method,
      'highest_weight_gap', f.highest_weight_gap, 'unmet', f.unmet_criteria_count) END,
    'criteria', v_criteria,
    'has_group_scores', v_has_groups,
    'perception_gaps', v_gaps);
END;
$$;

-- So sánh nghề: % phù hợp của nhiều nghề cùng lúc
CREATE OR REPLACE FUNCTION public.get_career_fit_many(p_career_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.assessment_results;
  v_version uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.assessment_results WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('has_scores', false, 'items', '[]'::jsonb); END IF;
  PERFORM public.career_fit_ensure(r.id);
  SELECT id INTO v_version FROM public.career_matrix_versions WHERE is_current;
  RETURN jsonb_build_object(
    'has_scores', EXISTS (SELECT 1 FROM public.career_fit_learner_scores(r.id)),
    'items', (SELECT COALESCE(jsonb_agg(jsonb_build_object('career_id', f.career_id, 'fit', f.career_fit_raw,
                                                           'completeness', f.component_completeness)), '[]'::jsonb)
                FROM public.career_fit_results f
               WHERE f.result_id = r.id AND f.matrix_version_id = v_version AND f.career_id = ANY (p_career_ids)));
END;
$$;

-- 9. Quyền ---------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.career_fit_policy() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.career_fit_fingerprint() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.career_fit_learner_scores(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.career_fit_criteria(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.career_fit_compute(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.career_fit_ranked(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_career_ranking(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.career_fit_ensure(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_refresh_career_ranking() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_career_recommendations(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_career_fit_detail(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_career_fit_many(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.career_fit_policy() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_career_recommendations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_career_fit_detail(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_career_fit_many(uuid[]) TO authenticated;

-- Bản chụp nghề do máy chủ ghi; trình duyệt không tự ghi nữa
REVOKE ALL ON FUNCTION public.save_career_match_snapshot(uuid, jsonb) FROM PUBLIC, anon, authenticated;
