/**
 * Nạp JD nghiên cứu theo cấp và khung JD theo cấp của nhóm nghề Phân tích nghiệp vụ.
 *
 *   RESEARCH JOB BA.xlsx  -> career_job_descriptions (khóa source_key, cấp độ L0–L6)
 *   KHUNG JD.docx         -> career_level_frameworks + career_level_framework_items
 *
 * Chạy:   npm run import:jd-frameworks:dry                      (chỉ đọc, in báo cáo)
 *         npm run import:jd-frameworks                          (ghi cả hai bước)
 *         npm run import:jd-frameworks -- --step jds            (chỉ JD) | --step frameworks (chỉ khung)
 * Tùy chọn: --excel <file> --docx <file>
 *           --json-out <file>  ghi khung đọc được ra JSON để BA soát
 *           --json-in <file>   nạp khung từ JSON đã soát thay cho docx
 *           --publish          công bố khung vừa nạp (mặc định để Nháp cho quản trị duyệt)
 *
 * Quy tắc:
 *   - Sheet Intern/Fresher/Junior/Middle/Senior thuộc nghề Chuyên viên Phân tích nghiệp vụ, cấp theo tên sheet (L0–L4).
 *   - Sheet "Trên senior": nghề theo cột "Chức danh nghề nghiệp" (Trưởng nhóm / Quản lý Phân tích nghiệp vụ vẫn là nghề
 *     Phân tích nghiệp vụ ở L5/L6; Chủ sở hữu sản phẩm, Quản lý sản phẩm, Kiến trúc sư giải pháp, Quản lý dự án CNTT là
 *     nghề riêng ở L4, L5 nếu chức danh tuyển là Lead/Head). Ô ghép hai cấp lấy cấp thấp hơn.
 *   - Một tin = một link JD (bỏ tham số truy vấn); không có link thì công ty + vị trí. Tin trùng giữa các sheet giữ bản
 *     ở sheet cấp tương ứng; tin đã có trong DB từ Career_Profile (cùng nghề, cùng link) không nạp lại.
 *   - JD mới không có cột "Dimension liên quan" nên không vào ma trận Career Fit.
 *   - Khung đã được quản trị sửa (updated_by có giá trị) không bị ghi đè khi nạp lại.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CAREER_CODES, fold, parseFrameworkDocx, type ParsedFramework } from './jd-framework-docx';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, 'frontend', '.env') });

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const firstExisting = (...files: string[]) => files.find((file) => existsSync(file)) ?? files[0];

const EXCEL_FILE = option('--excel') ?? firstExisting(path.join(repoRoot, 'RESEARCH JOB BA.xlsx'), path.join(repoRoot, 'TEAM BA', 'RESEARCH JOB BA.xlsx'));
const DOCX_FILE = option('--docx') ?? firstExisting(path.join(repoRoot, 'KHUNG JD.docx'), path.join(repoRoot, 'TEAM BA', 'KHUNG JD.docx'));
const SOURCE_FILE = path.basename(EXCEL_FILE);
const DRY_RUN = flag('--dry-run');
const PUBLISH = flag('--publish');
const STEPS = ['jds', 'frameworks'] as const;
type Step = (typeof STEPS)[number];
const selectedSteps: Step[] = option('--step') ? (option('--step')!.split(',') as Step[]) : [...STEPS];

type Row = Record<string, unknown>;
const warnings: string[] = [];
const warn = (message: string) => warnings.push(message);

// ---------------------------------------------------------------- đọc Excel
function valueText(value: unknown): string {
  if (value === null || value === undefined || value instanceof Date) return '';
  if (typeof value !== 'object') return String(value).trim();
  const v = value as Record<string, unknown>;
  if (Array.isArray(v.richText)) return (v.richText as { text: string }[]).map((part) => part.text).join('').trim();
  if (v.result !== undefined) return valueText(v.result);
  if (v.hyperlink && typeof v.text !== 'string') return String(v.hyperlink).trim();
  if (v.text !== undefined) return valueText(v.text);
  return '';
}
const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();
const clean = (text: string) => (/^(cần research|n ?\/ ?a|#n\/a|none)$/i.test(text.trim()) ? '' : text.trim());
const orNull = (text: string) => (text ? text : null);

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

/** Sheet theo cấp: nghề Phân tích nghiệp vụ, cấp theo tên sheet. Đọc trước "Trên senior" để tin trùng giữ ở đây. */
const LEVEL_SHEETS: [string, number][] = [['Intern', 0], ['Fresher', 1], ['Junior', 2], ['Middle', 3], ['Senior', 4]];
const ABOVE_SENIOR_SHEET = 'Trên senior';

/** "Middle/Senior" -> 3, "Senior BA / Lead BA" -> 4, "BA Manager" -> 6 */
export function parseLevelText(raw: string): number | null {
  const f = fold(raw);
  const levels: number[] = [];
  if (/thuc tap|intern/.test(f)) levels.push(0);
  if (/fresher/.test(f)) levels.push(1);
  if (/junior/.test(f)) levels.push(2);
  if (/middle|trung cap/.test(f)) levels.push(3);
  if (/senior/.test(f)) levels.push(4);
  if (/lead|truong nhom/.test(f)) levels.push(5);
  if (/manager|quan ly|head/.test(f)) levels.push(6);
  return levels.length ? Math.min(...levels) : null;
}

/** Nghề theo cột "Chức danh nghề nghiệp" của sheet "Trên senior" */
function careerOfTitle(title: string): string | null {
  const f = fold(title);
  if (/phan tich nghiep vu/.test(f)) return CAREER_CODES.ba;
  if (/chu so huu san pham/.test(f)) return CAREER_CODES.productOwner;
  if (/quan ly san pham/.test(f)) return CAREER_CODES.productManager;
  if (/kien truc su giai phap/.test(f)) return CAREER_CODES.solutionArchitect;
  if (/quan ly du an/.test(f)) return CAREER_CODES.projectManager;
  return null;
}

/** Ô số 1–5 giữ nguyên; "1/5 – …", "1–2/5" lấy số đầu; chữ, ngày (Excel tự đổi "3.5") thì để trống */
function parseRequiredLevel(raw: string): number | null {
  const text = raw.trim();
  const numeric = /^(\d+(?:[.,]\d+)?)$/.exec(text) ?? /^(\d+(?:[.,]\d+)?)\s*(?:[–-]\s*\d+(?:[.,]\d+)?)?\s*\/\s*5/.exec(text);
  if (!numeric) return null;
  const value = Number(numeric[1].replace(',', '.'));
  return value >= 1 && value <= 5 ? value : null;
}

function isoDate(day: string, month: string, year: string): string | null {
  const d = Number(day), m = Number(month), y = Number(year);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 2000 || date.getTime() > Date.now()) return null;
  return date.toISOString().slice(0, 10);
}

/** Như import-phase2-data: ngày "kiểm tra / research / cập nhật / truy cập" trước, không có thì ngày "đăng" */
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

/** Khóa một tin: link JD bỏ giao thức, www, tham số; không có link thì công ty + vị trí */
function jdIdentity(url: string | null, company: string, title: string): string {
  if (url && /^https?:\/\//i.test(url)) {
    return url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  }
  return `${fold(company)}|${fold(title)}`;
}

interface JdRow {
  source_key: string;
  identity: string;
  sheet: string;
  row: number;
  career_code: string;
  career_level: number;
  career_level_raw: string | null;
  required_level_raw: string | null;
  required_level: number | null;
  jd_code: string | null;
  checked_at: string | null;
  checked_kind: 'checked' | 'posted' | null;
  text: Row;
}

async function readJobDescriptions(): Promise<{ rows: JdRow[]; duplicates: Map<string, number> }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE);
  const rows: JdRow[] = [];
  const seen = new Set<string>();
  const duplicates = new Map<string, number>();

  const sheets: [string, number | null][] = [...LEVEL_SHEETS, [ABOVE_SENIOR_SHEET, null]];
  for (const [sheetName, sheetLevel] of sheets) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      warn(`Không thấy sheet "${sheetName}"`);
      continue;
    }
    const labels: [string, number][] = [];
    sheet.getRow(1).eachCell((cell, col) => labels.push([collapse(valueText(cell.value)).toLowerCase(), col]));
    const col = (prefix: string) => labels.find(([label]) => label.startsWith(prefix.toLowerCase()))?.[1] ?? 0;
    const need = (label: string) => {
      const index = col(label);
      if (!index) throw new Error(`${SOURCE_FILE} / ${sheetName}: thiếu cột "${label}"`);
      return index;
    };
    const cTitle = need('Chức danh nghề nghiệp'), cLevel = need('Cấp độ nghề'), cJd = need('JD ID'), cRequired = need('Required Level');
    const textCols = JD_TEXT_COLUMNS.map(([field, label]) => [field, need(label)] as const);

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const text: Row = {};
      for (const [field, index] of textCols) text[field] = orNull(clean(valueText(row.getCell(index).value)));
      const company = (text.company_name as string | null) ?? '';
      const jobTitle = (text.job_title as string | null) ?? '';
      if (!company && !jobTitle) return;

      const levelRaw = collapse(valueText(row.getCell(cLevel).value));
      let careerCode: string | null = CAREER_CODES.ba;
      let level: number | null = sheetLevel;
      if (sheetLevel === null) {
        careerCode = careerOfTitle(valueText(row.getCell(cTitle).value));
        if (careerCode === CAREER_CODES.ba) level = parseLevelText(levelRaw);
        else if (careerCode) level = /\b(lead|head|principal)\b|truong/.test(fold(jobTitle)) ? 5 : 4;
      }
      if (!careerCode || level === null) {
        warn(`${sheetName} dòng ${rowNumber}: không xác định được nghề/cấp (${valueText(row.getCell(cTitle).value)} – ${levelRaw}), bỏ qua`);
        return;
      }

      const identity = jdIdentity(text.jd_url as string | null, company, jobTitle);
      if (seen.has(identity)) {
        duplicates.set(sheetName, (duplicates.get(sheetName) ?? 0) + 1);
        return;
      }
      seen.add(identity);
      const requiredRaw = collapse(valueText(row.getCell(cRequired).value));
      const checked = parseCheckedDate(text.data_source as string | null);
      rows.push({
        source_key: `rjba:${createHash('sha1').update(identity).digest('hex').slice(0, 20)}`,
        identity, sheet: sheetName, row: rowNumber, career_code: careerCode, career_level: level,
        career_level_raw: orNull(levelRaw || sheetName),
        required_level_raw: orNull(requiredRaw), required_level: parseRequiredLevel(requiredRaw),
        jd_code: orNull(clean(valueText(row.getCell(cJd).value))),
        checked_at: checked.date, checked_kind: checked.kind, text,
      });
    });
  }
  return { rows, duplicates };
}

// ---------------------------------------------------------------- báo cáo
function report(jds: JdRow[], duplicates: Map<string, number>, frameworks: ParsedFramework[]) {
  console.log(`\nJD: ${jds.length} tin từ ${SOURCE_FILE}`);
  const byCareer = new Map<string, Map<number, number>>();
  for (const jd of jds) {
    const levels = byCareer.get(jd.career_code) ?? new Map<number, number>();
    levels.set(jd.career_level, (levels.get(jd.career_level) ?? 0) + 1);
    byCareer.set(jd.career_code, levels);
  }
  for (const [code, levels] of byCareer) {
    console.log(`  ${code}: ${[...levels.entries()].sort((a, b) => a[0] - b[0]).map(([l, n]) => `L${l}=${n}`).join(', ')}`);
  }
  if (duplicates.size) console.log(`  Bỏ tin trùng: ${[...duplicates.entries()].map(([sheet, n]) => `${sheet} ${n}`).join(', ')}`);
  console.log(`  Có Required Level dạng số: ${jds.filter((jd) => jd.required_level !== null).length}/${jds.length}`);
  console.log(`  Có ngày kiểm tra/đăng: ${jds.filter((jd) => jd.checked_at).length}/${jds.length}`);

  console.log(`\nKhung theo cấp: ${frameworks.length} khung từ ${path.basename(DOCX_FILE)}`);
  for (const fw of frameworks) {
    const counts = new Map<string, number>();
    for (const entry of fw.items) counts.set(entry.section, (counts.get(entry.section) ?? 0) + 1);
    const salaries = fw.items.filter((i) => i.section === 'salary' && (i.salary_min !== null || i.salary_max !== null));
    const range = salaries.length
      ? `${Math.min(...salaries.map((s) => s.salary_min ?? s.salary_max!))}–${Math.max(...salaries.map((s) => s.salary_max ?? s.salary_min!))} triệu`
      : 'lương không có khoảng số';
    console.log(`  ${fw.career_code} L${fw.career_level} ${fw.level_name}: ${fw.items.length} dòng `
      + `(nhiệm vụ ${counts.get('task') ?? 0}, năng lực ${counts.get('competency') ?? 0}, `
      + `chuyển nghề ${fw.items.filter((i) => i.target_career_code).length}/${counts.get('career_move') ?? 0} có liên kết), ${range}`
      + (fw.required_level ? `, Required Level ${fw.required_level}` : ''));
  }
  if (warnings.length) {
    console.log(`\nCảnh báo (${warnings.length}):`);
    for (const message of warnings.slice(0, 30)) console.log(`  - ${message}`);
    if (warnings.length > 30) console.log(`  ... và ${warnings.length - 30} cảnh báo khác`);
  }
}

// ---------------------------------------------------------------- ghi DB
const BATCH_SIZE = 100;

async function fetchAll(supabase: SupabaseClient, table: string, columns: string, filter?: (q: any) => any): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase.from(table).select(columns).order('id').range(from, from + 999);
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) throw new Error(`Đọc ${table}: ${error.message}`);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) return rows;
  }
}

async function careerIds(supabase: SupabaseClient, codes: string[]): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('careers').select('id, career_code').in('career_code', codes);
  if (error) throw new Error(`Đọc careers: ${error.message}`);
  return new Map((data ?? []).map((row) => [String(row.career_code), String(row.id)]));
}

async function writeJds(supabase: SupabaseClient, jds: JdRow[]) {
  const codes = [...new Set(jds.map((jd) => jd.career_code))];
  const ids = await careerIds(supabase, codes);
  const missing = codes.filter((code) => !ids.has(code));
  if (missing.length) throw new Error(`Chưa có nghề ${missing.join(', ')} trong DB: chạy import:phase2:career trước`);

  // Tin đã nạp từ Career_Profile (cùng nghề, cùng link) thì không nạp thêm bản thứ hai
  const existing = await fetchAll(supabase, 'career_job_descriptions', 'id, career_id, jd_url, company_name, job_title, source_key',
    (q) => q.in('career_id', [...ids.values()]));
  const legacy = new Set(existing.filter((row) => !row.source_key)
    .map((row) => `${row.career_id}#${jdIdentity(row.jd_url as string | null, String(row.company_name ?? ''), String(row.job_title ?? ''))}`));
  const fresh = jds.filter((jd) => !legacy.has(`${ids.get(jd.career_code)}#${jd.identity}`));
  if (fresh.length < jds.length) console.log(`  bỏ ${jds.length - fresh.length} tin đã có từ Career_Profile`);

  const rows = fresh.map((jd) => ({
    career_id: ids.get(jd.career_code), source_key: jd.source_key, source_file: SOURCE_FILE, jd_code: jd.jd_code,
    career_level_raw: jd.career_level_raw, career_level: jd.career_level,
    required_level_raw: jd.required_level_raw, required_level: jd.required_level,
    data_checked_at: jd.checked_at, data_checked_kind: jd.checked_kind, ...jd.text,
  }));
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const { error } = await supabase.from('career_job_descriptions').upsert(rows.slice(start, start + BATCH_SIZE), { onConflict: 'source_key' });
    if (error) throw new Error(`Ghi career_job_descriptions (dòng ${start + 1}): ${error.message} (đã áp migration 20261116000200 chưa?)`);
    process.stdout.write(`\r  career_job_descriptions: ${Math.min(start + BATCH_SIZE, rows.length)}/${rows.length}`);
  }
  process.stdout.write('\n');

  const stale = existing.filter((row) => String(row.source_key ?? '').startsWith('rjba:') && !fresh.some((jd) => jd.source_key === row.source_key));
  if (stale.length) console.log(`  ${stale.length} tin đã nạp trước đây không còn trong file (giữ nguyên, không xóa)`);
}

async function writeFrameworks(supabase: SupabaseClient, frameworks: ParsedFramework[]) {
  const codes = [...new Set(frameworks.flatMap((fw) => [fw.career_code, ...fw.items.map((i) => i.target_career_code).filter(Boolean) as string[]]))];
  const ids = await careerIds(supabase, codes);
  const missing = [...new Set(frameworks.map((fw) => fw.career_code))].filter((code) => !ids.has(code));
  if (missing.length) throw new Error(`Chưa có nghề ${missing.join(', ')} trong DB: chạy import:phase2:career trước`);

  let written = 0;
  for (const fw of frameworks) {
    const careerId = ids.get(fw.career_code)!;
    const { data: current, error: readError } = await supabase.from('career_level_frameworks')
      .select('id, status, updated_by').eq('career_id', careerId).eq('career_level', fw.career_level).maybeSingle();
    if (readError) throw new Error(`Đọc career_level_frameworks: ${readError.message} (đã áp migration 20261116000100 chưa?)`);
    if (current?.updated_by) {
      console.log(`  giữ nguyên ${fw.career_code} L${fw.career_level}: quản trị đã sửa`);
      continue;
    }
    const hasTask = fw.items.some((i) => i.section === 'task');
    const status = PUBLISH && hasTask ? 'published' : (current?.status ?? 'draft');
    const header = {
      career_id: careerId, career_level: fw.career_level, level_name: fw.level_name, status,
      title_variants: fw.title_variants, reports_to: fw.reports_to, hiring_industries: fw.hiring_industries,
      experience_text: fw.experience_text, work_mode: fw.work_mode, career_summary: fw.career_summary,
      position_objectives: fw.position_objectives, required_level: fw.required_level, jd_count: fw.jd_count,
      source_note: fw.source_note, ...(status === 'published' && current?.status !== 'published' ? { published_at: new Date().toISOString() } : {}),
    };
    const { data: saved, error } = await supabase.from('career_level_frameworks')
      .upsert(header, { onConflict: 'career_id,career_level' }).select('id').single();
    if (error || !saved) throw new Error(`Ghi khung ${fw.career_code} L${fw.career_level}: ${error?.message}`);

    const { error: deleteError } = await supabase.from('career_level_framework_items').delete().eq('framework_id', saved.id);
    if (deleteError) throw new Error(`Xóa dòng cũ của khung: ${deleteError.message}`);
    const items = fw.items.map((entry, index) => {
      if (entry.target_career_code && !ids.has(entry.target_career_code)) warn(`Khung ${fw.key}: chưa có nghề đích ${entry.target_career_code}`);
      const { target_career_code, ...rest } = entry;
      return { ...rest, framework_id: saved.id, target_career_id: target_career_code ? ids.get(target_career_code) ?? null : null, sort_order: index };
    });
    for (let start = 0; start < items.length; start += BATCH_SIZE) {
      const { error: insertError } = await supabase.from('career_level_framework_items').insert(items.slice(start, start + BATCH_SIZE));
      if (insertError) throw new Error(`Ghi dòng khung ${fw.career_code} L${fw.career_level}: ${insertError.message}`);
    }
    written += 1;
    console.log(`  ${fw.career_code} L${fw.career_level} ${fw.level_name}: ${items.length} dòng, ${status === 'published' ? 'đã công bố' : 'Nháp'}`);
  }
  console.log(`  ghi ${written}/${frameworks.length} khung`);
}

// ---------------------------------------------------------------- chạy
async function main() {
  for (const step of selectedSteps) if (!STEPS.includes(step)) throw new Error(`Bước không có: ${step} (chọn ${STEPS.join(', ')})`);
  const needJds = selectedSteps.includes('jds');
  const needFrameworks = selectedSteps.includes('frameworks');

  const { rows: jds, duplicates } = needJds || DRY_RUN ? await readJobDescriptions() : { rows: [], duplicates: new Map<string, number>() };
  let frameworks: ParsedFramework[] = [];
  if (needFrameworks || DRY_RUN) {
    const jsonIn = option('--json-in');
    if (jsonIn) frameworks = JSON.parse(readFileSync(jsonIn, 'utf8')) as ParsedFramework[];
    else {
      const parsed = await parseFrameworkDocx(DOCX_FILE);
      frameworks = parsed.frameworks;
      warnings.push(...parsed.warnings);
    }
    const jsonOut = option('--json-out');
    if (jsonOut) {
      writeFileSync(jsonOut, JSON.stringify(frameworks, null, 2));
      console.log(`Đã ghi khung ra ${jsonOut}`);
    }
  }
  report(jds, duplicates, frameworks);
  if (DRY_RUN) {
    console.log('\nChạy thử: chưa ghi gì vào cơ sở dữ liệu.');
    return;
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || serviceKey.includes('your_service_role_key')) {
    throw new Error('Thiếu SUPABASE_URL (hoặc VITE_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY trong .env');
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  console.log(`\nGhi vào cơ sở dữ liệu, các bước: ${selectedSteps.join(' → ')}`);
  if (needJds) await writeJds(supabase, jds);
  if (needFrameworks) await writeFrameworks(supabase, frameworks);
  console.log('Hoàn tất.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
