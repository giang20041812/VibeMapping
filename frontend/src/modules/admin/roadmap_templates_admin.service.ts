import { db } from '../../lib/rpc';
import { ADMIN_PAGE_SIZE } from './admin.constants';
import { sanitizeKeyword } from './admin.logic';
import type { Paged } from './admin.types';

export interface RoadmapTemplateFilter {
  keyword: string;
  templateCode: string;
  groupCode: string;
  bandCode: string;
  checkStatus: string;
  activeState: string;
}

export const EMPTY_ROADMAP_TEMPLATE_FILTER: RoadmapTemplateFilter = {
  keyword: '',
  templateCode: '',
  groupCode: '',
  bandCode: '',
  checkStatus: '',
  activeState: '',
};

export interface RoadmapTemplateItemRow {
  id: string;
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
  level_duration_weeks: Partial<Record<'1' | '2' | '3', number>> | null;
  duration_text: string | null;
  prerequisite_codes: string[];
  prerequisite_required: boolean;
  reference_source: string | null;
  check_status: string | null;
  check_note: string | null;
  level_guide: string | null;
  prior_knowledge: string | null;
  experience_task: string | null;
  extra_hours_text: string | null;
  fallback_options: string | null;
  group_boundary: string | null;
  is_active: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface SamplePlanRow {
  id: string;
  plan_code: string;
  item_code: string;
  title: string;
  fit_when: string | null;
  schedule_level_1: string | null;
  schedule_level_2: string | null;
  schedule_level_3: string | null;
  suggested_output: string | null;
  is_active: boolean;
}

export type RoadmapTemplateItemInput = Omit<RoadmapTemplateItemRow, 'id' | 'item_code' | 'template_code' | 'group_code' | 'band_code' | 'updated_by' | 'updated_at'>;
export type SamplePlanInput = Pick<SamplePlanRow, 'title' | 'fit_when' | 'schedule_level_1' | 'schedule_level_2' | 'schedule_level_3' | 'suggested_output' | 'is_active'>;

const ITEM_COLUMNS =
  'id, item_code, template_code, group_code, band_code, stage_name, title, how_to, skills_gained, completion_evidence, pass_criteria, ' +
  'duration_weeks, level_duration_weeks, duration_text, prerequisite_codes, prerequisite_required, reference_source, check_status, check_note, ' +
  'level_guide, prior_knowledge, experience_task, extra_hours_text, fallback_options, group_boundary, is_active, updated_by, updated_at';

export async function listRoadmapTemplateNames(): Promise<{ value: string; label: string }[]> {
  const { data, error } = await db.from('roadmap_templates').select('template_code, template_name').order('sort_order');
  if (error) {
    console.error('Lỗi đọc lộ trình mẫu:', error.message);
    throw error;
  }
  return ((data ?? []) as { template_code: string; template_name: string }[]).map((row) => ({ value: row.template_code, label: row.template_name }));
}

export async function listRoadmapTemplateItems(filter: RoadmapTemplateFilter, page: number): Promise<Paged<RoadmapTemplateItemRow>> {
  let query = db.from('roadmap_template_items').select(ITEM_COLUMNS, { count: 'exact' });
  const keyword = sanitizeKeyword(filter.keyword);
  if (keyword) query = query.or(`item_code.ilike.%${keyword}%,title.ilike.%${keyword}%`);
  if (filter.templateCode) query = query.eq('template_code', filter.templateCode);
  if (filter.groupCode) query = query.eq('group_code', filter.groupCode);
  if (filter.bandCode) query = query.eq('band_code', filter.bandCode);
  if (filter.checkStatus) query = query.eq('check_status', filter.checkStatus);
  if (filter.activeState) query = query.eq('is_active', filter.activeState === 'active');
  const from = (page - 1) * ADMIN_PAGE_SIZE;
  const { data, error, count } = await query.order('item_code').range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error) {
    console.error('Lỗi đọc mục lộ trình mẫu:', error.message);
    throw error;
  }
  return { rows: (data ?? []) as unknown as RoadmapTemplateItemRow[], total: count ?? 0 };
}

export async function updateRoadmapTemplateItem(id: string, input: Partial<RoadmapTemplateItemInput>): Promise<void> {
  const { error } = await db.from('roadmap_template_items').update(input).eq('id', id);
  if (error) {
    console.error('Lỗi lưu mục lộ trình mẫu:', error.message);
    throw error;
  }
}

export async function listSamplePlans(itemCode: string): Promise<SamplePlanRow[]> {
  const { data, error } = await db
    .from('roadmap_sample_plans')
    .select('id, plan_code, item_code, title, fit_when, schedule_level_1, schedule_level_2, schedule_level_3, suggested_output, is_active')
    .eq('item_code', itemCode)
    .order('sort_order');
  if (error) {
    console.error('Lỗi đọc kế hoạch mẫu:', error.message);
    throw error;
  }
  return (data ?? []) as SamplePlanRow[];
}

export async function updateSamplePlan(id: string, input: SamplePlanInput): Promise<void> {
  const { error } = await db.from('roadmap_sample_plans').update(input).eq('id', id);
  if (error) {
    console.error('Lỗi lưu kế hoạch mẫu:', error.message);
    throw error;
  }
}
