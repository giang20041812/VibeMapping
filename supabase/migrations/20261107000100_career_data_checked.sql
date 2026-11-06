-- Ngày kiểm tra dữ liệu nghề (P20, R17): lấy từ cột "Nguồn dữ liệu" của JD.
-- data_checked_kind: 'checked' = ngày kiểm tra/research/cập nhật; 'posted' = ngày đăng tin (dev dùng thay khi JD không ghi ngày kiểm tra).
ALTER TABLE public.career_job_descriptions
  ADD COLUMN IF NOT EXISTS data_checked_at date,
  ADD COLUMN IF NOT EXISTS data_checked_kind text CHECK (data_checked_kind IN ('checked', 'posted'));
ALTER TABLE public.careers
  ADD COLUMN IF NOT EXISTS data_checked_kind text CHECK (data_checked_kind IN ('checked', 'posted'));

-- Công bố nghề không còn ghi đè ngày kiểm tra bằng ngày bấm nút: ngày bấm công bố không phải ngày kiểm tra JD.
CREATE OR REPLACE FUNCTION public.set_career_status(p_career_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_std boolean;
  v_jd integer;
  v_min integer := public.param_num('career_min_jd', 1)::integer;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_status NOT IN ('draft', 'review', 'published', 'hidden') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF p_status = 'published' THEN
    SELECT is_standard_complete, qualifying_jd_count INTO v_std, v_jd FROM public.careers WHERE id = p_career_id;
    IF NOT COALESCE(v_std, false) THEN RAISE EXCEPTION 'career_standard_incomplete'; END IF;
    IF COALESCE(v_jd, 0) < v_min THEN RAISE EXCEPTION 'career_jd_below_minimum'; END IF;
  END IF;
  UPDATE public.careers SET status = p_status WHERE id = p_career_id;
  PERFORM public.write_audit_log(auth.uid(), NULL, 'set_career_status', 'careers', p_career_id, jsonb_build_object('status', p_status));
END;
$$;
REVOKE ALL ON FUNCTION public.set_career_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_career_status(uuid, text) TO authenticated;
