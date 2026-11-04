-- Phase 2 – Nghề của tôi: bỏ lưu, bỏ nghề mục tiêu, lịch sử nghề mục tiêu (FR04.02.14–15, BR-018).

CREATE TABLE IF NOT EXISTS public.target_career_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  career_id uuid NOT NULL REFERENCES public.careers(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('set', 'unset')),
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_target_career_history_user ON public.target_career_history(user_id, created_at DESC);
ALTER TABLE public.target_career_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads target history" ON public.target_career_history;
CREATE POLICY "Owner reads target history" ON public.target_career_history FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.save_career_bookmark(p_career_id uuid, p_kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR p_kind NOT IN ('saved', 'target') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.careers WHERE id = p_career_id) THEN RAISE EXCEPTION 'career_not_found'; END IF;
  INSERT INTO public.user_saved_careers (user_id, career_id, kind) VALUES (auth.uid(), p_career_id, p_kind)
  ON CONFLICT (user_id, career_id, kind) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF p_kind = 'target' AND v_count > 0 THEN
    INSERT INTO public.target_career_history (user_id, career_id, action) VALUES (auth.uid(), p_career_id, 'set');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_career_bookmark(p_career_id uuid, p_kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR p_kind NOT IN ('saved', 'target') THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.user_saved_careers WHERE user_id = auth.uid() AND career_id = p_career_id AND kind = p_kind;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF p_kind = 'target' AND v_count > 0 THEN
    INSERT INTO public.target_career_history (user_id, career_id, action) VALUES (auth.uid(), p_career_id, 'unset');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_saved_careers()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'career_id', s.career_id, 'kind', s.kind, 'career_name', c.career_name, 'career_code', c.career_code,
    'created_at', s.created_at
  ) ORDER BY s.created_at), '[]'::jsonb)
  FROM public.user_saved_careers s
  JOIN public.careers c ON c.id = s.career_id
  WHERE s.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.save_career_bookmark(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_career_bookmark(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_saved_careers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_career_bookmark(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_career_bookmark(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_saved_careers() TO authenticated;
