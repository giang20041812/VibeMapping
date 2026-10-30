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
 * Nạp dần từng phần (thứ tự: fields → careers → jds → jd_criteria → matrix → majors → institutions → programs → links):
 *         npm run import:phase2 -- --step school          (nhóm trường: majors, institutions, programs)
 *         npm run import:phase2 -- --step career          (nhóm nghề: fields … matrix)
 *         npm run import:phase2 -- --step majors,institutions
 *         npm run import:phase2 -- --from programs        (chạy tiếp từ bước đã lỗi tới hết)
 *   Bước sau đọc lại id từ DB; thiếu dữ liệu của bước trước thì báo cần chạy bước nào.
 *
 * Quy tắc tính ma trận nghề theo SRS R16:
 *   - Quy đổi Required Level (parseRequiredLevel): L0,L1 -> 1; L2 -> 2; L3 -> 3; L4 -> 4; L5–L7 -> 5.
 *   - Lọc cấp độ JD cho ma trận nghề HSSV: JD mức L1 và L2, cộng L0 (Intern) khi tham số `career_matrix_include_l0` bật
 *     (đọc từ operation_parameters; không kết nối được thì coi là bật), có Required Level quy đổi được về thang 1–5.
 *     JD ngoài phạm vi vẫn giữ trong career_job_descriptions nhưng không tham gia tính ma trận
 *     (SRS R16 vừa map L0 vừa ghi chỉ dùng L1–L2: đang chờ BA).
 *   - Req(d,c)  = trung bình Required Level của các JD đủ điều kiện có gắn tiêu chí d (G1–G5, G7);
 *   - CW(d,c)   = số JD đủ điều kiện có d, chuẩn hóa để tổng bằng 1 trong từng thành phần (G1–G5 | G7);
 *   - G6 không có Req: hồ sơ sáu chiều RIASEC = tỷ lệ JD đủ điều kiện có gắn D6.1–D6.6, kèm mã Holland Top 3.
 *   - Không tự điền mức yêu cầu/trọng số giả cho tiêu chí không xuất hiện trong JD.
 *   - Nghề đủ chuẩn (is_standard_complete) do hàm SQL refresh_career_standard() tính lại từ DB sau bước `matrix`;
 *     nghề Nháp đủ chuẩn và đủ P16 được auto_publish_careers() công bố. Nghề Ẩn hoặc Đang duyệt giữ nguyên.
 *   - Ngày kiểm tra dữ liệu: ngày "kiểm tra lại / research / cập nhật" trong cột Nguồn dữ liệu; không có thì lấy
 *     ngày "đăng" (đánh dấu posted, giả định của dev). Ngày của nghề = ngày mới nhất trong các JD.
 *
 * Idempotent. Không đụng tới `status` của nghề đã có;
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
/** JD nhiều cột chữ dài: lô nhỏ để không chạm giới hạn kích thước request / statement timeout */
const JD_BATCH_SIZE = 100;
const MAX_ATTEMPTS = 3;
/** P16: số JD tối thiểu mỗi nghề (SRS R16, mức đề xuất) - chỉ dùng để báo cáo */
const MIN_JD_PER_CAREER = 20;
/** Cột tỉnh/thành có sheet ghi cả địa chỉ; giá trị dài hơn mức này được coi là địa chỉ */
const MAX_CITY_LENGTH = 30;
const MAIN_GROUPS = ['G1', 'G2', 'G3', 'G4', 'G5'];
const HOLLAND_BY_DIMENSION: Record<string, string> = {
  'D6.1': 'R', 'D6.2': 'I', 'D6.3': 'A', 'D6.4': 'S', 'D6.5': 'E', 'D6.6': 'C',
};
const HOLLAND_ORDER = 'RIASEC';
/**
 * Tên lĩnh vực cấp 1 theo sheet CHIA NHÓM của CAREER_JD_RESEARCH_MASTER.xlsm (cùng tên với cột "Tên nhóm G" của file trường).
 * Cột "Nhóm lĩnh vực nghề" trong Career_Profile viết không thống nhất (có dòng chép cả phần mô tả) nên không dùng làm tên.
 */
const LEVEL1_FIELD_NAMES: Record<string, string> = {
  G1: 'Công nghệ & Kỹ thuật',
  G2: 'Kinh doanh & Tài chính',
  G3: 'Truyền thông, Sáng tạo & Dịch vụ',
  G4: 'Khoa học, Giáo dục & Xã hội',
  G5: 'Y tế, Sức khỏe & Môi trường',
  G6: 'Pháp luật, Quản lý & Cộng đồng',
};

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
  checked_at: string | null;
  checked_kind: 'checked' | 'posted' | null;
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

/** Ngày dd/mm/yyyy hợp lệ, không quá hôm nay -> yyyy-mm-dd */
function isoDate(day: string, month: string, year: string): string | null {
  const d = Number(day), m = Number(month), y = Number(year);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 2000 || date.getTime() > Date.now()) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Cột "Nguồn dữ liệu": "kiểm tra lại 28/09/2026", "research 25/09/2026", "cập nhật 17/06/2026" -> checked;
 * không có thì "đăng 18/09/2026" -> posted. Bỏ "Hạn nộp/Hạn ứng tuyển" và ngày chỉ có tháng/năm.
 */
function parseCheckedDate(source: string | null): { date: string | null; kind: 'checked' | 'posted' | null } {
  if (!source) return { date: null, kind: null };
  const latest = (keywords: string) => {
    const dates: string[] = [];
    for (const m of source.matchAll(new RegExp(`(?:${keywords})[^0-9\\n]{0,20}(\\d{1,2})/(\\d{1,2})/(\\d{4})`, 'gi'))) {
      const iso = isoDate(m[1], m[2], m[3]);
      if (iso) dates.push(iso);
    }
    return dates.sort().at(-1) ?? null;
  };
  const checked = latest('kiểm tra(?: lại)?|research|cập nhật|truy cập');
  if (checked) return { date: checked, kind: 'checked' };
  const posted = latest('đăng');
  return posted ? { date: posted, kind: 'posted' } : { date: null, kind: null };
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
      ...(() => {
        const found = parseCheckedDate((text.data_source as string | null) ?? null);
        return { checked_at: found.date, checked_kind: found.kind };
      })(),
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
      field_code: `LV${prefix.slice(1)}`, parent_code: null, field_name: LEVEL1_FIELD_NAMES[prefix] ?? mode(names), sort_order: index + 1,
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
  summary: Map<
    string,
    {
      qualifying: number;
      l0_count: number;
      scored_criteria_count: number;
      has_all_components: boolean;
      holland_top3: string | null;
      complete: boolean;
      checked_at: string | null;
      checked_kind: 'checked' | 'posted' | null;
    }
  >;
}

function buildMatrix(careers: CareerRow[], dimensions: Dimension[], includeL0: boolean): CareerMatrix {
  const groupOf = new Map(dimensions.map((d) => [d.code, d.group]));
  const requirements: RequirementRow[] = [];
  const holland: HollandRow[] = [];
  const summary: CareerMatrix['summary'] = new Map();

  for (const career of careers) {
    // R16 & 06_CAREER_PROFILE: JD đầu vào cho HSSV là L1 (Fresher), L2 (Junior), thêm L0 (Intern) khi tham số bật.
    const l0Count = career.jds.filter((jd) => jd.career_level === 0 && jd.required_level !== null).length;
    const qualifying = career.jds.filter(
      (jd) => jd.career_level !== null && jd.career_level <= 2 && (includeL0 || jd.career_level >= 1) && jd.required_level !== null,
    );
    // Ngày kiểm tra của nghề: ngày mới nhất, ưu tiên ngày kiểm tra hơn ngày đăng tin
    const checkedDates = career.jds.filter((jd) => jd.checked_kind === 'checked').map((jd) => jd.checked_at!).sort();
    const postedDates = career.jds.filter((jd) => jd.checked_kind === 'posted').map((jd) => jd.checked_at!).sort();
    const careerChecked: { date: string | null; kind: 'checked' | 'posted' | null } = checkedDates.length > 0
      ? { date: checkedDates[checkedDates.length - 1], kind: 'checked' }
      : postedDates.length > 0 ? { date: postedDates[postedDates.length - 1], kind: 'posted' } : { date: null, kind: null };
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
    let hasMain = false, hasG7 = false, scoredCriteriaCount = 0;
    for (const [code, stat] of stats) {
      const group = groupOf.get(code);
      const isMain = !!group && MAIN_GROUPS.includes(group);
      if (!isMain && group !== 'G7') continue;
      if (isMain) hasMain = true; else hasG7 = true;
      scoredCriteriaCount += 1;
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
    const hasAllComponents = hasMain && hasG7 && top3 !== '';
    // Nghề có đủ 3 thành phần (G1–G5, G7, Holland) trên các tiêu chí trọng tâm CW > 0 từ JD (R06 + File 06).
    summary.set(career.career_code, {
      qualifying: qualifying.length,
      l0_count: l0Count,
      scored_criteria_count: scoredCriteriaCount,
      has_all_components: hasAllComponents,
      holland_top3: top3 || null,
      complete: hasAllComponents,
      checked_at: careerChecked.date,
      checked_kind: careerChecked.kind,
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

type TuitionBasis = 'semester' | 'year' | 'total';
interface TuitionRange { min: number; max: number; basis: TuitionBasis }

/** "29,5 triệu" -> 29_500_000; "8.050.000 đồng" -> 8_050_000 */
function moneyToDong(amount: string, unit: string): number {
  const value = numberFromVietnamese(amount);
  return /^(triệu|tr)$/i.test(unit) ? Math.round(value * 1_000_000) : Math.round(value);
}
const MONEY = String.raw`([\d.,]+)\s*(?:[–-]\s*[≈~]?\s*([\d.,]+))?\s*(triệu|tr|đồng|đ|vnđ|vnd)\b`;

/**
 * Học phí mỗi kỳ ghi rõ được ưu tiên; sau đó học phí theo năm (chia 2 kỳ) và tổng khóa (chia số năm × 2).
 * Không quy đổi học phí theo tín chỉ hoặc theo tháng (thiếu số tín chỉ, số tháng); không lấy khi ghi miễn học phí.
 */
function parseTuition(text: string | null, studyYears: number | null): TuitionRange | null {
  if (!text) return null;
  const semester = parseSemesterTuition(text);
  if (semester) return { min: semester[0], max: semester[1], basis: 'semester' };
  if (/miễn học phí/i.test(text)) return null;
  const range = (match: RegExpExecArray, divisor: number, basis: TuitionBasis): TuitionRange | null => {
    const low = moneyToDong(match[1], match[3]);
    const high = match[2] ? moneyToDong(match[2], match[3]) : low;
    if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high <= 0) return null;
    const result = { min: Math.round(Math.min(low, high) / divisor), max: Math.round(Math.max(low, high) / divisor), basis };
    // Học phí một kỳ ngoài khoảng 1–100 triệu gần như chắc chắn là nhầm đơn vị
    return result.min >= 1_000_000 && result.max <= 100_000_000 ? result : null;
  };
  // 1 kỳ tính bằng đồng: "Học phí 1 kỳ học: 21.025.000 đồng", "7.950.000 đ/kỳ"; bỏ giá theo tháng, theo tín chỉ
  const perTerm = new RegExp(String.raw`học phí\s*(?:1|một)\s*(?:kỳ|học kỳ)[^:\n]*:\s*(?:khoảng\s*|từ\s*)?[≈~]?\s*${MONEY}(?!\s*\/\s*(?:tháng|tín|tc))`, 'i').exec(text);
  if (perTerm) { const found = range(perTerm, 1, 'semester'); if (found) return found; }
  const perYear = new RegExp(String.raw`học phí\s*(?:1|một)\s*năm[^:\n]*:\s*(?:khoảng\s*|từ\s*)?[≈~]?\s*${MONEY}(?!\s*\/\s*(?:tháng|tín|tc))`, 'i').exec(text);
  if (perYear) { const found = range(perYear, 2, 'year'); if (found) return found; }
  // "≈25 triệu đồng/năm" chỉ nhận khi văn bản có đúng một mức theo năm
  const yearly = [...text.matchAll(new RegExp(String.raw`[≈~]?\s*([\d.,]+)\s*(?:[–-]\s*[≈~]?\s*([\d.,]+))?\s*(triệu|tr)\s*(?:đồng|đ)?\s*\/\s*năm`, 'gi'))];
  if (yearly.length === 1) { const found = range(yearly[0] as RegExpExecArray, 2, 'year'); if (found) return found; }
  const total = new RegExp(String.raw`tổng học phí[^:\n]*?(?:(\d+)\s*năm)?[^:\n]*:\s*(?:khoảng\s*)?[≈~]?\s*${MONEY}`, 'i').exec(text);
  if (total) {
    // nhóm 1 là số năm, các nhóm sau là số tiền: dựng lại theo thứ tự của range()
    const years = total[1] ? Number(total[1]) : studyYears;
    if (years && years > 0 && years <= 8) {
      const shifted = [total[0], total[2], total[3], total[4]] as unknown as RegExpExecArray;
      const found = range(shifted, years * 2, 'total');
      if (found) return found;
    }
  }
  return null;
}

function parseStudyYears(text: string | null): number | null {
  const match = text ? /số năm đào tạo:\s*(\d+(?:[.,]\d+)?)/i.exec(text) : null;
  const value = match ? numberFromVietnamese(match[1]) : NaN;
  return Number.isFinite(value) && value > 0 && value <= 8 ? value : null;
}
