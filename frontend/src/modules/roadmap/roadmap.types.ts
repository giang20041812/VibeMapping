export type RoadmapPillar = 'knowledge' | 'experience' | 'exploration';

export type ActivityType = 'course' | 'book' | 'exercise' | 'project';

export type RegenerateReason = 'off_track' | 'circumstances' | 'career_changed' | 'not_admitted';

export interface Milestone {
  id: string;
  pillar: RoadmapPillar;
  title: string;
  done: boolean;
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
}

export interface Roadmap {
  id: string;
  title: string;
  career_id: string | null;
  career_name: string | null;
  training_program_id: string | null;
  program_title: string | null;
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
  missingPillars: RoadmapPillar[];
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
