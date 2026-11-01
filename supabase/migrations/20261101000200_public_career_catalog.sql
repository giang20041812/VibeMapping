-- FR04.01.03: danh mục nghề đã công bố đọc được khi chưa đăng nhập.
-- Không mở nghề nháp, nghề ẩn, hay dữ liệu điểm của người học.

DROP POLICY IF EXISTS "Anon read published careers" ON public.careers;
CREATE POLICY "Anon read published careers" ON public.careers
  FOR SELECT TO anon USING (status = 'published');

DROP POLICY IF EXISTS "Anon read career fields" ON public.career_fields;
CREATE POLICY "Anon read career fields" ON public.career_fields
  FOR SELECT TO anon USING (is_active);

DROP POLICY IF EXISTS "Anon read published job descriptions" ON public.career_job_descriptions;
CREATE POLICY "Anon read published job descriptions" ON public.career_job_descriptions
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.careers c WHERE c.id = career_id AND c.status = 'published')
  );

DROP POLICY IF EXISTS "Anon read published requirements" ON public.career_requirements;
CREATE POLICY "Anon read published requirements" ON public.career_requirements
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.careers c WHERE c.id = career_id AND c.status = 'published')
  );

DROP POLICY IF EXISTS "Anon read published holland" ON public.career_holland_profiles;
CREATE POLICY "Anon read published holland" ON public.career_holland_profiles
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.careers c WHERE c.id = career_id AND c.status = 'published')
  );
