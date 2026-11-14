-- Phase 4: khớp docs đã chốt (ENT học tập/ngân sách, thư viện lộ trình, gợi ý M08).
-- Không đổi R05 / L0 / 25-25 / S_i mặc định / Coverage / S_total — đang chờ BA.

CREATE TABLE IF NOT EXISTS public.academic_records (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  latest_score numeric,
  subject_combination text,
  admission_method text,
  recorded_year smallint,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.family_budgets (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  amount_per_year numeric,
  note text,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.approved_roadmap_activities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pillar text NOT NULL CHECK (pillar IN ('knowledge', 'experience', 'exploration')),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  duration_weeks numeric NOT NULL DEFAULT 2 CHECK (duration_weeks > 0),
  hours numeric NOT NULL DEFAULT 6 CHECK (hours > 0),
  criteria_id uuid REFERENCES public.criteria(id) ON DELETE SET NULL,
  repeatable boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.academic_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approved_roadmap_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own academic records" ON public.academic_records;
CREATE POLICY "Own academic records" ON public.academic_records FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Own family budgets" ON public.family_budgets;
CREATE POLICY "Own family budgets" ON public.family_budgets FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Read approved activities" ON public.approved_roadmap_activities;
CREATE POLICY "Read approved activities" ON public.approved_roadmap_activities FOR SELECT TO authenticated
  USING (is_active OR public.is_system_admin());

DROP POLICY IF EXISTS "Admin writes activities" ON public.approved_roadmap_activities;
CREATE POLICY "Admin writes activities" ON public.approved_roadmap_activities FOR ALL TO authenticated
  USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

CREATE OR REPLACE FUNCTION public.get_my_study_finance()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'latest_score', a.latest_score,
    'subject_combination', a.subject_combination,
    'admission_method', a.admission_method,
    'recorded_year', a.recorded_year,
    'budget_per_year', b.amount_per_year,
    'budget_note', b.note
  )
  FROM public.user_profiles p
  LEFT JOIN public.academic_records a ON a.user_id = p.id
  LEFT JOIN public.family_budgets b ON b.user_id = p.id
  WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.save_my_study_finance(
  p_latest_score numeric,
  p_subject_combination text,
  p_admission_method text,
  p_recorded_year integer,
  p_budget_per_year numeric,
  p_budget_note text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.academic_records (user_id, latest_score, subject_combination, admission_method, recorded_year)
  VALUES (auth.uid(), p_latest_score, nullif(trim(p_subject_combination), ''), nullif(trim(p_admission_method), ''), p_recorded_year)
  ON CONFLICT (user_id) DO UPDATE SET
    latest_score = excluded.latest_score,
    subject_combination = excluded.subject_combination,
    admission_method = excluded.admission_method,
    recorded_year = excluded.recorded_year,
    updated_at = now();
  INSERT INTO public.family_budgets (user_id, amount_per_year, note)
  VALUES (auth.uid(), p_budget_per_year, nullif(trim(p_budget_note), ''))
  ON CONFLICT (user_id) DO UPDATE SET
    amount_per_year = excluded.amount_per_year,
    note = excluded.note,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.add_roadmap_milestones_bulk(p_roadmap_id uuid, p_items jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item jsonb;
  v_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmaps WHERE id = p_roadmap_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    IF COALESCE(v_item->>'title', '') = '' THEN CONTINUE; END IF;
    IF COALESCE(v_item->>'pillar', '') NOT IN ('knowledge', 'experience', 'exploration') THEN
      RAISE EXCEPTION 'invalid_pillar';
    END IF;
    INSERT INTO public.roadmap_milestones (roadmap_id, pillar, title, due_date, weight, is_checkpoint)
    VALUES (
      p_roadmap_id,
      v_item->>'pillar',
      trim(v_item->>'title'),
      NULLIF(v_item->>'due_date', '')::date,
      COALESCE((v_item->>'weight')::numeric, 1),
      COALESCE((v_item->>'is_checkpoint')::boolean, false)
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'get_my_study_finance()',
    'save_my_study_finance(numeric, text, text, integer, numeric, text)',
    'add_roadmap_milestones_bulk(uuid, jsonb)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

INSERT INTO public.approved_roadmap_activities (pillar, title, duration_weeks, hours, repeatable)
SELECT v.pillar, v.title, v.weeks, v.hours, false
FROM (VALUES
  ('knowledge', 'Ôn kiến thức nền của nghề mục tiêu', 2, 8),
  ('experience', 'Thực hành một sản phẩm/mini project liên quan', 3, 10),
  ('exploration', 'Phỏng vấn hoặc quan sát một người đang làm nghề', 2, 4)
) AS v(pillar, title, weeks, hours)
WHERE NOT EXISTS (SELECT 1 FROM public.approved_roadmap_activities a WHERE a.title = v.title);
