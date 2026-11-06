export type RoadmapPillar = 'knowledge' | 'experience' | 'exploration';

export interface Milestone {
  id: string;
  pillar: RoadmapPillar;
  title: string;
  done: boolean;
  due_date: string | null;
  weight: number;
  is_checkpoint: boolean;
}

export interface Roadmap {
  id: string;
  title: string;
  career_id: string | null;
  career_name: string | null;
  training_program_id: string | null;
  program_title: string | null;
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

export interface SetupValues {
  careerId: string;
  educationLevel: string;
  schoolYear: string;
  skills: string;
  certificates: string;
  extracurricular: string;
  targetMonth: string;
  hoursPerWeek: string;
}

export type SetupErrors = Partial<Record<keyof SetupValues, string>>;
