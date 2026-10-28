export interface GridCell {
  criteria_id: string;
  score: number | null;
  is_insufficient_basis: boolean;
}

export interface GridStudent {
  grid_student_id: string;
  student_id: string;
  full_name: string;
  acquaintance_duration: number | null;
  contact_frequency: number | null;
  observation_depth: number | null;
  guardian_pending: boolean;
  cells: GridCell[];
}

export interface GridData {
  grid_id: string;
  status: 'draft' | 'submitted';
  submitted_at: string | null;
  default_acquaintance_duration: number | null;
  default_contact_frequency: number | null;
  default_observation_depth: number | null;
  students: GridStudent[];
}

export interface ShortCriteria {
  id: string;
  dimension_code: string;
  name: string;
  sort_order: number;
  group_code: string;
  group_name: string;
  group_sort: number;
}

/** Giá trị một ô: '' là chưa chấm, '1'–'5' là điểm, 'na' là không đủ cơ sở */
export type CellValue = '' | '1' | '2' | '3' | '4' | '5' | 'na';

export type GridSubmitResult =
  | { ok: true }
  | { ok: false; reason: 'empty_cells'; empty_count: number }
  | { ok: false; reason: 'guardian_pending'; student_ids: string[] }
  | { ok: false; reason: 'missing_understanding'; student_count: number }
  | { ok: false; reason: 'short_set_not_configured' };
