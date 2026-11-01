import { addProgramCompare, type ProgramCompareItem } from '../../lib/selectionCart';
import type { AdmissionRow, ProgramSummary } from './education.service';

/** Học phí/năm ước từ học kỳ × 2; thiếu số thì để trống để so sánh không gán 0. */
export function programToCompareItem(
  program: ProgramSummary,
  extra?: { careerId?: string; admission?: AdmissionRow[]; studyYears?: number | null },
): ProgramCompareItem {
  const yearTuition = program.tuitionMin !== null
    ? String(Number(((program.tuitionMin * 2) / 1_000_000).toFixed(1)))
    : '';
  const cutoff = extra?.admission?.find((row) => row.cutoffScore !== null)?.cutoffScore;
  return {
    programId: program.id,
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
