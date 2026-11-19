import type { BandCode, CriteriaGroupCode } from '../../domain/roadmapTemplateGeneration';

export type RoadmapPillar = 'knowledge' | 'experience' | 'exploration';
export type { BandCode, CriteriaGroupCode };

export type ActivityType = 'course' | 'book' | 'exercise' | 'project';

export type RegenerateReason = 'off_track' | 'circumstances' | 'career_changed' | 'not_admitted';

/** Kế hoạch mẫu gợi ý cho một mục (nhóm Lãnh đạo & Tổ chức) */
export interface SamplePlan {
  id: string;
  title: string;
  fit_when: string | null;
  schedule_level_1: string | null;
  schedule_level_2: string | null;
  schedule_level_3: string | null;
  suggested_output: string | null;
  note: string | null;
}

/** Chi tiết lấy từ mục của lộ trình mẫu */
export interface MilestoneDetail {
  band_code: BandCode;
  stage_name: string;
  how_to: string | null;
  skills_gained: string | null;
  completion_evidence: string | null;
  duration_text: string | null;
  reference_source: string | null;
  level_duration_weeks?: Partial<Record<'1' | '2' | '3', number>> | null;
  level_guide?: string | null;
  prior_knowledge?: string | null;
  experience_task?: string | null;
  extra_hours_text?: string | null;
  fallback_options?: string | null;
  has_quiz?: boolean;
  plans?: SamplePlan[];
}

export interface Milestone {
  id: string;
  pillar: RoadmapPillar | null;
  criteria_group: CriteriaGroupCode | null;
  template_item_id: string | null;
  item_level: 1 | 2 | 3 | null;
  title: string;
  done: boolean;
  start_date: string | null;
  due_date: string | null;
  weight: number;
  is_checkpoint: boolean;
  note: string | null;
  done_at: string | null;
  source: 'system' | 'user';
  pass_criteria: string | null;
  fail_criteria: string | null;
  activity_type: ActivityType | null;
  is_partner: boolean;
  expected_result: string | null;
  quiz_score?: number | null;
  quiz_total?: number | null;
  quiz_passed_at?: string | null;
  detail: MilestoneDetail | null;
}

export interface QuizQuestion {
  question_no: number;
  question_text: string;
  options: Record<'A' | 'B' | 'C', string>;
}

export interface QuizResult {
  correct: number;
  total: number;
  passed: boolean;
  results: { question_no: number; chosen: string | null; correct_option: 'A' | 'B' | 'C' }[];
}

/** % đạt và band từng nhóm tiêu chí lúc tạo lộ trình */
export interface GroupSnapshot {
  group_code: CriteriaGroupCode;
  percent: number | null;
  band_code: BandCode;
  weight: number;
  gap: number;
}

export interface Roadmap {
  id: string;
  title: string;
  career_id: string | null;
  career_name: string | null;
  training_program_id: string | null;
  program_title: string | null;
  template_code: string | null;
  template_name: string | null;
  group_snapshot: GroupSnapshot[] | null;
  careers: { id: string; name: string }[];
  hours_per_week: number | null;
  regenerate_reason: RegenerateReason | null;
  is_active: boolean;
  target_date: string | null;
  created_at: string;
  education_level: string | null;
  school_year: string | null;
  current_skills: string | null;
  certificates: string | null;
  extracurricular: string | null;
  milestones: Milestone[];
}

export type StageStatus = 'done' | 'current' | 'late' | 'upcoming';

export interface Stage {
  key: string;
  label: string;
  startIso: string | null;
  endIso: string | null;
  items: Milestone[];
  actualPercent: number;
  plannedPercent: number;
  status: StageStatus;
}

export interface SoftSkill {
  criteria_id: string;
  name: string;
  group_name: string;
  score_percent: number | null;
  self_percent: number | null;
  others_percent: number | null;
  gap: number | null;
  reasons: ('low' | 'gap')[];
}

export interface SetupValues {
  careerIds: string[];
  templateCode: string;
  reason: RegenerateReason | '';
  educationLevel: string;
  schoolYear: string;
  skills: string;
  certificates: string;
  extracurricular: string;
  targetMonth: string;
  hoursPerWeek: string;
}

export type SetupErrors = Partial<Record<keyof SetupValues, string>>;
