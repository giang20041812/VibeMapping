import {
  BAND_CODES,
  CRITERIA_GROUP_CODES,
  DEFAULT_BAND_MIN,
  DEFAULT_ITEM_HOURS_PER_WEEK,
  type BandCode,
  type CriteriaGroupCode,
  type RoadmapTemplateItem,
  type RoadmapTemplateOption,
} from '../../domain/roadmapTemplateGeneration';
import { db } from '../../lib/rpc';
import { getLatestAssessmentResult } from '../assessment_result/assessmentResult.service';

export interface TemplateChoice extends RoadmapTemplateOption {
  name: string;
}

export interface TemplateLibrary {
  templates: TemplateChoice[];
  bandMin: Record<BandCode, number>;
  itemHoursPerWeek: number;
}

/** Danh sách lộ trình mẫu, ranh giới band và số giờ một mục cần */
export async function loadTemplateLibrary(): Promise<TemplateLibrary> {
  const [templates, bands, param] = await Promise.all([
    db.from('roadmap_templates').select('template_code, template_name, learner_level, career_code_patterns, is_level_default, sort_order').eq('is_active', true).order('sort_order'),
    db.from('roadmap_group_bands').select('band_code, min_percent'),
    db.from('operation_parameters').select('param_value').eq('param_code', 'roadmap_item_hours_per_week').maybeSingle(),
  ]);
  if (templates.error) {
    console.error('Lỗi đọc lộ trình mẫu:', templates.error.message);
    throw templates.error;
  }
  const bandMin = { ...DEFAULT_BAND_MIN };
  for (const band of BAND_CODES) {
    const row = (bands.data ?? []).find((b: { band_code: string }) => b.band_code === band) as { min_percent: number } | undefined;
    if (row && Number.isFinite(Number(row.min_percent))) bandMin[band] = Number(row.min_percent);
  }
  const hours = Number((param.data as { param_value?: unknown } | null)?.param_value);
  return {
    templates: ((templates.data ?? []) as Array<{
      template_code: string; template_name: string; learner_level: 'high_school' | 'university';
      career_code_patterns: string[] | null; is_level_default: boolean; sort_order: number;
    }>).map((row) => ({
      code: row.template_code,
      name: row.template_name,
      learnerLevel: row.learner_level,
      careerCodePatterns: row.career_code_patterns ?? [],
      isLevelDefault: row.is_level_default,
      sortOrder: row.sort_order,
    })),
    bandMin,
    itemHoursPerWeek: hours > 0 ? hours : DEFAULT_ITEM_HOURS_PER_WEEK,
  };
}

/** Mục và trọng số nghề của một lộ trình mẫu */
export async function loadTemplateContent(templateCode: string): Promise<{
  items: RoadmapTemplateItem[];
  weights: Partial<Record<CriteriaGroupCode, number>>;
}> {
  const [items, weights] = await Promise.all([
    db
      .from('roadmap_template_items')
      .select('id, item_code, group_code, band_code, title, duration_weeks, level_duration_weeks, prerequisite_codes, pass_criteria, completion_evidence, sort_order')
      .eq('template_code', templateCode)
      .eq('is_active', true),
    db.from('roadmap_template_weights').select('group_code, weight').eq('template_code', templateCode),
  ]);
  if (items.error) {
    console.error('Lỗi đọc mục lộ trình mẫu:', items.error.message);
    throw items.error;
  }
  if (weights.error) {
    console.error('Lỗi đọc trọng số lộ trình mẫu:', weights.error.message);
    throw weights.error;
  }
  return {
    items: ((items.data ?? []) as Array<{
      id: string; item_code: string; group_code: CriteriaGroupCode; band_code: BandCode; title: string;
      duration_weeks: number; level_duration_weeks: RoadmapTemplateItem['levelDurationWeeks']; prerequisite_codes: string[] | null;
      pass_criteria: string | null; completion_evidence: string | null; sort_order: number;
    }>).map((row) => ({
      id: row.id,
      itemCode: row.item_code,
      groupCode: row.group_code,
      bandCode: row.band_code,
      title: row.title,
      durationWeeks: Number(row.duration_weeks),
      levelDurationWeeks: row.level_duration_weeks,
      prerequisiteCodes: row.prerequisite_codes ?? [],
      passCriteria: row.pass_criteria,
      completionEvidence: row.completion_evidence,
      sortOrder: row.sort_order,
    })),
    weights: Object.fromEntries(
      ((weights.data ?? []) as Array<{ group_code: CriteriaGroupCode; weight: number }>).map((w) => [w.group_code, Number(w.weight)]),
    ),
  };
}

/** % đạt từng nhóm tiêu chí ở kết quả đánh giá mới nhất: điểm 360° nếu có, không thì tự đánh giá */
export async function loadGroupPercents(userId: string): Promise<Partial<Record<CriteriaGroupCode, number | null>>> {
  const result = await getLatestAssessmentResult(userId);
  if (!result) return {};
  const out: Partial<Record<CriteriaGroupCode, number | null>> = {};
  for (const group of result.groups) {
    if ((CRITERIA_GROUP_CODES as string[]).includes(group.groupCode)) {
      out[group.groupCode as CriteriaGroupCode] = group.combined ?? group.self;
    }
  }
  return out;
}
