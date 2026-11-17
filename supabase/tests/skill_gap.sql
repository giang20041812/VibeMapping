-- Kiểm thử phân tích khoảng cách so với khung JD: loại kỹ năng mới, gắn dòng yêu cầu, bản chụp phân tích, quyền, tham số.
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

INSERT INTO career_fields (field_code, field_name) VALUES ('LV9', 'Thử nghiệm');
INSERT INTO careers (career_code, career_field_id, career_name, source_group_id, status)
SELECT 'T-DA', f.id, 'Phân tích dữ liệu', 'T', 'published' FROM career_fields f WHERE f.field_code = 'LV9';
INSERT INTO career_level_frameworks (career_id, career_level, level_name, status, required_level, published_at)
SELECT id, 2, 'Junior', 'published', 3, now() FROM careers WHERE career_code = 'T-DA';
INSERT INTO career_level_framework_items (framework_id, section, tier, content)
SELECT f.id, x.section, x.tier, x.content FROM career_level_frameworks f,
  (VALUES ('tool', 'required', 'SQL'), ('professional_skill', 'common', 'Trực quan hóa dữ liệu'), ('language', 'advantage', 'Tiếng Anh')) x(section, tier, content);
CREATE TABLE t_ref AS
  SELECT (SELECT id FROM career_level_frameworks LIMIT 1) AS fw,
         (SELECT id FROM career_level_framework_items WHERE content = 'SQL') AS sql_item,
         (SELECT id FROM careers WHERE career_code = 'T-DA') AS career;
GRANT SELECT ON t_ref TO authenticated, anon;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'sv1@test', '{"role":"university_student"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'sv2@test', '{"role":"university_student"}'),
  ('00000000-0000-0000-0000-0000000000e3', 'hs@test', '{"role":"student"}');
UPDATE user_profiles SET role = 'university_student' WHERE id IN ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2');

-- Tham số -------------------------------------------------------------------------
SELECT t_assert((SELECT (param_value ->> 'required')::numeric = 3 FROM operation_parameters WHERE param_code = 'skill_gap_impact_weights' AND is_current),
  'Có trọng số mức ảnh hưởng');
SELECT t_assert((SELECT verification_level = 'pending_ba' FROM operation_parameters WHERE param_code = 'skill_gap_default_required_level' AND is_current),
  'Mức yêu cầu mặc định gắn chờ BA');

SET ROLE authenticated;

-- Hồ sơ năng lực ------------------------------------------------------------------
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000e1');
INSERT INTO skill_profile_items (owner_id, kind, title, self_level, framework_item_id)
SELECT '00000000-0000-0000-0000-0000000000e1', 'tool', 'SQL', 2, sql_item FROM t_ref;
INSERT INTO skill_profile_items (owner_id, kind, title, self_level) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'language', 'Tiếng Anh', 4),
  ('00000000-0000-0000-0000-0000000000e1', 'knowledge', 'Thống kê', 3);
SELECT t_assert((SELECT count(*) = 3 FROM skill_profile_items), 'Sinh viên thêm được Công cụ, Ngoại ngữ, Kiến thức');
SELECT t_assert((SELECT framework_item_id = (SELECT sql_item FROM t_ref) FROM skill_profile_items WHERE title = 'SQL'), 'Mục hồ sơ gắn dòng yêu cầu của khung');
SELECT t_expect_error($$INSERT INTO skill_profile_items (owner_id, kind, title, self_level) VALUES ('00000000-0000-0000-0000-0000000000e1', 'abc', 'X', 3)$$,
  'skill_profile_items_kind_check', 'Loại không có bị từ chối');

-- Bản chụp phân tích ------------------------------------------------------------------
INSERT INTO skill_gap_analyses (owner_id, framework_id, career_id, position_name, overall_percent, met_count, near_count, unmet_count, details)
SELECT '00000000-0000-0000-0000-0000000000e1', fw, career, 'Phân tích dữ liệu · Junior', 55.6, 1, 0, 2, '[]'::jsonb FROM t_ref;
SELECT t_assert((SELECT count(*) = 1 FROM skill_gap_analyses), 'Sinh viên lưu được bản chụp phân tích');
SELECT t_expect_error($$INSERT INTO skill_gap_analyses (owner_id, position_name, overall_percent) VALUES ('00000000-0000-0000-0000-0000000000e1', 'X', 120)$$,
  'check', 'Mức đạt ngoài 0–100 bị từ chối');
SELECT t_expect_error($$INSERT INTO skill_gap_analyses (owner_id, position_name, overall_percent) VALUES ('00000000-0000-0000-0000-0000000000e2', 'X', 10)$$,
  'row-level security', 'Không lưu bản chụp thay người khác');

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000e2');
SELECT t_assert((SELECT count(*) = 0 FROM skill_gap_analyses), 'Không đọc được bản chụp của người khác');
SELECT t_assert((SELECT count(*) = 0 FROM skill_profile_items), 'Không đọc được hồ sơ của người khác');

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000e3');
SELECT t_expect_error($$INSERT INTO skill_gap_analyses (owner_id, position_name, overall_percent) VALUES ('00000000-0000-0000-0000-0000000000e3', 'X', 10)$$,
  'row-level security', 'Học sinh phổ thông không lưu bản chụp');

-- Khung và gợi ý: sinh viên đọc được khung công bố, đọc gợi ý có từ khóa kỹ năng ---------------
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000e1');
SELECT t_assert((SELECT count(*) = 3 FROM career_level_framework_items WHERE framework_id = (SELECT fw FROM t_ref)), 'Sinh viên đọc được kỹ năng của khung công bố');
RESET ROLE;
INSERT INTO course_project_suggestions (kind, title, skill_keywords) VALUES ('course', 'SQL cơ bản', ARRAY['SQL']);
SET ROLE authenticated;
SELECT t_assert((SELECT skill_keywords = ARRAY['SQL'] FROM course_project_suggestions WHERE title = 'SQL cơ bản'), 'Gợi ý có từ khóa kỹ năng');

-- Quản trị sửa khung: dòng yêu cầu bị xóa thì hồ sơ giữ kỹ năng, bỏ liên kết
RESET ROLE;
DELETE FROM career_level_framework_items WHERE content = 'SQL';
SELECT t_assert((SELECT framework_item_id IS NULL AND self_level = 2 FROM skill_profile_items WHERE title = 'SQL'), 'Xóa dòng yêu cầu giữ kỹ năng trong hồ sơ');

SELECT 'Hoàn tất kiểm thử phân tích khoảng cách' AS result;
