-- Kiểm thử công bố nghề: đủ chuẩn tính từ DB, tự công bố có xét P16, không công bố lại nghề Ẩn.
\set QUIET on
SET client_min_messages = warning;

CREATE OR REPLACE FUNCTION public.t_assert(p_ok boolean, p_name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL %', p_name; END IF;
  RAISE WARNING 'ok %', p_name;
END;
$$;

INSERT INTO criteria_groups (group_code, name, sort_order) VALUES ('G1', 'Năng lực', 1), ('G6', 'Sở thích', 6), ('G7', 'Động lực', 7);
INSERT INTO criteria (group_id, dimension_code, name, sort_order)
SELECT g.id, x.d, x.n, x.s FROM (VALUES
  ('G1', 'D1.1', 'Tư duy logic', 1), ('G6', 'D6.1', 'Thực tế', 3), ('G6', 'D6.2', 'Nghiên cứu', 4), ('G7', 'D7.1', 'Thành tựu', 9)) x(g, d, n, s)
JOIN criteria_groups g ON g.group_code = x.g;
INSERT INTO holland_codes (holland_code, name) SELECT v, v FROM unnest(ARRAY['R','I','A','S','E','C']) v ON CONFLICT DO NOTHING;

INSERT INTO career_fields (field_code, field_name) VALUES ('LV8', 'Thử nghiệm');
-- P-01 đủ cả ba thành phần, 5 JD; P-02 đủ nhưng chỉ 1 JD; P-03 thiếu G7; P-04 đủ nhưng đã Ẩn; P-05 thiếu Holland
INSERT INTO careers (career_code, career_field_id, career_name, source_group_id, status, qualifying_jd_count)
SELECT x.code, f.id, x.code, 'T', x.st, x.jd FROM career_fields f, (VALUES
  ('P-01', 'draft', 5), ('P-02', 'draft', 1), ('P-03', 'draft', 5), ('P-04', 'hidden', 5), ('P-05', 'draft', 5)) x(code, st, jd)
WHERE f.field_code = 'LV8';
INSERT INTO career_requirements (career_id, criteria_id, matrix_version_id, required_score, career_weight)
SELECT k.id, c.id, v.id, 3, 1 FROM (VALUES
  ('P-01', 'D1.1'), ('P-01', 'D7.1'), ('P-02', 'D1.1'), ('P-02', 'D7.1'), ('P-03', 'D1.1'),
  ('P-04', 'D1.1'), ('P-04', 'D7.1'), ('P-05', 'D1.1'), ('P-05', 'D7.1')) x(code, d)
JOIN careers k ON k.career_code = x.code JOIN criteria c ON c.dimension_code = x.d
CROSS JOIN career_matrix_versions v WHERE v.is_current;
INSERT INTO career_holland_profiles (career_id, holland_code, strength, jd_count)
SELECT k.id, x.h, x.s, 1 FROM (VALUES
  ('P-01', 'I', 0.6), ('P-01', 'R', 0.9), ('P-02', 'R', 0.5), ('P-03', 'R', 0.5), ('P-04', 'R', 0.5)) x(code, h, s)
JOIN careers k ON k.career_code = x.code;

SELECT refresh_career_standard();
SELECT t_assert((SELECT is_standard_complete AND holland_top3 = 'RI' FROM careers WHERE career_code = 'P-01'),
  'Đủ G1–G5, G7 và Holland thì đủ chuẩn; Top 3 xếp theo cường độ');
SELECT t_assert(NOT (SELECT is_standard_complete FROM careers WHERE career_code = 'P-03'), 'Thiếu G7 thì chưa đủ chuẩn');
SELECT t_assert(NOT (SELECT is_standard_complete FROM careers WHERE career_code = 'P-05'), 'Thiếu Holland thì chưa đủ chuẩn');

UPDATE operation_parameters SET param_value = to_jsonb(3) WHERE param_code = 'career_min_jd' AND is_current;
SELECT t_assert(auto_publish_careers() = 1, 'Chỉ công bố nghề Nháp đủ chuẩn và đủ số JD tối thiểu');
SELECT t_assert((SELECT status FROM careers WHERE career_code = 'P-01') = 'published', 'P-01 được công bố');
SELECT t_assert((SELECT status FROM careers WHERE career_code = 'P-02') = 'draft', 'Nghề dưới số JD tối thiểu giữ Nháp');
SELECT t_assert((SELECT status FROM careers WHERE career_code = 'P-04') = 'hidden', 'Nghề đã Ẩn không bị công bố lại');
SELECT t_assert(auto_publish_careers() = 0, 'Chạy lại không đổi gì');

-- Dòng sửa tay làm đổi đủ chuẩn khi tính lại
INSERT INTO career_requirements (career_id, criteria_id, matrix_version_id, required_score, career_weight, verification_level)
SELECT k.id, c.id, v.id, 4, 1, 'expert_reviewed' FROM careers k, criteria c, career_matrix_versions v
 WHERE k.career_code = 'P-03' AND c.dimension_code = 'D7.1' AND v.is_current;
SELECT refresh_career_standard((SELECT array_agg(id) FROM careers WHERE career_code = 'P-03'));
SELECT t_assert((SELECT is_standard_complete FROM careers WHERE career_code = 'P-03'), 'Thêm tiêu chí G7 bằng tay thì nghề đủ chuẩn');

DROP FUNCTION public.t_assert(boolean, text);
\echo 'Hoàn tất kiểm thử công bố nghề'
