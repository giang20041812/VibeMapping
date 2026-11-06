-- Một chỗ duy nhất quyết định nghề "đủ chuẩn" và nghề được tự công bố, dùng chung cho script nạp và trang quản trị.

-- Đủ chuẩn (R16): có tiêu chí G1–G5 với CW > 0, có tiêu chí G7 với CW > 0 trong ma trận hiện hành, và có hồ sơ Holland.
-- Tính từ dữ liệu đang có trong DB nên dòng quản trị sửa tay cũng được tính.
CREATE OR REPLACE FUNCTION public.refresh_career_standard(p_career_ids uuid[] DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_version uuid;
  v_count integer;
BEGIN
  SELECT id INTO v_version FROM public.career_matrix_versions WHERE is_current;
  WITH main_ok AS (
    SELECT DISTINCT r.career_id FROM public.career_requirements r
      JOIN public.criteria c ON c.id = r.criteria_id
      JOIN public.criteria_groups g ON g.id = c.group_id
     WHERE r.matrix_version_id = v_version AND r.career_weight > 0 AND g.group_code IN ('G1', 'G2', 'G3', 'G4', 'G5')
  ), g7_ok AS (
    SELECT DISTINCT r.career_id FROM public.career_requirements r
      JOIN public.criteria c ON c.id = r.criteria_id
      JOIN public.criteria_groups g ON g.id = c.group_id
     WHERE r.matrix_version_id = v_version AND r.career_weight > 0 AND g.group_code = 'G7'
  ), top3 AS (
    SELECT career_id, string_agg(holland_code::text, '' ORDER BY strength DESC, position(holland_code::text IN 'RIASEC')) AS code
      FROM (
        SELECT h.*, row_number() OVER (PARTITION BY h.career_id ORDER BY h.strength DESC, position(h.holland_code::text IN 'RIASEC')) AS rn
          FROM public.career_holland_profiles h WHERE h.strength > 0
      ) x WHERE rn <= 3 GROUP BY career_id
  )
  UPDATE public.careers c SET
    holland_top3 = COALESCE(t.code, c.holland_top3),
    is_standard_complete = (m.career_id IS NOT NULL AND g.career_id IS NOT NULL AND COALESCE(t.code, c.holland_top3) IS NOT NULL)
  FROM public.careers c2
  LEFT JOIN main_ok m ON m.career_id = c2.id
  LEFT JOIN g7_ok g ON g.career_id = c2.id
  LEFT JOIN top3 t ON t.career_id = c2.id
  WHERE c.id = c2.id AND (p_career_ids IS NULL OR c.id = ANY (p_career_ids))
    AND (c.is_standard_complete IS DISTINCT FROM (m.career_id IS NOT NULL AND g.career_id IS NOT NULL AND COALESCE(t.code, c.holland_top3) IS NOT NULL)
         OR c.holland_top3 IS DISTINCT FROM COALESCE(t.code, c.holland_top3));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Tự công bố: chỉ nghề đang ở Nháp, đủ chuẩn và đủ số JD tối thiểu P16. Không đụng nghề Ẩn hoặc Đang duyệt.
CREATE OR REPLACE FUNCTION public.auto_publish_careers()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_min integer := public.param_num('career_min_jd', 1)::integer;
  v_count integer;
BEGIN
  UPDATE public.careers SET status = 'published'
   WHERE status = 'draft' AND is_standard_complete AND qualifying_jd_count >= v_min;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    PERFORM public.write_audit_log(NULL, NULL, 'auto_publish_careers', 'careers', NULL,
      jsonb_build_object('count', v_count, 'min_jd', v_min));
  END IF;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_career_standard(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_publish_careers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_career_standard(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_publish_careers() TO service_role;
