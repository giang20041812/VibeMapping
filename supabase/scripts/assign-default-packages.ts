/**
 * Gán câu hỏi tự đánh giá vào ba gói 35/50/75 theo quy tắc chọn câu mặc định của ứng dụng
 * (cùng hàm selectQuestions mà màn hình làm bài dùng khi quản trị chưa gán).
 *
 *   npm run assign:packages            chỉ đọc, in kết quả sẽ ghi
 *   npm run assign:packages -- --apply ghi vào question_package_assignments
 *
 * Chỉ ghi khi bảng đang trống (tránh đè lên phần quản trị đã gán tay); thêm --replace để xóa rồi gán lại.
 * Đây là bản gán tạm theo quy tắc đếm của đặc tả, chưa phải danh sách đã được BA duyệt.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { selectQuestions } from '../../frontend/src/modules/assessment_session/selectQuestions';
import type { BankQuestion, PackageSize, PartNumber } from '../../frontend/src/modules/assessment_session/assessmentSession.types';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '..', '..', '.env') });

const apply = process.argv.includes('--apply');
const replace = process.argv.includes('--replace');
const SIZES: PackageSize[] = [35, 50, 75];

const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

const { data, error } = await supabase
  .from('questions')
  .select('id, question_code, content, answer_options, assessment_part, criteria!inner(id, dimension_code, name, sort_order, holland_code, criteria_groups!inner(group_code, name, sort_order))')
  .eq('rater_group', 'self')
  .eq('is_active', true)
  .not('assessment_part', 'is', null)
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
console.log('Ngân hàng tự đánh giá đang bật:', bank.length, 'câu');

const rows: { question_id: string; package_size: number }[] = [];
for (const size of SIZES) {
  const picked = selectQuestions(bank, size);
  console.log(`Gói ${size}: ${picked.length} câu`);
  for (const question of picked) rows.push({ question_id: question.id, package_size: size });
}

const { count, error: countError } = await supabase
  .from('question_package_assignments')
  .select('id', { count: 'exact', head: true });
if (countError) throw countError;
console.log('Dòng đã gán hiện có:', count ?? 0);

if (!apply) {
  console.log('Chế độ đọc thử: chưa ghi gì. Thêm --apply để ghi.');
  process.exit(0);
}
if ((count ?? 0) > 0 && !replace) {
  console.error('Bảng đã có dữ liệu gán. Dùng --replace nếu muốn xóa và gán lại.');
  process.exit(1);
}
if (replace) {
  const { error: deleteError } = await supabase
    .from('question_package_assignments')
    .delete()
    .in('package_size', SIZES);
  if (deleteError) throw deleteError;
}
const { error: insertError } = await supabase.from('question_package_assignments').insert(rows);
if (insertError) throw insertError;
console.log('Đã ghi', rows.length, 'dòng.');
