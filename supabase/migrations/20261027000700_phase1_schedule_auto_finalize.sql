-- ====================================================================
-- Phase 1 / Migration 7: Lịch chạy chốt kết quả tự động (mỗi giờ)
-- Dùng pg_cron nên đi cùng schema khi chuyển từ Supabase Cloud sang VPS tự host.
-- Nếu môi trường chưa có pg_cron thì bỏ qua, không làm hỏng migration.
-- ====================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    -- cron.schedule theo tên job: chạy lại sẽ cập nhật chứ không tạo trùng
    PERFORM cron.schedule(
      'auto-finalize-results',
      '0 * * * *',
      $job$SELECT public.auto_finalize_results()$job$
    );
  ELSE
    RAISE NOTICE 'pg_cron chưa có: hãy bật extension pg_cron rồi chạy lại migration này';
  END IF;
END $$;
