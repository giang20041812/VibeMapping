export type CareerStatus = 'draft' | 'review' | 'published' | 'hidden';
export type CheckedKind = 'checked' | 'posted';

export interface AdminCareerRow {
  id: string;
  career_code: string;
  career_name: string;
  career_field_id: string;
  status: CareerStatus;
  qualifying_jd_count: number;
  holland_top3: string | null;
  is_standard_complete: boolean;
  data_checked_at: string | null;
  data_checked_kind: CheckedKind | null;
}

export interface AdminCareerFull extends AdminCareerRow {
  source_group_id: string;
  growth_level: string | null;
  career_description: string | null;
  key_skills: string | null;
  salary_range_text: string | null;
  career_path_text: string | null;
  data_source_note: string | null;
}

export interface CareerFieldOption {
  id: string;
  field_code: string;
  field_name: string;
  parent_field_id: string | null;
}

export interface RequirementCriterion {
  id: string;
  dimension_code: string;
  name: string;
  group_code: string;
}

export interface RequirementRow {
  dimension_code: string;
  required_score: number;
  career_weight: number;
  jd_count: number;
  verification_level: string;
}

export interface HollandRow {
  holland_code: string;
  strength: number;
  jd_count: number;
  verification_level: string;
}

export interface SourceJd {
  id: string;
  company_name: string | null;
  job_title: string | null;
  career_level_raw: string | null;
  required_level: number | null;
  data_checked_at: string | null;
  data_checked_kind: CheckedKind | null;
  jd_url: string | null;
}

export interface CareerAuditEntry {
  id: string;
  action: string;
  created_at: string;
  details: Record<string, unknown> | null;
}

export interface CareerAdminDetail {
  career: AdminCareerFull;
  requirements: RequirementRow[];
  holland: HollandRow[];
  jds: SourceJd[];
  history: CareerAuditEntry[];
  matrixVersion: string | null;
}

export interface CareerInfoInput {
  career_name: string;
  career_field_id: string;
  career_description: string;
  key_skills: string;
  salary_range_text: string;
  career_path_text: string;
  growth_level: string;
  data_source_note: string;
  data_checked_at: string;
  data_checked_kind: CheckedKind;
}

export interface RequirementInput {
  dimension_code: string;
  required_score: number;
  career_weight: number;
}
