-- Thư viện công thức cho quản trị hệ thống: mỗi công thức là một cây biểu thức (jsonb) có phiên bản,
-- ký hiệu, liên kết phụ thuộc giữa các công thức và ca thử. Engine tính điểm hiện hành không đọc từ đây.

-- 1. Nhóm công thức ---------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.formula_groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_code text NOT NULL UNIQUE,
  group_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Ký hiệu: dữ liệu đầu vào, tham số vận hành hoặc kết quả của một công thức ---------------------
CREATE TABLE IF NOT EXISTS public.formula_symbols (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol_code text NOT NULL UNIQUE,
  display_latex text NOT NULL,
  symbol_name text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('input', 'param', 'formula')),
  source_ref text,
  unit text,
  value_min numeric,
  value_max numeric,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT formula_symbols_ref_required CHECK (source_kind = 'input' OR source_ref IS NOT NULL),
  CONSTRAINT formula_symbols_range CHECK (value_min IS NULL OR value_max IS NULL OR value_min <= value_max)
);

-- 3. Công thức ---------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.formulas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  formula_code text NOT NULL UNIQUE,
  formula_name text NOT NULL,
  group_id uuid NOT NULL REFERENCES public.formula_groups(id) ON DELETE RESTRICT,
  output_symbol text NOT NULL REFERENCES public.formula_symbols(symbol_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  output_unit text,
  verification_level text NOT NULL DEFAULT 'approved'
    CHECK (verification_level IN ('approved', 'demo', 'pending_ba', 'blocked')),
  spec_ref text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_formulas_group ON public.formulas(group_id, sort_order);

-- 4. Phiên bản công thức: chỉ thêm bản mới, bản đã hiệu lực không sửa nội dung ----------------------
CREATE TABLE IF NOT EXISTS public.formula_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  formula_id uuid NOT NULL REFERENCES public.formulas(id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  expression jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  note text,
  changed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  effective_from timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT formula_versions_unique UNIQUE (formula_id, version_no),
  CONSTRAINT formula_versions_expression_object CHECK (jsonb_typeof(expression) = 'object')
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_formula_versions_active
  ON public.formula_versions(formula_id) WHERE status = 'active';

-- 5. Liên kết phụ thuộc (do trigger tự tính từ cây biểu thức) -----------------------------------------
CREATE TABLE IF NOT EXISTS public.formula_dependencies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  version_id uuid NOT NULL REFERENCES public.formula_versions(id) ON DELETE CASCADE,
  formula_id uuid NOT NULL REFERENCES public.formulas(id) ON DELETE CASCADE,
  depends_on_formula_id uuid REFERENCES public.formulas(id) ON DELETE CASCADE,
  depends_on_param_code text,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT formula_dependencies_one_target CHECK (
    (depends_on_formula_id IS NOT NULL AND depends_on_param_code IS NULL)
    OR (depends_on_formula_id IS NULL AND depends_on_param_code IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_formula_dependencies_formula
  ON public.formula_dependencies(version_id, depends_on_formula_id) WHERE depends_on_formula_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_formula_dependencies_param
  ON public.formula_dependencies(version_id, depends_on_param_code) WHERE depends_on_param_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_formula_dependencies_target ON public.formula_dependencies(depends_on_formula_id);

-- 6. Ca thử -------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.formula_test_cases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  formula_id uuid NOT NULL REFERENCES public.formulas(id) ON DELETE CASCADE,
  case_name text NOT NULL,
  inputs jsonb NOT NULL,
  expected jsonb NOT NULL,
  tolerance numeric NOT NULL DEFAULT 0.0001 CHECK (tolerance >= 0),
  engine_fn text,
  engine_args jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT formula_test_cases_unique UNIQUE (formula_id, case_name)
);

-- 7. Hàm rút ký hiệu, tham số, công thức được dùng trong một cây biểu thức -------------------------------
-- Cây biểu thức có các nút: {"t":"sym","id":...}, {"t":"param","code":...}, {"t":"ref","formula":...}
CREATE OR REPLACE FUNCTION public.formula_expression_refs(p_expression jsonb)
RETURNS TABLE (ref_kind text, ref_code text)
LANGUAGE sql IMMUTABLE AS $$
  SELECT DISTINCT 'formula'::text, trim(both '"' FROM x::text)
    FROM jsonb_path_query(p_expression, 'strict $.** ? (@.t == "ref").formula') AS x
  UNION
  SELECT DISTINCT 'param'::text, trim(both '"' FROM x::text)
    FROM jsonb_path_query(p_expression, 'strict $.** ? (@.t == "param").code') AS x
  UNION
  SELECT DISTINCT 'symbol'::text, trim(both '"' FROM x::text)
    FROM jsonb_path_query(p_expression, 'strict $.** ? (@.t == "sym").id') AS x;
$$;

-- 8. Trigger: kiểm tra tham chiếu, chặn vòng lặp, giữ một bản hiệu lực, tự ghi liên kết phụ thuộc -----
CREATE OR REPLACE FUNCTION public.formula_version_before_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_next integer;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.version_no IS NULL THEN
    SELECT COALESCE(max(version_no), 0) + 1 INTO v_next FROM public.formula_versions WHERE formula_id = NEW.formula_id;
    NEW.version_no := v_next;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'draft' AND NEW.expression IS DISTINCT FROM OLD.expression THEN
      RAISE EXCEPTION 'formula_version_immutable';
    END IF;
    IF OLD.status = 'retired' AND NEW.status <> 'retired' THEN
      RAISE EXCEPTION 'formula_version_retired';
    END IF;
    IF NEW.formula_id <> OLD.formula_id THEN
      RAISE EXCEPTION 'formula_version_immutable';
    END IF;
  END IF;
  IF NEW.status = 'active' THEN
    NEW.effective_from := COALESCE(NEW.effective_from, now());
    UPDATE public.formula_versions
       SET status = 'retired', updated_at = now()
     WHERE formula_id = NEW.formula_id AND status = 'active' AND id <> NEW.id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.formula_version_after_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_missing text;
  v_cycle boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.expression IS NOT DISTINCT FROM OLD.expression THEN
    RETURN NEW;
  END IF;

  SELECT r.ref_code INTO v_missing
    FROM public.formula_expression_refs(NEW.expression) r
   WHERE r.ref_kind = 'formula' AND NOT EXISTS (SELECT 1 FROM public.formulas f WHERE f.formula_code = r.ref_code)
   LIMIT 1;
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'formula_ref_not_found: %', v_missing; END IF;

  SELECT r.ref_code INTO v_missing
    FROM public.formula_expression_refs(NEW.expression) r
   WHERE r.ref_kind = 'param' AND NOT EXISTS (SELECT 1 FROM public.operation_parameters p WHERE p.param_code = r.ref_code)
   LIMIT 1;
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'formula_param_not_found: %', v_missing; END IF;

  SELECT r.ref_code INTO v_missing
    FROM public.formula_expression_refs(NEW.expression) r
   WHERE r.ref_kind = 'symbol' AND NOT EXISTS (SELECT 1 FROM public.formula_symbols s WHERE s.symbol_code = r.ref_code)
   LIMIT 1;
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'formula_symbol_not_found: %', v_missing; END IF;

  -- Vòng lặp: đi theo các công thức được dùng, lấy bản hiệu lực (hoặc bản nháp mới nhất) của từng công thức,
  -- riêng công thức đang ghi thì dùng chính cây biểu thức vừa lưu.
  WITH RECURSIVE current_version AS (
    SELECT DISTINCT ON (v.formula_id) v.formula_id, v.expression
      FROM public.formula_versions v
     WHERE v.status IN ('active', 'draft') AND v.id <> NEW.id AND v.formula_id <> NEW.formula_id
     ORDER BY v.formula_id, (v.status = 'active') DESC, v.version_no DESC
  ), edges AS (
    SELECT cv.formula_id AS from_id, f.id AS to_id
      FROM current_version cv
      CROSS JOIN LATERAL public.formula_expression_refs(cv.expression) r
      JOIN public.formulas f ON f.formula_code = r.ref_code
     WHERE r.ref_kind = 'formula'
    UNION
    SELECT NEW.formula_id, f.id
      FROM public.formula_expression_refs(NEW.expression) r
      JOIN public.formulas f ON f.formula_code = r.ref_code
     WHERE r.ref_kind = 'formula'
  ), walk(node, path) AS (
    SELECT e.to_id, ARRAY[NEW.formula_id, e.to_id] FROM edges e WHERE e.from_id = NEW.formula_id
    UNION ALL
    SELECT e.to_id, w.path || e.to_id
      FROM walk w JOIN edges e ON e.from_id = w.node
     WHERE e.to_id <> ALL (w.path[2:]) AND w.node <> NEW.formula_id
  )
  SELECT EXISTS (SELECT 1 FROM walk WHERE node = NEW.formula_id) INTO v_cycle;
  IF v_cycle THEN RAISE EXCEPTION 'formula_cycle'; END IF;

  DELETE FROM public.formula_dependencies WHERE version_id = NEW.id;
  INSERT INTO public.formula_dependencies (version_id, formula_id, depends_on_formula_id)
  SELECT NEW.id, NEW.formula_id, f.id
    FROM public.formula_expression_refs(NEW.expression) r
    JOIN public.formulas f ON f.formula_code = r.ref_code
   WHERE r.ref_kind = 'formula';
  INSERT INTO public.formula_dependencies (version_id, formula_id, depends_on_param_code)
  SELECT NEW.id, NEW.formula_id, r.ref_code
    FROM public.formula_expression_refs(NEW.expression) r
   WHERE r.ref_kind = 'param';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_formula_version_before_write ON public.formula_versions;
CREATE TRIGGER trg_formula_version_before_write
  BEFORE INSERT OR UPDATE ON public.formula_versions
  FOR EACH ROW EXECUTE FUNCTION public.formula_version_before_write();

DROP TRIGGER IF EXISTS trg_formula_version_after_write ON public.formula_versions;
CREATE TRIGGER trg_formula_version_after_write
  AFTER INSERT OR UPDATE ON public.formula_versions
  FOR EACH ROW EXECUTE FUNCTION public.formula_version_after_write();

-- Hàm hỗ trợ và hàm trigger không cho gọi trực tiếp qua API
REVOKE ALL ON FUNCTION public.formula_expression_refs(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.formula_version_before_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.formula_version_after_write() FROM PUBLIC, anon, authenticated;

-- 9. RLS: chỉ quản trị hệ thống đọc và ghi ----------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['formula_groups', 'formula_symbols', 'formulas', 'formula_versions',
                           'formula_dependencies', 'formula_test_cases']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin all %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Admin all %1$s" ON public.%1$s FOR ALL TO authenticated
                    USING (public.is_system_admin()) WITH CHECK (public.is_system_admin())', t);
  END LOOP;
END $$;
