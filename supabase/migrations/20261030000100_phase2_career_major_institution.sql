-- ====================================================================
-- Phase 2 / Migration 1: Dữ liệu Nghề – Ngành – Trường
-- ENT-04.1 Career_Field | ENT-04.2 Career | ENT-04.3 Career_Requirement
-- ENT-04.4 Major | ENT-04.5 Career_Major_Link | ENT-04.7 Institution
-- ENT-04.8 Training_Program
-- Thêm: career_job_descriptions (JD gốc làm căn cứ tính ma trận nghề),
--       career_holland_profiles (nhóm G6 của nghề), career_matrix_versions (NGHE-X.Y).
-- Chưa làm: Admission_Data (file research chưa có điểm chuẩn / chỉ tiêu), User_Saved_Career (thuộc tính năng).
-- ====================================================================

-- 1. career_matrix_versions: phiên bản ma trận nghề (NGHE-X.Y) ------------
CREATE TABLE IF NOT EXISTS public.career_matrix_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  version_code text NOT NULL UNIQUE,
  is_current boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_career_matrix_versions_current
  ON public.career_matrix_versions(is_current) WHERE is_current;

INSERT INTO public.career_matrix_versions (version_code, is_current, note)
VALUES ('NGHE-1.0', true, 'Ma trận nghề dựng từ JD của team BA')
ON CONFLICT (version_code) DO NOTHING;

-- 2. career_fields: cây lĩnh vực (LV1–LV6) → nhóm nghề -------------------
CREATE TABLE IF NOT EXISTS public.career_fields (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  field_code text NOT NULL UNIQUE,              -- LV1..LV6 | LV1/cong-nghe-thong-tin
  parent_field_id uuid REFERENCES public.career_fields(id) ON DELETE RESTRICT,
  field_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_career_fields_parent ON public.career_fields(parent_field_id);

-- 3. careers: chức danh nghề nghiệp ---------------------------------------
CREATE TABLE IF NOT EXISTS public.careers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  career_code text NOT NULL UNIQUE,             -- G1-05 hoặc G1-02:ky-su-dien khi mã nguồn gom nhiều chức danh
  career_field_id uuid NOT NULL REFERENCES public.career_fields(id) ON DELETE RESTRICT,
  career_name text NOT NULL,
  source_group_id text NOT NULL,                -- cột "Group ID" của file nguồn
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'hidden')),
  holland_top3 text CHECK (holland_top3 ~ '^[RIASEC]{1,3}$'),
  qualifying_jd_count integer NOT NULL DEFAULT 0,   -- số JD mức L1/L2 có Required Level quy đổi được
  is_standard_complete boolean NOT NULL DEFAULT false, -- đủ G1–G5, G7 và Holland
  data_checked_at date,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_careers_field ON public.careers(career_field_id);
CREATE INDEX IF NOT EXISTS idx_careers_status ON public.careers(status);

-- 4. career_job_descriptions: JD gốc ---------------------------------------
CREATE TABLE IF NOT EXISTS public.career_job_descriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  career_id uuid NOT NULL REFERENCES public.careers(id) ON DELETE CASCADE,
  source_id integer NOT NULL UNIQUE,            -- cột "ID" của file nguồn
  jd_code text,
  company_name text,
  job_title text,
  sub_branch text,
  company_industry text,
  work_location text,
  work_mode text,
  jd_url text,
  career_level_raw text,
  career_level smallint CHECK (career_level BETWEEN 0 AND 7),   -- L0..L7
  required_level_raw text,
  required_level numeric(3, 2) CHECK (required_level BETWEEN 1 AND 5),
  career_summary text,
  position_objective text,
  main_tasks text,
  daily_activities text,
  work_outputs text,
  key_stakeholders text,
  required_knowledge text,
  professional_skills text,
  soft_skills text,
  tools_technologies text,
  education_requirement text,
  certifications text,
  experience_requirement text,
  language_requirement text,
  special_requirements text,
  career_path text,
  work_environment text,
  benefits text,
  salary_reference text,
  behavior_evidence text,
  data_source text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_career_job_descriptions_career ON public.career_job_descriptions(career_id);

-- Tiêu chí (Dimension) mà từng JD được gắn vào, kèm căn cứ chọn
CREATE TABLE IF NOT EXISTS public.career_job_description_criteria (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_description_id uuid NOT NULL REFERENCES public.career_job_descriptions(id) ON DELETE CASCADE,
  criteria_id uuid NOT NULL REFERENCES public.criteria(id) ON DELETE RESTRICT,
  selection_basis text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT career_job_description_criteria_unique UNIQUE (job_description_id, criteria_id)
);
CREATE INDEX IF NOT EXISTS idx_career_jd_criteria_criteria ON public.career_job_description_criteria(criteria_id);

-- 5. career_requirements: ma trận yêu cầu G1–G5, G7 ------------------------
CREATE TABLE IF NOT EXISTS public.career_requirements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  career_id uuid NOT NULL REFERENCES public.careers(id) ON DELETE CASCADE,
  criteria_id uuid NOT NULL REFERENCES public.criteria(id) ON DELETE RESTRICT,
  matrix_version_id uuid NOT NULL REFERENCES public.career_matrix_versions(id) ON DELETE RESTRICT,
  required_score numeric(3, 2) NOT NULL CHECK (required_score BETWEEN 1 AND 5),   -- Req(d,c)
  career_weight numeric(6, 5) NOT NULL CHECK (career_weight BETWEEN 0 AND 1),     -- CW(d,c), chuẩn hóa trong G1–G5 và trong G7
  jd_count integer NOT NULL DEFAULT 0,
  verification_level text NOT NULL DEFAULT 'per_jd_data'
    CHECK (verification_level IN ('demo', 'per_document', 'per_jd_data', 'expert_reviewed', 'calibrated')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT career_requirements_unique UNIQUE (career_id, criteria_id, matrix_version_id)
);
CREATE INDEX IF NOT EXISTS idx_career_requirements_criteria ON public.career_requirements(criteria_id);

-- 6. career_holland_profiles: hồ sơ sáu chiều RIASEC của nghề (nhóm G6) ----
CREATE TABLE IF NOT EXISTS public.career_holland_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  career_id uuid NOT NULL REFERENCES public.careers(id) ON DELETE CASCADE,
  holland_code char(1) NOT NULL REFERENCES public.holland_codes(holland_code),
  strength numeric(4, 3) NOT NULL CHECK (strength BETWEEN 0 AND 1),
  jd_count integer NOT NULL DEFAULT 0,
  verification_level text NOT NULL DEFAULT 'per_jd_data'
    CHECK (verification_level IN ('demo', 'per_document', 'per_jd_data', 'expert_reviewed', 'calibrated')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT career_holland_profiles_unique UNIQUE (career_id, holland_code)
);

-- 7. majors: ngành đào tạo --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.majors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  major_name text NOT NULL,
  normalized_name text NOT NULL UNIQUE,         -- chữ thường, bỏ dấu: khóa gộp các cách viết khác nhau
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 8. career_major_links: nghề ↔ ngành ---------------------------------------
CREATE TABLE IF NOT EXISTS public.career_major_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  career_id uuid NOT NULL REFERENCES public.careers(id) ON DELETE CASCADE,
  major_id uuid NOT NULL REFERENCES public.majors(id) ON DELETE CASCADE,
  link_level text NOT NULL DEFAULT 'direct' CHECK (link_level IN ('direct', 'indirect')),
  link_source text NOT NULL DEFAULT 'jd_education_text' CHECK (link_source IN ('jd_education_text', 'manual')),
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT career_major_links_unique UNIQUE (career_id, major_id)
);
CREATE INDEX IF NOT EXISTS idx_career_major_links_major ON public.career_major_links(major_id);

-- 9. institutions: trường đại học / học viện / cao đẳng ---------------------
CREATE TABLE IF NOT EXISTS public.institutions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_name text NOT NULL,
  normalized_name text NOT NULL UNIQUE,
  parent_institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  institution_type text NOT NULL CHECK (institution_type IN ('university', 'academy', 'college', 'parent_university')),
  ownership text CHECK (ownership IN ('public', 'private')),
  segment text,
  segment_rank smallint,
  main_field_id uuid REFERENCES public.career_fields(id) ON DELETE SET NULL,   -- lĩnh vực thế mạnh chính (LV1–LV6)
  city text,                                    -- theo địa giới sau sáp nhập 07/2025
  city_before_merger text,
  address text,
  website_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_institutions_parent ON public.institutions(parent_institution_id);
CREATE INDEX IF NOT EXISTS idx_institutions_city ON public.institutions(city);

-- 10. training_programs: chương trình đào tạo (trường × ngành × hệ) --------
CREATE TABLE IF NOT EXISTS public.training_programs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  major_id uuid NOT NULL REFERENCES public.majors(id) ON DELETE RESTRICT,
  source_key text NOT NULL UNIQUE,              -- trường|khoa|ngành|chuyên ngành|hệ đào tạo, đã chuẩn hóa
  faculty_name text,
  specialization_name text,
  program_type text,                            -- hệ đào tạo: chuẩn, chất lượng cao, tiên tiến, liên kết…
  degree_levels text[] CHECK (degree_levels <@ ARRAY['college', 'bachelor', 'master', 'doctorate']),
  program_qualifier text,                       -- phần trong ngoặc của tên ngành mô tả chương trình
  program_summary text,
  study_years numeric(3, 1),
  tuition_text text,
  tuition_per_semester_min bigint,
  tuition_per_semester_max bigint,
  program_url text,
  source_reference text,
  research_status text NOT NULL DEFAULT 'unverified'
    CHECK (research_status IN ('verified', 'partially_verified', 'supplemented', 'needs_supplement', 'unverified')),
  researcher_name text,
  research_note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_training_programs_institution ON public.training_programs(institution_id);
CREATE INDEX IF NOT EXISTS idx_training_programs_major ON public.training_programs(major_id);

-- 11. Hàm hỗ trợ RLS: nghề đã công bố ---------------------------------------
CREATE OR REPLACE FUNCTION public.is_career_published(p_career_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.careers WHERE id = p_career_id AND status = 'published');
$$;
REVOKE ALL ON FUNCTION public.is_career_published(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_career_published(uuid) TO authenticated, service_role;

-- 12. Triggers updated_at + bật RLS ------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['career_matrix_versions','career_fields','careers','career_job_descriptions',
                           'career_job_description_criteria','career_requirements','career_holland_profiles',
                           'majors','career_major_links','institutions','training_programs']
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

-- 13. RLS đọc ------------------------------------------------------------------
-- Danh mục: người dùng đã đăng nhập đọc được
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['career_matrix_versions','career_fields','majors','institutions','training_programs']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated read %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Authenticated read %1$s" ON public.%1$s FOR SELECT TO authenticated USING (true)', t);
  END LOOP;
END $$;

-- Nghề và dữ liệu đi kèm: chỉ nghề đã công bố mới đọc được (quản trị đọc tất cả nhờ policy ghi)
DROP POLICY IF EXISTS "Authenticated read careers" ON public.careers;
CREATE POLICY "Authenticated read careers" ON public.careers
  FOR SELECT TO authenticated USING (status = 'published');

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['career_job_descriptions','career_requirements','career_holland_profiles','career_major_links']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated read %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Authenticated read %1$s" ON public.%1$s FOR SELECT TO authenticated
                    USING (public.is_career_published(career_id))', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Authenticated read career_job_description_criteria" ON public.career_job_description_criteria;
CREATE POLICY "Authenticated read career_job_description_criteria" ON public.career_job_description_criteria
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.career_job_descriptions d
            WHERE d.id = job_description_id AND public.is_career_published(d.career_id))
  );
