-- Cơ sở của học phí mỗi kỳ: semester = ghi rõ mỗi kỳ; year = chia từ học phí năm; total = chia từ tổng khóa. Hai loại sau là ước tính.
ALTER TABLE public.training_programs
  ADD COLUMN IF NOT EXISTS tuition_basis text CHECK (tuition_basis IN ('semester', 'year', 'total'));
UPDATE public.training_programs SET tuition_basis = 'semester' WHERE tuition_per_semester_min IS NOT NULL AND tuition_basis IS NULL;
