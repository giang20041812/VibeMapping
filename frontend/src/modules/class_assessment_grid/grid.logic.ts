import type { CellValue, GridData, GridStudent, ShortCriteria } from './class_assessment_grid.types';

export const cellKey = (gridStudentId: string, criteriaId: string) => `${gridStudentId}:${criteriaId}`;

export const CELL_OPTIONS: { value: CellValue; label: string }[] = [
  { value: '', label: '—' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: 'na', label: 'Không đủ cơ sở' },
];

export function toCellMap(grid: GridData): Map<string, CellValue> {
  const map = new Map<string, CellValue>();
  for (const student of grid.students) {
    for (const cell of student.cells) {
      if (cell.is_insufficient_basis) map.set(cellKey(student.grid_student_id, cell.criteria_id), 'na');
      else if (cell.score !== null) map.set(cellKey(student.grid_student_id, cell.criteria_id), String(cell.score) as CellValue);
    }
  }
  return map;
}

export function cellToDb(value: CellValue): number | 'na' | null {
  if (value === '') return null;
  return value === 'na' ? 'na' : Number(value);
}

/** Số ô còn trống trong bảng lưới */
export function countEmptyCells(students: GridStudent[], criteria: ShortCriteria[], cells: Map<string, CellValue>): number {
  let empty = 0;
  for (const student of students) {
    for (const item of criteria) {
      if (!cells.get(cellKey(student.grid_student_id, item.id))) empty += 1;
    }
  }
  return empty;
}

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
  const lines = text.replace(/\r/g, '').split('\n').filter((line, index, all) => line.trim() !== '' || index < all.length - 1);
  const changes: PasteResult['changes'] = [];
  let invalid = 0;
  lines.slice(0, students.length).forEach((line, rowIndex) => {
    line
      .split('\t')
      .slice(0, criteria.length)
      .forEach((raw, columnIndex) => {
        const parsed = parseCellText(raw);
        if (parsed === null) {
          invalid += 1;
          return;
        }
        changes.push({ gridStudentId: students[rowIndex].grid_student_id, criteriaId: criteria[columnIndex].id, value: parsed });
      });
  });
  return { changes, invalid };
}
