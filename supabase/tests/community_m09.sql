-- Kiểm thử cộng đồng: bài Hỏi đáp, hạn chế tác giả, hồ sơ người hướng dẫn, chi tiết sự kiện.
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

INSERT INTO career_fields (field_code, field_name) VALUES ('LVC', 'Công nghệ thông tin');
CREATE TABLE t_c (k text PRIMARY KEY, id uuid);
GRANT SELECT, INSERT ON t_c TO authenticated;
INSERT INTO t_c SELECT 'field', id FROM career_fields WHERE field_code = 'LVC';
CREATE OR REPLACE FUNCTION public.t_id(p_key text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM t_c WHERE k = p_key $$;
GRANT EXECUTE ON FUNCTION public.t_id(text) TO authenticated;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'admin@test', '{"role":"student"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'hs@test', '{"role":"student"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'mentor@test', '{"role":"student"}'),
  ('00000000-0000-0000-0000-0000000000c4', 'hs2@test', '{"role":"student"}');
UPDATE user_profiles SET role = 'system_admin' WHERE id = '00000000-0000-0000-0000-0000000000c1';
UPDATE user_profiles SET role = 'mentor' WHERE id = '00000000-0000-0000-0000-0000000000c3';
UPDATE user_profiles SET date_of_birth = DATE '2006-01-01' WHERE id = '00000000-0000-0000-0000-0000000000c2';

SET ROLE authenticated;

-- Bài viết và câu hỏi ---------------------------------------------------------------------------
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000c2');
INSERT INTO t_c SELECT 'community', create_community('Hỏi đáp ngành CNTT', 'Trao đổi chọn ngành');
SELECT join_community(t_id('community'));
SELECT create_community_post(t_id('community'), 'Nên học Khoa học máy tính hay Kỹ thuật phần mềm?', 'question');
SELECT create_community_post(t_id('community'), 'Chia sẻ lộ trình tự học');
SELECT t_assert((SELECT count(*) = 1 FROM community_posts WHERE post_type = 'question'), 'Đăng được câu hỏi');
SELECT t_assert((SELECT count(*) = 1 FROM community_posts WHERE post_type = 'post'), 'Bài mặc định là bài viết');
SELECT t_expect_error($$SELECT create_community_post(t_id('community'), 'x', 'poll')$$, 'invalid_post_type', 'Loại bài không có bị từ chối');
SELECT t_assert((SELECT (elem ->> 'member_count')::int = 1 AND jsonb_array_length(elem -> 'posts') = 2 AND (elem ->> 'is_owner')::boolean
                   FROM jsonb_array_elements(list_communities()) elem WHERE elem ->> 'id' = t_id('community')::text),
  'Danh sách cộng đồng có số thành viên, bài và chủ nhóm');

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000c4');
SELECT t_assert((SELECT jsonb_array_length(elem -> 'posts') = 0 FROM jsonb_array_elements(list_communities()) elem WHERE elem ->> 'id' = t_id('community')::text),
  'Người chưa tham gia không thấy bài');
SELECT t_expect_error($$SELECT create_community_post(t_id('community'), 'Xin chào')$$, 'forbidden', 'Người chưa tham gia không đăng bài');

-- Hạn chế tác giả -----------------------------------------------------------------------------------
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000c2');
SELECT t_expect_error($$SELECT restrict_community_author('00000000-0000-0000-0000-0000000000c2', 3)$$, 'forbidden', 'Thành viên không tự hạn chế');
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000c1');
SELECT t_expect_error($$SELECT restrict_community_author('00000000-0000-0000-0000-0000000000c2', 400)$$, 'invalid_days', 'Số ngày ngoài 0–365 bị từ chối');
SELECT t_assert(restrict_community_author('00000000-0000-0000-0000-0000000000c2', 3) = 1, 'Quản trị hạn chế tác giả 3 ngày');
SELECT t_assert((SELECT count(*) = 1 FROM jsonb_array_elements(list_reported_posts())) IS NOT NULL, 'Danh sách bài báo cáo chạy được');

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000c2');
SELECT t_expect_error($$SELECT create_community_post(t_id('community'), 'Bài mới')$$, 'author_restricted', 'Tác giả bị hạn chế không đăng bài');
SELECT t_expect_error($$SELECT add_community_comment((SELECT id FROM community_posts LIMIT 1), 'Bình luận')$$, 'author_restricted', 'Tác giả bị hạn chế không bình luận');
SELECT t_assert((SELECT elem ->> 'restricted_until' IS NOT NULL FROM jsonb_array_elements(list_communities()) elem WHERE elem ->> 'id' = t_id('community')::text),
  'Thành viên thấy mình đang bị hạn chế');

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000c1');
SELECT restrict_community_author('00000000-0000-0000-0000-0000000000c2', 0);
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000c2');
SELECT t_assert(add_community_comment((SELECT id FROM community_posts WHERE post_type = 'question'), 'Tùy sở thích') IS NOT NULL, 'Gỡ hạn chế thì bình luận lại được');
RESET ROLE;
SELECT t_assert((SELECT count(*) = 1 FROM notifications WHERE user_id = '00000000-0000-0000-0000-0000000000c2' AND notification_type = 'community_restricted'),
  'Có thông báo khi bị hạn chế');
SET ROLE authenticated;

-- Người hướng dẫn ------------------------------------------------------------------------------------
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000c2');
SELECT t_expect_error($$SELECT save_mentor_profile('Kỹ sư phần mềm 10 năm')$$, 'forbidden', 'Học sinh không tạo hồ sơ người hướng dẫn');
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000c3');
SELECT t_expect_error($$SELECT save_mentor_profile('Ngắn')$$, 'headline_required', 'Giới thiệu ngắn quá bị từ chối');
SELECT save_mentor_profile('Kỹ sư phần mềm 10 năm', 'Từng làm trưởng nhóm', ARRAY['Phỏng vấn', ' Phỏng vấn ', 'CV'], ARRAY[t_id('field'), gen_random_uuid()], 10::smallint);
SELECT t_assert((SELECT cardinality(expertise_topics) = 2 AND field_ids = ARRAY[t_id('field')] AND years_experience = 10 FROM mentor_profiles),
  'Lưu hồ sơ: bỏ chủ đề trùng, bỏ lĩnh vực không có');

SELECT public.t_act_as('00000000-0000-0000-0000-0000000000c2');
SELECT t_assert((SELECT jsonb_array_length(list_verified_mentors()) = 0), 'Chưa xác minh thì học sinh không thấy');
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000c1');
SELECT verify_mentor('00000000-0000-0000-0000-0000000000c3', true);
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000c2');
SELECT request_mentor_connection('00000000-0000-0000-0000-0000000000c3', 'Xin tư vấn chọn ngành');
SELECT t_assert((SELECT elem -> 'field_names' ->> 0 = 'Công nghệ thông tin' AND elem ->> 'connection_status' = 'pending'
                   FROM jsonb_array_elements(list_verified_mentors()) elem),
  'Danh sách người hướng dẫn có lĩnh vực và trạng thái kết nối');

-- Sự kiện ------------------------------------------------------------------------------------------
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000c1');
SELECT t_expect_error($$SELECT create_career_event(NULL, 'Ngày hội', NULL, NULL, now() + interval '2 days', 10, now() + interval '3 days')$$,
  'invalid_deadline', 'Hạn đăng ký sau giờ diễn ra bị từ chối');
INSERT INTO t_c SELECT 'event', create_career_event(NULL, 'Ngày hội hướng nghiệp', 'Gặp gỡ doanh nghiệp', 'Hà Nội', now() + interval '5 days', 2, now() + interval '4 days', 'Học sinh lớp 11, 12');
SELECT public.t_act_as('00000000-0000-0000-0000-0000000000c2');
SELECT register_career_event(t_id('event'), true);
SELECT t_assert((SELECT (e ->> 'registered')::boolean AND (e ->> 'registrations')::int = 1 AND e ->> 'audience' = 'Học sinh lớp 11, 12' AND e ->> 'organizer' = 'VibeMapping'
                   FROM (SELECT get_career_event(t_id('event')) e) x), 'Chi tiết sự kiện có đối tượng, đơn vị, số đăng ký');
SELECT t_expect_error($$SELECT get_career_event(gen_random_uuid())$$, 'not_found', 'Sự kiện không có báo lỗi');
SELECT t_assert((SELECT jsonb_array_length(list_career_events()) = 1), 'Danh sách sự kiện dùng cùng dạng dữ liệu');

SELECT 'Hoàn tất kiểm thử cộng đồng' AS result;
