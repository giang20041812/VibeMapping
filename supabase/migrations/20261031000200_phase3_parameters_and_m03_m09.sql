-- ====================================================================
-- Phase 3 / Migration 2: Sổ tham số P01–P45, quyền R21, M03 riêng tư, M04 bản chụp đối sánh,
-- M05 điểm chuẩn, M06 báo cáo gia đình, M07 lộ trình có mốc, M08 hồ sơ năng lực, M09 cộng đồng.
-- Chỉ thêm bảng/cột/hàm; không xóa dữ liệu hiện có.
-- ====================================================================

-- 0. Loại thông báo mới của M04, M06, M09 ------------------------------------------------------------
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.notifications'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%notification_type%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', c); END IF;
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_notification_type_check CHECK (notification_type IN (
    'new_submission', 'result_changed', 'result_finalized', 'link_expiring', 'class_update',
    'career_ranking_changed', 'decision_report_shared', 'decision_consensus', 'mentor_connection'));
END $$;

-- 1. Sổ tham số P01–P45 + 7 điểm chờ BA/PO chốt (cấu hình, không sửa code) -----------------------
ALTER TABLE public.operation_parameters
  ADD COLUMN IF NOT EXISTS srs_code text,
  ADD COLUMN IF NOT EXISTS verification_level text NOT NULL DEFAULT 'documented'
    CHECK (verification_level IN ('documented', 'demo', 'pending_ba', 'expert_approved', 'calibrated'));

INSERT INTO public.operation_parameters (param_code, param_name, param_value)
SELECT v.c, v.n, v.val::jsonb
FROM (VALUES
  ('expected_raters_per_group', 'Số người chấm dự kiến mỗi nhóm (HSSV khai khi mời)', 'null'),
  ('career_fit_min_percent', 'Ngưỡng % phù hợp tối thiểu', '50'),
  ('career_min_jd', 'Số JD tối thiểu mỗi nghề', '20'),
  ('result_validity_months', 'Thời hạn hiệu lực kết quả (tháng)', '12'),
  ('validity_reminder_days', 'Nhắc trước khi hết hạn (ngày)', '14'),
  ('career_review_months', 'Hạn rà soát dữ liệu nghề (tháng)', '6'),
  ('inactive_anonymize_months', 'Ẩn danh tài khoản không hoạt động (tháng)', '24'),
  ('progress_threshold_points', 'Ngưỡng Có tiến bộ khi so hai lần (điểm)', '0.5'),
  ('career_top_n', 'Số nghề gợi ý', '5'),
  ('career_rank_band_percent', 'Độ rộng bậc khi xếp hạng (điểm %)', '1'),
  ('career_near_fit_percent', 'Ngưỡng nghề gần đạt (%)', '40'),
  ('perception_gap_percent', 'Mức chênh cảnh báo lệch góc nhìn (điểm %)', '25'),
  ('class_report_min_students', 'Số em tối thiểu để hiện báo cáo lớp', '5'),
  ('guardian_age', 'Tuổi cần xác nhận của phụ huynh', '16'),
  ('guardian_link_minutes', 'Hạn link xác nhận của phụ huynh (phút)', '15'),
  ('career_fit_weight_competency', 'Tỷ trọng G1–G5 trong % phù hợp', '0.4'),
  ('career_fit_weight_interest', 'Tỷ trọng G6 trong % phù hợp', '0.3'),
  ('career_fit_weight_motivation', 'Tỷ trọng G7 trong % phù hợp', '0.3'),
  ('completeness_labels', 'Nhãn mức đầy đủ dữ liệu', '{"full":1,"partial":0.7,"limited":0.4}'),
  ('dimension_weight_mode', 'Trọng số tiêu chí trong nhóm', '"equal"'),
  ('gap_priority_p1', 'Ngưỡng Priority P1 (Gap)', '0.5'),
  ('gap_priority_p2', 'Ngưỡng Priority P2 (Gap)', '0.25'),
  ('gap_large_level', 'Ngưỡng Thiếu nhiều (mức)', '1'),
  ('gap_listing_tolerance', 'Ngưỡng bỏ qua sai số Gap', '0.5'),
  ('gap_priority_display_count', 'Số tiêu chí ưu tiên hiển thị', '5'),
  ('career_fit_decimals', 'Số chữ số thập phân Career Fit', '1'),
  ('riasec_match_method', 'Phương pháp RIASEC Match (R05 – chờ chốt)', '"profile_6d_demo"'),
  ('unreviewed_supplemental_default', 'S_i khi chưa chấm định tính (null = không tính bài)', '100'),
  ('understanding_percent_floor', 'Sàn TH% khi TH = 3', '0'),
  ('zero_weight_equal_fallback', 'Chia đều khi tổng trọng số 360 bằng 0', 'true'),
  ('career_matrix_include_l0', 'Đưa JD L0 (Intern) vào ma trận nghề HSSV', 'true'),
  ('require_open_answers', 'Bắt buộc câu hỏi mở khi nộp 360', 'false'),
  ('community_banned_keywords', 'Từ khóa cấm trong cộng đồng', '[]'),
  ('question_bank_version', 'Mã phiên bản ngân hàng câu hỏi (CH-X.Y)', '"CH-1.0"'),
  ('parameter_book_version', 'Mã phiên bản sổ tham số (TS-X.Y)', '"TS-1.0"')
) AS v(c, n, val)
WHERE NOT EXISTS (SELECT 1 FROM public.operation_parameters p WHERE p.param_code = v.c);

UPDATE public.operation_parameters p SET srs_code = m.srs, verification_level = m.lvl
FROM (VALUES
  ('understanding_conversion','P01','documented'), ('expected_raters_per_group','P02','documented'),
  ('self_weight','P03','documented'), ('link_expiry_days','P04','documented'),
  ('trust_seconds_per_question','P05','demo'), ('career_fit_min_percent','P06','documented'),
  ('invitee_questions_per_criterion','P07','documented'), ('trust_idle_gap_seconds','P08','demo'),
  ('trust_dispersion_coefficient','P09','demo'), ('trust_min_criteria','P10','demo'),
  ('trust_label_trusted','P11','demo'), ('trust_label_consider','P12','demo'),
  ('trust_min_time_ratio','P13','demo'), ('insufficient_basis_warning_ratio','P14','documented'),
  ('draft_retention_hours','P15','documented'), ('career_min_jd','P16','demo'),
  ('result_validity_months','P17','demo'), ('retake_min_interval_hours','P18','documented'),
  ('validity_reminder_days','P19','demo'), ('career_review_months','P20','documented'),
  ('inactive_anonymize_months','P21','demo'), ('progress_threshold_points','P22','demo'),
  ('career_top_n','P23','documented'), ('career_rank_band_percent','P24','demo'),
  ('career_near_fit_percent','P25','demo'), ('min_submissions_group_display','P26','documented'),
  ('min_submissions_other_display','P27','demo'), ('perception_gap_percent','P28','documented'),
  ('class_report_min_students','P29','documented'), ('guardian_age','P30','documented'),
  ('guardian_link_minutes','P31','documented'), ('career_fit_weight_competency','P32','documented'),
  ('career_fit_weight_interest','P33','documented'), ('career_fit_weight_motivation','P34','documented'),
  ('completeness_labels','P35','demo'), ('dimension_weight_mode','P36','demo'),
  ('confidence_high_coverage','P37','demo'), ('confidence_medium_coverage','P38','demo'),
  ('min_accepted_to_finalize','P39','documented'), ('gap_priority_p1','P40','demo'),
  ('gap_priority_p2','P41','demo'), ('gap_large_level','P42','demo'),
  ('gap_listing_tolerance','P43','demo'), ('gap_priority_display_count','P44','demo'),
  ('career_fit_decimals','P45','demo'),
  ('riasec_match_method',NULL,'pending_ba'), ('unreviewed_supplemental_default',NULL,'pending_ba'),
  ('understanding_percent_floor',NULL,'pending_ba'), ('zero_weight_equal_fallback',NULL,'pending_ba'),
  ('career_matrix_include_l0',NULL,'pending_ba'), ('require_open_answers',NULL,'pending_ba')
) AS m(code, srs, lvl)
WHERE p.param_code = m.code AND p.is_current;

-- Kiểm tra tham số: giữ các luật cũ, thêm P32 + P33 + P34 = 100%
CREATE OR REPLACE FUNCTION public.validate_operation_parameter()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_leaf record;
  v_sum numeric;
BEGIN
  IF NEW.param_code = 'self_weight' THEN
    IF jsonb_typeof(NEW.param_value) <> 'number'
       OR (NEW.param_value #>> '{}')::numeric < 0 OR (NEW.param_value #>> '{}')::numeric > 1 THEN
      RAISE EXCEPTION 'self_weight phải nằm trong khoảng 0–1';
    END IF;
  ELSIF NEW.param_code = 'understanding_conversion' THEN
    FOR v_leaf IN
      SELECT g.key AS grp, l.key AS lvl, l.value AS val
        FROM jsonb_each(NEW.param_value) g, jsonb_each(g.value) l
    LOOP
      IF jsonb_typeof(v_leaf.val) <> 'number' OR (v_leaf.val #>> '{}')::numeric <= 0 THEN
        RAISE EXCEPTION 'understanding_conversion.%.% phải là số lớn hơn 0', v_leaf.grp, v_leaf.lvl;
      END IF;
    END LOOP;
  ELSIF NEW.param_code IN ('career_fit_weight_competency', 'career_fit_weight_interest', 'career_fit_weight_motivation') THEN
    IF jsonb_typeof(NEW.param_value) <> 'number'
       OR (NEW.param_value #>> '{}')::numeric < 0 OR (NEW.param_value #>> '{}')::numeric > 1 THEN
      RAISE EXCEPTION '% phải nằm trong khoảng 0–1', NEW.param_code;
    END IF;
    IF current_setting('app.weights_batch', true) IS DISTINCT FROM '1' THEN
      SELECT (NEW.param_value #>> '{}')::numeric + COALESCE(sum((param_value #>> '{}')::numeric), 0) INTO v_sum
        FROM public.operation_parameters
       WHERE is_current AND param_code <> NEW.param_code
         AND param_code IN ('career_fit_weight_competency', 'career_fit_weight_interest', 'career_fit_weight_motivation');
      IF abs(v_sum - 1) > 0.0001 THEN RAISE EXCEPTION 'P32 + P33 + P34 phải bằng 100%%'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_career_fit_weights(p_competency numeric, p_interest numeric, p_motivation numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF abs(p_competency + p_interest + p_motivation - 1) > 0.0001 THEN RAISE EXCEPTION 'P32 + P33 + P34 phải bằng 100%%'; END IF;
  PERFORM set_config('app.weights_batch', '1', true);
  INSERT INTO public.operation_parameters (param_code, param_name, param_value, srs_code)
  VALUES ('career_fit_weight_competency', 'Tỷ trọng G1–G5 trong % phù hợp', to_jsonb(p_competency), 'P32'),
         ('career_fit_weight_interest', 'Tỷ trọng G6 trong % phù hợp', to_jsonb(p_interest), 'P33'),
         ('career_fit_weight_motivation', 'Tỷ trọng G7 trong % phù hợp', to_jsonb(p_motivation), 'P34');
  PERFORM set_config('app.weights_batch', '0', true);
END;
$$;

-- 2. P18: không tạo phiên mới trong 14 ngày sau lần hoàn thành gần nhất ------------------------
CREATE OR REPLACE FUNCTION public.enforce_retake_interval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_last timestamptz;
  v_hours numeric := public.param_num('retake_min_interval_hours', 336);
BEGIN
  SELECT max(completed_at) INTO v_last FROM public.assessment_sessions
   WHERE user_id = NEW.user_id AND status = 'completed';
  IF v_last IS NOT NULL AND v_last > now() - make_interval(secs => v_hours * 3600) THEN
    RAISE EXCEPTION 'retake_too_soon:%', to_char(v_last + make_interval(secs => v_hours * 3600), 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_retake_interval ON public.assessment_sessions;
CREATE TRIGGER enforce_retake_interval BEFORE INSERT ON public.assessment_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_retake_interval();

-- 3. FR02.01.02: giáo viên thuộc trường cũng tạo được lớp (người tạo thành chủ nhiệm) -----------
CREATE OR REPLACE FUNCTION public.create_class(
  p_school_id uuid, p_class_name text, p_grade smallint, p_school_year text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_class_id uuid;
BEGIN
  IF NOT public.is_school_staff(p_school_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(trim(p_class_name), '') = '' OR coalesce(trim(p_school_year), '') = '' THEN
    RAISE EXCEPTION 'invalid_class';
  END IF;
  INSERT INTO public.classes (school_id, class_name, grade, school_year, created_by)
  VALUES (p_school_id, trim(p_class_name), p_grade, trim(p_school_year), auth.uid())
  RETURNING id INTO v_class_id;
  IF NOT public.is_school_admin(p_school_id) THEN
    INSERT INTO public.class_members (class_id, user_id, member_role, status, joined_via, joined_at)
    VALUES (v_class_id, auth.uid(), 'homeroom_teacher', 'joined', 'manual', now());
  END IF;
  PERFORM public.write_audit_log(auth.uid(), NULL, 'create_class', 'classes', v_class_id, '{}'::jsonb);
  RETURN v_class_id;
END;
$$;
DROP POLICY IF EXISTS "Staff create classes" ON public.classes;
CREATE POLICY "Staff create classes" ON public.classes FOR INSERT TO authenticated
  WITH CHECK (public.is_school_staff(school_id));

-- 4. R21: nhóm nổi trội chỉ trả cho học sinh đã đồng ý (tham gia lớp hoặc chia sẻ kết quả) ---------
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
         AND EXISTS (
           SELECT 1 FROM public.consent_records c
            WHERE c.user_id = m.user_id AND c.revoked_at IS NULL
              AND (c.consent_type = 'class_participation'
                   OR (c.consent_type = 'share_result' AND c.granted_to_user_id = auth.uid())))
       ORDER BY m.user_id, s.score_percent DESC, cg.sort_order
    ) t;
  RETURN v_result;
END;
$$;

-- 5. R21: khách xóa bài đã nộp; R14: trừ quãng bỏ máy > P08 khỏi thời gian làm bài -------------
ALTER TABLE public.assessment_360_submissions ADD COLUMN IF NOT EXISTS idle_seconds integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.record_360_idle(p_resume_token text, p_periods integer[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cut numeric := public.param_num('trust_idle_gap_seconds', 120);
  v_add integer;
BEGIN
  SELECT COALESCE(sum(x), 0) INTO v_add FROM unnest(COALESCE(p_periods, ARRAY[]::integer[])) x WHERE x > v_cut AND x < 86400;
  IF v_add = 0 THEN RETURN; END IF;
  -- Dời mốc bắt đầu để submit_360 tính T trên thời gian làm thực
  UPDATE public.assessment_360_submissions
     SET idle_seconds = idle_seconds + v_add, started_at = started_at + make_interval(secs => v_add)
   WHERE resume_token = p_resume_token AND status = 'draft';
END;
$$;

CREATE OR REPLACE FUNCTION public.erase_own_360_submission(p_resume_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_360_submissions;
BEGIN
  SELECT * INTO s FROM public.assessment_360_submissions WHERE resume_token = p_resume_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  DELETE FROM public.assessment_360_submissions WHERE id = s.id;
  PERFORM public.write_audit_log(NULL, s.subject_user_id, 'erase_360_by_rater', 'assessment_360_submissions', s.id,
    jsonb_build_object('rater_group', s.rater_group));
  IF s.status = 'accepted' THEN PERFORM public.recalculate_latest_result(s.subject_user_id); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 6. M03: chia sẻ kết quả, liên kết con, xuất dữ liệu, yêu cầu xóa tài khoản ---------------------
CREATE OR REPLACE FUNCTION public.share_result_with(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.user_profiles;
BEGIN
  SELECT * INTO p FROM public.user_profiles WHERE id = auth.uid();
  IF p.role NOT IN ('student', 'university_student') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF public.is_under_guardian_age(p.date_of_birth) AND NOT p.guardian_consent_confirmed THEN
    RAISE EXCEPTION 'guardian_consent_required';
  END IF;
  IF p_user_id = auth.uid() OR NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;
  IF EXISTS (SELECT 1 FROM public.consent_records WHERE user_id = auth.uid() AND granted_to_user_id = p_user_id
               AND consent_type = 'share_result' AND revoked_at IS NULL) THEN RETURN; END IF;
  INSERT INTO public.consent_records (user_id, consent_type, granted_to_user_id, displayed_content)
  VALUES (auth.uid(), 'share_result', p_user_id, 'Chia sẻ kết quả tổng hợp (không gồm điểm từng người chấm).');
END;
$$;

-- Chia sẻ với giáo viên / mentor / phụ huynh theo email tài khoản
CREATE OR REPLACE FUNCTION public.share_result_with_email(p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_user uuid;
  v_role text;
BEGIN
  SELECT u.id, p.role INTO v_user, v_role FROM auth.users u JOIN public.user_profiles p ON p.id = u.id
   WHERE lower(u.email) = lower(trim(p_email));
  IF v_user IS NULL OR v_role NOT IN ('parent', 'teacher', 'mentor') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'user_not_found');
  END IF;
  PERFORM public.share_result_with(v_user);
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_result_share(p_user_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.consent_records SET revoked_at = now()
   WHERE user_id = auth.uid() AND granted_to_user_id = p_user_id AND consent_type = 'share_result' AND revoked_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.list_my_connections()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'shares', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', c.granted_to_user_id,
                 'name', COALESCE(p.display_name, p.full_name, ''), 'role', p.role, 'granted_at', c.granted_at))
               FROM public.consent_records c JOIN public.user_profiles p ON p.id = c.granted_to_user_id
              WHERE c.user_id = auth.uid() AND c.consent_type = 'share_result' AND c.revoked_at IS NULL), '[]'::jsonb),
    'parents', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', r.requester_id,
                 'name', COALESCE(p.display_name, p.full_name, '')))
               FROM public.user_relationships r JOIN public.user_profiles p ON p.id = r.requester_id
              WHERE r.target_id = auth.uid() AND r.relationship_type = 'parent' AND r.status = 'accepted'), '[]'::jsonb),
    'children', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', r.target_id,
                 'name', COALESCE(p.display_name, p.full_name, ''), 'can_view_result', public.can_view_result_of(r.target_id)))
               FROM public.user_relationships r JOIN public.user_profiles p ON p.id = r.target_id
              WHERE r.requester_id = auth.uid() AND r.relationship_type = 'parent' AND r.status = 'accepted'), '[]'::jsonb),
    'shared_with_me', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', c.user_id,
                 'name', COALESCE(p.display_name, p.full_name, '')))
               FROM public.consent_records c JOIN public.user_profiles p ON p.id = c.user_id
              WHERE c.granted_to_user_id = auth.uid() AND c.consent_type = 'share_result' AND c.revoked_at IS NULL), '[]'::jsonb),
    'deletion_requested_at', (SELECT deletion_requested_at FROM public.user_profiles WHERE id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public.write_audit_log(v_uid, v_uid, 'export_own_data', 'user_profiles', v_uid, '{}'::jsonb);
  RETURN jsonb_build_object(
    'exported_at', now(),
    'profile', (SELECT to_jsonb(p) - 'failed_login_count' - 'locked_until' FROM public.user_profiles p WHERE p.id = v_uid),
    'sessions', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.assessment_sessions s WHERE s.user_id = v_uid), '[]'::jsonb),
    'answers', COALESCE((SELECT jsonb_agg(jsonb_build_object('session_id', a.session_id, 'question_id', a.question_id,
                 'score', a.score)) FROM public.assessment_answers a
                 JOIN public.assessment_sessions s ON s.id = a.session_id WHERE s.user_id = v_uid), '[]'::jsonb),
    'results', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM public.assessment_results r WHERE r.user_id = v_uid), '[]'::jsonb),
    'result_scores', COALESCE((SELECT jsonb_agg(jsonb_build_object('result_id', sc.result_id, 'criteria_id', sc.criteria_id,
                 'source', sc.score_source, 'score_percent', sc.score_percent))
                 FROM public.assessment_result_scores sc JOIN public.assessment_results r ON r.id = sc.result_id
                WHERE r.user_id = v_uid), '[]'::jsonb),
    'consents', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM public.consent_records c WHERE c.user_id = v_uid), '[]'::jsonb),
    'saved_careers', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM public.user_saved_careers x WHERE x.user_id = v_uid), '[]'::jsonb),
    'plans', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM public.comparison_plans x WHERE x.owner_id = v_uid), '[]'::jsonb),
    'roadmaps', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM public.roadmaps x WHERE x.owner_id = v_uid), '[]'::jsonb),
    'skills', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM public.skill_profile_items x WHERE x.owner_id = v_uid), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_account_deletion(p_cancel boolean DEFAULT false)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.user_profiles SET deletion_requested_at = CASE WHEN p_cancel THEN NULL ELSE now() END WHERE id = auth.uid();
  PERFORM public.write_audit_log(auth.uid(), auth.uid(),
    CASE WHEN p_cancel THEN 'cancel_account_deletion' ELSE 'request_account_deletion' END, 'user_profiles', auth.uid(), '{}'::jsonb);
  RETURN CASE WHEN p_cancel THEN NULL ELSE now() + interval '14 days' END;
END;
$$;

-- 7. M04: bản chụp đối sánh nghề (R18, R19) — bất biến; quản trị đổi trạng thái nghề -----------------
CREATE TABLE IF NOT EXISTS public.career_match_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  result_id uuid NOT NULL REFERENCES public.assessment_results(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  career_matrix_version text,
  payload jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.career_match_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read permitted career matches" ON public.career_match_snapshots;
CREATE POLICY "Read permitted career matches" ON public.career_match_snapshots FOR SELECT TO authenticated
  USING (public.can_view_result_of(user_id));
DROP TRIGGER IF EXISTS trg_prevent_career_match_update ON public.career_match_snapshots;
CREATE TRIGGER trg_prevent_career_match_update BEFORE UPDATE ON public.career_match_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.prevent_snapshot_update();

CREATE OR REPLACE FUNCTION public.save_career_match_snapshot(p_result_id uuid, p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_last jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.assessment_results WHERE id = p_result_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT payload INTO v_last FROM public.career_match_snapshots
   WHERE result_id = p_result_id ORDER BY created_at DESC LIMIT 1;
  IF v_last IS NOT NULL AND v_last -> 'ranking' = p_payload -> 'ranking' THEN RETURN NULL; END IF;
  INSERT INTO public.career_match_snapshots (result_id, user_id, career_matrix_version, payload)
  VALUES (p_result_id, auth.uid(), (SELECT version_code FROM public.career_matrix_versions WHERE is_current), p_payload)
  RETURNING id INTO v_id;
  IF v_last IS NOT NULL THEN
    PERFORM public.push_notification(auth.uid(), 'career_ranking_changed', 'Danh sách nghề gợi ý đã thay đổi', NULL,
      jsonb_build_object('result_id', p_result_id));
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_career_status(p_career_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_status NOT IN ('draft', 'review', 'published', 'hidden') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  UPDATE public.careers SET status = p_status, data_checked_at = CASE WHEN p_status = 'published' THEN current_date ELSE data_checked_at END
   WHERE id = p_career_id;
  PERFORM public.write_audit_log(auth.uid(), NULL, 'set_career_status', 'careers', p_career_id, jsonb_build_object('status', p_status));
END;
$$;

-- Báo cáo lớp/trường: thêm phân bố nghề quan tâm (chỉ khi đủ P29 em) -------------------------------
CREATE OR REPLACE FUNCTION public.build_group_report(p_student_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result_ids uuid[];
  v_count integer;
  v_groups jsonb;
  v_careers jsonb;
  v_min integer := public.param_num('class_report_min_students', 5)::integer;
BEGIN
  SELECT array_agg(x.id) INTO v_result_ids FROM (
    SELECT DISTINCT ON (r.user_id) r.id FROM public.assessment_results r
     WHERE r.user_id = ANY (p_student_ids) ORDER BY r.user_id, r.created_at DESC
  ) x;
  v_count := COALESCE(array_length(v_result_ids, 1), 0);
  IF v_count < v_min THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'below_threshold', 'student_count', v_count);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'group_code', cg.group_code, 'name', cg.name, 'average_percent', t.avg_percent
    ) ORDER BY cg.sort_order), '[]'::jsonb) INTO v_groups
    FROM (
      SELECT x.group_id, round(avg(x.score_percent), 1) AS avg_percent
        FROM (
          SELECT DISTINCT ON (gs.result_id, gs.group_id) gs.group_id, gs.score_percent
            FROM public.assessment_result_group_scores gs
           WHERE gs.result_id = ANY (v_result_ids)
           ORDER BY gs.result_id, gs.group_id, (gs.score_source = 'combined_360') DESC
        ) x
       GROUP BY x.group_id
    ) t
    JOIN public.criteria_groups cg ON cg.id = t.group_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('career_name', t.career_name, 'student_count', t.n) ORDER BY t.n DESC, t.career_name), '[]'::jsonb)
    INTO v_careers
    FROM (
      SELECT c.career_name, count(DISTINCT s.user_id) AS n
        FROM public.user_saved_careers s JOIN public.careers c ON c.id = s.career_id
       WHERE s.user_id = ANY (p_student_ids)
       GROUP BY c.career_name
       ORDER BY n DESC LIMIT 10
    ) t;

  RETURN jsonb_build_object('ok', true, 'student_count', v_count, 'groups', v_groups, 'career_interests', v_careers);
END;
$$;
REVOKE ALL ON FUNCTION public.build_group_report(uuid[]) FROM PUBLIC, anon, authenticated;

-- 8. M05: dữ liệu tuyển sinh (ENT-04.9) ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admission_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  training_program_id uuid NOT NULL REFERENCES public.training_programs(id) ON DELETE CASCADE,
  admission_year smallint NOT NULL CHECK (admission_year BETWEEN 2000 AND 2100),
  admission_method text NOT NULL,
  subject_combination text,
  quota integer CHECK (quota IS NULL OR quota >= 0),
  cutoff_score numeric(6, 2),
  minimum_score numeric(6, 2),
  source_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT admission_data_unique UNIQUE (training_program_id, admission_year, admission_method, subject_combination)
);
ALTER TABLE public.admission_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read admission_data" ON public.admission_data;
CREATE POLICY "Public read admission_data" ON public.admission_data FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admin write admission_data" ON public.admission_data;
CREATE POLICY "Admin write admission_data" ON public.admission_data FOR ALL TO authenticated
  USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

-- 9. M06: phương án có dữ liệu học tập/ngân sách, báo cáo gia đình, lịch sử quyết định ----------------
ALTER TABLE public.comparison_plans
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS budget_per_year numeric,
  ADD COLUMN IF NOT EXISTS learner_score numeric,
  ADD COLUMN IF NOT EXISTS ranking jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_option_id text,
  ADD COLUMN IF NOT EXISTS preferred_reason text;

CREATE TABLE IF NOT EXISTS public.decision_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.comparison_plans(id) ON DELETE SET NULL,
  action text NOT NULL,
  note text,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.decision_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.comparison_plans(id) ON DELETE CASCADE,
  include_finance boolean NOT NULL DEFAULT false,
  owner_confirmed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.decision_report_shares (
  report_id uuid NOT NULL REFERENCES public.decision_reports(id) ON DELETE CASCADE,
  shared_with uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  consensus_at timestamptz,
  comment text,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (report_id, shared_with)
);
ALTER TABLE public.decision_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_report_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads decision history" ON public.decision_history;
CREATE POLICY "Owner reads decision history" ON public.decision_history FOR SELECT TO authenticated USING (owner_id = auth.uid());

DROP FUNCTION IF EXISTS public.list_my_comparison_plans();
CREATE OR REPLACE FUNCTION public.list_my_comparison_plans()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'title', p.title, 'career_ids', p.career_ids, 'options', p.options, 'weights', p.weights,
    'budget_per_year', p.budget_per_year, 'learner_score', p.learner_score, 'ranking', p.ranking,
    'preferred_option_id', p.preferred_option_id, 'preferred_reason', p.preferred_reason, 'created_at', p.created_at,
    'report', (SELECT jsonb_build_object('id', r.id, 'include_finance', r.include_finance, 'owner_confirmed_at', r.owner_confirmed_at,
                 'shares', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', s.shared_with, 'consensus_at', s.consensus_at, 'comment', s.comment))
                                       FROM public.decision_report_shares s WHERE s.report_id = r.id), '[]'::jsonb))
                 FROM public.decision_reports r WHERE r.plan_id = p.id ORDER BY r.created_at DESC LIMIT 1)
  ) ORDER BY p.created_at DESC), '[]'::jsonb)
  FROM public.comparison_plans p WHERE p.owner_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.save_decision_plan(
  p_title text, p_career_ids uuid[], p_options jsonb, p_weights jsonb,
  p_budget numeric, p_learner_score numeric, p_ranking jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_n integer := jsonb_array_length(COALESCE(p_options, '[]'::jsonb));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;
  IF v_n < 2 OR v_n > 4 THEN RAISE EXCEPTION 'plan_size'; END IF;
  INSERT INTO public.comparison_plans (owner_id, title, career_ids, options, weights, budget_per_year, learner_score, ranking)
  VALUES (auth.uid(), trim(p_title), COALESCE(p_career_ids, ARRAY[]::uuid[]), p_options, COALESCE(p_weights, '{}'::jsonb),
          p_budget, p_learner_score, COALESCE(p_ranking, '[]'::jsonb))
  RETURNING id INTO v_id;
  INSERT INTO public.decision_history (owner_id, plan_id, action) VALUES (auth.uid(), v_id, 'created');
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_preferred_option(p_plan_id uuid, p_option_id text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.comparison_plans SET preferred_option_id = p_option_id, preferred_reason = NULLIF(trim(p_reason), '')
   WHERE id = p_plan_id AND owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.decision_history (owner_id, plan_id, action, note) VALUES (auth.uid(), p_plan_id, 'preferred:' || p_option_id, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_decision_report(p_plan_id uuid, p_include_finance boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.comparison_plans WHERE id = p_plan_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.decision_reports (owner_id, plan_id, include_finance) VALUES (auth.uid(), p_plan_id, COALESCE(p_include_finance, false))
  RETURNING id INTO v_id;
  INSERT INTO public.decision_history (owner_id, plan_id, action) VALUES (auth.uid(), p_plan_id, 'report_created');
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.share_decision_report(p_report_id uuid, p_parent_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.user_profiles;
BEGIN
  SELECT * INTO p FROM public.user_profiles WHERE id = auth.uid();
  IF public.is_under_guardian_age(p.date_of_birth) AND NOT p.guardian_consent_confirmed THEN
    RAISE EXCEPTION 'guardian_consent_required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.decision_reports WHERE id = p_report_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_relationships WHERE requester_id = p_parent_id AND target_id = auth.uid()
                   AND relationship_type = 'parent' AND status = 'accepted') THEN
    RAISE EXCEPTION 'parent_not_linked';
  END IF;
  INSERT INTO public.decision_report_shares (report_id, shared_with) VALUES (p_report_id, p_parent_id)
  ON CONFLICT DO NOTHING;
  PERFORM public.push_notification(p_parent_id, 'decision_report_shared', 'Con đã chia sẻ báo cáo quyết định', NULL,
    jsonb_build_object('report_id', p_report_id));
END;
$$;

-- Người được chia sẻ chỉ đọc; tài chính ẩn khi chủ báo cáo không cho phép
CREATE OR REPLACE FUNCTION public.get_decision_report(p_report_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.decision_reports;
  pl public.comparison_plans;
  v_owner boolean;
  v_opts jsonb;
  v_rank jsonb;
BEGIN
  SELECT * INTO r FROM public.decision_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  v_owner := r.owner_id = auth.uid();
  IF NOT v_owner AND NOT EXISTS (SELECT 1 FROM public.decision_report_shares WHERE report_id = r.id AND shared_with = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO pl FROM public.comparison_plans WHERE id = r.plan_id;
  v_opts := pl.options;
  v_rank := pl.ranking;
  IF NOT v_owner AND NOT r.include_finance THEN
    SELECT COALESCE(jsonb_agg(o - 'tuitionPerYear'), '[]'::jsonb) INTO v_opts FROM jsonb_array_elements(pl.options) o;
    SELECT COALESCE(jsonb_agg(o - 'tuitionPerYear' - 'financeScore' - 'overBudget'), '[]'::jsonb) INTO v_rank FROM jsonb_array_elements(pl.ranking) o;
  END IF;
  RETURN jsonb_build_object(
    'id', r.id, 'title', pl.title, 'owner_name', (SELECT COALESCE(display_name, full_name, '') FROM public.user_profiles WHERE id = r.owner_id),
    'is_owner', v_owner, 'include_finance', r.include_finance,
    'budget_per_year', CASE WHEN v_owner OR r.include_finance THEN pl.budget_per_year END,
    'options', v_opts, 'ranking', v_rank, 'preferred_option_id', pl.preferred_option_id, 'preferred_reason', pl.preferred_reason,
    'owner_confirmed_at', r.owner_confirmed_at,
    'shares', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', s.shared_with, 'consensus_at', s.consensus_at, 'comment', s.comment))
                          FROM public.decision_report_shares s
                         WHERE s.report_id = r.id AND (v_owner OR s.shared_with = auth.uid())), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_shared_decision_reports()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'title', pl.title,
    'owner_name', COALESCE(u.display_name, u.full_name, ''), 'consensus_at', s.consensus_at) ORDER BY s.created_at DESC), '[]'::jsonb)
    FROM public.decision_report_shares s
    JOIN public.decision_reports r ON r.id = s.report_id
    JOIN public.comparison_plans pl ON pl.id = r.plan_id
    JOIN public.user_profiles u ON u.id = r.owner_id
   WHERE s.shared_with = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.confirm_decision_consensus(p_report_id uuid, p_comment text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.decision_reports;
BEGIN
  SELECT * INTO r FROM public.decision_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.owner_id = auth.uid() THEN
    UPDATE public.decision_reports SET owner_confirmed_at = now() WHERE id = r.id;
  ELSE
    UPDATE public.decision_report_shares SET consensus_at = now(), comment = NULLIF(trim(p_comment), '')
     WHERE report_id = r.id AND shared_with = auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
    PERFORM public.push_notification(r.owner_id, 'decision_consensus', 'Phụ huynh đã xác nhận đồng thuận', NULL,
      jsonb_build_object('report_id', r.id));
  END IF;
  INSERT INTO public.decision_history (owner_id, plan_id, action, note)
  VALUES (r.owner_id, r.plan_id, 'consensus_confirmed', p_comment);
END;
$$;

-- 10. M07: lộ trình một bản kích hoạt, mốc có hạn/trọng số/cột mốc quan trọng --------------------------
ALTER TABLE public.roadmaps
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS target_date date;
ALTER TABLE public.roadmap_milestones
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS weight numeric NOT NULL DEFAULT 1 CHECK (weight > 0),
  ADD COLUMN IF NOT EXISTS is_checkpoint boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.create_roadmap(uuid, text);
CREATE OR REPLACE FUNCTION public.create_roadmap(p_career_id uuid, p_title text, p_target_date date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;
  IF p_career_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.careers WHERE id = p_career_id) THEN
    RAISE EXCEPTION 'career_not_found';
  END IF;
  -- BR-028: chỉ một lộ trình kích hoạt, bản cũ giữ làm lịch sử
  UPDATE public.roadmaps SET is_active = false WHERE owner_id = auth.uid() AND is_active;
  INSERT INTO public.roadmaps (owner_id, career_id, title, target_date) VALUES (auth.uid(), p_career_id, trim(p_title), p_target_date)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

DROP FUNCTION IF EXISTS public.add_roadmap_milestone(uuid, text, text);
CREATE OR REPLACE FUNCTION public.add_roadmap_milestone(
  p_roadmap_id uuid, p_pillar text, p_title text,
  p_due_date date DEFAULT NULL, p_weight numeric DEFAULT 1, p_is_checkpoint boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_pillar NOT IN ('knowledge', 'experience', 'exploration') THEN RAISE EXCEPTION 'invalid_pillar'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.roadmaps WHERE id = p_roadmap_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;
  INSERT INTO public.roadmap_milestones (roadmap_id, pillar, title, due_date, weight, is_checkpoint)
  VALUES (p_roadmap_id, p_pillar, trim(p_title), p_due_date, COALESCE(p_weight, 1), COALESCE(p_is_checkpoint, false))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_roadmaps()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'title', r.title, 'career_id', r.career_id, 'career_name', c.career_name,
    'is_active', r.is_active, 'target_date', r.target_date, 'created_at', r.created_at,
    'milestones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', m.id, 'pillar', m.pillar, 'title', m.title, 'done', m.done,
               'due_date', m.due_date, 'weight', m.weight, 'is_checkpoint', m.is_checkpoint) ORDER BY m.due_date NULLS LAST, m.created_at)
        FROM public.roadmap_milestones m WHERE m.roadmap_id = r.id
    ), '[]'::jsonb)
  ) ORDER BY r.is_active DESC, r.created_at DESC), '[]'::jsonb)
  FROM public.roadmaps r
  LEFT JOIN public.careers c ON c.id = r.career_id
  WHERE r.owner_id = auth.uid();
$$;

-- 11. M08: hồ sơ năng lực, nhãn Đã xác thực 360° (12 tháng, tự sửa mất nhãn), gợi ý khóa học/dự án -----
CREATE TABLE IF NOT EXISTS public.skill_profile_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('soft_skill', 'hard_skill', 'certificate', 'project', 'experience')),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  criteria_id uuid REFERENCES public.criteria(id) ON DELETE SET NULL,
  self_level smallint CHECK (self_level IS NULL OR self_level BETWEEN 1 AND 5),
  verified_360 boolean NOT NULL DEFAULT false,
  verified_until date,
  evidence text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.course_project_suggestions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  criteria_id uuid REFERENCES public.criteria(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('course', 'project', 'certificate')),
  title text NOT NULL,
  provider text,
  url text,
  is_partner boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.skill_profile_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_project_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages skills" ON public.skill_profile_items;
CREATE POLICY "Owner manages skills" ON public.skill_profile_items FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'university_student');
DROP POLICY IF EXISTS "Read suggestions" ON public.course_project_suggestions;
CREATE POLICY "Read suggestions" ON public.course_project_suggestions FOR SELECT TO authenticated USING (is_active OR public.is_system_admin());
DROP POLICY IF EXISTS "Admin writes suggestions" ON public.course_project_suggestions;
CREATE POLICY "Admin writes suggestions" ON public.course_project_suggestions FOR ALL TO authenticated
  USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

CREATE OR REPLACE FUNCTION public.guard_verified_skill()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.verified_360 AND current_setting('app.skill_import', true) IS DISTINCT FROM '1' THEN
    NEW.verified_360 := false; NEW.verified_until := NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND current_setting('app.skill_import', true) IS DISTINCT FROM '1' THEN
    IF NEW.verified_360 AND NOT OLD.verified_360 THEN NEW.verified_360 := false; END IF;
    IF OLD.verified_360 AND (NEW.self_level IS DISTINCT FROM OLD.self_level OR NEW.title IS DISTINCT FROM OLD.title) THEN
      NEW.verified_360 := false; NEW.verified_until := NULL;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_verified_skill ON public.skill_profile_items;
CREATE TRIGGER guard_verified_skill BEFORE INSERT OR UPDATE ON public.skill_profile_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_verified_skill();

CREATE OR REPLACE FUNCTION public.import_verified_soft_skills()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result uuid;
  v_final timestamptz;
  v_count integer;
BEGIN
  IF (SELECT role FROM public.user_profiles WHERE id = auth.uid()) <> 'university_student' THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT id, finalized_at INTO v_result, v_final FROM public.assessment_results
   WHERE user_id = auth.uid() AND status_label = 'final_360' ORDER BY finalized_at DESC LIMIT 1;
  IF v_result IS NULL THEN RAISE EXCEPTION 'no_final_360'; END IF;
  PERFORM set_config('app.skill_import', '1', true);
  DELETE FROM public.skill_profile_items WHERE owner_id = auth.uid() AND verified_360;
  INSERT INTO public.skill_profile_items (owner_id, kind, title, criteria_id, self_level, verified_360, verified_until, evidence)
  SELECT auth.uid(), 'soft_skill', c.name, c.id, GREATEST(1, LEAST(5, round(sc.score_1_5)))::smallint, true,
         (v_final + make_interval(months => public.param_num('result_validity_months', 12)::integer))::date,
         'Từ kết quả Cuối cùng 360°'
    FROM public.assessment_result_scores sc
    JOIN public.criteria c ON c.id = sc.criteria_id
    JOIN public.criteria_groups g ON g.id = c.group_id
   WHERE sc.result_id = v_result AND sc.score_source = 'combined_360' AND g.group_code IN ('G1','G2','G3','G4','G5')
     AND sc.score_1_5 IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM set_config('app.skill_import', '0', true);
  RETURN v_count;
END;
$$;

-- 12. M09: bình luận, sự kiện, kết nối mentor, kiểm duyệt ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.career_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  starts_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.event_registrations (
  event_id uuid NOT NULL REFERENCES public.career_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (event_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.connection_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  mentor_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now() NOT NULL,
  responded_at timestamptz,
  CONSTRAINT connection_requests_unique UNIQUE (requester_id, mentor_id)
);
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read events" ON public.career_events;
CREATE POLICY "Read events" ON public.career_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Read own registrations" ON public.event_registrations;
CREATE POLICY "Read own registrations" ON public.event_registrations FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Parties read connection" ON public.connection_requests;
CREATE POLICY "Parties read connection" ON public.connection_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR mentor_id = auth.uid());

-- Đăng bài: tự ẩn khi chứa từ khóa cấm
CREATE OR REPLACE FUNCTION public.create_community_post(p_community_id uuid, p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_hidden boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.community_members WHERE community_id = p_community_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN RAISE EXCEPTION 'body_required'; END IF;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(public.get_parameter('community_banned_keywords'), '[]'::jsonb)) k
                  WHERE length(trim(k)) > 0 AND lower(p_body) LIKE '%' || lower(trim(k)) || '%') INTO v_hidden;
  INSERT INTO public.community_posts (community_id, author_id, body, hidden_at)
  VALUES (p_community_id, auth.uid(), trim(p_body), CASE WHEN v_hidden THEN now() END)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_community_comment(p_post_id uuid, p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.community_posts p JOIN public.community_members m ON m.community_id = p.community_id
                  WHERE p.id = p_post_id AND p.hidden_at IS NULL AND m.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN RAISE EXCEPTION 'body_required'; END IF;
  INSERT INTO public.community_comments (post_id, author_id, body) VALUES (p_post_id, auth.uid(), trim(p_body)) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_communities()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description,
    'joined', EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id = c.id AND m.user_id = auth.uid()),
    'posts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'body', p.body, 'created_at', p.created_at,
               'author', (SELECT COALESCE(display_name, full_name, '') FROM public.user_profiles WHERE id = p.author_id),
               'comments', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', cm.id, 'body', cm.body,
                              'author', (SELECT COALESCE(display_name, full_name, '') FROM public.user_profiles WHERE id = cm.author_id))
                              ORDER BY cm.created_at) FROM public.community_comments cm WHERE cm.post_id = p.id), '[]'::jsonb))
             ORDER BY p.created_at DESC)
        FROM public.community_posts p
       WHERE p.community_id = c.id AND p.hidden_at IS NULL
         AND EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id = c.id AND m.user_id = auth.uid())
    ), '[]'::jsonb)
  ) ORDER BY c.created_at DESC), '[]'::jsonb)
  FROM public.communities c;
$$;

CREATE OR REPLACE FUNCTION public.list_reported_posts()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'body', p.body, 'hidden_at', p.hidden_at,
            'reports', (SELECT count(*) FROM public.content_reports r WHERE r.post_id = p.id),
            'reasons', (SELECT jsonb_agg(r.reason) FROM public.content_reports r WHERE r.post_id = p.id)) ORDER BY p.created_at DESC)
           FROM public.community_posts p
          WHERE p.hidden_at IS NOT NULL OR EXISTS (SELECT 1 FROM public.content_reports r WHERE r.post_id = p.id)), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.moderate_post(p_post_id uuid, p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_action = 'restore' THEN
    UPDATE public.community_posts SET hidden_at = NULL WHERE id = p_post_id;
    DELETE FROM public.content_reports WHERE post_id = p_post_id;
  ELSIF p_action = 'remove' THEN
    DELETE FROM public.community_posts WHERE id = p_post_id;
  ELSE RAISE EXCEPTION 'invalid_action'; END IF;
  PERFORM public.write_audit_log(auth.uid(), NULL, 'moderate_post:' || p_action, 'community_posts', p_post_id, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_mentor_profiles_admin()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', m.user_id, 'headline', m.headline, 'verified', m.verified,
            'name', COALESCE(p.display_name, p.full_name, '')) ORDER BY m.verified, m.created_at)
           FROM public.mentor_profiles m JOIN public.user_profiles p ON p.id = m.user_id), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_mentor(p_user_id uuid, p_verified boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.mentor_profiles SET verified = p_verified WHERE user_id = p_user_id;
  PERFORM public.write_audit_log(auth.uid(), p_user_id, 'verify_mentor', 'mentor_profiles', p_user_id, jsonb_build_object('verified', p_verified));
END;
$$;

-- HS dưới 16 tuổi không gửi yêu cầu kết nối 1-1 với mentor
CREATE OR REPLACE FUNCTION public.request_mentor_connection(p_mentor_id uuid, p_message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.user_profiles;
BEGIN
  SELECT * INTO p FROM public.user_profiles WHERE id = auth.uid();
  IF p.role NOT IN ('student', 'university_student') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF public.is_under_guardian_age(p.date_of_birth) THEN RAISE EXCEPTION 'under_guardian_age'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mentor_profiles WHERE user_id = p_mentor_id AND verified) THEN RAISE EXCEPTION 'mentor_not_verified'; END IF;
  INSERT INTO public.connection_requests (requester_id, mentor_id, message) VALUES (auth.uid(), p_mentor_id, NULLIF(trim(p_message), ''))
  ON CONFLICT (requester_id, mentor_id) DO UPDATE SET message = EXCLUDED.message, status = 'pending', responded_at = NULL;
  PERFORM public.push_notification(p_mentor_id, 'mentor_connection', 'Có yêu cầu kết nối mới', NULL, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_connection_requests()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'status', c.status, 'message', c.message, 'created_at', c.created_at,
    'incoming', c.mentor_id = auth.uid(),
    'other_name', (SELECT COALESCE(display_name, full_name, '') FROM public.user_profiles
                    WHERE id = CASE WHEN c.mentor_id = auth.uid() THEN c.requester_id ELSE c.mentor_id END)) ORDER BY c.created_at DESC), '[]'::jsonb)
  FROM public.connection_requests c WHERE c.requester_id = auth.uid() OR c.mentor_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.respond_connection_request(p_id uuid, p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.connection_requests SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END, responded_at = now()
   WHERE id = p_id AND mentor_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_career_event(p_school_id uuid, p_title text, p_description text, p_location text, p_starts_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_school uuid := COALESCE(p_school_id, (SELECT school_id FROM public.school_staff
                                            WHERE user_id = auth.uid() AND staff_role = 'school_admin' AND status = 'active' LIMIT 1));
BEGIN
  IF NOT (public.is_system_admin() OR (v_school IS NOT NULL AND public.is_school_admin(v_school))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) < 3 OR p_starts_at IS NULL THEN RAISE EXCEPTION 'invalid_event'; END IF;
  INSERT INTO public.career_events (school_id, title, description, location, starts_at, created_by)
  VALUES (CASE WHEN public.is_system_admin() THEN p_school_id ELSE v_school END, trim(p_title), NULLIF(trim(p_description), ''), NULLIF(trim(p_location), ''), p_starts_at, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_career_events()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'description', e.description, 'location', e.location,
    'starts_at', e.starts_at, 'registered', EXISTS (SELECT 1 FROM public.event_registrations r WHERE r.event_id = e.id AND r.user_id = auth.uid()),
    'registrations', (SELECT count(*) FROM public.event_registrations r WHERE r.event_id = e.id)) ORDER BY e.starts_at), '[]'::jsonb)
  FROM public.career_events e WHERE e.starts_at > now() - interval '1 day';
$$;

CREATE OR REPLACE FUNCTION public.register_career_event(p_event_id uuid, p_register boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_register THEN
    INSERT INTO public.event_registrations (event_id, user_id) VALUES (p_event_id, auth.uid()) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.event_registrations WHERE event_id = p_event_id AND user_id = auth.uid();
  END IF;
END;
$$;

-- 13. Quyền thực thi -----------------------------------------------------------------------------------
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'set_career_fit_weights(numeric, numeric, numeric)', 'share_result_with(uuid)', 'revoke_result_share(uuid)',
    'share_result_with_email(text)',
    'list_my_connections()', 'export_my_data()', 'request_account_deletion(boolean)',
    'save_career_match_snapshot(uuid, jsonb)', 'set_career_status(uuid, text)',
    'list_my_comparison_plans()', 'save_decision_plan(text, uuid[], jsonb, jsonb, numeric, numeric, jsonb)',
    'set_preferred_option(uuid, text, text)', 'create_decision_report(uuid, boolean)', 'share_decision_report(uuid, uuid)',
    'get_decision_report(uuid)', 'list_shared_decision_reports()', 'confirm_decision_consensus(uuid, text)',
    'create_roadmap(uuid, text, date)', 'add_roadmap_milestone(uuid, text, text, date, numeric, boolean)', 'list_my_roadmaps()',
    'import_verified_soft_skills()', 'create_community_post(uuid, text)', 'add_community_comment(uuid, text)', 'list_communities()',
    'list_reported_posts()', 'moderate_post(uuid, text)', 'list_mentor_profiles_admin()', 'verify_mentor(uuid, boolean)',
    'request_mentor_connection(uuid, text)', 'list_my_connection_requests()', 'respond_connection_request(uuid, boolean)',
    'create_career_event(uuid, text, text, text, timestamptz)', 'list_career_events()', 'register_career_event(uuid, boolean)',
    'create_class(uuid, text, smallint, text)', 'get_class_dominant_groups(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  REVOKE ALL ON FUNCTION public.record_360_idle(text, integer[]) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.erase_own_360_submission(text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.record_360_idle(text, integer[]) TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.erase_own_360_submission(text) TO anon, authenticated;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
  END IF;
END $$;
