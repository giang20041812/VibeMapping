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
