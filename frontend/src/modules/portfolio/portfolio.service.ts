import { callRpc, db } from '../../lib/rpc';
import { FRAMEWORK_COLUMNS, FRAMEWORK_ITEM_COLUMNS, normalizeFramework } from '../career_explorer/careerLevelFramework.service';
import type { CareerLevelFramework, FrameworkSection } from '../career_explorer/careerLevelFramework.types';
import { DEFAULT_GAP_PARAMS, GAP_SECTIONS } from './portfolio.constants';
import type {
  CourseSuggestion,
  GapHistoryEntry,
  GapParams,
  GapPosition,
  GapResult,
  SkillProfileInput,
  SkillProfileItem,
} from './portfolio.types';

const SKILL_COLUMNS = 'id, kind, title, criteria_id, framework_item_id, self_level, verified_360, verified_until, updated_at';

export async function listSkillItems(): Promise<SkillProfileItem[]> {
  const { data, error } = await db.from('skill_profile_items').select(SKILL_COLUMNS).order('kind').order('title');
  if (error) throw error;
  return (data ?? []) as SkillProfileItem[];
}

export async function addSkillItem(ownerId: string, input: SkillProfileInput): Promise<void> {
  const { error } = await db.from('skill_profile_items').insert({
    owner_id: ownerId,
    kind: input.kind,
    title: input.title.trim(),
    self_level: input.self_level,
    framework_item_id: input.framework_item_id ?? null,
  });
  if (error) throw error;
}

export async function updateSkillLevel(id: string, level: number): Promise<void> {
  const { error } = await db.from('skill_profile_items').update({ self_level: level }).eq('id', id);
  if (error) throw error;
}

export async function deleteSkillItem(id: string): Promise<void> {
  const { error } = await db.from('skill_profile_items').delete().eq('id', id);
  if (error) throw error;
}

/** Lấy kỹ năng mềm từ kết quả Cuối cùng 360°; trả về số kỹ năng đã lấy */
export function importVerifiedSoftSkills(): Promise<number> {
  return callRpc<number>('import_verified_soft_skills');
}

interface RawPosition {
  id: string;
  career_id: string;
  career_level: number;
  level_name: string;
  updated_at: string;
  career: { career_name: string } | { career_name: string }[] | null;
  items: { section: FrameworkSection }[] | null;
}

/** Các bậc đã công bố có ít nhất một kỹ năng để so (RLS chỉ trả khung công bố của nghề công bố) */
export async function listGapPositions(): Promise<GapPosition[]> {
  const { data, error } = await db
    .from('career_level_frameworks')
    .select('id, career_id, career_level, level_name, updated_at, career:careers(career_name), items:career_level_framework_items(section)')
    .eq('status', 'published')
    .order('career_level');
  if (error) throw error;
  return ((data ?? []) as unknown as RawPosition[])
    .map((row) => {
      const career = Array.isArray(row.career) ? row.career[0] : row.career;
      return {
        framework_id: row.id,
        career_id: row.career_id,
        career_name: career?.career_name ?? '',
        career_level: row.career_level,
        level_name: row.level_name,
        skill_count: (row.items ?? []).filter((item) => GAP_SECTIONS.includes(item.section)).length,
        updated_at: row.updated_at,
      };
    })
    .filter((position) => position.skill_count > 0 && position.career_name !== '')
    .sort((a, b) => a.career_name.localeCompare(b.career_name, 'vi') || a.career_level - b.career_level);
}

export async function loadFramework(frameworkId: string): Promise<CareerLevelFramework> {
  const { data, error } = await db
    .from('career_level_frameworks')
    .select(`${FRAMEWORK_COLUMNS}, items:career_level_framework_items(${FRAMEWORK_ITEM_COLUMNS})`)
    .eq('id', frameworkId)
    .single();
  if (error) throw error;
  return normalizeFramework(data as unknown as Parameters<typeof normalizeFramework>[0]);
}

const asNumber = (value: unknown, fallback: number) => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export async function loadGapParams(): Promise<GapParams> {
  const { data, error } = await db
    .from('operation_parameters')
    .select('param_code, param_value')
    .in('param_code', ['skill_gap_impact_weights', 'skill_gap_default_required_level', 'gap_large_level'])
    .eq('is_current', true);
  if (error) return DEFAULT_GAP_PARAMS;
  const byCode = new Map(((data ?? []) as { param_code: string; param_value: unknown }[]).map((p) => [p.param_code, p.param_value]));
  const weights = (byCode.get('skill_gap_impact_weights') ?? {}) as Record<string, unknown>;
  return {
    impactWeights: {
      required: asNumber(weights.required, DEFAULT_GAP_PARAMS.impactWeights.required),
      common: asNumber(weights.common, DEFAULT_GAP_PARAMS.impactWeights.common),
      advantage: asNumber(weights.advantage, DEFAULT_GAP_PARAMS.impactWeights.advantage),
    },
    defaultRequiredLevel: asNumber(byCode.get('skill_gap_default_required_level'), DEFAULT_GAP_PARAMS.defaultRequiredLevel),
    largeGapLevel: asNumber(byCode.get('gap_large_level'), DEFAULT_GAP_PARAMS.largeGapLevel),
  };
}

export async function saveGapSnapshot(ownerId: string, result: GapResult): Promise<void> {
  const { error } = await db.from('skill_gap_analyses').insert({
    owner_id: ownerId,
    framework_id: result.framework_id,
    career_id: result.career_id,
    position_name: result.position_name,
    overall_percent: result.overall_percent,
    met_count: result.counts.met,
    near_count: result.counts.near,
    unmet_count: result.counts.unmet,
    details: result.rows.map((row) => ({
      content: row.content,
      section: row.section,
      tier: row.tier,
      required_level: row.required_level,
      current_level: row.current_level,
      gap: row.gap,
      status: row.status,
    })),
  });
  if (error) throw error;
}

export async function listGapHistory(limit = 5): Promise<GapHistoryEntry[]> {
  const { data, error } = await db
    .from('skill_gap_analyses')
    .select('id, framework_id, position_name, overall_percent, met_count, near_count, unmet_count, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as (GapHistoryEntry & { overall_percent: number | string })[])
    .map((row) => ({ ...row, overall_percent: Number(row.overall_percent) }));
}

export async function listCourseSuggestions(): Promise<CourseSuggestion[]> {
  const { data, error } = await db
    .from('course_project_suggestions')
    .select('id, criteria_id, kind, title, provider, url, is_partner, skill_keywords')
    .eq('is_active', true)
    .order('title');
  if (error) throw error;
  return ((data ?? []) as CourseSuggestion[]).map((s) => ({ ...s, skill_keywords: s.skill_keywords ?? [] }));
}

export interface ActiveRoadmap {
  id: string;
  title: string;
}

export async function getActiveRoadmap(): Promise<ActiveRoadmap | null> {
  const roadmaps = await callRpc<{ id: string; title: string; is_active: boolean }[]>('list_my_roadmaps');
  const active = (roadmaps ?? []).find((r) => r.is_active);
  return active ? { id: active.id, title: active.title } : null;
}

export function addRoadmapItem(roadmapId: string, input: { title: string; group: string; due: string; checkpoint: boolean; passCriteria: string }) {
  return callRpc<string>('add_roadmap_milestone', {
    p_roadmap_id: roadmapId,
    p_pillar: null,
    p_criteria_group: input.group,
    p_title: input.title,
    p_due_date: input.due || null,
    p_weight: 1,
    p_is_checkpoint: input.checkpoint,
    p_pass_criteria: input.passCriteria || null,
  });
}
