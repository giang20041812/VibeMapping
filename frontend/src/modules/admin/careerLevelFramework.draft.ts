/**
 * Dựng khung nháp của một bậc từ các JD cùng nghề, cùng bậc.
 * Mỗi ô JD được tách thành từng ý (dấu ; xuống dòng •, thêm dấu phẩy với công cụ và kỹ năng mềm), gộp các cách viết
 * giống nhau, đếm số tin có nêu. Từ MIN_JD_FOR_TIER tin trở lên thì xếp mức như khung BA: ≥ 40% Bắt buộc,
 * 20–40% Thường gặp, < 20% Lợi thế; ít tin hơn thì để "chưa xếp mức" cho quản trị tự xếp.
 */
import type { CareerLevelFrameworkItem, FrameworkSection, FrameworkTier } from '../career_explorer/careerLevelFramework.types';
import type { FrameworkHeaderInput, LevelJd } from './careerLevelFramework_admin.service';

export const MIN_JD_FOR_TIER = 5;
const MAX_ITEMS_PER_SECTION = 15;

const fold = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim();

const ESTIMATE = /\(?\s*ước tính\s*\)?\s*:?/gi;
const HAS_ESTIMATE = /ước tính/i;

/** Cách viết khác nhau của cùng một ý -> một khóa */
const SYNONYMS: [RegExp, string][] = [
  [/^(ms |microsoft )?(office|bo office|bo cong cu van phong)$/, 'office'],
  [/^(ms |microsoft )?excel$/, 'excel'],
  [/^(ms |microsoft )?word$/, 'word'],
  [/^(ms |microsoft )?power ?point$/, 'powerpoint'],
  [/^(ms |microsoft )?visio$/, 'visio'],
  [/^draw\.?io$/, 'drawio'],
  [/^power ?bi$/, 'power bi'],
  [/^giao tiep( tot| hieu qua)?$/, 'giao tiep'],
  [/^tu duy logic( tot)?$/, 'tu duy logic'],
  [/^(can than|ti mi|chi tiet)$/, 'can than'],
  [/^lam viec nhom( tot)?$/, 'lam viec nhom'],
];

function itemKey(text: string): string {
  const base = fold(text.replace(ESTIMATE, '')).replace(/[.;:,]+$/, '').trim();
  return SYNONYMS.find(([pattern]) => pattern.test(base))?.[1] ?? base;
}

function splitCell(text: string | null, withComma: boolean): string[] {
  if (!text) return [];
  const separators = withComma ? /;|\n|•|,(?![^()]*\))/ : /;|\n|•/;
  return text.split(separators)
    .map((part) => part
      .replace(/^\s*(?:\d+[.)]\s+|[-–]\s*)/, '')
      .replace(/\s*\((?:jd không nêu|theo jd|ước tính)[^)]*\)/gi, '')
      .trim())
    // Ô "Không yêu cầu", "JD không nêu" là chỗ trống của người nghiên cứu, không phải một yêu cầu
    .filter((part) => part.length > 1 && part.length <= 300
      && !/^(cần research|n ?\/ ?a|không (yêu cầu|bắt buộc|nêu|có|công bố)|jd không nêu)/i.test(part));
}

interface Counted { text: string; hits: number; estimate: boolean }

/** Đếm số dòng có nêu từng ý (mỗi dòng tính một lần), giữ cách viết gặp nhiều nhất */
function countItems<T>(rows: T[], pick: (row: T) => string | null, withComma = false): Counted[] {
  const groups = new Map<string, { variants: Map<string, number>; rows: Set<number>; estimates: number; total: number }>();
  rows.forEach((row, index) => {
    for (const raw of splitCell(pick(row), withComma)) {
      const key = itemKey(raw);
      if (!key) continue;
      const group = groups.get(key) ?? { variants: new Map(), rows: new Set(), estimates: 0, total: 0 };
      const clean = raw.replace(ESTIMATE, '').trim().replace(/^\p{Ll}/u, (c) => c.toUpperCase());
      group.variants.set(clean, (group.variants.get(clean) ?? 0) + 1);
      group.rows.add(index);
      group.total += 1;
      if (HAS_ESTIMATE.test(raw)) group.estimates += 1;
      groups.set(key, group);
    }
  });
  return [...groups.values()]
    .map((group) => ({
      text: [...group.variants.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0],
      hits: group.rows.size,
      estimate: group.estimates === group.total,
    }))
    .sort((a, b) => b.hits - a.hits || a.text.localeCompare(b.text, 'vi'));
}

export function tierFor(hits: number, total: number): FrameworkTier | null {
  if (total < MIN_JD_FOR_TIER) return null;
  const ratio = hits / total;
  return ratio >= 0.4 ? 'required' : ratio >= 0.2 ? 'common' : 'advantage';
}

const blankItem = (section: FrameworkSection, content: string): CareerLevelFrameworkItem => ({
  section, tier: null, group_label: null, content, detail: null, note: null, salary_min: null, salary_max: null,
  target_career_id: null, target_level: null, jd_hits: null, jd_total: null, is_estimate: false, sort_order: 0,
});

/** "Gross: 8–12 triệu/tháng", "15 - 25 triệu", "Tới 1.900 USD" -> triệu đồng/tháng (bỏ qua USD) */
export function parseSalaryText(text: string): { min: number | null; max: number | null } {
  if (/usd|\$/i.test(text)) return { min: null, max: null };
  const toMillion = (raw: string) => {
    const value = Number(/^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw.replace(',', '.'));
    if (!Number.isFinite(value)) return null;
    return value >= 1000 ? value / 1_000_000 : value;
  };
  const range = /(\d[\d.,]*)\s*(?:–|-|đến)\s*(\d[\d.,]*)\s*(?:triệu|tr\b|m\b)/i.exec(text) ?? /(\d[\d.,]*)\s*(?:–|-)\s*(\d[\d.,]*)/.exec(text);
  if (range) return { min: toMillion(range[1]), max: toMillion(range[2]) };
  const upTo = /(?:tới|tối đa|đến|up to)\s*(\d[\d.,]*)/i.exec(text);
  return upTo ? { min: null, max: toMillion(upTo[1]) } : { min: null, max: null };
}

const median = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
};

const topTexts = (values: (string | null)[], limit: number, separator: string) =>
  countItems(values, (value) => value).slice(0, limit).map((c) => c.text).join(separator);

export interface FrameworkDraft {
  header: Partial<FrameworkHeaderInput>;
  items: CareerLevelFrameworkItem[];
}

export function buildFrameworkDraft(jds: LevelJd[]): FrameworkDraft {
  const total = jds.length;
  const items: CareerLevelFrameworkItem[] = [];
  const add = (section: FrameworkSection, pick: (jd: LevelJd) => string | null, options: { withComma?: boolean; tiered?: boolean } = {}) => {
    for (const counted of countItems(jds, pick, options.withComma).slice(0, MAX_ITEMS_PER_SECTION)) {
      items.push({
        ...blankItem(section, counted.text),
        tier: options.tiered === false ? null : tierFor(counted.hits, total),
        jd_hits: counted.hits, jd_total: total, is_estimate: counted.estimate,
      });
    }
  };

  add('task', (jd) => jd.main_tasks);
  add('output', (jd) => jd.work_outputs, { tiered: false });
  add('stakeholder', (jd) => jd.key_stakeholders, { tiered: false });
  add('knowledge', (jd) => jd.required_knowledge);
  add('professional_skill', (jd) => jd.professional_skills);
  add('soft_skill', (jd) => jd.soft_skills, { withComma: true });
  add('tool', (jd) => jd.tools_technologies, { withComma: true });
  add('education', (jd) => jd.education_requirement);
  add('certificate', (jd) => jd.certifications);
  add('experience', (jd) => jd.experience_requirement);
  add('language', (jd) => jd.language_requirement);
  add('special_requirement', (jd) => jd.special_requirements);
  add('benefit', (jd) => jd.benefits);
  add('competency', (jd) => jd.behavior_evidence, { tiered: false });
  add('career_move', (jd) => jd.career_path, { tiered: false });

  const salaries = jds.map((jd) => parseSalaryText(jd.salary_reference ?? '')).filter((s) => s.min !== null || s.max !== null);
  if (salaries.length > 0) {
    items.push({
      ...blankItem('salary', `Tổng hợp từ ${salaries.length} tin có công bố mức lương`),
      group_label: 'Theo tin tuyển dụng',
      salary_min: median(salaries.map((s) => s.min).filter((v): v is number => v !== null)),
      salary_max: median(salaries.map((s) => s.max).filter((v): v is number => v !== null)),
      jd_hits: salaries.length, jd_total: total,
    });
  }

  const experience = countItems(jds, (jd) => jd.experience_requirement)[0]?.text ?? '';
  return {
    header: {
      title_variants: topTexts(jds.map((jd) => jd.job_title), 5, ' / '),
      work_mode: countItems(jds, (jd) => jd.work_mode)[0]?.text ?? '',
      career_summary: jds.map((jd) => jd.career_summary ?? '').sort((a, b) => b.length - a.length)[0] ?? '',
      position_objectives: countItems(jds, (jd) => jd.position_objective).slice(0, 5).map((c) => c.text).join('\n'),
      experience_text: experience,
      jd_count: String(total),
      source_note: `Dựng tự động từ ${total} JD của bậc này`,
    },
    items,
  };
}
