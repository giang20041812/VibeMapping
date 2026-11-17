-- Kiểm thử học sinh / sinh viên tự đổi nhóm; các vai trò khác vẫn không tự đổi được.
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

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'hs@test.vn', '{"role":"student"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'sv@test.vn', '{"role":"university_student"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'ph@test.vn', '{"role":"student"}');
UPDATE user_profiles SET grade_or_major = 'Lớp 12' WHERE id = '00000000-0000-0000-0000-0000000000a1';
UPDATE user_profiles SET role = 'parent' WHERE id = '00000000-0000-0000-0000-0000000000a3';

SET ROLE authenticated;

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000a1');
SELECT set_my_learner_role('university_student');
SELECT t_assert((SELECT role FROM user_profiles WHERE id = auth.uid()) = 'university_student', 'Học sinh (tài khoản email) đổi được thành sinh viên');
SELECT t_assert((SELECT grade_or_major FROM user_profiles WHERE id = auth.uid()) IS NULL, 'Đổi nhóm thì xóa khối lớp cũ');
UPDATE user_profiles SET grade_or_major = 'Năm 1' WHERE id = auth.uid();
SELECT set_my_learner_role('university_student');
SELECT t_assert((SELECT grade_or_major FROM user_profiles WHERE id = auth.uid()) = 'Năm 1', 'Chọn lại đúng nhóm hiện tại thì giữ nguyên khối lớp');
SELECT t_expect_error($$UPDATE user_profiles SET role = 'student' WHERE id = auth.uid()$$, 'role_change_forbidden', 'Không đổi vai trò bằng cập nhật hồ sơ thường');
SELECT set_config('app.learner_role_switch', '1', false);
SELECT t_expect_error($$UPDATE user_profiles SET role = 'teacher' WHERE id = auth.uid()$$, 'role_change_forbidden', 'Cờ đổi nhóm không mở đường sang vai trò khác');
SELECT set_config('app.learner_role_switch', '0', false);
SELECT t_expect_error($$SELECT set_my_learner_role('teacher')$$, 'role_not_allowed', 'Không tự đổi sang giáo viên');

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000a2');
SELECT set_my_learner_role('student');
SELECT t_assert((SELECT role FROM user_profiles WHERE id = auth.uid()) = 'student', 'Sinh viên đổi lại được thành học sinh');

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000a3');
SELECT t_expect_error($$SELECT set_my_learner_role('student')$$, 'role_not_allowed', 'Phụ huynh không tự đổi thành học sinh');

RESET ROLE;
SELECT 'Hoàn tất kiểm thử đổi nhóm học sinh / sinh viên' AS "Hoàn tất";
