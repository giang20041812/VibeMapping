-- Kiểm thử chuyển phương án ưu tiên thành nghề mục tiêu (FR06.03.04).
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
SELECT x.c, f.id, x.c, 'T', 'published' FROM career_fields f, (VALUES ('G-1'), ('G-2'), ('G-3')) x(c) WHERE f.field_code = 'LV8';
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'a1@test', '{"role":"student"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b1@test', '{"role":"student"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'p1@test', '{"role":"parent"}');
UPDATE user_profiles SET date_of_birth = '2008-01-01' WHERE id IN ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');

CREATE TEMP TABLE cid AS SELECT career_code AS k, id AS v FROM careers;
GRANT SELECT ON cid TO authenticated;

SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000a1');
CREATE TEMP TABLE plans (k text, id uuid);
GRANT ALL ON plans TO authenticated;
INSERT INTO plans SELECT 'nopref', save_decision_plan('Chưa chọn', ARRAY[]::uuid[],
  jsonb_build_array(jsonb_build_object('id','A','title','A'), jsonb_build_object('id','B','title','B')), '{}', NULL, NULL, '[]');
SELECT t_expect_error($$SELECT set_decision_goal((SELECT id FROM plans WHERE k = 'nopref'))$$, 'no_preferred_option', 'Chưa chọn phương án ưu tiên thì không đặt mục tiêu');

INSERT INTO plans SELECT 'nocareer', save_decision_plan('Không nghề', ARRAY[]::uuid[],
  jsonb_build_array(jsonb_build_object('id','A','title','A'), jsonb_build_object('id','B','title','B')), '{}', NULL, NULL, '[]');
SELECT set_preferred_option((SELECT id FROM plans WHERE k = 'nocareer'), 'A', 'thích');
SELECT t_expect_error($$SELECT set_decision_goal((SELECT id FROM plans WHERE k = 'nocareer'))$$, 'option_without_career', 'Phương án không gắn nghề thì không đặt mục tiêu');

INSERT INTO plans SELECT 'ok', save_decision_plan('Có nghề', (SELECT array_agg(v) FROM cid WHERE k IN ('G-1', 'G-2')),
  jsonb_build_array(jsonb_build_object('id','A','title','A','careerId',(SELECT v FROM cid WHERE k = 'G-1')),
                    jsonb_build_object('id','B','title','B','careerId',(SELECT v FROM cid WHERE k = 'G-2'))), '{}', NULL, NULL, '[]');
SELECT set_preferred_option((SELECT id FROM plans WHERE k = 'ok'), 'B', 'phù hợp hơn');
SELECT t_assert(set_decision_goal((SELECT id FROM plans WHERE k = 'ok')) = (SELECT v FROM cid WHERE k = 'G-2'), 'Đặt nghề của phương án ưu tiên làm mục tiêu');
SELECT t_assert((SELECT count(*) FROM user_saved_careers WHERE user_id = auth.uid() AND kind = 'target' AND career_id = (SELECT v FROM cid WHERE k = 'G-2')) = 1, 'Nghề mục tiêu được lưu');
SELECT t_assert((SELECT count(*) FROM decision_history WHERE action = 'goal_set') = 1, 'Ghi lịch sử quyết định');
SELECT t_assert(set_decision_goal((SELECT id FROM plans WHERE k = 'ok')) IS NOT NULL, 'Đặt lại cùng nghề không lỗi');

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000b1');
SELECT t_expect_error($$SELECT set_decision_goal((SELECT id FROM plans WHERE k = 'ok'))$$, 'forbidden', 'Người khác không đặt mục tiêu theo phương án của tôi');

-- Đã chia sẻ cho phụ huynh: cần đồng thuận
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000a1');
INSERT INTO plans SELECT 'shared', save_decision_plan('Đã chia sẻ', ARRAY[]::uuid[],
  jsonb_build_array(jsonb_build_object('id','A','title','A','careerId',(SELECT v FROM cid WHERE k = 'G-1')), jsonb_build_object('id','B','title','B')), '{}', NULL, NULL, '[]');
SELECT set_preferred_option((SELECT id FROM plans WHERE k = 'shared'), 'A', '');
RESET ROLE;
INSERT INTO decision_reports (owner_id, plan_id) SELECT '00000000-0000-0000-0000-0000000000a1', id FROM plans WHERE k = 'shared';
INSERT INTO decision_report_shares (report_id, shared_with) SELECT id, '00000000-0000-0000-0000-0000000000c1' FROM decision_reports;
SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000a1');
SELECT t_expect_error($$SELECT set_decision_goal((SELECT id FROM plans WHERE k = 'shared'))$$, 'consensus_required', 'Đã chia sẻ mà phụ huynh chưa đồng thuận thì chưa chốt');
RESET ROLE;
UPDATE decision_report_shares SET consensus_at = now();
SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000a1');
SELECT t_assert(set_decision_goal((SELECT id FROM plans WHERE k = 'shared')) = (SELECT v FROM cid WHERE k = 'G-1'), 'Phụ huynh đồng thuận thì chốt được');

-- Giới hạn 2 nghề mục tiêu
INSERT INTO plans SELECT 'third', save_decision_plan('Nghề thứ ba', ARRAY[]::uuid[],
  jsonb_build_array(jsonb_build_object('id','A','title','A','careerId',(SELECT v FROM cid WHERE k = 'G-3')), jsonb_build_object('id','B','title','B')), '{}', NULL, NULL, '[]');
SELECT set_preferred_option((SELECT id FROM plans WHERE k = 'third'), 'A', '');
SELECT t_expect_error($$SELECT set_decision_goal((SELECT id FROM plans WHERE k = 'third'))$$, 'target_career_limit', 'Không quá 2 nghề mục tiêu');
RESET ROLE;

-- Kỹ năng mềm từ 360° chỉ G2–G5
SELECT t_assert(pg_get_functiondef('public.import_verified_soft_skills()'::regprocedure) LIKE '%IN (''G2'',''G3'',''G4'',''G5'')%'
            AND pg_get_functiondef('public.import_verified_soft_skills()'::regprocedure) NOT LIKE '%''G1'',''G2''%', 'Nhập kỹ năng mềm chỉ lấy G2–G5');

DROP FUNCTION public.t_expect_error(text, text, text);
DROP FUNCTION public.t_assert(boolean, text);
DROP FUNCTION public.t_act_as(uuid);
\echo 'Hoàn tất kiểm thử đặt mục tiêu từ phương án'
