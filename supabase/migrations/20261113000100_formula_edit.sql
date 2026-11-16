-- Chỉnh sửa công thức: ghi nhật ký mọi thay đổi và giữ lại lịch sử phiên bản.

-- 1. Nhật ký thay đổi công thức và phiên bản (dùng hàm ghi nhật ký chung của khu quản trị) -------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['formulas', 'formula_versions']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s
                    FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change()', t);
  END LOOP;
END $$;

-- 2. Chỉ xóa được bản nháp; bản đã hiệu lực hoặc đã thay là lịch sử, giữ nguyên -----------------------
CREATE OR REPLACE FUNCTION public.formula_version_before_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'formula_version_not_deletable';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_formula_version_before_delete ON public.formula_versions;
CREATE TRIGGER trg_formula_version_before_delete
  BEFORE DELETE ON public.formula_versions
  FOR EACH ROW EXECUTE FUNCTION public.formula_version_before_delete();

REVOKE ALL ON FUNCTION public.formula_version_before_delete() FROM PUBLIC, anon, authenticated;

-- 3. Mỗi công thức chỉ có một bản nháp đang soạn --------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_formula_versions_draft
  ON public.formula_versions(formula_id) WHERE status = 'draft';

-- 4. Số phiên bản tự đếm khi thêm: không cần gửi từ giao diện, hai người cùng lưu không bị đếm trùng -------
ALTER TABLE public.formula_versions ALTER COLUMN version_no SET DEFAULT 0;

CREATE OR REPLACE FUNCTION public.formula_version_before_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_next integer;
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.version_no IS NULL OR NEW.version_no = 0) THEN
    -- Khóa theo công thức để hai lần lưu cùng lúc không nhận cùng số phiên bản
    PERFORM pg_advisory_xact_lock(hashtext(NEW.formula_id::text));
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

REVOKE ALL ON FUNCTION public.formula_version_before_write() FROM PUBLIC, anon, authenticated;
