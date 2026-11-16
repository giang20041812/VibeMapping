export type CareerLevelFrameworkStatus = 'draft' | 'published';
export type FrameworkTier = 'required' | 'common' | 'advantage';

export type FrameworkSection =
  | 'task' | 'output' | 'stakeholder'
  | 'knowledge' | 'professional_skill' | 'soft_skill' | 'tool' | 'education' | 'certificate'
  | 'experience' | 'language' | 'special_requirement'
  | 'benefit' | 'salary' | 'competency' | 'industry_variant' | 'company_variant' | 'career_move'
  | 'pass_threshold' | 'interview_question';

export interface CareerLevelFrameworkItem {
  id?: string;
  section: FrameworkSection;
  tier: FrameworkTier | null;
  group_label: string | null;
  content: string;
  detail: string | null;
  note: string | null;
  salary_min: number | null;
  salary_max: number | null;
  target_career_id: string | null;
  target_level: number | null;
  jd_hits: number | null;
  jd_total: number | null;
  is_estimate: boolean;
  sort_order: number;
}

export interface CareerLevelFramework {
  id: string;
  career_id: string;
  career_level: number;
  level_name: string;
  status: CareerLevelFrameworkStatus;
  title_variants: string | null;
  reports_to: string | null;
  hiring_industries: string | null;
  experience_text: string | null;
  work_mode: string | null;
  career_summary: string | null;
  position_objectives: string | null;
  required_level: number | null;
  jd_count: number;
  source_note: string | null;
  published_at: string | null;
  updated_at: string;
  items: CareerLevelFrameworkItem[];
}

/** Nghề đích của một hướng phát triển, để trang nghề hiện tên và liên kết */
export interface CareerMoveTarget {
  id: string;
  career_name: string;
}
