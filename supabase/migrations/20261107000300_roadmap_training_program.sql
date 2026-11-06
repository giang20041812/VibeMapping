-- Lộ trình gắn với chương trình đào tạo đã chọn ở so sánh phương án
-- Chạy sau 20261106000100_phase3_roadmap_engine.sql: list_my_roadmaps ở đây gồm cả các trường của bản đó
ALTER TABLE public.roadmaps
  ADD COLUMN IF NOT EXISTS training_program_id uuid REFERENCES public.training_programs(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_roadmap_program(p_roadmap_id uuid, p_training_program_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_training_program_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.training_programs WHERE id = p_training_program_id) THEN
    RAISE EXCEPTION 'program_not_found';
  END IF;
  UPDATE public.roadmaps SET training_program_id = p_training_program_id
  WHERE id = p_roadmap_id AND owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_roadmaps()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'title', r.title, 'career_id', r.career_id, 'career_name', c.career_name,
    'training_program_id', r.training_program_id,
    'program_title', CASE WHEN tp.id IS NULL THEN NULL ELSE
      concat_ws(' – ', i.institution_name, m.major_name) ||
      CASE WHEN tp.specialization_name IS NOT NULL THEN ' (' || tp.specialization_name || ')' ELSE '' END END,
    'is_active', r.is_active, 'target_date', r.target_date, 'created_at', r.created_at,
    'education_level', r.education_level, 'school_year', r.school_year,
    'current_skills', r.current_skills, 'certificates', r.certificates, 'extracurricular', r.extracurricular,
    'hours_per_week', r.hours_per_week, 'regenerate_reason', r.regenerate_reason, 'previous_roadmap_id', r.previous_roadmap_id,
    'careers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', tc.career_id, 'name', k.career_name) ORDER BY tc.sort_order)
        FROM public.roadmap_target_careers tc JOIN public.careers k ON k.id = tc.career_id WHERE tc.roadmap_id = r.id
    ), '[]'::jsonb),
    'milestones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', ms.id, 'pillar', ms.pillar, 'title', ms.title, 'done', ms.done,
               'due_date', ms.due_date, 'weight', ms.weight, 'is_checkpoint', ms.is_checkpoint,
               'note', ms.note, 'done_at', ms.done_at, 'source', ms.source,
               'pass_criteria', ms.pass_criteria, 'fail_criteria', ms.fail_criteria,
               'activity_type', ms.activity_type, 'is_partner', ms.is_partner, 'expected_result', ms.expected_result) ORDER BY ms.due_date NULLS LAST, ms.created_at)
        FROM public.roadmap_milestones ms WHERE ms.roadmap_id = r.id
    ), '[]'::jsonb)
  ) ORDER BY r.is_active DESC, r.created_at DESC), '[]'::jsonb)
  FROM public.roadmaps r
  LEFT JOIN public.careers c ON c.id = r.career_id
  LEFT JOIN public.training_programs tp ON tp.id = r.training_program_id
  LEFT JOIN public.institutions i ON i.id = tp.institution_id
  LEFT JOIN public.majors m ON m.id = tp.major_id
  WHERE r.owner_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.set_roadmap_program(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_roadmap_program(uuid, uuid) TO authenticated;
