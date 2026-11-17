-- INT-005, FR01.03.03, FR06.02.03, FR03.03.05: lưu Hồ sơ định hướng (PDF), Báo cáo quyết định (PDF) và tệp dữ liệu cá nhân
-- lên kho tệp riêng tư; người dùng tải lại bằng đường dẫn có hạn. Mỗi người chỉ đọc, ghi, xóa thư mục <user_id>/ của mình.

CREATE TABLE IF NOT EXISTS public.exported_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('orientation_profile', 'decision_report', 'personal_data')),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf', 'application/json')),
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT exported_files_path_owner CHECK (split_part(storage_path, '/', 1) = owner_id::text)
);
CREATE INDEX IF NOT EXISTS exported_files_owner_idx ON public.exported_files(owner_id, created_at DESC);
ALTER TABLE public.exported_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads exported files" ON public.exported_files;
CREATE POLICY "Owner reads exported files" ON public.exported_files FOR SELECT TO authenticated USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "Owner adds exported files" ON public.exported_files;
CREATE POLICY "Owner adds exported files" ON public.exported_files FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "Owner deletes exported files" ON public.exported_files;
CREATE POLICY "Owner deletes exported files" ON public.exported_files FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Kho tệp của Supabase Storage. Cụm Postgres thử nghiệm không có schema storage nên bỏ qua.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'Bỏ qua tạo bucket exports: không có Supabase Storage';
    RETURN;
  END IF;
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('exports', 'exports', false, 10485760, ARRAY['application/pdf', 'application/json'])
  ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

  EXECUTE 'DROP POLICY IF EXISTS "Owner reads own exports" ON storage.objects';
  EXECUTE 'CREATE POLICY "Owner reads own exports" ON storage.objects FOR SELECT TO authenticated
           USING (bucket_id = ''exports'' AND (storage.foldername(name))[1] = auth.uid()::text)';
  EXECUTE 'DROP POLICY IF EXISTS "Owner uploads own exports" ON storage.objects';
  EXECUTE 'CREATE POLICY "Owner uploads own exports" ON storage.objects FOR INSERT TO authenticated
           WITH CHECK (bucket_id = ''exports'' AND (storage.foldername(name))[1] = auth.uid()::text)';
  EXECUTE 'DROP POLICY IF EXISTS "Owner deletes own exports" ON storage.objects';
  EXECUTE 'CREATE POLICY "Owner deletes own exports" ON storage.objects FOR DELETE TO authenticated
           USING (bucket_id = ''exports'' AND (storage.foldername(name))[1] = auth.uid()::text)';
END;
$$;
