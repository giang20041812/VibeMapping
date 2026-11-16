import { callRpc, db } from '../../lib/rpc';
import {
  FRAMEWORK_COLUMNS,
  FRAMEWORK_ITEM_COLUMNS,
  normalizeFramework,
} from '../career_explorer/careerLevelFramework.service';
import type { CareerLevelFramework, CareerLevelFrameworkItem } from '../career_explorer/careerLevelFramework.types';

/** JD của nghề ở một bậc, đủ cột để dựng khung nháp */
export interface LevelJd {
  id: string;
  job_title: string | null;
  company_industry: string | null;
  work_mode: string | null;
  career_summary: string | null;
  position_objective: string | null;
  main_tasks: string | null;
  daily_activities: string | null;
  work_outputs: string | null;
  key_stakeholders: string | null;
  required_knowledge: string | null;
  professional_skills: string | null;
  soft_skills: string | null;
  tools_technologies: string | null;
  education_requirement: string | null;
  certifications: string | null;
  experience_requirement: string | null;
  language_requirement: string | null;
  special_requirements: string | null;
  career_path: string | null;
  benefits: string | null;
  salary_reference: string | null;
  behavior_evidence: string | null;
}

const LEVEL_JD_COLUMNS = 'id, job_title, company_industry, work_mode, career_summary, position_objective, main_tasks, daily_activities, '
  + 'work_outputs, key_stakeholders, required_knowledge, professional_skills, soft_skills, tools_technologies, education_requirement, '
  + 'certifications, experience_requirement, language_requirement, special_requirements, career_path, benefits, salary_reference, behavior_evidence';

export interface FrameworkCopySource {
  id: string;
  career_id: string;
  career_level: number;
  level_name: string;
  career_name: string;
}

export interface FrameworkHeaderInput {
  career_level: number;
  level_name: string;
  title_variants: string;
  reports_to: string;
  hiring_industries: string;
  experience_text: string;
  work_mode: string;
  career_summary: string;
  position_objectives: string;
  required_level: string;
  jd_count: string;
  source_note: string;
}

export async function listCareerLevelFrameworks(careerId: string): Promise<CareerLevelFramework[]> {
  const { data, error } = await db
    .from('career_level_frameworks')
    .select(`${FRAMEWORK_COLUMNS}, items:career_level_framework_items(${FRAMEWORK_ITEM_COLUMNS})`)
    .eq('career_id', careerId)
    .order('career_level');
  if (error) throw error;
  return ((data ?? []) as unknown as Parameters<typeof normalizeFramework>[0][]).map(normalizeFramework);
}

/** Số JD của nghề theo từng bậc (để biết bậc nào dựng nháp từ JD được) */
export async function countJdsByLevel(careerId: string): Promise<Record<number, number>> {
  const { data, error } = await db.from('career_job_descriptions').select('career_level').eq('career_id', careerId).limit(5000);
  if (error) throw error;
  const counts: Record<number, number> = {};
  for (const row of (data ?? []) as { career_level: number | null }[]) {
    if (row.career_level !== null) counts[row.career_level] = (counts[row.career_level] ?? 0) + 1;
  }
  return counts;
}

export async function listLevelJds(careerId: string, level: number): Promise<LevelJd[]> {
  const { data, error } = await db.from('career_job_descriptions').select(LEVEL_JD_COLUMNS)
    .eq('career_id', careerId).eq('career_level', level).limit(1000);
  if (error) throw error;
  return (data ?? []) as unknown as LevelJd[];
}

export async function listFrameworkCopySources(): Promise<FrameworkCopySource[]> {
  const { data, error } = await db.from('career_level_frameworks')
    .select('id, career_id, career_level, level_name, career:careers(career_name)')
    .order('career_level')
    .limit(5000);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<Omit<FrameworkCopySource, 'career_name'> & { career: { career_name: string } | { career_name: string }[] | null }>)
    .map((row) => ({
      id: row.id, career_id: row.career_id, career_level: row.career_level, level_name: row.level_name,
      career_name: (Array.isArray(row.career) ? row.career[0]?.career_name : row.career?.career_name) ?? '',
    }))
    .sort((a, b) => a.career_name.localeCompare(b.career_name, 'vi') || a.career_level - b.career_level);
}

const nullable = (text: string) => (text.trim() === '' ? null : text.trim());

function itemPayload(items: CareerLevelFrameworkItem[]) {
  return items.map((item, index) => ({
    section: item.section,
    tier: item.tier,
    group_label: item.group_label?.trim() || null,
    content: item.content.trim(),
    detail: item.detail?.trim() || null,
    note: item.note?.trim() || null,
    salary_min: item.salary_min,
    salary_max: item.salary_max,
    target_career_id: item.target_career_id,
    target_level: item.target_level,
    jd_hits: item.jd_hits,
    jd_total: item.jd_total,
    is_estimate: item.is_estimate,
    sort_order: index,
  }));
}

export function saveCareerLevelFramework(
  frameworkId: string | null, careerId: string, header: FrameworkHeaderInput, items: CareerLevelFrameworkItem[],
): Promise<string> {
  return callRpc<string>('admin_save_level_framework', {
    p_framework_id: frameworkId,
    p_career_id: careerId,
    p_payload: {
      career_level: header.career_level,
      level_name: header.level_name.trim(),
      title_variants: nullable(header.title_variants),
      reports_to: nullable(header.reports_to),
      hiring_industries: nullable(header.hiring_industries),
      experience_text: nullable(header.experience_text),
      work_mode: nullable(header.work_mode),
      career_summary: nullable(header.career_summary),
      position_objectives: nullable(header.position_objectives),
      required_level: header.required_level.trim() === '' ? null : Number(header.required_level.replace(',', '.')),
      jd_count: header.jd_count.trim() === '' ? 0 : Number(header.jd_count),
      source_note: nullable(header.source_note),
      items: itemPayload(items.filter((item) => item.content.trim() !== '')),
    },
  });
}

export function setCareerLevelFrameworkStatus(frameworkId: string, status: 'draft' | 'published'): Promise<void> {
  return callRpc<void>('admin_set_level_framework_status', { p_framework_id: frameworkId, p_status: status });
}

export function deleteCareerLevelFramework(frameworkId: string): Promise<void> {
  return callRpc<void>('admin_delete_level_framework', { p_framework_id: frameworkId });
}

export function copyCareerLevelFramework(sourceId: string, careerId: string, level: number, levelName: string): Promise<string> {
  return callRpc<string>('admin_copy_level_framework', {
    p_source_id: sourceId, p_target_career_id: careerId, p_target_level: level, p_level_name: levelName,
  });
}

const ERROR_TEXT: Record<string, string> = {
  forbidden: 'Bạn không có quyền thực hiện thao tác này.',
  level_exists: 'Bậc này đã có khung.',
  invalid_level: 'Bậc phải từ L0 đến L7.',
  invalid_required_level: 'Required Level phải nằm trong khoảng 1–5.',
  invalid_framework: 'Cần chọn bậc và nhập tên bậc.',
  invalid_item: 'Có dòng nội dung không hợp lệ (nội dung trống hoặc lương "từ" lớn hơn "đến").',
  target_career_not_found: 'Nghề đích không còn tồn tại.',
  framework_incomplete: 'Cần ít nhất một nhiệm vụ trước khi công bố.',
  framework_not_found: 'Không tìm thấy khung.',
  career_not_found: 'Không tìm thấy nghề.',
};

export function frameworkErrorText(caught: unknown): string {
  const message = String((caught as { message?: string })?.message ?? '');
  const key = Object.keys(ERROR_TEXT).find((code) => message.includes(code));
  return key ? ERROR_TEXT[key] : 'Thao tác không thành công.';
}
