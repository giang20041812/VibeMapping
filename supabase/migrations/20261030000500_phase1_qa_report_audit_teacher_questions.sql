-- ====================================================================
-- Phase 1 / Migration: sửa theo đợt kiểm thử
--
-- 1. Báo cáo lớp và trường trả member_count (mẫu số tiến độ tham gia). Migration 20261028000700 chưa từng chạy
--    trên database thật; bản ở đây giữ cách đếm "đã được chấm" theo từng học sinh của 20261028000400.
-- 2. Nhãn thang đo: một câu tự đánh giá ghi "Hoàn toàn không đúng", 499 câu cùng thang ghi "Hoàn toàn sai".
-- 3. Bảng lưới của giáo viên dùng câu hỏi của ngân hàng giáo viên (góc nhìn người khác) thay cho câu tự đánh giá
--    ngôi "Tôi": mỗi câu của gói ứng với câu giáo viên cùng tiêu chí, cùng số thứ tự (…-SELF-001 ↔ …-GV-001).
-- 4. Nhật ký: bật/tắt mời đánh giá 360, tạo và thu hồi đường dẫn mời, giáo viên chấm điểm và chọn gói câu hỏi.
-- 5. Tham số vận hành: changed_by mặc định là người đang đăng nhập; bỏ min_completion_seconds (không còn dùng:
--    submit_360 tính "làm quá nhanh" theo số câu × trust_seconds_per_question × trust_min_time_ratio).
-- ====================================================================

-- 1. Báo cáo lớp và trường ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_class_report(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school_id uuid;
  v_ids uuid[];
  v_joined integer;
  v_members integer;
  v_graded integer;
BEGIN
  SELECT school_id INTO v_school_id FROM public.classes WHERE id = p_class_id;
  IF v_school_id IS NULL THEN RAISE EXCEPTION 'class_not_found'; END IF;
  IF NOT (public.is_class_teacher(p_class_id) OR public.is_school_staff(v_school_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT array_agg(user_id), count(*) INTO v_ids, v_joined FROM public.class_members
   WHERE class_id = p_class_id AND member_role = 'student' AND status = 'joined' AND user_id IS NOT NULL;
  SELECT count(*) INTO v_members FROM public.class_members
   WHERE class_id = p_class_id AND member_role = 'student' AND status IN ('joined', 'invited');
  SELECT count(DISTINCT s.student_id) INTO v_graded
    FROM public.class_assessment_grid_students s JOIN public.class_assessment_grids g ON g.id = s.grid_id
   WHERE g.class_id = p_class_id AND s.submitted_at IS NOT NULL;

  RETURN public.build_group_report(COALESCE(v_ids, ARRAY[]::uuid[]))
         || jsonb_build_object('joined_count', v_joined, 'member_count', v_members, 'graded_count', v_graded);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_school_report(p_school_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ids uuid[];
  v_joined integer;
  v_members integer;
BEGIN
  IF NOT public.is_school_admin(p_school_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT array_agg(DISTINCT m.user_id), count(DISTINCT m.user_id) INTO v_ids, v_joined
    FROM public.class_members m JOIN public.classes c ON c.id = m.class_id
   WHERE c.school_id = p_school_id AND NOT c.is_archived
     AND m.member_role = 'student' AND m.status = 'joined' AND m.user_id IS NOT NULL;
  SELECT count(*) INTO v_members
    FROM public.class_members m JOIN public.classes c ON c.id = m.class_id
   WHERE c.school_id = p_school_id AND NOT c.is_archived
     AND m.member_role = 'student' AND m.status IN ('joined', 'invited');
  RETURN public.build_group_report(COALESCE(v_ids, ARRAY[]::uuid[]))
         || jsonb_build_object('joined_count', v_joined, 'member_count', v_members);
END;
$$;

-- 2. Nhãn thang đo thống nhất -----------------------------------------------------------------------------------
UPDATE public.questions
   SET answer_options = jsonb_set(answer_options, '{0}', '"Hoàn toàn sai"')
 WHERE answer_options ->> 0 = 'Hoàn toàn không đúng';

-- 3. Bảng lưới dùng câu hỏi của giáo viên -----------------------------------------------------------------------
/** Câu giáo viên ứng với một câu tự đánh giá: cùng tiêu chí, cùng số thứ tự ở cuối mã câu */
CREATE OR REPLACE VIEW public.teacher_question_for_self AS
SELECT s.id AS self_question_id, t.id AS teacher_question_id
  FROM public.questions s
  JOIN public.questions t
    ON t.criteria_id = s.criteria_id AND t.rater_group = 'teacher' AND t.is_active
   AND substring(t.question_code FROM '(\d+)$') = substring(s.question_code FROM '(\d+)$')
 WHERE s.rater_group = 'self';
REVOKE ALL ON public.teacher_question_for_self FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_grid_package(p_grid_id uuid, p_package_size smallint, p_question_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.class_assessment_grids;
  v_valid integer;
  v_ids uuid[];
BEGIN
  SELECT * INTO g FROM public.class_assessment_grids WHERE id = p_grid_id FOR UPDATE;
  IF NOT FOUND OR g.teacher_id <> auth.uid() OR NOT public.is_class_teacher(g.class_id) THEN
    RAISE EXCEPTION 'grid_not_found';
  END IF;
  IF g.status = 'submitted' THEN RAISE EXCEPTION 'grid_already_submitted'; END IF;
  IF EXISTS (SELECT 1 FROM public.class_assessment_grid_students WHERE grid_id = g.id AND submitted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'grid_has_submitted_students';
  END IF;
  IF p_package_size NOT IN (35, 50, 75) THEN RAISE EXCEPTION 'invalid_package_size'; END IF;
  IF COALESCE(array_length(p_question_ids, 1), 0) = 0 THEN RAISE EXCEPTION 'empty_package'; END IF;

  -- Gói được chọn theo câu tự đánh giá (cùng quy tắc với học sinh), rồi đổi sang câu của giáo viên
  SELECT count(DISTINCT q.id) INTO v_valid
    FROM public.questions q
    JOIN public.criteria c ON c.id = q.criteria_id AND c.is_active
   WHERE q.id = ANY (p_question_ids) AND q.is_active AND q.rater_group = 'self'
     AND NOT EXISTS (SELECT 1 FROM public.criteria_rater_visibility v
                      WHERE v.criteria_id = c.id AND v.rater_group = 'teacher' AND NOT v.is_visible);
  IF v_valid <> (SELECT count(DISTINCT x) FROM unnest(p_question_ids) x) THEN
    RAISE EXCEPTION 'invalid_package_questions';
  END IF;

  SELECT array_agg(m.teacher_question_id ORDER BY x.ord) INTO v_ids
    FROM unnest(p_question_ids) WITH ORDINALITY AS x(question_id, ord)
    JOIN public.teacher_question_for_self m ON m.self_question_id = x.question_id;
  IF COALESCE(array_length(v_ids, 1), 0) <> array_length(p_question_ids, 1) THEN
    RAISE EXCEPTION 'invalid_package_questions';
  END IF;

  DELETE FROM public.class_assessment_grid_details d
   USING public.class_assessment_grid_students s
   WHERE d.grid_student_id = s.id AND s.grid_id = g.id
     AND (d.question_id IS NULL OR d.question_id <> ALL (v_ids));

  DELETE FROM public.class_assessment_grid_questions WHERE grid_id = g.id AND question_id <> ALL (v_ids);
  INSERT INTO public.class_assessment_grid_questions (grid_id, question_id, sort_order)
  SELECT g.id, x.question_id, min(x.ord)::integer
    FROM unnest(v_ids) WITH ORDINALITY AS x(question_id, ord)
   GROUP BY x.question_id
  ON CONFLICT (grid_id, question_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;

  UPDATE public.class_assessment_grids SET package_size = p_package_size WHERE id = g.id;
  PERFORM public.write_audit_log(auth.uid(), NULL, 'set_grid_package', 'class_assessment_grids', g.id,
    jsonb_build_object('package_size', p_package_size, 'question_count', array_length(v_ids, 1)));
END;
$$;

-- Bảng lưới còn nháp đang dùng câu tự đánh giá: đổi câu và các ô đã chấm sang câu giáo viên tương ứng
UPDATE public.class_assessment_grid_questions gq
   SET question_id = m.teacher_question_id
  FROM public.teacher_question_for_self m, public.class_assessment_grids g
 WHERE gq.question_id = m.self_question_id AND g.id = gq.grid_id AND g.status = 'draft';

UPDATE public.class_assessment_grid_details d
   SET question_id = m.teacher_question_id
  FROM public.teacher_question_for_self m, public.class_assessment_grid_students s, public.class_assessment_grids g
 WHERE d.question_id = m.self_question_id AND s.id = d.grid_student_id AND g.id = s.grid_id AND g.status = 'draft';

-- 4. Nhật ký ---------------------------------------------------------------------------------------------------
-- 4a. Bật/tắt cho người khác đánh giá
CREATE OR REPLACE FUNCTION public.audit_invite_toggle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.invite_enabled IS DISTINCT FROM OLD.invite_enabled THEN
    PERFORM public.write_audit_log(auth.uid(), NEW.user_id,
      CASE WHEN NEW.invite_enabled THEN 'enable_invite_360' ELSE 'disable_invite_360' END,
      'assessment_results', NEW.id, '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_invite_toggle ON public.assessment_results;
CREATE TRIGGER trg_audit_invite_toggle AFTER UPDATE OF invite_enabled ON public.assessment_results
  FOR EACH ROW EXECUTE FUNCTION public.audit_invite_toggle();

-- 4b. Tạo và thu hồi đường dẫn mời
CREATE OR REPLACE FUNCTION public.audit_invitation_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_audit_log(auth.uid(), NEW.user_id, 'create_invitation_link', 'invitation_links', NEW.id,
      jsonb_build_object('rater_group', NEW.rater_group, 'expected_count', NEW.expected_count, 'expires_at', NEW.expires_at));
  ELSIF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
    PERFORM public.write_audit_log(auth.uid(), NEW.user_id, 'revoke_invitation_link', 'invitation_links', NEW.id,
      jsonb_build_object('rater_group', NEW.rater_group));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_invitation_link ON public.invitation_links;
CREATE TRIGGER trg_audit_invitation_link AFTER INSERT OR UPDATE OF revoked_at ON public.invitation_links
  FOR EACH ROW EXECUTE FUNCTION public.audit_invitation_link();

-- 4c. Giáo viên chấm điểm trên bảng lưới: mỗi lần lưu ghi một dòng cho từng học sinh; lưu tiếp cho cùng học sinh
--     trong 30 phút thì cộng dồn vào dòng đó (số ô đã đổi, lần lưu cuối) để nhật ký không thành một dòng mỗi ô
CREATE OR REPLACE FUNCTION public.audit_grid_grading()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;

  WITH changed_students AS (
    SELECT s.id AS grid_student_id, s.student_id, g.class_id, count(*) AS cells
      FROM changed c
      JOIN public.class_assessment_grid_students s ON s.id = c.grid_student_id
      JOIN public.class_assessment_grids g ON g.id = s.grid_id
     GROUP BY s.id, s.student_id, g.class_id
  ), merged AS (
    UPDATE public.audit_logs a
       SET details = a.details || jsonb_build_object(
             'cells', COALESCE((a.details ->> 'cells')::integer, 0) + cs.cells,
             'last_saved_at', now())
      FROM changed_students cs
     WHERE a.action = 'grade_class_student' AND a.actor_id = auth.uid()
       AND a.target_id = cs.grid_student_id AND a.created_at > now() - interval '30 minutes'
    RETURNING a.target_id
  )
  INSERT INTO public.audit_logs (actor_id, subject_user_id, action, target_type, target_id, ip_address, details)
  SELECT auth.uid(), cs.student_id, 'grade_class_student', 'class_assessment_grid_students', cs.grid_student_id,
         public.request_ip(), jsonb_build_object('class_id', cs.class_id, 'cells', cs.cells, 'last_saved_at', now())
    FROM changed_students cs
   WHERE cs.grid_student_id NOT IN (SELECT target_id FROM merged);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_grid_grading_insert ON public.class_assessment_grid_details;
DROP TRIGGER IF EXISTS trg_audit_grid_grading_update ON public.class_assessment_grid_details;
DROP TRIGGER IF EXISTS trg_audit_grid_grading_delete ON public.class_assessment_grid_details;
CREATE TRIGGER trg_audit_grid_grading_insert AFTER INSERT ON public.class_assessment_grid_details
  REFERENCING NEW TABLE AS changed FOR EACH STATEMENT EXECUTE FUNCTION public.audit_grid_grading();
CREATE TRIGGER trg_audit_grid_grading_update AFTER UPDATE ON public.class_assessment_grid_details
  REFERENCING NEW TABLE AS changed FOR EACH STATEMENT EXECUTE FUNCTION public.audit_grid_grading();
CREATE TRIGGER trg_audit_grid_grading_delete AFTER DELETE ON public.class_assessment_grid_details
  REFERENCING OLD TABLE AS changed FOR EACH STATEMENT EXECUTE FUNCTION public.audit_grid_grading();

-- 5. Tham số vận hành ------------------------------------------------------------------------------------------
ALTER TABLE public.operation_parameters ALTER COLUMN changed_by SET DEFAULT auth.uid();

DO $$
DECLARE r public.operation_parameters;
BEGIN
  FOR r IN SELECT * FROM public.operation_parameters WHERE param_code = 'min_completion_seconds' LOOP
    PERFORM public.write_audit_log(NULL, NULL, 'delete:operation_parameters', 'operation_parameters', r.id,
      to_jsonb(r) - 'created_at' - 'updated_at');
  END LOOP;
  DELETE FROM public.operation_parameters WHERE param_code = 'min_completion_seconds';
END $$;

-- 6. Phân quyền thực thi ---------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.audit_invite_toggle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_invitation_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_grid_grading() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_school_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_grid_package(uuid, smallint, uuid[]) TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
  END IF;
END $$;
