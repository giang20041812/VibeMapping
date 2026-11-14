export type RaterGroup = 'self' | 'parent' | 'friend' | 'teacher' | 'mentor';

export interface CriteriaGroup {
  id: string;
  group_code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface Criteria {
  id: string;
  group_id: string;
  dimension_code: string;
  name: string;
  definition: string | null;
  behavior_indicator: string | null;
  reference_source: string | null;
  holland_code: string | null;
  sort_order: number;
  is_active: boolean;
  is_short_set: boolean;
}

export interface CriteriaRaterVisibility {
  id: string;
  criteria_id: string;
  rater_group: RaterGroup;
  is_visible: boolean;
  scale_method: string | null;
}

export interface HollandCode {
  holland_code: string;
  name: string;
}

export interface QuestionRow {
  id: string;
  question_code: string;
  criteria_id: string;
  dimension_code: string;
  criteria_name: string;
  group_code: string;
  rater_group: RaterGroup;
  respondent_segment: string;
  question_type: string | null;
  content: string;
  answer_options: string[];
  assessment_part: number | null;
  detail_level: string | null;
  is_active: boolean;
}

export interface QuestionFilter {
  keyword: string;
  groupId: string;
  criteriaId: string;
  raterGroup: string;
  assessmentPart: string;
  detailLevel: string;
  activeState: string;
}

export interface QuestionInput {
  question_code: string;
  criteria_id: string;
  rater_group: RaterGroup;
  respondent_segment: string;
  question_type: string | null;
  content: string;
  answer_options: string[];
  assessment_part: number | null;
  detail_level: string | null;
  is_active: boolean;
}

export interface Paged<T> {
  rows: T[];
  total: number;
}

export interface OperationParameter {
  id: string;
  param_code: string;
  param_name: string;
  param_value: unknown;
  is_current: boolean;
  effective_from: string;
  changed_by: string | null;
  changed_by_name: string | null;
}

export interface AuditLogFilter {
  keyword: string;
  targetType: string;
  person: string;
  dateFrom: string;
  dateTo: string;
}

export interface AuditLogRow {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: unknown;
  created_at: string;
  actor_name: string | null;
  subject_name: string | null;
}
