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
