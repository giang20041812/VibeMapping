/**
 * Nạp dữ liệu phase 2 (Nghề – Ngành – Trường) từ file của team BA.
 *
 *   Career_Profile.xlsx                  -> career_fields, careers, career_job_descriptions,
 *                                           career_job_description_criteria, career_requirements,
 *                                           career_holland_profiles
 *   RESEARCH NGÀNH NGHỀ TRƯỜNG.xlsx      -> institutions, majors, training_programs
 *   (JD "Học vấn" × tên ngành)           -> career_major_links
 *   ASSESSMENT FRAMEWORK.xlsx            -> chỉ để nối tên tiêu chí với mã D1.1…D7.4
 *
 * Chạy:   npm run import:phase2        (cần SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY trong .env gốc,
 *                                        đã chạy migration 20261030000100 và import:ba)
 *         npm run import:phase2:dry    (chỉ đọc và báo cáo, không ghi DB)
 *
 * Quy tắc tính ma trận nghề theo SRS R16:
 *   - chỉ JD mức L0–L2 có Required Level quy đổi được về thang 1–5 mới được dùng;
 *   - Req(d,c)  = trung bình Required Level của các JD đó có gắn tiêu chí d (G1–G5, G7);
 *   - CW(d,c)   = số JD có d, chuẩn hóa để tổng bằng 1 trong từng thành phần (G1–G5 | G7);
 *   - G6 không có Req: hồ sơ sáu chiều RIASEC = tỷ lệ JD có gắn D6.1–D6.6, kèm mã Holland Top 3.
 * Cách gộp (trung bình, đếm JD) là mặc định của dev, chưa có văn bản BA chốt.
 *
 * Idempotent. Không đụng tới `status` của nghề đã có (admin đã công bố thì giữ nguyên);
 * ma trận và liên kết nghề–ngành sinh tự động được dựng lại, dòng do người sửa tay được giữ.
 * Service role key chỉ dùng ở script này, không bao giờ đưa vào frontend.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, 'frontend', '.env') });

const CAREER_FILE = path.join(repoRoot, 'TEAM BA', 'Career_Profile.xlsx');
const RESEARCH_FILE = path.join(repoRoot, 'TEAM BA', 'RESEARCH NGÀNH NGHỀ TRƯỜNG.xlsx');
const FRAMEWORK_FILE = path.join(repoRoot, 'TEAM BA', 'ASSESSMENT FRAMEWORK.xlsx');
const BATCH_SIZE = 500;
/** P16: số JD tối thiểu mỗi nghề (SRS R16, mức đề xuất) - chỉ dùng để báo cáo */
const MIN_JD_PER_CAREER = 20;
/** Cột tỉnh/thành có sheet ghi cả địa chỉ; giá trị dài hơn mức này được coi là địa chỉ */
const MAX_CITY_LENGTH = 30;
const MAIN_GROUPS = ['G1', 'G2', 'G3', 'G4', 'G5'];
const HOLLAND_BY_DIMENSION: Record<string, string> = {
  'D6.1': 'R', 'D6.2': 'I', 'D6.3': 'A', 'D6.4': 'S', 'D6.5': 'E', 'D6.6': 'C',
};
const HOLLAND_ORDER = 'RIASEC';

type Row = Record<string, unknown>;

// ---------------------------------------------------------------- tiện ích
const warnings: string[] = [];
const warn = (message: string) => warnings.push(message);

function valueText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value).trim();
  const v = value as Record<string, unknown>;
  if (Array.isArray(v.richText)) return (v.richText as { text: string }[]).map((part) => part.text).join('').trim();
  if (v.result !== undefined) return valueText(v.result);
  if (v.hyperlink && typeof v.text !== 'string') return String(v.hyperlink).trim();
  if (v.text !== undefined) return valueText(v.text);
  return '';
}
const cellText = (cell: ExcelJS.Cell) => valueText(cell.value);

const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();
/** Chữ thường, bỏ dấu, gộp dấu gạch ngang các kiểu: khóa so khớp tên */
const fold = (text: string) =>
  collapse(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s*-\s*/g, ' - ');
const slug = (text: string) => fold(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
/** Ô "Cần research" / "N / A" là chỗ trống chưa điền, không phải dữ liệu */
const clean = (text: string) => (/^(cần research|n ?\/ ?a|#n\/a)$/i.test(text.trim()) ? '' : text.trim());
const orNull = (text: string) => (text ? text : null);

function mode(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}
const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

function headerMap(sheet: ExcelJS.Worksheet): (prefix: string) => number {
  const labels: [string, number][] = [];
  sheet.getRow(1).eachCell((cell, col) => labels.push([collapse(cellText(cell)).toLowerCase(), col]));
  return (prefix: string) => labels.find(([label]) => label.startsWith(prefix.toLowerCase()))?.[1] ?? 0;
}

// ---------------------------------------------------------------- khung tiêu chí
interface Dimension { code: string; name: string; group: string }

async function readDimensions(): Promise<Dimension[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(FRAMEWORK_FILE);
  const sheet = workbook.getWorksheet('MA TRẬN');
  if (!sheet) throw new Error('ASSESSMENT FRAMEWORK: không thấy sheet MA TRẬN');
  const dimensions: Dimension[] = [];
  let group = '';
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    group = cellText(row.getCell(1)) || group;
    const code = cellText(row.getCell(3));
    if (/^D\d\.\d$/.test(code)) dimensions.push({ code, name: cellText(row.getCell(4)), group });
  });
  return dimensions;
}

// ---------------------------------------------------------------- nghề
interface JobDescription {
  source_id: number;
  group_id: string;
  field_name: string;
  occupation_group: string;
  title: string;
  jd_code: string | null;
  career_level_raw: string | null;
  career_level: number | null;
  required_level_raw: string | null;
  required_level: number | null;
  text: Row;
  dimensions: { code: string; basis: string | null }[];
}

/** "L2 – Junior" -> 2; "Cấp độ 7: Lãnh đạo" -> 7 */
function parseCareerLevel(raw: string): number | null {
  const match = /^(?:L|Cấp độ\s*)(\d)/i.exec(raw.trim());
  return match ? Number(match[1]) : null;
}

/**
 * SRS R16: L0,L1 -> 1; L2 -> 2; L3 -> 3; L4 -> 4; L5–L7 -> 5; ô ghép hai mức lấy mức thấp hơn;
 * ô đã đúng thang 1–5 giữ nguyên; ô chữ hoặc trống không quy đổi.
 */
function parseRequiredLevel(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  if (/^\d+([.,]\d+)?$/.test(text)) {
    const value = Number(text.replace(',', '.'));
    return value >= 1 && value <= 5 ? value : null;
  }
  const levels = [...text.slice(0, 20).matchAll(/L(\d)/g)].map((m) => Number(m[1]));
  if (levels.length === 0) return null;
  const lowest = Math.min(...levels);
  return lowest <= 1 ? 1 : lowest >= 5 ? 5 : lowest;
}

const JD_TEXT_COLUMNS: [string, string][] = [
  ['company_name', 'Công ty'],
  ['job_title', 'Vị trí tuyển dụng'],
  ['sub_branch', 'Nhánh nhỏ'],
  ['company_industry', 'Ngành/Lĩnh vực công ty'],
  ['work_location', 'Địa điểm'],
  ['work_mode', 'Hình thức làm việc'],
  ['jd_url', 'Link JD'],
  ['career_summary', 'Tóm tắt nghề nghiệp'],
  ['position_objective', 'Mục tiêu vị trí'],
  ['main_tasks', 'Nhiệm vụ chính'],
  ['daily_activities', 'Hoạt động công việc thực tế'],
  ['work_outputs', 'Kết quả đầu ra công việc'],
  ['key_stakeholders', 'Stakeholder chính'],
  ['required_knowledge', 'Kiến thức yêu cầu'],
  ['professional_skills', 'Kỹ năng chuyên môn'],
  ['soft_skills', 'Kỹ năng mềm'],
  ['tools_technologies', 'Công cụ/Công nghệ'],
  ['education_requirement', 'Học vấn'],
  ['certifications', 'Chứng chỉ'],
  ['experience_requirement', 'Kinh nghiệm'],
  ['language_requirement', 'Ngoại ngữ'],
  ['special_requirements', 'Yêu cầu đặc thù'],
  ['career_path', 'Career Path'],
  ['work_environment', 'Môi trường làm việc'],
  ['benefits', 'Quyền lợi ứng viên'],
  ['salary_reference', 'Mức thu nhập tham khảo'],
  ['behavior_evidence', 'Evidence hành vi'],
  ['data_source', 'Nguồn dữ liệu'],
];

async function readJobDescriptions(dimensions: Dimension[]): Promise<JobDescription[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(CAREER_FILE);
  const sheet = workbook.getWorksheet('Career Profile');
  if (!sheet) throw new Error('Career_Profile: không thấy sheet Career Profile');
  const col = headerMap(sheet);
  const need = (label: string) => {
    const index = col(label);
    if (!index) throw new Error(`Career_Profile: thiếu cột "${label}"`);
    return index;
  };
  const cId = need('ID'), cGroup = need('Group ID'), cField = need('Nhóm lĩnh vực nghề'), cOccupation = need('Nhóm nghề');
  const cTitle = need('Chức danh nghề nghiệp'), cLevel = need('Cấp độ nghề'), cJd = need('JD ID');
  const cRequired = need('Required Level'), cDims = need('Dimension liên quan'), cBasis = need('Căn cứ chọn dimension');
  const textCols = JD_TEXT_COLUMNS.map(([field, label]) => [field, need(label)] as const);
  const byName = new Map(dimensions.map((d) => [fold(d.name), d.code]));

  const rows: JobDescription[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const sourceId = Number(cellText(row.getCell(cId)));
    const groupId = collapse(cellText(row.getCell(cGroup)));
    const title = collapse(cellText(row.getCell(cTitle)));
    if (!Number.isInteger(sourceId) || !groupId || !title) {
      if (groupId || title) warn(`Career Profile dòng ${rowNumber}: thiếu ID/Group ID/chức danh, bỏ qua`);
      return;
    }
    const basisByName = new Map<string, string>();
    for (const part of cellText(row.getCell(cBasis)).split(/;\s*/)) {
      const match = /^(.*?)\s*\((.*)\)\s*$/.exec(part.trim());
      if (match) basisByName.set(fold(match[1]), match[2].trim());
    }
    const dims: JobDescription['dimensions'] = [];
    for (const name of cellText(row.getCell(cDims)).split(/,\s*/)) {
      if (!name.trim()) continue;
      const code = byName.get(fold(name));
      if (!code) {
        warn(`Career Profile dòng ${rowNumber}: dimension "${name}" không có trong khung tiêu chí`);
        continue;
      }
      if (!dims.some((d) => d.code === code)) dims.push({ code, basis: basisByName.get(fold(name)) ?? null });
    }
    const levelRaw = cellText(row.getCell(cLevel));
    const requiredRaw = cellText(row.getCell(cRequired));
    const text: Row = {};
    for (const [field, index] of textCols) text[field] = orNull(clean(cellText(row.getCell(index))));
    rows.push({
      source_id: sourceId,
      group_id: groupId,
      field_name: collapse(cellText(row.getCell(cField))),
      occupation_group: collapse(cellText(row.getCell(cOccupation))),
      title,
      jd_code: orNull(clean(cellText(row.getCell(cJd)))),
      career_level_raw: orNull(levelRaw),
      career_level: parseCareerLevel(levelRaw),
      required_level_raw: orNull(requiredRaw),
      required_level: parseRequiredLevel(requiredRaw),
      text,
      dimensions: dims,
    });
  });
  return rows;
}

interface FieldRow { field_code: string; parent_code: string | null; field_name: string; sort_order: number }
interface CareerRow {
  career_code: string;
  field_code: string;
  career_name: string;
  source_group_id: string;
  jds: JobDescription[];
}

function buildFields(jds: JobDescription[]): { fields: FieldRow[]; fieldCodeOf: (jd: JobDescription) => string } {
  const level1 = new Map<string, string[]>();
  for (const jd of jds) {
    const prefix = jd.group_id.slice(0, 2);
    if (!/^G[1-6]$/.test(prefix)) { warn(`Group ID "${jd.group_id}" không bắt đầu bằng G1–G6`); continue; }
    (level1.get(prefix) ?? level1.set(prefix, []).get(prefix)!).push(jd.field_name);
  }
  const fields: FieldRow[] = [...level1.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([prefix, names], index) => ({
      field_code: `LV${prefix.slice(1)}`, parent_code: null, field_name: mode(names), sort_order: index + 1,
    }));
  const level2 = new Map<string, FieldRow>();
  const fieldCodeOf = (jd: JobDescription) => {
    const parent = `LV${jd.group_id.slice(1, 2)}`;
    const name = jd.occupation_group || 'Khác';
    const code = `${parent}/${slug(name)}`;
    if (!level2.has(code)) level2.set(code, { field_code: code, parent_code: parent, field_name: name, sort_order: level2.size + 1 });
    return code;
  };
  for (const jd of jds) fieldCodeOf(jd);
  return { fields: [...fields, ...level2.values()], fieldCodeOf };
}

function buildCareers(jds: JobDescription[], fieldCodeOf: (jd: JobDescription) => string): CareerRow[] {
  const titlesByGroup = new Map<string, Set<string>>();
  for (const jd of jds) (titlesByGroup.get(jd.group_id) ?? titlesByGroup.set(jd.group_id, new Set()).get(jd.group_id)!).add(fold(jd.title));

  const byKey = new Map<string, JobDescription[]>();
  for (const jd of jds) {
    const key = `${jd.group_id}|${fold(jd.title)}`;
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(jd);
  }
  const used = new Set<string>();
  const careers: CareerRow[] = [];
  for (const group of byKey.values()) {
    const first = group[0];
    const single = titlesByGroup.get(first.group_id)!.size === 1;
    let code = single ? first.group_id : `${first.group_id}:${slug(first.title)}`;
    for (let n = 2; used.has(code); n += 1) code = `${first.group_id}:${slug(first.title)}-${n}`;
    used.add(code);
    careers.push({
      career_code: code,
      field_code: fieldCodeOf({ ...first, occupation_group: mode(group.map((jd) => jd.occupation_group)) }),
      career_name: mode(group.map((jd) => jd.title)),
      source_group_id: first.group_id,
      jds: group,
    });
  }
  return careers;
}

interface RequirementRow { career_code: string; dimension_code: string; required_score: number; career_weight: number; jd_count: number }
interface HollandRow { career_code: string; holland_code: string; strength: number; jd_count: number }
interface CareerMatrix {
  requirements: RequirementRow[];
  holland: HollandRow[];
  summary: Map<string, { qualifying: number; holland_top3: string | null; complete: boolean }>;
}

function buildMatrix(careers: CareerRow[], dimensions: Dimension[]): CareerMatrix {
  const groupOf = new Map(dimensions.map((d) => [d.code, d.group]));
  const requirements: RequirementRow[] = [];
  const holland: HollandRow[] = [];
  const summary: CareerMatrix['summary'] = new Map();

  for (const career of careers) {
    const qualifying = career.jds.filter((jd) => jd.career_level !== null && jd.career_level <= 2 && jd.required_level !== null);
    const stats = new Map<string, { count: number; sum: number }>();
    for (const jd of qualifying) {
      for (const { code } of jd.dimensions) {
        const stat = stats.get(code) ?? { count: 0, sum: 0 };
        stat.count += 1;
        stat.sum += jd.required_level!;
        stats.set(code, stat);
      }
    }
    // Chuẩn hóa CW trong từng thành phần: G1–G5 và G7 (G6 không có Req)
    const total = { main: 0, g7: 0 };
    for (const [code, stat] of stats) {
      const group = groupOf.get(code);
      if (group && MAIN_GROUPS.includes(group)) total.main += stat.count;
      else if (group === 'G7') total.g7 += stat.count;
    }
    let hasMain = false, hasG7 = false;
    for (const [code, stat] of stats) {
      const group = groupOf.get(code);
      const isMain = !!group && MAIN_GROUPS.includes(group);
      if (!isMain && group !== 'G7') continue;
      if (isMain) hasMain = true; else hasG7 = true;
      requirements.push({
        career_code: career.career_code,
        dimension_code: code,
        required_score: round(stat.sum / stat.count, 2),
        career_weight: round(stat.count / (isMain ? total.main : total.g7), 5),
        jd_count: stat.count,
      });
    }
    const hollandRows: HollandRow[] = [];
    for (const [dimension, letter] of Object.entries(HOLLAND_BY_DIMENSION)) {
      const count = stats.get(dimension)?.count ?? 0;
      if (qualifying.length > 0) {
        hollandRows.push({ career_code: career.career_code, holland_code: letter, strength: round(count / qualifying.length, 3), jd_count: count });
      }
    }
    holland.push(...hollandRows);
    const top3 = hollandRows
      .filter((row) => row.jd_count > 0)
      .sort((a, b) => b.jd_count - a.jd_count || HOLLAND_ORDER.indexOf(a.holland_code) - HOLLAND_ORDER.indexOf(b.holland_code))
      .slice(0, 3)
      .map((row) => row.holland_code)
      .join('');
    summary.set(career.career_code, {
      qualifying: qualifying.length,
      holland_top3: top3 || null,
      complete: hasMain && hasG7 && top3 !== '',
    });
  }
  return { requirements, holland, summary };
}

// ---------------------------------------------------------------- trường / ngành
type ResearchStatus = 'verified' | 'partially_verified' | 'supplemented' | 'needs_supplement' | 'unverified';
const STATUS_RANK: Record<ResearchStatus, number> = { verified: 5, supplemented: 4, partially_verified: 3, needs_supplement: 2, unverified: 1 };
const STATUS_BY_LABEL: Record<string, ResearchStatus> = {
  'đã xác minh': 'verified',
  'xác minh một phần': 'partially_verified',
  'đã bổ sung': 'supplemented',
  'cần bổ sung': 'needs_supplement',
  'chưa xác minh': 'unverified',
};
const INSTITUTION_TYPE: Record<string, string> = { 'đại học': 'university', 'học viện': 'academy', 'cao đẳng': 'college' };
const OWNERSHIP: Record<string, string> = { 'công lập': 'public', 'tư thục': 'private' };

interface ResearchRow {
  ownership: string | null; group_id: string; institution_type: string | null; segment: string | null; segment_rank: number | null;
  parent_name: string; institution_name: string; city: string | null; city_before_merger: string | null;
  address: string | null; faculty: string | null; website: string | null;
  major_raw: string; specialization: string | null; program_type: string | null; program_summary: string | null;
  tuition_text: string | null; program_url: string | null; source_reference: string | null;
  status: ResearchStatus; researcher: string | null; note: string | null;
}

function normalizeCity(text: string): string | null {
  const city = collapse(collapse(text.replace(/\([^)]*\)/g, ' ')).replace(/^(?:TP\.?\s*|Thành phố\s*|Tỉnh\s*)/i, ''));
  // Vài dòng lệch cột nên loại hình lọt vào cột tỉnh/thành
  if (!city || /^(công lập|tư thục)$/i.test(city)) return null;
  if (['ho chi minh', 'hcm', 'tp.hcm', 'tphcm'].includes(fold(city).replace(/^tp\.?\s*/, ''))) return 'TP.HCM';
  return city;
}

/** Địa chỉ đầy đủ -> lấy đoạn cuối làm tỉnh/thành */
function placeFields(text: string): { city: string | null; address: string | null } {
  if (!text) return { city: null, address: null };
  if (text.length <= MAX_CITY_LENGTH) return { city: normalizeCity(text), address: null };
  const last = text.split(',').pop() ?? '';
  return { city: normalizeCity(last), address: text };
}

function numberFromVietnamese(text: string): number {
  const cleaned = text.replace(/,/g, '.');
  const normalized = (cleaned.match(/\./g) ?? []).length > 1 ? cleaned.replace(/\./g, '') : cleaned;
  return Number(normalized);
}

/**
 * "Học phí 1 kỳ học: ≈29,5 triệu đồng" / "khoảng 12 triệu" / "38,5 – 40 triệu đồng/học kỳ"
 * -> [29_500_000, 29_500_000]. Học phí theo tín chỉ hoặc theo năm không quy đổi: giữ nguyên ở tuition_text.
 */
const TUITION_PATTERNS = [
  /học phí\s*(?:1|một)\s*(?:kỳ|học kỳ)[^:]*:\s*(?:khoảng\s*)?[≈~]?\s*([\d.,]+)\s*(?:[–-]\s*[≈~]?\s*([\d.,]+))?\s*(?:triệu|tr)\b/i,
  /học phí[^:\n]{0,25}:\s*(?:khoảng\s*)?[≈~]?\s*([\d.,]+)\s*(?:[–-]\s*[≈~]?\s*([\d.,]+))?\s*triệu(?:\s*đồng)?\s*\/\s*(?:học kỳ|kỳ)/i,
];
function parseSemesterTuition(text: string | null): [number, number] | null {
  if (!text) return null;
  for (const pattern of TUITION_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const low = numberFromVietnamese(match[1]);
    const high = match[2] ? numberFromVietnamese(match[2]) : low;
    if (Number.isFinite(low) && Number.isFinite(high) && low > 0) {
      return [Math.round(Math.min(low, high) * 1_000_000), Math.round(Math.max(low, high) * 1_000_000)];
    }
  }
  return null;
}

function parseStudyYears(text: string | null): number | null {
  const match = text ? /số năm đào tạo:\s*(\d+(?:[.,]\d+)?)/i.exec(text) : null;
  const value = match ? numberFromVietnamese(match[1]) : NaN;
  return Number.isFinite(value) && value > 0 && value <= 8 ? value : null;
}

function parseDegreeLevels(programType: string | null): string[] | null {
  if (!programType) return null;
  const levels = new Set<string>();
  if (/cao đẳng/i.test(programType)) levels.add('college');
  if (/đại học|cử nhân|kỹ sư|chính quy|ctđt/i.test(programType) && !/^cao đẳng/i.test(programType)) levels.add('bachelor');
  if (/thạc sĩ/i.test(programType)) levels.add('master');
  if (/tiến sĩ/i.test(programType)) levels.add('doctorate');
  return levels.size > 0 ? [...levels] : null;
}

/** Tên ngành: bỏ mọi phần ngoặc ở cuối (mã ngành, hệ chương trình, viết tắt) để gộp cùng một ngành; phần bỏ đi lưu làm program_qualifier */
function splitMajor(raw: string): { name: string; qualifier: string | null } {
  const qualifiers: string[] = [];
  let name = collapse(raw);
  for (let guard = 0; guard < 4; guard += 1) {
    const match = /\s*\(((?:[^()]|\([^()]*\))*)\)\s*$/.exec(name);
    if (!match || match.index === 0) break;
    qualifiers.unshift(match[1].trim());
    name = name.slice(0, match.index).trim();
  }
  return { name, qualifier: qualifiers.length ? qualifiers.join('; ') : null };
}

/** Dòng giữ chỗ chứ không phải tên ngành: "Thạc sĩ", "Thạc sĩ các ngành", "5 ngành thạc sĩ mới 2026 (chưa rõ tên)" */
const isPlaceholderMajor = (name: string) =>
  /^(thac si|tien si|cao hoc|dai hoc|cu nhan|ky su|cao dang)$/.test(fold(name)) || /chua ro|cac nganh|nganh .*moi/.test(fold(name));

/** Khóa gộp tên trường: bỏ ngoặc, bỏ tiền tố "Trường" */
function institutionKey(name: string): string {
  let text = name;
  while (/\([^()]*\)/.test(text)) text = text.replace(/\([^()]*\)/g, ' ');
  return fold(text).replace(/^truong /, '').replace(/\s+/g, ' ').trim();
}

const PARENT_SYSTEMS: { key: string; test: (folded: string) => boolean }[] = [
  { key: 'vnu-hanoi', test: (f) => f.includes('quoc gia ha noi') },
  { key: 'vnu-hcm', test: (f) => f.includes('quoc gia') && /hcm|ho chi minh/.test(f) },
  { key: 'da-nang', test: (f) => f.includes('da nang') && !f.includes('truong') },
  { key: 'hue', test: (f) => /^(dai hoc )?hue\b/.test(f) },
  { key: 'thai-nguyen', test: (f) => f.includes('thai nguyen') && !f.includes('truong') },
];
const parentSystemOf = (name: string) => {
  const folded = fold(name);
  return PARENT_SYSTEMS.find((system) => system.test(folded))?.key ?? null;
};

async function readResearch(): Promise<ResearchRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(RESEARCH_FILE);
  const rows: ResearchRow[] = [];
  for (const sheet of workbook.worksheets) {
    const col = headerMap(sheet);
    const cName = col('Tên trường');
    if (!cName) continue; // sheet hướng dẫn, danh sách đại học chủ quản
    const c = {
      ownership: col('Loại hình'), group: col('Group ID'), type: col('Loại cơ sở'), segment: col('Phân khúc'),
      parent: col('Đại học chủ quản'), after: col('Tỉnh/TP (sau sáp nhập'), before: col('Tỉnh/TP (trước sáp nhập'),
      faculty: col('Viện/Khoa'), website: col('Website chính thức'), major: col('Ngành'), spec: col('Chuyên ngành'),
      programType: col('Hệ đào tạo'), summary: col('Chương trình đào tạo'), tuition: col('Học phí'),
      url: col('Link chương trình đào tạo'), source: col('Nguồn tham khảo'), status: col('Trạng thái research'),
      researcher: col('Người research'), note: col('Ghi chú'),
    };
    const get = (row: ExcelJS.Row, index: number) => (index ? clean(cellText(row.getCell(index))) : '');
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const institutionName = collapse(get(row, cName));
      const majorRaw = collapse(get(row, c.major));
      if (!institutionName || !majorRaw) return;
      const after = placeFields(collapse(get(row, c.after)));
      const before = placeFields(collapse(get(row, c.before)));
      const segment = get(row, c.segment);
      const specialization = get(row, c.spec);
      rows.push({
        ownership: OWNERSHIP[get(row, c.ownership).toLowerCase()] ?? null,
        group_id: get(row, c.group),
        institution_type: INSTITUTION_TYPE[get(row, c.type).toLowerCase()] ?? null,
        segment: orNull(segment.replace(/^\d+\.\s*/, '')),
        segment_rank: /^\d/.test(segment) ? Number(segment[0]) : null,
        parent_name: collapse(get(row, c.parent)),
        institution_name: institutionName,
        city: after.city,
        city_before_merger: before.city,
        address: after.address ?? before.address,
        faculty: orNull(collapse(get(row, c.faculty))),
        website: orNull(get(row, c.website)),
        major_raw: majorRaw,
        specialization: /không chia chuyên ngành/i.test(specialization) ? null : orNull(collapse(specialization)),
        program_type: orNull(collapse(get(row, c.programType))),
        program_summary: orNull(get(row, c.summary)),
        tuition_text: orNull(get(row, c.tuition)),
        program_url: orNull(get(row, c.url)),
        source_reference: orNull(get(row, c.source)),
        status: STATUS_BY_LABEL[get(row, c.status).toLowerCase()] ?? 'unverified',
        researcher: orNull(get(row, c.researcher)),
        note: orNull(get(row, c.note)),
      });
    });
  }
  return rows;
}

interface InstitutionRow {
  normalized_name: string; institution_name: string; institution_type: string; ownership: string | null;
  segment: string | null; segment_rank: number | null; main_group: string | null; city: string | null;
  city_before_merger: string | null; address: string | null; website_url: string | null; parent_system: string | null;
}
interface ProgramRow {
  source_key: string; institution_key: string; major_key: string; faculty_name: string | null; specialization_name: string | null;
  program_type: string | null; degree_levels: string[] | null; program_qualifier: string | null; program_summary: string | null;
  study_years: number | null; tuition_text: string | null; tuition_per_semester_min: number | null; tuition_per_semester_max: number | null;
  program_url: string | null; source_reference: string | null; research_status: ResearchStatus; researcher_name: string | null; research_note: string | null;
}
interface MajorRow { normalized_name: string; major_name: string }

function buildInstitutionsMajorsPrograms(rows: ResearchRow[]) {
  const institutions = new Map<string, InstitutionRow>();
  const nameVotes = new Map<string, string[]>();
  const groupVotes = new Map<string, string[]>();
  const majors = new Map<string, MajorRow>();
  const majorNameVotes = new Map<string, string[]>();
  const programs = new Map<string, ProgramRow>();

  for (const row of rows) {
    const { name: majorName, qualifier } = splitMajor(row.major_raw);
    if (isPlaceholderMajor(majorName)) { warn(`Bỏ dòng ngành giữ chỗ: "${row.major_raw}" (${row.institution_name})`); continue; }
    const instKey = institutionKey(row.institution_name);
    (nameVotes.get(instKey) ?? nameVotes.set(instKey, []).get(instKey)!).push(row.institution_name);
    (groupVotes.get(instKey) ?? groupVotes.set(instKey, []).get(instKey)!).push(row.group_id);
    const existing = institutions.get(instKey);
    const parentSystem = row.parent_name ? parentSystemOf(row.parent_name) : null;
    if (!existing) {
      institutions.set(instKey, {
        normalized_name: instKey, institution_name: row.institution_name,
        institution_type: row.institution_type ?? 'university', ownership: row.ownership,
        segment: row.segment, segment_rank: row.segment_rank, main_group: null,
        city: row.city, city_before_merger: row.city_before_merger, address: row.address,
        website_url: row.website, parent_system: parentSystem,
      });
    } else {
      existing.ownership ??= row.ownership;
      existing.segment ??= row.segment;
      existing.segment_rank ??= row.segment_rank;
      existing.city ??= row.city;
      existing.city_before_merger ??= row.city_before_merger;
      existing.address ??= row.address;
      existing.website_url ??= row.website;
      existing.parent_system ??= parentSystem;
    }

    const majorKey = fold(majorName);
    (majorNameVotes.get(majorKey) ?? majorNameVotes.set(majorKey, []).get(majorKey)!).push(majorName);
    if (!majors.has(majorKey)) majors.set(majorKey, { normalized_name: majorKey, major_name: majorName });

    const sourceKey = [instKey, row.faculty, majorKey, row.specialization, row.program_type, qualifier].map((p) => fold(p ?? '')).join('|');
    const tuition = parseSemesterTuition(row.tuition_text);
    const program: ProgramRow = {
      source_key: sourceKey, institution_key: instKey, major_key: majorKey,
      faculty_name: row.faculty, specialization_name: row.specialization, program_type: row.program_type,
      degree_levels: parseDegreeLevels(row.program_type), program_qualifier: qualifier,
      program_summary: row.program_summary, study_years: parseStudyYears(row.program_summary),
      tuition_text: row.tuition_text, tuition_per_semester_min: tuition?.[0] ?? null, tuition_per_semester_max: tuition?.[1] ?? null,
      program_url: row.program_url, source_reference: row.source_reference, research_status: row.status,
      researcher_name: row.researcher, research_note: row.note,
    };
    const previous = programs.get(sourceKey);
    if (!previous || STATUS_RANK[program.research_status] > STATUS_RANK[previous.research_status]) programs.set(sourceKey, program);
  }

  for (const [key, institution] of institutions) {
    institution.institution_name = mode(nameVotes.get(key) ?? []) || institution.institution_name;
    const group = mode((groupVotes.get(key) ?? []).filter((g) => /^G[1-6]$/.test(g)));
    institution.main_group = group || null;
  }
  for (const [key, major] of majors) major.major_name = mode(majorNameVotes.get(key) ?? []) || major.major_name;
  return { institutions, majors, programs };
}

// ---------------------------------------------------------------- liên kết nghề – ngành
interface LinkRow { career_code: string; major_key: string }

/** Chuẩn hóa văn bản để so khớp theo từ nguyên vẹn */
const wordsOf = (text: string) => ` ${fold(text).replace(/[^a-z0-9]+/g, ' ').trim()} `;

/**
 * Nghề liên kết trực tiếp với ngành khi mọi thành phần của tên ngành (tách theo "-", ",", "/", "và")
 * đều xuất hiện nguyên từ trong mục Học vấn của các JD thuộc nghề.
 */
function deriveLinks(careers: CareerRow[], majors: Map<string, MajorRow>): LinkRow[] {
  const majorParts = [...majors.values()]
    .map((major) => ({
      key: major.normalized_name,
      parts: major.normalized_name
        .replace(/\([^)]*\)/g, ' ')
        .split(/\s*(?:-|,|\/|&)\s*|\sva\s/)
        .map((part) => part.replace(/[^a-z0-9]+/g, ' ').trim())
        .filter(Boolean)
        .map((part) => ` ${part} `),
    }))
    .filter((major) => major.parts.length > 0 && major.parts.every((part) => part.trim().length >= 4));

  const links: LinkRow[] = [];
  for (const career of careers) {
    const education = wordsOf(career.jds.map((jd) => String(jd.text.education_requirement ?? '')).join(' ; '));
    if (education.trim().length === 0) continue;
    for (const major of majorParts) {
      if (major.parts.every((part) => education.includes(part))) links.push({ career_code: career.career_code, major_key: major.key });
    }
  }
  return links;
}

// ---------------------------------------------------------------- báo cáo
function report(args: {
  jds: JobDescription[]; careers: CareerRow[]; fieldCount: number; matrix: CareerMatrix;
  research: ResearchRow[]; institutions: Map<string, InstitutionRow>; majors: Map<string, MajorRow>;
  programs: Map<string, ProgramRow>; links: LinkRow[];
}) {
  const { jds, careers, matrix, research, institutions, majors, programs, links } = args;
  const lines: string[] = [];
  const count = (items: unknown[], predicate: (item: never) => boolean) => (items as never[]).filter(predicate).length;
  const pct = (n: number, total: number) => (total ? `${((n / total) * 100).toFixed(1)}%` : '-');

  lines.push('== Nghề ==');
  lines.push(`Lĩnh vực + nhóm nghề: ${args.fieldCount}`);
  lines.push(`JD đọc được: ${jds.length}; nghề (Group ID × chức danh): ${careers.length}`);
  const levelKnown = count(jds, (jd: JobDescription) => jd.career_level !== null);
  const reqKnown = count(jds, (jd: JobDescription) => jd.required_level !== null);
  lines.push(`JD có cấp độ nghề nhận ra: ${levelKnown}; có Required Level quy đổi được: ${reqKnown}; còn lại là chữ/trống: ${jds.length - reqKnown}`);
  const summaries = [...matrix.summary.values()];
  const withQualifying = count(summaries, (s: { qualifying: number }) => s.qualifying > 0);
  lines.push(`Nghề có ít nhất 1 JD L0–L2 dùng được: ${withQualifying}/${careers.length}`);
  lines.push(`Nghề đạt tối thiểu ${MIN_JD_PER_CAREER} JD dùng được (P16): ${count(summaries, (s: { qualifying: number }) => s.qualifying >= MIN_JD_PER_CAREER)}`);
  lines.push(`Nghề đủ chuẩn (có G1–G5, G7 và Holland): ${count(summaries, (s: { complete: boolean }) => s.complete)}`);
  lines.push(`Dòng ma trận yêu cầu: ${matrix.requirements.length}; dòng hồ sơ Holland: ${matrix.holland.length}`);

  lines.push('\n== Trường – Ngành ==');
  lines.push(`Dòng research hợp lệ: ${research.length}`);
  lines.push(`Trường (sau gộp tên): ${institutions.size}; thuộc hệ thống đại học quốc gia/vùng: ${count([...institutions.values()], (i: InstitutionRow) => i.parent_system !== null)}`);
  lines.push(`Ngành (sau gộp tên): ${majors.size}`);
  const programList = [...programs.values()];
  lines.push(`Chương trình đào tạo (sau gộp trùng): ${programList.length}`);
  for (const status of Object.keys(STATUS_RANK) as ResearchStatus[]) {
    lines.push(`  - ${status}: ${count(programList, (p: ProgramRow) => p.research_status === status)}`);
  }
  lines.push(`Có số năm đào tạo: ${pct(count(programList, (p: ProgramRow) => p.study_years !== null), programList.length)}; có học phí/kỳ tách được: ${pct(count(programList, (p: ProgramRow) => p.tuition_per_semester_min !== null), programList.length)}; có cấp bằng nhận ra: ${pct(count(programList, (p: ProgramRow) => p.degree_levels !== null), programList.length)}`);
  const cities = new Set([...institutions.values()].map((i) => i.city).filter(Boolean));
  lines.push(`Tỉnh/thành khác nhau: ${cities.size}; trường chưa có tỉnh/thành: ${count([...institutions.values()], (i: InstitutionRow) => !i.city)}; chưa rõ công lập/tư thục: ${count([...institutions.values()], (i: InstitutionRow) => !i.ownership)}`);
  lines.push(`Tỉnh/thành: ${[...cities].sort().join(', ')}`);

  lines.push('\n== Liên kết nghề – ngành ==');
  const linkedCareers = new Set(links.map((l) => l.career_code)).size;
  const linkedMajors = new Set(links.map((l) => l.major_key)).size;
  lines.push(`Liên kết trực tiếp sinh tự động (chưa kiểm duyệt): ${links.length}`);
  lines.push(`Nghề có ít nhất 1 ngành: ${linkedCareers}/${careers.length}; ngành có ít nhất 1 nghề: ${linkedMajors}/${majors.size}`);
  const topMajors = [...links.reduce((m, l) => m.set(l.major_key, (m.get(l.major_key) ?? 0) + 1), new Map<string, number>()).entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${majors.get(k)?.major_name} (${n})`);
  lines.push(`Ngành gắn với nhiều nghề nhất: ${topMajors.join('; ')}`);

  console.log(lines.join('\n'));
  if (warnings.length > 0) {
    console.log(`\nCảnh báo (${warnings.length}):`);
    for (const message of warnings.slice(0, 25)) console.log(`  - ${message}`);
    if (warnings.length > 25) console.log(`  ... và ${warnings.length - 25} cảnh báo khác`);
  }
}

// ---------------------------------------------------------------- ghi DB
async function fetchAll(supabase: SupabaseClient, table: string, columns: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).order('id').range(from, from + 999);
    if (error) throw new Error(`Đọc ${table}: ${error.message}`);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) return rows;
  }
}

async function upsertBatches(supabase: SupabaseClient, table: string, rows: Row[], onConflict: string, ignoreDuplicates = false) {
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const { error } = await supabase.from(table).upsert(rows.slice(start, start + BATCH_SIZE), { onConflict, ignoreDuplicates });
    if (error) throw new Error(`Ghi ${table}: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length}`);
}

const idMap = (rows: Row[], key: string) => new Map(rows.map((row) => [String(row[key]), String(row.id)]));

async function apply(args: {
  jds: JobDescription[]; fields: FieldRow[]; careers: CareerRow[]; matrix: CareerMatrix;
  institutions: Map<string, InstitutionRow>; majors: Map<string, MajorRow>; programs: Map<string, ProgramRow>; links: LinkRow[];
}) {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || serviceKey.includes('your_service_role_key')) {
    throw new Error('Thiếu SUPABASE_URL (hoặc VITE_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY trong .env');
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  console.log('\nGhi vào cơ sở dữ liệu:');

  const criteriaId = idMap(await fetchAll(supabase, 'criteria', 'id, dimension_code'), 'dimension_code');
  if (criteriaId.size === 0) throw new Error('Bảng criteria trống: chạy npm run import:ba trước');
  const { data: version, error: versionError } = await supabase.from('career_matrix_versions').select('id').eq('is_current', true).single();
  if (versionError || !version) throw new Error('Chưa có career_matrix_versions hiện hành: chạy migration 20261030000100 trước');
  const matrixVersionId = String(version.id);

  // lĩnh vực: cấp 1 trước để lấy id làm cha cho cấp 2
  const level1 = args.fields.filter((f) => !f.parent_code);
  await upsertBatches(supabase, 'career_fields', level1.map((f) => ({ field_code: f.field_code, field_name: f.field_name, sort_order: f.sort_order })), 'field_code');
  const parentId = idMap(await fetchAll(supabase, 'career_fields', 'id, field_code'), 'field_code');
  const level2 = args.fields.filter((f) => f.parent_code);
  await upsertBatches(supabase, 'career_fields', level2.map((f) => ({
    field_code: f.field_code, parent_field_id: parentId.get(f.parent_code!), field_name: f.field_name, sort_order: f.sort_order,
  })), 'field_code');
  const fieldId = idMap(await fetchAll(supabase, 'career_fields', 'id, field_code'), 'field_code');

  // nghề: không gửi `status` để nghề đã công bố giữ nguyên trạng thái
  await upsertBatches(supabase, 'careers', args.careers.map((c) => {
    const summary = args.matrix.summary.get(c.career_code)!;
    return {
      career_code: c.career_code, career_field_id: fieldId.get(c.field_code), career_name: c.career_name,
      source_group_id: c.source_group_id, holland_top3: summary.holland_top3,
      qualifying_jd_count: summary.qualifying, is_standard_complete: summary.complete,
    };
  }), 'career_code');
  const careerId = idMap(await fetchAll(supabase, 'careers', 'id, career_code'), 'career_code');

  const jdOwner = new Map<number, string>();
  for (const career of args.careers) for (const jd of career.jds) jdOwner.set(jd.source_id, career.career_code);
  await upsertBatches(supabase, 'career_job_descriptions', args.jds.map((jd) => ({
    career_id: careerId.get(jdOwner.get(jd.source_id)!), source_id: jd.source_id, jd_code: jd.jd_code,
    career_level_raw: jd.career_level_raw, career_level: jd.career_level,
    required_level_raw: jd.required_level_raw, required_level: jd.required_level, ...jd.text,
  })), 'source_id');
  const jdId = idMap(await fetchAll(supabase, 'career_job_descriptions', 'id, source_id'), 'source_id');

  const jdCriteria: Row[] = [];
  for (const jd of args.jds) {
    for (const { code, basis } of jd.dimensions) {
      const cid = criteriaId.get(code);
      if (!cid) throw new Error(`Thiếu tiêu chí ${code} trong bảng criteria`);
      jdCriteria.push({ job_description_id: jdId.get(String(jd.source_id)), criteria_id: cid, selection_basis: basis });
    }
  }
  await upsertBatches(supabase, 'career_job_description_criteria', jdCriteria, 'job_description_id,criteria_id');

  // ma trận sinh tự động: dựng lại; dòng đã được chuyên gia duyệt (verification_level khác) thì giữ
  for (const table of ['career_requirements', 'career_holland_profiles']) {
    const query = supabase.from(table).delete().eq('verification_level', 'per_jd_data');
    const { error } = await (table === 'career_requirements' ? query.eq('matrix_version_id', matrixVersionId) : query);
    if (error) throw new Error(`Xóa ${table}: ${error.message}`);
  }
  await upsertBatches(supabase, 'career_requirements', args.matrix.requirements.map((r) => ({
    career_id: careerId.get(r.career_code), criteria_id: criteriaId.get(r.dimension_code), matrix_version_id: matrixVersionId,
    required_score: r.required_score, career_weight: r.career_weight, jd_count: r.jd_count, verification_level: 'per_jd_data',
  })), 'career_id,criteria_id,matrix_version_id', true);
  await upsertBatches(supabase, 'career_holland_profiles', args.matrix.holland.map((r) => ({
    career_id: careerId.get(r.career_code), holland_code: r.holland_code, strength: r.strength, jd_count: r.jd_count, verification_level: 'per_jd_data',
  })), 'career_id,holland_code', true);

  // ngành
  await upsertBatches(supabase, 'majors', [...args.majors.values()].map((m) => ({ normalized_name: m.normalized_name, major_name: m.major_name })), 'normalized_name');
  const majorId = idMap(await fetchAll(supabase, 'majors', 'id, normalized_name'), 'normalized_name');

  // trường: hệ thống đại học quốc gia/vùng là bản ghi riêng, các trường thành viên trỏ về
  const PARENT_NAMES: Record<string, string> = {
    'vnu-hanoi': 'Đại học Quốc gia Hà Nội', 'vnu-hcm': 'Đại học Quốc gia TP.HCM', 'da-nang': 'Đại học Đà Nẵng',
    'hue': 'Đại học Huế', 'thai-nguyen': 'Đại học Thái Nguyên',
  };
  const usedParents = new Set([...args.institutions.values()].map((i) => i.parent_system).filter((k): k is string => !!k));
  await upsertBatches(supabase, 'institutions', [...usedParents].map((key) => ({
    normalized_name: `he-thong:${key}`, institution_name: PARENT_NAMES[key], institution_type: 'parent_university',
  })), 'normalized_name');
  const institutionIdByKey = idMap(await fetchAll(supabase, 'institutions', 'id, normalized_name'), 'normalized_name');
  await upsertBatches(supabase, 'institutions', [...args.institutions.values()].map((i) => ({
    normalized_name: i.normalized_name, institution_name: i.institution_name, institution_type: i.institution_type,
    ownership: i.ownership, segment: i.segment, segment_rank: i.segment_rank,
    main_field_id: i.main_group ? fieldId.get(`LV${i.main_group.slice(1)}`) ?? null : null,
    city: i.city, city_before_merger: i.city_before_merger, address: i.address, website_url: i.website_url,
    parent_institution_id: i.parent_system ? institutionIdByKey.get(`he-thong:${i.parent_system}`) ?? null : null,
  })), 'normalized_name');
  const institutionId = idMap(await fetchAll(supabase, 'institutions', 'id, normalized_name'), 'normalized_name');

  await upsertBatches(supabase, 'training_programs', [...args.programs.values()].map((p) => ({
    source_key: p.source_key, institution_id: institutionId.get(p.institution_key), major_id: majorId.get(p.major_key),
    faculty_name: p.faculty_name, specialization_name: p.specialization_name, program_type: p.program_type,
    degree_levels: p.degree_levels, program_qualifier: p.program_qualifier, program_summary: p.program_summary,
    study_years: p.study_years, tuition_text: p.tuition_text,
    tuition_per_semester_min: p.tuition_per_semester_min, tuition_per_semester_max: p.tuition_per_semester_max,
    program_url: p.program_url, source_reference: p.source_reference, research_status: p.research_status,
    researcher_name: p.researcher_name, research_note: p.research_note,
  })), 'source_key');

  // liên kết nghề – ngành: dựng lại phần sinh tự động chưa kiểm duyệt
  const { error: deleteLinksError } = await supabase.from('career_major_links').delete().eq('link_source', 'jd_education_text').eq('is_verified', false);
  if (deleteLinksError) throw new Error(`Xóa career_major_links: ${deleteLinksError.message}`);
  await upsertBatches(supabase, 'career_major_links', args.links.map((l) => ({
    career_id: careerId.get(l.career_code), major_id: majorId.get(l.major_key), link_level: 'direct', link_source: 'jd_education_text', is_verified: false,
  })), 'career_id,major_id', true);
  console.log('Hoàn tất. Nghề mới ở trạng thái draft: quản trị công bố từng nghề đủ chuẩn.');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const dimensions = await readDimensions();
  const jds = await readJobDescriptions(dimensions);
  const { fields, fieldCodeOf } = buildFields(jds);
  const careers = buildCareers(jds, fieldCodeOf);
  const matrix = buildMatrix(careers, dimensions);
  const research = await readResearch();
  const { institutions, majors, programs } = buildInstitutionsMajorsPrograms(research);
  const links = deriveLinks(careers, majors);

  report({ jds, careers, fieldCount: fields.length, matrix, research, institutions, majors, programs, links });
  if (dryRun) {
    console.log('\nDry-run: không ghi vào cơ sở dữ liệu.');
    return;
  }
  await apply({ jds, fields, careers, matrix, institutions, majors, programs, links });
}

main().catch((error) => {
  console.error('Lỗi nạp dữ liệu phase 2:', error instanceof Error ? error.message : error);
  process.exit(1);
});
