/**
 * Kiểm tra nhanh thuật toán chọn câu theo gói với dữ liệu thật (chỉ đọc).
 *   npx tsx check-selection.ts
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { selectQuestions } from '../../frontend/src/modules/assessment_session/selectQuestions';
import type { BankQuestion, PackageSize, PartNumber } from '../../frontend/src/modules/assessment_session/assessmentSession.types';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '..', '..', '.env') });

const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

const { data, error } = await supabase
  .from('questions')
  .select('id, question_code, content, answer_options, assessment_part, criteria!inner(id, dimension_code, name, sort_order, holland_code, criteria_groups!inner(group_code, name, sort_order))')
  .eq('rater_group', 'self')
  .eq('is_active', true)
  .limit(1000);
if (error) throw error;

const bank: BankQuestion[] = (data ?? []).map((row: any) => ({
  id: row.id,
  questionCode: row.question_code,
  content: row.content,
  answerOptions: row.answer_options ?? [],
  criteriaId: row.criteria.id,
  dimensionCode: row.criteria.dimension_code,
  criteriaName: row.criteria.name,
  criteriaSort: row.criteria.sort_order,
  groupCode: row.criteria.criteria_groups.group_code,
  groupName: row.criteria.criteria_groups.name,
  groupSort: row.criteria.criteria_groups.sort_order,
  hollandCode: row.criteria.holland_code,
  part: row.assessment_part as PartNumber,
  round: 0,
}));

console.log('Ngân hàng tự đánh giá:', bank.length, 'câu');
for (const size of [35, 50, 75] as PackageSize[]) {
  const picked = selectQuestions(bank, size);
  const byPart = [1, 2, 3, 4].map((p) => picked.filter((q) => q.part === p).length);
  const byGroup = Object.entries(
    picked.reduce<Record<string, number>>((acc, q) => ({ ...acc, [q.groupCode]: (acc[q.groupCode] ?? 0) + 1 }), {}),
  ).sort();
  const unique = new Set(picked.map((q) => q.id)).size === picked.length;
  console.log(`Gói ${size}: tổng ${picked.length} | theo phần ${byPart.join('/')} | duy nhất: ${unique}`);
  console.log('   theo nhóm:', byGroup.map(([g, n]) => `${g}=${n}`).join(' '));
}
const again = JSON.stringify(selectQuestions(bank, 50).map((q) => q.id)) === JSON.stringify(selectQuestions([...bank].reverse(), 50).map((q) => q.id));
console.log('Ổn định khi đảo thứ tự đầu vào:', again);
