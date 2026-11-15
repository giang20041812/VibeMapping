-- Kiểm thử thư viện công thức trên database tạm: liên kết phụ thuộc, vòng lặp, tham chiếu sai, phiên bản, quyền.
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

-- Dữ liệu ---------------------------------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'admin@test', '{"role":"student"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'hs@test', '{"role":"student"}');
UPDATE user_profiles SET role = 'system_admin' WHERE id = '00000000-0000-0000-0000-0000000000d1';

INSERT INTO formula_groups (group_code, group_name, sort_order) VALUES ('g_test', 'Nhóm thử', 1);
INSERT INTO formula_symbols (symbol_code, display_latex, symbol_name, source_kind, source_ref) VALUES
  ('x', 'x', 'Đầu vào', 'input', NULL),
  ('A', 'A', 'Kết quả A', 'formula', 'fa'),
  ('B', 'B', 'Kết quả B', 'formula', 'fb'),
  ('C', 'C', 'Kết quả C', 'formula', 'fc'),
  ('self_weight', 'w_{self}', 'Trọng số bản thân', 'param', 'self_weight');
INSERT INTO formulas (formula_code, formula_name, group_id, output_symbol)
SELECT v.code, v.name, g.id, v.sym FROM (VALUES ('fa', 'Công thức A', 'A'), ('fb', 'Công thức B', 'B'), ('fc', 'Công thức C', 'C')) v(code, name, sym),
  formula_groups g WHERE g.group_code = 'g_test';

SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000d2');
SELECT public.t_assert((SELECT count(*) FROM formulas) = 0, 'học sinh không đọc được công thức');
SELECT public.t_expect_error($q$INSERT INTO formula_groups (group_code, group_name) VALUES ('g_hs', 'x')$q$, 'row-level security', 'học sinh không ghi được nhóm công thức');

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000d1');
SELECT public.t_assert((SELECT count(*) FROM formulas) = 3, 'quản trị đọc được công thức');

-- Phiên bản đầu của A: dùng ký hiệu và tham số --------------------------------------------------------------
INSERT INTO formula_versions (formula_id, expression, status)
SELECT id, '{"t":"bin","op":"*","l":{"t":"sym","id":"x"},"r":{"t":"param","code":"self_weight"}}'::jsonb, 'active'
  FROM formulas WHERE formula_code = 'fa';
SELECT public.t_assert((SELECT version_no FROM formula_versions v JOIN formulas f ON f.id = v.formula_id WHERE f.formula_code = 'fa') = 1, 'version_no tự tăng bắt đầu từ 1');
SELECT public.t_assert((SELECT count(*) FROM formula_dependencies WHERE depends_on_param_code = 'self_weight') = 1, 'tự ghi phụ thuộc tham số');

-- B dùng A, C dùng B -------------------------------------------------------------------------------------------
INSERT INTO formula_versions (formula_id, expression, status)
SELECT id, '{"t":"bin","op":"+","l":{"t":"ref","formula":"fa"},"r":{"t":"num","v":1}}'::jsonb, 'active' FROM formulas WHERE formula_code = 'fb';
INSERT INTO formula_versions (formula_id, expression, status)
SELECT id, '{"t":"agg","kind":"sum","index":"i","over":"s","label":"mục","body":{"t":"ref","formula":"fb"}}'::jsonb, 'active' FROM formulas WHERE formula_code = 'fc';
SELECT public.t_assert((SELECT count(*) FROM formula_dependencies d JOIN formulas f ON f.id = d.depends_on_formula_id WHERE f.formula_code = 'fb') = 1, 'tìm được tham chiếu lồng trong nút tổng');
SELECT public.t_assert((SELECT count(*) FROM formula_dependencies WHERE depends_on_formula_id IS NOT NULL) = 2, 'liên kết công thức B→A, C→B');

-- Lỗi tham chiếu -------------------------------------------------------------------------------------------------
SELECT public.t_expect_error($q$INSERT INTO formula_versions (formula_id, expression, status)
  SELECT id, '{"t":"ref","formula":"khong_co"}'::jsonb, 'draft' FROM formulas WHERE formula_code = 'fa'$q$, 'formula_ref_not_found', 'công thức không tồn tại bị từ chối');
SELECT public.t_expect_error($q$INSERT INTO formula_versions (formula_id, expression, status)
  SELECT id, '{"t":"param","code":"khong_co_tham_so"}'::jsonb, 'draft' FROM formulas WHERE formula_code = 'fa'$q$, 'formula_param_not_found', 'tham số không tồn tại bị từ chối');
SELECT public.t_expect_error($q$INSERT INTO formula_versions (formula_id, expression, status)
  SELECT id, '{"t":"sym","id":"khong_co_ky_hieu"}'::jsonb, 'draft' FROM formulas WHERE formula_code = 'fa'$q$, 'formula_symbol_not_found', 'ký hiệu không tồn tại bị từ chối');

-- Vòng lặp: tự tham chiếu, A→C (C→B→A), và bản nháp gián tiếp ---------------------------------------------------
SELECT public.t_expect_error($q$INSERT INTO formula_versions (formula_id, expression, status)
  SELECT id, '{"t":"ref","formula":"fa"}'::jsonb, 'draft' FROM formulas WHERE formula_code = 'fa'$q$, 'formula_cycle', 'công thức tự tham chiếu bị chặn');
SELECT public.t_expect_error($q$INSERT INTO formula_versions (formula_id, expression, status)
  SELECT id, '{"t":"ref","formula":"fc"}'::jsonb, 'active' FROM formulas WHERE formula_code = 'fa'$q$, 'formula_cycle', 'vòng A→C→B→A bị chặn');
SELECT public.t_assert((SELECT count(*) FROM formula_versions) = 3, 'lần lưu bị chặn không để lại phiên bản');

-- Bản mới hiệu lực thì bản cũ chuyển ngừng dùng, liên kết theo từng phiên bản ---------------------------------------
INSERT INTO formula_versions (formula_id, expression, status, note)
SELECT id, '{"t":"bin","op":"*","l":{"t":"sym","id":"x"},"r":{"t":"num","v":2}}'::jsonb, 'active', 'đổi sang hệ số 2' FROM formulas WHERE formula_code = 'fa';
SELECT public.t_assert((SELECT count(*) FROM formula_versions v JOIN formulas f ON f.id = v.formula_id WHERE f.formula_code = 'fa' AND v.status = 'active') = 1, 'mỗi công thức chỉ một bản hiệu lực');
SELECT public.t_assert((SELECT status FROM formula_versions v JOIN formulas f ON f.id = v.formula_id WHERE f.formula_code = 'fa' AND v.version_no = 1) = 'retired', 'bản cũ chuyển ngừng dùng');
SELECT public.t_assert((SELECT version_no FROM formula_versions v JOIN formulas f ON f.id = v.formula_id WHERE f.formula_code = 'fa' AND v.status = 'active') = 2, 'bản mới có version_no = 2');
SELECT public.t_assert((SELECT effective_from IS NOT NULL FROM formula_versions v JOIN formulas f ON f.id = v.formula_id WHERE f.formula_code = 'fa' AND v.status = 'active'), 'bản hiệu lực có ngày hiệu lực');

-- Bản đã hiệu lực không sửa nội dung; bản nháp sửa được -------------------------------------------------------------
SELECT public.t_expect_error($q$UPDATE formula_versions SET expression = '{"t":"num","v":9}'::jsonb WHERE status = 'active'$q$, 'formula_version_immutable', 'không sửa nội dung bản hiệu lực');
INSERT INTO formula_versions (formula_id, expression, status)
SELECT id, '{"t":"num","v":1}'::jsonb, 'draft' FROM formulas WHERE formula_code = 'fc';
UPDATE formula_versions SET expression = '{"t":"ref","formula":"fa"}'::jsonb WHERE status = 'draft';
SELECT public.t_assert((SELECT count(*) FROM formula_dependencies d JOIN formula_versions v ON v.id = d.version_id WHERE v.status = 'draft' AND d.depends_on_formula_id IS NOT NULL) = 1, 'sửa bản nháp thì liên kết ghi lại theo nội dung mới');
SELECT public.t_expect_error($q$UPDATE formula_versions SET status = 'active' WHERE status = 'retired'$q$, 'formula_version_retired', 'bản đã ngừng dùng không bật lại');

-- Ca thử ------------------------------------------------------------------------------------------------------------
INSERT INTO formula_test_cases (formula_id, case_name, inputs, expected)
SELECT id, 'ca 1', '{"vars":{"x":2}}'::jsonb, '4'::jsonb FROM formulas WHERE formula_code = 'fa';
SELECT public.t_expect_error($q$INSERT INTO formula_test_cases (formula_id, case_name, inputs, expected)
  SELECT id, 'ca 1', '{}'::jsonb, '1'::jsonb FROM formulas WHERE formula_code = 'fa'$q$, 'formula_test_cases_unique', 'tên ca thử không trùng trong một công thức');

-- Xóa nhóm đang có công thức bị chặn ---------------------------------------------------------------------------------
SELECT public.t_expect_error($q$DELETE FROM formula_groups$q$, 'RESTRICT', 'không xóa nhóm còn công thức');

RESET ROLE;
\echo Hoàn tất kiểm thử thư viện công thức
