-- ====================================================================
-- Phase 1 / Migration 19: Bộ rút gọn chỉ gồm tiêu chí giáo viên chấm được; nhóm G nổi trội của học sinh trong lớp
--
-- 1. Ma trận THANG ĐO: giáo viên không chấm một số tiêu chí (D6.3, D6.4). Tiêu chí ẩn với giáo viên
--    không được thuộc bộ rút gọn, và tiêu chí đang thuộc bộ rút gọn không được ẩn với giáo viên.
-- 2. get_class_dominant_groups: nhóm G có điểm cao nhất của từng học sinh, dùng cho bộ lọc học sinh theo nhóm tố chất.
-- ====================================================================

-- 1. Ràng buộc bộ rút gọn ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_short_set_criteria()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_short_set AND EXISTS (
    SELECT 1 FROM public.criteria_rater_visibility v
     WHERE v.criteria_id = NEW.id AND v.rater_group = 'teacher' AND NOT v.is_visible
  ) THEN
    RAISE EXCEPTION 'short_set_not_visible_to_teacher';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_short_set_criteria ON public.criteria;
CREATE TRIGGER validate_short_set_criteria
  BEFORE INSERT OR UPDATE OF is_short_set ON public.criteria
  FOR EACH ROW EXECUTE FUNCTION public.validate_short_set_criteria();

CREATE OR REPLACE FUNCTION public.validate_teacher_visibility()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.rater_group = 'teacher' AND NOT NEW.is_visible AND EXISTS (
    SELECT 1 FROM public.criteria c WHERE c.id = NEW.criteria_id AND c.is_short_set
  ) THEN
    RAISE EXCEPTION 'short_set_not_visible_to_teacher';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_teacher_visibility ON public.criteria_rater_visibility;
CREATE TRIGGER validate_teacher_visibility
  BEFORE INSERT OR UPDATE OF is_visible ON public.criteria_rater_visibility
  FOR EACH ROW EXECUTE FUNCTION public.validate_teacher_visibility();

-- Dữ liệu đã có: bỏ đánh dấu rút gọn ở tiêu chí giáo viên không chấm được
UPDATE public.criteria c SET is_short_set = false
 WHERE c.is_short_set AND EXISTS (
   SELECT 1 FROM public.criteria_rater_visibility v
    WHERE v.criteria_id = c.id AND v.rater_group = 'teacher' AND NOT v.is_visible);

-- 2. Nhóm G nổi trội của học sinh trong lớp -------------------------------------------------------------------------
-- Mỗi học sinh lấy kết quả mới nhất, ưu tiên điểm tổng hợp 360° (như báo cáo lớp), nhóm có điểm % cao nhất.
-- Học sinh chưa có kết quả không có dòng nào. Chỉ giáo viên của lớp gọi được.
CREATE OR REPLACE FUNCTION public.get_class_dominant_groups(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_class_teacher(p_class_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('student_id', t.user_id, 'group_code', t.group_code)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT DISTINCT ON (m.user_id) m.user_id, cg.group_code
        FROM public.class_members m
        JOIN LATERAL (
          SELECT r.id FROM public.assessment_results r
           WHERE r.user_id = m.user_id ORDER BY r.created_at DESC LIMIT 1
        ) lr ON true
        JOIN LATERAL (
          SELECT DISTINCT ON (gs.group_id) gs.group_id, gs.score_percent
            FROM public.assessment_result_group_scores gs
           WHERE gs.result_id = lr.id AND gs.score_percent IS NOT NULL
           ORDER BY gs.group_id, (gs.score_source = 'combined_360') DESC
        ) s ON true
        JOIN public.criteria_groups cg ON cg.id = s.group_id
       WHERE m.class_id = p_class_id AND m.member_role = 'student' AND m.status = 'joined' AND m.user_id IS NOT NULL
       ORDER BY m.user_id, s.score_percent DESC, cg.sort_order
    ) t;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_class_dominant_groups(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_class_dominant_groups(uuid) TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
  END IF;
END $$;
