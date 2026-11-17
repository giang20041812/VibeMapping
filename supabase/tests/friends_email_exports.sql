-- Kiểm thử liên kết bạn bè, gửi lời mời đánh giá cho bạn, hàng đợi email thông báo, danh sách tệp đã lưu.
\set QUIET on
SET client_min_messages = warning;

CREATE OR REPLACE FUNCTION public.t_act_as(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_uid::text, ''), false);
END;
$$;
CREATE OR REPLACE FUNCTION public.t_expect_error(p_sql text, p_pattern text, p_name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'FAIL %: không có lỗi, kỳ vọng %', p_name, p_pattern;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAIL %' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%' || p_pattern || '%' THEN
    RAISE EXCEPTION 'FAIL %: lỗi "%" không khớp "%"', p_name, SQLERRM, p_pattern;
  END IF;
  RAISE WARNING 'ok %', p_name;
END;
$$;
CREATE OR REPLACE FUNCTION public.t_assert(p_ok boolean, p_name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL %', p_name; END IF;
  RAISE WARNING 'ok %', p_name;
END;
$$;
GRANT EXECUTE ON FUNCTION public.t_expect_error(text, text, text), public.t_assert(boolean, text), public.t_act_as(uuid) TO authenticated, anon;

CREATE TABLE t_v (k text PRIMARY KEY, v text);
GRANT SELECT, INSERT, UPDATE ON t_v TO authenticated;
CREATE OR REPLACE FUNCTION public.t_get(p_key text) RETURNS text LANGUAGE sql AS $$ SELECT v FROM t_v WHERE k = p_key $$;
GRANT EXECUTE ON FUNCTION public.t_get(text) TO authenticated;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000f1', 'an@test.vn', '{"role":"student"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'binh@test.vn', '{"role":"student"}'),
  ('00000000-0000-0000-0000-0000000000f3', 'hs01@thpt.vibemapping.local', '{"role":"student"}'),
  ('00000000-0000-0000-0000-0000000000f4', 'ph@test.vn', '{"role":"student"}'),
  ('00000000-0000-0000-0000-0000000000f9', 'admin@test.vn', '{"role":"student"}');
UPDATE user_profiles SET full_name = 'Nguyễn An' WHERE id = '00000000-0000-0000-0000-0000000000f1';
UPDATE user_profiles SET full_name = 'Trần Bình' WHERE id = '00000000-0000-0000-0000-0000000000f2';
UPDATE user_profiles SET role = 'parent' WHERE id = '00000000-0000-0000-0000-0000000000f4';
UPDATE user_profiles SET role = 'system_admin' WHERE id = '00000000-0000-0000-0000-0000000000f9';

SET ROLE authenticated;

-- Mã kết bạn ----------------------------------------------------------------------------------------
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000f4');
SELECT t_expect_error($$SELECT get_my_friend_code()$$, 'forbidden', 'Phụ huynh không có mã kết bạn');

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000f2');
INSERT INTO t_v SELECT 'code_b', get_my_friend_code();
SELECT t_assert(t_get('code_b') ~ '^[A-Z2-9]{6}$', 'Mã kết bạn 6 ký tự, không có ký tự dễ nhầm');
SELECT t_assert(get_my_friend_code() = t_get('code_b'), 'Gọi lại trả cùng mã');

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000f1');
SELECT t_assert((request_friend_by_code('XXXXXX') ->> 'reason') = 'code_invalid', 'Mã sai báo không hợp lệ');
SELECT t_assert((request_friend_by_code(lower(t_get('code_b'))) ->> 'status') = 'pending', 'Nhập mã (chữ thường) gửi lời kết bạn');
SELECT t_assert((request_friend_by_code(t_get('code_b')) ->> 'reason') = 'pending', 'Gửi lặp báo đang chờ');
INSERT INTO t_v SELECT 'code_a', get_my_friend_code();
SELECT t_assert((request_friend_by_code(t_get('code_a')) ->> 'reason') = 'self', 'Không tự kết bạn với mình');

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000f2');
SELECT t_assert((SELECT jsonb_array_length(list_my_friends() -> 'incoming') = 1), 'Người nhận thấy lời kết bạn');
SELECT respond_friend_request((SELECT (list_my_friends() -> 'incoming' -> 0 ->> 'id')::uuid), true);
SELECT t_assert((SELECT (list_my_friends() -> 'friends' -> 0 ->> 'name') = 'Nguyễn An'), 'Chấp nhận thì thành bạn');

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000f1');
SELECT t_assert((request_friend_by_code(t_get('code_b')) ->> 'reason') = 'already_friends', 'Đã là bạn thì báo');
SELECT t_expect_error($$SELECT respond_friend_request((SELECT id FROM friend_links LIMIT 1), false)$$, 'forbidden', 'Người gửi không tự trả lời');

-- Gửi lời mời đánh giá cho bạn ----------------------------------------------------------------------------
SELECT t_assert((send_friend_invite('00000000-0000-0000-0000-0000000000f2') ->> 'reason') = 'no_active_link', 'Chưa có đường dẫn nhóm Bạn bè thì báo');
RESET ROLE;
INSERT INTO invitation_links (user_id, rater_group, expected_count, expires_at)
VALUES ('00000000-0000-0000-0000-0000000000f1', 'friend', 3, now() + interval '14 days');
SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000f1');
SELECT t_assert((send_friend_invite('00000000-0000-0000-0000-0000000000f2') ->> 'ok')::boolean, 'Gửi lời mời đánh giá cho bạn');
SELECT t_assert((send_friend_invite('00000000-0000-0000-0000-0000000000f2') ->> 'reason') = 'recently_sent', 'Không gửi lặp trong 24 giờ');
SELECT t_assert((send_friend_invite('00000000-0000-0000-0000-0000000000f4') ->> 'reason') = 'not_friend', 'Không gửi cho người chưa là bạn');
SELECT t_assert((SELECT (list_my_friends() -> 'friends' -> 0 ->> 'invite_sent_at') IS NOT NULL), 'Danh sách bạn có thời điểm đã gửi lời mời');
RESET ROLE;
SELECT t_assert((SELECT payload ->> 'href' LIKE '/moi/%' FROM notifications WHERE user_id = '00000000-0000-0000-0000-0000000000f2' AND notification_type = 'friend_invite'),
  'Thông báo lời mời có đường dẫn đánh giá');

-- Hàng đợi email ----------------------------------------------------------------------------------------------
SELECT t_assert((SELECT count(*) = 1 FROM email_outbox WHERE to_email = 'binh@test.vn' AND notification_type = 'friend_invite' AND link_path LIKE '/moi/%'),
  'Thông báo quan trọng được xếp thư email');
SELECT t_assert((SELECT count(*) = 0 FROM email_outbox WHERE notification_type = 'friend_request'), 'Thông báo kết bạn không gửi email');
SELECT push_notification('00000000-0000-0000-0000-0000000000f3', 'new_submission', 'Có bài mới', NULL);
SELECT t_assert((SELECT count(*) = 0 FROM email_outbox WHERE user_id = '00000000-0000-0000-0000-0000000000f3'), 'Không gửi email tới địa chỉ nội bộ của danh sách lớp');
INSERT INTO notification_settings (user_id, notification_type, email_enabled) VALUES ('00000000-0000-0000-0000-0000000000f1', 'new_submission', false);
SELECT push_notification('00000000-0000-0000-0000-0000000000f1', 'new_submission', 'Có bài mới', NULL);
SELECT t_assert((SELECT count(*) = 0 FROM email_outbox WHERE user_id = '00000000-0000-0000-0000-0000000000f1' AND notification_type = 'new_submission'),
  'Tắt email loại nào thì không xếp thư loại đó');

SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000f1');
SELECT t_expect_error($$SELECT * FROM claim_email_batch(5)$$, 'permission denied', 'Người dùng không lấy được hàng đợi');
SELECT t_assert((SELECT count(*) = 0 FROM email_outbox), 'Người dùng không đọc được hàng đợi');
SELECT t_expect_error($$SELECT email_outbox_summary()$$, 'forbidden', 'Người dùng không xem tóm tắt hàng đợi');
RESET ROLE;

INSERT INTO t_v SELECT 'mail', id::text FROM claim_email_batch(5) LIMIT 1;
SELECT t_assert((SELECT status = 'sending' AND attempts = 1 FROM email_outbox WHERE id = t_get('mail')::uuid), 'Lấy thư thì đánh dấu đang gửi');
SELECT complete_email(t_get('mail')::uuid, false, 'timeout');
SELECT t_assert((SELECT status = 'pending' AND last_error = 'timeout' FROM email_outbox WHERE id = t_get('mail')::uuid), 'Lỗi lần đầu thì trả về hàng đợi');
UPDATE email_outbox SET attempts = 3 WHERE id = t_get('mail')::uuid;
SELECT complete_email(t_get('mail')::uuid, false, 'timeout');
SELECT t_assert((SELECT status = 'failed' FROM email_outbox WHERE id = t_get('mail')::uuid), 'Hết số lần gửi lại thì Lỗi');

SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000f9');
SELECT t_assert((email_outbox_summary() -> 'counts' ->> 'failed')::int = 1, 'Quản trị xem số thư lỗi');
SELECT t_assert(retry_failed_emails() = 1, 'Quản trị gửi lại thư lỗi');
RESET ROLE;
INSERT INTO t_v VALUES ('mail2', (SELECT id::text FROM claim_email_batch(5) LIMIT 1)) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
SELECT complete_email(t_get('mail2')::uuid, true, NULL, 'msg_1');
SELECT t_assert((SELECT o.status = 'sent' AND n.email_sent_at IS NOT NULL FROM email_outbox o JOIN notifications n ON n.id = o.notification_id WHERE o.id = t_get('mail2')::uuid),
  'Gửi được thì ghi thời điểm gửi vào thông báo');
UPDATE email_outbox SET status = 'pending', created_at = now() - interval '3 days' WHERE id = t_get('mail2')::uuid;
SELECT count(*) FROM claim_email_batch(5);
SELECT t_assert((SELECT status = 'expired' FROM email_outbox WHERE id = t_get('mail2')::uuid), 'Thư chờ quá 48 giờ thì hết hạn, không gửi');

-- Tệp đã lưu ----------------------------------------------------------------------------------------------
SET ROLE authenticated;
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000f1');
INSERT INTO exported_files (owner_id, kind, title, file_name, storage_path, mime_type, size_bytes)
VALUES ('00000000-0000-0000-0000-0000000000f1', 'orientation_profile', 'Hồ sơ định hướng', 'ho-so.pdf',
        '00000000-0000-0000-0000-0000000000f1/orientation_profile/1-ho-so.pdf', 'application/pdf', 2048);
SELECT t_assert((SELECT count(*) = 1 FROM exported_files), 'Lưu được tệp vào danh sách');
SELECT t_expect_error($$INSERT INTO exported_files (owner_id, kind, title, file_name, storage_path, mime_type, size_bytes)
  VALUES ('00000000-0000-0000-0000-0000000000f1', 'orientation_profile', 'X', 'x.pdf', '00000000-0000-0000-0000-0000000000f2/x.pdf', 'application/pdf', 10)$$,
  'exported_files_path_owner', 'Đường dẫn phải nằm trong thư mục của mình');
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000f2');
SELECT t_assert((SELECT count(*) = 0 FROM exported_files), 'Không thấy tệp của người khác');

SELECT 'Hoàn tất kiểm thử bạn bè, email, tệp đã lưu' AS result;
