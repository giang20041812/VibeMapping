-- Engine tính điểm đọc công thức từ thư viện công thức.
-- Nguyên tắc: công thức giữ nguyên như bản gốc (phiên bản đầu) thì engine dùng mã sẵn có, kết quả không đổi.
-- Chỉ khi quản trị áp dụng một phiên bản có biểu thức khác bản gốc thì engine mới tính theo biểu thức đó.
-- Biểu thức lỗi hoặc thiếu đầu vào thì tự quay về mã sẵn có, không làm hỏng lần tính.

-- 1. Danh sách công thức đang được thay (chỉ gồm công thức khác bản gốc) -----------------------------
CREATE TABLE IF NOT EXISTS public.formula_live (
  formula_code text PRIMARY KEY,
  expression jsonb NOT NULL,
  version_no integer NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.formula_live ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin read formula_live" ON public.formula_live;
CREATE POLICY "Admin read formula_live" ON public.formula_live FOR SELECT TO authenticated
  USING (public.is_system_admin());

CREATE OR REPLACE FUNCTION public.formula_sync_live(p_formula_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text;
  v_no integer;
  v_expr jsonb;
  v_base jsonb;
BEGIN
  SELECT formula_code INTO v_code FROM public.formulas WHERE id = p_formula_id;
  IF v_code IS NULL THEN RETURN; END IF;
  SELECT version_no, expression INTO v_no, v_expr
    FROM public.formula_versions WHERE formula_id = p_formula_id AND status = 'active';
  SELECT expression INTO v_base
    FROM public.formula_versions WHERE formula_id = p_formula_id ORDER BY version_no LIMIT 1;
  IF v_no IS NULL OR v_expr IS NOT DISTINCT FROM v_base THEN
    DELETE FROM public.formula_live WHERE formula_code = v_code;
  ELSE
    INSERT INTO public.formula_live (formula_code, expression, version_no)
    VALUES (v_code, v_expr, v_no)
    ON CONFLICT (formula_code) DO UPDATE
      SET expression = EXCLUDED.expression, version_no = EXCLUDED.version_no, updated_at = now();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.formula_version_sync_live()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.formula_sync_live(NEW.formula_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_formula_version_sync_live ON public.formula_versions;
CREATE TRIGGER trg_formula_version_sync_live
  AFTER INSERT OR UPDATE ON public.formula_versions
  FOR EACH ROW EXECUTE FUNCTION public.formula_version_sync_live();

-- 2. Giá trị tham số vận hành theo mã ký hiệu ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.formula_param_value(p_symbol text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.param_value
    FROM public.formula_symbols s
    JOIN public.operation_parameters p ON p.param_code = s.source_ref AND p.is_current
   WHERE s.symbol_code = p_symbol AND s.source_kind = 'param';
$$;

-- 3. Bộ tính biểu thức: cùng ngữ nghĩa với evaluate.ts ----------------------------------------------
-- Giá trị là jsonb; rỗng là jsonb 'null'. Ngữ cảnh: {"vars":{}, "refs":{}, "sets":{}, "formulas":{}}.
CREATE OR REPLACE FUNCTION public.formula_to_num(p_value jsonb)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) = 'null' THEN RETURN NULL; END IF;
  IF jsonb_typeof(p_value) <> 'number' THEN RAISE EXCEPTION 'formula_type_mismatch: %', p_value; END IF;
  RETURN (p_value #>> '{}')::numeric;
END;
$$;

CREATE OR REPLACE FUNCTION public.formula_eval_cond(p_cond jsonb, p_ctx jsonb, p_scope jsonb, p_stack text[])
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kind text := p_cond ->> 'c';
  v_item jsonb;
  l jsonb;
  r jsonb;
  ln numeric;
  rn numeric;
  v_op text;
BEGIN
  IF v_kind = 'notnull' THEN
    RETURN jsonb_typeof(public.formula_eval_node(p_cond -> 'e', p_ctx, p_scope, p_stack)) <> 'null';
  ELSIF v_kind = 'and' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cond -> 'items') LOOP
      IF NOT public.formula_eval_cond(v_item, p_ctx, p_scope, p_stack) THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  ELSIF v_kind = 'or' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cond -> 'items') LOOP
      IF public.formula_eval_cond(v_item, p_ctx, p_scope, p_stack) THEN RETURN true; END IF;
    END LOOP;
    RETURN false;
  ELSIF v_kind <> 'cmp' THEN
    RAISE EXCEPTION 'formula_bad_condition: %', v_kind;
  END IF;

  v_op := p_cond ->> 'op';
  l := public.formula_eval_node(p_cond -> 'l', p_ctx, p_scope, p_stack);
  r := public.formula_eval_node(p_cond -> 'r', p_ctx, p_scope, p_stack);
  IF jsonb_typeof(l) = 'null' OR jsonb_typeof(r) = 'null' THEN RETURN false; END IF;
  IF jsonb_typeof(l) = 'string' OR jsonb_typeof(r) = 'string' THEN
    IF v_op = '=' THEN RETURN l = r; END IF;
    IF v_op = '!=' THEN RETURN l <> r; END IF;
    RETURN false;
  END IF;
  ln := public.formula_to_num(l);
  rn := public.formula_to_num(r);
  RETURN CASE v_op
    WHEN '>=' THEN ln >= rn
    WHEN '>' THEN ln > rn
    WHEN '<=' THEN ln <= rn
    WHEN '<' THEN ln < rn
    WHEN '=' THEN ln = rn
    WHEN '!=' THEN ln <> rn
    ELSE NULL END;
END;
$$;

CREATE OR REPLACE FUNCTION public.formula_eval_node(p_expr jsonb, p_ctx jsonb, p_scope jsonb, p_stack text[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_t text := p_expr ->> 't';
  v_key text;
  v_val jsonb;
  v_sub jsonb;
  l numeric;
  r numeric;
  d numeric;
  n numeric;
  v_name text;
  v_args numeric[] := ARRAY[]::numeric[];
  v_arg jsonb;
  v_num numeric;
  v_rows jsonb;
  v_row jsonb;
  v_cell record;
  v_scope jsonb;
  v_kind text;
  v_count integer := 0;
  v_n integer := 0;
  v_sum numeric := 0;
  v_min numeric;
  v_max numeric;
  v_branch jsonb;
  v_scale numeric;
BEGIN
  IF v_t = 'num' OR v_t = 'text' THEN
    RETURN p_expr -> 'v';
  ELSIF v_t = 'na' THEN
    RETURN 'null'::jsonb;

  ELSIF v_t = 'sym' OR v_t = 'param' THEN
    v_key := CASE WHEN v_t = 'sym' THEN p_expr ->> 'id' ELSE p_expr ->> 'code' END;
    IF p_scope ? v_key THEN RETURN p_scope -> v_key; END IF;
    IF COALESCE(p_ctx -> 'vars', '{}'::jsonb) ? v_key THEN RETURN p_ctx -> 'vars' -> v_key; END IF;
    IF v_t = 'param' THEN
      v_val := public.formula_param_value(v_key);
      IF v_val IS NOT NULL THEN RETURN v_val; END IF;
    END IF;
    RAISE EXCEPTION 'formula_missing_input: %', v_key;

  ELSIF v_t = 'ref' THEN
    v_key := p_expr ->> 'formula';
    IF p_scope ? v_key THEN RETURN p_scope -> v_key; END IF;
    IF COALESCE(p_ctx -> 'refs', '{}'::jsonb) ? v_key THEN RETURN p_ctx -> 'refs' -> v_key; END IF;
    v_sub := p_ctx -> 'formulas' -> v_key;
    IF v_sub IS NULL THEN
      SELECT v.expression INTO v_sub
        FROM public.formula_versions v JOIN public.formulas f ON f.id = v.formula_id
       WHERE f.formula_code = v_key AND v.status = 'active';
    END IF;
    IF v_sub IS NULL THEN RAISE EXCEPTION 'formula_missing_formula: %', v_key; END IF;
    IF v_key = ANY (p_stack) THEN RAISE EXCEPTION 'formula_cycle: %', v_key; END IF;
    RETURN public.formula_eval_node(v_sub, p_ctx, p_scope, p_stack || v_key);

  ELSIF v_t = 'bin' THEN
    l := public.formula_to_num(public.formula_eval_node(p_expr -> 'l', p_ctx, p_scope, p_stack));
    r := public.formula_to_num(public.formula_eval_node(p_expr -> 'r', p_ctx, p_scope, p_stack));
    IF l IS NULL OR r IS NULL THEN RETURN 'null'::jsonb; END IF;
    RETURN to_jsonb(CASE p_expr ->> 'op' WHEN '+' THEN l + r WHEN '-' THEN l - r WHEN '*' THEN l * r END);

  ELSIF v_t = 'div' THEN
    d := public.formula_to_num(public.formula_eval_node(p_expr -> 'd', p_ctx, p_scope, p_stack));
    n := public.formula_to_num(public.formula_eval_node(p_expr -> 'n', p_ctx, p_scope, p_stack));
    IF d IS NULL THEN RETURN 'null'::jsonb; END IF;
    IF d = 0 THEN
      IF p_expr ? 'ifZero' THEN RETURN public.formula_eval_node(p_expr -> 'ifZero', p_ctx, p_scope, p_stack); END IF;
      RETURN 'null'::jsonb;
    END IF;
    IF n IS NULL THEN RETURN 'null'::jsonb; END IF;
    RETURN to_jsonb(n / d);

  ELSIF v_t = 'fn' THEN
    v_name := p_expr ->> 'name';
    FOR v_arg IN SELECT * FROM jsonb_array_elements(p_expr -> 'args') LOOP
      v_num := public.formula_to_num(public.formula_eval_node(v_arg, p_ctx, p_scope, p_stack));
      IF v_num IS NULL THEN RETURN 'null'::jsonb; END IF;
      v_args := v_args || v_num;
    END LOOP;
    IF v_name = 'min' THEN RETURN to_jsonb((SELECT min(x) FROM unnest(v_args) x)); END IF;
    IF v_name = 'max' THEN RETURN to_jsonb((SELECT max(x) FROM unnest(v_args) x)); END IF;
    IF v_name = 'floor' THEN RETURN to_jsonb(floor(v_args[1])); END IF;
    IF v_name = 'abs' THEN RETURN to_jsonb(abs(v_args[1])); END IF;
    IF v_name = 'round' THEN
      v_scale := power(10::numeric, COALESCE(v_args[2], 0));
      RETURN to_jsonb(floor(v_args[1] * v_scale + 0.5) / v_scale);
    END IF;
    IF v_name = 'clamp' THEN RETURN to_jsonb(LEAST(GREATEST(v_args[1], v_args[2]), v_args[3])); END IF;
    RAISE EXCEPTION 'formula_bad_function: %', v_name;

  ELSIF v_t = 'agg' THEN
    v_kind := p_expr ->> 'kind';
    IF p_expr ? 'rows' THEN
      SELECT COALESCE(jsonb_agg(x.row), '[]'::jsonb) INTO v_rows
        FROM (
          SELECT (SELECT COALESCE(jsonb_object_agg(c.key, public.formula_eval_node(c.value, p_ctx, p_scope, p_stack)), '{}'::jsonb)
                    FROM jsonb_each(rw.value) c) AS row
            FROM jsonb_array_elements(p_expr -> 'rows') WITH ORDINALITY rw(value, ord) ORDER BY rw.ord
        ) x;
    ELSE
      v_rows := p_ctx -> 'sets' -> (p_expr ->> 'over');
      IF v_rows IS NULL OR jsonb_typeof(v_rows) <> 'array' THEN
        RAISE EXCEPTION 'formula_missing_set: %', p_expr ->> 'over';
      END IF;
    END IF;
    FOR v_row IN SELECT * FROM jsonb_array_elements(v_rows) LOOP
      v_scope := p_scope || v_row;
      IF p_expr ? 'where' AND NOT public.formula_eval_cond(p_expr -> 'where', p_ctx, v_scope, p_stack) THEN CONTINUE; END IF;
      v_count := v_count + 1;
      IF v_kind = 'count' OR NOT (p_expr ? 'body') THEN CONTINUE; END IF;
      v_num := public.formula_to_num(public.formula_eval_node(p_expr -> 'body', p_ctx, v_scope, p_stack));
      IF v_num IS NOT NULL THEN
        v_n := v_n + 1;
        v_sum := v_sum + v_num;
        v_min := LEAST(v_min, v_num);
        v_max := GREATEST(v_max, v_num);
      END IF;
    END LOOP;
    IF v_kind = 'count' THEN RETURN to_jsonb(v_count); END IF;
    IF v_kind = 'sum' THEN RETURN to_jsonb(v_sum); END IF;
    IF v_n = 0 THEN RETURN 'null'::jsonb; END IF;
    IF v_kind = 'avg' THEN RETURN to_jsonb(v_sum / v_n); END IF;
    IF v_kind = 'min' THEN RETURN to_jsonb(v_min); END IF;
    RETURN to_jsonb(v_max);

  ELSIF v_t = 'cases' THEN
    FOR v_branch IN SELECT * FROM jsonb_array_elements(p_expr -> 'branches') LOOP
      IF public.formula_eval_cond(v_branch -> 'when', p_ctx, p_scope, p_stack) THEN
        RETURN public.formula_eval_node(v_branch -> 'then', p_ctx, p_scope, p_stack);
      END IF;
    END LOOP;
    RETURN public.formula_eval_node(p_expr -> 'otherwise', p_ctx, p_scope, p_stack);
  END IF;

  RAISE EXCEPTION 'formula_bad_node: %', v_t;
END;
$$;

CREATE OR REPLACE FUNCTION public.formula_eval(p_expr jsonb, p_ctx jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.formula_eval_node(p_expr, p_ctx, '{}'::jsonb, ARRAY[]::text[]);
$$;

-- 4. Điểm gọi từ engine: trả về kết quả mã sẵn có nếu công thức chưa bị thay ---------------------------
-- app.formula_strict = '1' (chỉ dùng khi kiểm thử) để lỗi biểu thức nổi lên thay vì quay về mã sẵn có.
CREATE OR REPLACE FUNCTION public.formula_apply(
  p_code text, p_native jsonb, p_vars jsonb DEFAULT '{}'::jsonb, p_refs jsonb DEFAULT '{}'::jsonb,
  p_sets jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_expr jsonb;
BEGIN
  SELECT expression INTO v_expr FROM public.formula_live WHERE formula_code = p_code;
  IF v_expr IS NULL THEN RETURN p_native; END IF;
  BEGIN
    RETURN public.formula_eval(v_expr, jsonb_build_object('vars', p_vars, 'refs', p_refs, 'sets', p_sets));
  EXCEPTION WHEN OTHERS THEN
    IF current_setting('app.formula_strict', true) = '1' THEN RAISE; END IF;
    RAISE WARNING 'formula_apply % lỗi, dùng kết quả sẵn có: %', p_code, SQLERRM;
    RETURN p_native;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.formula_apply_num(
  p_code text, p_native numeric, p_vars jsonb DEFAULT '{}'::jsonb, p_refs jsonb DEFAULT '{}'::jsonb,
  p_sets jsonb DEFAULT '{}'::jsonb
) RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_res jsonb;
BEGIN
  v_res := public.formula_apply(p_code, COALESCE(to_jsonb(p_native), 'null'::jsonb), p_vars, p_refs, p_sets);
  IF jsonb_typeof(v_res) = 'null' THEN RETURN NULL; END IF;
  IF jsonb_typeof(v_res) = 'number' THEN RETURN (v_res #>> '{}')::numeric; END IF;
  IF current_setting('app.formula_strict', true) = '1' THEN RAISE EXCEPTION 'formula_type_mismatch: %', p_code; END IF;
  RAISE WARNING 'formula_apply % trả kiểu không phải số, dùng kết quả sẵn có', p_code;
  RETURN p_native;
END;
$$;

-- Công thức trả nhãn chữ: p_map đổi nhãn trong công thức sang mã dùng trong dữ liệu
CREATE OR REPLACE FUNCTION public.formula_apply_label(
  p_code text, p_native text, p_map jsonb, p_vars jsonb DEFAULT '{}'::jsonb, p_refs jsonb DEFAULT '{}'::jsonb,
  p_sets jsonb DEFAULT '{}'::jsonb
) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_res jsonb;
  v_text text;
BEGIN
  v_res := public.formula_apply(p_code, COALESCE(to_jsonb(p_native), 'null'::jsonb), p_vars, p_refs, p_sets);
  IF jsonb_typeof(v_res) = 'string' THEN
    v_text := v_res #>> '{}';
    IF p_map ? v_text THEN RETURN p_map ->> v_text; END IF;
    IF v_text IS NOT DISTINCT FROM p_native THEN RETURN p_native; END IF;
  END IF;
  IF current_setting('app.formula_strict', true) = '1' THEN RAISE EXCEPTION 'formula_bad_label: %', p_code; END IF;
  RAISE WARNING 'formula_apply % trả nhãn không nhận ra, dùng kết quả sẵn có', p_code;
  RETURN p_native;
END;
$$;

CREATE OR REPLACE FUNCTION public.formula_is_live(p_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.formula_live WHERE formula_code = p_code);
$$;

-- 5. Cho giao diện: các công thức đang thay, kèm tham số và công thức con để tự tính --------------------
CREATE OR REPLACE FUNCTION public.get_formula_overrides()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'formulas', COALESCE((
      SELECT jsonb_object_agg(l.formula_code, jsonb_build_object(
        'expression', l.expression,
        'params', COALESCE((
          SELECT jsonb_object_agg(r.ref_code, public.formula_param_value(r.ref_code))
            FROM public.formula_expression_refs(l.expression) r
           WHERE r.ref_kind = 'param' AND public.formula_param_value(r.ref_code) IS NOT NULL), '{}'::jsonb)))
        FROM public.formula_live l), '{}'::jsonb),
    'active', CASE WHEN EXISTS (SELECT 1 FROM public.formula_live) THEN COALESCE((
      SELECT jsonb_object_agg(f.formula_code, v.expression)
        FROM public.formula_versions v JOIN public.formulas f ON f.id = v.formula_id
       WHERE v.status = 'active'), '{}'::jsonb) ELSE '{}'::jsonb END,
    'params', CASE WHEN EXISTS (SELECT 1 FROM public.formula_live) THEN COALESCE((
      SELECT jsonb_object_agg(s.symbol_code, p.param_value)
        FROM public.formula_symbols s
        JOIN public.operation_parameters p ON p.param_code = s.source_ref AND p.is_current
       WHERE s.source_kind = 'param'), '{}'::jsonb) ELSE '{}'::jsonb END);
$$;

-- 6. Quyền: chỉ các điểm gọi của engine, không mở cho API ---------------------------------------------
REVOKE ALL ON FUNCTION public.formula_sync_live(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.formula_version_sync_live() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.formula_param_value(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.formula_to_num(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.formula_eval_cond(jsonb, jsonb, jsonb, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.formula_eval_node(jsonb, jsonb, jsonb, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.formula_eval(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.formula_apply(text, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.formula_apply_num(text, numeric, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.formula_apply_label(text, text, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_formula_overrides() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.formula_is_live(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.formula_is_live(text) TO authenticated;
-- roadmap_status chạy với quyền người gọi nên cần gọi được các hàm áp dụng
GRANT EXECUTE ON FUNCTION public.formula_apply(text, jsonb, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.formula_apply_num(text, numeric, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.formula_apply_label(text, text, jsonb, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_formula_overrides() TO authenticated;

-- 7. Đồng bộ danh sách công thức đang thay với các phiên bản đã có ---------------------------------------
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT id FROM public.formulas LOOP PERFORM public.formula_sync_live(f.id); END LOOP;
END $$;
