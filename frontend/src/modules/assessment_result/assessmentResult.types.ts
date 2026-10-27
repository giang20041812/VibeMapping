export type ResultStatusLabel = 'self_assessment' | 'temporary' | 'final_360';

export type CompetencyLevel = 'very_high' | 'high' | 'medium' | 'low';

/** Điểm một nhóm tiêu chí, thang 0–100; null là chưa đủ dữ liệu */
export interface GroupScore {
  groupCode: string;
  name: string;
  sortOrder: number;
  self: number | null;
  combined: number | null;
}

export interface AssessmentResultSummary {
  id: string;
  statusLabel: ResultStatusLabel;
  acceptedCount: number;
  expectedCount: number;
  groupsCount: number;
  thinDataFlag: boolean;
  insufficientBasisWarning: boolean;
  calculatedAt: string | null;
  finalizedAt: string | null;
  groups: GroupScore[];
}
