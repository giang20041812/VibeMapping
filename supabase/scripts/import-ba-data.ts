/**
 * Nhập dữ liệu từ các file Excel của team BA vào Supabase (phase 1).
 *
 *   ASSESSMENT FRAMEWORK.xlsx  -> criteria_groups, criteria, criteria_rater_visibility
 *   NGÂN HÀNG CÂU HỎI.xlsx     -> questions
 *
 * Chạy:   npm run import:ba        (cần SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY trong .env gốc)
 *         npm run import:ba:dry    (chỉ đọc và báo cáo, không ghi DB)
 *
 * Script idempotent: upsert theo group_code / dimension_code / question_code.
 * Service role key chỉ dùng ở script này, không bao giờ đưa vào frontend.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, 'frontend', '.env') }); // fallback: không ghi đè biến đã có

const FRAMEWORK_FILE = path.join(repoRoot, 'TEAM BA', 'ASSESSMENT FRAMEWORK.xlsx');
const QUESTION_BANK_FILE = path.join(repoRoot, 'TEAM BA', 'NGÂN HÀNG CÂU HỎI.xlsx');
const BATCH_SIZE = 500;

type RaterGroup = 'self' | 'parent' | 'friend' | 'teacher' | 'mentor';

/** Tên cột/đối tượng trong Excel -> giá trị enum rater_group */
const RATER_BY_LABEL: Record<string, RaterGroup> = {
  'bản thân': 'self',
  self: 'self',
  'phụ huynh': 'parent',
  'bạn bè': 'friend',
  'giáo viên': 'teacher',
  'người hướng dẫn': 'mentor',
};

/** Mã Holland theo tiêu chí nhóm G6 */
const HOLLAND_BY_DIMENSION: Record<string, string> = {
  'D6.1': 'R', 'D6.2': 'I', 'D6.3': 'A', 'D6.4': 'S', 'D6.5': 'E', 'D6.6': 'C',
};

/** Phần của bài tự đánh giá: 1 Tính cách (G1 + G4), 2 Giá trị/động lực (G7), 3 Sở thích (G6), 4 Năng lực chuyên môn (G2, G3, G5) */
const PART_BY_GROUP: Record<string, number> = { G1: 1, G4: 1, G7: 2, G6: 3, G2: 4, G3: 4, G5: 4 };

interface CriteriaRow {
  dimension_code: string;
  group_code: string;
  name: string;
  sort_order: number;
}
interface GroupRow { group_code: string; name: string; sort_order: number }
interface VisibilityRow { dimension_code: string; rater_group: RaterGroup; is_visible: boolean; scale_method: string | null }
interface QuestionRow {
  question_code: string;
  dimension_code: string;
  rater_group: RaterGroup;
  question_type: string | null;
  content: string;
  answer_options: string[] | null;
  scale_scoring: string | null;
  behavior_indicator_mapping: string | null;
  assessment_part: number | null;
}

const warnings: string[] = [];
const warn = (message: string) => warnings.push(message);

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((part) => part.text).join('').trim();
    if ('result' in value && value.result !== undefined) return String(value.result).trim();
    if ('text' in value) return String(value.text).trim();
    return '';
  }
  return String(value).trim();
}

async function openSheet(file: string, sheetName?: string): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];
  if (!sheet) throw new Error(`Không tìm thấy sheet "${sheetName ?? '[đầu tiên]'}" trong ${file}`);
  return sheet;
}

/** Đọc khung tiêu chí: nhóm, tiêu chí (sheet MA TRẬN) */
async function readFramework(): Promise<{ groups: GroupRow[]; criteria: CriteriaRow[] }> {
  const sheet = await openSheet(FRAMEWORK_FILE, 'MA TRẬN');
  const groups: GroupRow[] = [];
  const criteria: CriteriaRow[] = [];
  let currentGroup = '';
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const groupCode = cellText(row.getCell(1));
    const groupName = cellText(row.getCell(2));
    const dimensionCode = cellText(row.getCell(3));
    const name = cellText(row.getCell(4));
    if (groupCode) {
      currentGroup = groupCode;
      // Ô gộp (merged) lặp lại giá trị nhóm ở mọi dòng con nên cần khử trùng
      if (!groups.some((g) => g.group_code === groupCode)) {
        groups.push({ group_code: groupCode, name: groupName, sort_order: groups.length + 1 });
      }
    }
    if (!dimensionCode) return;
    if (!/^D\d\.\d$/.test(dimensionCode)) {
      warn(`MA TRẬN dòng ${rowNumber}: mã tiêu chí không hợp lệ "${dimensionCode}", bỏ qua`);
      return;
    }
    criteria.push({ dimension_code: dimensionCode, group_code: currentGroup, name, sort_order: criteria.length + 1 });
  });
  return { groups, criteria };
}

/** Đọc ma trận hiển thị + phương pháp thang đo theo nhóm người đánh giá (sheet THANG ĐO) */
async function readVisibility(): Promise<VisibilityRow[]> {
  const sheet = await openSheet(FRAMEWORK_FILE, 'THANG ĐO');
  const header = sheet.getRow(1);
  const columns: { index: number; group: RaterGroup }[] = [];
  for (let c = 5; c <= 9; c += 1) {
    const label = cellText(header.getCell(c)).toLowerCase();
    const group = RATER_BY_LABEL[label];
    if (!group) throw new Error(`THANG ĐO: không nhận ra tiêu đề cột ${c}: "${label}"`);
    columns.push({ index: c, group });
  }
  const rows: VisibilityRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const dimensionCode = cellText(row.getCell(3));
    if (!/^D\d\.\d$/.test(dimensionCode)) return;
    for (const { index, group } of columns) {
      const method = cellText(row.getCell(index));
      if (!method) {
        warn(`THANG ĐO ${dimensionCode}/${group}: ô trống, coi như không hiển thị`);
      }
      rows.push({
        dimension_code: dimensionCode,
        rater_group: group,
        is_visible: method !== '' && !method.toUpperCase().startsWith('N/A'),
        scale_method: method || null,
      });
    }
  });
  return rows;
}

/** Đọc ngân hàng câu hỏi */
async function readQuestions(criteriaCodes: Set<string>): Promise<QuestionRow[]> {
  const sheet = await openSheet(QUESTION_BANK_FILE);
  const questions: QuestionRow[] = [];
  const seen = new Set<string>();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const questionCode = cellText(row.getCell(1));
    if (!questionCode) return;
    const rawGroup = cellText(row.getCell(2));
    const dimensionCode = cellText(row.getCell(4));
    const target = cellText(row.getCell(6)).toLowerCase();
    const content = cellText(row.getCell(8));

    if (!criteriaCodes.has(dimensionCode)) {
      warn(`Câu hỏi ${questionCode} (dòng ${rowNumber}): tiêu chí "${dimensionCode}" không có trong khung, bỏ qua`);
      return;
    }
    const raterGroup = RATER_BY_LABEL[target];
    if (!raterGroup) {
      warn(`Câu hỏi ${questionCode} (dòng ${rowNumber}): đối tượng "${target}" không hợp lệ, bỏ qua`);
      return;
    }
    if (!content) {
      warn(`Câu hỏi ${questionCode} (dòng ${rowNumber}): nội dung trống, bỏ qua`);
      return;
    }
    if (seen.has(questionCode)) {
      warn(`Câu hỏi ${questionCode} (dòng ${rowNumber}): trùng mã, bỏ qua`);
      return;
    }
    seen.add(questionCode);

    const groupFromDimension = `G${dimensionCode.charAt(1)}`;
    if (rawGroup !== groupFromDimension) {
      warn(`Câu hỏi ${questionCode} (dòng ${rowNumber}): cột Group "${rawGroup}" lệch với tiêu chí ${dimensionCode}, dùng ${groupFromDimension}`);
    }

    const options = [9, 10, 11, 12, 13].map((c) => cellText(row.getCell(c))).filter(Boolean);
    const isNotApplicable = options.length === 1 && options[0].toUpperCase().startsWith('N/A');

    questions.push({
      question_code: questionCode,
      dimension_code: dimensionCode,
      rater_group: raterGroup,
      question_type: cellText(row.getCell(7)) || null,
      content,
      answer_options: isNotApplicable || options.length === 0 ? null : options,
      scale_scoring: cellText(row.getCell(14)) || null,
      behavior_indicator_mapping: cellText(row.getCell(15)) || null,
      assessment_part: PART_BY_GROUP[groupFromDimension] ?? null,
    });
  });
  return questions;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const { groups, criteria } = await readFramework();
  const visibility = await readVisibility();
  const criteriaCodes = new Set(criteria.map((c) => c.dimension_code));
  const questions = await readQuestions(criteriaCodes);

  const visibleKey = new Map(visibility.map((v) => [`${v.dimension_code}|${v.rater_group}`, v.is_visible]));
  const activeFor = (q: QuestionRow) => visibleKey.get(`${q.dimension_code}|${q.rater_group}`) ?? false;

  console.log(`Nhóm tiêu chí:        ${groups.length}`);
  console.log(`Tiêu chí:             ${criteria.length}`);
  console.log(`Cấu hình hiển thị:    ${visibility.length} (ẩn: ${visibility.filter((v) => !v.is_visible).length})`);
  console.log(`Câu hỏi hợp lệ:       ${questions.length} (đang bật: ${questions.filter(activeFor).length})`);

  if (dryRun) {
    reportWarnings();
    console.log('\nDry-run: không ghi vào cơ sở dữ liệu.');
    return;
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || serviceKey.includes('your_service_role_key')) {
    throw new Error('Thiếu SUPABASE_URL (hoặc VITE_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY trong .env');
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1. Nhóm tiêu chí
  const { data: groupData, error: groupError } = await supabase
    .from('criteria_groups')
    .upsert(groups, { onConflict: 'group_code' })
    .select('id, group_code');
  if (groupError) throw groupError;
  const groupIdByCode = new Map(groupData.map((g) => [g.group_code, g.id]));

  // 2. Tiêu chí
  const criteriaPayload = criteria.map((c) => ({
    dimension_code: c.dimension_code,
    group_id: groupIdByCode.get(c.group_code),
    name: c.name,
    holland_code: HOLLAND_BY_DIMENSION[c.dimension_code] ?? null,
    sort_order: c.sort_order,
  }));
  const { data: criteriaData, error: criteriaError } = await supabase
    .from('criteria')
    .upsert(criteriaPayload, { onConflict: 'dimension_code' })
    .select('id, dimension_code');
  if (criteriaError) throw criteriaError;
  const criteriaIdByCode = new Map(criteriaData.map((c) => [c.dimension_code, c.id]));

  // 3. Cấu hình hiển thị tiêu chí theo nhóm người đánh giá
  const visibilityPayload = visibility.map((v) => ({
    criteria_id: criteriaIdByCode.get(v.dimension_code),
    rater_group: v.rater_group,
    is_visible: v.is_visible,
    scale_method: v.scale_method,
  }));
  const { error: visibilityError } = await supabase
    .from('criteria_rater_visibility')
    .upsert(visibilityPayload, { onConflict: 'criteria_id,rater_group' });
  if (visibilityError) throw visibilityError;

  // 4. Câu hỏi (câu của tiêu chí bị ẩn với nhóm đó được lưu nhưng tắt)
  const questionPayload = questions.map((q) => ({
    question_code: q.question_code,
    criteria_id: criteriaIdByCode.get(q.dimension_code),
    rater_group: q.rater_group,
    question_type: q.question_type,
    content: q.content,
    answer_options: q.answer_options,
    scale_scoring: q.scale_scoring,
    behavior_indicator_mapping: q.behavior_indicator_mapping,
    assessment_part: q.assessment_part,
    is_active: activeFor(q),
  }));
  let written = 0;
  for (const batch of chunk(questionPayload, BATCH_SIZE)) {
    const { error } = await supabase.from('questions').upsert(batch, { onConflict: 'question_code' });
    if (error) throw error;
    written += batch.length;
    console.log(`  questions: ${written}/${questionPayload.length}`);
  }

  reportWarnings();
  console.log('\nHoàn tất nhập dữ liệu.');
}

function reportWarnings() {
  if (warnings.length === 0) return;
  console.log(`\nCảnh báo dữ liệu (${warnings.length}):`);
  for (const message of warnings.slice(0, 50)) console.log(`  - ${message}`);
  if (warnings.length > 50) console.log(`  ... và ${warnings.length - 50} cảnh báo khác`);
}

main().catch((error) => {
  console.error('Nhập dữ liệu thất bại:', error instanceof Error ? error.message : error);
  process.exit(1);
});
