import { supabase } from '../../lib/supabase';
import type { Criteria, CriteriaGroup, CriteriaRaterVisibility, HollandCode, RaterGroup } from './admin.types';

export async function listCriteriaGroups(): Promise<CriteriaGroup[]> {
  const { data, error } = await supabase
    .from('criteria_groups')
    .select('id, group_code, name, sort_order, is_active')
    .order('sort_order');
  if (error) {
    console.error('Lỗi đọc nhóm tiêu chí:', error.message);
    throw error;
  }
  return data ?? [];
}

export async function listCriteria(): Promise<Criteria[]> {
  const { data, error } = await supabase
    .from('criteria')
    .select('id, group_id, dimension_code, name, definition, behavior_indicator, reference_source, holland_code, sort_order, is_active')
    .order('sort_order')
    .limit(500);
  if (error) {
    console.error('Lỗi đọc tiêu chí:', error.message);
    throw error;
  }
  return data ?? [];
}

export async function listHollandCodes(): Promise<HollandCode[]> {
  const { data, error } = await supabase.from('holland_codes').select('holland_code, name').order('holland_code');
  if (error) {
    console.error('Lỗi đọc mã Holland:', error.message);
    throw error;
  }
  return data ?? [];
}

export async function listCriteriaRaterVisibility(): Promise<CriteriaRaterVisibility[]> {
  const { data, error } = await supabase
    .from('criteria_rater_visibility')
    .select('id, criteria_id, rater_group, is_visible, scale_method')
    .limit(2000);
  if (error) {
    console.error('Lỗi đọc hiển thị tiêu chí theo nhóm người đánh giá:', error.message);
    throw error;
  }
  return (data ?? []) as CriteriaRaterVisibility[];
}

export type CriteriaGroupPatch = Pick<CriteriaGroup, 'name' | 'sort_order' | 'is_active'>;

export async function updateCriteriaGroup(id: string, patch: CriteriaGroupPatch): Promise<void> {
  const { error } = await supabase.from('criteria_groups').update(patch).eq('id', id);
  if (error) {
    console.error('Lỗi cập nhật nhóm tiêu chí:', error.message);
    throw error;
  }
}

export type CriteriaPatch = Pick<
  Criteria,
  'name' | 'definition' | 'behavior_indicator' | 'reference_source' | 'holland_code' | 'sort_order' | 'is_active'
>;

export async function updateCriteria(id: string, patch: CriteriaPatch): Promise<void> {
  const { error } = await supabase.from('criteria').update(patch).eq('id', id);
  if (error) {
    console.error('Lỗi cập nhật tiêu chí:', error.message);
    throw error;
  }
}

export interface VisibilityInput {
  raterGroup: RaterGroup;
  isVisible: boolean;
  scaleMethod: string | null;
}

/** Ghi lại toàn bộ hiển thị của một tiêu chí theo từng nhóm người đánh giá */
export async function saveCriteriaRaterVisibility(criteriaId: string, items: VisibilityInput[]): Promise<void> {
  const { error } = await supabase.from('criteria_rater_visibility').upsert(
    items.map((item) => ({
      criteria_id: criteriaId,
      rater_group: item.raterGroup,
      is_visible: item.isVisible,
      scale_method: item.scaleMethod,
    })),
    { onConflict: 'criteria_id,rater_group' },
  );
  if (error) {
    console.error('Lỗi lưu hiển thị tiêu chí:', error.message);
    throw error;
  }
}
