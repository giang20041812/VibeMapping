import { db } from '../../lib/rpc';
import type { CareerLevelFramework, CareerLevelFrameworkItem, CareerMoveTarget } from './careerLevelFramework.types';

export const FRAMEWORK_COLUMNS = 'id, career_id, career_level, level_name, status, title_variants, reports_to, hiring_industries, experience_text, '
  + 'work_mode, career_summary, position_objectives, required_level, jd_count, source_note, published_at, updated_at';
export const FRAMEWORK_ITEM_COLUMNS = 'id, section, tier, group_label, content, detail, note, salary_min, salary_max, '
  + 'target_career_id, target_level, jd_hits, jd_total, is_estimate, sort_order';

type RawFramework = Omit<CareerLevelFramework, 'items' | 'required_level'> & {
  required_level: number | string | null;
  items: (Omit<CareerLevelFrameworkItem, 'salary_min' | 'salary_max'> & { salary_min: number | string | null; salary_max: number | string | null })[] | null;
};

const toNumber = (value: number | string | null) => (value === null || value === '' ? null : Number(value));

/** Số kiểu numeric của Postgres về dạng số; dòng nội dung xếp theo sort_order */
export function normalizeFramework(row: RawFramework): CareerLevelFramework {
  return {
    ...row,
    required_level: toNumber(row.required_level),
    items: (row.items ?? [])
      .map((item) => ({ ...item, salary_min: toNumber(item.salary_min), salary_max: toNumber(item.salary_max) }))
      .sort((a, b) => a.sort_order - b.sort_order),
  };
}

/** Khung đã công bố của một nghề (RLS chỉ trả khung công bố của nghề công bố, không có phần chỉ quản trị) */
export async function listPublishedLevelFrameworks(careerId: string): Promise<{ frameworks: CareerLevelFramework[]; targets: CareerMoveTarget[] }> {
  const { data, error } = await db
    .from('career_level_frameworks')
    .select(`${FRAMEWORK_COLUMNS}, items:career_level_framework_items(${FRAMEWORK_ITEM_COLUMNS})`)
    .eq('career_id', careerId)
    .eq('status', 'published')
    .order('career_level');
  if (error) throw error;
  const frameworks = ((data ?? []) as unknown as RawFramework[]).map(normalizeFramework);
  const targetIds = [...new Set(frameworks.flatMap((f) => f.items.map((i) => i.target_career_id)).filter((id): id is string => !!id && id !== careerId))];
  if (targetIds.length === 0) return { frameworks, targets: [] };
  // Nghề đích chưa công bố không đọc được nên không có liên kết
  const { data: careers } = await db.from('careers').select('id, career_name').in('id', targetIds);
  return { frameworks, targets: (careers ?? []) as CareerMoveTarget[] };
}
