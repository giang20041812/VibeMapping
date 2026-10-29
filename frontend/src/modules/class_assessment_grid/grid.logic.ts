import { normalizeSearchText } from '../../lib/searchText';
import type { CellValue, GridData, ShortCriteria } from './class_assessment_grid.types';

export const CELL_OPTIONS: { value: CellValue; label: string }[] = [
  { value: '', label: '—' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: 'na', label: 'Không đủ cơ sở' },
];

/** Điểm theo từng học sinh (mã dòng học sinh), mỗi học sinh một bảng nhỏ theo mã tiêu chí */
export type ScoreMap = Map<string, Map<string, CellValue>>;

export function toScoreMap(grid: GridData): ScoreMap {
  const map: ScoreMap = new Map();
  for (const student of grid.students) {
    const scores = new Map<string, CellValue>();
    for (const cell of student.cells) {
      if (cell.is_insufficient_basis) scores.set(cell.criteria_id, 'na');
      else if (cell.score !== null) scores.set(cell.criteria_id, String(cell.score) as CellValue);
    }
    map.set(student.grid_student_id, scores);
  }
  return map;
}

export function cellToDb(value: CellValue): number | 'na' | null {
  if (value === '') return null;
  return value === 'na' ? 'na' : Number(value);
}

/** Hai cột đầu của tệp mẫu chấm điểm */
export const GRADE_SHEET_HEADERS = ['Mã học sinh', 'Họ và tên'] as const;

const NA_PATTERN = /^(na|n\/a|x|không đủ cơ sở|khong du co so)$/i;

export function parseCellText(text: string): CellValue | null {
  const value = text.trim();
  if (value === '') return '';
  if (/^[1-5]$/.test(value)) return value as CellValue;
  if (NA_PATTERN.test(value)) return 'na';
  return null;
}

export interface GradeSheetStudent {
  gridStudentId: string;
  studentCode: string | null;
  fullName: string;
}

export interface GradeSheetResult {
  changes: { gridStudentId: string; criteriaId: string; value: CellValue }[];
  /** Số học sinh có điểm được nhập */
  studentCount: number;
  /** Số ô sai giá trị, bị bỏ qua */
  invalid: number;
  /** Số dòng trong tệp không khớp học sinh nào */
  unmatchedRows: number[];
}

export class GradeSheetError extends Error {}

/**
 * Đọc bảng điểm từ tệp mẫu: dòng 1 là tiêu đề (Mã học sinh, Họ và tên, rồi mã từng tiêu chí),
 * mỗi dòng sau là một học sinh. Dòng khớp học sinh theo mã học sinh, không có mã thì theo họ tên.
 * Ô để trống giữ nguyên điểm đang có; ô sai giá trị bị bỏ qua và được đếm vào `invalid`.
 */
export function parseGradeRows(rows: string[][], students: GradeSheetStudent[], criteria: ShortCriteria[]): GradeSheetResult {
  const header = rows[0] ?? [];
  if (header[0] !== GRADE_SHEET_HEADERS[0] || header[1] !== GRADE_SHEET_HEADERS[1]) {
    throw new GradeSheetError('Sai mẫu: dòng đầu phải bắt đầu bằng "Mã học sinh" và "Họ và tên".');
  }

  const criteriaByCode = new Map(criteria.map((item) => [item.dimension_code.toLowerCase(), item]));
  const columns = header
    .map((code, index) => ({ index, item: criteriaByCode.get(code.trim().toLowerCase()) }))
    .filter((column) => column.index >= GRADE_SHEET_HEADERS.length && column.item);
  if (columns.length === 0) throw new GradeSheetError('Không có cột tiêu chí nào khớp với bộ câu hỏi rút gọn.');

  const byCode = new Map(students.filter((student) => student.studentCode).map((student) => [student.studentCode!.trim().toLowerCase(), student]));
  const byName = new Map<string, GradeSheetStudent[]>();
  for (const student of students) {
    const key = normalizeSearchText(student.fullName);
    byName.set(key, [...(byName.get(key) ?? []), student]);
  }

  const changes: GradeSheetResult['changes'] = [];
  const matched = new Set<string>();
  const unmatchedRows: number[] = [];
  let invalid = 0;

  rows.slice(1).forEach((row, offset) => {
    const code = (row[0] ?? '').trim().toLowerCase();
    const name = normalizeSearchText(row[1] ?? '');
    if (code === '' && name === '') return;
    const candidates = byName.get(name) ?? [];
    const student = (code && byCode.get(code)) || (candidates.length === 1 ? candidates[0] : undefined);
    if (!student) {
      unmatchedRows.push(offset + 2);
      return;
    }
    for (const column of columns) {
      const parsed = parseCellText(row[column.index] ?? '');
      if (parsed === '') continue;
      if (parsed === null) {
        invalid += 1;
        continue;
      }
      matched.add(student.gridStudentId);
      changes.push({ gridStudentId: student.gridStudentId, criteriaId: column.item!.id, value: parsed });
    }
  });
  return { changes, studentCount: matched.size, invalid, unmatchedRows };
}

/**
 * Tách văn bản dán từ bảng tính (dòng cách nhau bằng xuống dòng, ô cách nhau bằng tab).
 * Bỏ dòng trống ở cuối do trình soạn bảng tính thêm vào.
 */
export function parsePastedText(text: string): string[][] {
  const rows = text.replace(/\r/g, '').split('\n').map((line) => line.split('\t'));
  while (rows.length > 0 && rows[rows.length - 1].every((cell) => cell.trim() === '')) rows.pop();
  return rows;
}

/**
 * Điền xuống: đi từ trên xuống, ô trống nhận giá trị của ô có điểm gần nhất phía trên.
 * Ô trống ở trên cùng (chưa có giá trị nào phía trên) giữ nguyên.
 */
export function fillDownChanges(
  studentIds: string[],
  criteriaId: string,
  scores: ScoreMap,
): { gridStudentId: string; criteriaId: string; value: CellValue }[] {
  const changes: { gridStudentId: string; criteriaId: string; value: CellValue }[] = [];
  let last: CellValue = '';
  for (const id of studentIds) {
    const current = scores.get(id)?.get(criteriaId) ?? '';
    if (current !== '') last = current;
    else if (last !== '') changes.push({ gridStudentId: id, criteriaId, value: last });
  }
  return changes;
}
