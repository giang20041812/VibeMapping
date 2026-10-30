-- ====================================================================
-- Phase 1 / Migration: Học sinh không tự đánh giá mình qua đường dẫn mời của chính mình
--
-- Người mở đường dẫn đang đăng nhập đúng tài khoản chủ đường dẫn:
-- 1. get_invitation_public trả state 'own_link' (giao diện báo không làm được, không hiện chọn nhóm).
-- 2. start_360_submission báo lỗi 'own_invitation', không tạo bài nháp.
-- 3. get_360_session trả link_state 'own_link' cho bài nháp đã lỡ tạo trước bản vá này.
-- 4. Trigger chặn nộp (draft -> pending) bài mời của chính mình, kể cả gọi thẳng API bằng mã làm tiếp.
-- Mở bằng trình duyệt chưa đăng nhập thì không phân biệt được chủ đường dẫn; luật một IP một bài vẫn áp dụng.
-- ====================================================================

-- 1. Trạng thái đường dẫn ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_invitation_public(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l public.invitation_links;
  v_display text;
  v_state text;
BEGIN
  SELECT * INTO l FROM public.invitation_links WHERE link_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;
  IF l.user_id = auth.uid() THEN
    RETURN jsonb_build_object('state', 'own_link');
  END IF;
  IF l.revoked_at IS NOT NULL THEN
    v_state := 'revoked';
  ELSIF l.expires_at <= now() THEN
    v_state := 'expired';
  ELSIF (SELECT count(*) FROM public.assessment_360_submissions s
          WHERE s.invitation_link_id = l.id AND s.status <> 'draft') >= l.expected_count THEN
    v_state := 'full';
  ELSE
    v_state := 'valid';
  END IF;
  SELECT display_name INTO v_display FROM public.user_profiles WHERE id = l.user_id;
  RETURN jsonb_build_object('state', v_state, 'rater_group', l.rater_group, 'subject_display_name', v_display);
END;
$$;

-- 2. Bắt đầu bài ------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_360_submission(
  p_token text, p_nickname text, p_relationship text,
  p_acquaintance_duration smallint, p_contact_frequency smallint, p_observation_depth smallint
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l public.invitation_links;
  v_ip inet := public.request_ip();
  v_existing public.assessment_360_submissions;
  v_resume text;
BEGIN
  SELECT * INTO l FROM public.invitation_links WHERE link_token = p_token;
  IF NOT FOUND OR l.revoked_at IS NOT NULL OR l.expires_at <= now() THEN
    RAISE EXCEPTION 'invitation_unavailable';
  END IF;
  IF l.user_id = auth.uid() THEN
    RAISE EXCEPTION 'own_invitation';
  END IF;

  IF v_ip IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.assessment_360_submissions
     WHERE invitation_link_id = l.id AND submitter_ip = v_ip;
    IF FOUND THEN
      IF v_existing.status = 'draft' THEN
        RETURN v_existing.resume_token;      -- tiếp tục bài đang làm dở
      END IF;
      RAISE EXCEPTION 'duplicate_ip';
    END IF;
  END IF;

  IF (SELECT count(*) FROM public.assessment_360_submissions s WHERE s.invitation_link_id = l.id)
       >= l.expected_count THEN
    RAISE EXCEPTION 'link_full';
  END IF;

  INSERT INTO public.assessment_360_submissions (
    subject_user_id, rater_group, submission_channel, invitation_link_id,
    rater_nickname, relationship_label,
    acquaintance_duration, contact_frequency, observation_depth,
    understanding_score, submitter_ip
  ) VALUES (
    l.user_id, l.rater_group, 'invite_link', l.id,
    left(p_nickname, 40), left(p_relationship, 80),
    p_acquaintance_duration, p_contact_frequency, p_observation_depth,
    p_acquaintance_duration + p_contact_frequency + p_observation_depth, v_ip
  ) RETURNING resume_token INTO v_resume;
  RETURN v_resume;
END;
$$;

-- 3. Đọc lại bài nháp -------------------------------------------------------------------------------------------
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
    WHEN s.subject_user_id = auth.uid() THEN 'own_link'
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

-- 4. Chặn nộp bài mời của chính mình ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_own_invite_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'draft' AND NEW.status <> 'draft' AND NEW.submission_channel = 'invite_link'
     AND NEW.subject_user_id = auth.uid() THEN
    RAISE EXCEPTION 'own_invitation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.block_own_invite_submission() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS block_own_invite_submission ON public.assessment_360_submissions;
CREATE TRIGGER block_own_invite_submission
  BEFORE UPDATE OF status ON public.assessment_360_submissions
  FOR EACH ROW EXECUTE FUNCTION public.block_own_invite_submission();
