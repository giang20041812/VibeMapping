-- Ngưỡng JD tối thiểu theo dữ liệu hiện có; đăng nghề yêu cầu đủ chuẩn và đủ JD.
UPDATE public.operation_parameters SET param_value = to_jsonb(1), updated_at = now()
 WHERE param_code = 'career_min_jd' AND is_current;

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
  UPDATE public.careers SET status = p_status, data_checked_at = CASE WHEN p_status = 'published' THEN current_date ELSE data_checked_at END
   WHERE id = p_career_id;
  PERFORM public.write_audit_log(auth.uid(), NULL, 'set_career_status', 'careers', p_career_id, jsonb_build_object('status', p_status));
END;
$$;
REVOKE ALL ON FUNCTION public.set_career_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_career_status(uuid, text) TO authenticated;
