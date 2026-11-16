-- Kiểm thử engine đọc công thức từ thư viện: bộ tính trong SQL khớp mọi ca thử của danh mục,
-- công thức chưa bị thay thì kết quả cũ, công thức bị thay thì engine tính theo biểu thức mới.
\set QUIET on
SET client_min_messages = warning;

CREATE OR REPLACE FUNCTION public.t_assert(p_ok boolean, p_name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL %', p_name; END IF;
  RAISE WARNING 'ok %', p_name;
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
-- Đặt bản mới hiệu lực cho một công thức (biểu thức viết thẳng)
CREATE OR REPLACE FUNCTION public.t_set_formula(p_code text, p_expr jsonb) RETURNS void LANGUAGE sql AS $$
  INSERT INTO formula_versions (formula_id, expression, status, note)
  SELECT id, p_expr, 'active', 'thử' FROM formulas WHERE formula_code = p_code;
$$;

\i formula_catalog_fixture.sql

-- 1. Bộ tính trong SQL khớp từng ca thử của danh mục ---------------------------------------------------------
DO $$
DECLARE
  c record;
  v_expr jsonb;
  v_actual jsonb;
  v_ok boolean;
  v_fail text := '';
  v_n integer := 0;
BEGIN
  FOR c IN SELECT * FROM fx_case ORDER BY code, case_name LOOP
    SELECT v.expression INTO v_expr FROM formula_versions v JOIN formulas f ON f.id = v.formula_id
     WHERE f.formula_code = c.code AND v.status = 'active';
    v_actual := public.formula_eval(v_expr, jsonb_build_object('vars', c.vars, 'refs', c.refs, 'sets', c.sets));
    v_ok := CASE
      WHEN jsonb_typeof(c.expected) = 'null' OR jsonb_typeof(v_actual) = 'null' THEN jsonb_typeof(c.expected) = jsonb_typeof(v_actual)
      WHEN jsonb_typeof(c.expected) = 'number' AND jsonb_typeof(v_actual) = 'number'
        THEN abs((c.expected #>> '{}')::numeric - (v_actual #>> '{}')::numeric) <= c.tolerance
      ELSE c.expected = v_actual END;
    v_n := v_n + 1;
    IF NOT v_ok THEN v_fail := v_fail || format(E'\n  %s – %s: %s khác %s', c.code, c.case_name, v_actual, c.expected); END IF;
  END LOOP;
  IF v_fail <> '' THEN RAISE EXCEPTION 'FAIL bộ tính SQL lệch ca thử:%', v_fail; END IF;
  RAISE WARNING 'ok bộ tính SQL khớp % ca thử của danh mục', v_n;
END $$;

-- 2. Chưa thay công thức nào: kết quả giữ nguyên ----------------------------------------------------------------
SELECT public.t_assert((SELECT count(*) FROM formula_live) = 0, 'nạp danh mục xong chưa có công thức nào bị thay');
SELECT public.t_assert(public.calc_rater_weight(12, NULL, 0, 100) = 10000, 'trọng số bài: chưa chấm định tính dùng mặc định');
SELECT public.t_assert(abs(public.calc_rater_weight(6, 60, 0, 100) - 2000) < 0.001, 'trọng số bài: đã chấm định tính');
SELECT public.t_assert(public.calc_criterion_percent(4.25) = 85, 'điểm tiêu chí theo phần trăm');
SELECT public.t_assert(public.calc_competency_level(70, '{"very_high":80,"high":65,"medium":50}') = 'high', 'mức năng lực giữ nguyên');
SELECT public.t_assert(public.calc_confidence('medium', 0.7, 0.1) = 'medium', 'độ tin cậy giữ nguyên');
SELECT public.t_assert(public.supplemental_understanding_score('parent', ARRAY[2,1,2,1]::smallint[], ARRAY[4,3,5,4]::smallint[], 4) = 77.5, 'điểm bổ sung phụ huynh');
SELECT public.t_assert(public.supplemental_understanding_score('friend', ARRAY[2,1,2,1]::smallint[], ARRAY[4,3,5,4]::smallint[], NULL) = 76.5, 'điểm bổ sung bạn bè không cần Carkhuff');

-- 3. Thay công thức: engine tính theo biểu thức mới -----------------------------------------------------------
SELECT public.t_set_formula('rater_weight', '{"t":"bin","op":"*","l":{"t":"ref","formula":"th_percent"},"r":{"t":"num","v":2}}');
SELECT public.t_assert((SELECT count(*) FROM formula_live WHERE formula_code = 'rater_weight') = 1, 'phiên bản khác bản gốc vào danh sách đang thay');
SELECT public.t_assert(public.calc_rater_weight(12, NULL, 0, 100) = 200, 'trọng số bài theo công thức mới');
SELECT public.t_assert(public.calc_rater_weight(3, NULL, 0, 100) = 0, 'công thức mới giữ đúng phép tính ở điểm thấp nhất');

SELECT public.t_set_formula('competency_level', '{"t":"text","v":"Rất cao"}');
SELECT public.t_assert(public.calc_competency_level(10, '{"very_high":80,"high":65,"medium":50}') = 'very_high', 'mức năng lực theo công thức mới');

SELECT public.t_set_formula('confidence', '{"t":"text","v":"Thấp"}');
SELECT public.t_assert(public.calc_confidence('high', 0.95, 0) = 'low', 'độ tin cậy theo công thức mới');

SELECT public.t_set_formula('supplemental_score', '{"t":"num","v":42}');
SELECT public.t_assert(public.supplemental_understanding_score('mentor', ARRAY[2,2,2,2]::smallint[], ARRAY[5,5,5,5]::smallint[], 5) = 42, 'điểm bổ sung theo công thức mới');

-- Công thức con của công thức mới tự lấy bản hiệu lực: criterion_percent dựa vào criterion_score_360 được truyền vào
SELECT public.t_set_formula('criterion_percent', '{"t":"bin","op":"*","l":{"t":"ref","formula":"criterion_score_360"},"r":{"t":"num","v":10}}');
SELECT public.t_assert(public.calc_criterion_percent(4) = 40, 'điểm phần trăm theo công thức mới');

-- 4. Biểu thức lỗi thì quay về kết quả cũ, không làm hỏng lần tính ---------------------------------------------
SELECT public.t_set_formula('criterion_percent', '{"t":"sym","id":"budget"}');
SELECT public.t_assert(public.calc_criterion_percent(4) = 80, 'biểu thức thiếu đầu vào thì dùng kết quả cũ');
SELECT set_config('app.formula_strict', '1', false);
SELECT public.t_expect_error('SELECT public.calc_criterion_percent(4)', 'formula_missing_input', 'chế độ nghiêm ngặt báo lỗi biểu thức');
SELECT set_config('app.formula_strict', '0', false);

-- 5. Đặt lại đúng như bản gốc thì không còn bị thay -------------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT f.formula_code, (SELECT v.expression FROM formula_versions v WHERE v.formula_id = f.id ORDER BY v.version_no LIMIT 1) AS base
             FROM formulas f WHERE f.formula_code IN ('rater_weight', 'competency_level', 'confidence', 'supplemental_score', 'criterion_percent') LOOP
    PERFORM public.t_set_formula(c.formula_code, c.base);
  END LOOP;
END $$;
SELECT public.t_assert((SELECT count(*) FROM formula_live) = 0, 'đặt lại như bản gốc thì không còn công thức bị thay');
SELECT public.t_assert(public.calc_rater_weight(12, NULL, 0, 100) = 10000, 'trọng số bài về như cũ');
SELECT public.t_assert((SELECT max(version_no) FROM formula_versions v JOIN formulas f ON f.id = v.formula_id WHERE f.formula_code = 'rater_weight') = 3, 'lịch sử phiên bản được giữ');

-- 6. Giao diện lấy được danh sách công thức bị thay ------------------------------------------------------------
SELECT public.t_set_formula('perception_delta', '{"t":"bin","op":"-","l":{"t":"sym","id":"self_percent"},"r":{"t":"sym","id":"group_percent"}}');
SELECT public.t_assert((public.get_formula_overrides() -> 'formulas') ? 'perception_delta', 'get_formula_overrides trả công thức bị thay');
SELECT public.t_assert((public.get_formula_overrides() -> 'active') ? 'th_percent', 'get_formula_overrides kèm công thức con để tự tính');
SELECT public.t_assert(NOT ((public.get_formula_overrides() -> 'formulas') ? 'th_percent'), 'công thức chưa thay không có trong danh sách');

\echo Hoàn tất kiểm thử engine đọc công thức
