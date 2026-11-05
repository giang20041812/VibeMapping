-- Career Fit: lần tính đầu mất 10–35 giây (vượt statement_timeout 8s của authenticated) nên kết quả không bao giờ được lưu và màn hình luôn báo lỗi.
-- Nguyên nhân: career_fit_policy() bị inline chạy lại theo từng dòng, và g6t bị join lồng 669 nghìn vòng. Ép tính một lần bằng CTE MATERIALIZED.

CREATE OR REPLACE FUNCTION public.career_fit_compute(p_result_id uuid, p_career_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  career_id uuid,
  match_g1_g5 numeric, match_g6 numeric, match_g7 numeric,
  applied_weight_g1_g5 numeric, applied_weight_g6 numeric, applied_weight_g7 numeric,
  riasec_method text, career_fit_raw numeric, component_completeness numeric,
  rank_band integer, highest_weight_gap numeric, unmet_criteria_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pol AS MATERIALIZED (SELECT public.career_fit_policy() AS p),
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
  g6p AS MATERIALIZED (
    SELECT hp.career_id,
           sum(LEAST(lh.l / GREATEST(hp.strength, 0.2), 1) * hp.strength) / NULLIF(sum(hp.strength), 0) AS m
      FROM public.career_holland_profiles hp
      JOIN cand ON cand.id = hp.career_id
      JOIN lh ON lh.letter = hp.holland_code::text
     WHERE lh.l IS NOT NULL AND hp.strength > 0
     GROUP BY hp.career_id
  ),
  g6t AS MATERIALIZED (
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

CREATE OR REPLACE FUNCTION public.career_fit_ranked(p_result_id uuid)
RETURNS TABLE (
  career_id uuid, career_code text, career_name text, rank integer, career_fit_raw numeric,
  rank_band integer, near_threshold boolean, highest_weight_gap numeric, unmet_criteria_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pol AS MATERIALIZED (SELECT public.career_fit_policy() AS p),
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
