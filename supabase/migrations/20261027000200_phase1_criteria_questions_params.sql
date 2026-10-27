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
