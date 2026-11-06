-- Kiểm thử lộ trình phát triển (M07) trên database tạm: BR-018, BR-025..BR-028, FR07.01.11, FR07.01.12.
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

-- Dữ liệu --------------------------------------------------------------------------------------------
INSERT INTO criteria_groups (group_code, name, sort_order) VALUES ('G1', 'Tính cách', 1), ('G3', 'Giao tiếp', 3);
INSERT INTO criteria (group_id, dimension_code, name, sort_order)
SELECT g.id, x.d, x.n, x.s FROM (VALUES ('G1', 'D1.1', 'Kiên trì', 1), ('G3', 'D3.1', 'Thuyết trình', 2)) x(g, d, n, s)
JOIN criteria_groups g ON g.group_code = x.g;
INSERT INTO questions (question_code, criteria_id, rater_group, content)
SELECT 'Q-' || c.dimension_code, c.id, 'self', 'Câu ' || c.dimension_code FROM criteria c;
INSERT INTO career_fields (field_code, field_name) VALUES ('LV9', 'Thử nghiệm');
INSERT INTO careers (career_code, career_field_id, career_name, source_group_id, holland_top3, status, is_standard_complete)
SELECT x.code, f.id, x.name, 'T', 'R', 'published', true FROM career_fields f,
  (VALUES ('R-01', 'Nghề A'), ('R-02', 'Nghề B'), ('R-03', 'Nghề C')) x(code, name) WHERE f.field_code = 'LV9';

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test', '{"role":"student"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test', '{"role":"student"}');
UPDATE user_profiles SET date_of_birth = '2008-01-01' WHERE id IN ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2');

INSERT INTO assessment_sessions (user_id, framework_version_id, package_size, status, completed_at)
SELECT '00000000-0000-0000-0000-0000000000c1', id, 35, 'completed', now() FROM framework_versions WHERE is_current;
INSERT INTO assessment_results (user_id, session_id, framework_version_id)
SELECT user_id, id, framework_version_id FROM assessment_sessions WHERE user_id = '00000000-0000-0000-0000-0000000000c1';
-- D1.1: tự 90, người khác 60 → lệch 30; D3.1: tự 40, người khác 40 → điểm thấp
INSERT INTO assessment_result_scores (result_id, criteria_id, score_source, score_percent)
SELECT r.id, c.id, x.src, x.pct FROM assessment_results r
  JOIN (VALUES ('D1.1', 'self', 90), ('D1.1', 'combined_360', 60), ('D3.1', 'self', 40), ('D3.1', 'combined_360', 40)) x(d, src, pct) ON true
  JOIN criteria c ON c.dimension_code = x.d
 WHERE r.user_id = '00000000-0000-0000-0000-0000000000c1';

CREATE TEMP TABLE ids (k text PRIMARY KEY, v uuid);
GRANT SELECT, INSERT, UPDATE ON ids TO authenticated;

-- Tạo lộ trình, tối đa 2 nghề ---------------------------------------------------------------------------
SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000c1');
INSERT INTO ids SELECT 'r1', public.create_roadmap((SELECT id FROM careers WHERE career_code = 'R-01'), 'Lộ trình 1', current_date + 200, 8, NULL);
SELECT public.t_assert((SELECT count(*) FROM roadmap_target_careers) = 1, 'create_roadmap ghi nghề mục tiêu chính');
SELECT public.set_roadmap_careers((SELECT v FROM ids WHERE k = 'r1'), ARRAY(SELECT id FROM careers WHERE career_code IN ('R-01', 'R-02') ORDER BY career_code));
SELECT public.t_assert((SELECT count(*) FROM roadmap_target_careers) = 2, 'đặt 2 nghề mục tiêu');
SELECT public.t_expect_error(format('SELECT public.set_roadmap_careers(%L, ARRAY(SELECT id FROM careers))', (SELECT v FROM ids WHERE k = 'r1')), 'careers_limit', 'BR-018: không quá 2 nghề');

-- Hoạt động và tiến độ ------------------------------------------------------------------------------------
SELECT public.add_roadmap_milestones_bulk((SELECT v FROM ids WHERE k = 'r1'), jsonb_build_array(
  jsonb_build_object('pillar', 'knowledge', 'title', 'Học A', 'due_date', current_date - 5, 'weight', 1, 'is_checkpoint', false, 'activity_type', 'course', 'expected_result', 'Biết A'),
  jsonb_build_object('pillar', 'experience', 'title', 'Làm B', 'due_date', current_date - 3, 'weight', 1, 'is_checkpoint', true, 'pass_criteria', 'Có sản phẩm'),
  jsonb_build_object('pillar', 'exploration', 'title', 'Gặp C', 'due_date', current_date + 60, 'weight', 1, 'is_checkpoint', false)));
SELECT public.t_assert((SELECT count(*) FROM roadmap_milestones WHERE source = 'system' AND roadmap_id = (SELECT v FROM ids WHERE k = 'r1')) = 3, 'hoạt động sinh từ hệ thống');
SELECT public.t_assert((public.roadmap_status((SELECT v FROM ids WHERE k = 'r1'))->>'off_track')::boolean, 'quá hạn cột mốc quan trọng là chệch hướng');

-- Lưu nhiều hoạt động một lần, có ghi chú; hoàn thành cột mốc → hết lý do cảnh báo
INSERT INTO ids SELECT 'm_a', id FROM roadmap_milestones WHERE title = 'Học A';
INSERT INTO ids SELECT 'm_b', id FROM roadmap_milestones WHERE title = 'Làm B';
SELECT public.t_assert(
  (public.save_roadmap_progress(jsonb_build_array(
     jsonb_build_object('id', (SELECT v FROM ids WHERE k = 'm_a'), 'done', true, 'note', 'Xong tốt'),
     jsonb_build_object('id', (SELECT v FROM ids WHERE k = 'm_b'), 'done', true)))->>'updated')::int = 2,
  'lưu tiến độ nhiều hoạt động');
SELECT public.t_assert((SELECT note = 'Xong tốt' AND done_at IS NOT NULL FROM roadmap_milestones WHERE id = (SELECT v FROM ids WHERE k = 'm_a')), 'ghi chú và thời điểm xong');
-- trung bình 3 trụ: knowledge 100, experience 100, exploration 0 → 66.7
SELECT public.t_assert((public.roadmap_status((SELECT v FROM ids WHERE k = 'r1'))->>'actual_percent')::numeric = 66.7, 'tiến độ tổng thể là trung bình ba trụ cột');
SELECT public.t_assert(NOT (public.roadmap_status((SELECT v FROM ids WHERE k = 'r1'))->>'off_track')::boolean, 'không còn chệch hướng sau khi cập nhật');

-- Sửa hạn: cột mốc nằm giữa hạn cũ và hạn mới bị liệt kê, p_apply = false không ghi
INSERT INTO ids SELECT 'm_c', id FROM roadmap_milestones WHERE title = 'Gặp C';
SELECT public.add_roadmap_milestone((SELECT v FROM ids WHERE k = 'r1'), 'knowledge', 'Mốc riêng', current_date + 90, 1, true, 'Đạt chứng chỉ');
SELECT public.t_assert(
  jsonb_array_length(public.update_roadmap_milestone_due((SELECT v FROM ids WHERE k = 'm_c'), current_date + 120, false)->'conflicts') = 1,
  'FR07.01.11: sửa hạn báo cột mốc bị ảnh hưởng');
SELECT public.t_assert((SELECT due_date = current_date + 60 FROM roadmap_milestones WHERE id = (SELECT v FROM ids WHERE k = 'm_c')), 'xem trước không đổi hạn');
SELECT public.update_roadmap_milestone_due((SELECT v FROM ids WHERE k = 'm_c'), current_date + 120, true);
SELECT public.t_assert((SELECT due_date = current_date + 120 FROM roadmap_milestones WHERE id = (SELECT v FROM ids WHERE k = 'm_c')), 'giữ thay đổi thì đổi hạn');
SELECT public.t_assert((SELECT source = 'user' AND pass_criteria = 'Đạt chứng chỉ' FROM roadmap_milestones WHERE title = 'Mốc riêng'), 'cột mốc riêng nguồn Của bạn');

-- Người khác không động được vào lộ trình
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000c2');
SELECT public.t_expect_error(format('SELECT public.save_roadmap_progress(%L::jsonb)',
  jsonb_build_array(jsonb_build_object('id', (SELECT v FROM ids WHERE k = 'm_a'), 'done', false))::text), 'forbidden', 'chỉ chủ lộ trình lưu tiến độ');
SELECT public.t_assert(jsonb_array_length(public.list_my_roadmaps()) = 0, 'chỉ thấy lộ trình của mình');

-- Kỹ năng mềm: D1.1 lệch 30, D3.1 điểm 40% -----------------------------------------------------------------
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000c1');
SELECT public.t_assert(jsonb_array_length(public.get_roadmap_soft_skills()) = 2, 'BR-026: kỹ năng mềm thấp hoặc lệch');
SELECT public.t_assert((public.get_roadmap_soft_skills()->0->>'name') = 'Thuyết trình', 'BR-026: điểm thấp nhất lên đầu');

-- Tạo lại: bản cũ vào lịch sử, chỉ một lộ trình kích hoạt (BR-028) -----------------------------------------------
INSERT INTO ids SELECT 'r2', public.create_roadmap((SELECT id FROM careers WHERE career_code = 'R-03'), 'Lộ trình 2', current_date + 300, 6, 'career_changed');
SELECT public.t_assert((SELECT count(*) FROM roadmaps WHERE is_active) = 1, 'BR-028: một lộ trình kích hoạt');
SELECT public.t_assert((SELECT previous_roadmap_id = (SELECT v FROM ids WHERE k = 'r1') AND regenerate_reason = 'career_changed' FROM roadmaps WHERE id = (SELECT v FROM ids WHERE k = 'r2')), 'ghi lộ trình trước và lý do tạo lại');
SELECT public.t_expect_error(format('SELECT public.create_roadmap(NULL, %L, NULL, NULL, %L)', 'x', 'bậy'), 'invalid_reason', 'lý do tạo lại hợp lệ');
RESET ROLE; SELECT public.t_act_as(NULL);

-- Trình giám sát: cảnh báo, 1 thông báo mỗi mốc nhắc, tự xóa khi hồi phục ------------------------------------------
INSERT INTO roadmap_milestones (roadmap_id, pillar, title, due_date, weight, is_checkpoint)
SELECT v, 'knowledge', 'Trễ hạn', current_date - 2, 1, true FROM ids WHERE k = 'r2';
SELECT public.t_assert(public.scan_roadmap_alerts() = 1, 'quét tạo cảnh báo và một thông báo');
SELECT public.t_assert(public.scan_roadmap_alerts() = 0, 'cùng mốc nhắc không gửi lặp');
SELECT public.t_assert((SELECT count(*) FROM roadmap_alerts WHERE cleared_at IS NULL) = 1 AND (SELECT count(*) FROM notifications WHERE notification_type = 'roadmap_off_track') = 1, 'một cảnh báo mở, một thông báo');
UPDATE roadmap_milestones SET done = true WHERE title = 'Trễ hạn';
SELECT public.scan_roadmap_alerts();
SELECT public.t_assert((SELECT count(*) FROM roadmap_alerts WHERE cleared_at IS NULL) = 0, 'hồi phục thì cảnh báo tự xóa');

\echo Hoàn tất kiểm thử lộ trình
