-- Kiểm thử khung JD theo cấp: quyền, kiểm tra dữ liệu, công bố, phần học sinh và khách đọc được, sao chép.
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

INSERT INTO career_fields (field_code, field_name) VALUES ('LV8', 'Thử nghiệm');
INSERT INTO careers (career_code, career_field_id, career_name, source_group_id, status)
SELECT x.code, f.id, x.name, 'T', x.status FROM career_fields f,
  (VALUES ('T-BA', 'Phân tích nghiệp vụ', 'published'), ('T-PO', 'Chủ sở hữu sản phẩm', 'published'), ('T-NHAP', 'Nghề nháp', 'draft')) x(code, name, status)
 WHERE f.field_code = 'LV8';
CREATE TABLE t_ids AS SELECT career_code, id FROM careers WHERE career_code LIKE 'T-%';
CREATE TABLE t_fw (k text PRIMARY KEY, id uuid);
GRANT SELECT ON t_ids TO authenticated, anon;
GRANT SELECT, INSERT ON t_fw TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.t_career(p_code text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM t_ids WHERE career_code = p_code $$;
CREATE OR REPLACE FUNCTION public.t_framework(p_key text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM t_fw WHERE k = p_key $$;
GRANT EXECUTE ON FUNCTION public.t_career(text), public.t_framework(text) TO authenticated, anon;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'admin@test', '{"role":"student"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'a1@test', '{"role":"student"}');
UPDATE user_profiles SET role = 'system_admin' WHERE id = '00000000-0000-0000-0000-0000000000d1';

SET ROLE authenticated;

-- Quyền ------------------------------------------------------------------------
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000a1');
SELECT t_expect_error($$SELECT admin_save_level_framework(NULL, t_career('T-BA'), '{"career_level":0,"level_name":"Thực tập sinh"}'::jsonb)$$,
  'forbidden', 'Người dùng thường không tạo khung');
SELECT t_expect_error($$SELECT replace_level_framework_items(gen_random_uuid(), '[]'::jsonb)$$, 'permission denied', 'Không gọi thẳng hàm thay dòng nội dung');

-- Kiểm tra dữ liệu ---------------------------------------------------------------
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000d1');
SELECT t_expect_error($$SELECT admin_save_level_framework(NULL, gen_random_uuid(), '{"career_level":0,"level_name":"X"}'::jsonb)$$, 'career_not_found', 'Nghề không có bị từ chối');
SELECT t_expect_error($$SELECT admin_save_level_framework(NULL, t_career('T-BA'), '{"career_level":8,"level_name":"X"}'::jsonb)$$, 'invalid_level', 'Bậc ngoài L0–L7 bị từ chối');
SELECT t_expect_error($$SELECT admin_save_level_framework(NULL, t_career('T-BA'), '{"career_level":0}'::jsonb)$$, 'invalid_framework', 'Thiếu tên bậc bị từ chối');
SELECT t_expect_error($$SELECT admin_save_level_framework(NULL, t_career('T-BA'), '{"career_level":"abc","level_name":"X"}'::jsonb)$$, 'invalid_framework', 'Bậc không phải số bị từ chối');
SELECT t_expect_error($$SELECT admin_save_level_framework(NULL, t_career('T-BA'), '{"career_level":1,"level_name":"X","required_level":6}'::jsonb)$$, 'invalid_required_level', 'Required Level ngoài 1–5 bị từ chối');
SELECT t_expect_error($$SELECT admin_save_level_framework(NULL, t_career('T-BA'), '{"career_level":1,"level_name":"X","items":[{"section":"abc","content":"x"}]}'::jsonb)$$, 'invalid_item', 'Mục không có bị từ chối');
SELECT t_expect_error($$SELECT admin_save_level_framework(NULL, t_career('T-BA'), '{"career_level":1,"level_name":"X","items":[{"section":"tool","content":"  "}]}'::jsonb)$$, 'invalid_item', 'Nội dung trống bị từ chối');
SELECT t_expect_error($$SELECT admin_save_level_framework(NULL, t_career('T-BA'), '{"career_level":1,"level_name":"X","items":[{"section":"salary","content":"x","salary_min":10,"salary_max":5}]}'::jsonb)$$, 'invalid_item', 'Lương từ lớn hơn lương đến bị từ chối');
SELECT t_expect_error($$SELECT admin_save_level_framework(NULL, t_career('T-BA'), '{"career_level":1,"level_name":"X","items":[{"section":"career_move","content":"x","target_career_id":"00000000-0000-0000-0000-000000000999"}]}'::jsonb)$$, 'target_career_not_found', 'Nghề đích không có bị từ chối');
SELECT t_assert((SELECT count(*) = 0 FROM career_level_frameworks WHERE career_level = 1), 'Lưu lỗi không để lại khung dở');

-- Tạo khung ------------------------------------------------------------------------
INSERT INTO t_fw SELECT 'intern', admin_save_level_framework(NULL, t_career('T-BA'), jsonb_build_object(
  'career_level', 0, 'level_name', 'Thực tập sinh', 'experience_text', '0–6 tháng', 'jd_count', 29,
  'items', jsonb_build_array(
    jsonb_build_object('section', 'output', 'content', 'Biên bản họp'),
    jsonb_build_object('section', 'tool', 'tier', 'required', 'content', 'Excel', 'jd_hits', 20, 'jd_total', 29),
    jsonb_build_object('section', 'salary', 'group_label', 'SMEs', 'content', 'Hỗ trợ ăn trưa', 'salary_min', 0, 'salary_max', 3),
    jsonb_build_object('section', 'interview_question', 'content', 'Kể về một đồ án'),
    jsonb_build_object('section', 'pass_threshold', 'content', 'Thái độ học hỏi'),
    jsonb_build_object('section', 'career_move', 'content', 'Chủ sở hữu sản phẩm', 'target_career_id', t_career('T-PO'), 'target_level', 4))));
SELECT t_assert((SELECT status = 'draft' AND jd_count = 29 AND experience_text = '0–6 tháng' FROM career_level_frameworks WHERE id = t_framework('intern')),
  'Khung mới ở Nháp, lưu thông tin chung');
SELECT t_assert((SELECT count(*) = 6 AND min(sort_order) = 0 AND max(sort_order) = 5 FROM career_level_framework_items WHERE framework_id = t_framework('intern')),
  'Lưu đủ dòng nội dung theo thứ tự gửi');
SELECT t_expect_error($$SELECT admin_save_level_framework(NULL, t_career('T-BA'), '{"career_level":0,"level_name":"Trùng"}'::jsonb)$$, 'level_exists', 'Mỗi nghề một khung cho mỗi bậc');

INSERT INTO t_fw SELECT 'junior', admin_save_level_framework(NULL, t_career('T-BA'), '{"career_level":2,"level_name":"Junior"}'::jsonb);
SELECT t_expect_error($$SELECT admin_save_level_framework(t_framework('junior'), NULL, '{"career_level":0}'::jsonb)$$, 'level_exists', 'Đổi sang bậc đã có khung bị từ chối');

-- Sửa: không gửi items thì giữ nguyên, gửi items thì thay toàn bộ
SELECT admin_save_level_framework(t_framework('intern'), NULL, '{"required_level":1.5,"reports_to":"Senior BA"}'::jsonb);
SELECT t_assert((SELECT required_level = 1.5 AND reports_to = 'Senior BA' AND level_name = 'Thực tập sinh' FROM career_level_frameworks WHERE id = t_framework('intern')),
  'Sửa thông tin giữ các trường không gửi');
SELECT t_assert((SELECT count(*) = 6 FROM career_level_framework_items WHERE framework_id = t_framework('intern')), 'Không gửi dòng nội dung thì giữ nguyên');
SELECT admin_save_level_framework(t_framework('intern'), NULL, '{"required_level":null}'::jsonb);
SELECT t_assert((SELECT required_level IS NULL FROM career_level_frameworks WHERE id = t_framework('intern')), 'Required Level để trống được');
SELECT t_assert((SELECT count(*) = 1 FROM audit_logs WHERE action = 'create_level_framework' AND target_id = t_framework('intern')), 'Ghi nhật ký khi tạo khung');

-- Công bố ------------------------------------------------------------------------
SELECT t_expect_error($$SELECT admin_set_level_framework_status(t_framework('intern'), 'published')$$, 'framework_incomplete', 'Chưa có nhiệm vụ thì không công bố');
SELECT t_expect_error($$SELECT admin_set_level_framework_status(t_framework('intern'), 'hidden')$$, 'invalid_status', 'Trạng thái lạ bị từ chối');
SELECT admin_save_level_framework(t_framework('intern'), NULL, jsonb_build_object('items', (
  SELECT jsonb_agg(to_jsonb(i) - 'id' - 'framework_id' - 'created_at' - 'updated_at' ORDER BY sort_order)
    FROM career_level_framework_items i WHERE framework_id = t_framework('intern'))
  || jsonb_build_array(jsonb_build_object('section', 'task', 'tier', 'required', 'group_label', 'Thu thập yêu cầu', 'content', 'Ghi biên bản', 'detail', 'Tham gia họp'))));
SELECT t_assert((SELECT count(*) = 7 FROM career_level_framework_items WHERE framework_id = t_framework('intern')), 'Gửi dòng nội dung thì thay toàn bộ');
SELECT admin_set_level_framework_status(t_framework('intern'), 'published');
SELECT t_assert((SELECT status = 'published' AND published_at IS NOT NULL FROM career_level_frameworks WHERE id = t_framework('intern')), 'Công bố khung');

-- Học sinh và khách ----------------------------------------------------------------
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000a1');
SELECT t_assert((SELECT count(*) = 1 FROM career_level_frameworks), 'Học sinh chỉ thấy khung đã công bố');
SELECT t_assert((SELECT count(*) = 5 FROM career_level_framework_items), 'Học sinh không thấy câu hỏi phỏng vấn và ngưỡng đạt');
SELECT t_assert((SELECT count(*) = 0 FROM career_level_framework_items WHERE section IN ('interview_question', 'pass_threshold')), 'Phần chỉ quản trị bị ẩn');
UPDATE career_level_frameworks SET level_name = 'Sửa lén' WHERE id = t_framework('intern');
SELECT t_assert((SELECT level_name = 'Thực tập sinh' FROM career_level_frameworks WHERE id = t_framework('intern')), 'Khung không bị học sinh sửa');

RESET ROLE;
SET ROLE anon;
SELECT t_assert((SELECT count(*) = 1 FROM career_level_frameworks), 'Khách đọc được khung đã công bố');
SELECT t_assert((SELECT count(*) = 5 FROM career_level_framework_items), 'Khách không thấy phần chỉ quản trị');
RESET ROLE;

-- Nghề về Nháp thì khung cũng ẩn
UPDATE careers SET status = 'draft' WHERE id = (SELECT id FROM t_ids WHERE career_code = 'T-BA');
SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000a1');
SELECT t_assert((SELECT count(*) = 0 FROM career_level_frameworks), 'Nghề chưa công bố thì khung bị ẩn');
RESET ROLE;
UPDATE careers SET status = 'published' WHERE id = (SELECT id FROM t_ids WHERE career_code = 'T-BA');

-- Sao chép, xóa ---------------------------------------------------------------------
SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000d1');
SELECT t_expect_error($$SELECT admin_copy_level_framework(t_framework('intern'), t_career('T-BA'), 0::smallint)$$, 'level_exists', 'Không sao chép đè bậc đã có');
INSERT INTO t_fw SELECT 'copy', admin_copy_level_framework(t_framework('intern'), t_career('T-PO'), 1::smallint, 'Mới vào nghề');
SELECT t_assert((SELECT status = 'draft' AND level_name = 'Mới vào nghề' AND jd_count = 0 AND source_note LIKE 'Sao chép từ Phân tích nghiệp vụ%'
                   FROM career_level_frameworks WHERE id = t_framework('copy')), 'Bản sao là khung Nháp, ghi nguồn sao chép');
SELECT t_assert((SELECT count(*) = 7 AND bool_and(jd_hits IS NULL) AND count(*) FILTER (WHERE tier = 'required') = 2
                   FROM career_level_framework_items WHERE framework_id = t_framework('copy')), 'Bản sao giữ mức, bỏ số tin căn cứ');

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000a1');
SELECT t_expect_error($$SELECT admin_delete_level_framework(t_framework('copy'))$$, 'forbidden', 'Người dùng thường không xóa khung');
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000d1');
SELECT admin_delete_level_framework(t_framework('copy'));
SELECT t_assert((SELECT count(*) = 0 FROM career_level_framework_items WHERE framework_id = t_framework('copy')), 'Xóa khung xóa luôn dòng nội dung');
SELECT t_expect_error($$SELECT admin_delete_level_framework(t_framework('copy'))$$, 'framework_not_found', 'Xóa khung không còn báo lỗi');

-- Xóa nghề đích thì dòng chuyển nghề giữ tên, bỏ liên kết
RESET ROLE;
DELETE FROM careers WHERE id = (SELECT id FROM t_ids WHERE career_code = 'T-PO');
SELECT t_assert((SELECT target_career_id IS NULL AND content = 'Chủ sở hữu sản phẩm' FROM career_level_framework_items
                  WHERE framework_id = t_framework('intern') AND section = 'career_move'), 'Xóa nghề đích giữ dòng chuyển nghề');

SELECT 'Hoàn tất kiểm thử khung JD theo cấp' AS result;
