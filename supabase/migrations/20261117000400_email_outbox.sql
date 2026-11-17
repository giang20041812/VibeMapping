-- FR03.02.02, FR01.06.05, FR04.02.08 (INT-002): gửi email cho các thông báo quan trọng.
-- Mỗi thông báo trong ứng dụng thuộc loại quan trọng được xếp vào hàng đợi email_outbox (người dùng bật email cho loại đó,
-- có email thật). Edge Function send-notification-emails lấy thư từ hàng đợi và gửi qua nhà cung cấp.
-- Chưa cấu hình nhà cung cấp thì thư nằm chờ; quá email_max_age_hours thì chuyển "Hết hạn", không gửi thư cũ.

-- 1. Hàng đợi --------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  notification_type text NOT NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  body_text text NOT NULL DEFAULT '',
  link_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'expired')),
  attempts smallint NOT NULL DEFAULT 0,
  last_error text,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS email_outbox_status_idx ON public.email_outbox(status, created_at);
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin reads email outbox" ON public.email_outbox;
CREATE POLICY "Admin reads email outbox" ON public.email_outbox FOR SELECT TO authenticated USING (public.is_system_admin());

-- 2. Tham số ----------------------------------------------------------------------------------------------
INSERT INTO public.operation_parameters (param_code, param_name, param_value, verification_level)
SELECT v.c, v.n, v.val::jsonb, v.lvl
FROM (VALUES
  ('email_notification_types', 'Loại thông báo được gửi thêm qua email',
   '["new_submission", "result_changed", "result_finalized", "link_expiring", "career_ranking_changed", "decision_report_shared", "mentor_connection", "friend_invite"]', 'documented'),
  ('email_max_age_hours', 'Số giờ tối đa thư được giữ trong hàng đợi chờ gửi', '48', 'pending_ba'),
  ('email_max_attempts', 'Số lần gửi lại tối đa khi nhà cung cấp báo lỗi', '3', 'pending_ba')
) AS v(c, n, val, lvl)
WHERE NOT EXISTS (SELECT 1 FROM public.operation_parameters p WHERE p.param_code = v.c);

-- 3. Xếp thư khi có thông báo mới -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_notification_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
  v_anonymous boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(COALESCE(public.get_parameter('email_notification_types'), '[]'::jsonb)) t
     WHERE t = NEW.notification_type
  ) THEN
    RETURN NEW;
  END IF;
  IF NOT COALESCE((SELECT email_enabled FROM public.notification_settings
                    WHERE user_id = NEW.user_id AND notification_type = NEW.notification_type), true) THEN
    RETURN NEW;
  END IF;
  SELECT email, COALESCE(is_anonymous, false) INTO v_email, v_anonymous FROM auth.users WHERE id = NEW.user_id;
  -- Bỏ qua tài khoản khách và email nội bộ cấp cho học sinh nhập từ danh sách lớp
  IF v_email IS NULL OR v_anonymous OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR lower(v_email) LIKE '%.vibemapping.local' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.email_outbox (user_id, notification_id, notification_type, to_email, subject, body_text, link_path)
  VALUES (NEW.user_id, NEW.id, NEW.notification_type, v_email, NEW.title, COALESCE(NEW.body, ''), NULLIF(NEW.payload ->> 'href', ''));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS queue_notification_email ON public.notifications;
CREATE TRIGGER queue_notification_email AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.queue_notification_email();

-- 4. Hàm cho Edge Function (chỉ service_role) ------------------------------------------------------------
/** Lấy tối đa p_limit thư chờ gửi và đánh dấu đang gửi; thư quá hạn giữ thì chuyển Hết hạn */
CREATE OR REPLACE FUNCTION public.claim_email_batch(p_limit integer DEFAULT 20)
RETURNS SETOF public.email_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_max_age numeric := public.param_num('email_max_age_hours', 48);
BEGIN
  UPDATE public.email_outbox SET status = 'expired', updated_at = now()
   WHERE status = 'pending' AND created_at < now() - make_interval(hours => v_max_age::integer);
  -- Thư kẹt ở trạng thái đang gửi quá 15 phút (hàm bị ngắt giữa chừng) được trả về hàng đợi
  UPDATE public.email_outbox SET status = 'pending', updated_at = now()
   WHERE status = 'sending' AND updated_at < now() - interval '15 minutes';
  RETURN QUERY
  UPDATE public.email_outbox o SET status = 'sending', attempts = o.attempts + 1, updated_at = now()
   WHERE o.id IN (
     SELECT id FROM public.email_outbox WHERE status = 'pending' ORDER BY created_at
      LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100)) FOR UPDATE SKIP LOCKED
   )
  RETURNING o.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_email(p_id uuid, p_ok boolean, p_error text DEFAULT NULL, p_message_id text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.email_outbox;
  v_max_attempts numeric := public.param_num('email_max_attempts', 3);
BEGIN
  SELECT * INTO v_row FROM public.email_outbox WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF p_ok THEN
    UPDATE public.email_outbox SET status = 'sent', sent_at = now(), last_error = NULL, provider_message_id = p_message_id, updated_at = now()
     WHERE id = p_id;
    UPDATE public.notifications SET email_sent_at = now() WHERE id = v_row.notification_id;
  ELSE
    UPDATE public.email_outbox
       SET status = CASE WHEN v_row.attempts >= v_max_attempts THEN 'failed' ELSE 'pending' END,
           last_error = left(COALESCE(p_error, 'unknown'), 500), updated_at = now()
     WHERE id = p_id;
  END IF;
END;
$$;

-- Quản trị xem tình trạng hàng đợi và gửi lại thư lỗi
CREATE OR REPLACE FUNCTION public.email_outbox_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'counts', COALESCE((SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) AS n FROM public.email_outbox GROUP BY status) x), '{}'::jsonb),
    'last_sent_at', (SELECT max(sent_at) FROM public.email_outbox),
    'oldest_pending_at', (SELECT min(created_at) FROM public.email_outbox WHERE status = 'pending')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_failed_emails()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.email_outbox SET status = 'pending', attempts = 0, last_error = NULL, created_at = now(), updated_at = now()
   WHERE status = 'failed';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM public.write_audit_log(auth.uid(), NULL, 'retry_failed_emails', 'email_outbox', NULL, jsonb_build_object('count', v_count));
  RETURN v_count;
END;
$$;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.queue_notification_email() FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.claim_email_batch(integer) FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.complete_email(uuid, boolean, text, text) FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.email_outbox_summary() FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.retry_failed_emails() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.email_outbox_summary() TO authenticated;
  GRANT EXECUTE ON FUNCTION public.retry_failed_emails() TO authenticated;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.claim_email_batch(integer) TO service_role;
    GRANT EXECUTE ON FUNCTION public.complete_email(uuid, boolean, text, text) TO service_role;
  END IF;
END;
$$;
