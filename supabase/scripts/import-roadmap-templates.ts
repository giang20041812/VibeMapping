/**
 * Nạp lộ trình mẫu từ file BA "[VIBE MAPPING] ROADMAP.xlsx".
 *
 *   Output - Roadmap           -> roadmap_template_items (khóa item_code, ví dụ RM1-TD-B1-01)
 *   Output - Band & trọng số   -> roadmap_group_bands (mô tả 4 band của 7 nhóm) + roadmap_template_weights (BA, DEV)
 *   LD - Kế hoạch mẫu          -> phần bổ sung của mục LD (cột trong roadmap_template_items), roadmap_sample_plans,
 *                                 roadmap_template_rules, roadmap_quiz_questions
 *
 * Chạy:   npm run import:roadmap-templates:dry     (chỉ đọc, in báo cáo)
 *         npm run import:roadmap-templates         (ghi vào cơ sở dữ liệu)
 * Tùy chọn: --excel <file>   --json-out <file> (ghi dữ liệu đọc được ra JSON để BA soát)
 *           --force  ghi đè cả mục/kế hoạch mẫu quản trị đã sửa trong ứng dụng
 *
 * Quy tắc:
 *   - Mã nhóm trong file đổi sang mã nhóm tiêu chí: TC=G1, TD=G2, GT=G3, TH=G4, LD=G5, ST=G6, DL=G7.
 *   - Cột "Bằng chứng hoàn thành" tách phần "Nộp:" (bằng chứng) và "Đạt khi:" (tiêu chí đạt).
 *   - Thời lượng "N tuần" lấy N; nhóm LD ghi "Cấp 1: a tuần … Cấp 2: b tuần … Cấp 3: c tuần" thì lưu cả ba,
 *     thời lượng mặc định là cấp 2. Ô trống thì lấy số tuần đầu tiên nhắc trong bằng chứng hoặc mô tả.
 *   - "Mục tiên quyết": mã đứng sau "có thể chạy chung" là mục chạy song song, không phải tiên quyết;
 *     có chữ "không bắt buộc" thì tiên quyết chỉ là gợi ý.
 *   - Mục có trong cơ sở dữ liệu nhưng không còn trong file thì ẩn (is_active = false), không xóa.
 *   - Trọng số: lộ trình sinh viên ngành BA (RM4) dùng cột BA, ngành DEV (RM5) dùng cột DEV;
 *     các lộ trình khác không có trọng số riêng nên chia đều khi xếp ưu tiên.
 *   - Sheet LD: ô bắt đầu "Như RM1-LD-B1-01" lấy nội dung cùng cột của mục đó rồi nối phần còn lại ("Thêm: …");
 *     phần trong ngoặc ngay sau (nhắc lại số giờ) bỏ đi. Lịch kế hoạch "Như mẫu A" lấy lịch cùng cấp của mẫu A.
 *     Kiểm tra nhanh lưu theo đuôi mã (LD-B2-02) vì mọi lộ trình dùng chung bộ câu hỏi.
 *   - Mục và kế hoạch mẫu quản trị đã sửa trong ứng dụng (updated_by có giá trị) không bị ghi đè, trừ khi --force.
 */
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, 'frontend', '.env') });

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const firstExisting = (...files: string[]) => files.find((file) => existsSync(file)) ?? files[0];

const EXCEL_FILE =
  option('--excel') ??
  firstExisting(path.join(repoRoot, '[VIBE MAPPING] ROADMAP.xlsx'), path.join(repoRoot, 'TEAM BA', '[VIBE MAPPING] ROADMAP.xlsx'));
const DRY_RUN = args.includes('--dry-run');
const JSON_OUT = option('--json-out');
const FORCE = args.includes('--force');

const ITEM_SHEET = 'Output - Roadmap';
const BAND_SHEET = 'Output - Band & trọng số';
const LD_SHEET = 'LD - Kế hoạch mẫu';
const GROUP_BY_SHORT: Record<string, string> = { TC: 'G1', TD: 'G2', GT: 'G3', TH: 'G4', LD: 'G5', ST: 'G6', DL: 'G7' };
const TEMPLATE_BY_WEIGHT_COLUMN = { BA: 'RM4', DEV: 'RM5' } as const;
const BANDS = ['B1', 'B2', 'B3', 'B4'] as const;
const ITEM_CODE = /RM\d-[A-Z]{2}-B\d-\d{2}/g;

const warnings: string[] = [];
const warn = (message: string) => warnings.push(message);

export interface TemplateItemRow {
  item_code: string;
  template_code: string;
  group_code: string;
  band_code: string;
  stage_name: string;
  title: string;
  how_to: string | null;
  skills_gained: string | null;
  completion_evidence: string | null;
  pass_criteria: string | null;
  duration_weeks: number;
  level_duration_weeks: Record<string, number> | null;
  duration_text: string | null;
  prerequisite_codes: string[];
  prerequisite_required: boolean;
  parallel_codes: string[];
  reference_source: string | null;
  confidence_label: string | null;
  check_status: string | null;
  check_note: string | null;
  sort_order: number;
  is_active: boolean;
  level_guide?: string | null;
  prior_knowledge?: string | null;
  experience_task?: string | null;
  extra_hours_text?: string | null;
  fallback_options?: string | null;
  group_boundary?: string | null;
  supplement_note?: string | null;
}

interface PlanRow {
  plan_code: string;
  item_code: string;
  title: string;
  fit_when: string | null;
  schedule_level_1: string | null;
  schedule_level_2: string | null;
  schedule_level_3: string | null;
  suggested_output: string | null;
  note: string | null;
  sort_order: number;
  is_active: boolean;
}

interface RuleRow {
  template_code: string;
  group_code: string;
  rule_code: string;
  title: string;
  content: string;
  sort_order: number;
}

interface QuizRow {
  item_suffix: string;
  question_no: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  correct_option: string;
  is_active: boolean;
}

type Supplement = Pick<TemplateItemRow, 'level_guide' | 'prior_knowledge' | 'experience_task' | 'extra_hours_text' | 'fallback_options' | 'group_boundary' | 'supplement_note'>;

interface BandRow {
  group_code: string;
  band_code: string;
  band_summary: string;
  roadmap_summary: string | null;
}

interface WeightRow {
  template_code: string;
  group_code: string;
  weight: number;
  note: string | null;
}

// ---------------------------------------------------------------- đọc ô
function valueText(value: unknown): string {
  if (value === null || value === undefined || value instanceof Date) return '';
  if (typeof value !== 'object') return String(value).trim();
  const v = value as Record<string, unknown>;
  if (Array.isArray(v.richText)) return (v.richText as { text: string }[]).map((part) => part.text).join('').trim();
  if (v.result !== undefined) return valueText(v.result);
  if (typeof v.text === 'string') return v.text.trim();
  return '';
}

const cleanText = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const orNull = (text: string) => (text ? text : null);

// ---------------------------------------------------------------- tách nội dung
/** "Nộp: …\nĐạt khi: …" -> bằng chứng và tiêu chí đạt */
export function splitEvidence(text: string): { evidence: string | null; pass: string | null } {
  const cleaned = cleanText(text);
  const match = cleaned.match(/^([\s\S]*?)\n?\s*Đạt khi\s*:\s*([\s\S]*)$/i);
  if (!match) return { evidence: orNull(cleaned.replace(/^Nộp\s*:\s*/i, '')), pass: null };
  return { evidence: orNull(match[1].replace(/^Nộp\s*:\s*/i, '').trim()), pass: orNull(match[2].trim()) };
}

/** "4 tuần" | "Cấp 1: 1 tuần …\nCấp 2: 3 tuần …" -> số tuần mặc định và số tuần theo cấp */
export function parseDuration(text: string, fallbackSources: string[]): {
  weeks: number | null;
  levels: Record<string, number> | null;
} {
  const levels: Record<string, number> = {};
  for (const match of text.matchAll(/Cấp\s*([1-3])\s*:\s*(\d+)\s*tuần/gi)) levels[match[1]] = Number(match[2]);
  if (Object.keys(levels).length > 0) {
    return { weeks: levels['2'] ?? levels['1'] ?? Object.values(levels)[0], levels };
  }
  const plain = text.match(/(\d+)\s*tuần/i);
  if (plain) return { weeks: Number(plain[1]), levels: null };
  for (const source of fallbackSources) {
    const found = source.match(/(\d+)\s*tuần/i);
    if (found) return { weeks: Number(found[1]), levels: null };
  }
  return { weeks: null, levels: null };
}

/** "RM1-TH-B3-01; RM1-TH-B3-02" | "Gợi ý nên làm trước: X (không bắt buộc); có thể chạy chung Y" */
export function parsePrerequisites(text: string): { codes: string[]; required: boolean; parallel: string[] } {
  const [before, after = ''] = text.split(/có thể chạy chung/i);
  return {
    codes: [...new Set(before.match(ITEM_CODE) ?? [])],
    required: !/không bắt buộc/i.test(text),
    parallel: [...new Set(after.match(ITEM_CODE) ?? [])],
  };
}

/** Mô tả band "Hiện trạng … Roadmap: … Tổng thời lượng: …" -> hiện trạng và tóm tắt lộ trình */
function splitBand(text: string): { summary: string; roadmap: string | null } {
  const cleaned = cleanText(text);
  const index = cleaned.search(/\n?\s*Roadmap\s*:/i);
  if (index < 0) return { summary: cleaned, roadmap: null };
  return {
    summary: cleaned.slice(0, index).trim(),
    roadmap: orNull(cleaned.slice(index).replace(/^\s*Roadmap\s*:\s*/i, '').trim()),
  };
}

// ---------------------------------------------------------------- đọc workbook
function headerIndex(sheet: ExcelJS.Worksheet, headerRow: number): Map<string, number> {
  const map = new Map<string, number>();
  sheet.getRow(headerRow).eachCell((cell, col) => {
    const text = valueText(cell.value);
    if (text) map.set(text, col);
  });
  return map;
}

function readItems(workbook: ExcelJS.Workbook): TemplateItemRow[] {
  const sheet = workbook.getWorksheet(ITEM_SHEET);
  if (!sheet) throw new Error(`Không thấy sheet "${ITEM_SHEET}"`);
  let headerRow = 0;
  for (let r = 1; r <= 10 && !headerRow; r += 1) {
    if (valueText(sheet.getRow(r).getCell(1).value) === 'Mã mục') headerRow = r;
  }
  if (!headerRow) throw new Error(`Sheet "${ITEM_SHEET}" thiếu dòng tiêu đề "Mã mục"`);
  const cols = headerIndex(sheet, headerRow);
  const col = (name: string) => {
    const found = [...cols.entries()].find(([key]) => key.startsWith(name));
    if (!found) throw new Error(`Sheet "${ITEM_SHEET}" thiếu cột "${name}"`);
    return found[1];
  };
  const C = {
    code: col('Mã mục'),
    group: col('Nhóm tiêu chí'),
    band: col('Band'),
    stage: col('Giai đoạn'),
    title: col('Tên mục'),
    howTo: col('Mô tả'),
    skills: col('Kỹ năng đạt được'),
    evidence: col('Bằng chứng hoàn thành'),
    duration: col('Thời lượng'),
    prereq: col('Mục tiên quyết'),
    source: col('Căn cứ'),
    confidence: col('Độ tin cậy'),
    status: col('Đã check'),
    note: col('Ghi chú check'),
  };

  const items: TemplateItemRow[] = [];
  const seen = new Set<string>();
  for (let r = headerRow + 1; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const text = (c: number) => valueText(row.getCell(c).value);
    const code = text(C.code);
    if (!code) continue;
    const parts = code.match(/^(RM\d)-([A-Z]{2})-(B[1-4])-(\d{2})$/);
    if (!parts) {
      warn(`Dòng ${r}: mã mục "${code}" sai dạng, bỏ qua`);
      continue;
    }
    if (seen.has(code)) {
      warn(`Dòng ${r}: mã mục "${code}" bị trùng, bỏ qua dòng sau`);
      continue;
    }
    seen.add(code);
    const [, templateCode, short, band] = parts;
    const groupCode = GROUP_BY_SHORT[short];
    if (!groupCode) {
      warn(`Dòng ${r}: nhóm "${short}" không có trong bộ G1–G7, bỏ qua`);
      continue;
    }
    if (!text(C.group).startsWith(short)) warn(`${code}: cột nhóm "${text(C.group)}" khác mã mục`);
    if (text(C.band) !== band) warn(`${code}: cột band "${text(C.band)}" khác mã mục`);

    const howTo = cleanText(text(C.howTo));
    const evidenceRaw = text(C.evidence);
    const { evidence, pass } = splitEvidence(evidenceRaw);
    const durationRaw = cleanText(text(C.duration));
    const duration = parseDuration(durationRaw, [evidenceRaw, howTo]);
    if (!duration.weeks) warn(`${code}: không đọc được thời lượng, tạm để 4 tuần`);
    else if (!durationRaw) warn(`${code}: ô thời lượng trống, lấy ${duration.weeks} tuần từ bằng chứng/mô tả`);
    const prereq = parsePrerequisites(text(C.prereq));

    items.push({
      item_code: code,
      template_code: templateCode,
      group_code: groupCode,
      band_code: band,
      stage_name: text(C.stage) || 'Khởi động',
      title: cleanText(text(C.title)),
      how_to: orNull(howTo),
      skills_gained: orNull(cleanText(text(C.skills))),
      completion_evidence: evidence,
      pass_criteria: pass,
      duration_weeks: duration.weeks ?? 4,
      level_duration_weeks: duration.levels,
      duration_text: orNull(durationRaw) ?? `${duration.weeks ?? 4} tuần`,
      prerequisite_codes: prereq.codes,
      prerequisite_required: prereq.required,
      parallel_codes: prereq.parallel,
      reference_source: orNull(cleanText(text(C.source))),
      confidence_label: orNull(text(C.confidence)),
      check_status: orNull(text(C.status)),
      check_note: orNull(cleanText(text(C.note))),
      sort_order: r,
      is_active: true,
    });
  }

  const codes = new Set(items.map((item) => item.item_code));
  for (const item of items) {
    for (const ref of [...item.prerequisite_codes, ...item.parallel_codes]) {
      if (!codes.has(ref)) warn(`${item.item_code}: mục tham chiếu "${ref}" không có trong file`);
      else if (ref.slice(0, 3) !== item.item_code.slice(0, 3)) warn(`${item.item_code}: tham chiếu "${ref}" thuộc lộ trình khác`);
    }
  }
  return items;
}

function readBandsAndWeights(workbook: ExcelJS.Workbook): { bands: BandRow[]; weights: WeightRow[] } {
  const sheet = workbook.getWorksheet(BAND_SHEET);
  if (!sheet) throw new Error(`Không thấy sheet "${BAND_SHEET}"`);
  const bands: BandRow[] = [];
  const weights: WeightRow[] = [];
  let weightCols: { BA: number; DEV: number; note: number } | null = null;

  for (let r = 1; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const text = (c: number) => valueText(row.getCell(c).value);
    if (text(2) === 'Mã' && /BA/.test(text(3))) {
      weightCols = { BA: 3, DEV: 4, note: 5 };
      continue;
    }
    const groupCode = GROUP_BY_SHORT[text(2)];
    if (!groupCode) continue;
    if (!weightCols) {
      BANDS.forEach((band, index) => {
        const raw = text(3 + index);
        if (!raw) {
          warn(`Band ${text(2)}-${band}: ô mô tả trống`);
          return;
        }
        const { summary, roadmap } = splitBand(raw);
        bands.push({ group_code: groupCode, band_code: band, band_summary: summary, roadmap_summary: roadmap });
      });
    } else {
      for (const key of ['BA', 'DEV'] as const) {
        const value = Number(String(row.getCell(weightCols[key]).value ?? '').replace(',', '.'));
        if (!Number.isFinite(value)) {
          warn(`Trọng số ${key} nhóm ${text(2)} không phải số`);
          continue;
        }
        weights.push({ template_code: TEMPLATE_BY_WEIGHT_COLUMN[key], group_code: groupCode, weight: value, note: orNull(text(weightCols.note)) });
      }
    }
  }
  for (const template of Object.values(TEMPLATE_BY_WEIGHT_COLUMN)) {
    const total = weights.filter((w) => w.template_code === template).reduce((s, w) => s + w.weight, 0);
    if (Math.abs(total - 100) > 0.5) warn(`Tổng trọng số ${template} = ${total.toFixed(1)}, khác 100`);
  }
  return { bands, weights };
}

// ---------------------------------------------------------------- sheet LD
const SUPPLEMENT_FIELDS = ['level_guide', 'prior_knowledge', 'experience_task', 'extra_hours_text', 'fallback_options', 'group_boundary'] as const;

/** "Như RM1-LD-B1-01. Thêm: …" -> nội dung cùng cột của mục được nhắc + phần thêm */
export function resolveSameAs(text: string, lookup: (code: string) => string | null | undefined): string {
  const match = text.match(/^Như\s+(RM\d-[A-Z]{2}-B\d-\d{2})\b\.?\s*([\s\S]*)$/);
  if (!match) return text;
  const base = lookup(match[1]);
  if (!base) {
    warn(`Không tìm thấy nội dung "${match[1]}" để thay cho "Như ${match[1]}"`);
    return text;
  }
  const rest = match[2].trim();
  return rest && !rest.startsWith('(') ? `${base}\n${rest}` : base;
}

function readLeadership(workbook: ExcelJS.Workbook, itemCodes: Set<string>): {
  supplements: Map<string, Supplement>;
  plans: PlanRow[];
  rules: RuleRow[];
  quiz: QuizRow[];
} {
  const supplements = new Map<string, Supplement>();
  const plans: PlanRow[] = [];
  const rules: RuleRow[] = [];
  const quiz: QuizRow[] = [];
  const sheet = workbook.getWorksheet(LD_SHEET);
  if (!sheet) {
    warn(`Không thấy sheet "${LD_SHEET}", bỏ qua phần bổ sung nhóm LD`);
    return { supplements, plans, rules, quiz };
  }
  let template = 'RM1';
  let section: 'rules' | 'supplement' | 'plans' | 'quiz' | null = null;

  for (let r = 1; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const cells = Array.from({ length: 10 }, (_, i) => cleanText(valueText(row.getCell(i + 1).value)));
    const filled = cells.filter(Boolean);
    if (filled.length === 0) continue;
    const [a, b] = cells;
    // Dòng tiêu đề mục (một ô): đổi lộ trình đang đọc
    if (filled.length === 1) {
      const rm = a.match(/\b(RM\d)\b/);
      if (rm) template = rm[1];
      section = null;
      continue;
    }
    if (a === 'Mã' && b === 'Quy tắc') { section = 'rules'; continue; }
    if (a === 'Mã mục' && b === 'Câu') { section = 'quiz'; continue; }
    if (a === 'Mã mục') { section = 'supplement'; continue; }
    if (a === 'Mã kế hoạch') { section = 'plans'; continue; }

    if (section === 'rules' && a && cells[2]) {
      rules.push({ template_code: template, group_code: 'G5', rule_code: a, title: b, content: cells[2], sort_order: r });
    } else if (section === 'supplement' && /^RM\d-LD-B\d-\d{2}$/.test(a)) {
      if (!itemCodes.has(a)) warn(`Sheet LD dòng ${r}: mục "${a}" không có trong Output - Roadmap`);
      const lookupField = (field: (typeof SUPPLEMENT_FIELDS)[number]) => (code: string) => supplements.get(code)?.[field];
      const values = [cells[2], cells[3], cells[4], cells[5], cells[6], cells[7]];
      const supplement: Supplement = { supplement_note: orNull(cells[9]) };
      SUPPLEMENT_FIELDS.forEach((field, index) => {
        supplement[field] = orNull(resolveSameAs(values[index], lookupField(field)));
      });
      supplements.set(a, supplement);
    } else if (section === 'plans' && /^RM\d-KH-/.test(a)) {
      if (!itemCodes.has(b)) warn(`Kế hoạch ${a}: mục "${b}" không có trong Output - Roadmap`);
      const sibling = plans.find((p) => p.plan_code === a.replace(/-[A-Z]$/, '-A'));
      const sameAsA = (text: string, key: 'schedule_level_1' | 'schedule_level_2' | 'schedule_level_3' | 'fit_when' | 'suggested_output') => {
        const base = sibling?.[key];
        const match = text.match(/^Như mẫu A\b\.?\s*([\s\S]*)$/i);
        if (match && base) return match[1].trim() ? `${base}\n${match[1].trim()}` : base;
        // "2 tuần: như mẫu A" -> "2 tuần: <các bước của mẫu A>"; "2 tuần: như mẫu A với cả đồ án" giữ phần đuôi
        const inline = text.match(/^([^:]+):\s*như mẫu A\b\s*([\s\S]*)$/i);
        const baseSteps = base?.match(/^[^:]+:\s*([\s\S]+)$/)?.[1];
        if (inline && baseSteps) return `${inline[1]}: ${baseSteps}${inline[2].trim() ? ` (${inline[2].trim()})` : ''}`;
        return orNull(text);
      };
      plans.push({
        plan_code: a,
        item_code: b,
        title: cells[2],
        fit_when: orNull(cells[3]),
        schedule_level_1: sameAsA(cells[4], 'schedule_level_1'),
        schedule_level_2: sameAsA(cells[5], 'schedule_level_2'),
        schedule_level_3: sameAsA(cells[6], 'schedule_level_3'),
        suggested_output: orNull(cells[7]),
        note: orNull(cells[9]),
        sort_order: r,
        is_active: true,
      });
    } else if (section === 'quiz' && /^RM\d-[A-Z]{2}-B\d-\d{2}$/.test(a)) {
      const answer = cells[6].toUpperCase();
      if (!['A', 'B', 'C'].includes(answer)) {
        warn(`Kiểm tra nhanh dòng ${r}: đáp án "${cells[6]}" không phải A/B/C, bỏ qua`);
        continue;
      }
      quiz.push({
        item_suffix: a.replace(/^RM\d-/, ''),
        question_no: Math.round(Number(b)),
        question_text: cells[2],
        option_a: cells[3],
        option_b: cells[4],
        option_c: cells[5],
        correct_option: answer,
        is_active: true,
      });
    }
  }

  const ldItems = [...itemCodes].filter((code) => /-LD-/.test(code));
  const noSupplement = ldItems.filter((code) => !supplements.has(code));
  if (noSupplement.length > 0) warn(`Mục LD chưa có phần bổ sung: ${noSupplement.join(', ')}`);
  for (const [suffix, count] of Object.entries(quiz.reduce<Record<string, number>>((acc, q) => ({ ...acc, [q.item_suffix]: (acc[q.item_suffix] ?? 0) + 1 }), {}))) {
    if (count !== 5) warn(`Kiểm tra nhanh ${suffix} có ${count} câu (mong đợi 5)`);
  }
  return { supplements, plans, rules, quiz };
}

// ---------------------------------------------------------------- ghi
const BATCH_SIZE = 100;

async function editedCodes(supabase: SupabaseClient, table: string, key: string): Promise<Set<string>> {
  if (FORCE) return new Set();
  const { data, error } = await supabase.from(table).select(key).not('updated_by', 'is', null);
  if (error) throw new Error(`Đọc ${table} lỗi: ${error.message}`);
  return new Set((data ?? []).map((row) => (row as unknown as Record<string, string>)[key]));
}

async function upsertBatches(supabase: SupabaseClient, table: string, rows: object[], onConflict: string) {
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const { error } = await supabase.from(table).upsert(rows.slice(start, start + BATCH_SIZE), { onConflict });
    if (error) throw new Error(`Ghi ${table} lỗi: ${error.message}`);
  }
}

async function write(
  supabase: SupabaseClient,
  allItems: TemplateItemRow[],
  bands: BandRow[],
  weights: WeightRow[],
  ld: { plans: PlanRow[]; rules: RuleRow[]; quiz: QuizRow[] },
) {
  const editedItems = await editedCodes(supabase, 'roadmap_template_items', 'item_code');
  const items = allItems.filter((item) => !editedItems.has(item.item_code));
  if (editedItems.size > 0) console.log(`  Giữ nguyên ${editedItems.size} mục quản trị đã sửa (thêm --force để ghi đè)`);
  await upsertBatches(supabase, 'roadmap_template_items', items, 'item_code');
  const templates = [...new Set(items.map((item) => item.template_code))];
  const { data: existing, error: readError } = await supabase
    .from('roadmap_template_items')
    .select('item_code')
    .in('template_code', templates)
    .eq('is_active', true);
  if (readError) throw new Error(`Đọc mục lộ trình lỗi: ${readError.message}`);
  const keep = new Set(allItems.map((item) => item.item_code));
  const stale = (existing ?? []).map((row) => row.item_code as string).filter((code) => !keep.has(code));
  if (stale.length > 0) {
    const { error } = await supabase.from('roadmap_template_items').update({ is_active: false }).in('item_code', stale);
    if (error) throw new Error(`Ẩn mục cũ lỗi: ${error.message}`);
  }
  console.log(`  Mục lộ trình: ghi ${items.length}, ẩn ${stale.length} mục không còn trong file`);

  for (const band of bands) {
    const { error } = await supabase
      .from('roadmap_group_bands')
      .update({ band_summary: band.band_summary, roadmap_summary: band.roadmap_summary })
      .eq('group_code', band.group_code)
      .eq('band_code', band.band_code);
    if (error) throw new Error(`Ghi mô tả band lỗi: ${error.message}`);
  }
  console.log(`  Mô tả band: ${bands.length}`);

  const { error: weightError } = await supabase.from('roadmap_template_weights').upsert(weights, { onConflict: 'template_code,group_code' });
  if (weightError) throw new Error(`Ghi trọng số lỗi: ${weightError.message}`);
  console.log(`  Trọng số: ${weights.length}`);

  const editedPlans = await editedCodes(supabase, 'roadmap_sample_plans', 'plan_code');
  await upsertBatches(supabase, 'roadmap_sample_plans', ld.plans.filter((p) => !editedPlans.has(p.plan_code)), 'plan_code');
  const { data: planRows, error: planError } = await supabase.from('roadmap_sample_plans').select('plan_code').eq('is_active', true);
  if (planError) throw new Error(`Đọc kế hoạch mẫu lỗi: ${planError.message}`);
  const planKeep = new Set(ld.plans.map((p) => p.plan_code));
  const stalePlans = (planRows ?? []).map((row) => row.plan_code as string).filter((code) => !planKeep.has(code));
  if (stalePlans.length > 0) {
    const { error } = await supabase.from('roadmap_sample_plans').update({ is_active: false }).in('plan_code', stalePlans);
    if (error) throw new Error(`Ẩn kế hoạch mẫu cũ lỗi: ${error.message}`);
  }
  console.log(`  Kế hoạch mẫu: ghi ${ld.plans.length - editedPlans.size}, ẩn ${stalePlans.length}`);

  await upsertBatches(supabase, 'roadmap_template_rules', ld.rules, 'template_code,rule_code');
  console.log(`  Quy tắc chung: ${ld.rules.length}`);
  await upsertBatches(supabase, 'roadmap_quiz_questions', ld.quiz, 'item_suffix,question_no');
  console.log(`  Câu hỏi kiểm tra nhanh: ${ld.quiz.length}`);
}

// ---------------------------------------------------------------- chạy
async function main() {
  if (!existsSync(EXCEL_FILE)) throw new Error(`Không thấy file ${EXCEL_FILE}`);
  console.log(`Đọc ${path.basename(EXCEL_FILE)}${DRY_RUN ? ' (chạy thử, không ghi)' : ''}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE);

  const items = readItems(workbook);
  const { bands, weights } = readBandsAndWeights(workbook);
  const ld = readLeadership(workbook, new Set(items.map((item) => item.item_code)));
  for (const item of items) Object.assign(item, ld.supplements.get(item.item_code) ?? {});

  const count = (key: (item: TemplateItemRow) => string) =>
    Object.entries(items.reduce<Record<string, number>>((acc, item) => ({ ...acc, [key(item)]: (acc[key(item)] ?? 0) + 1 }), {}))
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  console.log(`Mục: ${items.length} (${count((item) => item.template_code)})`);
  console.log(`Theo nhóm: ${count((item) => item.group_code)}`);
  console.log(`Trạng thái check: ${count((item) => item.check_status ?? 'trống')}`);
  console.log(`Mô tả band: ${bands.length}/28 · Trọng số: ${weights.length}/14`);
  console.log(`Nhóm LD: bổ sung ${ld.supplements.size} mục · ${ld.plans.length} kế hoạch mẫu · ${ld.rules.length} quy tắc · ${ld.quiz.length} câu kiểm tra nhanh`);

  const missing: string[] = [];
  for (const template of ['RM1', 'RM2', 'RM3', 'RM4', 'RM5']) {
    for (const group of Object.values(GROUP_BY_SHORT)) {
      for (const band of BANDS) {
        if (!items.some((i) => i.template_code === template && i.group_code === group && i.band_code === band)) {
          missing.push(`${template}/${group}/${band}`);
        }
      }
    }
  }
  if (missing.length > 0) warn(`Ô chưa có mục nào: ${missing.join(', ')}`);

  if (warnings.length > 0) {
    console.log(`\nCảnh báo (${warnings.length}):`);
    for (const message of warnings) console.log(`  - ${message}`);
  }
  if (JSON_OUT) {
    writeFileSync(JSON_OUT, JSON.stringify({ items, bands, weights, plans: ld.plans, rules: ld.rules, quiz: ld.quiz }, null, 2), 'utf8');
    console.log(`\nĐã ghi ${JSON_OUT}`);
  }
  if (DRY_RUN) return;

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || serviceKey.includes('your_service_role_key')) {
    throw new Error('Thiếu SUPABASE_URL (hoặc VITE_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY trong .env');
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  console.log('\nGhi vào cơ sở dữ liệu');
  await write(supabase, items, bands, weights, ld);
  console.log('Hoàn tất.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
