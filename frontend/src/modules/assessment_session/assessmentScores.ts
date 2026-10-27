import type { AnswerMap, BankQuestion } from './assessmentSession.types';

export interface CriteriaPercent {
  criteriaId: string;
  dimensionCode: string;
  name: string;
  groupCode: string;
  hollandCode: string | null;
  sort: number;
  /** Phần trăm điểm trung bình (điểm ÷ 5 × 100); null khi mọi câu đều "không đủ cơ sở" */
  percent: number | null;
}

export const isAnswered = (answers: AnswerMap, questionId: string): boolean => {
  const value = answers.get(questionId);
  return Boolean(value && (value.insufficient || value.score !== null));
};

/**
 * Điểm từng tiêu chí: trung bình các câu có điểm; câu "không đủ cơ sở" bị loại khỏi phép tính
 * (không tính là 0 điểm). Chỉ quy đổi sang phần trăm khi hiển thị.
 */
export function criteriaPercents(questions: BankQuestion[], answers: AnswerMap): CriteriaPercent[] {
  const byCriteria = new Map<string, BankQuestion[]>();
  for (const question of questions) {
    const list = byCriteria.get(question.criteriaId) ?? [];
    list.push(question);
    byCriteria.set(question.criteriaId, list);
  }

  const result: CriteriaPercent[] = [];
  for (const [criteriaId, list] of byCriteria) {
    const scores = list
      .map((q) => answers.get(q.id))
      .filter((v): v is { score: number; insufficient: false } => Boolean(v && !v.insufficient && v.score !== null));
    const average = scores.length ? scores.reduce((sum, v) => sum + v.score, 0) / scores.length : null;
    const first = list[0];
    result.push({
      criteriaId,
      dimensionCode: first.dimensionCode,
      name: first.criteriaName,
      groupCode: first.groupCode,
      hollandCode: first.hollandCode,
      sort: first.criteriaSort,
      percent: average === null ? null : (average / 5) * 100,
    });
  }
  return result.sort((a, b) => a.sort - b.sort);
}

/** Tỷ lệ tiêu chí mà mọi câu đều là "không đủ cơ sở" */
export function insufficientRatio(questions: BankQuestion[], answers: AnswerMap): number {
  const rows = criteriaPercents(questions, answers);
  const answeredCriteria = new Set(questions.filter((q) => isAnswered(answers, q.id)).map((q) => q.criteriaId));
  const considered = rows.filter((row) => answeredCriteria.has(row.criteriaId));
  if (considered.length === 0) return 0;
  return considered.filter((row) => row.percent === null).length / considered.length;
}

/** Ba chữ Holland nổi trội nhất, sắp theo điểm giảm dần */
export function topHolland(percents: CriteriaPercent[]): CriteriaPercent[] {
  return percents
    .filter((row) => row.hollandCode && row.percent !== null)
    .sort((a, b) => (b.percent as number) - (a.percent as number) || a.sort - b.sort)
    .slice(0, 3);
}
