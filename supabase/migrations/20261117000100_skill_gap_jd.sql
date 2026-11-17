-- F08.02, F08.03: so hồ sơ năng lực của sinh viên với khung JD theo cấp; gợi ý theo kỹ năng còn thiếu.
-- Khớp kỹ năng: trước theo dòng yêu cầu của khung (framework_item_id), sau theo tên kỹ năng (khi quản trị sửa khung, dòng được tạo lại).

-- 1. Hồ sơ năng lực: thêm loại Kiến thức, Công cụ, Ngoại ngữ cho khớp các mục yêu cầu của khung JD
ALTER TABLE public.skill_profile_items DROP CONSTRAINT IF EXISTS skill_profile_items_kind_check;
ALTER TABLE public.skill_profile_items ADD CONSTRAINT skill_profile_items_kind_check
  CHECK (kind IN ('soft_skill', 'hard_skill', 'knowledge', 'tool', 'language', 'certificate', 'project', 'experience'));
ALTER TABLE public.skill_profile_items
  ADD COLUMN IF NOT EXISTS framework_item_id uuid REFERENCES public.career_level_framework_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS skill_profile_items_owner_idx ON public.skill_profile_items(owner_id);

-- 2. Gợi ý khóa học, dự án, chứng chỉ: từ khóa kỹ năng để khớp với kỹ năng còn thiếu của JD
ALTER TABLE public.course_project_suggestions
  ADD COLUMN IF NOT EXISTS skill_keywords text[] NOT NULL DEFAULT '{}';

-- 3. Bản chụp mỗi lần phân tích (FR08.02.02): mức đạt tổng thể, số kỹ năng theo kết quả, chi tiết từng kỹ năng
CREATE TABLE IF NOT EXISTS public.skill_gap_analyses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  framework_id uuid REFERENCES public.career_level_frameworks(id) ON DELETE SET NULL,
  career_id uuid REFERENCES public.careers(id) ON DELETE SET NULL,
  position_name text NOT NULL CHECK (length(trim(position_name)) > 0),
  overall_percent numeric(5, 2) NOT NULL CHECK (overall_percent BETWEEN 0 AND 100),
  met_count integer NOT NULL DEFAULT 0 CHECK (met_count >= 0),
  near_count integer NOT NULL DEFAULT 0 CHECK (near_count >= 0),
  unmet_count integer NOT NULL DEFAULT 0 CHECK (unmet_count >= 0),
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS skill_gap_analyses_owner_idx ON public.skill_gap_analyses(owner_id, created_at DESC);
ALTER TABLE public.skill_gap_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads skill gap analyses" ON public.skill_gap_analyses;
CREATE POLICY "Owner reads skill gap analyses" ON public.skill_gap_analyses FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "Student saves skill gap analyses" ON public.skill_gap_analyses;
CREATE POLICY "Student saves skill gap analyses" ON public.skill_gap_analyses FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'university_student');
DROP POLICY IF EXISTS "Owner deletes skill gap analyses" ON public.skill_gap_analyses;
CREATE POLICY "Owner deletes skill gap analyses" ON public.skill_gap_analyses FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- 4. Tham số: trọng số theo mức ảnh hưởng và mức yêu cầu mặc định khi khung chưa ghi (SRS UI_08-S06 ghi "cần xác nhận")
INSERT INTO public.operation_parameters (param_code, param_name, param_value, verification_level)
SELECT v.c, v.n, v.val::jsonb, 'pending_ba'
FROM (VALUES
  ('skill_gap_impact_weights', 'Trọng số mức ảnh hưởng khi tính mức đạt so với JD', '{"required": 3, "common": 2, "advantage": 1}'),
  ('skill_gap_default_required_level', 'Mức yêu cầu mặc định của kỹ năng JD khi khung chưa ghi', '3')
) AS v(c, n, val)
WHERE NOT EXISTS (SELECT 1 FROM public.operation_parameters p WHERE p.param_code = v.c);
