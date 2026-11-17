import type { FrameworkSection, FrameworkTier } from '../career_explorer/careerLevelFramework.types';

export type SkillKind = 'soft_skill' | 'hard_skill' | 'knowledge' | 'tool' | 'language' | 'certificate' | 'project' | 'experience';

export interface SkillProfileItem {
  id: string;
  kind: SkillKind;
  title: string;
  criteria_id: string | null;
  framework_item_id: string | null;
  self_level: number | null;
  verified_360: boolean;
  verified_until: string | null;
  updated_at: string;
}

export interface SkillProfileInput {
  kind: SkillKind;
  title: string;
  self_level: number;
  framework_item_id?: string | null;
}

/** Vị trí công việc để đối chiếu: một bậc đã công bố trong khung JD của một nghề */
export interface GapPosition {
  framework_id: string;
  career_id: string;
  career_name: string;
  career_level: number;
  level_name: string;
  skill_count: number;
  updated_at: string;
}

export type GapStatus = 'met' | 'near' | 'unmet';
export type GapImpact = 'high' | 'medium' | 'low';

/** Một kỹ năng JD yêu cầu, sau khi so với hồ sơ */
export interface GapRow {
  item_id: string | null;
  section: FrameworkSection;
  tier: FrameworkTier;
  content: string;
  detail: string | null;
  impact: GapImpact;
  weight: number;
  required_level: number;
  current_level: number | null;
  profile_item_id: string | null;
  criteria_id: string | null;
  verified_360: boolean;
  gap: number;
  status: GapStatus;
}

export interface GapResult {
  framework_id: string;
  career_id: string;
  position_name: string;
  analysed_at: string;
  overall_percent: number;
  counts: Record<GapStatus, number>;
  rows: GapRow[];
  /** Gần đạt và Chưa đạt, xếp giảm dần theo mức ảnh hưởng rồi mức thiếu */
  ranked: GapRow[];
}

export interface GapParams {
  impactWeights: Record<FrameworkTier, number>;
  defaultRequiredLevel: number;
  /** Thiếu từ mức này trở lên là Chưa đạt */
  largeGapLevel: number;
}

export interface GapHistoryEntry {
  id: string;
  framework_id: string | null;
  position_name: string;
  overall_percent: number;
  met_count: number;
  near_count: number;
  unmet_count: number;
  created_at: string;
}

export interface CourseSuggestion {
  id: string;
  criteria_id: string | null;
  kind: 'course' | 'project' | 'certificate';
  title: string;
  provider: string | null;
  url: string | null;
  is_partner: boolean;
  skill_keywords: string[];
}
