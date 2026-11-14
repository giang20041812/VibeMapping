import { supabase } from '../../lib/supabase';
import { PACKAGE_SIZES, type PackageSize } from './admin.constants';
import type { Paged, QuestionFilter, QuestionRow } from './admin.types';
import { listQuestions } from './questions.service';

export interface AssignableQuestion extends QuestionRow {
  packages: PackageSize[];
}

/** Chỉ câu hỏi góc nhìn bản thân (self) được gán vào gói tự đánh giá */
export async function listAssignableQuestions(filter: QuestionFilter, page: number): Promise<Paged<AssignableQuestion>> {
  const result = await listQuestions(filter, page, 'self');
  if (result.rows.length === 0) return { rows: [], total: result.total };

  const { data, error } = await supabase
    .from('question_package_assignments')
    .select('question_id, package_size')
    .in('question_id', result.rows.map((row) => row.id));
  if (error) {
    console.error('Lỗi đọc câu hỏi theo gói:', error.message);
    throw error;
  }

  const byQuestion = new Map<string, PackageSize[]>();
  for (const item of data ?? []) {
    const list = byQuestion.get(item.question_id) ?? [];
    list.push(item.package_size as PackageSize);
    byQuestion.set(item.question_id, list);
  }
  return {
    rows: result.rows.map((row) => ({ ...row, packages: byQuestion.get(row.id) ?? [] })),
    total: result.total,
  };
}

export async function countPackageAssignments(): Promise<Record<PackageSize, number>> {
  const counts = await Promise.all(
    PACKAGE_SIZES.map(async (size) => {
      const { count, error } = await supabase
        .from('question_package_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('package_size', size);
      if (error) {
        console.error('Lỗi đếm câu hỏi trong gói:', error.message);
        throw error;
      }
      return [size, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(counts) as Record<PackageSize, number>;
}

/** Thêm hoặc gỡ một lô câu hỏi khỏi một gói; trả về số dòng đã đổi */
export async function setPackageAssignments(questionIds: string[], size: PackageSize, assigned: boolean): Promise<number> {
  const { data, error } = await supabase.rpc('set_package_assignments', {
    p_question_ids: questionIds,
    p_package_size: size,
    p_assigned: assigned,
  });
  if (error) {
    console.error('Lỗi gán câu hỏi vào gói:', error.message);
    throw error;
  }
  return data ?? 0;
}
