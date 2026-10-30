-- ====================================================================
-- Phase 2 / Migration 2: Khách chưa đăng nhập đọc được danh mục trường – ngành
-- Trang Khám phá trường nằm ở khung công khai nên danh mục này mở cho anon (chỉ đọc).
-- Nghề và dữ liệu JD vẫn chỉ dành cho người đã đăng nhập và chỉ khi nghề đã công bố.
-- ====================================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['career_fields','majors','institutions','training_programs']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Anon read %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Anon read %1$s" ON public.%1$s FOR SELECT TO anon USING (true)', t);
  END LOOP;
END $$;
