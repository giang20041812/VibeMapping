-- ====================================================================
-- Phase 3: vá quyền, trọng số định tính, lưới rút gọn, module M04–M09
-- Không xóa dữ liệu JD, bài làm hay bảng lưới đã nộp.
-- Career Fit tổng không được tính tại đây vì RIASEC Match còn BLOCKED.
-- ====================================================================

-- 1. Hồ sơ: người dùng không tự xác nhận giám hộ -----------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Script bảo trì / service role không có phiên người dùng
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'role_change_forbidden';
  END IF;
  IF NEW.guardian_consent_confirmed IS DISTINCT FROM OLD.guardian_consent_confirmed
     AND current_setting('app.allow_guardian_flag', true) IS DISTINCT FROM '1'
     AND NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'guardian_consent_not_self_service';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.user_profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- Dưới 16 tuổi chưa có xác nhận thì không tạo lời mời 360
CREATE OR REPLACE FUNCTION public.block_invite_without_guardian()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_dob date;
  v_confirmed boolean;
BEGIN
  SELECT date_of_birth, guardian_consent_confirmed INTO v_dob, v_confirmed
    FROM public.user_profiles WHERE id = NEW.user_id;
  IF public.is_under_guardian_age(v_dob) AND NOT COALESCE(v_confirmed, false) THEN
    RAISE EXCEPTION 'guardian_consent_required';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_invite_without_guardian ON public.invitation_links;
CREATE TRIGGER block_invite_without_guardian
  BEFORE INSERT ON public.invitation_links
  FOR EACH ROW EXECUTE FUNCTION public.block_invite_without_guardian();

-- 2. Nhật ký bất biến; quản trị không xem kết quả im lặng ---------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs_immutable';
END;
$$;

DROP TRIGGER IF EXISTS prevent_audit_mutation ON public.audit_logs;
CREATE TRIGGER prevent_audit_mutation
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE OR REPLACE FUNCTION public.can_view_result_of(p_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_owner = auth.uid() OR EXISTS (
    SELECT 1 FROM public.consent_records c
     WHERE c.user_id = p_owner AND c.granted_to_user_id = auth.uid()
       AND c.consent_type = 'share_result' AND c.revoked_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.user_relationships r
     WHERE r.target_id = p_owner AND r.requester_id = auth.uid()
       AND r.relationship_type = 'parent' AND r.status = 'accepted'
       AND EXISTS (
         SELECT 1 FROM public.consent_records c
          WHERE c.user_id = p_owner AND c.granted_to_user_id = auth.uid()
            AND c.consent_type = 'share_result' AND c.revoked_at IS NULL
       )
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_inspect_result(p_owner uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 8 THEN RAISE EXCEPTION 'audit_reason_required'; END IF;
  PERFORM public.write_audit_log(auth.uid(), p_owner, 'inspect_result', 'user_profiles', p_owner,
    jsonb_build_object('reason', trim(p_reason)));
  SELECT jsonb_build_object(
    'id', r.id, 'status_label', r.status_label, 'accepted_count', r.accepted_count,
    'thin_data_flag', r.thin_data_flag, 'calculated_at', r.calculated_at
  ) INTO v_result
    FROM public.assessment_results r
   WHERE r.user_id = p_owner
   ORDER BY r.created_at DESC LIMIT 1;
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_inspect_result(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_inspect_result(uuid, text) TO authenticated;

-- 3. Giám hộ 15 phút và mã liên kết phụ huynh ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guardian_consent_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.guardian_consent_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.parent_link_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.parent_link_codes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_guardian_consent_token()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_token text := md5(gen_random_uuid()::text || clock_timestamp()::text);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.guardian_consent_tokens (subject_user_id, token, expires_at)
  VALUES (auth.uid(), v_token, now() + interval '15 minutes');
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_guardian_consent(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.guardian_consent_tokens;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_row FROM public.guardian_consent_tokens WHERE token = p_token FOR UPDATE;
  IF NOT FOUND OR v_row.used_at IS NOT NULL OR v_row.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_invalid');
  END IF;
  IF v_row.subject_user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'subject_cannot_self_confirm');
  END IF;
  PERFORM set_config('app.allow_guardian_flag', '1', true);
  UPDATE public.user_profiles SET guardian_consent_confirmed = true WHERE id = v_row.subject_user_id;
  UPDATE public.guardian_consent_tokens SET used_at = now() WHERE id = v_row.id;
  INSERT INTO public.consent_records (user_id, consent_type, granted_to_user_id, displayed_content)
  VALUES (v_row.subject_user_id, 'guardian_confirmation', auth.uid(),
          'Người giám hộ xác nhận cho học sinh dưới 16 tuổi tham gia đánh giá.');
  PERFORM public.write_audit_log(auth.uid(), v_row.subject_user_id, 'confirm_guardian', 'user_profiles', v_row.subject_user_id, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_parent_link_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text := upper(substr(md5(gen_random_uuid()::text), 1, 8));
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.user_profiles WHERE id = auth.uid();
  IF v_role NOT IN ('student', 'university_student') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.parent_link_codes (student_id, code, expires_at)
  VALUES (auth.uid(), v_code, now() + interval '24 hours');
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_parent_link(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.parent_link_codes;
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.user_profiles WHERE id = auth.uid();
  IF v_role <> 'parent' THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_row FROM public.parent_link_codes WHERE code = upper(trim(p_code)) FOR UPDATE;
  IF NOT FOUND OR v_row.used_at IS NOT NULL OR v_row.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'code_invalid');
  END IF;
  INSERT INTO public.user_relationships (requester_id, target_id, relationship_type, status, responded_at)
  VALUES (auth.uid(), v_row.student_id, 'parent', 'accepted', now())
  ON CONFLICT (requester_id, target_id, relationship_type)
  DO UPDATE SET status = 'accepted', responded_at = now();
  UPDATE public.parent_link_codes SET used_at = now(), used_by = auth.uid() WHERE id = v_row.id;
  RETURN jsonb_build_object('ok', true, 'student_id', v_row.student_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_guardian_consent_token() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_guardian_consent(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_parent_link_code() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_parent_link(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_guardian_consent_token() TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_guardian_consent(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_parent_link_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_parent_link(text) TO authenticated;

-- 4. Câu trả lời mở và S_i do người chấm nhập, không tự chấm văn bản ------------------------
CREATE TABLE IF NOT EXISTS public.qualitative_open_answers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES public.assessment_360_submissions(id) ON DELETE CASCADE,
  aspect text NOT NULL CHECK (aspect IN ('interest', 'ability', 'value', 'blind_spot', 'companion')),
  response_text text NOT NULL CHECK (length(trim(response_text)) > 0),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT qualitative_open_answers_unique UNIQUE (submission_id, aspect)
);
ALTER TABLE public.qualitative_open_answers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.qualitative_evaluations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL UNIQUE REFERENCES public.assessment_360_submissions(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  empathic_accuracy smallint[] NOT NULL,
  solo_scores smallint[] NOT NULL,
  carkhuff numeric(3, 2),
  supplemental_score numeric(5, 2) NOT NULL CHECK (supplemental_score BETWEEN 0 AND 100),
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.qualitative_evaluations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.supplemental_understanding_score(
  p_group public.rater_group, p_ea smallint[], p_solo smallint[], p_carkhuff numeric
) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_ea numeric;
  v_solo numeric;
  v_carkhuff numeric;
BEGIN
  IF p_group = 'self' THEN RAISE EXCEPTION 'self_has_no_supplemental_score'; END IF;
  IF p_ea IS NULL OR array_length(p_ea, 1) <> 4 OR EXISTS (SELECT 1 FROM unnest(p_ea) v WHERE v < 0 OR v > 2) THEN
    RAISE EXCEPTION 'invalid_ea';
  END IF;
  IF p_solo IS NULL OR array_length(p_solo, 1) <> 4 OR EXISTS (SELECT 1 FROM unnest(p_solo) v WHERE v < 1 OR v > 5) THEN
    RAISE EXCEPTION 'invalid_solo';
  END IF;
  v_ea := (SELECT sum(v) FROM unnest(p_ea) v) / 8.0 * 100;
  v_solo := (SELECT sum(v) FROM unnest(p_solo) v) / 20.0 * 100;
  IF p_group = 'friend' THEN RETURN 0.7 * v_ea + 0.3 * v_solo; END IF;
  IF p_carkhuff IS NULL OR p_carkhuff < 1 OR p_carkhuff > 5 THEN RAISE EXCEPTION 'invalid_carkhuff'; END IF;
  v_carkhuff := p_carkhuff / 5.0 * 100;
  IF p_group = 'parent' THEN RETURN 0.5 * v_ea + 0.25 * v_solo + 0.25 * v_carkhuff; END IF;
  IF p_group = 'teacher' THEN RETURN 0.4 * v_ea + 0.4 * v_solo + 0.2 * v_carkhuff; END IF;
  RETURN 0.35 * v_ea + 0.35 * v_solo + 0.3 * v_carkhuff;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_qualitative_open_answers(p_resume_token text, p_answers jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_360_submissions;
  a jsonb;
  v_aspect text;
  v_text text;
BEGIN
  SELECT * INTO s FROM public.assessment_360_submissions WHERE resume_token = p_resume_token;
  IF NOT FOUND OR s.status <> 'draft' OR s.submission_channel <> 'invite_link' THEN
    RAISE EXCEPTION 'submission_not_editable';
  END IF;
  FOR a IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    v_aspect := a ->> 'aspect';
    v_text := trim(COALESCE(a ->> 'text', ''));
    IF v_aspect NOT IN ('interest', 'ability', 'value', 'blind_spot', 'companion') OR v_text = '' THEN
      RAISE EXCEPTION 'invalid_open_answer';
    END IF;
    IF v_aspect = 'companion' AND s.rater_group = 'friend' THEN RAISE EXCEPTION 'companion_not_for_friend'; END IF;
    INSERT INTO public.qualitative_open_answers (submission_id, aspect, response_text)
    VALUES (s.id, v_aspect, v_text)
    ON CONFLICT (submission_id, aspect) DO UPDATE SET response_text = EXCLUDED.response_text, updated_at = now();
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_open_answers_before_submit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_core integer;
BEGIN
  IF OLD.status = 'draft' AND NEW.status IS DISTINCT FROM 'draft' AND NEW.submission_channel = 'invite_link'
     AND COALESCE((public.get_parameter('require_open_answers') #>> '{}')::boolean, false) THEN
    SELECT count(*) INTO v_core FROM public.qualitative_open_answers
     WHERE submission_id = NEW.id AND aspect IN ('interest', 'ability', 'value', 'blind_spot');
    IF v_core < 4 THEN RAISE EXCEPTION 'open_answers_required'; END IF;
    IF NEW.rater_group IN ('parent', 'teacher', 'mentor') AND NOT EXISTS (
      SELECT 1 FROM public.qualitative_open_answers WHERE submission_id = NEW.id AND aspect = 'companion'
    ) THEN
      RAISE EXCEPTION 'companion_answer_required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_open_answers_before_submit ON public.assessment_360_submissions;
CREATE TRIGGER require_open_answers_before_submit
  BEFORE UPDATE OF status ON public.assessment_360_submissions
  FOR EACH ROW EXECUTE FUNCTION public.require_open_answers_before_submit();

CREATE OR REPLACE FUNCTION public.list_qualitative_queue()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'submission_id', s.id,
      'rater_group', s.rater_group,
      'subject_name', COALESCE(p.display_name, p.full_name, ''),
      'submitted_at', s.submitted_at,
      'reviewed', s.understanding_quality_score IS NOT NULL
    ) ORDER BY s.submitted_at DESC NULLS LAST)
    FROM public.assessment_360_submissions s
    JOIN public.user_profiles p ON p.id = s.subject_user_id
    WHERE s.status = 'accepted' AND s.submission_channel = 'invite_link'
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_qualitative_case(p_submission_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_360_submissions;
  v_answers jsonb;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO s FROM public.assessment_360_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'submission_not_found'; END IF;
  PERFORM public.write_audit_log(auth.uid(), s.subject_user_id, 'read_qualitative_case', 'assessment_360_submissions', s.id, '{}'::jsonb);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('aspect', a.aspect, 'text', a.response_text)), '[]'::jsonb)
    INTO v_answers FROM public.qualitative_open_answers a WHERE a.submission_id = s.id;
  RETURN jsonb_build_object(
    'submission_id', s.id, 'rater_group', s.rater_group,
    'understanding_score', s.understanding_score,
    'supplemental_score', s.understanding_quality_score,
    'answers', v_answers
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_qualitative_evaluation(
  p_submission_id uuid, p_ea smallint[], p_solo smallint[], p_carkhuff numeric
) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_360_submissions;
  v_score numeric;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO s FROM public.assessment_360_submissions WHERE id = p_submission_id;
  IF NOT FOUND OR s.status <> 'accepted' THEN RAISE EXCEPTION 'submission_not_found'; END IF;
  IF (SELECT count(*) FROM public.qualitative_open_answers
       WHERE submission_id = s.id AND aspect IN ('interest', 'ability', 'value', 'blind_spot')) < 4 THEN
    RAISE EXCEPTION 'open_answers_missing';
  END IF;
  v_score := round(public.supplemental_understanding_score(s.rater_group, p_ea, p_solo, p_carkhuff), 2);
  INSERT INTO public.qualitative_evaluations (submission_id, reviewer_id, empathic_accuracy, solo_scores, carkhuff, supplemental_score)
  VALUES (s.id, auth.uid(), p_ea, p_solo, CASE WHEN s.rater_group = 'friend' THEN NULL ELSE p_carkhuff END, v_score)
  ON CONFLICT (submission_id) DO UPDATE
    SET reviewer_id = EXCLUDED.reviewer_id, empathic_accuracy = EXCLUDED.empathic_accuracy,
        solo_scores = EXCLUDED.solo_scores, carkhuff = EXCLUDED.carkhuff, supplemental_score = EXCLUDED.supplemental_score;
  UPDATE public.assessment_360_submissions SET understanding_quality_score = v_score WHERE id = s.id;
  PERFORM public.write_audit_log(auth.uid(), s.subject_user_id, 'score_qualitative', 'assessment_360_submissions', s.id,
    jsonb_build_object('supplemental_score', v_score));
  PERFORM public.recalculate_latest_result(s.subject_user_id);
  RETURN v_score;
END;
$$;

REVOKE ALL ON FUNCTION public.save_qualitative_open_answers(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_qualitative_queue() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_qualitative_case(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_qualitative_evaluation(uuid, smallint[], smallint[], numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_qualitative_open_answers(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_qualitative_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_qualitative_case(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_qualitative_evaluation(uuid, smallint[], smallint[], numeric) TO authenticated;

-- 5. Trọng số 360 (R02B, R03) -------------------------------------------------------------------
-- S_i chưa chấm: dùng tham số unreviewed_supplemental_default (mặc định 100, trung tính; null = không tính bài).
-- TH% có sàn understanding_percent_floor (mặc định 0 theo công thức gốc).
-- Tổng w = 0: zero_weight_equal_fallback = true thì chia đều các bài đã chấp nhận.
ALTER TABLE public.assessment_results
  ADD COLUMN IF NOT EXISTS qualitative_weight_status text NOT NULL DEFAULT 'not_applicable'
  CHECK (qualitative_weight_status IN ('not_applicable', 'included', 'equal_fallback', 'pending_review'));

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
         GREATEST((COALESCE(s2.understanding_score, 3) - 3) / 9.0 * 100, v_th_floor)
           * COALESCE(s2.understanding_quality_score, v_s_default)
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
  SELECT r.id, criteria_id, score_source, round(score, 3), round(score / 5 * 100, 2),
         CASE WHEN score / 5 * 100 >= (v_levels ->> 'very_high')::numeric THEN 'very_high'
              WHEN score / 5 * 100 >= (v_levels ->> 'high')::numeric THEN 'high'
              WHEN score / 5 * 100 >= (v_levels ->> 'medium')::numeric THEN 'medium'
              ELSE 'low' END
    FROM all_scores WHERE score IS NOT NULL;

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

-- 6. Nghề: đủ 3 thành phần (G1–G5, G7 có CW > 0 và Holland) thì công bố với mức kiểm định per_jd_data -----
-- Không ép 25/25 tiêu chí; JD đầu vào HSSV = L0, L1, L2 (tham số career_matrix_include_l0).
UPDATE public.careers c
   SET is_standard_complete = true, status = 'published'
 WHERE c.status IN ('draft', 'review')
   AND c.holland_top3 IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.career_requirements r JOIN public.criteria cr ON cr.id = r.criteria_id
                 JOIN public.criteria_groups g ON g.id = cr.group_id
                WHERE r.career_id = c.id AND r.career_weight > 0 AND g.group_code IN ('G1','G2','G3','G4','G5'))
   AND EXISTS (SELECT 1 FROM public.career_requirements r JOIN public.criteria cr ON cr.id = r.criteria_id
                 JOIN public.criteria_groups g ON g.id = cr.group_id
                WHERE r.career_id = c.id AND r.career_weight > 0 AND g.group_code = 'G7');

COMMENT ON COLUMN public.careers.is_standard_complete IS
  'Đủ 3 thành phần G1–G5, G7 (CW > 0) và Holland Top 3 từ JD L0–L2; mức kiểm định per_jd_data (Demo).';

UPDATE public.career_matrix_versions
   SET note = trim(both ' ' FROM COALESCE(note, '') ||
     ' Phạm vi tính Req/CW: JD L0, L1, L2 (Career Profile: L0 = Intern, L1 = Fresher, L2 = Junior). Chỉ tiêu chí có CW > 0.')
 WHERE is_current
   AND COALESCE(note, '') NOT LIKE '%JD L0, L1, L2%';

CREATE OR REPLACE VIEW public.career_matrix_job_descriptions
WITH (security_invoker = true) AS
SELECT * FROM public.career_job_descriptions
 WHERE career_level BETWEEN 0 AND 2 AND required_level IS NOT NULL;

GRANT SELECT ON public.career_matrix_job_descriptions TO authenticated;

-- 7. Lưới giáo viên: bộ tiêu chí rút gọn, giữ bảng đã chọn gói --------------------------------
ALTER TABLE public.class_assessment_grids
  ADD COLUMN IF NOT EXISTS grading_mode text NOT NULL DEFAULT 'short_set'
  CHECK (grading_mode IN ('short_set', 'question_package'));

UPDATE public.class_assessment_grids
   SET grading_mode = 'question_package'
 WHERE package_size IS NOT NULL AND grading_mode = 'short_set';

ALTER TABLE public.class_assessment_grid_students
  ADD COLUMN IF NOT EXISTS qualitative_note text;

CREATE OR REPLACE FUNCTION public.sync_grid_grading_mode()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.package_size IS NOT NULL THEN NEW.grading_mode := 'question_package'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_grid_grading_mode ON public.class_assessment_grids;
CREATE TRIGGER sync_grid_grading_mode
  BEFORE UPDATE OF package_size ON public.class_assessment_grids
  FOR EACH ROW EXECUTE FUNCTION public.sync_grid_grading_mode();

CREATE OR REPLACE FUNCTION public.assign_short_set_questions(p_grid_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.class_assessment_grids;
BEGIN
  SELECT * INTO g FROM public.class_assessment_grids WHERE id = p_grid_id FOR UPDATE;
  IF NOT FOUND OR g.status <> 'draft' OR g.grading_mode <> 'short_set' OR g.package_size IS NOT NULL THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.class_assessment_grid_questions WHERE grid_id = g.id) THEN
    RETURN;
  END IF;
  INSERT INTO public.class_assessment_grid_questions (grid_id, question_id, sort_order)
  SELECT g.id, picked.id, picked.sort_order
    FROM (
      SELECT q.id, c.sort_order
        FROM public.criteria c
        JOIN LATERAL (
          SELECT id FROM public.questions
           WHERE criteria_id = c.id AND is_active AND rater_group = 'self'
           ORDER BY question_code LIMIT 1
        ) q ON true
       WHERE c.is_active AND c.is_short_set
         AND NOT EXISTS (
           SELECT 1 FROM public.criteria_rater_visibility v
            WHERE v.criteria_id = c.id AND v.rater_group = 'teacher' AND NOT v.is_visible
         )
    ) picked;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_grid_qualitative_note(p_grid_student_id uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.class_assessment_grid_students;
  g public.class_assessment_grids;
BEGIN
  SELECT * INTO s FROM public.class_assessment_grid_students WHERE id = p_grid_student_id;
  IF NOT FOUND OR s.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'grid_student_locked'; END IF;
  SELECT * INTO g FROM public.class_assessment_grids WHERE id = s.grid_id;
  IF g.teacher_id <> auth.uid() OR g.status <> 'draft' THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.class_assessment_grid_students SET qualitative_note = NULLIF(trim(p_note), '') WHERE id = s.id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_short_set_questions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_grid_qualitative_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_grid_qualitative_note(uuid, text) TO authenticated;

-- Mở bảng: bảng nháp chưa chọn gói được gán một cột mỗi tiêu chí rút gọn
CREATE OR REPLACE FUNCTION public.get_class_grid(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.class_assessment_grids;
  v_students jsonb;
  v_questions jsonb;
BEGIN
  IF NOT public.is_class_teacher(p_class_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO g FROM public.class_assessment_grids
   WHERE class_id = p_class_id AND teacher_id = auth.uid()
   ORDER BY (status = 'draft') DESC, created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.class_assessment_grids (class_id, teacher_id, grading_mode)
    VALUES (p_class_id, auth.uid(), 'short_set') RETURNING * INTO g;
  END IF;

  IF g.status = 'draft' AND g.grading_mode = 'short_set' AND g.package_size IS NULL THEN
    PERFORM public.assign_short_set_questions(g.id);
  END IF;

  IF g.status = 'draft' THEN
    INSERT INTO public.class_assessment_grid_students (grid_id, student_id)
    SELECT g.id, m.user_id FROM public.class_members m
     WHERE m.class_id = p_class_id AND m.member_role = 'student' AND m.status = 'joined' AND m.user_id IS NOT NULL
    ON CONFLICT (grid_id, student_id) DO NOTHING;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'question_id', q.id,
      'question_code', q.question_code,
      'content', q.content,
      'answer_options', q.answer_options,
      'criteria_id', c.id,
      'dimension_code', c.dimension_code,
      'criteria_name', c.name,
      'group_code', cg.group_code,
      'group_name', cg.name
    ) ORDER BY gq.sort_order), '[]'::jsonb) INTO v_questions
    FROM public.class_assessment_grid_questions gq
    JOIN public.questions q ON q.id = gq.question_id
    JOIN public.criteria c ON c.id = q.criteria_id
    JOIN public.criteria_groups cg ON cg.id = c.group_id
   WHERE gq.grid_id = g.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'grid_student_id', s.id,
      'student_id', s.student_id,
      'full_name', COALESCE(p.full_name, ''),
      'acquaintance_duration', s.acquaintance_duration,
      'contact_frequency', s.contact_frequency,
      'observation_depth', s.observation_depth,
      'qualitative_note', s.qualitative_note,
      'guardian_pending', (public.is_under_guardian_age(p.date_of_birth) AND NOT p.guardian_consent_confirmed),
      'submitted_at', COALESCE(s.submitted_at, g.submitted_at),
      'cells', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('question_id', d.question_id, 'score', d.score,
                                            'is_insufficient_basis', d.is_insufficient_basis))
          FROM public.class_assessment_grid_details d
         WHERE d.grid_student_id = s.id AND d.question_id IS NOT NULL), '[]'::jsonb)
    ) ORDER BY p.full_name), '[]'::jsonb) INTO v_students
    FROM public.class_assessment_grid_students s
    JOIN public.user_profiles p ON p.id = s.student_id
   WHERE s.grid_id = g.id;

  RETURN jsonb_build_object(
    'grid_id', g.id, 'status', g.status, 'submitted_at', g.submitted_at,
    'package_size', g.package_size, 'grading_mode', g.grading_mode,
    'default_acquaintance_duration', g.default_acquaintance_duration,
    'default_contact_frequency', g.default_contact_frequency,
    'default_observation_depth', g.default_observation_depth,
    'questions', v_questions,
    'students', v_students
  );
END;
$$;

-- 8. Nghề đã lưu, phương án, lộ trình, cộng đồng, mentor ----------------------------------------
CREATE TABLE IF NOT EXISTS public.user_saved_careers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  career_id uuid NOT NULL REFERENCES public.careers(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('saved', 'target')),
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT user_saved_careers_unique UNIQUE (user_id, career_id, kind)
);
ALTER TABLE public.user_saved_careers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads saved careers" ON public.user_saved_careers;
CREATE POLICY "Owner reads saved careers" ON public.user_saved_careers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.enforce_target_career_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind = 'target' AND (
    SELECT count(*) FROM public.user_saved_careers
     WHERE user_id = NEW.user_id AND kind = 'target' AND id <> NEW.id
  ) >= 2 THEN
    RAISE EXCEPTION 'target_career_limit';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_target_career_limit ON public.user_saved_careers;
CREATE TRIGGER enforce_target_career_limit
  BEFORE INSERT OR UPDATE OF kind ON public.user_saved_careers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_target_career_limit();

CREATE TABLE IF NOT EXISTS public.comparison_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  career_ids uuid[] NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.comparison_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads comparison plans" ON public.comparison_plans;
CREATE POLICY "Owner reads comparison plans" ON public.comparison_plans FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.roadmaps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  career_id uuid REFERENCES public.careers(id) ON DELETE SET NULL,
  title text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.roadmap_milestones (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  roadmap_id uuid NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  pillar text NOT NULL CHECK (pillar IN ('knowledge', 'experience', 'exploration')),
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads roadmaps" ON public.roadmaps;
CREATE POLICY "Owner reads roadmaps" ON public.roadmaps FOR SELECT TO authenticated USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "Owner reads milestones" ON public.roadmap_milestones;
CREATE POLICY "Owner reads milestones" ON public.roadmap_milestones FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.roadmaps r WHERE r.id = roadmap_id AND r.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.communities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.community_members (
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (community_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  hidden_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (length(trim(reason)) >= 8),
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT content_reports_unique UNIQUE (post_id, reporter_id)
);
CREATE TABLE IF NOT EXISTS public.mentor_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  headline text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read communities" ON public.communities;
CREATE POLICY "Authenticated read communities" ON public.communities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Members read membership" ON public.community_members;
CREATE POLICY "Members read membership" ON public.community_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Read visible posts" ON public.community_posts;
CREATE POLICY "Read visible posts" ON public.community_posts FOR SELECT TO authenticated
  USING (hidden_at IS NULL AND EXISTS (
    SELECT 1 FROM public.community_members m WHERE m.community_id = community_posts.community_id AND m.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "Read own mentor profile" ON public.mentor_profiles;
CREATE POLICY "Read own mentor profile" ON public.mentor_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR verified);

CREATE OR REPLACE FUNCTION public.save_career_bookmark(p_career_id uuid, p_kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR p_kind NOT IN ('saved', 'target') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.careers WHERE id = p_career_id) THEN RAISE EXCEPTION 'career_not_found'; END IF;
  INSERT INTO public.user_saved_careers (user_id, career_id, kind) VALUES (auth.uid(), p_career_id, p_kind)
  ON CONFLICT (user_id, career_id, kind) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_saved_careers()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'career_id', s.career_id, 'kind', s.kind, 'career_name', c.career_name, 'career_code', c.career_code
  )), '[]'::jsonb)
  FROM public.user_saved_careers s
  JOIN public.careers c ON c.id = s.career_id
  WHERE s.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.save_comparison_plan(p_title text, p_career_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;
  v_count := COALESCE(array_length(p_career_ids, 1), 0);
  IF v_count < 2 OR v_count > 4 THEN RAISE EXCEPTION 'plan_size'; END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(p_career_ids) x) <> v_count THEN RAISE EXCEPTION 'duplicate_career'; END IF;
  IF (SELECT count(*) FROM public.careers c WHERE c.id = ANY (p_career_ids)) <> v_count THEN
    RAISE EXCEPTION 'career_not_found';
  END IF;
  INSERT INTO public.comparison_plans (owner_id, title, career_ids) VALUES (auth.uid(), trim(p_title), p_career_ids)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_comparison_plans()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'career_ids', career_ids, 'created_at', created_at)
    ORDER BY created_at DESC), '[]'::jsonb)
  FROM public.comparison_plans WHERE owner_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.create_roadmap(p_career_id uuid, p_title text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;
  IF p_career_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.careers WHERE id = p_career_id) THEN
    RAISE EXCEPTION 'career_not_found';
  END IF;
  INSERT INTO public.roadmaps (owner_id, career_id, title) VALUES (auth.uid(), p_career_id, trim(p_title))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_roadmap_milestone(p_roadmap_id uuid, p_pillar text, p_title text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_pillar NOT IN ('knowledge', 'experience', 'exploration') THEN RAISE EXCEPTION 'invalid_pillar'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.roadmaps WHERE id = p_roadmap_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;
  INSERT INTO public.roadmap_milestones (roadmap_id, pillar, title) VALUES (p_roadmap_id, p_pillar, trim(p_title))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_roadmap_milestone(p_milestone_id uuid, p_done boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.roadmap_milestones m SET done = p_done
   WHERE m.id = p_milestone_id
     AND EXISTS (SELECT 1 FROM public.roadmaps r WHERE r.id = m.roadmap_id AND r.owner_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_roadmaps()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'title', r.title, 'career_id', r.career_id, 'career_name', c.career_name,
    'milestones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', m.id, 'pillar', m.pillar, 'title', m.title, 'done', m.done) ORDER BY m.created_at)
        FROM public.roadmap_milestones m WHERE m.roadmap_id = r.id
    ), '[]'::jsonb)
  ) ORDER BY r.created_at DESC), '[]'::jsonb)
  FROM public.roadmaps r
  LEFT JOIN public.careers c ON c.id = r.career_id
  WHERE r.owner_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.create_community(p_name text, p_description text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_name IS NULL OR length(trim(p_name)) < 3 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  INSERT INTO public.communities (name, description, created_by) VALUES (trim(p_name), NULLIF(trim(p_description), ''), auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.community_members (community_id, user_id) VALUES (v_id, auth.uid());
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_community(p_community_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.community_members (community_id, user_id) VALUES (p_community_id, auth.uid())
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_community_post(p_community_id uuid, p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.community_members WHERE community_id = p_community_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.community_posts (community_id, author_id, body) VALUES (p_community_id, auth.uid(), trim(p_body))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_community_post(p_post_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR p_reason IS NULL OR length(trim(p_reason)) < 8 THEN RAISE EXCEPTION 'reason_required'; END IF;
  INSERT INTO public.content_reports (post_id, reporter_id, reason) VALUES (p_post_id, auth.uid(), trim(p_reason))
  ON CONFLICT (post_id, reporter_id) DO NOTHING;
  SELECT count(*) INTO v_count FROM public.content_reports WHERE post_id = p_post_id;
  IF v_count >= 3 THEN
    UPDATE public.community_posts SET hidden_at = COALESCE(hidden_at, now()) WHERE id = p_post_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_communities()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description,
    'joined', EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id = c.id AND m.user_id = auth.uid()),
    'posts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'body', p.body, 'created_at', p.created_at) ORDER BY p.created_at DESC)
        FROM public.community_posts p
       WHERE p.community_id = c.id AND p.hidden_at IS NULL
         AND EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id = c.id AND m.user_id = auth.uid())
    ), '[]'::jsonb)
  ) ORDER BY c.created_at DESC), '[]'::jsonb)
  FROM public.communities c;
$$;

CREATE OR REPLACE FUNCTION public.save_mentor_profile(p_headline text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.user_profiles WHERE id = auth.uid();
  IF v_role <> 'mentor' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_headline IS NULL OR length(trim(p_headline)) < 8 THEN RAISE EXCEPTION 'headline_required'; END IF;
  INSERT INTO public.mentor_profiles (user_id, headline) VALUES (auth.uid(), trim(p_headline))
  ON CONFLICT (user_id) DO UPDATE SET headline = EXCLUDED.headline;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_verified_mentors()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', m.user_id, 'headline', m.headline, 'name', COALESCE(p.display_name, p.full_name, '')
  )), '[]'::jsonb)
  FROM public.mentor_profiles m
  JOIN public.user_profiles p ON p.id = m.user_id
  WHERE m.verified OR m.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.save_career_bookmark(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_saved_careers() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_comparison_plan(text, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_comparison_plans() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_roadmap(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_roadmap_milestone(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toggle_roadmap_milestone(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_roadmaps() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_community(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_community(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_community_post(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_community_post(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_communities() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_mentor_profile(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_verified_mentors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_career_bookmark(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_saved_careers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_comparison_plan(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_comparison_plans() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_roadmap(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_roadmap_milestone(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_roadmap_milestone(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_roadmaps() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_community(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_community(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_community_post(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_community_post(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_communities() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_mentor_profile(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_verified_mentors() TO authenticated;
