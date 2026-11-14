-- ====================================================================
-- Phase 1 / Migration 5: Thông báo, nhật ký hệ thống, hàm RPC cho khách và giáo viên
-- Khách (người được mời) không có tài khoản: chỉ truy cập qua các hàm bên dưới,
-- không được đọc trực tiếp bất kỳ bảng nào.
-- ====================================================================

-- 1. notifications & notification_settings ---------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN (
    'new_submission', 'result_changed', 'result_finalized', 'link_expiring', 'class_update'
  )),
  title text NOT NULL,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  in_app_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT notification_settings_unique UNIQUE (user_id, notification_type)
);

-- 2. audit_logs ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  subject_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  ip_address inet,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_subject ON public.audit_logs(subject_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id, created_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['notifications','notification_settings','audit_logs']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%1$s_updated_at ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER set_%1$s_updated_at BEFORE UPDATE ON public.%1$s
                    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Owner reads notifications" ON public.notifications;
CREATE POLICY "Owner reads notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Owner marks notifications read" ON public.notifications;
CREATE POLICY "Owner marks notifications read" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owner manages notification settings" ON public.notification_settings;
CREATE POLICY "Owner manages notification settings" ON public.notification_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin reads audit logs" ON public.audit_logs;
CREATE POLICY "Admin reads audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_system_admin());

-- 3. Hàm tiện ích nội bộ ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_actor uuid, p_subject uuid, p_action text, p_target_type text, p_target_id uuid, p_details jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, subject_user_id, action, target_type, target_id, ip_address, details)
  VALUES (p_actor, p_subject, p_action, p_target_type, p_target_id, public.request_ip(), COALESCE(p_details, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.request_ip()
RETURNS inet LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_header text;
BEGIN
  BEGIN
    v_header := (current_setting('request.headers', true)::json) ->> 'x-forwarded-for';
    RETURN NULLIF(trim(split_part(v_header, ',', 1)), '')::inet;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_parameter(p_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT param_value FROM public.operation_parameters WHERE param_code = p_code AND is_current;
$$;

CREATE OR REPLACE FUNCTION public.push_notification(
  p_user uuid, p_type text, p_title text, p_body text, p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE((SELECT in_app_enabled FROM public.notification_settings
                WHERE user_id = p_user AND notification_type = p_type), true) THEN
    INSERT INTO public.notifications (user_id, notification_type, title, body, payload)
    VALUES (p_user, p_type, p_title, p_body, p_payload);
  END IF;
END;
$$;

-- 4. RPC cho khách ---------------------------------------------------------------------
-- 4.1 Trạng thái đường dẫn khi khách mở link
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

-- 4.2 Bắt đầu bài: khai báo thông tin ban đầu, trả về resume_token
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

-- 4.3 Câu hỏi dành cho nhóm của người được mời
CREATE OR REPLACE FUNCTION public.get_360_questions(p_resume_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_360_submissions;
  v_segment text;
BEGIN
  SELECT * INTO s FROM public.assessment_360_submissions WHERE resume_token = p_resume_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'submission_not_found'; END IF;
  SELECT CASE role WHEN 'university_student' THEN 'university_student' ELSE 'student' END
    INTO v_segment FROM public.user_profiles WHERE id = s.subject_user_id;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'question_id', q.id, 'criteria_id', q.criteria_id,
             'dimension_code', c.dimension_code, 'content', q.content, 'answer_options', q.answer_options
           ) ORDER BY c.sort_order, q.question_code)
      FROM public.questions q
      JOIN public.criteria c ON c.id = q.criteria_id AND c.is_active
      JOIN public.criteria_rater_visibility v ON v.criteria_id = c.id AND v.rater_group = s.rater_group AND v.is_visible
     WHERE q.rater_group = s.rater_group AND q.is_active
       AND q.respondent_segment IN ('all', v_segment)
  ), '[]'::jsonb);
END;
$$;

-- 4.4 Lưu nháp câu trả lời: [{"question_id": "...", "score": 1-5 | null, "insufficient": bool}]
CREATE OR REPLACE FUNCTION public.save_360_answers(p_resume_token text, p_answers jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_360_submissions;
  l public.invitation_links;
  a jsonb;
  v_question public.questions;
BEGIN
  SELECT * INTO s FROM public.assessment_360_submissions WHERE resume_token = p_resume_token;
  IF NOT FOUND OR s.status <> 'draft' OR s.submission_channel <> 'invite_link' THEN
    RAISE EXCEPTION 'submission_not_editable';
  END IF;
  SELECT * INTO l FROM public.invitation_links WHERE id = s.invitation_link_id;
  IF l.revoked_at IS NOT NULL OR l.expires_at <= now() THEN
    RAISE EXCEPTION 'invitation_unavailable';
  END IF;

  FOR a IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    SELECT * INTO v_question FROM public.questions
     WHERE id = (a ->> 'question_id')::uuid AND rater_group = s.rater_group AND is_active;
    IF NOT FOUND THEN CONTINUE; END IF;
    INSERT INTO public.assessment_360_answers (submission_id, question_id, criteria_id, score, is_insufficient_basis)
    VALUES (
      s.id, v_question.id, v_question.criteria_id,
      CASE WHEN COALESCE((a ->> 'insufficient')::boolean, false) THEN NULL ELSE (a ->> 'score')::smallint END,
      COALESCE((a ->> 'insufficient')::boolean, false)
    )
    ON CONFLICT (submission_id, question_id) WHERE question_id IS NOT NULL
    DO UPDATE SET score = EXCLUDED.score, is_insufficient_basis = EXCLUDED.is_insufficient_basis;
  END LOOP;
END;
$$;

-- 4.5 Nộp bài: chặn nếu còn câu trống; gắn cờ chất lượng nhưng vẫn cho nộp
CREATE OR REPLACE FUNCTION public.submit_360(p_resume_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_360_submissions;
  l public.invitation_links;
  v_required uuid[];
  v_answered uuid[];
  v_missing uuid[];
  v_seconds integer;
  v_min_seconds integer;
  v_uniform_min integer := COALESCE((public.get_parameter('uniform_score_min_criteria'))::text::integer, 7);
  v_scored integer;
  v_distinct integer;
  v_too_fast boolean := false;
  v_uniform boolean := false;
  v_flag text := 'ok';
BEGIN
  SELECT * INTO s FROM public.assessment_360_submissions WHERE resume_token = p_resume_token FOR UPDATE;
  IF NOT FOUND OR s.status <> 'draft' THEN RAISE EXCEPTION 'submission_not_editable'; END IF;
  SELECT * INTO l FROM public.invitation_links WHERE id = s.invitation_link_id;
  IF l.revoked_at IS NOT NULL OR l.expires_at <= now() THEN RAISE EXCEPTION 'invitation_unavailable'; END IF;

  SELECT array_agg((x ->> 'question_id')::uuid) INTO v_required
    FROM jsonb_array_elements(public.get_360_questions(p_resume_token)) x;
  SELECT array_agg(question_id) INTO v_answered
    FROM public.assessment_360_answers WHERE submission_id = s.id;
  SELECT array_agg(q) INTO v_missing
    FROM unnest(COALESCE(v_required, ARRAY[]::uuid[])) q
   WHERE q <> ALL (COALESCE(v_answered, ARRAY[]::uuid[]));
  IF v_missing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_answers', 'missing_question_ids', to_jsonb(v_missing));
  END IF;

  v_seconds := extract(epoch FROM (now() - s.started_at))::integer;
  BEGIN
    v_min_seconds := (public.get_parameter('min_completion_seconds'))::text::integer;
  EXCEPTION WHEN OTHERS THEN
    v_min_seconds := NULL;     -- ngưỡng chưa được cấu hình thì không kiểm tra
  END;
  v_too_fast := v_min_seconds IS NOT NULL AND v_seconds < v_min_seconds;

  SELECT count(score), count(DISTINCT score) INTO v_scored, v_distinct
    FROM public.assessment_360_answers WHERE submission_id = s.id AND score IS NOT NULL;
  v_uniform := v_scored >= v_uniform_min AND v_distinct = 1;

  v_flag := CASE WHEN v_too_fast AND v_uniform THEN 'both'
                 WHEN v_too_fast THEN 'too_fast'
                 WHEN v_uniform THEN 'uniform_scores' ELSE 'ok' END;

  UPDATE public.assessment_360_submissions
     SET status = 'pending', quality_flag = v_flag, completion_seconds = v_seconds, submitted_at = now()
   WHERE id = s.id;

  PERFORM public.push_notification(s.subject_user_id, 'new_submission', 'Có bài đánh giá mới',
    NULL, jsonb_build_object('submission_id', s.id, 'rater_group', s.rater_group));
  PERFORM public.write_audit_log(NULL, s.subject_user_id, 'submit_360', 'assessment_360_submissions', s.id,
    jsonb_build_object('quality_flag', v_flag));

  RETURN jsonb_build_object('ok', true, 'quality_flag', v_flag);
END;
$$;

-- 5. RPC cho HS/SV: chấp nhận hoặc loại bài ------------------------------------------------
CREATE OR REPLACE FUNCTION public.decide_submission(p_submission_id uuid, p_decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_360_submissions;
BEGIN
  IF p_decision NOT IN ('accepted', 'rejected') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  SELECT * INTO s FROM public.assessment_360_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND OR s.subject_user_id <> auth.uid() OR s.status = 'draft' THEN
    RAISE EXCEPTION 'submission_not_found';
  END IF;
  UPDATE public.assessment_360_submissions
     SET status = p_decision, decided_at = now() WHERE id = s.id;
  PERFORM public.write_audit_log(auth.uid(), s.subject_user_id, 'decide_submission',
    'assessment_360_submissions', s.id, jsonb_build_object('decision', p_decision));
END;
$$;

-- 6. RPC cho giáo viên: nộp bảng lưới -> tạo bài đánh giá đã chấp nhận cho từng học sinh -------------
CREATE OR REPLACE FUNCTION public.submit_class_grid(p_grid_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.class_assessment_grids;
  gs public.class_assessment_grid_students;
  v_short_count integer;
  v_empty integer;
  v_sub_id uuid;
  v_score smallint;
BEGIN
  SELECT * INTO g FROM public.class_assessment_grids WHERE id = p_grid_id FOR UPDATE;
  IF NOT FOUND OR g.teacher_id <> auth.uid() THEN RAISE EXCEPTION 'grid_not_found'; END IF;
  IF g.status = 'submitted' THEN RAISE EXCEPTION 'grid_already_submitted'; END IF;

  SELECT count(*) INTO v_short_count FROM public.criteria WHERE is_short_set AND is_active;
  IF v_short_count = 0 THEN RAISE EXCEPTION 'short_set_not_configured'; END IF;

  -- Mỗi học sinh phải có đủ ô (điểm hoặc "không đủ cơ sở") cho mọi tiêu chí rút gọn
  SELECT count(*) INTO v_empty
    FROM public.class_assessment_grid_students s
    CROSS JOIN public.criteria c
    LEFT JOIN public.class_assessment_grid_details d ON d.grid_student_id = s.id AND d.criteria_id = c.id
   WHERE s.grid_id = g.id AND c.is_short_set AND c.is_active
     AND (d.id IS NULL OR (d.score IS NULL AND NOT d.is_insufficient_basis));
  IF v_empty > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty_cells', 'empty_count', v_empty);
  END IF;

  FOR gs IN SELECT * FROM public.class_assessment_grid_students WHERE grid_id = g.id
  LOOP
    INSERT INTO public.assessment_360_submissions (
      subject_user_id, rater_group, submission_channel, grid_student_id,
      acquaintance_duration, contact_frequency, observation_depth, understanding_score,
      status, submitted_at, decided_at
    ) VALUES (
      gs.student_id, 'teacher', 'classroom_grid', gs.id,
      COALESCE(gs.acquaintance_duration, g.default_acquaintance_duration),
      COALESCE(gs.contact_frequency, g.default_contact_frequency),
      COALESCE(gs.observation_depth, g.default_observation_depth),
      COALESCE(gs.acquaintance_duration, g.default_acquaintance_duration)
        + COALESCE(gs.contact_frequency, g.default_contact_frequency)
        + COALESCE(gs.observation_depth, g.default_observation_depth),
      'accepted', now(), now()
    )
    ON CONFLICT (grid_student_id) DO UPDATE SET status = 'accepted', submitted_at = now(), decided_at = now()
    RETURNING id INTO v_sub_id;

    DELETE FROM public.assessment_360_answers WHERE submission_id = v_sub_id;
    INSERT INTO public.assessment_360_answers (submission_id, question_id, criteria_id, score, is_insufficient_basis)
    SELECT v_sub_id, NULL, d.criteria_id, d.score, d.is_insufficient_basis
      FROM public.class_assessment_grid_details d WHERE d.grid_student_id = gs.id;

    -- Bài từ bảng lưới đã ở trạng thái accepted ngay khi tạo nên không qua trigger; tính lại tại đây
    PERFORM public.recalculate_latest_result(gs.student_id);
  END LOOP;

  UPDATE public.class_assessment_grids SET status = 'submitted', submitted_at = now() WHERE id = g.id;
  PERFORM public.write_audit_log(auth.uid(), NULL, 'submit_class_grid', 'class_assessment_grids', g.id, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 7. Phân quyền thực thi: khách chỉ gọi 5 hàm đầu tiên ---------------------------------------------
REVOKE ALL ON FUNCTION public.get_invitation_public(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_360_submission(text, text, text, smallint, smallint, smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_360_questions(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_360_answers(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_360(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decide_submission(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_class_grid(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.write_audit_log(uuid, uuid, text, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.push_notification(uuid, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_parameter(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_invitation_public(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_360_submission(text, text, text, smallint, smallint, smallint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_360_questions(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_360_answers(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_360(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_submission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_class_grid(uuid) TO authenticated;
