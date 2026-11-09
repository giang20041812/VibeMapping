-- Mở rộng các cột học phí đã tách số liệu trên training_programs (đơn vị: đồng).

ALTER TABLE public.training_programs
  DROP CONSTRAINT IF EXISTS training_programs_tuition_basis_check;

ALTER TABLE public.training_programs
  ADD COLUMN IF NOT EXISTS tuition_per_year_min bigint,
  ADD COLUMN IF NOT EXISTS tuition_per_year_max bigint,
  ADD COLUMN IF NOT EXISTS tuition_total_min bigint,
  ADD COLUMN IF NOT EXISTS tuition_total_max bigint,
  ADD COLUMN IF NOT EXISTS tuition_per_credit bigint,
  ADD COLUMN IF NOT EXISTS program_credits smallint,
  ADD COLUMN IF NOT EXISTS tuition_per_month bigint,
  ADD COLUMN IF NOT EXISTS tuition_status text
    CHECK (tuition_status IN ('amount', 'free', 'credit_only', 'unpublished', 'unclear')),
  ADD COLUMN IF NOT EXISTS tuition_is_estimate boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT training_programs_tuition_basis_check
    CHECK (tuition_basis IN ('semester', 'year', 'total', 'credit'));

