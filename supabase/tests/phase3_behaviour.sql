-- Kiểm thử hành vi Phase 3 trên database tạm (không chạy trên production).
-- Chạy sau toàn bộ migration: psql -v ON_ERROR_STOP=1 -f supabase/tests/phase3_behaviour.sql
\set QUIET on
SET client_min_messages = warning;

CREATE OR REPLACE FUNCTION public.t_act_as(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_uid::text, ''), false);
END;
$$;

CREATE OR REPLACE FUNCTION public.t_expect_error(p_sql text, p_pattern text, p_name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'FAIL %: không có lỗi, kỳ vọng %', p_name, p_pattern;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAIL %' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%' || p_pattern || '%' THEN
    RAISE EXCEPTION 'FAIL %: lỗi "%" không khớp "%"', p_name, SQLERRM, p_pattern;
  END IF;
  RAISE WARNING 'ok %', p_name;
END;
$$;
CREATE OR REPLACE FUNCTION public.t_assert(p_ok boolean, p_name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL %', p_name; END IF;
  RAISE WARNING 'ok %', p_name;
END;
$$;
GRANT EXECUTE ON FUNCTION public.t_expect_error(text, text, text), public.t_assert(boolean, text), public.t_act_as(uuid) TO authenticated, anon;

-- Dữ liệu kiểm thử ---------------------------------------------------------------------------------
CREATE TEMP TABLE ids (k text PRIMARY KEY, v uuid);
GRANT SELECT ON ids TO authenticated;
INSERT INTO criteria_groups (group_code, name, sort_order) VALUES ('G1','Năng lực',1),('G6','Sở thích',6),('G7','Động lực',7);
INSERT INTO criteria (group_id, dimension_code, name, sort_order)
SELECT id, d, n, s FROM (VALUES ('G1','D1.1','Tư duy logic',1),('G6','D6.1','Thực tế',2),('G7','D7.1','Thành tựu',3)) x(g,d,n,s)
JOIN criteria_groups g ON g.group_code = x.g;
INSERT INTO criteria_rater_visibility (criteria_id, rater_group, is_visible)
SELECT c.id, rg::rater_group, NOT (c.dimension_code = 'D6.1' AND rg = 'teacher')
  FROM criteria c CROSS JOIN unnest(ARRAY['self','parent','friend','teacher','mentor']) rg;
INSERT INTO questions (question_code, criteria_id, rater_group, content)
SELECT 'Q-' || c.dimension_code || '-' || rg, c.id, rg::rater_group, 'Câu ' || c.dimension_code
  FROM criteria c CROSS JOIN unnest(ARRAY['self','parent','friend']) rg;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'a@test', '{"role":"student"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test', '{"role":"student"}'),
  ('00000000-0000-0000-0000-00000000000c', 'p@test', '{"role":"parent"}'),
  ('00000000-0000-0000-0000-00000000000d', 'x@test', '{"role":"student"}'),
  ('00000000-0000-0000-0000-00000000000e', 'm@test', '{"role":"mentor"}'),
  ('00000000-0000-0000-0000-00000000000f', 'o@test', '{"role":"student"}');
UPDATE user_profiles SET date_of_birth = '2008-01-01', display_name = 'An' WHERE id = '00000000-0000-0000-0000-00000000000a';
UPDATE user_profiles SET date_of_birth = '2012-01-01', display_name = 'Binh' WHERE id = '00000000-0000-0000-0000-00000000000b';
UPDATE user_profiles SET role = 'system_admin' WHERE id = '00000000-0000-0000-0000-00000000000d';
UPDATE user_profiles SET date_of_birth = '2008-01-01' WHERE id = '00000000-0000-0000-0000-00000000000f';
INSERT INTO mentor_profiles (user_id, headline, verified) VALUES ('00000000-0000-0000-0000-00000000000e', 'Kỹ sư phần mềm 10 năm', true);

SET ROLE authenticated;

-- R21 / BR-003: không tự bật cờ giám hộ, dưới 16 không tạo lời mời ---------------------------------
SELECT public.t_act_as('00000000-0000-0000-0000-00000000000b');
SELECT t_expect_error($$UPDATE user_profiles SET guardian_consent_confirmed = true WHERE id = auth.uid()$$,
  'guardian_consent_not_self_service', 'HS tự bật cờ giám hộ bị chặn');
SELECT t_expect_error($$INSERT INTO invitation_links (user_id, rater_group, expected_count, expires_at)
  VALUES (auth.uid(), 'parent', 1, now() + interval '14 days')$$, 'guardian_consent_required', 'HS dưới 16 chưa có giám hộ không tạo được lời mời');
SELECT t_expect_error($$SELECT request_mentor_connection('00000000-0000-0000-0000-00000000000e', 'xin chào')$$,
  'under_guardian_age', 'HS dưới 16 không gửi kết nối mentor');

-- Giám hộ 15 phút: không tự xác nhận, người khác xác nhận thì mở khóa
CREATE TEMP TABLE tok AS SELECT create_guardian_consent_token() AS t;
SELECT t_assert((SELECT (confirm_guardian_consent((SELECT t FROM tok)) ->> 'reason') = 'subject_cannot_self_confirm'), 'HS không tự xác nhận giám hộ');
SELECT public.t_act_as('00000000-0000-0000-0000-00000000000c');
SELECT t_assert((SELECT (confirm_guardian_consent((SELECT t FROM tok)) ->> 'ok')::boolean), 'Phụ huynh xác nhận giám hộ');
SELECT t_assert((SELECT (confirm_guardian_consent((SELECT t FROM tok)) ->> 'reason') = 'token_invalid'), 'Token giám hộ chỉ dùng một lần');
SELECT public.t_act_as('00000000-0000-0000-0000-00000000000b');
INSERT INTO invitation_links (user_id, rater_group, expected_count, expires_at) VALUES (auth.uid(), 'parent', 1, now() + interval '14 days');
SELECT t_assert(true, 'Sau xác nhận giám hộ HS tạo được lời mời');

-- R21: quản trị không đọc trực tiếp kết quả; phải ghi lý do --------------------------------------
RESET ROLE; SELECT public.t_act_as(NULL);
INSERT INTO assessment_sessions (user_id, framework_version_id, package_size, status, completed_at)
SELECT '00000000-0000-0000-0000-00000000000a', id, 35, 'completed', now() FROM framework_versions WHERE is_current;
INSERT INTO assessment_answers (session_id, question_id, criteria_id, score)
SELECT s.id, q.id, q.criteria_id, CASE c.dimension_code WHEN 'D1.1' THEN 4 WHEN 'D6.1' THEN 5 ELSE 3 END
  FROM assessment_sessions s, questions q JOIN criteria c ON c.id = q.criteria_id
 WHERE s.user_id = '00000000-0000-0000-0000-00000000000a' AND q.rater_group = 'self';
INSERT INTO assessment_results (user_id, session_id, framework_version_id)
SELECT user_id, id, framework_version_id FROM assessment_sessions WHERE user_id = '00000000-0000-0000-0000-00000000000a';
INSERT INTO ids SELECT 'result_a', id FROM assessment_results WHERE user_id = '00000000-0000-0000-0000-00000000000a';
INSERT INTO invitation_links (user_id, rater_group, expected_count, expires_at) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'parent', 2, now() + interval '14 days'),
  ('00000000-0000-0000-0000-00000000000a', 'friend', 2, now() + interval '14 days');

SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-00000000000d');
SELECT t_assert((SELECT count(*) FROM assessment_results WHERE user_id = '00000000-0000-0000-0000-00000000000a') = 0,
  'Quản trị không đọc trực tiếp kết quả của HS');
SELECT t_expect_error($$SELECT admin_inspect_result('00000000-0000-0000-0000-00000000000a', 'xem')$$,
  'audit_reason_required', 'Đối soát kết quả bắt buộc lý do');
SELECT t_assert((admin_inspect_result('00000000-0000-0000-0000-00000000000a', 'Xử lý khiếu nại số 12') ->> 'id') IS NOT NULL,
  'Đối soát có lý do trả kết quả');
RESET ROLE; SELECT public.t_act_as(NULL);
SELECT t_assert((SELECT count(*) FROM audit_logs WHERE action = 'inspect_result') = 1, 'Đối soát được ghi nhật ký');
SELECT t_expect_error($$UPDATE audit_logs SET action = 'x'$$, 'audit_logs_immutable', 'Nhật ký không sửa được');
SELECT t_expect_error($$DELETE FROM audit_logs$$, 'audit_logs_immutable', 'Nhật ký không xóa được');

-- R02B / R03: S_i chưa chấm = 100 (tham số), TH = 3, tổng trọng số = 0 ---------------------------------
CREATE OR REPLACE FUNCTION pg_temp.add_sub(p_group text, p_th smallint, p_score smallint, p_s numeric) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO assessment_360_submissions (subject_user_id, rater_group, submission_channel, invitation_link_id, understanding_score,
                                          understanding_quality_score, status, submitted_at)
  SELECT '00000000-0000-0000-0000-00000000000a', p_group::rater_group, 'invite_link', l.id, p_th, p_s, 'pending', now()
    FROM invitation_links l WHERE l.user_id = '00000000-0000-0000-0000-00000000000a' AND l.rater_group = p_group::rater_group
  RETURNING id INTO v_id;
  INSERT INTO assessment_360_answers (submission_id, question_id, criteria_id, score)
  SELECT v_id, q.id, q.criteria_id, p_score FROM questions q JOIN criteria c ON c.id = q.criteria_id
   WHERE q.rater_group = p_group::rater_group AND c.dimension_code = 'D1.1';
  UPDATE assessment_360_submissions SET status = 'accepted', decided_at = now() WHERE id = v_id;
  RETURN v_id;
END;
$$;
CREATE OR REPLACE FUNCTION pg_temp.d11() RETURNS numeric LANGUAGE sql AS $$
  SELECT sc.score_percent FROM assessment_result_scores sc JOIN criteria c ON c.id = sc.criteria_id
   WHERE sc.result_id = (SELECT v FROM ids WHERE k = 'result_a') AND c.dimension_code = 'D1.1' AND sc.score_source = 'combined_360';
$$;
CREATE OR REPLACE FUNCTION pg_temp.wstatus() RETURNS text LANGUAGE sql AS $$
  SELECT qualitative_weight_status FROM assessment_results WHERE id = (SELECT v FROM ids WHERE k = 'result_a');
$$;

INSERT INTO ids SELECT 'sub_parent', pg_temp.add_sub('parent', 12::smallint, 2::smallint, NULL);
SELECT t_assert(pg_temp.d11() = 60 AND pg_temp.wstatus() = 'included',
  'S_i chưa chấm dùng mặc định 100: DS = 0,5·4 + 0,5·2 = 3 (60%)');

UPDATE assessment_360_submissions SET understanding_score = 3 WHERE id = (SELECT v FROM ids WHERE k = 'sub_parent');
SELECT recalculate_result((SELECT v FROM ids WHERE k = 'result_a'));
SELECT t_assert(pg_temp.wstatus() = 'equal_fallback' AND pg_temp.d11() = 60, 'TH = 3, tổng w = 0: chia đều, không chia cho 0');

SELECT pg_temp.add_sub('friend', 3::smallint, 5::smallint, 40);
SELECT t_assert(pg_temp.d11() = 75, 'Hai bài TH = 3 chia đều: 0,5·4 + 0,5·(2+5)/2 = 3,75 (75%)');

UPDATE assessment_360_submissions SET understanding_score = 12, understanding_quality_score = 0
 WHERE id = (SELECT v FROM ids WHERE k = 'sub_parent');
UPDATE assessment_360_submissions SET understanding_score = 12 WHERE rater_group = 'friend';
SELECT recalculate_result((SELECT v FROM ids WHERE k = 'result_a'));
SELECT t_assert(pg_temp.d11() = 90, 'S_i đã chấm 0 điểm khác chưa chấm: chỉ bạn bè (S=40) được tính, DS = 0,5·4 + 0,5·5 = 4,5');

UPDATE assessment_360_submissions SET understanding_quality_score = NULL WHERE subject_user_id = '00000000-0000-0000-0000-00000000000a';
INSERT INTO operation_parameters (param_code, param_name, param_value) VALUES ('unreviewed_supplemental_default', 'S_i khi chưa chấm', 'null');
SELECT recalculate_result((SELECT v FROM ids WHERE k = 'result_a'));
SELECT t_assert(pg_temp.wstatus() = 'pending_review' AND pg_temp.d11() IS NULL, 'Tắt mặc định S_i: chưa chấm thì chờ chấm, không tạo điểm 360 giả');
INSERT INTO operation_parameters (param_code, param_name, param_value) VALUES ('unreviewed_supplemental_default', 'S_i khi chưa chấm', '100');
SELECT recalculate_result((SELECT v FROM ids WHERE k = 'result_a'));

SELECT t_assert((SELECT snapshot_data -> 'versions' ->> 'framework' FROM assessment_result_snapshots
                  WHERE result_id = (SELECT v FROM ids WHERE k = 'result_a') ORDER BY created_at DESC LIMIT 1) IS NOT NULL
             AND (SELECT snapshot_data -> 'versions' ->> 'question_bank' FROM assessment_result_snapshots
                  WHERE result_id = (SELECT v FROM ids WHERE k = 'result_a') ORDER BY created_at DESC LIMIT 1) = 'CH-1.0',
  'R18: bản chụp lưu mã phiên bản KHUNG/CH/TS/NGHE');

-- R10: Coverage theo nhóm vai trò trên ma trận (D1.1: 5 nhóm được phân công, có self + parent + friend)
SELECT t_assert((SELECT sc.coverage FROM assessment_result_scores sc JOIN criteria c ON c.id = sc.criteria_id
                  WHERE sc.result_id = (SELECT v FROM ids WHERE k = 'result_a') AND c.dimension_code = 'D1.1'
                    AND sc.score_source = 'combined_360') = 0.6, 'Coverage D1.1 = 3/5 nhóm');

-- P18: không làm lại trước 14 ngày
SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-00000000000a');
SELECT t_expect_error($$INSERT INTO assessment_sessions (user_id, framework_version_id, package_size)
  SELECT auth.uid(), id, 35 FROM framework_versions WHERE is_current$$, 'retake_too_soon', 'Chặn làm lại trong 14 ngày (P18)');

-- R21 khách xóa bài đã nộp
RESET ROLE; SELECT public.t_act_as(NULL);
INSERT INTO ids SELECT 'tok_friend', NULL;
CREATE TEMP TABLE ftok AS SELECT resume_token FROM assessment_360_submissions WHERE rater_group = 'friend';
GRANT SELECT ON ftok TO anon;
SET ROLE anon;
SELECT t_assert((erase_own_360_submission((SELECT resume_token FROM ftok)) ->> 'ok')::boolean, 'Khách xóa bài đã nộp bằng mã làm tiếp');
RESET ROLE; SELECT public.t_act_as(NULL);
SELECT t_assert(NOT EXISTS (SELECT 1 FROM assessment_360_submissions WHERE rater_group = 'friend'), 'Bài khách đã bị xóa');

-- P32 + P33 + P34 = 100%
SELECT t_expect_error($$INSERT INTO operation_parameters (param_code, param_name, param_value) VALUES ('career_fit_weight_competency', 'x', '0.5')$$,
  'P32 + P33 + P34', 'Đổi lẻ P32 làm tổng khác 100% bị chặn');
SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-00000000000d');
SELECT set_career_fit_weights(0.5, 0.2, 0.3);
RESET ROLE; SELECT public.t_act_as(NULL);
SELECT t_assert(param_num('career_fit_weight_competency', 0) = 0.5, 'Quản trị đổi đồng thời P32/P33/P34 hợp lệ');
SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-00000000000a');
SELECT t_expect_error($$SELECT set_career_fit_weights(0.4, 0.3, 0.3)$$, 'forbidden', 'HS không sửa tham số');

-- M03 liên kết phụ huynh, M06 báo cáo gia đình ẩn tài chính ----------------------------------------
CREATE TEMP TABLE pcode AS SELECT create_parent_link_code() AS c;
SELECT public.t_act_as('00000000-0000-0000-0000-00000000000c');
SELECT t_assert((accept_parent_link((SELECT c FROM pcode)) ->> 'ok')::boolean, 'Phụ huynh liên kết bằng mã');
SELECT t_assert((SELECT count(*) FROM assessment_results WHERE user_id = '00000000-0000-0000-0000-00000000000a') = 0,
  'Liên kết chưa đủ để xem kết quả khi con chưa chia sẻ');
SELECT public.t_act_as('00000000-0000-0000-0000-00000000000a');
SELECT share_result_with('00000000-0000-0000-0000-00000000000c');
SELECT public.t_act_as('00000000-0000-0000-0000-00000000000c');
SELECT t_assert((SELECT count(*) FROM assessment_results WHERE user_id = '00000000-0000-0000-0000-00000000000a') = 1,
  'Con chia sẻ thì phụ huynh xem được kết quả tổng hợp');
SELECT t_assert((SELECT count(*) FROM assessment_result_weights) = 0, 'Phụ huynh không đọc được trọng số từng người chấm');

SELECT public.t_act_as('00000000-0000-0000-0000-00000000000a');
CREATE TEMP TABLE plan AS SELECT save_decision_plan('Phương án 2027', ARRAY[]::uuid[],
  '[{"id":"A","title":"Trường A","tuitionPerYear":30},{"id":"B","title":"Trường B","tuitionPerYear":20}]',
  '{"careerFit":40}', 25, 24, '[{"id":"B","tuitionPerYear":20,"financeScore":100,"overBudget":false}]') AS id;
CREATE TEMP TABLE rep AS SELECT create_decision_report((SELECT id FROM plan), false) AS id;
SELECT share_decision_report((SELECT id FROM rep), '00000000-0000-0000-0000-00000000000c');
SELECT public.t_act_as('00000000-0000-0000-0000-00000000000c');
SELECT t_assert((get_decision_report((SELECT id FROM rep)) -> 'options' -> 0 -> 'tuitionPerYear') IS NULL
             AND (get_decision_report((SELECT id FROM rep)) ->> 'budget_per_year') IS NULL, 'Báo cáo chia sẻ ẩn tài chính khi con không cho phép');
SELECT confirm_decision_consensus((SELECT id FROM rep), 'Đồng ý');
SELECT t_assert((get_decision_report((SELECT id FROM rep)) -> 'shares' -> 0 ->> 'consensus_at') IS NOT NULL, 'Phụ huynh xác nhận đồng thuận');
SELECT public.t_act_as('00000000-0000-0000-0000-00000000000f');
SELECT t_expect_error($$SELECT get_decision_report((SELECT id FROM rep))$$, 'forbidden', 'Người không được chia sẻ không đọc báo cáo');
SELECT t_expect_error($$SELECT save_career_match_snapshot((SELECT v FROM ids WHERE k = 'result_a'), '{}')$$, 'forbidden',
  'Không lưu bản chụp đối sánh của người khác');

-- M09: bài bị 3 người báo cáo tự ẩn; từ khóa cấm tự ẩn ---------------------------------------------
SELECT public.t_act_as('00000000-0000-0000-0000-00000000000a');
CREATE TEMP TABLE com AS SELECT create_community('Nhóm CNTT', 'Hỏi đáp nghề') AS id;
CREATE TEMP TABLE post AS SELECT create_community_post((SELECT id FROM com), 'Học CNTT cần gì?') AS id;
SELECT public.t_act_as('00000000-0000-0000-0000-00000000000c'); SELECT report_community_post((SELECT id FROM post), 'Nội dung không phù hợp');
SELECT public.t_act_as('00000000-0000-0000-0000-00000000000f'); SELECT report_community_post((SELECT id FROM post), 'Nội dung không phù hợp');
SELECT public.t_act_as('00000000-0000-0000-0000-00000000000e'); SELECT report_community_post((SELECT id FROM post), 'Nội dung không phù hợp');
RESET ROLE; SELECT public.t_act_as(NULL);
SELECT t_assert((SELECT hidden_at IS NOT NULL FROM community_posts WHERE id = (SELECT id FROM post)), 'Bài bị 3 báo cáo tự ẩn');
INSERT INTO operation_parameters (param_code, param_name, param_value) VALUES ('community_banned_keywords', 'Từ khóa cấm', '["lừa đảo"]');
SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-00000000000a');
CREATE TEMP TABLE post2 AS SELECT create_community_post((SELECT id FROM com), 'Đây là lừa đảo') AS id;
RESET ROLE; SELECT public.t_act_as(NULL);
SELECT t_assert((SELECT hidden_at IS NOT NULL FROM community_posts WHERE id = (SELECT id FROM post2)), 'Bài chứa từ khóa cấm tự ẩn');

-- M04: nghề đủ 3 thành phần được công bố; JD L0 vào ma trận HSSV ---------------------------------------
INSERT INTO career_fields (field_code, field_name) VALUES ('LV9', 'Thử nghiệm');
INSERT INTO careers (career_code, career_field_id, career_name, source_group_id, holland_top3)
SELECT 'T-01', id, 'Kỹ sư thử nghiệm', 'T', 'IRC' FROM career_fields WHERE field_code = 'LV9';
INSERT INTO career_requirements (career_id, criteria_id, matrix_version_id, required_score, career_weight)
SELECT k.id, c.id, v.id, 3, 1 FROM careers k, criteria c, career_matrix_versions v
 WHERE k.career_code = 'T-01' AND c.dimension_code IN ('D1.1', 'D7.1') AND v.is_current;
\ir ../migrations/20261031000100_phase3_rules_and_modules.sql
SELECT t_assert((SELECT status = 'published' AND is_standard_complete FROM careers WHERE career_code = 'T-01'),
  'Nghề có G1–G5, G7 (CW > 0) và Holland được công bố, không ép 25/25 tiêu chí');
INSERT INTO career_job_descriptions (career_id, source_id, career_level, required_level)
SELECT id, 999001, 0, 1 FROM careers WHERE career_code = 'T-01';
SELECT t_assert((SELECT count(*) FROM career_matrix_job_descriptions WHERE source_id = 999001) = 1, 'JD L0 thuộc phạm vi ma trận HSSV');

DROP FUNCTION public.t_expect_error(text, text, text);
DROP FUNCTION public.t_assert(boolean, text);
DROP FUNCTION public.t_act_as(uuid);
\echo 'Hoàn tất kiểm thử Phase 3'
