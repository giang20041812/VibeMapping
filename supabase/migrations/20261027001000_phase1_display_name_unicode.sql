-- ====================================================================
-- Phase 1 / Migration 10: Tên hiển thị cho phép chữ có dấu
-- Ràng buộc cũ dùng [[:alnum:]] phụ thuộc locale; database dùng collation kiểu C nên loại cả chữ tiếng Việt.
-- Đổi sang loại trừ ký tự dấu câu ASCII; việc chỉ cho chữ và số Unicode do giao diện kiểm tra.
-- ====================================================================

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_display_name_format;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_display_name_format
  CHECK (
    display_name IS NULL
    OR (
      char_length(display_name) BETWEEN 1 AND 20
      AND display_name !~ '[\x21-\x2c.\/\x3a-\x40\x5b-\x5e\x60\x7b-\x7e]'
    )
  );
