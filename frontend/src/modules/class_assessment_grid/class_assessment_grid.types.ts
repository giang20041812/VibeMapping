import type { PackageSize } from '../assessment_session/assessmentSession.types';

export interface GridCell {
  question_id: string;
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

/** Một câu hỏi của gói giáo viên đã chọn, là một cột của bảng */
export interface GridQuestion {
  question_id: string;
  question_code: string;
  content: string;
  /** 5 nhãn đáp án theo điểm 1–5; không có thì hiện điểm */
  answer_options: string[] | null;
  criteria_id: string;
  dimension_code: string;
  criteria_name: string;
  group_code: string;
  group_name: string;
}

export interface GridData {
  grid_id: string;
  /** Bảng đã nộp thì khóa, không sửa được nữa */
  status: 'draft' | 'submitted';
  submitted_at: string | null;
  /** Gói câu hỏi; chưa chọn thì chưa chấm được */
  package_size: PackageSize | null;
  default_acquaintance_duration: number | null;
  default_contact_frequency: number | null;
  default_observation_depth: number | null;
  questions: GridQuestion[];
  students: GridStudent[];
}

/** Giá trị một ô: '' là chưa trả lời, '1'–'5' là điểm của đáp án, 'na' là không đủ cơ sở */
export type CellValue = '' | '1' | '2' | '3' | '4' | '5' | 'na';

export type GridSubmitResult =
  | { ok: true }
  | { ok: false; reason: 'empty_cells'; empty_count: number; student_ids: string[] }
  | { ok: false; reason: 'guardian_pending'; student_ids: string[] }
  | { ok: false; reason: 'missing_understanding'; student_ids: string[] }
  | { ok: false; reason: 'no_students' }
  | { ok: false; reason: 'already_submitted' }
  | { ok: false; reason: 'package_not_selected' };
