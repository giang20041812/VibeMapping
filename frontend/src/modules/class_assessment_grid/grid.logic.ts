import type { CellValue, GridData, GridStudent, ShortCriteria } from './class_assessment_grid.types';

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

/** Hai cột đầu của tệp mẫu chấm điểm; dán cả bảng thì bỏ dòng tiêu đề và hai cột này */
export const GRADE_SHEET_HEADERS = ['Mã học sinh', 'Họ và tên'] as const;

const NA_PATTERN = /^(na|n\/a|x|không đủ cơ sở|khong du co so)$/i;

export function parseCellText(text: string): CellValue | null {
  const value = text.trim();
  if (value === '') return '';
  if (/^[1-5]$/.test(value)) return value as CellValue;
  if (NA_PATTERN.test(value)) return 'na';
  return null;
}

export interface PasteResult {
  changes: { gridStudentId: string; criteriaId: string; value: CellValue }[];
  invalid: number;
}

/**
 * Dữ liệu dán từ Excel: mỗi dòng là một học sinh theo thứ tự đang hiển thị, mỗi cột là một tiêu chí theo thứ tự đang hiển thị.
 * Ô lạ giá trị bị bỏ qua và được đếm vào `invalid`.
 */
export function parsePaste(text: string, students: GridStudent[], criteria: ShortCriteria[]): PasteResult {
  let lines = text.replace(/\r/g, '').split('\n').filter((line, index, all) => line.trim() !== '' || index < all.length - 1);
  // Dán cả bảng từ tệp mẫu: bỏ dòng tiêu đề và hai cột mã, tên
  if ((lines[0]?.split('\t')[0] ?? '').trim() === GRADE_SHEET_HEADERS[0]) {
    lines = lines.slice(1).map((line) => line.split('\t').slice(GRADE_SHEET_HEADERS.length).join('\t'));
  }
  const changes: PasteResult['changes'] = [];
  let invalid = 0;
  lines.slice(0, students.length).forEach((line, rowIndex) => {
    line
      .split('\t')
      .slice(0, criteria.length)
      .forEach((raw, columnIndex) => {
        const parsed = parseCellText(raw);
        if (parsed === '') return; // ô để trống thì giữ nguyên điểm đang có
        if (parsed === null) {
          invalid += 1;
          return;
        }
        changes.push({ gridStudentId: students[rowIndex].grid_student_id, criteriaId: criteria[columnIndex].id, value: parsed });
      });
  });
  return { changes, invalid };
}
