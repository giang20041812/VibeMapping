-- Khung JD theo cấp của nghề: mỗi nghề có các bậc (L0 Thực tập sinh … L7 Lãnh đạo), mỗi bậc một khung
-- gồm thông tin chung và các dòng nội dung (nhiệm vụ, yêu cầu theo mức, thu nhập, biểu hiện năng lực, biến thể…).
-- Quản trị hệ thống soạn và công bố; học sinh, khách đọc khung đã công bố của nghề đã công bố.

-- 1. Khung của một bậc --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.career_level_frameworks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  career_id uuid NOT NULL REFERENCES public.careers(id) ON DELETE CASCADE,
  career_level smallint NOT NULL CHECK (career_level BETWEEN 0 AND 7),
  level_name text NOT NULL CHECK (length(trim(level_name)) > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  title_variants text,
  reports_to text,
  hiring_industries text,
  experience_text text,
  work_mode text,
  career_summary text,
  position_objectives text,
  required_level numeric(3, 2) CHECK (required_level BETWEEN 1 AND 5),
  jd_count integer NOT NULL DEFAULT 0 CHECK (jd_count >= 0),
  source_note text,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT career_level_frameworks_unique UNIQUE (career_id, career_level)
);
CREATE INDEX IF NOT EXISTS idx_career_level_frameworks_status ON public.career_level_frameworks(status);

-- 2. Dòng nội dung của khung --------------------------------------------------
-- section quyết định ý nghĩa các cột:
--   task                 group_label = nhóm nhiệm vụ, content = nhiệm vụ chính, detail = hoạt động thực tế
--   output               content = kết quả đầu ra
--   stakeholder          group_label = nhóm, content = đối tượng, detail = cách phối hợp
--   knowledge … special_requirement, benefit   content = yêu cầu / quyền lợi, tier = mức
--   salary               group_label = nhóm doanh nghiệp, salary_min/max = triệu đồng/tháng (gross),
--                        detail = thực nhận ước tính, content = ví dụ
--   competency           group_label = năng lực, content = mức yêu cầu, detail = biểu hiện cần thấy, note = dưới chuẩn
--   industry_variant, company_variant
--                        group_label = biến thể, content = kiến thức / đặc điểm, detail = công cụ, đầu ra, note = lưu ý
--   career_move          target_career_id, target_level = nghề, bậc có thể chuyển sang; content = tên hiển thị
--   pass_threshold, interview_question   chỉ quản trị đọc
CREATE TABLE IF NOT EXISTS public.career_level_framework_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  framework_id uuid NOT NULL REFERENCES public.career_level_frameworks(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (section IN (
    'task', 'output', 'stakeholder',
    'knowledge', 'professional_skill', 'soft_skill', 'tool', 'education', 'certificate',
    'experience', 'language', 'special_requirement',
    'benefit', 'salary', 'competency', 'industry_variant', 'company_variant', 'career_move',
    'pass_threshold', 'interview_question')),
  tier text CHECK (tier IN ('required', 'common', 'advantage')),
  group_label text,
  content text NOT NULL CHECK (length(trim(content)) > 0),
  detail text,
  note text,
  salary_min numeric(8, 2) CHECK (salary_min >= 0),
  salary_max numeric(8, 2) CHECK (salary_max >= 0),
  target_career_id uuid REFERENCES public.careers(id) ON DELETE SET NULL,
  target_level smallint CHECK (target_level BETWEEN 0 AND 7),
  jd_hits integer CHECK (jd_hits >= 0),
  jd_total integer CHECK (jd_total >= 0),
  is_estimate boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT career_level_framework_items_salary CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max),
  CONSTRAINT career_level_framework_items_hits CHECK (jd_hits IS NULL OR jd_total IS NULL OR jd_hits <= jd_total)
);
CREATE INDEX IF NOT EXISTS idx_career_level_framework_items_framework ON public.career_level_framework_items(framework_id, section, sort_order);
CREATE INDEX IF NOT EXISTS idx_career_level_framework_items_target ON public.career_level_framework_items(target_career_id);

-- 3. updated_at + RLS ---------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['career_level_frameworks', 'career_level_framework_items']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%1$s_updated_at ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER set_%1$s_updated_at BEFORE UPDATE ON public.%1$s
                    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin write %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Admin write %1$s" ON public.%1$s FOR ALL TO authenticated
                    USING (public.is_system_admin()) WITH CHECK (public.is_system_admin())', t);
  END LOOP;
END $$;

-- Khung công khai: khung đã công bố của nghề đã công bố
CREATE OR REPLACE FUNCTION public.is_level_framework_public(p_framework_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.career_level_frameworks f
      JOIN public.careers c ON c.id = f.career_id
     WHERE f.id = p_framework_id AND f.status = 'published' AND c.status = 'published'
  );
$$;
REVOKE ALL ON FUNCTION public.is_level_framework_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_level_framework_public(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Public read career_level_frameworks" ON public.career_level_frameworks;
CREATE POLICY "Public read career_level_frameworks" ON public.career_level_frameworks
  FOR SELECT TO anon, authenticated USING (public.is_level_framework_public(id));

DROP POLICY IF EXISTS "Public read career_level_framework_items" ON public.career_level_framework_items;
CREATE POLICY "Public read career_level_framework_items" ON public.career_level_framework_items
  FOR SELECT TO anon, authenticated USING (
    section NOT IN ('pass_threshold', 'interview_question') AND public.is_level_framework_public(framework_id)
  );

-- 4. RPC quản trị -------------------------------------------------------------

-- Thay toàn bộ dòng nội dung của một khung (dùng chung cho lưu và sao chép)
CREATE OR REPLACE FUNCTION public.replace_level_framework_items(p_framework_id uuid, p_items jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'invalid_items'; END IF;
  DELETE FROM public.career_level_framework_items WHERE framework_id = p_framework_id;
  INSERT INTO public.career_level_framework_items (
    framework_id, section, tier, group_label, content, detail, note, salary_min, salary_max,
    target_career_id, target_level, jd_hits, jd_total, is_estimate, sort_order)
  SELECT p_framework_id,
         x ->> 'section',
         NULLIF(x ->> 'tier', ''),
         NULLIF(trim(x ->> 'group_label'), ''),
         trim(COALESCE(x ->> 'content', '')),
         NULLIF(trim(x ->> 'detail'), ''),
         NULLIF(trim(x ->> 'note'), ''),
         NULLIF(x ->> 'salary_min', '')::numeric,
         NULLIF(x ->> 'salary_max', '')::numeric,
         NULLIF(x ->> 'target_career_id', '')::uuid,
         NULLIF(x ->> 'target_level', '')::smallint,
         NULLIF(x ->> 'jd_hits', '')::integer,
         NULLIF(x ->> 'jd_total', '')::integer,
         COALESCE((x ->> 'is_estimate')::boolean, false),
         COALESCE(NULLIF(x ->> 'sort_order', '')::integer, (ord - 1)::integer)
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(x, ord);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
EXCEPTION
  WHEN check_violation THEN RAISE EXCEPTION 'invalid_item';
  WHEN foreign_key_violation THEN RAISE EXCEPTION 'target_career_not_found';
  WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'invalid_item';
END;
$$;

-- Tạo (p_framework_id NULL, cần p_career_id) hoặc sửa khung. Khung mới ở Nháp.
-- Có khóa "items" thì thay toàn bộ dòng nội dung; không có thì giữ nguyên.
CREATE OR REPLACE FUNCTION public.admin_save_level_framework(p_framework_id uuid, p_career_id uuid, p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid := p_framework_id;
  v_level smallint;
  v_name text := NULLIF(trim(p_payload ->> 'level_name'), '');
  v_required numeric;
  v_items integer;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  BEGIN
    v_level := NULLIF(p_payload ->> 'career_level', '')::smallint;
    v_required := NULLIF(p_payload ->> 'required_level', '')::numeric;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'invalid_framework';
  END;
  IF v_level IS NOT NULL AND (v_level < 0 OR v_level > 7) THEN RAISE EXCEPTION 'invalid_level'; END IF;
  IF v_required IS NOT NULL AND (v_required < 1 OR v_required > 5) THEN RAISE EXCEPTION 'invalid_required_level'; END IF;

  IF v_id IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.careers WHERE id = p_career_id) THEN RAISE EXCEPTION 'career_not_found'; END IF;
    IF v_level IS NULL OR v_name IS NULL THEN RAISE EXCEPTION 'invalid_framework'; END IF;
    IF EXISTS (SELECT 1 FROM public.career_level_frameworks WHERE career_id = p_career_id AND career_level = v_level) THEN
      RAISE EXCEPTION 'level_exists';
    END IF;
    INSERT INTO public.career_level_frameworks (career_id, career_level, level_name, created_by, updated_by)
    VALUES (p_career_id, v_level, v_name, auth.uid(), auth.uid()) RETURNING id INTO v_id;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.career_level_frameworks WHERE id = v_id) THEN RAISE EXCEPTION 'framework_not_found'; END IF;
    IF p_payload ? 'level_name' AND v_name IS NULL THEN RAISE EXCEPTION 'invalid_framework'; END IF;
    IF v_level IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.career_level_frameworks o
        JOIN public.career_level_frameworks f ON f.id = v_id
       WHERE o.career_id = f.career_id AND o.career_level = v_level AND o.id <> v_id) THEN
      RAISE EXCEPTION 'level_exists';
    END IF;
  END IF;

  UPDATE public.career_level_frameworks SET
    career_level = COALESCE(v_level, career_level),
    level_name = COALESCE(v_name, level_name),
    title_variants = CASE WHEN p_payload ? 'title_variants' THEN NULLIF(trim(p_payload ->> 'title_variants'), '') ELSE title_variants END,
    reports_to = CASE WHEN p_payload ? 'reports_to' THEN NULLIF(trim(p_payload ->> 'reports_to'), '') ELSE reports_to END,
    hiring_industries = CASE WHEN p_payload ? 'hiring_industries' THEN NULLIF(trim(p_payload ->> 'hiring_industries'), '') ELSE hiring_industries END,
    experience_text = CASE WHEN p_payload ? 'experience_text' THEN NULLIF(trim(p_payload ->> 'experience_text'), '') ELSE experience_text END,
    work_mode = CASE WHEN p_payload ? 'work_mode' THEN NULLIF(trim(p_payload ->> 'work_mode'), '') ELSE work_mode END,
    career_summary = CASE WHEN p_payload ? 'career_summary' THEN NULLIF(trim(p_payload ->> 'career_summary'), '') ELSE career_summary END,
    position_objectives = CASE WHEN p_payload ? 'position_objectives' THEN NULLIF(trim(p_payload ->> 'position_objectives'), '') ELSE position_objectives END,
    required_level = CASE WHEN p_payload ? 'required_level' THEN v_required ELSE required_level END,
    jd_count = CASE WHEN p_payload ? 'jd_count' THEN GREATEST(COALESCE(NULLIF(p_payload ->> 'jd_count', '')::integer, 0), 0) ELSE jd_count END,
    source_note = CASE WHEN p_payload ? 'source_note' THEN NULLIF(trim(p_payload ->> 'source_note'), '') ELSE source_note END,
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = v_id;

  IF p_payload ? 'items' THEN
    v_items := public.replace_level_framework_items(v_id, p_payload -> 'items');
  END IF;

  PERFORM public.write_audit_log(auth.uid(), NULL,
    CASE WHEN p_framework_id IS NULL THEN 'create_level_framework' ELSE 'update_level_framework' END,
    'career_level_frameworks', v_id,
    jsonb_build_object('fields', (SELECT jsonb_agg(k) FROM jsonb_object_keys(p_payload) k WHERE k <> 'items'), 'items', v_items));
  RETURN v_id;
END;
$$;

-- Công bố cần ít nhất một nhiệm vụ; về Nháp thì ẩn khỏi học sinh ngay.
CREATE OR REPLACE FUNCTION public.admin_set_level_framework_status(p_framework_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_status NOT IN ('draft', 'published') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.career_level_frameworks WHERE id = p_framework_id) THEN RAISE EXCEPTION 'framework_not_found'; END IF;
  IF p_status = 'published' AND NOT EXISTS (
    SELECT 1 FROM public.career_level_framework_items WHERE framework_id = p_framework_id AND section = 'task') THEN
    RAISE EXCEPTION 'framework_incomplete';
  END IF;
  UPDATE public.career_level_frameworks SET
    status = p_status,
    published_at = CASE WHEN p_status = 'published' THEN now() ELSE published_at END,
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_framework_id;
  PERFORM public.write_audit_log(auth.uid(), NULL, 'set_level_framework_status', 'career_level_frameworks', p_framework_id,
    jsonb_build_object('status', p_status));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_level_framework(p_framework_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.career_level_frameworks;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.career_level_frameworks WHERE id = p_framework_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'framework_not_found'; END IF;
  PERFORM public.write_audit_log(auth.uid(), NULL, 'delete_level_framework', 'career_level_frameworks', p_framework_id,
    jsonb_build_object('career_id', v_row.career_id, 'career_level', v_row.career_level, 'level_name', v_row.level_name));
END;
$$;

-- Sao chép một khung (cùng nghề hoặc nghề khác) sang bậc đích thành khung Nháp mới.
-- Số tin căn cứ thuộc nghề nguồn nên bị xóa; mức của từng dòng giữ nguyên để quản trị sửa tiếp.
CREATE OR REPLACE FUNCTION public.admin_copy_level_framework(
  p_source_id uuid, p_target_career_id uuid, p_target_level smallint, p_level_name text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_src public.career_level_frameworks;
  v_id uuid;
  v_source_name text;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_src FROM public.career_level_frameworks WHERE id = p_source_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'framework_not_found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.careers WHERE id = p_target_career_id) THEN RAISE EXCEPTION 'career_not_found'; END IF;
  IF p_target_level IS NULL OR p_target_level < 0 OR p_target_level > 7 THEN RAISE EXCEPTION 'invalid_level'; END IF;
  IF EXISTS (SELECT 1 FROM public.career_level_frameworks WHERE career_id = p_target_career_id AND career_level = p_target_level) THEN
    RAISE EXCEPTION 'level_exists';
  END IF;
  SELECT career_name INTO v_source_name FROM public.careers WHERE id = v_src.career_id;

  INSERT INTO public.career_level_frameworks (
    career_id, career_level, level_name, title_variants, reports_to, hiring_industries, experience_text, work_mode,
    career_summary, position_objectives, required_level, jd_count, source_note, created_by, updated_by)
  VALUES (
    p_target_career_id, p_target_level, COALESCE(NULLIF(trim(p_level_name), ''), v_src.level_name),
    v_src.title_variants, v_src.reports_to, v_src.hiring_industries, v_src.experience_text, v_src.work_mode,
    v_src.career_summary, v_src.position_objectives, v_src.required_level, 0,
    format('Sao chép từ %s – %s', v_source_name, v_src.level_name), auth.uid(), auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.career_level_framework_items (
    framework_id, section, tier, group_label, content, detail, note, salary_min, salary_max,
    target_career_id, target_level, jd_hits, jd_total, is_estimate, sort_order)
  SELECT v_id, section, tier, group_label, content, detail, note, salary_min, salary_max,
         target_career_id, target_level, NULL, NULL, is_estimate, sort_order
    FROM public.career_level_framework_items WHERE framework_id = p_source_id;

  PERFORM public.write_audit_log(auth.uid(), NULL, 'copy_level_framework', 'career_level_frameworks', v_id,
    jsonb_build_object('source_id', p_source_id));
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_level_framework_items(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_save_level_framework(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_level_framework_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_level_framework(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_copy_level_framework(uuid, uuid, smallint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_level_framework(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_level_framework_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_level_framework(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_copy_level_framework(uuid, uuid, smallint, text) TO authenticated;
