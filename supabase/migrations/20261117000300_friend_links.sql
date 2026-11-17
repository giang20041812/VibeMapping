-- FR03.01.04: học sinh, sinh viên liên kết với bạn bè bằng mã để mời nhau đánh giá 360° thuận tiện hơn.
-- Liên kết cần người nhận chấp nhận. Bạn đã liên kết nhận lời mời đánh giá qua thông báo trong ứng dụng,
-- đường dẫn trong thông báo là đường dẫn nhóm Bạn bè đang mở của người mời.

-- 1. Bảng -----------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friend_codes (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z2-9]{6}$'),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.friend_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  responded_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT friend_links_not_self CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS friend_links_pair_uq
  ON public.friend_links (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

-- Lần gửi lời mời đánh giá cho từng bạn, để chặn gửi lặp trong 24 giờ
CREATE TABLE IF NOT EXISTS public.friend_invite_sends (
  link_id uuid NOT NULL REFERENCES public.invitation_links(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sent_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (link_id, friend_id)
);

ALTER TABLE public.friend_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_invite_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads friend code" ON public.friend_codes;
CREATE POLICY "Owner reads friend code" ON public.friend_codes FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Parties read friend links" ON public.friend_links;
CREATE POLICY "Parties read friend links" ON public.friend_links FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());
DROP POLICY IF EXISTS "Owner reads friend invite sends" ON public.friend_invite_sends;
CREATE POLICY "Owner reads friend invite sends" ON public.friend_invite_sends FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invitation_links l WHERE l.id = link_id AND l.user_id = auth.uid()));

-- 2. Loại thông báo mới ----------------------------------------------------------------------------------
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
    'roadmap_off_track', 'community_restricted', 'friend_request', 'friend_invite'));
END $$;

-- 3. Hàm --------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_learner()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) NOT IN ('student', 'university_student') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.person_name(p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(NULLIF(display_name, ''), NULLIF(full_name, ''), '') FROM public.user_profiles WHERE id = p_user_id;
$$;

/** Mã 6 ký tự, bỏ các ký tự dễ nhầm (0, O, 1, I) */
CREATE OR REPLACE FUNCTION public.new_friend_code()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
BEGIN
  LOOP
    SELECT string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '') INTO v_code FROM generate_series(1, 6);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.friend_codes WHERE code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_friend_code(p_regenerate boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text;
BEGIN
  PERFORM public.assert_learner();
  SELECT code INTO v_code FROM public.friend_codes WHERE user_id = auth.uid();
  IF v_code IS NULL THEN
    v_code := public.new_friend_code();
    INSERT INTO public.friend_codes (user_id, code) VALUES (auth.uid(), v_code);
  ELSIF p_regenerate THEN
    v_code := public.new_friend_code();
    UPDATE public.friend_codes SET code = v_code, updated_at = now() WHERE user_id = auth.uid();
  END IF;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_friend_by_code(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target uuid;
  v_link public.friend_links;
BEGIN
  PERFORM public.assert_learner();
  SELECT user_id INTO v_target FROM public.friend_codes WHERE code = upper(trim(COALESCE(p_code, '')));
  IF v_target IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'code_invalid'); END IF;
  IF v_target = auth.uid() THEN RETURN jsonb_build_object('ok', false, 'reason', 'self'); END IF;

  SELECT * INTO v_link FROM public.friend_links
   WHERE LEAST(requester_id, addressee_id) = LEAST(auth.uid(), v_target)
     AND GREATEST(requester_id, addressee_id) = GREATEST(auth.uid(), v_target);

  IF v_link.id IS NOT NULL AND v_link.status = 'accepted' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_friends');
  END IF;
  -- Người kia đã gửi lời kết bạn cho mình: nhập mã của họ là chấp nhận luôn
  IF v_link.id IS NOT NULL AND v_link.status = 'pending' AND v_link.requester_id = v_target THEN
    UPDATE public.friend_links SET status = 'accepted', responded_at = now(), updated_at = now() WHERE id = v_link.id;
    PERFORM public.push_notification(v_target, 'friend_request', public.person_name(auth.uid()) || ' đã chấp nhận kết bạn', NULL,
      jsonb_build_object('href', '/quyen-rieng-tu'));
    RETURN jsonb_build_object('ok', true, 'status', 'accepted', 'name', public.person_name(v_target));
  END IF;
  IF v_link.id IS NOT NULL AND v_link.status = 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pending');
  END IF;

  IF v_link.id IS NOT NULL THEN
    UPDATE public.friend_links SET requester_id = auth.uid(), addressee_id = v_target, status = 'pending',
           responded_at = NULL, created_at = now(), updated_at = now() WHERE id = v_link.id;
  ELSE
    INSERT INTO public.friend_links (requester_id, addressee_id) VALUES (auth.uid(), v_target);
  END IF;
  PERFORM public.push_notification(v_target, 'friend_request', public.person_name(auth.uid()) || ' muốn kết bạn với bạn', NULL,
    jsonb_build_object('href', '/quyen-rieng-tu'));
  RETURN jsonb_build_object('ok', true, 'status', 'pending', 'name', public.person_name(v_target));
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(p_id uuid, p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_requester uuid;
BEGIN
  UPDATE public.friend_links SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
         responded_at = now(), updated_at = now()
   WHERE id = p_id AND addressee_id = auth.uid() AND status = 'pending'
  RETURNING requester_id INTO v_requester;
  IF v_requester IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_accept THEN
    PERFORM public.push_notification(v_requester, 'friend_request', public.person_name(auth.uid()) || ' đã chấp nhận kết bạn', NULL,
      jsonb_build_object('href', '/quyen-rieng-tu'));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_friend(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.friend_links
   WHERE LEAST(requester_id, addressee_id) = LEAST(auth.uid(), p_user_id)
     AND GREATEST(requester_id, addressee_id) = GREATEST(auth.uid(), p_user_id)
     AND (requester_id = auth.uid() OR addressee_id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_friends()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mine AS (
    SELECT f.*, CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END AS other_id
      FROM public.friend_links f
     WHERE f.requester_id = auth.uid() OR f.addressee_id = auth.uid()
  ),
  active_link AS (
    SELECT id FROM public.invitation_links
     WHERE user_id = auth.uid() AND rater_group = 'friend' AND revoked_at IS NULL AND expires_at > now()
     LIMIT 1
  )
  SELECT jsonb_build_object(
    'friends', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'user_id', m.other_id, 'name', public.person_name(m.other_id), 'since', COALESCE(m.responded_at, m.created_at),
        'invite_sent_at', (SELECT s.sent_at FROM public.friend_invite_sends s WHERE s.link_id = (SELECT id FROM active_link) AND s.friend_id = m.other_id)
      ) ORDER BY public.person_name(m.other_id)) FROM mine m WHERE m.status = 'accepted'), '[]'::jsonb),
    'incoming', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'name', public.person_name(m.other_id), 'created_at', m.created_at)
      ORDER BY m.created_at DESC) FROM mine m WHERE m.status = 'pending' AND m.addressee_id = auth.uid()), '[]'::jsonb),
    'outgoing', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'name', public.person_name(m.other_id), 'created_at', m.created_at, 'status', m.status)
      ORDER BY m.created_at DESC) FROM mine m WHERE m.status IN ('pending', 'declined') AND m.requester_id = auth.uid()), '[]'::jsonb),
    'has_active_friend_link', EXISTS (SELECT 1 FROM active_link)
  );
$$;

/** Gửi đường dẫn đánh giá nhóm Bạn bè cho một bạn đã liên kết qua thông báo trong ứng dụng */
CREATE OR REPLACE FUNCTION public.send_friend_invite(p_friend_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_link public.invitation_links;
  v_last timestamptz;
BEGIN
  PERFORM public.assert_learner();
  IF NOT EXISTS (
    SELECT 1 FROM public.friend_links
     WHERE status = 'accepted'
       AND LEAST(requester_id, addressee_id) = LEAST(auth.uid(), p_friend_id)
       AND GREATEST(requester_id, addressee_id) = GREATEST(auth.uid(), p_friend_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_friend');
  END IF;
  SELECT * INTO v_link FROM public.invitation_links
   WHERE user_id = auth.uid() AND rater_group = 'friend' AND revoked_at IS NULL AND expires_at > now()
   ORDER BY created_at DESC LIMIT 1;
  IF v_link.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_active_link'); END IF;
  SELECT sent_at INTO v_last FROM public.friend_invite_sends WHERE link_id = v_link.id AND friend_id = p_friend_id;
  IF v_last IS NOT NULL AND v_last > now() - interval '24 hours' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'recently_sent');
  END IF;
  INSERT INTO public.friend_invite_sends (link_id, friend_id) VALUES (v_link.id, p_friend_id)
  ON CONFLICT (link_id, friend_id) DO UPDATE SET sent_at = now();
  PERFORM public.push_notification(p_friend_id, 'friend_invite',
    public.person_name(auth.uid()) || ' mời bạn đánh giá 360°', 'Đường dẫn còn hạn đến ' || to_char(v_link.expires_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY') || '.',
    jsonb_build_object('href', '/moi/' || v_link.link_token));
  PERFORM public.write_audit_log(auth.uid(), p_friend_id, 'send_friend_invite', 'invitation_links', v_link.id, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. Quyền thực thi ----------------------------------------------------------------------------------------
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'get_my_friend_code(boolean)', 'request_friend_by_code(text)', 'respond_friend_request(uuid, boolean)',
    'remove_friend(uuid)', 'list_my_friends()', 'send_friend_invite(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  REVOKE ALL ON FUNCTION public.assert_learner() FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.new_friend_code() FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.person_name(uuid) FROM PUBLIC, anon, authenticated;
END;
$$;
