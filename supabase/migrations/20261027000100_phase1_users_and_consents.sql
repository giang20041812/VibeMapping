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
