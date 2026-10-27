-- Gộp tự động từ supabase/migrations/*.sql theo thứ tự tên file. Dán vào SQL Editor và chạy một lần.

-- ===== 20261027000100_phase1_users_and_consents.sql =====
-- ====================================================================
-- Phase 1 / Migration 1: Người dùng, vai trò, liên kết, lịch sử đồng ý
-- ENT-01.1 User | ENT-01.2 User_Profile | ENT-01.3 User_Relationship | ENT-01.4 Consent
-- Danh tính đăng nhập (email, số điện thoại, Google) do Supabase Auth (auth.users) quản lý.
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Kiểu liệt kê dùng chung ------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'student',            -- Học sinh
    'university_student', -- Sinh viên
    'parent',             -- Phụ huynh
    'teacher',            -- Giáo viên
    'mentor',             -- Người hướng dẫn
    'school_admin',       -- Quản trị trường
    'system_admin'        -- Quản trị hệ thống
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rater_group AS ENUM (
    'self',     -- Bản thân
    'parent',   -- Phụ huynh
    'friend',   -- Bạn bè
    'teacher',  -- Giáo viên
    'mentor'    -- Người hướng dẫn
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. user_profiles: hồ sơ nghiệp vụ, id trùng auth.users.id -------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  full_name text,
  date_of_birth date,
  school_name text,
  grade_or_major text,
  display_name text,
  personal_link_code text NOT NULL UNIQUE DEFAULT upper(encode(gen_random_bytes(5), 'hex')),
  guardian_consent_confirmed boolean NOT NULL DEFAULT false,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  deletion_requested_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  -- Tên hiển thị ẩn danh: tối đa 20 ký tự, không ký tự đặc biệt
  CONSTRAINT user_profiles_display_name_format
    CHECK (display_name IS NULL OR (char_length(display_name) <= 20 AND display_name ~ '^[[:alnum:] _-]+$'))
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

DROP TRIGGER IF EXISTS set_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Tuổi dưới 16 cần xác nhận của người giám hộ trước khi thu thập dữ liệu
CREATE OR REPLACE FUNCTION public.is_under_guardian_age(p_dob date)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_dob IS NOT NULL AND p_dob > (current_date - interval '16 years')::date;
$$;

-- Tự tạo user_profiles khi có tài khoản mới (vai trò lấy từ raw_user_meta_data.role)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.user_role;
BEGIN
  BEGIN
    v_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'student')::public.user_role;
  EXCEPTION WHEN invalid_text_representation THEN
    v_role := 'student';
  END;
  -- Quản trị chỉ được cấp thủ công, không cho tự đăng ký
  IF v_role IN ('system_admin', 'school_admin') THEN
    v_role := 'student';
  END IF;
  INSERT INTO public.user_profiles (id, role, full_name)
  VALUES (NEW.id, v_role, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Hàm hỗ trợ RLS
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT role = 'system_admin' FROM public.user_profiles WHERE id = auth.uid()), false);
$$;

-- 3. user_relationships: liên kết phụ huynh/bạn bè với HS/SV -------------
CREATE TABLE IF NOT EXISTS public.user_relationships (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (relationship_type IN ('parent', 'friend')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),
  responded_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT user_relationships_not_self CHECK (requester_id <> target_id),
  CONSTRAINT user_relationships_unique UNIQUE (requester_id, target_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_user_relationships_target ON public.user_relationships(target_id, status);

DROP TRIGGER IF EXISTS set_user_relationships_updated_at ON public.user_relationships;
CREATE TRIGGER set_user_relationships_updated_at
  BEFORE UPDATE ON public.user_relationships
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. consent_records: ai đồng ý việc gì, lúc nào, nội dung nào -----------
CREATE TABLE IF NOT EXISTS public.consent_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN (
    'invite_360',           -- đồng ý cho người khác đánh giá
    'share_result',         -- chia sẻ kết quả cho đối tượng cụ thể
    'guardian_confirmation',-- người giám hộ xác nhận (dưới 16 tuổi)
    'class_participation',  -- tham gia lớp = đồng ý đánh giá học đường
    'data_processing'
  )),
  granted_to_user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  displayed_content text NOT NULL,
  granted_at timestamptz DEFAULT now() NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_consent_records_user ON public.consent_records(user_id, consent_type);

DROP TRIGGER IF EXISTS set_consent_records_updated_at ON public.consent_records;
CREATE TRIGGER set_consent_records_updated_at
  BEFORE UPDATE ON public.consent_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. RLS ----------------------------------------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile" ON public.user_profiles;
CREATE POLICY "Users read own profile" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_system_admin());

DROP POLICY IF EXISTS "Users update own profile" ON public.user_profiles;
CREATE POLICY "Users update own profile" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admin manages profiles" ON public.user_profiles;
CREATE POLICY "Admin manages profiles" ON public.user_profiles
  FOR ALL TO authenticated
  USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

DROP POLICY IF EXISTS "Parties read relationships" ON public.user_relationships;
CREATE POLICY "Parties read relationships" ON public.user_relationships
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR target_id = auth.uid());

DROP POLICY IF EXISTS "Requester creates relationship" ON public.user_relationships;
CREATE POLICY "Requester creates relationship" ON public.user_relationships
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Parties update relationship" ON public.user_relationships;
CREATE POLICY "Parties update relationship" ON public.user_relationships
  FOR UPDATE TO authenticated
  USING (requester_id = auth.uid() OR target_id = auth.uid());

DROP POLICY IF EXISTS "Users read own consents" ON public.consent_records;
CREATE POLICY "Users read own consents" ON public.consent_records
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR granted_to_user_id = auth.uid() OR public.is_system_admin());

DROP POLICY IF EXISTS "Users create own consents" ON public.consent_records;
CREATE POLICY "Users create own consents" ON public.consent_records
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users revoke own consents" ON public.consent_records;
CREATE POLICY "Users revoke own consents" ON public.consent_records
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ===== 20261027000200_phase1_criteria_questions_params.sql =====
-- ====================================================================
-- Phase 1 / Migration 2: Bộ tiêu chí G1–G7, ngân hàng câu hỏi, tham số vận hành 360°
-- ENT-02.1 Criteria_Group + Criteria | ENT-02.2 Holland + Core Values
-- ENT-02.3 Question | ENT-02.4 Tham số vận hành 360°
-- ====================================================================

-- 1. Phiên bản khung tiêu chí (kết quả cũ không đổi khi khung cập nhật) ---
CREATE TABLE IF NOT EXISTS public.framework_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  version_code text NOT NULL UNIQUE,
  is_current boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_framework_versions_current
  ON public.framework_versions(is_current) WHERE is_current;

INSERT INTO public.framework_versions (version_code, is_current, note)
VALUES ('FW-1.0', true, 'Bộ 7 nhóm, 31 tiêu chí ban đầu')
ON CONFLICT (version_code) DO NOTHING;

-- 2. criteria_groups: G1–G7 ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.criteria_groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_code text NOT NULL UNIQUE,              -- G1..G7
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 3. holland_codes & core_values (danh mục) -------------------------------
CREATE TABLE IF NOT EXISTS public.holland_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  holland_code char(1) NOT NULL UNIQUE CHECK (holland_code IN ('R','I','A','S','E','C')),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

INSERT INTO public.holland_codes (holland_code, name) VALUES
  ('R', 'Thực tế/Kỹ thuật'),
  ('I', 'Nghiên cứu/Phân tích'),
  ('A', 'Nghệ thuật/Sáng tạo'),
  ('S', 'Xã hội/Hỗ trợ'),
  ('E', 'Kinh doanh/Quản lý'),
  ('C', 'Quy củ/Hành chính')
ON CONFLICT (holland_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.core_values (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  value_code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

INSERT INTO public.core_values (value_code, name, sort_order) VALUES
  ('income', 'Thu nhập', 1),
  ('status', 'Vị thế', 2),
  ('work_life_balance', 'Cân bằng cuộc sống', 3),
  ('social_meaning', 'Ý nghĩa xã hội', 4),
  ('creativity', 'Sáng tạo', 5)
ON CONFLICT (value_code) DO NOTHING;

-- 4. criteria: 31 tiêu chí (Dimension) -----------------------------------
CREATE TABLE IF NOT EXISTS public.criteria (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.criteria_groups(id) ON DELETE RESTRICT,
  dimension_code text NOT NULL UNIQUE,          -- D1.1 .. D7.4
  name text NOT NULL,
  definition text,
  behavior_indicator text,
  reference_source text,
  holland_code char(1) REFERENCES public.holland_codes(holland_code),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_criteria_group ON public.criteria(group_id);

-- 5. criteria_rater_visibility: tiêu chí hiển thị cho nhóm người đánh giá --
CREATE TABLE IF NOT EXISTS public.criteria_rater_visibility (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  criteria_id uuid NOT NULL REFERENCES public.criteria(id) ON DELETE CASCADE,
  rater_group public.rater_group NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  scale_method text,                            -- Likert / BARS / Analytic Rubric ...
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT criteria_rater_visibility_unique UNIQUE (criteria_id, rater_group)
);

-- 6. questions: ngân hàng câu hỏi ------------------------------------------
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question_code text NOT NULL UNIQUE,           -- Q-G1-D1.1-SELF-001
  criteria_id uuid NOT NULL REFERENCES public.criteria(id) ON DELETE RESTRICT,
  rater_group public.rater_group NOT NULL,      -- góc nhìn: bản thân / người khác
  respondent_segment text NOT NULL DEFAULT 'all' CHECK (respondent_segment IN ('all', 'student', 'university_student')),
  question_type text,
  content text NOT NULL,
  answer_options jsonb,                         -- 5 nhãn đáp án theo thang 1–5
  scale_scoring text,
  behavior_indicator_mapping text,
  assessment_part smallint CHECK (assessment_part BETWEEN 1 AND 4),
  detail_level text CHECK (detail_level IN ('overview', 'detail')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_criteria ON public.questions(criteria_id, rater_group);
CREATE INDEX IF NOT EXISTS idx_questions_part ON public.questions(assessment_part, detail_level) WHERE is_active;

-- 7. operation_parameters: tham số vận hành 360°, mỗi thay đổi = 1 bản ghi ---
CREATE TABLE IF NOT EXISTS public.operation_parameters (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  param_code text NOT NULL,
  param_name text NOT NULL,
  param_value jsonb NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_operation_parameters_current
  ON public.operation_parameters(param_code) WHERE is_current;

-- Khi thêm bản ghi mới cho cùng param_code, tự đóng bản đang hiệu lực
CREATE OR REPLACE FUNCTION public.supersede_operation_parameter()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_current THEN
    UPDATE public.operation_parameters
       SET is_current = false
     WHERE param_code = NEW.param_code AND is_current AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_supersede_operation_parameter ON public.operation_parameters;
CREATE TRIGGER trg_supersede_operation_parameter
  BEFORE INSERT ON public.operation_parameters
  FOR EACH ROW EXECUTE FUNCTION public.supersede_operation_parameter();

-- Giá trị mặc định theo tài liệu. min_completion_seconds (ngưỡng thời gian) chưa có số liệu từ BA.
INSERT INTO public.operation_parameters (param_code, param_name, param_value)
SELECT v.param_code, v.param_name, v.param_value::jsonb
FROM (VALUES
  ('self_weight', 'Trọng số bản thân', '0.5'),
  ('link_expiry_days', 'Hạn đường dẫn mời (ngày)', '14'),
  ('draft_retention_hours', 'Thời gian giữ bản nháp (giờ)', '168'),
  ('retake_min_interval_hours', 'Khoảng cách tối thiểu giữa hai lần làm lại (giờ)', '336'),
  ('insufficient_basis_warning_ratio', 'Ngưỡng cảnh báo thiếu dữ liệu (tỷ lệ ô không đủ cơ sở)', '0.4'),
  ('uniform_score_min_criteria', 'Số tiêu chí tối thiểu để kiểm tra chấm đồng một mức', '7'),
  ('min_completion_seconds', 'Ngưỡng thời gian làm bài tối thiểu (giây)', 'null'),
  ('competency_levels', 'Ngưỡng phân loại mức năng lực',
    '{"very_high":80,"high":65,"medium":50}'),
  ('understanding_conversion', 'Bảng quy đổi điểm thấu hiểu',
    '{"acquaintance_duration":{"under_6_months":1,"6_to_12_months":2,"1_to_3_years":3,"over_3_years":4},"contact_frequency":{"rarely":1,"few_per_month":2,"few_per_week":3,"daily":4},"observation_depth":{"superficial":1,"fairly_good":2,"well":3,"very_well":4}}')
) AS v(param_code, param_name, param_value)
WHERE NOT EXISTS (SELECT 1 FROM public.operation_parameters p WHERE p.param_code = v.param_code);

-- 8. Triggers updated_at ---------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['framework_versions','criteria_groups','holland_codes','core_values',
                           'criteria','criteria_rater_visibility','questions','operation_parameters']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%1$s_updated_at ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER set_%1$s_updated_at BEFORE UPDATE ON public.%1$s
                    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 9. RLS: người dùng đã đăng nhập đọc cấu hình; chỉ quản trị hệ thống ghi ---
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['framework_versions','criteria_groups','holland_codes','core_values',
                           'criteria','criteria_rater_visibility','questions','operation_parameters']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated read %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Authenticated read %1$s" ON public.%1$s FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin write %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Admin write %1$s" ON public.%1$s FOR ALL TO authenticated
                    USING (public.is_system_admin()) WITH CHECK (public.is_system_admin())', t);
  END LOOP;
END $$;

-- ===== 20261027000300_phase1_schools_classes.sql =====
-- ====================================================================
-- Phase 1 / Migration 3: Trường học, lớp học, bảng điểm lưới của giáo viên
-- ENT-03.1 School | ENT-03.2 Class | ENT-03.3 Class_Member
-- ENT-03.4 Class_Assessment_Grid | ENT-03.5 ..._Student | ENT-03.6 ..._Detail
-- (mã ENT theo bảng thực thể vật lý của tài liệu; ENT-05.x theo bảng khái niệm)
-- ====================================================================

-- Đánh dấu tiêu chí thuộc bộ câu hỏi rút gọn dành cho giáo viên chấm lưới
ALTER TABLE public.criteria
  ADD COLUMN IF NOT EXISTS is_short_set boolean NOT NULL DEFAULT false;

-- 1. schools --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schools (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_name text NOT NULL,
  address text,
  city text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Quản trị trường / giáo viên thuộc trường
CREATE TABLE IF NOT EXISTS public.school_staff (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  staff_role text NOT NULL CHECK (staff_role IN ('school_admin', 'teacher')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT school_staff_unique UNIQUE (school_id, user_id)
);

-- 2. classes ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_name text NOT NULL,
  grade smallint,
  school_year text NOT NULL,                    -- ví dụ 2026-2027
  class_code text NOT NULL UNIQUE DEFAULT upper(encode(gen_random_bytes(4), 'hex')),
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_classes_school ON public.classes(school_id, school_year);

-- 3. class_members: giáo viên (chủ nhiệm/bộ môn) và học sinh --------------
CREATE TABLE IF NOT EXISTS public.class_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  member_role text NOT NULL CHECK (member_role IN ('homeroom_teacher', 'subject_teacher', 'student')),
  status text NOT NULL DEFAULT 'joined' CHECK (status IN ('invited', 'joined', 'left', 'removed')),
  joined_via text CHECK (joined_via IN ('class_code', 'excel_import', 'manual')),
  -- Dòng nhập từ Excel khi học sinh chưa có tài khoản
  roster_student_code text,
  roster_full_name text,
  joined_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT class_members_identity CHECK (user_id IS NOT NULL OR roster_student_code IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_members_user
  ON public.class_members(class_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_members_roster
  ON public.class_members(class_id, roster_student_code) WHERE roster_student_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_class_members_user ON public.class_members(user_id);

-- 4. class_assessment_grids: bảng lưới chấm điểm của một giáo viên cho một lớp --
CREATE TABLE IF NOT EXISTS public.class_assessment_grids (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  -- 3 câu thấu hiểu khai báo một lần cho cả lớp
  default_acquaintance_duration smallint CHECK (default_acquaintance_duration BETWEEN 1 AND 4),
  default_contact_frequency smallint CHECK (default_contact_frequency BETWEEN 1 AND 4),
  default_observation_depth smallint CHECK (default_observation_depth BETWEEN 1 AND 4),
  submitted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_class_assessment_grids_class ON public.class_assessment_grids(class_id);
CREATE INDEX IF NOT EXISTS idx_class_assessment_grids_teacher ON public.class_assessment_grids(teacher_id);

-- 5. dòng học sinh trong bảng lưới (mức thấu hiểu riêng từng em) ------------
CREATE TABLE IF NOT EXISTS public.class_assessment_grid_students (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  grid_id uuid NOT NULL REFERENCES public.class_assessment_grids(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  acquaintance_duration smallint CHECK (acquaintance_duration BETWEEN 1 AND 4),
  contact_frequency smallint CHECK (contact_frequency BETWEEN 1 AND 4),
  observation_depth smallint CHECK (observation_depth BETWEEN 1 AND 4),
  understanding_score smallint CHECK (understanding_score BETWEEN 3 AND 12),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT class_assessment_grid_students_unique UNIQUE (grid_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_grid_students_student ON public.class_assessment_grid_students(student_id);

-- 6. ô điểm: học sinh x tiêu chí ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_assessment_grid_details (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  grid_student_id uuid NOT NULL REFERENCES public.class_assessment_grid_students(id) ON DELETE CASCADE,
  criteria_id uuid NOT NULL REFERENCES public.criteria(id) ON DELETE RESTRICT,
  score smallint CHECK (score BETWEEN 1 AND 5),
  is_insufficient_basis boolean NOT NULL DEFAULT false,   -- "không đủ cơ sở" => score NULL
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT class_assessment_grid_details_unique UNIQUE (grid_student_id, criteria_id),
  CONSTRAINT grid_detail_score_or_na CHECK (
    (is_insufficient_basis AND score IS NULL) OR (NOT is_insufficient_basis)
  )
);

-- 7. Hàm hỗ trợ RLS (security definer để tránh đệ quy policy) --------------
CREATE OR REPLACE FUNCTION public.is_class_teacher(p_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_members
     WHERE class_id = p_class_id AND user_id = auth.uid()
       AND member_role IN ('homeroom_teacher', 'subject_teacher') AND status = 'joined'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_class_member(p_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_members
     WHERE class_id = p_class_id AND user_id = auth.uid() AND status = 'joined'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_school_admin(p_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_system_admin() OR EXISTS (
    SELECT 1 FROM public.school_staff
     WHERE school_id = p_school_id AND user_id = auth.uid() AND staff_role = 'school_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_school_staff(p_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_system_admin() OR EXISTS (
    SELECT 1 FROM public.school_staff WHERE school_id = p_school_id AND user_id = auth.uid()
  );
$$;

-- 8. Triggers updated_at + RLS ---------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['schools','school_staff','classes','class_members',
                           'class_assessment_grids','class_assessment_grid_students','class_assessment_grid_details']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%1$s_updated_at ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER set_%1$s_updated_at BEFORE UPDATE ON public.%1$s
                    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- schools
DROP POLICY IF EXISTS "Staff read school" ON public.schools;
CREATE POLICY "Staff read school" ON public.schools FOR SELECT TO authenticated
  USING (public.is_school_staff(id));
DROP POLICY IF EXISTS "System admin manages schools" ON public.schools;
CREATE POLICY "System admin manages schools" ON public.schools FOR ALL TO authenticated
  USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

-- school_staff
DROP POLICY IF EXISTS "Staff read school staff" ON public.school_staff;
CREATE POLICY "Staff read school staff" ON public.school_staff FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_school_staff(school_id));
DROP POLICY IF EXISTS "School admin manages staff" ON public.school_staff;
CREATE POLICY "School admin manages staff" ON public.school_staff FOR ALL TO authenticated
  USING (public.is_school_admin(school_id)) WITH CHECK (public.is_school_admin(school_id));

-- classes
DROP POLICY IF EXISTS "Members and staff read classes" ON public.classes;
CREATE POLICY "Members and staff read classes" ON public.classes FOR SELECT TO authenticated
  USING (public.is_class_member(id) OR public.is_school_staff(school_id));
DROP POLICY IF EXISTS "Staff create classes" ON public.classes;
CREATE POLICY "Staff create classes" ON public.classes FOR INSERT TO authenticated
  WITH CHECK (public.is_school_staff(school_id));
DROP POLICY IF EXISTS "Staff update classes" ON public.classes;
CREATE POLICY "Staff update classes" ON public.classes FOR UPDATE TO authenticated
  USING (public.is_school_staff(school_id)) WITH CHECK (public.is_school_staff(school_id));

-- class_members
DROP POLICY IF EXISTS "Read class members" ON public.class_members;
CREATE POLICY "Read class members" ON public.class_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_class_teacher(class_id)
         OR public.is_school_staff((SELECT school_id FROM public.classes c WHERE c.id = class_id)));
DROP POLICY IF EXISTS "Student joins class" ON public.class_members;
CREATE POLICY "Student joins class" ON public.class_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND member_role = 'student' AND joined_via = 'class_code')
  ;
DROP POLICY IF EXISTS "Teacher manages members" ON public.class_members;
CREATE POLICY "Teacher manages members" ON public.class_members FOR ALL TO authenticated
  USING (public.is_class_teacher(class_id)
         OR public.is_school_staff((SELECT school_id FROM public.classes c WHERE c.id = class_id)))
  WITH CHECK (public.is_class_teacher(class_id)
         OR public.is_school_staff((SELECT school_id FROM public.classes c WHERE c.id = class_id)));
DROP POLICY IF EXISTS "Student leaves class" ON public.class_members;
CREATE POLICY "Student leaves class" ON public.class_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND status = 'left');

-- grids: chỉ giáo viên chấm lưới và quản trị trường xem/sửa
DROP POLICY IF EXISTS "Teacher manages own grids" ON public.class_assessment_grids;
CREATE POLICY "Teacher manages own grids" ON public.class_assessment_grids FOR ALL TO authenticated
  USING (teacher_id = auth.uid() AND public.is_class_teacher(class_id))
  WITH CHECK (teacher_id = auth.uid() AND public.is_class_teacher(class_id));

DROP POLICY IF EXISTS "Teacher manages own grid students" ON public.class_assessment_grid_students;
CREATE POLICY "Teacher manages own grid students" ON public.class_assessment_grid_students FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_assessment_grids g WHERE g.id = grid_id AND g.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.class_assessment_grids g WHERE g.id = grid_id AND g.teacher_id = auth.uid()));

DROP POLICY IF EXISTS "Teacher manages own grid details" ON public.class_assessment_grid_details;
CREATE POLICY "Teacher manages own grid details" ON public.class_assessment_grid_details FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.class_assessment_grid_students s
      JOIN public.class_assessment_grids g ON g.id = s.grid_id
     WHERE s.id = grid_student_id AND g.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.class_assessment_grid_students s
      JOIN public.class_assessment_grids g ON g.id = s.grid_id
     WHERE s.id = grid_student_id AND g.teacher_id = auth.uid()));

-- ===== 20261027000400_phase1_assessments_360.sql =====
-- ====================================================================
-- Phase 1 / Migration 4: Tự đánh giá, đường dẫn mời, bài đánh giá 360°, kết quả
-- Assessment_Session | Assessment_Answer | Invitation_Link
-- Assessment_360_Submission | Assessment_360_Answer | Assessment_Result | snapshots
-- Bài từ bảng lưới của giáo viên đi vào cùng bảng assessment_360_submissions
-- (submission_channel = 'classroom_grid') để dùng chung logic tính điểm.
-- ====================================================================

DO $$ BEGIN
  CREATE TYPE public.result_status_label AS ENUM ('self_assessment', 'temporary', 'final_360');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. assessment_sessions -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  framework_version_id uuid NOT NULL REFERENCES public.framework_versions(id),
  package_size smallint NOT NULL CHECK (package_size IN (35, 50, 75)),
  current_part smallint NOT NULL DEFAULT 1 CHECK (current_part BETWEEN 1 AND 4),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'expired')),
  draft_expires_at timestamptz,                 -- bản nháp giữ tối đa 168 giờ
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user ON public.assessment_sessions(user_id, started_at DESC);

-- 2. assessment_answers ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_answers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  criteria_id uuid NOT NULL REFERENCES public.criteria(id) ON DELETE RESTRICT,
  score smallint CHECK (score BETWEEN 1 AND 5),
  is_insufficient_basis boolean NOT NULL DEFAULT false,   -- NULL điểm, loại khỏi phép tính (R02)
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT assessment_answers_unique UNIQUE (session_id, question_id),
  CONSTRAINT assessment_answers_score_or_na CHECK (
    (is_insufficient_basis AND score IS NULL) OR (NOT is_insufficient_basis AND score IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_assessment_answers_criteria ON public.assessment_answers(session_id, criteria_id);

-- 3. minh chứng bổ trợ & giá trị cốt lõi đã chọn ---------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_evidences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL UNIQUE REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  grade_point_average numeric(4,2),
  certificates jsonb NOT NULL DEFAULT '[]'::jsonb,
  achievements jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.assessment_core_values (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  core_value_id uuid NOT NULL REFERENCES public.core_values(id),
  priority_rank smallint NOT NULL CHECK (priority_rank BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT assessment_core_values_unique UNIQUE (session_id, core_value_id),
  CONSTRAINT assessment_core_values_rank_unique UNIQUE (session_id, priority_rank)
);

-- 4. invitation_links ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invitation_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  rater_group public.rater_group NOT NULL CHECK (rater_group <> 'self'),
  link_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  expected_count smallint NOT NULL CHECK (expected_count >= 1),
  qr_image_path text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
-- Mỗi HS/SV chỉ có một đường dẫn còn hiệu lực cho mỗi nhóm
CREATE UNIQUE INDEX IF NOT EXISTS uq_invitation_links_active
  ON public.invitation_links(user_id, rater_group) WHERE revoked_at IS NULL;

-- 5. assessment_360_submissions ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_360_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  rater_group public.rater_group NOT NULL CHECK (rater_group <> 'self'),
  submission_channel text NOT NULL CHECK (submission_channel IN ('invite_link', 'classroom_grid')),
  invitation_link_id uuid REFERENCES public.invitation_links(id) ON DELETE SET NULL,
  grid_student_id uuid UNIQUE REFERENCES public.class_assessment_grid_students(id) ON DELETE SET NULL,
  resume_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  rater_nickname text,
  relationship_label text,                      -- mối quan hệ cụ thể, không tính điểm
  acquaintance_duration smallint CHECK (acquaintance_duration BETWEEN 1 AND 4),
  contact_frequency smallint CHECK (contact_frequency BETWEEN 1 AND 4),
  observation_depth smallint CHECK (observation_depth BETWEEN 1 AND 4),
  understanding_score smallint CHECK (understanding_score BETWEEN 3 AND 12),
  submitter_ip inet,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'accepted', 'rejected')),
  quality_flag text NOT NULL DEFAULT 'ok' CHECK (quality_flag IN ('ok', 'too_fast', 'uniform_scores', 'both')),
  completion_seconds integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT submissions_channel_source CHECK (
    (submission_channel = 'invite_link' AND invitation_link_id IS NOT NULL AND grid_student_id IS NULL)
    OR (submission_channel = 'classroom_grid' AND grid_student_id IS NOT NULL AND rater_group = 'teacher')
  )
);
CREATE INDEX IF NOT EXISTS idx_submissions_subject ON public.assessment_360_submissions(subject_user_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_link ON public.assessment_360_submissions(invitation_link_id);
-- Chống nộp trùng: mỗi IP một bài cho mỗi đường dẫn
CREATE UNIQUE INDEX IF NOT EXISTS uq_submissions_link_ip
  ON public.assessment_360_submissions(invitation_link_id, submitter_ip)
  WHERE invitation_link_id IS NOT NULL AND submitter_ip IS NOT NULL;

-- 6. assessment_360_answers ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_360_answers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES public.assessment_360_submissions(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.questions(id) ON DELETE RESTRICT,   -- NULL khi nguồn là bảng lưới
  criteria_id uuid NOT NULL REFERENCES public.criteria(id) ON DELETE RESTRICT,
  score smallint CHECK (score BETWEEN 1 AND 5),
  is_insufficient_basis boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT assessment_360_answers_score_or_na CHECK (
    (is_insufficient_basis AND score IS NULL) OR (NOT is_insufficient_basis AND score IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_360_answers_question
  ON public.assessment_360_answers(submission_id, question_id) WHERE question_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_360_answers_criteria_grid
  ON public.assessment_360_answers(submission_id, criteria_id) WHERE question_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_360_answers_criteria ON public.assessment_360_answers(submission_id, criteria_id);

-- 7. assessment_results ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL UNIQUE REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  framework_version_id uuid NOT NULL REFERENCES public.framework_versions(id),
  status_label public.result_status_label NOT NULL DEFAULT 'self_assessment',
  invite_enabled boolean NOT NULL DEFAULT false,      -- HS/SV đồng ý mời đánh giá
  accepted_count integer NOT NULL DEFAULT 0,
  expected_count integer NOT NULL DEFAULT 0,
  groups_count integer NOT NULL DEFAULT 0,             -- số nhóm đối tượng đã đóng góp
  thin_data_flag boolean NOT NULL DEFAULT false,       -- chỉ 1 bài được chấp nhận khi chốt
  insufficient_basis_warning boolean NOT NULL DEFAULT false,
  finalized_mode text CHECK (finalized_mode IN ('auto', 'manual')),
  finalized_at timestamptz,
  calculated_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assessment_results_user ON public.assessment_results(user_id, created_at DESC);

-- Điểm theo tiêu chí và nguồn (self, parent, friend, teacher, mentor, combined_360)
CREATE TABLE IF NOT EXISTS public.assessment_result_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  result_id uuid NOT NULL REFERENCES public.assessment_results(id) ON DELETE CASCADE,
  criteria_id uuid NOT NULL REFERENCES public.criteria(id) ON DELETE RESTRICT,
  score_source text NOT NULL CHECK (score_source IN ('self', 'parent', 'friend', 'teacher', 'mentor', 'combined_360')),
  score_1_5 numeric(4,3),
  score_percent numeric(5,2),
  competency_level text CHECK (competency_level IN ('very_high', 'high', 'medium', 'low')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT assessment_result_scores_unique UNIQUE (result_id, criteria_id, score_source)
);

-- Trọng số từng bài được chấp nhận
CREATE TABLE IF NOT EXISTS public.assessment_result_weights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  result_id uuid NOT NULL REFERENCES public.assessment_results(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES public.assessment_360_submissions(id) ON DELETE CASCADE,
  weight numeric(7,6) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT assessment_result_weights_unique UNIQUE (result_id, submission_id)
);

-- 8. assessment_result_snapshots: mỗi lần tính tạo bản chụp mới, bất biến -------------------
CREATE TABLE IF NOT EXISTS public.assessment_result_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  result_id uuid NOT NULL REFERENCES public.assessment_results(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status_label public.result_status_label NOT NULL,
  snapshot_data jsonb NOT NULL,                 -- điểm, trọng số, tham số đã dùng
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_result_snapshots_user ON public.assessment_result_snapshots(user_id, created_at DESC);

-- Bản chụp không được sửa
CREATE OR REPLACE FUNCTION public.prevent_snapshot_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'assessment_result_snapshots là bản ghi bất biến';
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_snapshot_update ON public.assessment_result_snapshots;
CREATE TRIGGER trg_prevent_snapshot_update
  BEFORE UPDATE ON public.assessment_result_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.prevent_snapshot_update();

-- 9. Quyền xem kết quả: chủ sở hữu, hoặc người được chia sẻ -------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_result_of(p_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_owner = auth.uid() OR public.is_system_admin() OR EXISTS (
    SELECT 1 FROM public.consent_records c
     WHERE c.user_id = p_owner AND c.granted_to_user_id = auth.uid()
       AND c.consent_type = 'share_result' AND c.revoked_at IS NULL
  );
$$;

-- 10. Triggers updated_at + RLS ------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['assessment_sessions','assessment_answers','assessment_evidences','assessment_core_values',
                           'invitation_links','assessment_360_submissions','assessment_360_answers',
                           'assessment_results','assessment_result_scores','assessment_result_weights']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%1$s_updated_at ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER set_%1$s_updated_at BEFORE UPDATE ON public.%1$s
                    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['assessment_sessions','assessment_answers','assessment_evidences','assessment_core_values',
                           'invitation_links','assessment_360_submissions','assessment_360_answers',
                           'assessment_results','assessment_result_scores','assessment_result_weights',
                           'assessment_result_snapshots']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Tự đánh giá: chỉ chủ sở hữu
DROP POLICY IF EXISTS "Owner manages sessions" ON public.assessment_sessions;
CREATE POLICY "Owner manages sessions" ON public.assessment_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owner manages answers" ON public.assessment_answers;
CREATE POLICY "Owner manages answers" ON public.assessment_answers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessment_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assessment_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS "Owner manages evidences" ON public.assessment_evidences;
CREATE POLICY "Owner manages evidences" ON public.assessment_evidences FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessment_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assessment_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS "Owner manages core values" ON public.assessment_core_values;
CREATE POLICY "Owner manages core values" ON public.assessment_core_values FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessment_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assessment_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));

-- Đường dẫn mời: chủ sở hữu tạo/xem/thu hồi (khách không đọc bảng, chỉ qua hàm RPC)
DROP POLICY IF EXISTS "Owner manages invitation links" ON public.invitation_links;
CREATE POLICY "Owner manages invitation links" ON public.invitation_links FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Bài nộp 360°: chủ sở hữu chỉ xem siêu dữ liệu; điểm từng người KHÔNG được đọc
DROP POLICY IF EXISTS "Subject reads own submissions" ON public.assessment_360_submissions;
CREATE POLICY "Subject reads own submissions" ON public.assessment_360_submissions FOR SELECT TO authenticated
  USING (subject_user_id = auth.uid() AND status <> 'draft');
-- assessment_360_answers: không có policy cho authenticated => chỉ hàm hệ thống (security definer) đọc/ghi

-- Kết quả
DROP POLICY IF EXISTS "Read permitted results" ON public.assessment_results;
CREATE POLICY "Read permitted results" ON public.assessment_results FOR SELECT TO authenticated
  USING (public.can_view_result_of(user_id));
DROP POLICY IF EXISTS "Owner updates invite flag" ON public.assessment_results;
CREATE POLICY "Owner updates invite flag" ON public.assessment_results FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Owner creates results" ON public.assessment_results;
CREATE POLICY "Owner creates results" ON public.assessment_results FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status_label = 'self_assessment');

DROP POLICY IF EXISTS "Read permitted result scores" ON public.assessment_result_scores;
CREATE POLICY "Read permitted result scores" ON public.assessment_result_scores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessment_results r WHERE r.id = result_id AND public.can_view_result_of(r.user_id)));

DROP POLICY IF EXISTS "Read permitted snapshots" ON public.assessment_result_snapshots;
CREATE POLICY "Read permitted snapshots" ON public.assessment_result_snapshots FOR SELECT TO authenticated
  USING (public.can_view_result_of(user_id));
-- assessment_result_weights: chỉ hàm hệ thống đọc/ghi (trọng số từng người ẩn với HS/SV)

-- ===== 20261027000500_phase1_platform_and_rpc.sql =====
-- ====================================================================
-- Phase 1 / Migration 5: Thông báo, nhật ký hệ thống, hàm RPC cho khách và giáo viên
-- Khách (người được mời) không có tài khoản: chỉ truy cập qua các hàm bên dưới,
-- không được đọc trực tiếp bất kỳ bảng nào.
-- ====================================================================

-- 1. notifications & notification_settings ---------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN (
    'new_submission', 'result_changed', 'result_finalized', 'link_expiring', 'class_update'
  )),
  title text NOT NULL,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  in_app_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT notification_settings_unique UNIQUE (user_id, notification_type)
);

-- 2. audit_logs ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  subject_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  ip_address inet,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_subject ON public.audit_logs(subject_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id, created_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['notifications','notification_settings','audit_logs']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%1$s_updated_at ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER set_%1$s_updated_at BEFORE UPDATE ON public.%1$s
                    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Owner reads notifications" ON public.notifications;
CREATE POLICY "Owner reads notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Owner marks notifications read" ON public.notifications;
CREATE POLICY "Owner marks notifications read" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owner manages notification settings" ON public.notification_settings;
CREATE POLICY "Owner manages notification settings" ON public.notification_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin reads audit logs" ON public.audit_logs;
CREATE POLICY "Admin reads audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_system_admin());

-- 3. Hàm tiện ích nội bộ ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_actor uuid, p_subject uuid, p_action text, p_target_type text, p_target_id uuid, p_details jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, subject_user_id, action, target_type, target_id, ip_address, details)
  VALUES (p_actor, p_subject, p_action, p_target_type, p_target_id, public.request_ip(), COALESCE(p_details, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.request_ip()
RETURNS inet LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_header text;
BEGIN
  BEGIN
    v_header := (current_setting('request.headers', true)::json) ->> 'x-forwarded-for';
    RETURN NULLIF(trim(split_part(v_header, ',', 1)), '')::inet;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_parameter(p_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT param_value FROM public.operation_parameters WHERE param_code = p_code AND is_current;
$$;

CREATE OR REPLACE FUNCTION public.push_notification(
  p_user uuid, p_type text, p_title text, p_body text, p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE((SELECT in_app_enabled FROM public.notification_settings
                WHERE user_id = p_user AND notification_type = p_type), true) THEN
    INSERT INTO public.notifications (user_id, notification_type, title, body, payload)
    VALUES (p_user, p_type, p_title, p_body, p_payload);
  END IF;
END;
$$;

-- 4. RPC cho khách ---------------------------------------------------------------------
-- 4.1 Trạng thái đường dẫn khi khách mở link
CREATE OR REPLACE FUNCTION public.get_invitation_public(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l public.invitation_links;
  v_display text;
  v_state text;
BEGIN
  SELECT * INTO l FROM public.invitation_links WHERE link_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;
  IF l.revoked_at IS NOT NULL THEN
    v_state := 'revoked';
  ELSIF l.expires_at <= now() THEN
    v_state := 'expired';
  ELSIF (SELECT count(*) FROM public.assessment_360_submissions s
          WHERE s.invitation_link_id = l.id AND s.status <> 'draft') >= l.expected_count THEN
    v_state := 'full';
  ELSE
    v_state := 'valid';
  END IF;
  SELECT display_name INTO v_display FROM public.user_profiles WHERE id = l.user_id;
  RETURN jsonb_build_object('state', v_state, 'rater_group', l.rater_group, 'subject_display_name', v_display);
END;
$$;

-- 4.2 Bắt đầu bài: khai báo thông tin ban đầu, trả về resume_token
CREATE OR REPLACE FUNCTION public.start_360_submission(
  p_token text, p_nickname text, p_relationship text,
  p_acquaintance_duration smallint, p_contact_frequency smallint, p_observation_depth smallint
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l public.invitation_links;
  v_ip inet := public.request_ip();
  v_existing public.assessment_360_submissions;
  v_resume text;
BEGIN
  SELECT * INTO l FROM public.invitation_links WHERE link_token = p_token;
  IF NOT FOUND OR l.revoked_at IS NOT NULL OR l.expires_at <= now() THEN
    RAISE EXCEPTION 'invitation_unavailable';
  END IF;

  IF v_ip IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.assessment_360_submissions
     WHERE invitation_link_id = l.id AND submitter_ip = v_ip;
    IF FOUND THEN
      IF v_existing.status = 'draft' THEN
        RETURN v_existing.resume_token;      -- tiếp tục bài đang làm dở
      END IF;
      RAISE EXCEPTION 'duplicate_ip';
    END IF;
  END IF;

  IF (SELECT count(*) FROM public.assessment_360_submissions s WHERE s.invitation_link_id = l.id)
       >= l.expected_count THEN
    RAISE EXCEPTION 'link_full';
  END IF;

  INSERT INTO public.assessment_360_submissions (
    subject_user_id, rater_group, submission_channel, invitation_link_id,
    rater_nickname, relationship_label,
    acquaintance_duration, contact_frequency, observation_depth,
    understanding_score, submitter_ip
  ) VALUES (
    l.user_id, l.rater_group, 'invite_link', l.id,
    left(p_nickname, 40), left(p_relationship, 80),
    p_acquaintance_duration, p_contact_frequency, p_observation_depth,
    p_acquaintance_duration + p_contact_frequency + p_observation_depth, v_ip
  ) RETURNING resume_token INTO v_resume;
  RETURN v_resume;
END;
$$;

-- 4.3 Câu hỏi dành cho nhóm của người được mời
CREATE OR REPLACE FUNCTION public.get_360_questions(p_resume_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_360_submissions;
  v_segment text;
BEGIN
  SELECT * INTO s FROM public.assessment_360_submissions WHERE resume_token = p_resume_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'submission_not_found'; END IF;
  SELECT CASE role WHEN 'university_student' THEN 'university_student' ELSE 'student' END
    INTO v_segment FROM public.user_profiles WHERE id = s.subject_user_id;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'question_id', q.id, 'criteria_id', q.criteria_id,
             'dimension_code', c.dimension_code, 'content', q.content, 'answer_options', q.answer_options
           ) ORDER BY c.sort_order, q.question_code)
      FROM public.questions q
      JOIN public.criteria c ON c.id = q.criteria_id AND c.is_active
      JOIN public.criteria_rater_visibility v ON v.criteria_id = c.id AND v.rater_group = s.rater_group AND v.is_visible
     WHERE q.rater_group = s.rater_group AND q.is_active
       AND q.respondent_segment IN ('all', v_segment)
  ), '[]'::jsonb);
END;
$$;

-- 4.4 Lưu nháp câu trả lời: [{"question_id": "...", "score": 1-5 | null, "insufficient": bool}]
CREATE OR REPLACE FUNCTION public.save_360_answers(p_resume_token text, p_answers jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_360_submissions;
  l public.invitation_links;
  a jsonb;
  v_question public.questions;
BEGIN
  SELECT * INTO s FROM public.assessment_360_submissions WHERE resume_token = p_resume_token;
  IF NOT FOUND OR s.status <> 'draft' OR s.submission_channel <> 'invite_link' THEN
    RAISE EXCEPTION 'submission_not_editable';
  END IF;
  SELECT * INTO l FROM public.invitation_links WHERE id = s.invitation_link_id;
  IF l.revoked_at IS NOT NULL OR l.expires_at <= now() THEN
    RAISE EXCEPTION 'invitation_unavailable';
  END IF;

  FOR a IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    SELECT * INTO v_question FROM public.questions
     WHERE id = (a ->> 'question_id')::uuid AND rater_group = s.rater_group AND is_active;
    IF NOT FOUND THEN CONTINUE; END IF;
    INSERT INTO public.assessment_360_answers (submission_id, question_id, criteria_id, score, is_insufficient_basis)
    VALUES (
      s.id, v_question.id, v_question.criteria_id,
      CASE WHEN COALESCE((a ->> 'insufficient')::boolean, false) THEN NULL ELSE (a ->> 'score')::smallint END,
      COALESCE((a ->> 'insufficient')::boolean, false)
    )
    ON CONFLICT (submission_id, question_id) WHERE question_id IS NOT NULL
    DO UPDATE SET score = EXCLUDED.score, is_insufficient_basis = EXCLUDED.is_insufficient_basis;
  END LOOP;
END;
$$;

-- 4.5 Nộp bài: chặn nếu còn câu trống; gắn cờ chất lượng nhưng vẫn cho nộp
CREATE OR REPLACE FUNCTION public.submit_360(p_resume_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_360_submissions;
  l public.invitation_links;
  v_required uuid[];
  v_answered uuid[];
  v_missing uuid[];
  v_seconds integer;
  v_min_seconds integer;
  v_uniform_min integer := COALESCE((public.get_parameter('uniform_score_min_criteria'))::text::integer, 7);
  v_scored integer;
  v_distinct integer;
  v_too_fast boolean := false;
  v_uniform boolean := false;
  v_flag text := 'ok';
BEGIN
  SELECT * INTO s FROM public.assessment_360_submissions WHERE resume_token = p_resume_token FOR UPDATE;
  IF NOT FOUND OR s.status <> 'draft' THEN RAISE EXCEPTION 'submission_not_editable'; END IF;
  SELECT * INTO l FROM public.invitation_links WHERE id = s.invitation_link_id;
  IF l.revoked_at IS NOT NULL OR l.expires_at <= now() THEN RAISE EXCEPTION 'invitation_unavailable'; END IF;

  SELECT array_agg((x ->> 'question_id')::uuid) INTO v_required
    FROM jsonb_array_elements(public.get_360_questions(p_resume_token)) x;
  SELECT array_agg(question_id) INTO v_answered
    FROM public.assessment_360_answers WHERE submission_id = s.id;
  SELECT array_agg(q) INTO v_missing
    FROM unnest(COALESCE(v_required, ARRAY[]::uuid[])) q
   WHERE q <> ALL (COALESCE(v_answered, ARRAY[]::uuid[]));
  IF v_missing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_answers', 'missing_question_ids', to_jsonb(v_missing));
  END IF;

  v_seconds := extract(epoch FROM (now() - s.started_at))::integer;
  BEGIN
    v_min_seconds := (public.get_parameter('min_completion_seconds'))::text::integer;
  EXCEPTION WHEN OTHERS THEN
    v_min_seconds := NULL;     -- ngưỡng chưa được cấu hình thì không kiểm tra
  END;
  v_too_fast := v_min_seconds IS NOT NULL AND v_seconds < v_min_seconds;

  SELECT count(score), count(DISTINCT score) INTO v_scored, v_distinct
    FROM public.assessment_360_answers WHERE submission_id = s.id AND score IS NOT NULL;
  v_uniform := v_scored >= v_uniform_min AND v_distinct = 1;

  v_flag := CASE WHEN v_too_fast AND v_uniform THEN 'both'
                 WHEN v_too_fast THEN 'too_fast'
                 WHEN v_uniform THEN 'uniform_scores' ELSE 'ok' END;

  UPDATE public.assessment_360_submissions
     SET status = 'pending', quality_flag = v_flag, completion_seconds = v_seconds, submitted_at = now()
   WHERE id = s.id;

  PERFORM public.push_notification(s.subject_user_id, 'new_submission', 'Có bài đánh giá mới',
    NULL, jsonb_build_object('submission_id', s.id, 'rater_group', s.rater_group));
  PERFORM public.write_audit_log(NULL, s.subject_user_id, 'submit_360', 'assessment_360_submissions', s.id,
    jsonb_build_object('quality_flag', v_flag));

  RETURN jsonb_build_object('ok', true, 'quality_flag', v_flag);
END;
$$;

-- 5. RPC cho HS/SV: chấp nhận hoặc loại bài ------------------------------------------------
CREATE OR REPLACE FUNCTION public.decide_submission(p_submission_id uuid, p_decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_360_submissions;
BEGIN
  IF p_decision NOT IN ('accepted', 'rejected') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  SELECT * INTO s FROM public.assessment_360_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND OR s.subject_user_id <> auth.uid() OR s.status = 'draft' THEN
    RAISE EXCEPTION 'submission_not_found';
  END IF;
  UPDATE public.assessment_360_submissions
     SET status = p_decision, decided_at = now() WHERE id = s.id;
  PERFORM public.write_audit_log(auth.uid(), s.subject_user_id, 'decide_submission',
    'assessment_360_submissions', s.id, jsonb_build_object('decision', p_decision));
END;
$$;

-- 6. RPC cho giáo viên: nộp bảng lưới -> tạo bài đánh giá đã chấp nhận cho từng học sinh -------------
CREATE OR REPLACE FUNCTION public.submit_class_grid(p_grid_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.class_assessment_grids;
  gs public.class_assessment_grid_students;
  v_short_count integer;
  v_empty integer;
  v_sub_id uuid;
  v_score smallint;
BEGIN
  SELECT * INTO g FROM public.class_assessment_grids WHERE id = p_grid_id FOR UPDATE;
  IF NOT FOUND OR g.teacher_id <> auth.uid() THEN RAISE EXCEPTION 'grid_not_found'; END IF;
  IF g.status = 'submitted' THEN RAISE EXCEPTION 'grid_already_submitted'; END IF;

  SELECT count(*) INTO v_short_count FROM public.criteria WHERE is_short_set AND is_active;
  IF v_short_count = 0 THEN RAISE EXCEPTION 'short_set_not_configured'; END IF;

  -- Mỗi học sinh phải có đủ ô (điểm hoặc "không đủ cơ sở") cho mọi tiêu chí rút gọn
  SELECT count(*) INTO v_empty
    FROM public.class_assessment_grid_students s
    CROSS JOIN public.criteria c
    LEFT JOIN public.class_assessment_grid_details d ON d.grid_student_id = s.id AND d.criteria_id = c.id
   WHERE s.grid_id = g.id AND c.is_short_set AND c.is_active
     AND (d.id IS NULL OR (d.score IS NULL AND NOT d.is_insufficient_basis));
  IF v_empty > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty_cells', 'empty_count', v_empty);
  END IF;

  FOR gs IN SELECT * FROM public.class_assessment_grid_students WHERE grid_id = g.id
  LOOP
    INSERT INTO public.assessment_360_submissions (
      subject_user_id, rater_group, submission_channel, grid_student_id,
      acquaintance_duration, contact_frequency, observation_depth, understanding_score,
      status, submitted_at, decided_at
    ) VALUES (
      gs.student_id, 'teacher', 'classroom_grid', gs.id,
      COALESCE(gs.acquaintance_duration, g.default_acquaintance_duration),
      COALESCE(gs.contact_frequency, g.default_contact_frequency),
      COALESCE(gs.observation_depth, g.default_observation_depth),
      COALESCE(gs.acquaintance_duration, g.default_acquaintance_duration)
        + COALESCE(gs.contact_frequency, g.default_contact_frequency)
        + COALESCE(gs.observation_depth, g.default_observation_depth),
      'accepted', now(), now()
    )
    ON CONFLICT (grid_student_id) DO UPDATE SET status = 'accepted', submitted_at = now(), decided_at = now()
    RETURNING id INTO v_sub_id;

    DELETE FROM public.assessment_360_answers WHERE submission_id = v_sub_id;
    INSERT INTO public.assessment_360_answers (submission_id, question_id, criteria_id, score, is_insufficient_basis)
    SELECT v_sub_id, NULL, d.criteria_id, d.score, d.is_insufficient_basis
      FROM public.class_assessment_grid_details d WHERE d.grid_student_id = gs.id;

    -- Bài từ bảng lưới đã ở trạng thái accepted ngay khi tạo nên không qua trigger; tính lại tại đây
    PERFORM public.recalculate_latest_result(gs.student_id);
  END LOOP;

  UPDATE public.class_assessment_grids SET status = 'submitted', submitted_at = now() WHERE id = g.id;
  PERFORM public.write_audit_log(auth.uid(), NULL, 'submit_class_grid', 'class_assessment_grids', g.id, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 7. Phân quyền thực thi: khách chỉ gọi 5 hàm đầu tiên ---------------------------------------------
REVOKE ALL ON FUNCTION public.get_invitation_public(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_360_submission(text, text, text, smallint, smallint, smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_360_questions(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_360_answers(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_360(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decide_submission(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_class_grid(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.write_audit_log(uuid, uuid, text, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.push_notification(uuid, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_parameter(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_invitation_public(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_360_submission(text, text, text, smallint, smallint, smallint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_360_questions(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_360_answers(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_360(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_submission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_class_grid(uuid) TO authenticated;

-- ===== 20261027000600_phase1_scoring_and_packages.sql =====
-- ====================================================================
-- Phase 1 / Migration 6: Gán câu hỏi theo gói, tính điểm trọng số 360°, trạng thái kết quả
-- Tính điểm: Rater Score (R02) -> trọng số bài (BR-006) -> điểm tiêu chí tổng hợp (R03)
-- -> phân loại mức năng lực -> bản chụp. Chốt kết quả thủ công hoặc tự động.
-- ====================================================================

-- 1. Admin gán câu hỏi vào gói 35/50/75 ---------------------------------------
CREATE TABLE IF NOT EXISTS public.question_package_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  package_size smallint NOT NULL CHECK (package_size IN (35, 50, 75)),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT question_package_assignments_unique UNIQUE (question_id, package_size)
);
CREATE INDEX IF NOT EXISTS idx_question_package_package ON public.question_package_assignments(package_size);

DROP TRIGGER IF EXISTS set_question_package_assignments_updated_at ON public.question_package_assignments;
CREATE TRIGGER set_question_package_assignments_updated_at
  BEFORE UPDATE ON public.question_package_assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.question_package_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read question_package_assignments" ON public.question_package_assignments;
CREATE POLICY "Authenticated read question_package_assignments" ON public.question_package_assignments
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write question_package_assignments" ON public.question_package_assignments;
CREATE POLICY "Admin write question_package_assignments" ON public.question_package_assignments
  FOR ALL TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

-- 2. Chặn người dùng tự sửa cột kết quả; chỉ hàm hệ thống được đổi ----------------
CREATE OR REPLACE FUNCTION public.guard_result_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(current_setting('app.internal_write', true), '') = '1' THEN
    RETURN NEW;
  END IF;
  IF NEW.status_label IS DISTINCT FROM OLD.status_label
     OR NEW.accepted_count IS DISTINCT FROM OLD.accepted_count
     OR NEW.expected_count IS DISTINCT FROM OLD.expected_count
     OR NEW.groups_count IS DISTINCT FROM OLD.groups_count
     OR NEW.thin_data_flag IS DISTINCT FROM OLD.thin_data_flag
     OR NEW.insufficient_basis_warning IS DISTINCT FROM OLD.insufficient_basis_warning
     OR NEW.finalized_mode IS DISTINCT FROM OLD.finalized_mode
     OR NEW.finalized_at IS DISTINCT FROM OLD.finalized_at
     OR NEW.calculated_at IS DISTINCT FROM OLD.calculated_at
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.session_id IS DISTINCT FROM OLD.session_id THEN
    RAISE EXCEPTION 'Chỉ được đổi invite_enabled; các cột kết quả do hệ thống tính';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_result_columns ON public.assessment_results;
CREATE TRIGGER trg_guard_result_columns
  BEFORE UPDATE ON public.assessment_results
  FOR EACH ROW EXECUTE FUNCTION public.guard_result_columns();

-- 3. Tính lại kết quả ------------------------------------------------------------------
-- Nguồn tính: bài Đã chấp nhận của HS/SV sau lần chốt gần nhất + điểm tự đánh giá của phiên.
CREATE OR REPLACE FUNCTION public.recalculate_result(p_result_id uuid, p_finalizing boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.assessment_results;
  v_self_weight numeric := COALESCE((public.get_parameter('self_weight'))::text::numeric, 0.5);
  v_levels jsonb := COALESCE(public.get_parameter('competency_levels'), '{"very_high":80,"high":65,"medium":50}'::jsonb);
  v_warn_ratio numeric := COALESCE((public.get_parameter('insufficient_basis_warning_ratio'))::text::numeric, 0.4);
  v_prev_final timestamptz;
  v_accepted integer;
  v_groups integer;
  v_expected integer;
  v_total_criteria integer;
  v_null_criteria integer;
  v_label public.result_status_label;
BEGIN
  SELECT * INTO r FROM public.assessment_results WHERE id = p_result_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'result_not_found'; END IF;
  IF r.finalized_at IS NOT NULL AND NOT p_finalizing THEN RETURN; END IF;   -- kết quả đã chốt thì khóa

  PERFORM set_config('app.internal_write', '1', true);

  SELECT max(finalized_at) INTO v_prev_final
    FROM public.assessment_results WHERE user_id = r.user_id AND id <> r.id AND finalized_at IS NOT NULL;

  DELETE FROM public.assessment_result_weights WHERE result_id = r.id;
  DELETE FROM public.assessment_result_scores WHERE result_id = r.id;

  -- Trọng số mỗi bài = điểm thấu hiểu / tổng điểm thấu hiểu * (1 - trọng số bản thân)
  INSERT INTO public.assessment_result_weights (result_id, submission_id, weight)
  SELECT r.id, s.id,
         round(s.understanding_score::numeric / SUM(s.understanding_score) OVER () * (1 - v_self_weight), 6)
    FROM public.assessment_360_submissions s
   WHERE s.subject_user_id = r.user_id AND s.status = 'accepted' AND s.understanding_score IS NOT NULL
     AND s.decided_at > COALESCE(v_prev_final, '-infinity'::timestamptz);

  SELECT count(*), count(DISTINCT s.rater_group) INTO v_accepted, v_groups
    FROM public.assessment_result_weights w JOIN public.assessment_360_submissions s ON s.id = w.submission_id
   WHERE w.result_id = r.id;

  -- Rater Score từng nguồn tại từng tiêu chí; câu "không đủ cơ sở" (NULL) bị bỏ qua
  WITH self_rs AS (
    SELECT a.criteria_id, avg(a.score)::numeric AS rs
      FROM public.assessment_answers a WHERE a.session_id = r.session_id AND a.score IS NOT NULL
     GROUP BY a.criteria_id
  ), sub_rs AS (
    SELECT s.rater_group, w.weight, a.criteria_id, avg(a.score)::numeric AS rs
      FROM public.assessment_result_weights w
      JOIN public.assessment_360_submissions s ON s.id = w.submission_id
      JOIN public.assessment_360_answers a ON a.submission_id = s.id AND a.score IS NOT NULL
     WHERE w.result_id = r.id
     GROUP BY s.id, s.rater_group, w.weight, a.criteria_id
  ), group_scores AS (
    SELECT criteria_id, rater_group::text AS score_source,
           SUM(weight * rs) / NULLIF(SUM(weight), 0) AS score
      FROM sub_rs GROUP BY criteria_id, rater_group
  ), combined AS (
    SELECT criteria_id, SUM(w * rs) / NULLIF(SUM(w), 0) AS score
      FROM (
        SELECT criteria_id, v_self_weight AS w, rs FROM self_rs
        UNION ALL
        SELECT criteria_id, weight, rs FROM sub_rs
      ) x GROUP BY criteria_id
  ), all_scores AS (
    SELECT criteria_id, 'self'::text AS score_source, rs AS score FROM self_rs
    UNION ALL SELECT criteria_id, score_source, score FROM group_scores
    UNION ALL SELECT criteria_id, 'combined_360', score FROM combined WHERE v_accepted > 0
  )
  INSERT INTO public.assessment_result_scores (result_id, criteria_id, score_source, score_1_5, score_percent, competency_level)
  SELECT r.id, criteria_id, score_source, round(score, 3), round(score / 5 * 100, 2),
         CASE WHEN score / 5 * 100 >= (v_levels ->> 'very_high')::numeric THEN 'very_high'
              WHEN score / 5 * 100 >= (v_levels ->> 'high')::numeric THEN 'high'
              WHEN score / 5 * 100 >= (v_levels ->> 'medium')::numeric THEN 'medium'
              ELSE 'low' END
    FROM all_scores WHERE score IS NOT NULL;

  SELECT COALESCE(sum(l.expected_count), 0) INTO v_expected
    FROM public.invitation_links l WHERE l.user_id = r.user_id AND l.revoked_at IS NULL;

  -- Tiêu chí thiếu dữ liệu: tổng hợp (hoặc tự đánh giá nếu chưa có 360°) không có điểm
  SELECT count(*) INTO v_total_criteria FROM public.criteria WHERE is_active;
  SELECT count(*) INTO v_null_criteria FROM public.criteria c
   WHERE c.is_active AND NOT EXISTS (
     SELECT 1 FROM public.assessment_result_scores sc
      WHERE sc.result_id = r.id AND sc.criteria_id = c.id
        AND sc.score_source = CASE WHEN v_accepted > 0 THEN 'combined_360' ELSE 'self' END);

  v_label := CASE WHEN p_finalizing THEN 'final_360'
                  WHEN v_accepted > 0 THEN 'temporary' ELSE 'self_assessment' END;

  UPDATE public.assessment_results SET
    status_label = v_label,
    accepted_count = v_accepted,
    expected_count = v_expected,
    groups_count = v_groups,
    thin_data_flag = (v_accepted = 1),
    insufficient_basis_warning = (v_total_criteria > 0 AND v_null_criteria::numeric / v_total_criteria > v_warn_ratio),
    calculated_at = now()
  WHERE id = r.id;

  INSERT INTO public.assessment_result_snapshots (result_id, user_id, status_label, snapshot_data)
  SELECT r.id, r.user_id, v_label, jsonb_build_object(
    'parameters', jsonb_build_object('self_weight', v_self_weight, 'competency_levels', v_levels),
    'framework_version_id', r.framework_version_id,
    'accepted_count', v_accepted,
    'weights', COALESCE((SELECT jsonb_agg(jsonb_build_object('submission_id', w.submission_id, 'weight', w.weight))
                           FROM public.assessment_result_weights w WHERE w.result_id = r.id), '[]'::jsonb),
    'scores', COALESCE((SELECT jsonb_agg(jsonb_build_object('criteria_id', sc.criteria_id, 'source', sc.score_source,
                                         'score_1_5', sc.score_1_5, 'score_percent', sc.score_percent, 'level', sc.competency_level))
                          FROM public.assessment_result_scores sc WHERE sc.result_id = r.id), '[]'::jsonb));
END;
$$;

-- Tính lại kết quả mới nhất của một HS/SV (dùng khi có bài mới được chấp nhận/loại)
CREATE OR REPLACE FUNCTION public.recalculate_latest_result(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.assessment_results
   WHERE user_id = p_user AND finalized_at IS NULL ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NOT NULL THEN
    PERFORM public.recalculate_result(v_id);
    PERFORM public.push_notification(p_user, 'result_changed', 'Kết quả đánh giá đã được cập nhật', NULL,
      jsonb_build_object('result_id', v_id));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalculate_on_decision()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('accepted', 'rejected') AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.recalculate_latest_result(NEW.subject_user_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_recalculate_on_decision ON public.assessment_360_submissions;
CREATE TRIGGER trg_recalculate_on_decision
  AFTER UPDATE OF status ON public.assessment_360_submissions
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_on_decision();

-- 4. Hoàn thành tự đánh giá: tạo kết quả với nhãn "Tự đánh giá" ---------------------------------
CREATE OR REPLACE FUNCTION public.complete_self_assessment(p_session_id uuid, p_invite_enabled boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_sessions;
  v_result uuid;
BEGIN
  SELECT * INTO s FROM public.assessment_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR s.user_id <> auth.uid() THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF s.status = 'expired' THEN RAISE EXCEPTION 'session_expired'; END IF;

  UPDATE public.assessment_sessions
     SET status = 'completed', completed_at = COALESCE(completed_at, now()), draft_expires_at = NULL
   WHERE id = s.id;

  PERFORM set_config('app.internal_write', '1', true);
  INSERT INTO public.assessment_results (user_id, session_id, framework_version_id, invite_enabled)
  VALUES (s.user_id, s.id, s.framework_version_id, p_invite_enabled)
  ON CONFLICT (session_id) DO UPDATE SET invite_enabled = EXCLUDED.invite_enabled
  RETURNING id INTO v_result;

  PERFORM public.recalculate_result(v_result);
  PERFORM public.write_audit_log(auth.uid(), auth.uid(), 'complete_self_assessment', 'assessment_sessions', s.id, '{}'::jsonb);
  RETURN v_result;
END;
$$;

-- 5. Chốt kết quả ----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_result_internal(p_result_id uuid, p_mode text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.assessment_results;
BEGIN
  SELECT * INTO r FROM public.assessment_results WHERE id = p_result_id FOR UPDATE;
  IF NOT FOUND OR r.finalized_at IS NOT NULL THEN RETURN; END IF;
  PERFORM set_config('app.internal_write', '1', true);
  PERFORM public.recalculate_result(r.id, true);
  UPDATE public.assessment_results SET finalized_at = now(), finalized_mode = p_mode WHERE id = r.id;
  PERFORM public.push_notification(r.user_id, 'result_finalized', 'Kết quả đánh giá 360° đã được chốt', NULL,
    jsonb_build_object('result_id', r.id, 'mode', p_mode));
  PERFORM public.write_audit_log(CASE WHEN p_mode = 'manual' THEN r.user_id END, r.user_id,
    'finalize_result', 'assessment_results', r.id, jsonb_build_object('mode', p_mode));
END;
$$;

-- HS/SV chốt thủ công: cần ít nhất 1 bài Đã chấp nhận
CREATE OR REPLACE FUNCTION public.finalize_my_result(p_result_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.assessment_results;
BEGIN
  SELECT * INTO r FROM public.assessment_results WHERE id = p_result_id;
  IF NOT FOUND OR r.user_id <> auth.uid() THEN RAISE EXCEPTION 'result_not_found'; END IF;
  IF r.finalized_at IS NOT NULL THEN RAISE EXCEPTION 'already_finalized'; END IF;
  IF r.accepted_count < 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_accepted_submission');
  END IF;
  PERFORM public.finalize_result_internal(r.id, 'manual');
  RETURN jsonb_build_object('ok', true, 'thin_data', r.accepted_count = 1);
END;
$$;

-- Chốt tự động: mọi đường dẫn đang mở đã đủ bài được chấp nhận hoặc đã hết hạn, và có >= 1 bài chấp nhận.
-- Hết hạn mà chưa có bài nào được chấp nhận thì giữ nhãn "Tự đánh giá". Gọi định kỳ (pg_cron / Edge Function).
CREATE OR REPLACE FUNCTION public.auto_finalize_results()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT res.id, res.user_id FROM public.assessment_results res
     WHERE res.finalized_at IS NULL AND res.invite_enabled AND res.accepted_count >= 1
       AND EXISTS (SELECT 1 FROM public.invitation_links l WHERE l.user_id = res.user_id AND l.revoked_at IS NULL)
       AND NOT EXISTS (
         SELECT 1 FROM public.invitation_links l
          WHERE l.user_id = res.user_id AND l.revoked_at IS NULL AND l.expires_at > now()
            AND (SELECT count(*) FROM public.assessment_360_submissions s
                  WHERE s.invitation_link_id = l.id AND s.status = 'accepted') < l.expected_count)
  LOOP
    PERFORM public.finalize_result_internal(r.id, 'auto');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 6. Quyền thực thi -----------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.recalculate_result(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_latest_result(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_result_internal(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_finalize_results() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_self_assessment(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_my_result(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_self_assessment(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_my_result(uuid) TO authenticated;

-- ===== 20261027000700_phase1_schedule_auto_finalize.sql =====
-- ====================================================================
-- Phase 1 / Migration 7: Lịch chạy chốt kết quả tự động (mỗi giờ)
-- Dùng pg_cron nên đi cùng schema khi chuyển từ Supabase Cloud sang VPS tự host.
-- Nếu môi trường chưa có pg_cron thì bỏ qua, không làm hỏng migration.
-- ====================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    -- cron.schedule theo tên job: chạy lại sẽ cập nhật chứ không tạo trùng
    PERFORM cron.schedule(
      'auto-finalize-results',
      '0 * * * *',
      $job$SELECT public.auto_finalize_results()$job$
    );
  ELSE
    RAISE NOTICE 'pg_cron chưa có: hãy bật extension pg_cron rồi chạy lại migration này';
  END IF;
END $$;

-- ===== 20261027000800_phase1_align_scoring_rules.sql =====
-- ====================================================================
-- Phase 1 / Migration 8: Đồng bộ với quy tắc tính điểm (Scoring Rule) của tài liệu đặc tả
-- R02B trọng số bài w = TH% x S | R03 chuẩn hóa trọng số theo từng tiêu chí | R04 điểm nhóm
-- R14 chỉ số tin cậy | R21 ngưỡng ẩn danh nhóm | P07 số câu mỗi tiêu chí của người được mời
-- ====================================================================

-- 1. Tham số vận hành (P05, P07-P13, P26, P27, P39) -------------------------------
INSERT INTO public.operation_parameters (param_code, param_name, param_value)
SELECT v.c, v.n, v.val::jsonb
FROM (VALUES
  ('trust_seconds_per_question', 'Thời gian tối thiểu mỗi câu (giây)', '3'),
  ('trust_idle_gap_seconds', 'Quãng bỏ máy không tính vào thời gian (giây)', '120'),
  ('trust_dispersion_coefficient', 'Hệ số phân tán D', '0.3'),
  ('trust_min_criteria', 'Số tiêu chí tối thiểu để xét D', '7'),
  ('trust_label_trusted', 'Ngưỡng nhãn Tin cậy', '0.7'),
  ('trust_label_consider', 'Ngưỡng nhãn Cần cân nhắc', '0.4'),
  ('trust_min_time_ratio', 'T tối thiểu', '0.5'),
  ('invitee_questions_per_criterion', 'Số câu mỗi tiêu chí của người được mời', '1'),
  ('min_submissions_group_display', 'Số bài tối thiểu để hiện điểm nhóm người chấm', '2'),
  ('min_submissions_other_display', 'Số bài tối thiểu của nhóm Người khác', '2'),
  ('min_accepted_to_finalize', 'Số bài tối thiểu để cho phép chốt', '1'),
  ('confidence_high_coverage', 'Ngưỡng độ tin cậy mức Cao (Coverage)', '0.8'),
  ('confidence_medium_coverage', 'Ngưỡng độ tin cậy mức Trung bình (Coverage)', '0.6')
) AS v(c, n, val)
WHERE NOT EXISTS (SELECT 1 FROM public.operation_parameters p WHERE p.param_code = v.c);

CREATE OR REPLACE FUNCTION public.param_num(p_code text, p_default numeric)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v jsonb;
BEGIN
  SELECT param_value INTO v FROM public.operation_parameters WHERE param_code = p_code AND is_current;
  IF v IS NULL OR jsonb_typeof(v) <> 'number' THEN RETURN p_default; END IF;
  RETURN (v #>> '{}')::numeric;
END;
$$;
REVOKE ALL ON FUNCTION public.param_num(text, numeric) FROM PUBLIC;

-- 2. Cột và bảng bổ sung ---------------------------------------------------------------
-- S: điểm hiểu biết bổ sung (0-100) chấm từ câu hỏi mở; chưa có thì coi là 100 (trung tính)
ALTER TABLE public.assessment_360_submissions
  ADD COLUMN IF NOT EXISTS understanding_quality_score numeric(5,2)
    CHECK (understanding_quality_score IS NULL OR understanding_quality_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS trust_index numeric(5,2),
  ADD COLUMN IF NOT EXISTS trust_label text CHECK (trust_label IN ('trusted', 'consider', 'suggest_reject'));

DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.assessment_result_scores'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%score_source%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.assessment_result_scores DROP CONSTRAINT %I', c);
  END IF;
  ALTER TABLE public.assessment_result_scores ADD CONSTRAINT assessment_result_scores_score_source_check
    CHECK (score_source IN ('self', 'parent', 'friend', 'teacher', 'mentor', 'others', 'combined_360'));
END $$;

-- Độ phủ và độ tin cậy của từng tiêu chí (R10, R11; BR-041, BR-042)
ALTER TABLE public.assessment_result_scores
  ADD COLUMN IF NOT EXISTS coverage numeric(4,3),
  ADD COLUMN IF NOT EXISTS confidence text CHECK (confidence IN ('high', 'medium', 'low'));

-- Điểm nhóm năng lực G1-G7 (R04) cho biểu đồ radar
CREATE TABLE IF NOT EXISTS public.assessment_result_group_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  result_id uuid NOT NULL REFERENCES public.assessment_results(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.criteria_groups(id) ON DELETE RESTRICT,
  score_source text NOT NULL CHECK (score_source IN ('self', 'combined_360')),
  score_1_5 numeric(4,3),
  score_percent numeric(5,2),
  competency_level text CHECK (competency_level IN ('very_high', 'high', 'medium', 'low')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT assessment_result_group_scores_unique UNIQUE (result_id, group_id, score_source)
);
DROP TRIGGER IF EXISTS set_assessment_result_group_scores_updated_at ON public.assessment_result_group_scores;
CREATE TRIGGER set_assessment_result_group_scores_updated_at
  BEFORE UPDATE ON public.assessment_result_group_scores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.assessment_result_group_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read permitted group scores" ON public.assessment_result_group_scores;
CREATE POLICY "Read permitted group scores" ON public.assessment_result_group_scores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessment_results r WHERE r.id = result_id AND public.can_view_result_of(r.user_id)));

-- 3. Câu hỏi cho người được mời: P07 câu mỗi tiêu chí, chọn ổn định theo resume_token ---------
CREATE OR REPLACE FUNCTION public.get_360_questions(p_resume_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_360_submissions;
  v_segment text;
  v_per_criterion integer := public.param_num('invitee_questions_per_criterion', 1)::integer;
BEGIN
  SELECT * INTO s FROM public.assessment_360_submissions WHERE resume_token = p_resume_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'submission_not_found'; END IF;
  SELECT CASE role WHEN 'university_student' THEN 'university_student' ELSE 'student' END
    INTO v_segment FROM public.user_profiles WHERE id = s.subject_user_id;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'question_id', x.id, 'criteria_id', x.criteria_id,
             'dimension_code', x.dimension_code, 'content', x.content, 'answer_options', x.answer_options
           ) ORDER BY x.sort_order, x.question_code)
      FROM (
        SELECT q.id, q.criteria_id, c.dimension_code, c.sort_order, q.question_code, q.content, q.answer_options,
               row_number() OVER (PARTITION BY q.criteria_id ORDER BY md5(p_resume_token || q.question_code)) AS rn
          FROM public.questions q
          JOIN public.criteria c ON c.id = q.criteria_id AND c.is_active
          JOIN public.criteria_rater_visibility v
            ON v.criteria_id = c.id AND v.rater_group = s.rater_group AND v.is_visible
         WHERE q.rater_group = s.rater_group AND q.is_active
           AND q.respondent_segment IN ('all', v_segment)
      ) x WHERE x.rn <= v_per_criterion
  ), '[]'::jsonb);
END;
$$;

-- 4. Nộp bài + chỉ số tin cậy R14 -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_360(p_resume_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.assessment_360_submissions;
  l public.invitation_links;
  v_required uuid[];
  v_answered uuid[];
  v_missing uuid[];
  v_seconds integer;
  v_n_questions integer;
  v_scored integer;
  v_na integer;
  v_total integer;
  v_most_common integer;
  v_t numeric;
  v_d numeric := 1;
  v_a numeric;
  v_p numeric := 0;
  v_trust numeric;
  v_min_criteria integer := public.param_num('trust_min_criteria', 7)::integer;
  v_force_reject boolean := false;
  v_flag text := 'ok';
  v_label text;
BEGIN
  SELECT * INTO s FROM public.assessment_360_submissions WHERE resume_token = p_resume_token FOR UPDATE;
  IF NOT FOUND OR s.status <> 'draft' THEN RAISE EXCEPTION 'submission_not_editable'; END IF;
  SELECT * INTO l FROM public.invitation_links WHERE id = s.invitation_link_id;
  IF l.revoked_at IS NOT NULL OR l.expires_at <= now() THEN RAISE EXCEPTION 'invitation_unavailable'; END IF;

  SELECT array_agg((x ->> 'question_id')::uuid) INTO v_required
    FROM jsonb_array_elements(public.get_360_questions(p_resume_token)) x;
  SELECT array_agg(question_id) INTO v_answered FROM public.assessment_360_answers WHERE submission_id = s.id;
  SELECT array_agg(q) INTO v_missing
    FROM unnest(COALESCE(v_required, ARRAY[]::uuid[])) q
   WHERE q <> ALL (COALESCE(v_answered, ARRAY[]::uuid[]));
  IF v_missing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_answers', 'missing_question_ids', to_jsonb(v_missing));
  END IF;

  -- T: thời gian làm thực / (số câu x thời gian tối thiểu mỗi câu). Chưa đo được quãng bỏ máy nên dùng tổng thời gian.
  v_seconds := extract(epoch FROM (now() - s.started_at))::integer;
  v_n_questions := COALESCE(array_length(v_required, 1), 0);
  v_t := CASE WHEN v_n_questions = 0 THEN 1
              ELSE LEAST(v_seconds::numeric / (v_n_questions * public.param_num('trust_seconds_per_question', 3)), 1) END;

  SELECT count(*) FILTER (WHERE score IS NOT NULL), count(*) FILTER (WHERE is_insufficient_basis), count(*)
    INTO v_scored, v_na, v_total
    FROM public.assessment_360_answers WHERE submission_id = s.id;

  -- D: độ phân tán; p = tỷ lệ tiêu chí cùng mức điểm phổ biến nhất
  IF v_scored >= v_min_criteria THEN
    SELECT max(c) INTO v_most_common FROM (
      SELECT count(*) AS c FROM public.assessment_360_answers
       WHERE submission_id = s.id AND score IS NOT NULL GROUP BY score) t;
    v_p := v_most_common::numeric / v_scored;
    v_d := LEAST((1 - v_p) / public.param_num('trust_dispersion_coefficient', 0.3), 1);
  END IF;

  v_a := CASE WHEN v_total = 0 THEN 1 ELSE 1 - v_na::numeric / v_total END;
  v_trust := (v_t + v_d + v_a) / 3;

  -- Luôn "Đề xuất loại": mọi tiêu chí cùng một mức (đủ số tiêu chí), hoặc làm quá nhanh
  v_force_reject := (v_scored >= v_min_criteria AND v_p = 1) OR v_t < public.param_num('trust_min_time_ratio', 0.5);
  v_flag := CASE WHEN v_t < public.param_num('trust_min_time_ratio', 0.5) AND v_scored >= v_min_criteria AND v_p = 1 THEN 'both'
                 WHEN v_t < public.param_num('trust_min_time_ratio', 0.5) THEN 'too_fast'
                 WHEN v_scored >= v_min_criteria AND v_p = 1 THEN 'uniform_scores' ELSE 'ok' END;
  v_label := CASE WHEN v_force_reject OR v_trust < public.param_num('trust_label_consider', 0.4) THEN 'suggest_reject'
                  WHEN v_trust >= public.param_num('trust_label_trusted', 0.7) THEN 'trusted'
                  ELSE 'consider' END;

  UPDATE public.assessment_360_submissions
     SET status = 'pending', quality_flag = v_flag, trust_index = round(v_trust * 100, 2), trust_label = v_label,
         completion_seconds = v_seconds, submitted_at = now()
   WHERE id = s.id;

  PERFORM public.push_notification(s.subject_user_id, 'new_submission', 'Có bài đánh giá mới',
    NULL, jsonb_build_object('submission_id', s.id, 'rater_group', s.rater_group));
  PERFORM public.write_audit_log(NULL, s.subject_user_id, 'submit_360', 'assessment_360_submissions', s.id,
    jsonb_build_object('quality_flag', v_flag, 'trust_label', v_label));

  RETURN jsonb_build_object('ok', true, 'quality_flag', v_flag, 'trust_label', v_label,
                            'trust_index', round(v_trust * 100, 2));
END;
$$;

-- 5. Chốt: số bài tối thiểu theo tham số (P39) ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_my_result(p_result_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.assessment_results;
  v_min integer := public.param_num('min_accepted_to_finalize', 1)::integer;
BEGIN
  SELECT * INTO r FROM public.assessment_results WHERE id = p_result_id;
  IF NOT FOUND OR r.user_id <> auth.uid() THEN RAISE EXCEPTION 'result_not_found'; END IF;
  IF r.finalized_at IS NOT NULL THEN RAISE EXCEPTION 'already_finalized'; END IF;
  IF r.accepted_count < v_min THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_accepted_submission');
  END IF;
  PERFORM public.finalize_result_internal(r.id, 'manual');
  RETURN jsonb_build_object('ok', true, 'thin_data', r.accepted_count = 1);
END;
$$;

-- 6. Tính lại kết quả theo R02, R02B, R03, R04, R21 -----------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_result(p_result_id uuid, p_finalizing boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.assessment_results;
  p3 numeric := public.param_num('self_weight', 0.5);
  p26 integer := public.param_num('min_submissions_group_display', 2)::integer;
  p27 integer := public.param_num('min_submissions_other_display', 2)::integer;
  v_levels jsonb := COALESCE(public.get_parameter('competency_levels'), '{"very_high":80,"high":65,"medium":50}'::jsonb);
  v_warn_ratio numeric := public.param_num('insufficient_basis_warning_ratio', 0.4);
  v_prev_final timestamptz;
  v_accepted integer;
  v_groups integer;
  v_expected integer;
  v_total_criteria integer;
  v_null_criteria integer;
  v_label public.result_status_label;
BEGIN
  SELECT * INTO r FROM public.assessment_results WHERE id = p_result_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'result_not_found'; END IF;
  IF r.finalized_at IS NOT NULL AND NOT p_finalizing THEN RETURN; END IF;

  PERFORM set_config('app.internal_write', '1', true);

  SELECT max(finalized_at) INTO v_prev_final
    FROM public.assessment_results WHERE user_id = r.user_id AND id <> r.id AND finalized_at IS NOT NULL;

  DELETE FROM public.assessment_result_weights WHERE result_id = r.id;
  DELETE FROM public.assessment_result_scores WHERE result_id = r.id;
  DELETE FROM public.assessment_result_group_scores WHERE result_id = r.id;

  -- w_i = TH%_i x S_i ; S chưa có thì coi là 100 ; tổng bằng 0 thì chia đều
  CREATE TEMP TABLE IF NOT EXISTS _calc_base (
    submission_id uuid, rater_group text, w numeric
  ) ON COMMIT DROP;
  TRUNCATE _calc_base;
  INSERT INTO _calc_base
  SELECT s.id, s.rater_group::text,
         CASE WHEN SUM(raw) OVER () > 0 THEN raw ELSE 1 END
    FROM (
      SELECT s2.id, s2.rater_group,
             ((COALESCE(s2.understanding_score, 3) - 3) / 9.0 * 100) * COALESCE(s2.understanding_quality_score, 100) AS raw
        FROM public.assessment_360_submissions s2
       WHERE s2.subject_user_id = r.user_id AND s2.status = 'accepted'
         AND s2.decided_at > COALESCE(v_prev_final, '-infinity'::timestamptz)
    ) s(id, rater_group, raw);

  -- Trọng số tổng quát mỗi bài (hiển thị/bản chụp); điểm tiêu chí dùng trọng số chuẩn hóa riêng từng tiêu chí
  INSERT INTO public.assessment_result_weights (result_id, submission_id, weight)
  SELECT r.id, b.submission_id, round(b.w / SUM(b.w) OVER () * (1 - p3), 6) FROM _calc_base b;

  SELECT count(*), count(DISTINCT rater_group) INTO v_accepted, v_groups FROM _calc_base;

  WITH self_rs AS (
    SELECT a.criteria_id, avg(a.score)::numeric AS rs
      FROM public.assessment_answers a WHERE a.session_id = r.session_id AND a.score IS NOT NULL
     GROUP BY a.criteria_id
  ), sub_rs AS (
    SELECT b.submission_id, b.rater_group, b.w, a.criteria_id, avg(a.score)::numeric AS rs
      FROM _calc_base b
      JOIN public.assessment_360_answers a ON a.submission_id = b.submission_id AND a.score IS NOT NULL
     GROUP BY b.submission_id, b.rater_group, b.w, a.criteria_id
  ), ext AS (   -- R03: chuẩn hóa trọng số các nguồn ngoài hợp lệ về (1 - P03) tại mỗi tiêu chí
    SELECT criteria_id, rater_group, rs,
           CASE WHEN SUM(w) OVER (PARTITION BY criteria_id) > 0
                THEN w / SUM(w) OVER (PARTITION BY criteria_id)
                ELSE 1.0 / count(*) OVER (PARTITION BY criteria_id) END * (1 - p3) AS ww
      FROM sub_rs
  ), combined AS (
    SELECT criteria_id, SUM(w * rs) / NULLIF(SUM(w), 0) AS score
      FROM (SELECT criteria_id, p3 AS w, rs FROM self_rs
            UNION ALL SELECT criteria_id, ww, rs FROM ext) x
     GROUP BY criteria_id
  ), src AS (   -- R21: nhóm đủ P26 bài hiện riêng; nhóm ít bài gộp vào "Người khác" (cần P27 bài)
    SELECT s.criteria_id, s.rs, s.w, s.submission_id,
           CASE WHEN g.n >= p26 THEN s.rater_group ELSE 'others' END AS source
      FROM sub_rs s JOIN (SELECT rater_group, count(*) AS n FROM _calc_base GROUP BY rater_group) g
        ON g.rater_group = s.rater_group
  ), src_cnt AS (
    SELECT CASE WHEN g.n >= p26 THEN b.rater_group ELSE 'others' END AS source, count(*) AS cnt
      FROM _calc_base b JOIN (SELECT rater_group, count(*) AS n FROM _calc_base GROUP BY rater_group) g
        ON g.rater_group = b.rater_group
     GROUP BY 1
  ), group_scores AS (
    SELECT s.criteria_id, s.source AS score_source, SUM(s.rs * s.w) / NULLIF(SUM(s.w), 0) AS score
      FROM src s JOIN src_cnt c ON c.source = s.source
     WHERE c.cnt >= CASE WHEN s.source = 'others' THEN p27 ELSE p26 END
     GROUP BY s.criteria_id, s.source
  ), all_scores AS (
    SELECT criteria_id, 'self'::text AS score_source, rs AS score FROM self_rs
    UNION ALL SELECT criteria_id, score_source, score FROM group_scores
    UNION ALL SELECT criteria_id, 'combined_360', score FROM combined WHERE v_accepted > 0
  )
  INSERT INTO public.assessment_result_scores (result_id, criteria_id, score_source, score_1_5, score_percent, competency_level)
  SELECT r.id, criteria_id, score_source, round(score, 3), round(score / 5 * 100, 2),
         CASE WHEN score / 5 * 100 >= (v_levels ->> 'very_high')::numeric THEN 'very_high'
              WHEN score / 5 * 100 >= (v_levels ->> 'high')::numeric THEN 'high'
              WHEN score / 5 * 100 >= (v_levels ->> 'medium')::numeric THEN 'medium'
              ELSE 'low' END
    FROM all_scores WHERE score IS NOT NULL;

  -- R04: điểm nhóm = trung bình cộng điểm các tiêu chí có dữ liệu trong nhóm (trọng số đều, P36)
  INSERT INTO public.assessment_result_group_scores (result_id, group_id, score_source, score_1_5, score_percent, competency_level)
  SELECT r.id, c.group_id, sc.score_source, round(avg(sc.score_1_5), 3), round(avg(sc.score_1_5) / 5 * 100, 2),
         CASE WHEN avg(sc.score_1_5) / 5 * 100 >= (v_levels ->> 'very_high')::numeric THEN 'very_high'
              WHEN avg(sc.score_1_5) / 5 * 100 >= (v_levels ->> 'high')::numeric THEN 'high'
              WHEN avg(sc.score_1_5) / 5 * 100 >= (v_levels ->> 'medium')::numeric THEN 'medium'
              ELSE 'low' END
    FROM public.assessment_result_scores sc JOIN public.criteria c ON c.id = sc.criteria_id
   WHERE sc.result_id = r.id AND sc.score_source IN ('self', 'combined_360')
   GROUP BY c.group_id, sc.score_source;

  SELECT COALESCE(sum(l.expected_count), 0) INTO v_expected
    FROM public.invitation_links l WHERE l.user_id = r.user_id AND l.revoked_at IS NULL;

  SELECT count(*) INTO v_total_criteria FROM public.criteria WHERE is_active;
  SELECT count(*) INTO v_null_criteria FROM public.criteria c
   WHERE c.is_active AND NOT EXISTS (
     SELECT 1 FROM public.assessment_result_scores sc
      WHERE sc.result_id = r.id AND sc.criteria_id = c.id
        AND sc.score_source = CASE WHEN v_accepted > 0 THEN 'combined_360' ELSE 'self' END);

  -- R10/R11: Coverage = số nhóm người đánh giá cốt lõi có điểm hợp lệ / số nhóm được phân công (Ma trận tiêu chí).
  -- Tỷ lệ "không đủ cơ sở" vượt ngưỡng thì mọi tiêu chí hạ xuống Low (không đổi điểm).
  UPDATE public.assessment_result_scores sc SET
    coverage = round(LEAST(cv.valid_groups::numeric / GREATEST(cv.expected, 1), 1), 3),
    confidence = CASE
      WHEN v_total_criteria > 0 AND v_null_criteria::numeric / v_total_criteria > v_warn_ratio THEN 'low'
      WHEN cv.valid_groups::numeric / GREATEST(cv.expected, 1) >= public.param_num('confidence_high_coverage', 0.8) THEN 'high'
      WHEN cv.valid_groups::numeric / GREATEST(cv.expected, 1) >= public.param_num('confidence_medium_coverage', 0.6) THEN 'medium'
      ELSE 'low' END
  FROM (
    SELECT c.id AS criteria_id,
           (SELECT count(*) FROM public.criteria_rater_visibility v WHERE v.criteria_id = c.id AND v.is_visible) AS expected,
           (SELECT CASE WHEN count(*) > 0 THEN 1 ELSE 0 END FROM public.assessment_answers a
             WHERE a.session_id = r.session_id AND a.criteria_id = c.id AND a.score IS NOT NULL)
           + (SELECT count(DISTINCT b.rater_group) FROM _calc_base b
               JOIN public.assessment_360_answers a ON a.submission_id = b.submission_id
                AND a.criteria_id = c.id AND a.score IS NOT NULL) AS valid_groups
      FROM public.criteria c WHERE c.is_active
  ) cv
  WHERE sc.result_id = r.id AND sc.criteria_id = cv.criteria_id
    AND sc.score_source = CASE WHEN v_accepted > 0 THEN 'combined_360' ELSE 'self' END;

  v_label := CASE WHEN p_finalizing THEN 'final_360'
                  WHEN v_accepted > 0 THEN 'temporary' ELSE 'self_assessment' END;

  UPDATE public.assessment_results SET
    status_label = v_label, accepted_count = v_accepted, expected_count = v_expected, groups_count = v_groups,
    thin_data_flag = (v_accepted = 1),
    insufficient_basis_warning = (v_total_criteria > 0 AND v_null_criteria::numeric / v_total_criteria > v_warn_ratio),
    calculated_at = now()
  WHERE id = r.id;

  INSERT INTO public.assessment_result_snapshots (result_id, user_id, status_label, snapshot_data)
  SELECT r.id, r.user_id, v_label, jsonb_build_object(
    'parameters', jsonb_build_object('self_weight', p3, 'competency_levels', v_levels,
                                     'min_submissions_group_display', p26, 'min_submissions_other_display', p27),
    'framework_version_id', r.framework_version_id,
    'accepted_count', v_accepted,
    'weights', COALESCE((SELECT jsonb_agg(jsonb_build_object('submission_id', w.submission_id, 'weight', w.weight))
                           FROM public.assessment_result_weights w WHERE w.result_id = r.id), '[]'::jsonb),
    'scores', COALESCE((SELECT jsonb_agg(jsonb_build_object('criteria_id', sc.criteria_id, 'source', sc.score_source,
                                         'score_1_5', sc.score_1_5, 'score_percent', sc.score_percent, 'level', sc.competency_level,
                                         'coverage', sc.coverage, 'confidence', sc.confidence))
                          FROM public.assessment_result_scores sc WHERE sc.result_id = r.id), '[]'::jsonb),
    'group_scores', COALESCE((SELECT jsonb_agg(jsonb_build_object('group_id', gs.group_id, 'source', gs.score_source,
                                         'score_1_5', gs.score_1_5, 'score_percent', gs.score_percent, 'level', gs.competency_level))
                          FROM public.assessment_result_group_scores gs WHERE gs.result_id = r.id), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.recalculate_result(uuid, boolean) FROM PUBLIC;

-- ===== 20261027000900_phase1_lock_function_privileges.sql =====
-- ====================================================================
-- Phase 1 / Migration 9: Siết quyền thực thi hàm
-- Supabase mặc định cấp EXECUTE trên mọi hàm mới cho anon và authenticated, nên
-- REVOKE FROM PUBLIC là chưa đủ. Gỡ toàn bộ rồi chỉ cấp lại đúng các hàm được phép gọi.
-- ====================================================================

-- 1. Hàm tạo sau này mặc định không cấp cho anon/authenticated (phải GRANT rõ ràng)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- 2. Gỡ quyền trên mọi hàm hiện có trong schema public (trừ hàm của extension)
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prokind = 'f'
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

-- 3. API cho khách (không đăng nhập) và người đã đăng nhập
GRANT EXECUTE ON FUNCTION public.get_invitation_public(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_360_submission(text, text, text, smallint, smallint, smallint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_360_questions(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_360_answers(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_360(text) TO anon, authenticated;

-- 4. API chỉ cho người đã đăng nhập
GRANT EXECUTE ON FUNCTION public.decide_submission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_class_grid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_self_assessment(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_my_result(uuid) TO authenticated;

-- 5. Hàm hỗ trợ chính sách RLS (được gọi khi đánh giá policy với quyền của người dùng)
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_teacher(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_result_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_under_guardian_age(date) TO authenticated;

-- 6. service_role (Edge Function, script bảo trì) được gọi mọi hàm, gồm auto_finalize_results
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
  END IF;
END $$;
