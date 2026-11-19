-- Kiểm thử lộ trình mẫu theo band trên database tạm: thư viện mẫu, hoạt động gắn nhóm tiêu chí, tiến độ theo nhóm.
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
SELECT public.t_assert((SELECT count(*) FROM roadmap_templates) = 5, 'có 5 lộ trình mẫu');
SELECT public.t_assert((SELECT count(*) FROM roadmap_group_bands) = 28, '7 nhóm × 4 band');
SELECT public.t_assert(
  (SELECT min_percent = 25 AND max_percent = 50 FROM roadmap_group_bands WHERE group_code = 'G2' AND band_code = 'B2'),
  'ranh giới band B2 là 25–50');

INSERT INTO roadmap_template_items (item_code, template_code, group_code, band_code, stage_name, title, duration_weeks, pass_criteria, how_to)
VALUES
  ('RM1-TD-B1-01', 'RM1', 'G2', 'B1', 'Khởi động', 'Tóm tắt ý chính', 3, 'Đủ 15 mục', 'Bước 1. Ghi chép'),
  ('RM1-GT-B1-01', 'RM1', 'G3', 'B1', 'Khởi động', 'Luyện nói ngắn', 2, NULL, NULL),
  ('RM1-TD-B2-01', 'RM1', 'G2', 'B2', 'Xây nền', 'Viết lập luận', 4, NULL, NULL);
UPDATE roadmap_template_items SET is_active = false WHERE item_code = 'RM1-TD-B2-01';

INSERT INTO career_fields (field_code, field_name) VALUES ('LV9', 'Thử nghiệm');
INSERT INTO careers (career_code, career_field_id, career_name, source_group_id, holland_top3, status, is_standard_complete)
SELECT 'R-01', f.id, 'Nghề A', 'T', 'R', 'published', true FROM career_fields f WHERE f.field_code = 'LV9';

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'd1@test', '{"role":"student"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'd2@test', '{"role":"student"}');
UPDATE user_profiles SET date_of_birth = '2008-01-01' WHERE id IN ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2');

CREATE TEMP TABLE ids (k text PRIMARY KEY, v uuid);
GRANT SELECT, INSERT, UPDATE ON ids TO authenticated;

-- Đọc thư viện mẫu ---------------------------------------------------------------------------------------
SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000d1');
SELECT public.t_assert((SELECT count(*) FROM roadmap_template_items) = 2, 'người dùng chỉ đọc mục đang dùng');
SELECT public.t_expect_error($q$INSERT INTO roadmap_template_items (item_code, template_code, group_code, band_code, stage_name, title, duration_weeks)
  VALUES ('X', 'RM1', 'G1', 'B1', 'Khởi động', 'X', 1)$q$, 'row-level security', 'người dùng không sửa được thư viện mẫu');

-- Gắn mẫu và ảnh chụp nhóm ---------------------------------------------------------------------------------
INSERT INTO ids SELECT 'r1', public.create_roadmap((SELECT id FROM careers WHERE career_code = 'R-01'), 'Lộ trình mẫu', current_date + 200, 4, NULL);
SELECT public.set_roadmap_template((SELECT v FROM ids WHERE k = 'r1'), 'RM1',
  '[{"group_code":"G2","percent":10,"band_code":"B1","weight":14.29,"gap":12.86}]'::jsonb);
SELECT public.t_assert((SELECT template_code = 'RM1' FROM roadmaps WHERE id = (SELECT v FROM ids WHERE k = 'r1')), 'gắn lộ trình mẫu');
SELECT public.t_expect_error(format('SELECT public.set_roadmap_template(%L, %L)', (SELECT v FROM ids WHERE k = 'r1'), 'RM9'), 'template_not_found', 'mẫu không tồn tại');

-- Hoạt động theo nhóm tiêu chí ------------------------------------------------------------------------------
SELECT public.add_roadmap_milestones_bulk((SELECT v FROM ids WHERE k = 'r1'), jsonb_build_array(
  jsonb_build_object('criteria_group', 'G2', 'template_item_id', (SELECT id FROM roadmap_template_items WHERE item_code = 'RM1-TD-B1-01'),
                     'title', 'Tóm tắt ý chính', 'start_date', current_date, 'due_date', current_date + 20, 'weight', 0.75, 'is_checkpoint', true,
                     'pass_criteria', 'Đủ 15 mục'),
  jsonb_build_object('criteria_group', 'G3', 'template_item_id', (SELECT id FROM roadmap_template_items WHERE item_code = 'RM1-GT-B1-01'),
                     'title', 'Luyện nói ngắn', 'start_date', current_date, 'due_date', current_date + 13, 'weight', 0.5, 'item_level', 2)));
SELECT public.t_assert(
  (SELECT count(*) FROM roadmap_milestones WHERE pillar IS NULL AND criteria_group IS NOT NULL AND template_item_id IS NOT NULL) = 2,
  'hoạt động mẫu gắn nhóm và mục mẫu, không cần trụ cột');
SELECT public.t_expect_error(format('SELECT public.add_roadmap_milestones_bulk(%L, %L)', (SELECT v FROM ids WHERE k = 'r1'),
  '[{"title":"Không nhóm"}]'), 'invalid_pillar', 'hoạt động phải có nhóm hoặc trụ cột');
SELECT public.t_expect_error(format('SELECT public.add_roadmap_milestone(%L, NULL, %L, NULL, 1, false, NULL, %L)', (SELECT v FROM ids WHERE k = 'r1'), 'X', 'G9'),
  'invalid_group', 'nhóm tiêu chí sai mã');
INSERT INTO ids SELECT 'own', public.add_roadmap_milestone((SELECT v FROM ids WHERE k = 'r1'), NULL, 'Tự thêm', NULL, 1, false, NULL, 'G3');
SELECT public.t_assert((SELECT criteria_group = 'G3' AND source = 'user' FROM roadmap_milestones WHERE id = (SELECT v FROM ids WHERE k = 'own')), 'tự thêm hoạt động theo nhóm');

-- Tiến độ: mỗi nhóm nặng như nhau. G2: 1 mục xong → 100; G3: 0/0.5 và 0/1 → 0. Trung bình = 50
SELECT public.save_roadmap_progress(jsonb_build_array(jsonb_build_object('id', (SELECT id FROM roadmap_milestones WHERE title = 'Tóm tắt ý chính'), 'done', true)));
SELECT public.t_assert((public.get_my_roadmap_status()->>'actual_percent')::numeric = 50, 'tiến độ tổng thể là trung bình các nhóm tiêu chí');

-- Danh sách lộ trình có tên mẫu, ảnh chụp và chi tiết mục mẫu
SELECT public.t_assert((public.list_my_roadmaps()->0->>'template_name') = 'Học sinh thi đại học trong nước', 'danh sách có tên hướng đi');
SELECT public.t_assert((public.list_my_roadmaps()->0->'group_snapshot'->0->>'band_code') = 'B1', 'danh sách có ảnh chụp band');
SELECT public.t_assert(
  (SELECT x->'detail'->>'how_to' FROM jsonb_array_elements(public.list_my_roadmaps()->0->'milestones') x WHERE x->>'title' = 'Tóm tắt ý chính') = 'Bước 1. Ghi chép',
  'hoạt động mẫu có cách làm');
SELECT public.t_assert(
  (SELECT x->>'item_level' FROM jsonb_array_elements(public.list_my_roadmaps()->0->'milestones') x WHERE x->>'title' = 'Luyện nói ngắn') = '2',
  'hoạt động có cấp đã chọn');

-- Người khác không gắn mẫu vào lộ trình của mình được
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000d2');
SELECT public.t_expect_error(format('SELECT public.set_roadmap_template(%L, %L)', (SELECT v FROM ids WHERE k = 'r1'), 'RM2'), 'forbidden', 'chỉ chủ lộ trình gắn mẫu');
RESET ROLE;

-- Nhóm Lãnh đạo: đổi cấp, kế hoạch mẫu, kiểm tra nhanh ------------------------------------------------------------
INSERT INTO roadmap_template_items (item_code, template_code, group_code, band_code, stage_name, title, duration_weeks, level_duration_weeks, prior_knowledge)
VALUES ('RM1-LD-B2-02', 'RM1', 'G5', 'B2', 'Xây nền', 'Ra quyết định có tiêu chí', 2, '{"1":1,"2":2,"3":3}', 'Tiêu chí = điều dùng để so sánh');
INSERT INTO roadmap_sample_plans (plan_code, item_code, title, schedule_level_1, schedule_level_2, schedule_level_3, sort_order)
VALUES ('RM1-KH-B2-02-A', 'RM1-LD-B2-02', 'Chọn nơi học nhóm', '1 tuần', '2 tuần', '3 tuần', 1),
       ('RM1-KH-B2-02-B', 'RM1-LD-B2-02', 'Kế hoạch đã ẩn', NULL, NULL, NULL, 2);
UPDATE roadmap_sample_plans SET is_active = false WHERE plan_code = 'RM1-KH-B2-02-B';
INSERT INTO roadmap_quiz_questions (item_suffix, question_no, question_text, option_a, option_b, option_c, correct_option)
SELECT 'LD-B2-02', n, 'Câu ' || n, 'A' || n, 'B' || n, 'C' || n, CASE WHEN n % 2 = 0 THEN 'B' ELSE 'A' END FROM generate_series(1, 5) n;
SELECT public.t_assert((SELECT updated_by IS NULL FROM roadmap_template_items WHERE item_code = 'RM1-LD-B2-02'), 'nạp bằng khóa dịch vụ không ghi người sửa');

SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000d1');
SELECT public.add_roadmap_milestones_bulk((SELECT v FROM ids WHERE k = 'r1'), jsonb_build_array(
  jsonb_build_object('criteria_group', 'G5', 'template_item_id', (SELECT id FROM roadmap_template_items WHERE item_code = 'RM1-LD-B2-02'),
                     'title', 'Ra quyết định có tiêu chí', 'start_date', '2027-01-01', 'due_date', '2027-01-14', 'item_level', 2)));
INSERT INTO ids SELECT 'ld', id FROM roadmap_milestones WHERE title = 'Ra quyết định có tiêu chí';
SELECT public.t_assert((SELECT count(*) FROM roadmap_quiz_questions) = 0, 'người học không đọc trực tiếp đáp án');
SELECT public.t_assert(jsonb_array_length(public.get_roadmap_quiz((SELECT v FROM ids WHERE k = 'ld'))) = 5, 'lấy 5 câu kiểm tra nhanh theo đuôi mã');
SELECT public.t_assert(NOT (public.get_roadmap_quiz((SELECT v FROM ids WHERE k = 'ld'))->0 ? 'correct_option'), 'câu hỏi không kèm đáp án');
SELECT public.t_assert(
  (public.submit_roadmap_quiz((SELECT v FROM ids WHERE k = 'ld'), '{"1":"A","2":"B","3":"A","4":"A","5":"C"}')->>'passed')::boolean = false,
  '3/5 câu là chưa đạt');
SELECT public.t_assert(
  (public.submit_roadmap_quiz((SELECT v FROM ids WHERE k = 'ld'), '{"1":"a","2":"B","3":"A","4":"B","5":"C"}')->>'correct')::int = 4,
  'chấm không phân biệt hoa thường');
SELECT public.t_assert((SELECT quiz_score = 4 AND quiz_total = 5 AND quiz_passed_at IS NOT NULL FROM roadmap_milestones WHERE id = (SELECT v FROM ids WHERE k = 'ld')),
  '4/5 câu là đạt, lưu điểm cao nhất');
SELECT public.t_expect_error(format('SELECT public.get_roadmap_quiz(%L)', (SELECT id FROM roadmap_milestones WHERE title = 'Tự thêm')), 'forbidden', 'hoạt động tự thêm không có kiểm tra nhanh');

SELECT public.t_assert((public.set_roadmap_milestone_level((SELECT v FROM ids WHERE k = 'ld'), 3)->>'due_date') = '2027-01-21', 'đổi lên cấp 3 thì hạn = bắt đầu + 3 tuần');
SELECT public.t_assert((SELECT item_level = 3 FROM roadmap_milestones WHERE id = (SELECT v FROM ids WHERE k = 'ld')), 'lưu cấp mới');
SELECT public.t_expect_error(format('SELECT public.set_roadmap_milestone_level(%L, 4)', (SELECT v FROM ids WHERE k = 'ld')), 'invalid_level', 'cấp chỉ từ 1 đến 3');
SELECT public.t_expect_error(format('SELECT public.set_roadmap_milestone_level(%L, 1)', (SELECT id FROM roadmap_milestones WHERE title = 'Luyện nói ngắn')), 'level_not_supported', 'mục không có cấp thì không đổi cấp');

SELECT public.t_assert(
  (SELECT jsonb_array_length(x->'detail'->'plans') = 1 AND (x->'detail'->>'has_quiz')::boolean AND x->'detail'->>'prior_knowledge' IS NOT NULL
     FROM jsonb_array_elements(public.list_my_roadmaps()->0->'milestones') x WHERE x->>'title' = 'Ra quyết định có tiêu chí'),
  'danh sách có kế hoạch mẫu đang dùng, cần biết trước và kiểm tra nhanh');

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000d2');
SELECT public.t_expect_error(format('SELECT public.submit_roadmap_quiz(%L, %L)', (SELECT v FROM ids WHERE k = 'ld'), '{}'), 'forbidden', 'không nộp bài hộ người khác');
RESET ROLE;

-- Quản trị sửa mục trong ứng dụng thì ghi người sửa (nạp lại từ Excel sẽ bỏ qua mục này)
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('00000000-0000-0000-0000-0000000000a9', 'a9@test', '{"role":"system_admin"}');
SELECT public.t_act_as(NULL);
UPDATE user_profiles SET role = 'system_admin' WHERE id = '00000000-0000-0000-0000-0000000000a9';
SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000a9');
UPDATE roadmap_template_items SET title = 'Ra quyết định có tiêu chí cho nhóm' WHERE item_code = 'RM1-LD-B2-02';
SELECT public.t_assert((SELECT updated_by = '00000000-0000-0000-0000-0000000000a9' FROM roadmap_template_items WHERE item_code = 'RM1-LD-B2-02'), 'quản trị sửa mục thì ghi người sửa');
RESET ROLE;

\echo Hoàn tất kiểm thử lộ trình mẫu
