-- F09.01: hoàn thiện cộng đồng hướng nghiệp.
-- FR09.01.05 câu hỏi cộng đồng; FR09.01.08 hạn chế tác giả vi phạm; FR09.01.11 xem sự kiện (đối tượng);
-- FR09.01.13–14 hồ sơ và tìm người hướng dẫn theo lĩnh vực, chủ đề.

-- 1. Cột mới -------------------------------------------------------------------------------------------
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'post';
ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_post_type_check;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_post_type_check CHECK (post_type IN ('post', 'question'));

ALTER TABLE public.community_members
  ADD COLUMN IF NOT EXISTS restricted_until timestamptz;

ALTER TABLE public.mentor_profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS expertise_topics text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS field_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS years_experience smallint CHECK (years_experience IS NULL OR years_experience BETWEEN 0 AND 60),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now() NOT NULL;

ALTER TABLE public.career_events
  ADD COLUMN IF NOT EXISTS audience text;

-- Thông báo cho thành viên bị hạn chế đăng bài
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.notifications'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%notification_type%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', c); END IF;
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_notification_type_check CHECK (notification_type IN (
    'new_submission', 'result_changed', 'result_finalized', 'link_expiring', 'class_update',
    'career_ranking_changed', 'decision_report_shared', 'decision_consensus', 'mentor_connection',
    'roadmap_off_track', 'community_restricted'));
END $$;

-- 2. Đăng bài và bình luận: chặn thành viên đang bị hạn chế -----------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_community_author(p_community_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_until timestamptz;
  v_member boolean;
BEGIN
  SELECT true, restricted_until INTO v_member, v_until
    FROM public.community_members WHERE community_id = p_community_id AND user_id = auth.uid();
  IF v_member IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_until IS NOT NULL AND v_until > now() THEN RAISE EXCEPTION 'author_restricted'; END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.create_community_post(uuid, text);
CREATE OR REPLACE FUNCTION public.create_community_post(p_community_id uuid, p_body text, p_post_type text DEFAULT 'post')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_hidden boolean;
BEGIN
  PERFORM public.assert_community_author(p_community_id);
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN RAISE EXCEPTION 'body_required'; END IF;
  IF COALESCE(p_post_type, 'post') NOT IN ('post', 'question') THEN RAISE EXCEPTION 'invalid_post_type'; END IF;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(public.get_parameter('community_banned_keywords'), '[]'::jsonb)) k
                  WHERE length(trim(k)) > 0 AND lower(p_body) LIKE '%' || lower(trim(k)) || '%') INTO v_hidden;
  INSERT INTO public.community_posts (community_id, author_id, body, post_type, hidden_at)
  VALUES (p_community_id, auth.uid(), trim(p_body), COALESCE(p_post_type, 'post'), CASE WHEN v_hidden THEN now() END)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_community_comment(p_post_id uuid, p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_community uuid;
BEGIN
  SELECT community_id INTO v_community FROM public.community_posts WHERE id = p_post_id AND hidden_at IS NULL;
  IF v_community IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public.assert_community_author(v_community);
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN RAISE EXCEPTION 'body_required'; END IF;
  INSERT INTO public.community_comments (post_id, author_id, body) VALUES (p_post_id, auth.uid(), trim(p_body)) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 3. Danh sách cộng đồng: số thành viên, chủ đề, loại bài, hạn chế của chính mình -----------------------
CREATE OR REPLACE FUNCTION public.list_communities()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description, 'created_at', c.created_at,
    'is_owner', c.created_by = auth.uid(),
    'joined', me.user_id IS NOT NULL,
    'restricted_until', CASE WHEN me.restricted_until > now() THEN me.restricted_until END,
    'member_count', (SELECT count(*) FROM public.community_members m WHERE m.community_id = c.id),
    'topics', COALESCE((SELECT jsonb_agg(t.title ORDER BY t.created_at) FROM public.community_topics t WHERE t.community_id = c.id), '[]'::jsonb),
    'posts', CASE WHEN me.user_id IS NULL THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'body', p.body, 'post_type', p.post_type, 'created_at', p.created_at,
               'is_mine', p.author_id = auth.uid(),
               'author', (SELECT COALESCE(display_name, full_name, '') FROM public.user_profiles WHERE id = p.author_id),
               'comments', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', cm.id, 'body', cm.body, 'created_at', cm.created_at,
                              'author', (SELECT COALESCE(display_name, full_name, '') FROM public.user_profiles WHERE id = cm.author_id))
                              ORDER BY cm.created_at) FROM public.community_comments cm WHERE cm.post_id = p.id), '[]'::jsonb))
             ORDER BY p.created_at DESC)
        FROM public.community_posts p
       WHERE p.community_id = c.id AND p.hidden_at IS NULL
    ), '[]'::jsonb) END
  ) ORDER BY (me.user_id IS NOT NULL) DESC, c.created_at DESC), '[]'::jsonb)
  FROM public.communities c
  LEFT JOIN public.community_members me ON me.community_id = c.id AND me.user_id = auth.uid();
$$;

-- 4. Người hướng dẫn: hồ sơ đầy đủ, tìm theo lĩnh vực và chủ đề ----------------------------------------
DROP FUNCTION IF EXISTS public.save_mentor_profile(text);
CREATE OR REPLACE FUNCTION public.save_mentor_profile(
  p_headline text, p_bio text DEFAULT NULL, p_expertise_topics text[] DEFAULT '{}',
  p_field_ids uuid[] DEFAULT '{}', p_years_experience smallint DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
  v_topics text[];
BEGIN
  SELECT role INTO v_role FROM public.user_profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'mentor' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_headline IS NULL OR length(trim(p_headline)) < 8 THEN RAISE EXCEPTION 'headline_required'; END IF;
  IF p_years_experience IS NOT NULL AND (p_years_experience < 0 OR p_years_experience > 60) THEN RAISE EXCEPTION 'invalid_years'; END IF;
  SELECT COALESCE(array_agg(DISTINCT trim(t)) FILTER (WHERE length(trim(t)) > 0), '{}') INTO v_topics FROM unnest(COALESCE(p_expertise_topics, '{}')) t;
  INSERT INTO public.mentor_profiles (user_id, headline, bio, expertise_topics, field_ids, years_experience)
  VALUES (auth.uid(), trim(p_headline), NULLIF(trim(COALESCE(p_bio, '')), ''), v_topics,
          ARRAY(SELECT DISTINCT f FROM unnest(COALESCE(p_field_ids, '{}')) f WHERE EXISTS (SELECT 1 FROM public.career_fields cf WHERE cf.id = f)),
          p_years_experience)
  ON CONFLICT (user_id) DO UPDATE SET
    headline = EXCLUDED.headline, bio = EXCLUDED.bio, expertise_topics = EXCLUDED.expertise_topics,
    field_ids = EXCLUDED.field_ids, years_experience = EXCLUDED.years_experience, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.list_verified_mentors()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', m.user_id, 'headline', m.headline, 'name', COALESCE(p.display_name, p.full_name, ''),
    'bio', m.bio, 'expertise_topics', to_jsonb(m.expertise_topics), 'years_experience', m.years_experience,
    'verified', m.verified, 'is_me', m.user_id = auth.uid(),
    'field_ids', to_jsonb(m.field_ids),
    'field_names', COALESCE((SELECT jsonb_agg(f.field_name ORDER BY f.field_name) FROM public.career_fields f WHERE f.id = ANY (m.field_ids)), '[]'::jsonb),
    'connection_status', (SELECT c.status FROM public.connection_requests c WHERE c.requester_id = auth.uid() AND c.mentor_id = m.user_id)
  ) ORDER BY COALESCE(p.display_name, p.full_name, '')), '[]'::jsonb)
  FROM public.mentor_profiles m
  JOIN public.user_profiles p ON p.id = m.user_id
  WHERE m.verified OR m.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.list_mentor_profiles_admin()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', m.user_id, 'headline', m.headline, 'verified', m.verified,
            'bio', m.bio, 'expertise_topics', to_jsonb(m.expertise_topics), 'years_experience', m.years_experience,
            'name', COALESCE(p.display_name, p.full_name, '')) ORDER BY m.verified, m.created_at)
           FROM public.mentor_profiles m JOIN public.user_profiles p ON p.id = m.user_id), '[]'::jsonb);
END;
$$;

-- 5. Sự kiện: đối tượng, đơn vị tổ chức, chi tiết một sự kiện ------------------------------------------
DROP FUNCTION IF EXISTS public.create_career_event(uuid, text, text, text, timestamptz, integer, timestamptz);
CREATE OR REPLACE FUNCTION public.create_career_event(
  p_school_id uuid, p_title text, p_description text, p_location text, p_starts_at timestamptz,
  p_seat_limit integer DEFAULT NULL, p_registration_deadline timestamptz DEFAULT NULL, p_audience text DEFAULT NULL
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
  IF p_registration_deadline IS NOT NULL AND p_registration_deadline > p_starts_at THEN RAISE EXCEPTION 'invalid_deadline'; END IF;
  INSERT INTO public.career_events (school_id, title, description, location, starts_at, created_by, seat_limit, registration_deadline, audience)
  VALUES (CASE WHEN public.is_system_admin() THEN p_school_id ELSE v_school END, trim(p_title), NULLIF(trim(p_description), ''),
          NULLIF(trim(p_location), ''), p_starts_at, auth.uid(), p_seat_limit, p_registration_deadline, NULLIF(trim(COALESCE(p_audience, '')), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.career_event_json(e public.career_events)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', e.id, 'title', e.title, 'description', e.description, 'location', e.location, 'audience', e.audience,
    'starts_at', e.starts_at, 'seat_limit', e.seat_limit, 'registration_deadline', e.registration_deadline,
    'organizer', COALESCE((SELECT s.school_name FROM public.schools s WHERE s.id = e.school_id), 'VibeMapping'),
    'registered', EXISTS (SELECT 1 FROM public.event_registrations r WHERE r.event_id = e.id AND r.user_id = auth.uid()),
    'registrations', (SELECT count(*) FROM public.event_registrations r WHERE r.event_id = e.id)
  );
$$;

CREATE OR REPLACE FUNCTION public.list_career_events()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(public.career_event_json(e) ORDER BY e.starts_at), '[]'::jsonb)
  FROM public.career_events e WHERE e.starts_at > now() - interval '1 day';
$$;

CREATE OR REPLACE FUNCTION public.get_career_event(p_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.career_events;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_event FROM public.career_events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN public.career_event_json(v_event);
END;
$$;

-- 6. Quản trị: hạn chế tác giả vi phạm N ngày (0 là gỡ hạn chế) -----------------------------------------
CREATE OR REPLACE FUNCTION public.restrict_community_author(p_user_id uuid, p_days integer, p_community_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_days IS NULL OR p_days < 0 OR p_days > 365 THEN RAISE EXCEPTION 'invalid_days'; END IF;
  UPDATE public.community_members
     SET restricted_until = CASE WHEN p_days = 0 THEN NULL ELSE now() + make_interval(days => p_days) END
   WHERE user_id = p_user_id AND (p_community_id IS NULL OR community_id = p_community_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM public.write_audit_log(auth.uid(), p_user_id, 'restrict_community_author', 'community_members', p_community_id,
    jsonb_build_object('days', p_days));
  IF p_days > 0 THEN
    PERFORM public.push_notification(p_user_id, 'community_restricted', 'Bạn tạm thời không đăng bài trong cộng đồng',
      'Hết hạn sau ' || p_days || ' ngày.', jsonb_build_object('href', '/cong-dong'));
  END IF;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_reported_posts()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'body', p.body, 'hidden_at', p.hidden_at, 'post_type', p.post_type,
            'created_at', p.created_at, 'community_id', p.community_id,
            'community_name', (SELECT c.name FROM public.communities c WHERE c.id = p.community_id),
            'author_id', p.author_id,
            'author', (SELECT COALESCE(u.display_name, u.full_name, '') FROM public.user_profiles u WHERE u.id = p.author_id),
            'author_restricted_until', (SELECT max(m.restricted_until) FROM public.community_members m
                                         WHERE m.user_id = p.author_id AND m.restricted_until > now()),
            'reports', (SELECT count(*) FROM public.content_reports r WHERE r.post_id = p.id),
            'reasons', (SELECT jsonb_agg(r.reason) FROM public.content_reports r WHERE r.post_id = p.id)) ORDER BY p.created_at DESC)
           FROM public.community_posts p
          WHERE p.hidden_at IS NOT NULL OR EXISTS (SELECT 1 FROM public.content_reports r WHERE r.post_id = p.id)), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_community_admin()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name,
      'members', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', COALESCE(p.display_name, p.full_name, ''),
                                                               'restricted_until', CASE WHEN m.restricted_until > now() THEN m.restricted_until END)
                                            ORDER BY COALESCE(p.display_name, p.full_name, ''))
                             FROM public.community_members m JOIN public.user_profiles p ON p.id = m.user_id WHERE m.community_id = c.id), '[]'::jsonb),
      'topics', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title) ORDER BY t.created_at)
                            FROM public.community_topics t WHERE t.community_id = c.id), '[]'::jsonb)
    ) ORDER BY c.name)
    FROM public.communities c
  ), '[]'::jsonb);
END;
$$;

-- 7. Quyền thực thi ----------------------------------------------------------------------------------------
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'create_community_post(uuid, text, text)', 'add_community_comment(uuid, text)', 'list_communities()',
    'save_mentor_profile(text, text, text[], uuid[], smallint)', 'list_verified_mentors()', 'list_mentor_profiles_admin()',
    'create_career_event(uuid, text, text, text, timestamptz, integer, timestamptz, text)', 'list_career_events()',
    'get_career_event(uuid)', 'restrict_community_author(uuid, integer, uuid)', 'list_reported_posts()', 'list_community_admin()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  REVOKE ALL ON FUNCTION public.assert_community_author(uuid) FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.career_event_json(public.career_events) FROM PUBLIC, anon, authenticated;
END;
$$;
