-- ====================================================================
-- Phase 1 / Migration 6: Gán câu hỏi theo gói, tính điểm trọng số 360°, trạng thái kết quả
-- Tính điểm: Rater Score (R02) -> trọng số bài (BR-006) -> điểm tiêu chí tổng hợp (R03)
-- -> phân loại mức năng lực -> bản chụp. Chốt kết quả thủ công hoặc tự động.
-- ====================================================================

-- 1. Admin gán câu hỏi vào gói 35/50/75 ---------------------------------------
CREATE TABLE IF NOT EXISTS public.question_package_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  package_size smallint NOT NULL CHECK (package_size IN (35, 50, 75)),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT question_package_assignments_unique UNIQUE (question_id, package_size)
);
CREATE INDEX IF NOT EXISTS idx_question_package_package ON public.question_package_assignments(package_size);

DROP TRIGGER IF EXISTS set_question_package_assignments_updated_at ON public.question_package_assignments;
CREATE TRIGGER set_question_package_assignments_updated_at
  BEFORE UPDATE ON public.question_package_assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.question_package_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read question_package_assignments" ON public.question_package_assignments;
CREATE POLICY "Authenticated read question_package_assignments" ON public.question_package_assignments
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write question_package_assignments" ON public.question_package_assignments;
CREATE POLICY "Admin write question_package_assignments" ON public.question_package_assignments
  FOR ALL TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

-- 2. Chặn người dùng tự sửa cột kết quả; chỉ hàm hệ thống được đổi ----------------
CREATE OR REPLACE FUNCTION public.guard_result_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(current_setting('app.internal_write', true), '') = '1' THEN
    RETURN NEW;
  END IF;
  IF NEW.status_label IS DISTINCT FROM OLD.status_label
     OR NEW.accepted_count IS DISTINCT FROM OLD.accepted_count
     OR NEW.expected_count IS DISTINCT FROM OLD.expected_count
     OR NEW.groups_count IS DISTINCT FROM OLD.groups_count
     OR NEW.thin_data_flag IS DISTINCT FROM OLD.thin_data_flag
     OR NEW.insufficient_basis_warning IS DISTINCT FROM OLD.insufficient_basis_warning
     OR NEW.finalized_mode IS DISTINCT FROM OLD.finalized_mode
     OR NEW.finalized_at IS DISTINCT FROM OLD.finalized_at
     OR NEW.calculated_at IS DISTINCT FROM OLD.calculated_at
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.session_id IS DISTINCT FROM OLD.session_id THEN
    RAISE EXCEPTION 'Chỉ được đổi invite_enabled; các cột kết quả do hệ thống tính';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_result_columns ON public.assessment_results;
CREATE TRIGGER trg_guard_result_columns
  BEFORE UPDATE ON public.assessment_results
  FOR EACH ROW EXECUTE FUNCTION public.guard_result_columns();

-- 3. Tính lại kết quả ------------------------------------------------------------------
-- Nguồn tính: bài Đã chấp nhận của HS/SV sau lần chốt gần nhất + điểm tự đánh giá của phiên.
CREATE OR REPLACE FUNCTION public.recalculate_result(p_result_id uuid, p_finalizing boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.assessment_results;
  v_self_weight numeric := COALESCE((public.get_parameter('self_weight'))::text::numeric, 0.5);
  v_levels jsonb := COALESCE(public.get_parameter('competency_levels'), '{"very_high":80,"high":65,"medium":50}'::jsonb);
  v_warn_ratio numeric := COALESCE((public.get_parameter('insufficient_basis_warning_ratio'))::text::numeric, 0.4);
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
  IF r.finalized_at IS NOT NULL AND NOT p_finalizing THEN RETURN; END IF;   -- kết quả đã chốt thì khóa

  PERFORM set_config('app.internal_write', '1', true);

  SELECT max(finalized_at) INTO v_prev_final
    FROM public.assessment_results WHERE user_id = r.user_id AND id <> r.id AND finalized_at IS NOT NULL;

  DELETE FROM public.assessment_result_weights WHERE result_id = r.id;
  DELETE FROM public.assessment_result_scores WHERE result_id = r.id;

  -- Trọng số mỗi bài = điểm thấu hiểu / tổng điểm thấu hiểu * (1 - trọng số bản thân)
  INSERT INTO public.assessment_result_weights (result_id, submission_id, weight)
  SELECT r.id, s.id,
         round(s.understanding_score::numeric / SUM(s.understanding_score) OVER () * (1 - v_self_weight), 6)
    FROM public.assessment_360_submissions s
   WHERE s.subject_user_id = r.user_id AND s.status = 'accepted' AND s.understanding_score IS NOT NULL
     AND s.decided_at > COALESCE(v_prev_final, '-infinity'::timestamptz);

  SELECT count(*), count(DISTINCT s.rater_group) INTO v_accepted, v_groups
    FROM public.assessment_result_weights w JOIN public.assessment_360_submissions s ON s.id = w.submission_id
   WHERE w.result_id = r.id;

  -- Rater Score từng nguồn tại từng tiêu chí; câu "không đủ cơ sở" (NULL) bị bỏ qua
  WITH self_rs AS (
    SELECT a.criteria_id, avg(a.score)::numeric AS rs
      FROM public.assessment_answers a WHERE a.session_id = r.session_id AND a.score IS NOT NULL
     GROUP BY a.criteria_id
  ), sub_rs AS (
    SELECT s.rater_group, w.weight, a.criteria_id, avg(a.score)::numeric AS rs
      FROM public.assessment_result_weights w
      JOIN public.assessment_360_submissions s ON s.id = w.submission_id
      JOIN public.assessment_360_answers a ON a.submission_id = s.id AND a.score IS NOT NULL
     WHERE w.result_id = r.id
     GROUP BY s.id, s.rater_group, w.weight, a.criteria_id
  ), group_scores AS (
    SELECT criteria_id, rater_group::text AS score_source,
           SUM(weight * rs) / NULLIF(SUM(weight), 0) AS score
      FROM sub_rs GROUP BY criteria_id, rater_group
  ), combined AS (
    SELECT criteria_id, SUM(w * rs) / NULLIF(SUM(w), 0) AS score
      FROM (
        SELECT criteria_id, v_self_weight AS w, rs FROM self_rs
        UNION ALL
        SELECT criteria_id, weight, rs FROM sub_rs
      ) x GROUP BY criteria_id
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

  SELECT COALESCE(sum(l.expected_count), 0) INTO v_expected
    FROM public.invitation_links l WHERE l.user_id = r.user_id AND l.revoked_at IS NULL;

  -- Tiêu chí thiếu dữ liệu: tổng hợp (hoặc tự đánh giá nếu chưa có 360°) không có điểm
  SELECT count(*) INTO v_total_criteria FROM public.criteria WHERE is_active;
  SELECT count(*) INTO v_null_criteria FROM public.criteria c
   WHERE c.is_active AND NOT EXISTS (
     SELECT 1 FROM public.assessment_result_scores sc
      WHERE sc.result_id = r.id AND sc.criteria_id = c.id
        AND sc.score_source = CASE WHEN v_accepted > 0 THEN 'combined_360' ELSE 'self' END);

  v_label := CASE WHEN p_finalizing THEN 'final_360'
                  WHEN v_accepted > 0 THEN 'temporary' ELSE 'self_assessment' END;

  UPDATE public.assessment_results SET
    status_label = v_label,
    accepted_count = v_accepted,
    expected_count = v_expected,
    groups_count = v_groups,
    thin_data_flag = (v_accepted = 1),
    insufficient_basis_warning = (v_total_criteria > 0 AND v_null_criteria::numeric / v_total_criteria > v_warn_ratio),
    calculated_at = now()
  WHERE id = r.id;

  INSERT INTO public.assessment_result_snapshots (result_id, user_id, status_label, snapshot_data)
  SELECT r.id, r.user_id, v_label, jsonb_build_object(
    'parameters', jsonb_build_object('self_weight', v_self_weight, 'competency_levels', v_levels),
    'framework_version_id', r.framework_version_id,
    'accepted_count', v_accepted,
    'weights', COALESCE((SELECT jsonb_agg(jsonb_build_object('submission_id', w.submission_id, 'weight', w.weight))
                           FROM public.assessment_result_weights w WHERE w.result_id = r.id), '[]'::jsonb),
    'scores', COALESCE((SELECT jsonb_agg(jsonb_build_object('criteria_id', sc.criteria_id, 'source', sc.score_source,
                                         'score_1_5', sc.score_1_5, 'score_percent', sc.score_percent, 'level', sc.competency_level))
                          FROM public.assessment_result_scores sc WHERE sc.result_id = r.id), '[]'::jsonb));
END;
$$;

-- Tính lại kết quả mới nhất của một HS/SV (dùng khi có bài mới được chấp nhận/loại)
CREATE OR REPLACE FUNCTION public.recalculate_latest_result(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.assessment_results
   WHERE user_id = p_user AND finalized_at IS NULL ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NOT NULL THEN
    PERFORM public.recalculate_result(v_id);
    PERFORM public.push_notification(p_user, 'result_changed', 'Kết quả đánh giá đã được cập nhật', NULL,
      jsonb_build_object('result_id', v_id));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalculate_on_decision()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('accepted', 'rejected') AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.recalculate_latest_result(NEW.subject_user_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_recalculate_on_decision ON public.assessment_360_submissions;
CREATE TRIGGER trg_recalculate_on_decision
  AFTER UPDATE OF status ON public.assessment_360_submissions
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_on_decision();

-- 4. Hoàn thành tự đánh giá: tạo kết quả với nhãn "Tự đánh giá" ---------------------------------
CREATE OR REPLACE FUNCTION public.complete_self_assessment(p_session_id uuid, p_invite_enabled boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_sessions;
  v_result uuid;
BEGIN
  SELECT * INTO s FROM public.assessment_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR s.user_id <> auth.uid() THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF s.status = 'expired' THEN RAISE EXCEPTION 'session_expired'; END IF;

  UPDATE public.assessment_sessions
     SET status = 'completed', completed_at = COALESCE(completed_at, now()), draft_expires_at = NULL
   WHERE id = s.id;

  PERFORM set_config('app.internal_write', '1', true);
  INSERT INTO public.assessment_results (user_id, session_id, framework_version_id, invite_enabled)
  VALUES (s.user_id, s.id, s.framework_version_id, p_invite_enabled)
  ON CONFLICT (session_id) DO UPDATE SET invite_enabled = EXCLUDED.invite_enabled
  RETURNING id INTO v_result;

  PERFORM public.recalculate_result(v_result);
  PERFORM public.write_audit_log(auth.uid(), auth.uid(), 'complete_self_assessment', 'assessment_sessions', s.id, '{}'::jsonb);
  RETURN v_result;
END;
$$;

-- 5. Chốt kết quả ----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_result_internal(p_result_id uuid, p_mode text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.assessment_results;
BEGIN
  SELECT * INTO r FROM public.assessment_results WHERE id = p_result_id FOR UPDATE;
  IF NOT FOUND OR r.finalized_at IS NOT NULL THEN RETURN; END IF;
  PERFORM set_config('app.internal_write', '1', true);
  PERFORM public.recalculate_result(r.id, true);
  UPDATE public.assessment_results SET finalized_at = now(), finalized_mode = p_mode WHERE id = r.id;
  PERFORM public.push_notification(r.user_id, 'result_finalized', 'Kết quả đánh giá 360° đã được chốt', NULL,
    jsonb_build_object('result_id', r.id, 'mode', p_mode));
  PERFORM public.write_audit_log(CASE WHEN p_mode = 'manual' THEN r.user_id END, r.user_id,
    'finalize_result', 'assessment_results', r.id, jsonb_build_object('mode', p_mode));
END;
$$;

-- HS/SV chốt thủ công: cần ít nhất 1 bài Đã chấp nhận
CREATE OR REPLACE FUNCTION public.finalize_my_result(p_result_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.assessment_results;
BEGIN
  SELECT * INTO r FROM public.assessment_results WHERE id = p_result_id;
  IF NOT FOUND OR r.user_id <> auth.uid() THEN RAISE EXCEPTION 'result_not_found'; END IF;
  IF r.finalized_at IS NOT NULL THEN RAISE EXCEPTION 'already_finalized'; END IF;
  IF r.accepted_count < 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_accepted_submission');
  END IF;
  PERFORM public.finalize_result_internal(r.id, 'manual');
  RETURN jsonb_build_object('ok', true, 'thin_data', r.accepted_count = 1);
END;
$$;

-- Chốt tự động: mọi đường dẫn đang mở đã đủ bài được chấp nhận hoặc đã hết hạn, và có >= 1 bài chấp nhận.
-- Hết hạn mà chưa có bài nào được chấp nhận thì giữ nhãn "Tự đánh giá". Gọi định kỳ (pg_cron / Edge Function).
CREATE OR REPLACE FUNCTION public.auto_finalize_results()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT res.id, res.user_id FROM public.assessment_results res
     WHERE res.finalized_at IS NULL AND res.invite_enabled AND res.accepted_count >= 1
       AND EXISTS (SELECT 1 FROM public.invitation_links l WHERE l.user_id = res.user_id AND l.revoked_at IS NULL)
       AND NOT EXISTS (
         SELECT 1 FROM public.invitation_links l
          WHERE l.user_id = res.user_id AND l.revoked_at IS NULL AND l.expires_at > now()
            AND (SELECT count(*) FROM public.assessment_360_submissions s
                  WHERE s.invitation_link_id = l.id AND s.status = 'accepted') < l.expected_count)
  LOOP
    PERFORM public.finalize_result_internal(r.id, 'auto');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 6. Quyền thực thi -----------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.recalculate_result(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_latest_result(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_result_internal(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_finalize_results() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_self_assessment(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_my_result(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_self_assessment(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_my_result(uuid) TO authenticated;
