-- 12 mục tài liệu đã chốt, trừ chọn vai trò lúc đăng ký (FR01.01.01).

-- FR04.01.04: mức tăng trưởng do quản trị ghi. Lương, môi trường, trình độ lấy từ JD đã có.
ALTER TABLE public.careers ADD COLUMN IF NOT EXISTS growth_level text;

-- FR07.01.02: điểm xuất phát của lộ trình
ALTER TABLE public.roadmaps
  ADD COLUMN IF NOT EXISTS education_level text,
  ADD COLUMN IF NOT EXISTS school_year text,
  ADD COLUMN IF NOT EXISTS current_skills text,
  ADD COLUMN IF NOT EXISTS certificates text,
  ADD COLUMN IF NOT EXISTS extracurricular text;

-- BR-M09-003
ALTER TABLE public.career_events
  ADD COLUMN IF NOT EXISTS seat_limit integer CHECK (seat_limit IS NULL OR seat_limit > 0),
  ADD COLUMN IF NOT EXISTS registration_deadline timestamptz;

-- FR09.01.09
CREATE TABLE IF NOT EXISTS public.community_topics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) >= 2),
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.community_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read community topics" ON public.community_topics;
CREATE POLICY "Read community topics" ON public.community_topics FOR SELECT TO authenticated USING (true);

-- R10: tử số là số người có điểm, không đếm gộp theo nhóm.
CREATE OR REPLACE FUNCTION public.apply_person_coverage()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_session uuid;
  v_user uuid;
  v_expected integer;
  v_people integer;
  v_ratio numeric;
BEGIN
  IF NEW.score_source NOT IN ('self', 'combined_360') THEN RETURN NEW; END IF;
  SELECT session_id, user_id INTO v_session, v_user FROM public.assessment_results WHERE id = NEW.result_id;
  SELECT count(*) INTO v_expected
    FROM public.criteria_rater_visibility v
   WHERE v.criteria_id = NEW.criteria_id AND v.is_visible;
  SELECT
    (SELECT CASE WHEN count(*) > 0 THEN 1 ELSE 0 END
       FROM public.assessment_answers a
      WHERE a.session_id = v_session AND a.criteria_id = NEW.criteria_id AND a.score IS NOT NULL)
    +
    (SELECT count(*)
       FROM public.assessment_360_answers a
       JOIN public.assessment_360_submissions s ON s.id = a.submission_id
      WHERE s.subject_user_id = v_user AND s.status = 'accepted'
        AND a.criteria_id = NEW.criteria_id AND a.score IS NOT NULL)
  INTO v_people;
  v_ratio := LEAST(v_people::numeric / GREATEST(COALESCE(v_expected, 1), 1), 1);
  NEW.coverage := round(v_ratio, 3);
  NEW.confidence := CASE
    WHEN v_ratio >= public.param_num('confidence_high_coverage', 0.8) THEN 'high'
    WHEN v_ratio >= public.param_num('confidence_medium_coverage', 0.6) THEN 'medium'
    ELSE 'low' END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS apply_person_coverage ON public.assessment_result_scores;
CREATE TRIGGER apply_person_coverage
  BEFORE INSERT OR UPDATE OF coverage ON public.assessment_result_scores
  FOR EACH ROW EXECUTE FUNCTION public.apply_person_coverage();

CREATE OR REPLACE FUNCTION public.leave_community(p_community_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.community_members WHERE community_id = p_community_id AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.save_roadmap_origin(
  p_roadmap_id uuid, p_education_level text, p_school_year text,
  p_skills text, p_certificates text, p_extracurricular text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.roadmaps SET
    education_level = NULLIF(trim(p_education_level), ''),
    school_year = NULLIF(trim(p_school_year), ''),
    current_skills = NULLIF(trim(p_skills), ''),
    certificates = NULLIF(trim(p_certificates), ''),
    extracurricular = NULLIF(trim(p_extracurricular), '')
  WHERE id = p_roadmap_id AND owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_roadmaps()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'title', r.title, 'career_id', r.career_id, 'career_name', c.career_name,
    'is_active', r.is_active, 'target_date', r.target_date, 'created_at', r.created_at,
    'education_level', r.education_level, 'school_year', r.school_year,
    'current_skills', r.current_skills, 'certificates', r.certificates, 'extracurricular', r.extracurricular,
    'milestones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', m.id, 'pillar', m.pillar, 'title', m.title, 'done', m.done,
               'due_date', m.due_date, 'weight', m.weight, 'is_checkpoint', m.is_checkpoint) ORDER BY m.due_date NULLS LAST, m.created_at)
        FROM public.roadmap_milestones m WHERE m.roadmap_id = r.id
    ), '[]'::jsonb)
  ) ORDER BY r.is_active DESC, r.created_at DESC), '[]'::jsonb)
  FROM public.roadmaps r
  LEFT JOIN public.careers c ON c.id = r.career_id
  WHERE r.owner_id = auth.uid();
$$;

DROP FUNCTION IF EXISTS public.create_career_event(uuid, text, text, text, timestamptz);
CREATE FUNCTION public.create_career_event(
  p_school_id uuid, p_title text, p_description text, p_location text, p_starts_at timestamptz,
  p_seat_limit integer DEFAULT NULL, p_registration_deadline timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_school uuid := COALESCE(p_school_id, (SELECT school_id FROM public.school_staff
                                            WHERE user_id = auth.uid() AND staff_role = 'school_admin' AND status = 'active' LIMIT 1));
BEGIN
  IF NOT (public.is_system_admin() OR (v_school IS NOT NULL AND public.is_school_admin(v_school))) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) < 3 OR p_starts_at IS NULL THEN RAISE EXCEPTION 'invalid_event'; END IF;
  IF p_seat_limit IS NOT NULL AND p_seat_limit < 1 THEN RAISE EXCEPTION 'invalid_event'; END IF;
  INSERT INTO public.career_events (school_id, title, description, location, starts_at, created_by, seat_limit, registration_deadline)
  VALUES (CASE WHEN public.is_system_admin() THEN p_school_id ELSE v_school END, trim(p_title), NULLIF(trim(p_description), ''), NULLIF(trim(p_location), ''), p_starts_at, auth.uid(), p_seat_limit, p_registration_deadline)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_career_events()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', e.id, 'title', e.title, 'description', e.description, 'location', e.location,
    'starts_at', e.starts_at, 'seat_limit', e.seat_limit, 'registration_deadline', e.registration_deadline,
    'registered', EXISTS (SELECT 1 FROM public.event_registrations r WHERE r.event_id = e.id AND r.user_id = auth.uid()),
    'registrations', (SELECT count(*) FROM public.event_registrations r WHERE r.event_id = e.id)
  ) ORDER BY e.starts_at), '[]'::jsonb)
  FROM public.career_events e WHERE e.starts_at > now() - interval '1 day';
$$;

CREATE OR REPLACE FUNCTION public.register_career_event(p_event_id uuid, p_register boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.career_events;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_event FROM public.career_events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF p_register THEN
    IF v_event.registration_deadline IS NOT NULL AND now() > v_event.registration_deadline THEN
      RAISE EXCEPTION 'registration_closed';
    END IF;
    SELECT count(*) INTO v_count FROM public.event_registrations WHERE event_id = p_event_id;
    IF v_event.seat_limit IS NOT NULL AND v_count >= v_event.seat_limit
       AND NOT EXISTS (SELECT 1 FROM public.event_registrations WHERE event_id = p_event_id AND user_id = auth.uid()) THEN
      RAISE EXCEPTION 'event_full';
    END IF;
    INSERT INTO public.event_registrations (event_id, user_id) VALUES (p_event_id, auth.uid()) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.event_registrations WHERE event_id = p_event_id AND user_id = auth.uid();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_community_admin()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name,
      'members', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', COALESCE(p.display_name, p.full_name, '')))
                             FROM public.community_members m JOIN public.user_profiles p ON p.id = m.user_id WHERE m.community_id = c.id), '[]'::jsonb),
      'topics', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title) ORDER BY t.created_at)
                            FROM public.community_topics t WHERE t.community_id = c.id), '[]'::jsonb)
    ) ORDER BY c.name)
    FROM public.communities c
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_community_member(p_community_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.community_members WHERE community_id = p_community_id AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_community_topic(p_community_id uuid, p_title text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_title IS NULL OR length(trim(p_title)) < 2 THEN RAISE EXCEPTION 'invalid_topic'; END IF;
  INSERT INTO public.community_topics (community_id, title) VALUES (p_community_id, trim(p_title)) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_community_topic(p_topic_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.community_topics WHERE id = p_topic_id;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_community(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_roadmap_origin(uuid, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_career_event(uuid, text, text, text, timestamptz, integer, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_community_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_community_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_community_topic(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_community_topic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_community(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_roadmap_origin(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_career_event(uuid, text, text, text, timestamptz, integer, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_community_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_community_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_community_topic(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_community_topic(uuid) TO authenticated;
