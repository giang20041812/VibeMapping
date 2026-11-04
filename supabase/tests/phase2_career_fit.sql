-- Kiểm thử Career Fit trên máy chủ (R05–R08, R13, R19, R20, BR-016, BR-017) trên database tạm.
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

-- Dữ liệu: G1 (D1.1, D1.2), G6 (D6.1–D6.6), G7 (D7.1) ----------------------------------------------
INSERT INTO criteria_groups (group_code, name, sort_order) VALUES ('G1', 'Năng lực', 1), ('G6', 'Sở thích', 6), ('G7', 'Động lực', 7);
INSERT INTO criteria (group_id, dimension_code, name, sort_order)
SELECT g.id, x.d, x.n, x.s FROM (VALUES
  ('G1', 'D1.1', 'Tư duy logic', 1), ('G1', 'D1.2', 'Giao tiếp', 2),
  ('G6', 'D6.1', 'Thực tế', 3), ('G6', 'D6.2', 'Nghiên cứu', 4), ('G6', 'D6.3', 'Nghệ thuật', 5),
  ('G6', 'D6.4', 'Xã hội', 6), ('G6', 'D6.5', 'Kinh doanh', 7), ('G6', 'D6.6', 'Quy củ', 8),
  ('G7', 'D7.1', 'Thành tựu', 9)) x(g, d, n, s)
JOIN criteria_groups g ON g.group_code = x.g;
INSERT INTO questions (question_code, criteria_id, rater_group, content)
SELECT 'Q-' || c.dimension_code, c.id, 'self', 'Câu ' || c.dimension_code FROM criteria c;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'a1@test', '{"role":"student"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b1@test', '{"role":"student"}');
UPDATE user_profiles SET date_of_birth = '2008-01-01' WHERE id IN ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');

INSERT INTO career_fields (field_code, field_name) VALUES ('LV8', 'Thử nghiệm');
-- K-01: D1.1 Req 4 CW .5, D1.2 Req 4 CW .5, D7.1 Req 3 CW 1; Holland R .8, I .5
-- K-02: D1.1 Req 2 CW 1, D7.1 Req 5 CW 1; Holland S 1
-- K-03: bản nháp, không được tính
INSERT INTO careers (career_code, career_field_id, career_name, source_group_id, holland_top3, status, is_standard_complete)
SELECT x.code, f.id, x.name, 'T', x.h, x.st, true FROM career_fields f, (VALUES
  ('K-01', 'Nghề Một', 'RI', 'published'), ('K-02', 'Nghề Hai', 'S', 'published'), ('K-03', 'Nghề Ba', 'R', 'draft')) x(code, name, h, st)
WHERE f.field_code = 'LV8';
INSERT INTO career_requirements (career_id, criteria_id, matrix_version_id, required_score, career_weight)
SELECT k.id, c.id, v.id, x.req, x.cw FROM (VALUES
  ('K-01', 'D1.1', 4, 0.5), ('K-01', 'D1.2', 4, 0.5), ('K-01', 'D7.1', 3, 1),
  ('K-02', 'D1.1', 2, 1), ('K-02', 'D7.1', 5, 1),
  ('K-03', 'D1.1', 1, 1), ('K-03', 'D7.1', 1, 1)) x(code, d, req, cw)
JOIN careers k ON k.career_code = x.code JOIN criteria c ON c.dimension_code = x.d
CROSS JOIN career_matrix_versions v WHERE v.is_current;
INSERT INTO career_holland_profiles (career_id, holland_code, strength, jd_count)
SELECT k.id, x.h, x.s, 1 FROM (VALUES ('K-01', 'R', 0.8), ('K-01', 'I', 0.5), ('K-02', 'S', 1.0), ('K-03', 'R', 1.0)) x(code, h, s)
JOIN careers k ON k.career_code = x.code;

-- Tự đánh giá: D1.1 = 4, D1.2 = 2, D6 = R5 I4 A1 S2 E1 C1, D7.1 = 3
INSERT INTO assessment_sessions (user_id, framework_version_id, package_size, status, completed_at)
SELECT '00000000-0000-0000-0000-0000000000a1', id, 35, 'completed', now() FROM framework_versions WHERE is_current;
INSERT INTO assessment_answers (session_id, question_id, criteria_id, score)
SELECT s.id, q.id, q.criteria_id, x.score
  FROM assessment_sessions s
  CROSS JOIN (VALUES ('D1.1', 4), ('D1.2', 2), ('D6.1', 5), ('D6.2', 4), ('D6.3', 1), ('D6.4', 2),
                     ('D6.5', 1), ('D6.6', 1), ('D7.1', 3)) x(d, score)
  JOIN criteria c ON c.dimension_code = x.d
  JOIN questions q ON q.criteria_id = c.id
 WHERE s.user_id = '00000000-0000-0000-0000-0000000000a1';
INSERT INTO assessment_results (user_id, session_id, framework_version_id)
SELECT user_id, id, framework_version_id FROM assessment_sessions WHERE user_id = '00000000-0000-0000-0000-0000000000a1';

CREATE TEMP TABLE ids (k text PRIMARY KEY, v uuid);
GRANT SELECT ON ids TO authenticated;
INSERT INTO ids SELECT 'result', id FROM assessment_results WHERE user_id = '00000000-0000-0000-0000-0000000000a1';
INSERT INTO ids SELECT 'k1', id FROM careers WHERE career_code = 'K-01';
INSERT INTO ids SELECT 'k2', id FROM careers WHERE career_code = 'K-02';

CREATE OR REPLACE FUNCTION pg_temp.fit(p_code text) RETURNS numeric LANGUAGE sql AS $$
  SELECT round(f.career_fit_raw, 4) FROM career_fit_results f JOIN careers c ON c.id = f.career_id
   WHERE f.result_id = (SELECT v FROM ids WHERE k = 'result') AND c.career_code = p_code;
$$;
CREATE OR REPLACE FUNCTION pg_temp.notif_count() RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM notifications WHERE user_id = '00000000-0000-0000-0000-0000000000a1' AND notification_type = 'career_ranking_changed';
$$;

-- Tính điểm đánh giá → trigger tự tính nghề ---------------------------------------------------------
SELECT recalculate_result((SELECT v FROM ids WHERE k = 'result'));

SELECT t_assert((SELECT count(*) FROM career_fit_results WHERE result_id = (SELECT v FROM ids WHERE k = 'result')) = 2,
  'Chỉ nghề Đang hiển thị và đủ chuẩn được tính (bỏ bản nháp)');
-- K-01: G1–G5 = (1·.5 + .5·.5)/1 = .75; G6 = (.8 + .5)/1,3 = 1; G7 = 1 → 40·.75 + 30 + 30 = 90
SELECT t_assert(pg_temp.fit('K-01') = 90, 'Career Fit K-01 = 90 (R06, R08, G6 Demo)');
-- K-02: G1–G5 = 1; G6 = .4/1 = .4; G7 = 3/5 = .6 → 40 + 12 + 18 = 70
SELECT t_assert(pg_temp.fit('K-02') = 70, 'Career Fit K-02 = 70');
SELECT t_assert((SELECT highest_weight_gap = 2 AND unmet_criteria_count = 1 FROM career_fit_results
                  WHERE career_id = (SELECT v FROM ids WHERE k = 'k1')), 'Tiêu chí phụ R20: Gap ở tiêu chí CW cao nhất và số tiêu chí chưa đạt');
SELECT t_assert((SELECT payload -> 'top_after' = to_jsonb(ARRAY[(SELECT v FROM ids WHERE k = 'k1'), (SELECT v FROM ids WHERE k = 'k2')])
                        AND payload -> 'versions' ->> 'career_matrix' = 'NGHE-1.0'
                        AND payload -> 'versions' ->> 'question_bank' IS NOT NULL
                        AND jsonb_array_length(payload -> 'details' -> 0 -> 'criteria') > 0
                   FROM career_match_snapshots WHERE result_id = (SELECT v FROM ids WHERE k = 'result')),
  'Bản chụp R19 có Top, bốn mã phiên bản và từng tiêu chí');
SELECT t_assert(pg_temp.notif_count() = 0, 'Lần tính đầu không gửi thông báo thay đổi');

-- Tính lại không đổi Top: không thêm bản chụp, không thông báo
SELECT recalculate_result((SELECT v FROM ids WHERE k = 'result'));
SELECT t_assert((SELECT count(*) FROM career_match_snapshots WHERE user_id = '00000000-0000-0000-0000-0000000000a1') = 1
             AND pg_temp.notif_count() = 0, 'Top không đổi thì không thêm bản chụp và không báo');

-- RPC đọc ---------------------------------------------------------------------------------------
SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000a1');
SELECT t_assert((SELECT jsonb_array_length(x -> 'items') = 2 AND x -> 'items' -> 0 ->> 'career_code' = 'K-01'
                        AND (x ->> 'has_scores')::boolean AND (x ->> 'learner_completeness')::numeric = 1
                   FROM get_career_recommendations() x), 'Danh sách gợi ý: K-01 đứng đầu, người học đủ 3 thành phần');
SELECT t_assert((SELECT count(*) FROM career_fit_results) = 2, 'Người học đọc được kết quả nghề của mình');

-- Thêm nghề mới công bố → lần đọc sau tự tính lại và báo nghề mới vào ----------------------------------
RESET ROLE; SELECT public.t_act_as(NULL);
INSERT INTO careers (career_code, career_field_id, career_name, source_group_id, holland_top3, status, is_standard_complete)
SELECT 'K-04', id, 'Nghề Bốn', 'T', 'R', 'published', true FROM career_fields WHERE field_code = 'LV8';
INSERT INTO career_requirements (career_id, criteria_id, matrix_version_id, required_score, career_weight)
SELECT k.id, c.id, v.id, 1, 1 FROM careers k, criteria c, career_matrix_versions v
 WHERE k.career_code = 'K-04' AND c.dimension_code IN ('D1.1', 'D7.1') AND v.is_current;
INSERT INTO career_holland_profiles (career_id, holland_code, strength, jd_count)
SELECT id, 'R', 1, 1 FROM careers WHERE career_code = 'K-04';
INSERT INTO ids SELECT 'k4', id FROM careers WHERE career_code = 'K-04';

SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000a1');
SELECT t_assert((SELECT x -> 'items' -> 0 ->> 'career_code' = 'K-04' FROM get_career_recommendations() x),
  'Nghề mới công bố được tính ngay ở lần đọc sau');
RESET ROLE; SELECT public.t_act_as(NULL);
SELECT t_assert(pg_temp.notif_count() = 1
             AND (SELECT body LIKE '%Mới vào: Nghề Bốn%' AND payload ->> 'href' = '/nghe' FROM notifications
                   WHERE notification_type = 'career_ranking_changed' ORDER BY created_at DESC LIMIT 1),
  'Thông báo nêu nghề mới vào danh sách');
SELECT t_assert((SELECT reason = 'catalog_changed' FROM career_fit_runs WHERE result_id = (SELECT v FROM ids WHERE k = 'result')),
  'Lý do tính lại được ghi');

-- Điểm giảm: K-02 = 50 → Nghề gần đạt (không > P06), thứ tự không đổi nên không báo thêm ---------------
UPDATE assessment_answers SET score = 1
 WHERE criteria_id = (SELECT id FROM criteria WHERE dimension_code = 'D1.1')
   AND session_id = (SELECT session_id FROM assessment_results WHERE id = (SELECT v FROM ids WHERE k = 'result'));
SELECT recalculate_result((SELECT v FROM ids WHERE k = 'result'));
SELECT t_assert(pg_temp.fit('K-02') = 50 AND pg_temp.fit('K-01') = 75, 'Tính lại theo điểm mới: K-01 = 75, K-02 = 50');
SELECT t_assert((SELECT near_threshold FROM career_fit_ranked((SELECT v FROM ids WHERE k = 'result')) WHERE career_id = (SELECT v FROM ids WHERE k = 'k2')),
  'Đúng 50% là Nghề gần đạt (ngưỡng lớn hơn P06)');
SELECT t_assert(pg_temp.notif_count() = 1, 'Thứ tự Top không đổi thì không báo');

-- Nghề rớt dưới P25 bị thay, nghề có Fit cao kế tiếp vẫn giữ thứ tự (BR-017) -----------------------------
UPDATE career_requirements SET required_score = 5
 WHERE career_id = (SELECT v FROM ids WHERE k = 'k2') AND criteria_id = (SELECT id FROM criteria WHERE dimension_code = 'D1.1');
SELECT refresh_career_ranking((SELECT v FROM ids WHERE k = 'result'), 'test');
-- K-02: G1 = 1/5 = .2 → 8 + 12 + 18 = 38 < 40
SELECT t_assert(NOT EXISTS (SELECT 1 FROM career_fit_ranked((SELECT v FROM ids WHERE k = 'result')) WHERE career_id = (SELECT v FROM ids WHERE k = 'k2')),
  'Nghề dưới 40% rời danh sách');
SELECT t_assert(pg_temp.notif_count() = 2
             AND (SELECT body LIKE '%Rời danh sách: Nghề Hai%' FROM notifications
                   WHERE notification_type = 'career_ranking_changed' ORDER BY created_at DESC, id LIMIT 1),
  'Thông báo nêu nghề rời danh sách');

-- Chi tiết: tầng 2 R19 và lệch góc nhìn --------------------------------------------------------------
SELECT set_config('app.internal_write', '1', false);
INSERT INTO assessment_result_scores (result_id, criteria_id, score_source, score_1_5, score_percent)
SELECT (SELECT v FROM ids WHERE k = 'result'), id, 'parent', 4, 80 FROM criteria WHERE dimension_code = 'D1.1';
SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000a1');
CREATE TEMP TABLE det AS SELECT get_career_fit_detail((SELECT v FROM ids WHERE k = 'k1')) AS d;
SELECT t_assert((SELECT round((d -> 'fit' ->> 'career_fit_raw')::numeric, 4) = 75 AND jsonb_array_length(d -> 'criteria') = 3 FROM det),
  'Chi tiết nghề: Career Fit và đủ tiêu chí');
-- Phần G1–G5 (40%): điểm góp + điểm bị trừ = 40
SELECT t_assert((SELECT round(sum((c ->> 'penalty_points')::numeric + (c ->> 'contribution_points')::numeric), 4) = 40
                   FROM det, jsonb_array_elements(d -> 'criteria') c WHERE c ->> 'group_code' = 'G1'),
  'Điểm góp và điểm bị trừ của G1–G5 cộng đủ 40 điểm');
SELECT t_assert((SELECT d -> 'perception_gaps' -> 0 ->> 'group' = 'parent' AND (d -> 'perception_gaps' -> 0 ->> 'delta_percent')::numeric = 60 FROM det),
  'Lệch góc nhìn ≥ 25 điểm ở tiêu chí cốt lõi, nêu theo nhóm');
SELECT t_assert((SELECT (d -> 'criteria' -> 0 ->> 'priority') = 'P1' FROM det), 'Ưu tiên cải thiện theo Gap');

-- Quyền ----------------------------------------------------------------------------------------
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000b1');
SELECT t_expect_error($$SELECT get_career_recommendations('00000000-0000-0000-0000-0000000000a1')$$, 'forbidden',
  'Người khác không xem gợi ý nghề khi chưa được chia sẻ');
SELECT t_expect_error($$SELECT get_career_fit_detail((SELECT v FROM ids WHERE k = 'k1'), '00000000-0000-0000-0000-0000000000a1')$$, 'forbidden',
  'Người khác không xem chi tiết phù hợp khi chưa được chia sẻ');
SELECT t_assert((SELECT count(*) FROM career_fit_results) = 0, 'Người khác không đọc được bảng kết quả nghề');
SELECT t_assert((SELECT (x ->> 'has_result')::boolean = false FROM get_career_recommendations() x), 'Chưa có kết quả: báo chưa có, không lỗi');

-- Nghề mục tiêu: tối đa 2, bỏ chọn được, lưu lịch sử (BR-018); nghề mục tiêu ngoài Top vẫn hiện -------------
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000a1');
SELECT save_career_bookmark((SELECT v FROM ids WHERE k = 'k1'), 'target');
SELECT save_career_bookmark((SELECT v FROM ids WHERE k = 'k2'), 'target');
SELECT t_expect_error($$SELECT save_career_bookmark((SELECT v FROM ids WHERE k = 'k4'), 'target')$$, 'target_career_limit',
  'Không đặt quá 2 nghề mục tiêu');
SELECT t_assert((SELECT jsonb_array_length(x -> 'targets') = 2
                        AND EXISTS (SELECT 1 FROM jsonb_array_elements(x -> 'targets') t
                                     WHERE t ->> 'career_code' = 'K-02' AND NOT (t ->> 'in_top')::boolean)
                   FROM get_career_recommendations() x), 'Nghề mục tiêu ngoài Top vẫn có trong danh sách');
SELECT remove_career_bookmark((SELECT v FROM ids WHERE k = 'k2'), 'target');
SELECT save_career_bookmark((SELECT v FROM ids WHERE k = 'k4'), 'target');
SELECT t_assert((SELECT count(*) FROM target_career_history) = 4
             AND (SELECT count(*) FROM target_career_history WHERE action = 'unset') = 1,
  'Lịch sử nghề mục tiêu ghi cả đặt và bỏ');
SELECT save_career_bookmark((SELECT v FROM ids WHERE k = 'k2'), 'saved');
SELECT remove_career_bookmark((SELECT v FROM ids WHERE k = 'k2'), 'saved');
SELECT t_assert((SELECT jsonb_array_length(list_my_saved_careers())) = 2, 'Bỏ lưu nghề quan tâm');
RESET ROLE; SELECT public.t_act_as(NULL);

DROP FUNCTION public.t_expect_error(text, text, text);
DROP FUNCTION public.t_assert(boolean, text);
DROP FUNCTION public.t_act_as(uuid);
\echo 'Hoàn tất kiểm thử Phase 2 – Career Fit'
