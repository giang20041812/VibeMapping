import { addProgramCompare, type ProgramCompareItem } from '../../lib/selectionCart';
import type { AdmissionRow, ProgramSummary } from './education.service';

/** Lấy học phí năm tối đa (triệu đồng) từ cột đã tách; thiếu số thì để trống để so sánh không gán 0. */
export function programToCompareItem(
  program: ProgramSummary,
  extra?: { careerId?: string; admission?: AdmissionRow[]; studyYears?: number | null },
): ProgramCompareItem {
  const rawYear = program.tuitionYearMax ?? program.tuitionYearMin ?? (program.tuitionMin !== null ? program.tuitionMin * 2 : null);
  const yearTuition = rawYear !== null ? String(Number((rawYear / 1_000_000).toFixed(2))) : '';
  const cutoff = extra?.admission?.find((row) => row.cutoffScore !== null)?.cutoffScore;
  return {
    programId: program.id,
    institutionId: program.institutionId,
    title: `${program.institutionName} – ${program.majorName}${program.specialization ? ` (${program.specialization})` : ''}`,
    careerId: extra?.careerId ?? '',
    admissionFloor: cutoff === undefined || cutoff === null ? '' : String(cutoff),
    tuitionPerYear: yearTuition,
  };
}

export function addProgramToDecisionCompare(
  program: ProgramSummary,
  extra?: { careerId?: string; admission?: AdmissionRow[]; studyYears?: number | null },
): { items: ProgramCompareItem[]; message?: string } {
  return addProgramCompare(programToCompareItem(program, extra));
}
