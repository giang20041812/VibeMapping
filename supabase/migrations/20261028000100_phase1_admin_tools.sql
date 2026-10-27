-- ====================================================================
-- Phase 1 / Migration 12: Công cụ quản trị hệ thống
-- Nhật ký thay đổi cấu hình, gán câu hỏi vào gói theo lô, kiểm tra tham số vận hành
-- ====================================================================

-- 1. Nhật ký: ghi lại mọi thay đổi cấu hình do quản trị thực hiện ---------------------
-- Bỏ qua khi không có người đăng nhập (script nhập dữ liệu dùng service role) để không tràn nhật ký.
CREATE OR REPLACE FUNCTION public.audit_admin_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_diff jsonb;
  v_details jsonb;
  v_row jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(o.key, jsonb_build_object('old', o.value, 'new', n.value))
      INTO v_diff
      FROM jsonb_each(to_jsonb(OLD)) o
      JOIN jsonb_each(to_jsonb(NEW)) n USING (key)
     WHERE o.value IS DISTINCT FROM n.value
       AND o.key NOT IN ('updated_at', 'is_current');
    IF v_diff IS NULL THEN
      RETURN NEW;
    END IF;
    v_details := v_diff;
  ELSE
    v_row := to_jsonb(COALESCE(NEW, OLD)) - 'created_at' - 'updated_at';
    v_details := v_row;
  END IF;

  PERFORM public.write_audit_log(
    auth.uid(), NULL,
    lower(TG_OP) || ':' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    (to_jsonb(COALESCE(NEW, OLD)) ->> 'id')::uuid,
    v_details
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['criteria_groups','criteria','criteria_rater_visibility','questions','operation_parameters']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s
                    FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change()', t);
  END LOOP;
END $$;

-- 2. Gán câu hỏi vào gói theo lô (một dòng nhật ký cho cả lô) --------------------------
CREATE OR REPLACE FUNCTION public.set_package_assignments(
  p_question_ids uuid[], p_package_size smallint, p_assigned boolean
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_changed integer;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống được gán câu hỏi vào gói';
  END IF;
  IF p_package_size NOT IN (35, 50, 75) THEN
    RAISE EXCEPTION 'Gói không hợp lệ: %', p_package_size;
  END IF;
  IF p_question_ids IS NULL OR array_length(p_question_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  IF p_assigned THEN
    INSERT INTO public.question_package_assignments (question_id, package_size)
    SELECT q.id, p_package_size
      FROM public.questions q
     WHERE q.id = ANY (p_question_ids) AND q.rater_group = 'self'
    ON CONFLICT (question_id, package_size) DO NOTHING;
  ELSE
    DELETE FROM public.question_package_assignments
     WHERE question_id = ANY (p_question_ids) AND package_size = p_package_size;
  END IF;
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  IF v_changed > 0 THEN
    PERFORM public.write_audit_log(
      auth.uid(), NULL, 'set_package_assignments', 'question_package_assignments', NULL,
      jsonb_build_object('package_size', p_package_size, 'assigned', p_assigned,
                         'question_count', v_changed, 'question_ids', to_jsonb(p_question_ids))
    );
  END IF;
  RETURN v_changed;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_package_assignments(uuid[], smallint, boolean) TO authenticated;

-- 3. Kiểm tra tham số vận hành trước khi lưu ---------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_operation_parameter()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_leaf record;
BEGIN
  IF NEW.param_code = 'self_weight' THEN
    IF jsonb_typeof(NEW.param_value) <> 'number'
       OR (NEW.param_value #>> '{}')::numeric < 0 OR (NEW.param_value #>> '{}')::numeric > 1 THEN
      RAISE EXCEPTION 'self_weight phải nằm trong khoảng 0–1';
    END IF;
  ELSIF NEW.param_code = 'understanding_conversion' THEN
    FOR v_leaf IN
      SELECT g.key AS grp, l.key AS lvl, l.value AS val
        FROM jsonb_each(NEW.param_value) g, jsonb_each(g.value) l
    LOOP
      IF jsonb_typeof(v_leaf.val) <> 'number' OR (v_leaf.val #>> '{}')::numeric <= 0 THEN
        RAISE EXCEPTION 'understanding_conversion.%.% phải là số lớn hơn 0', v_leaf.grp, v_leaf.lvl;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validate_operation_parameter ON public.operation_parameters;
CREATE TRIGGER trg_validate_operation_parameter
  BEFORE INSERT OR UPDATE ON public.operation_parameters
  FOR EACH ROW EXECUTE FUNCTION public.validate_operation_parameter();

-- 4. Tra cứu nhật ký theo người thực hiện: chỉ quản trị hệ thống đọc (đã có policy) ----
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action, created_at DESC);
