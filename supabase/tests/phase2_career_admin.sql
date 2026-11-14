-- Kiểm thử quản trị nghề: quyền, kiểm tra dữ liệu, chuẩn hóa CW, phiên bản ma trận, giữ dòng sửa tay.
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

INSERT INTO criteria_groups (group_code, name, sort_order) VALUES ('G1', 'Năng lực', 1), ('G2', 'Giao tiếp', 2), ('G6', 'Sở thích', 6), ('G7', 'Động lực', 7);
INSERT INTO criteria (group_id, dimension_code, name, sort_order)
SELECT g.id, x.d, x.n, x.s FROM (VALUES
  ('G1', 'D1.1', 'Tư duy logic', 1), ('G1', 'D1.2', 'Giao tiếp', 2), ('G2', 'D2.1', 'Hợp tác', 3), ('G6', 'D6.1', 'Thực tế', 4), ('G7', 'D7.1', 'Thành tựu', 5)) x(g, d, n, s)
JOIN criteria_groups g ON g.group_code = x.g;
INSERT INTO holland_codes (holland_code, name) SELECT v, v FROM unnest(ARRAY['R','I','A','S','E','C']) v ON CONFLICT DO NOTHING;
INSERT INTO career_fields (field_code, field_name) VALUES ('LV8', 'Thử nghiệm');

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'admin@test', '{"role":"student"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'a1@test', '{"role":"student"}');
UPDATE user_profiles SET role = 'system_admin' WHERE id = '00000000-0000-0000-0000-0000000000d1';

SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000a1');
SELECT t_expect_error($$SELECT admin_save_career(NULL, '{"career_name":"Nghề thử"}'::jsonb)$$, 'forbidden', 'Người dùng thường không tạo nghề');
SELECT t_expect_error($$SELECT admin_save_career_requirements(gen_random_uuid(), '[]'::jsonb)$$, 'forbidden', 'Người dùng thường không sửa mức yêu cầu');
SELECT t_expect_error($$SELECT admin_save_career_holland(gen_random_uuid(), '{}'::jsonb)$$, 'forbidden', 'Người dùng thường không sửa Holland');

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000d1');
CREATE TEMP TABLE ids AS SELECT admin_save_career(NULL, jsonb_build_object('career_name', 'Nghề Quản Trị', 'career_field_id', (SELECT id FROM career_fields WHERE field_code = 'LV8'))) AS id;
GRANT SELECT ON ids TO authenticated;
SELECT t_assert((SELECT status = 'draft' AND career_code LIKE 'QT-%' AND NOT is_standard_complete FROM careers WHERE id = (SELECT id FROM ids)), 'Nghề mới ở Nháp, chưa đủ chuẩn');
SELECT t_expect_error($$SELECT admin_save_career(NULL, '{"career_name":"ab"}'::jsonb)$$, 'invalid_career', 'Tên quá ngắn hoặc thiếu lĩnh vực bị từ chối');
SELECT admin_save_career((SELECT id FROM ids), '{"career_description":"Mô tả","data_checked_at":"2026-10-01","data_checked_kind":"checked"}'::jsonb);
SELECT t_assert((SELECT career_description = 'Mô tả' AND data_checked_at = '2026-10-01' AND data_checked_kind = 'checked' AND career_name = 'Nghề Quản Trị' FROM careers WHERE id = (SELECT id FROM ids)),
  'Sửa thông tin giữ các trường không gửi');
SELECT t_expect_error($$SELECT admin_save_career((SELECT id FROM ids), '{"data_checked_at":"2999-01-01"}'::jsonb)$$, 'invalid_checked_date', 'Ngày kiểm tra trong tương lai bị từ chối');

SELECT t_expect_error($$SELECT admin_save_career_requirements((SELECT id FROM ids), '[{"dimension_code":"D6.1","required_score":3,"career_weight":1}]'::jsonb)$$, 'dimension_not_allowed', 'G6 không nhập như mức yêu cầu');
SELECT t_expect_error($$SELECT admin_save_career_requirements((SELECT id FROM ids), '[{"dimension_code":"D1.1","required_score":6,"career_weight":1}]'::jsonb)$$, 'invalid_required_score', 'Req ngoài 1–5 bị từ chối');
SELECT t_expect_error($$SELECT admin_save_career_requirements((SELECT id FROM ids), '[{"dimension_code":"D1.1","required_score":3,"career_weight":0}]'::jsonb)$$, 'invalid_career_weight', 'CW bằng 0 bị từ chối');
SELECT t_expect_error($$SELECT admin_save_career_requirements((SELECT id FROM ids), '[{"dimension_code":"D9.9","required_score":3,"career_weight":1}]'::jsonb)$$, 'unknown_dimension', 'Tiêu chí không có bị từ chối');

CREATE TEMP TABLE ver AS SELECT version_code FROM career_matrix_versions WHERE is_current;
GRANT SELECT ON ver TO authenticated;
SELECT admin_save_career_requirements((SELECT id FROM ids), '[
  {"dimension_code":"D1.1","required_score":4,"career_weight":3},
  {"dimension_code":"D1.2","required_score":3,"career_weight":1},
  {"dimension_code":"D2.1","required_score":2,"career_weight":4},
  {"dimension_code":"D7.1","required_score":5,"career_weight":9}]'::jsonb);
SELECT t_assert((SELECT abs(sum(r.career_weight) - 1) < 0.0001 FROM career_requirements r JOIN criteria c ON c.id = r.criteria_id JOIN criteria_groups g ON g.id = c.group_id
                  JOIN career_matrix_versions v ON v.id = r.matrix_version_id AND v.is_current
                 WHERE r.career_id = (SELECT id FROM ids) AND g.group_code <> 'G7'), 'CW G1–G5 được chuẩn hóa về tổng 1');
SELECT t_assert((SELECT r.career_weight = 1 FROM career_requirements r JOIN criteria c ON c.id = r.criteria_id
                  JOIN career_matrix_versions v ON v.id = r.matrix_version_id AND v.is_current
                 WHERE r.career_id = (SELECT id FROM ids) AND c.dimension_code = 'D7.1'), 'CW G7 chuẩn hóa riêng về 1');
SELECT t_assert((SELECT version_code FROM career_matrix_versions WHERE is_current) <> (SELECT version_code FROM ver), 'Lưu mức yêu cầu tạo phiên bản ma trận mới');
SELECT t_assert((SELECT count(*) FROM career_matrix_versions WHERE is_current) = 1, 'Chỉ một phiên bản hiện hành');
SELECT t_assert((SELECT bool_and(verification_level = 'expert_reviewed') FROM career_requirements r JOIN career_matrix_versions v ON v.id = r.matrix_version_id AND v.is_current
                  WHERE r.career_id = (SELECT id FROM ids)), 'Dòng sửa tay ở mức Chuyên gia duyệt');
SELECT t_assert(NOT (SELECT is_standard_complete FROM careers WHERE id = (SELECT id FROM ids)), 'Chưa có Holland thì chưa đủ chuẩn');

SELECT t_expect_error($$SELECT admin_save_career_holland((SELECT id FROM ids), '{"R":1.5}'::jsonb)$$, 'invalid_holland_strength', 'Cường độ Holland ngoài 0–1 bị từ chối');
SELECT admin_save_career_holland((SELECT id FROM ids), '{"R":0.2,"I":0.9,"A":0.5,"S":0.1}'::jsonb);
SELECT t_assert((SELECT holland_top3 = 'IAR' AND is_standard_complete FROM careers WHERE id = (SELECT id FROM ids)), 'Top 3 tự tính theo cường độ và nghề đủ chuẩn');

-- Phiên bản cũ vẫn đủ dòng (bản chụp đã chốt tính lại được)
RESET ROLE;
SELECT t_assert((SELECT count(*) FROM career_requirements r JOIN career_matrix_versions v ON v.id = r.matrix_version_id WHERE v.version_code = (SELECT version_code FROM ver) AND r.career_id = (SELECT id FROM ids)) = 0,
  'Phiên bản cũ không có dòng của nghề mới tạo');
SELECT t_assert((SELECT count(*) FROM career_matrix_versions) >= 2, 'Phiên bản cũ được giữ lại');

DROP FUNCTION public.t_expect_error(text, text, text);
DROP FUNCTION public.t_assert(boolean, text);
DROP FUNCTION public.t_act_as(uuid);
\echo 'Hoàn tất kiểm thử quản trị nghề'
