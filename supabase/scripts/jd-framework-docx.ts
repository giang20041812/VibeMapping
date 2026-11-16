/**
 * Đọc file KHUNG JD (Word) thành khung JD theo cấp có cấu trúc.
 *
 * File gồm nhiều khung nối tiếp (Intern, Fresher, Junior, Middle, Senior, Lead BA, BA Manager, PO/PM,
 * Solution Architect, Project Manager). Mỗi khung có cùng bộ mục đánh số ở Heading 2:
 *   1 Thông tin chung · 2 Nhiệm vụ · 3 Đầu ra & stakeholder · 4 Yêu cầu ứng viên · 5 Quyền lợi, thu nhập, career path
 *   6 Evidence hành vi · 7 Biến thể theo ngành · (8 Biến thể theo mô hình công ty)
 * Bố cục bảng lệch nhau giữa các khung nên cột được nhận theo tên tiêu đề, không theo vị trí.
 * Số thứ tự mục, "Bảng x", "Nguồn: …" và số tin "(x/y)" không đưa vào nội dung (số tin lưu riêng ở jd_hits/jd_total).
 */
import { promises as fs } from 'node:fs';
import JSZip from 'jszip';

export type FrameworkSection =
  | 'task' | 'output' | 'stakeholder'
  | 'knowledge' | 'professional_skill' | 'soft_skill' | 'tool' | 'education' | 'certificate'
  | 'experience' | 'language' | 'special_requirement'
  | 'benefit' | 'salary' | 'competency' | 'industry_variant' | 'company_variant' | 'career_move'
  | 'pass_threshold' | 'interview_question';
export type Tier = 'required' | 'common' | 'advantage';

export interface FrameworkItem {
  section: FrameworkSection;
  tier: Tier | null;
  group_label: string | null;
  content: string;
  detail: string | null;
  note: string | null;
  salary_min: number | null;
  salary_max: number | null;
  target_career_code: string | null;
  target_level: number | null;
  jd_hits: number | null;
  jd_total: number | null;
  is_estimate: boolean;
}

export interface ParsedFramework {
  key: string;
  career_code: string;
  career_level: number;
  level_name: string;
  title_variants: string | null;
  reports_to: string | null;
  hiring_industries: string | null;
  experience_text: string | null;
  work_mode: string | null;
  career_summary: string | null;
  position_objectives: string | null;
  required_level: number | null;
  jd_count: number;
  source_note: string;
  items: FrameworkItem[];
}

export const CAREER_CODES = {
  ba: 'G1-01:chuyen-vien-phan-tich-nghiep-vu',
  productOwner: 'G1-01:chu-so-huu-san-pham',
  productManager: 'G1-01:quan-ly-san-pham',
  solutionArchitect: 'G1-01:kien-truc-su-giai-phap',
  projectManager: 'G1-01:quan-ly-du-an-cong-nghe-thong-tin',
} as const;

interface FrameworkDefinition {
  key: string;
  /** Đoạn văn mở đầu khung (so khớp sau khi bỏ dấu, chữ thường) */
  start: RegExp;
  career_code: string;
  career_level: number;
  level_name: string;
  /** Số tin làm căn cứ, theo phần "Cơ sở xây dựng khung" của từng khung (Intern lấy theo sheet Intern) */
  jd_count: number;
}

const DEFINITIONS: FrameworkDefinition[] = [
  { key: 'intern', start: /^khung jd chung - intern business analyst/, career_code: CAREER_CODES.ba, career_level: 0, level_name: 'Thực tập sinh', jd_count: 29 },
  { key: 'fresher', start: /^vi tri fresher business analyst/, career_code: CAREER_CODES.ba, career_level: 1, level_name: 'Fresher', jd_count: 42 },
  { key: 'junior', start: /^junior business analyst$/, career_code: CAREER_CODES.ba, career_level: 2, level_name: 'Junior', jd_count: 29 },
  { key: 'middle', start: /^khung mo ta cong viec chung - chuyen vien phan tich nghiep vu cap trung/, career_code: CAREER_CODES.ba, career_level: 3, level_name: 'Middle', jd_count: 58 },
  { key: 'senior', start: /^khung jd chung - senior business analyst/, career_code: CAREER_CODES.ba, career_level: 4, level_name: 'Senior', jd_count: 48 },
  { key: 'above_senior', start: /^khung jd chung - cac vi tri tren senior ba/, career_code: '', career_level: -1, level_name: '', jd_count: 0 },
  { key: 'lead', start: /^khung jd chung - lead business analyst/, career_code: CAREER_CODES.ba, career_level: 5, level_name: 'Trưởng nhóm', jd_count: 10 },
  { key: 'manager', start: /^khung jd chung - business analyst manager/, career_code: CAREER_CODES.ba, career_level: 6, level_name: 'Quản lý', jd_count: 6 },
  { key: 'product', start: /^khung jd chung - product owner \/ product manager/, career_code: CAREER_CODES.productOwner, career_level: 4, level_name: 'Senior', jd_count: 13 },
  { key: 'solution', start: /^khung jd chung - solution architect/, career_code: CAREER_CODES.solutionArchitect, career_level: 4, level_name: 'Senior', jd_count: 12 },
  { key: 'project', start: /^khung jd chung - project manager/, career_code: CAREER_CODES.projectManager, career_level: 4, level_name: 'Senior', jd_count: 11 },
];

// ---------------------------------------------------------------- đọc XML của Word
type Block = { kind: 'p'; style: string; text: string } | { kind: 'table'; rows: string[][] };

const decode = (text: string) =>
  text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function paragraphText(xml: string): string {
  let out = '';
  for (const m of xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:(?:br|cr)\b[^>]*\/>/g)) {
    if (m[0].startsWith('<w:tab')) out += '\t';
    else if (m[1] === undefined) out += '\n';
    else out += decode(m[1]);
  }
  return out.replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

async function readBlocks(file: string): Promise<Block[]> {
  const zip = await JSZip.loadAsync(await fs.readFile(file));
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) throw new Error(`${file}: không phải file Word (.docx)`);
  const stylesXml = (await zip.file('word/styles.xml')?.async('string')) ?? '';
  const styleNames = new Map<string, string>();
  for (const m of stylesXml.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>[\s\S]*?<w:name w:val="([^"]+)"/g)) styleNames.set(m[1], m[2].toLowerCase());

  const body = documentXml.slice(documentXml.indexOf('<w:body>'), documentXml.lastIndexOf('</w:body>'));
  const blocks: Block[] = [];
  for (const m of body.matchAll(/<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:tbl>[\s\S]*?<\/w:tbl>/g)) {
    const xml = m[0];
    if (xml.startsWith('<w:tbl>')) {
      const rows: string[][] = [];
      for (const tr of xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)) {
        const cells: string[] = [];
        for (const tc of tr[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)) {
          const lines = [...tc[0].matchAll(/<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map((p) => paragraphText(p[0])).filter(Boolean);
          cells.push(lines.join('\n'));
        }
        if (cells.some(Boolean)) rows.push(cells);
      }
      if (rows.length > 0) blocks.push({ kind: 'table', rows });
    } else {
      const styleId = /<w:pStyle w:val="([^"]+)"/.exec(xml)?.[1] ?? '';
      const text = paragraphText(xml);
      if (text) blocks.push({ kind: 'p', style: styleNames.get(styleId) ?? styleId.toLowerCase(), text });
    }
  }
  return blocks;
}

// ---------------------------------------------------------------- tiện ích chữ
export const fold = (text: string) =>
  text.replace(/\s+/g, ' ').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
    .replace(/[–—]/g, '-').replace(/\s*-\s*/g, ' - ');

const collapse = (text: string) => text.replace(/[ \t]+/g, ' ').trim();
/** Ô nhiều dòng thành một dòng: bỏ gạch đầu dòng từng dòng rồi nối bằng dấu cách */
const oneLine = (text: string) => text.split('\n').map((line) => stripNumbering(line)).filter(Boolean).join(' ');
/** Bỏ số thứ tự mục ở đầu ("1.", "2.4.", "a)", "•", "-") */
const stripNumbering = (text: string) => collapse(text.replace(/^\s*(?:\d+(?:\.\d+)*\.\s+|[a-zđ]\)\s+|[•\-–]\s*)/i, ''));
const isNoise = (text: string) => /^(bảng \d+\.|nguồn:|mục lục)/i.test(text.trim());

/** "(36/42)", "(16/42 tin)", "Bắt buộc (38/42)" -> số tin; bỏ cụm số tin khỏi chữ */
function extractHits(text: string): { text: string; hits: number | null; total: number | null } {
  let hits: number | null = null;
  let total: number | null = null;
  const cleaned = text
    .replace(/\s*\((\d+)\s*\/\s*(\d+)(?:\s*tin)?[^()]*\)/g, (_all, a: string, b: string) => {
      if (hits === null) { hits = Number(a); total = Number(b); }
      return '';
    })
    // "(100% tin)", "(85%–100% tin)", "(62%)": tỷ lệ của bộ dữ liệu, không phải nội dung nghề
    .replace(/\s*\(\d+(?:[.,]\d+)?%[^()]*\)/g, '');
  return { text: collapse(cleaned), hits, total };
}

const isEstimate = (text: string) => /ước tính/i.test(text);

function tierOf(text: string): Tier | null {
  const f = fold(text);
  if (/bat buoc|cot loi|theo luat|theo quy dinh/.test(f)) return 'required';
  if (/thuong gap/.test(f)) return 'common';
  if (/loi the/.test(f)) return 'advantage';
  return null;
}

function item(section: FrameworkSection, content: string, extra: Partial<FrameworkItem> = {}): FrameworkItem | null {
  const { text, hits, total } = extractHits(content);
  const body = stripNumbering(text);
  if (!body || body === '–' || body === '-') return null;
  // "Không có công cụ chung bắt buộc", "Không yêu cầu chứng chỉ BA" ở cột Bắt buộc không phải là một yêu cầu
  if (extra.tier === 'required' && /^không (có|yêu cầu|bắt buộc)/i.test(body)) return null;
  return {
    section, tier: null, group_label: null, content: body, detail: null, note: null,
    salary_min: null, salary_max: null, target_career_code: null, target_level: null,
    jd_hits: hits, jd_total: total, is_estimate: isEstimate(content), ...extra,
  };
}

/** Một ô bảng có thể chứa nhiều ý: tách theo dòng, "•" và ";" */
function splitItems(cell: string): string[] {
  return cell.split(/\n|•|;(?![^()]*\))/).map((part) => stripNumbering(part)).filter((part) => part && part !== '–' && part !== '-');
}

const headerIndex = (header: string[], pattern: RegExp) => header.findIndex((cell) => pattern.test(fold(cell)));

/** "2,5–10", "15 – 25 triệu", "Không lương - 3.000.000 VNĐ", "tới 30 triệu" -> triệu đồng/tháng */
export function parseSalaryRange(text: string): { min: number | null; max: number | null } {
  if (/usd/i.test(text)) return { min: null, max: null };
  const toMillion = (raw: string) => {
    const normalized = /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw.replace(',', '.');
    const value = Number(normalized);
    if (!Number.isFinite(value)) return null;
    return value >= 1000 ? value / 1_000_000 : value;
  };
  const zeroStart = /không lương/i.test(text);
  if (zeroStart && !/\d\s*(?:–|-|đến)\s*\d/.test(text)) {
    const only = /(\d[\d.,]*)/.exec(text);
    return { min: 0, max: only ? toMillion(only[1]) : null };
  }
  const range = /(\d[\d.,]*)\s*(?:–|-|đến)\s*(\d[\d.,]*)/.exec(text);
  if (range) return { min: zeroStart ? 0 : toMillion(range[1]), max: toMillion(range[2]) };
  const single = /(?:tới|tối đa|đến|tới mức)\s*(\d[\d.,]*)/i.exec(text);
  if (single) return { min: zeroStart ? 0 : null, max: toMillion(single[1]) };
  const from = /từ\s*(\d[\d.,]*)/i.exec(text);
  if (from) return { min: toMillion(from[1]), max: null };
  return { min: null, max: null };
}

/** Nghề đích của một hướng phát triển, nhận theo từ khóa trong chữ */
function careerMoveTarget(text: string): { code: string; level: number } | null {
  const f = fold(text);
  const matches: { code: string; level: number }[] = [];
  if (/product owner|chu so huu san pham|product manag|quan ly san pham/.test(f)) matches.push({ code: CAREER_CODES.productOwner, level: 4 });
  if (/solution architect|kien truc su giai phap/.test(f)) matches.push({ code: CAREER_CODES.solutionArchitect, level: 4 });
  if (/project manager|quan ly du an/.test(f)) matches.push({ code: CAREER_CODES.projectManager, level: 4 });
  if (/lead ba|ba lead|ba manager|lead business analyst/.test(f)) matches.push({ code: CAREER_CODES.ba, level: 5 });
  return matches.length === 1 ? matches[0] : null;
}

// ---------------------------------------------------------------- dựng khung
type SectionKey = 'basis' | 'info' | 'tasks' | 'outputs' | 'stakeholders' | 'requirements' | 'special'
  | 'benefits' | 'salary' | 'path' | 'competency' | 'industry' | 'company' | 'skip';

function sectionOf(heading: string): SectionKey {
  const f = fold(stripNumbering(heading));
  if (/^thong tin chung/.test(f)) return 'info';
  if (/^nhiem vu/.test(f)) return 'tasks';
  if (/^ket qua dau ra/.test(f)) return 'outputs';
  if (/^yeu cau ung vien/.test(f)) return 'requirements';
  if (/^quyen loi/.test(f)) return 'benefits';
  if (/^evidence|^tieu chi danh gia/.test(f)) return 'competency';
  if (/^bien the theo mo hinh/.test(f)) return 'company';
  if (/^bien the/.test(f)) return 'industry';
  return 'skip';
}

function subsectionOf(heading: string, parent: SectionKey): SectionKey {
  const f = fold(stripNumbering(heading));
  if (/^ket qua dau ra/.test(f)) return 'outputs';
  if (/^stakeholder/.test(f)) return 'stakeholders';
  if (/^quyen loi/.test(f)) return 'benefits';
  if (/^thu nhap/.test(f)) return 'salary';
  if (/^career path|^lo trinh/.test(f)) return 'path';
  if (/^yeu cau dac thu/.test(f)) return 'special';
  if (/^bang phan loai yeu cau/.test(f)) return 'requirements';
  if (parent === 'competency') return 'competency';
  if (/^phan \d/.test(f)) return 'skip';
  return parent;
}

class Builder {
  readonly fw: ParsedFramework;
  private objectives: string[] = [];
  private summaryParts: string[] = [];
  private infoMode: 'none' | 'summary' | 'objectives' = 'none';
  private basis: string[] = [];

  constructor(def: FrameworkDefinition) {
    this.fw = {
      key: def.key, career_code: def.career_code, career_level: def.career_level, level_name: def.level_name,
      title_variants: null, reports_to: null, hiring_industries: null, experience_text: null, work_mode: null,
      career_summary: null, position_objectives: null, required_level: null, jd_count: def.jd_count,
      source_note: '', items: [],
    };
  }

  private push(entry: FrameworkItem | null) {
    if (entry) this.fw.items.push(entry);
  }

  paragraph(section: SectionKey, text: string) {
    if (isNoise(text)) return;
    switch (section) {
      case 'basis': this.basis.push(text); break;
      case 'info': this.infoParagraph(text); break;
      case 'outputs':
        for (const line of text.split('\n')) if (!line.trim().endsWith(':')) this.push(item('output', line));
        break;
      case 'special':
        if (!text.trim().endsWith(':')) this.push(item('special_requirement', text, { tier: 'common' }));
        break;
      case 'benefits': this.benefitParagraph(text); break;
      case 'path':
        for (const line of text.split('\n')) this.pathLine(line);
        break;
      case 'competency': this.competencyText(text); break;
      default: break;
    }
  }

  private infoParagraph(text: string) {
    for (const line of text.split('\n')) {
      const f = fold(line);
      if (f.startsWith('tom tat nghe nghiep')) {
        this.infoMode = 'summary';
        const rest = line.replace(/^[^:]*:\s*/, '');
        if (rest) this.summaryParts.push(rest);
      } else if (f.startsWith('muc tieu vi tri')) {
        this.infoMode = 'objectives';
        const rest = line.replace(/^[^:]*:\s*/, '');
        if (rest) this.objectives.push(stripNumbering(rest));
      } else if (this.infoMode === 'objectives' || /^[a-z]\)\s|^-\s/i.test(line)) {
        if (!line.trim().endsWith(':')) this.objectives.push(stripNumbering(line));
      } else if (this.infoMode === 'summary' || this.summaryParts.length === 0) {
        if (!line.trim().endsWith(':')) this.summaryParts.push(line);
        else if (line.length > 120) {
          // "… Từ các JD, có thể tóm lại bốn mục tiêu như sau:" -> giữ phần mô tả, các dòng sau là mục tiêu
          this.summaryParts.push(line.slice(0, line.lastIndexOf('. ') + 1));
          this.infoMode = 'objectives';
        }
      }
    }
  }

  private benefitParagraph(text: string) {
    for (const line of text.split('\n')) {
      const label = /^([^:]{2,60}):\s*(.+)$/.exec(line.trim());
      const prefix = label ? fold(label[1]) : '';
      let tier: Tier = 'common';
      let content = line;
      if (/theo (quy dinh )?(luat|phap luat)|che do theo quy dinh|theo luat/.test(prefix)) { tier = 'required'; content = label![2]; }
      else if (/^thuong gap|quyen loi co the/.test(prefix)) { tier = 'common'; content = label![2]; }
      else if (/^loi the/.test(prefix)) { tier = 'advantage'; content = label![2]; }
      this.push(item('benefit', content, { tier }));
    }
  }

  private pathLine(line: string) {
    const text = stripNumbering(line);
    if (!text || text.endsWith(':') || (/sau đây|như sau|theo một trong/i.test(text) && !text.includes(':'))) return;
    const colon = text.indexOf(':');
    const group = colon > 0 && colon < 140 ? text.slice(0, colon).trim() : null;
    const content = group ? text.slice(colon + 1).trim() : text;
    const target = careerMoveTarget(group ?? content);
    this.push(item('career_move', content || text, {
      group_label: group, target_career_code: target?.code ?? null, target_level: target?.level ?? null,
    }));
  }

  private competencyText(text: string) {
    for (const raw of text.split('\n')) {
      const line = stripNumbering(raw);
      const f = fold(line);
      // Dòng tiêu đề kiểu "Ngưỡng đạt … & Câu hỏi phỏng vấn gợi ý" không có nội dung
      if (!line.includes(':') && line.length < 120) continue;
      const questionAt = f.indexOf('cau hoi phong van');
      if (f.startsWith('nguong dat')) {
        const threshold = questionAt > 0 ? line.slice(0, questionAt) : line;
        this.push(item('pass_threshold', threshold.replace(/^[^:]*:\s*/, (m) => (m.length < 60 ? '' : m))));
      }
      if (questionAt >= 0) {
        const question = line.slice(questionAt).replace(/^[^:]*:\s*/, '');
        this.push(item('interview_question', question));
      }
    }
  }

  table(section: SectionKey, rows: string[][]) {
    const header = rows[0];
    const body = rows.slice(1);
    switch (section) {
      case 'info': this.infoTable(rows); break;
      case 'tasks': this.taskTable(header, body); break;
      case 'stakeholders': this.stakeholderTable(header, body); break;
      case 'requirements': this.requirementTable(header, body); break;
      case 'salary': this.salaryTable(header, body); break;
      case 'competency':
        if (header.length === 1) for (const row of rows) this.competencyText(row[0]);
        else this.competencyTable(header, body);
        break;
      case 'industry': this.variantTable('industry_variant', body); break;
      case 'company': this.variantTable('company_variant', body); break;
      default: break;
    }
  }

  private infoTable(rows: string[][]) {
    for (const [label = '', value = ''] of rows) {
      const f = fold(label);
      const text = oneLine(value);
      if (!text) continue;
      if (f.startsWith('chuc danh')) this.fw.title_variants = text;
      else if (f.startsWith('bao cao cho')) this.fw.reports_to = text;
      else if (f.startsWith('nganh tuyen')) this.fw.hiring_industries = extractHits(text).text;
      else if (f.startsWith('hinh thuc')) this.fw.work_mode = extractHits(text).text;
      else if (f.startsWith('tom tat')) this.summaryParts.push(text);
      else if (f.startsWith('muc tieu')) this.objectives.push(...value.split(/\n|(?=\s\d\)\s)/).map(stripNumbering).filter(Boolean));
      else if (f.startsWith('cap do')) {
        const level = /yeu cau\s*=\s*(\d+[,.]\d+)/.exec(fold(value));
        if (level) this.fw.required_level = Number(level[1].replace(',', '.'));
      }
    }
  }

  private taskTable(header: string[], body: string[][]) {
    const cGroup = headerIndex(header, /nhom nhiem vu/);
    const cTask = headerIndex(header, /^nhiem vu chinh/);
    const cActivity = headerIndex(header, /hoat dong/);
    const cTier = headerIndex(header, /^muc/);
    if (cTask < 0) return;
    for (const row of body) {
      const tierText = cTier >= 0 ? row[cTier] ?? '' : '';
      const hits = extractHits(tierText);
      this.push(item('task', row[cTask] ?? '', {
        group_label: cGroup >= 0 ? stripNumbering(row[cGroup] ?? '') || null : null,
        detail: cActivity >= 0 ? collapse((row[cActivity] ?? '').replace(/\n/g, ' ')) || null : null,
        tier: tierOf(tierText),
        jd_hits: hits.hits, jd_total: hits.total,
      }));
    }
  }

  private stakeholderTable(header: string[], body: string[][]) {
    for (const row of body) {
      if (header.length >= 3) {
        this.push(item('stakeholder', row[1] || row[0], { group_label: stripNumbering(row[0] ?? '') || null, detail: collapse(row[2] ?? '') || null }));
      } else {
        this.push(item('stakeholder', row[0] ?? '', { detail: collapse(row[1] ?? '') || null }));
      }
    }
  }

  private requirementTable(header: string[], body: string[][]) {
    if (!/^muc/.test(fold(header[0] ?? ''))) return;
    const tiers = header.map((cell, index) => (index === 0 ? null : tierOf(cell)));
    const sectionByLabel: [RegExp, FrameworkSection][] = [
      [/^kien thuc/, 'knowledge'], [/^ky nang chuyen mon/, 'professional_skill'], [/^ky nang mem/, 'soft_skill'],
      [/^cong cu/, 'tool'], [/^hoc van/, 'education'], [/^chung chi/, 'certificate'], [/^kinh nghiem/, 'experience'],
      [/^ngoai ngu/, 'language'], [/^yeu cau dac thu/, 'special_requirement'],
    ];
    for (const row of body) {
      const label = fold(row[0] ?? '');
      const section = sectionByLabel.find(([pattern]) => pattern.test(label))?.[1];
      if (!section) continue;
      for (let c = 1; c < row.length; c += 1) {
        const tier = tiers[c];
        if (!tier) continue;
        for (const part of splitItems(row[c] ?? '')) this.push(item(section, part, { tier }));
        if (section === 'experience' && tier === 'required' && !this.fw.experience_text) {
          this.fw.experience_text = extractHits(splitItems(row[c] ?? '')[0] ?? '').text || null;
        }
      }
    }
  }

  private salaryTable(header: string[], body: string[][]) {
    const cRange = Math.max(headerIndex(header, /gross|tro cap|truoc thue|khoang thu nhap/), 1);
    const cNet = headerIndex(header, /net|thuc nhan/);
    const cExample = headerIndex(header, /vi du|dac diem|dien giai/);
    for (const row of body) {
      const group = oneLine(row[0] ?? '');
      const rangeText = row[cRange] ?? '';
      const { min, max } = parseSalaryRange(rangeText);
      const example = cExample >= 0 ? collapse((row[cExample] ?? '').replace(/\n/g, ' ')) : '';
      this.push(item('salary', example || collapse(rangeText) || group, {
        group_label: group || null,
        detail: cNet >= 0 && cNet !== cRange ? collapse(row[cNet] ?? '') || null : null,
        note: collapse(rangeText.replace(/\n/g, ' ')) || null,
        salary_min: min, salary_max: max,
      }));
    }
  }

  private competencyTable(header: string[], body: string[][]) {
    const cEvidence = headerIndex(header, /evidence|bang chung/);
    if (cEvidence < 0) return;
    const cRequired = headerIndex(header, /required|muc yeu cau|chuan muc tieu/);
    const cBelow = headerIndex(header, /duoi chuan/);
    const cBasis = headerIndex(header, /can cu/);
    for (const row of body) {
      const basis = cBasis >= 0 ? extractHits(`(${row[cBasis] ?? ''})`) : { hits: null, total: null };
      this.push(item('competency', cRequired >= 0 ? row[cRequired] ?? '' : row[cEvidence] ?? '', {
        group_label: stripNumbering(row[0] ?? '') || null,
        detail: collapse((row[cEvidence] ?? '').replace(/\n/g, ' ')) || null,
        note: cBelow >= 0 ? collapse(row[cBelow] ?? '') || null : null,
        jd_hits: basis.hits, jd_total: basis.total,
      }));
    }
  }

  private variantTable(section: 'industry_variant' | 'company_variant', body: string[][]) {
    for (const row of body) {
      const label = extractHits(stripNumbering((row[0] ?? '').split('\n')[0]));
      const content = collapse((row[1] ?? '').replace(/\n/g, ' ')) || collapse((row[2] ?? '').replace(/\n/g, ' '));
      if (!content) continue;
      const entry = item(section, content, {
        group_label: label.text || null,
        detail: collapse((row[2] ?? '').replace(/\n/g, ' ')) || null,
        note: collapse((row[3] ?? '').replace(/\n/g, ' ')) || null,
      });
      if (entry) {
        entry.jd_hits = label.hits;
        entry.jd_total = label.total;
      }
      this.push(entry);
    }
  }

  finish(): ParsedFramework {
    this.fw.career_summary = this.summaryParts.map(collapse).filter(Boolean).join(' ') || null;
    this.fw.position_objectives = this.objectives.filter(Boolean).join('\n') || null;
    this.fw.source_note = ['Nạp từ KHUNG JD.docx', ...this.basis].join('\n');
    return this.fw;
  }
}

export async function parseFrameworkDocx(file: string): Promise<{ frameworks: ParsedFramework[]; warnings: string[] }> {
  const blocks = await readBlocks(file);
  const warnings: string[] = [];

  // Vị trí bắt đầu của từng khung theo thứ tự
  const starts: { def: FrameworkDefinition; index: number }[] = [];
  let from = 0;
  for (const def of DEFINITIONS) {
    const index = blocks.findIndex((block, i) => i >= from && block.kind === 'p' && def.start.test(fold(block.text)));
    if (index < 0) {
      warnings.push(`Không thấy khung "${def.key}" trong file`);
      continue;
    }
    starts.push({ def, index });
    from = index + 1;
  }

  const frameworks: ParsedFramework[] = [];
  for (const [n, { def, index }] of starts.entries()) {
    if (def.career_level < 0) continue;
    const end = starts[n + 1]?.index ?? blocks.length;
    const builder = new Builder(def);
    let section: SectionKey = 'skip';
    let parent: SectionKey = 'skip';
    for (const block of blocks.slice(index + 1, end)) {
      if (block.kind === 'p') {
        const f = fold(block.text);
        if (block.style === 'heading 1' || /^[a-d]\.\s+[a-z]/.test(f) && /^(co so|cau truc|khung|chi tiet|muc luc|noi dung|luu y)/.test(f.slice(3))) {
          section = /^a\.\s+co so/.test(f) ? 'basis' : 'skip';
          parent = section;
          continue;
        }
        if (block.style === 'heading 2') {
          parent = sectionOf(block.text);
          section = parent;
          continue;
        }
        if (block.style === 'heading 3') {
          section = subsectionOf(block.text, parent);
          continue;
        }
        builder.paragraph(section, block.text);
      } else {
        builder.table(section, block.rows);
      }
    }
    const fw = builder.finish();
    const count = (s: FrameworkSection) => fw.items.filter((i) => i.section === s).length;
    if (count('task') === 0) warnings.push(`Khung ${def.key}: không đọc được nhiệm vụ`);
    if (count('salary') === 0) warnings.push(`Khung ${def.key}: không đọc được thu nhập`);
    if (count('competency') === 0) warnings.push(`Khung ${def.key}: không đọc được biểu hiện năng lực`);
    frameworks.push(fw);
  }
  return { frameworks, warnings };
}
