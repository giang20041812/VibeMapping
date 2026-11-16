-- JD từ nhiều file nghiên cứu: file Career_Profile có cột ID số dùng làm source_id; các file sau
-- (như RESEARCH JOB BA) đánh ID lại từ 1 ở mỗi sheet nên dùng khóa chữ ổn định source_key.

ALTER TABLE public.career_job_descriptions ALTER COLUMN source_id DROP NOT NULL;
ALTER TABLE public.career_job_descriptions ADD COLUMN IF NOT EXISTS source_key text;
ALTER TABLE public.career_job_descriptions ADD COLUMN IF NOT EXISTS source_file text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'career_job_descriptions_source_key_key') THEN
    ALTER TABLE public.career_job_descriptions ADD CONSTRAINT career_job_descriptions_source_key_key UNIQUE (source_key);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'career_job_descriptions_source_present') THEN
    ALTER TABLE public.career_job_descriptions ADD CONSTRAINT career_job_descriptions_source_present
      CHECK (source_id IS NOT NULL OR source_key IS NOT NULL);
  END IF;
END $$;

UPDATE public.career_job_descriptions SET source_file = 'Career_Profile.xlsx' WHERE source_file IS NULL AND source_id IS NOT NULL;
