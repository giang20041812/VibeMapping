-- ====================================================================
-- Phase 1 / Migration 11: Khách đọc lại trạng thái bài và bản nháp
-- Khách chỉ có mã làm tiếp (resume_token) của bài mình; hàm trả về trạng thái, nhóm người chấm,
-- tên hiển thị của HS/SV được đánh giá và các câu đã trả lời. Không trả bất kỳ dữ liệu bài khác.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_360_session(p_resume_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_360_submissions;
  l public.invitation_links;
  v_display text;
  v_link_state text;
BEGIN
  SELECT * INTO s FROM public.assessment_360_submissions
   WHERE resume_token = p_resume_token AND submission_channel = 'invite_link';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT * INTO l FROM public.invitation_links WHERE id = s.invitation_link_id;
  SELECT display_name INTO v_display FROM public.user_profiles WHERE id = s.subject_user_id;

  v_link_state := CASE
    WHEN l.id IS NULL OR l.revoked_at IS NOT NULL THEN 'revoked'
    WHEN l.expires_at <= now() THEN 'expired'
    ELSE 'valid' END;

  RETURN jsonb_build_object(
    'status', s.status,                                  -- draft | pending | accepted | rejected
    'link_state', v_link_state,
    'rater_group', s.rater_group,
    'subject_display_name', v_display,
    'started_at', s.started_at,
    'answers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'question_id', a.question_id, 'score', a.score, 'insufficient', a.is_insufficient_basis))
        FROM public.assessment_360_answers a WHERE a.submission_id = s.id AND a.question_id IS NOT NULL
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_360_session(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_360_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_360_session(text) TO service_role;

-- Câu hỏi cho khách kèm tên tiêu chí (hiển thị nhãn thay vì mã)
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
             'dimension_code', x.dimension_code, 'criteria_name', x.criteria_name,
             'content', x.content, 'answer_options', x.answer_options
           ) ORDER BY x.sort_order, x.question_code)
      FROM (
        SELECT q.id, q.criteria_id, c.dimension_code, c.name AS criteria_name, c.sort_order, q.question_code,
               q.content, q.answer_options,
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
REVOKE ALL ON FUNCTION public.get_360_questions(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_360_questions(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_360_questions(text) TO service_role;
