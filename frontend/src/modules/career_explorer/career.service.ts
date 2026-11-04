import {
  careerStandardStatus,
  type CareerComponentResult,
  type CareerRankItem,
  type ComponentMatch,
  type CriterionEvaluation,
  type DisplayGroup,
  type PerceptionGapItem,
  type PriorityLevel,
} from '../../domain/assessmentRules';
import { callRpc, db as supabase } from '../../lib/rpc';
import { toSearchKey } from '../../lib/vnSearch';

export interface CareerListItem {
  id: string;
  career_code: string;
  career_name: string;
  career_field_id: string;
  holland_top3: string | null;
  qualifying_jd_count: number;
  status: string;
  is_standard_complete: boolean;
}

export interface CareerFieldNode {
  id: string;
  parent_field_id: string | null;
  field_name: string;
  sort_order: number;
}

/** Hồ sơ người học dùng để đối sánh: điểm 1–5 theo tiêu chí, ưu tiên điểm tổng hợp 360° */
export interface LearnerProfile {
  resultId: string | null;
  statusLabel: string | null;
  scoreByCriterionId: Map<string, number>;
  scoreByDimension: Record<string, number | null>;
  selfPercentByDimension: Record<string, number | null>;
  groupPercentByDimension: Record<DisplayGroup, Record<string, number | null>>;
}

export interface CareerPolicy {
  weights: { g1toG5: number; g6: number; g7: number };
  minFitPercent: number;
  nearFitPercent: number;
  topN: number;
  perceptionGapPercent: number;
  riasecMethod: string;
  decimals: number;
}

/** Một tiêu chí trong bảng giải thích tầng 2 */
export interface CareerCriterionRow extends CriterionEvaluation {
  criteriaId: string;
  contributionPoints: number;
  isCore: boolean;
}

export interface CareerDetail {
  career: CareerListItem;
  holland: { code: string; strength: number; jdCount: number }[];
  components: Omit<CareerComponentResult, 'criteriaEvaluations'> & { criteriaEvaluations: CareerCriterionRow[] };
  perceptionGaps: PerceptionGapItem[];
  standardNote: string;
  hasResult: boolean;
  hasUserScores: boolean;
  hasGroupScores: boolean;
  statusLabel: string | null;
  acceptedCount: number;
  rank: number | null;
  policy: CareerPolicy;
}

/** Nghề trong danh sách gợi ý */
export interface CareerSuggestion extends CareerRankItem {
  rank: number;
  isTarget: boolean;
}

export interface TargetCareerFit {
  careerId: string;
  careerCode: string;
  careerName: string;
  fitPercent: number | null;
  nearThreshold: boolean;
  inTop: boolean;
  result: CareerComponentResult;
}

export interface CareerRecommendations {
  hasResult: boolean;
  hasScores: boolean;
  resultId: string | null;
  statusLabel: string | null;
  acceptedCount: number;
  finalized: boolean;
  packageSize: number | null;
  learnerCompleteness: number;
  policy: CareerPolicy;
  items: CareerSuggestion[];
  targets: TargetCareerFit[];
  /** Không có nghề nào vượt ngưỡng phù hợp tối thiểu */
  belowThreshold: boolean;
}

const CAREER_COLUMNS = 'id, career_code, career_name, career_field_id, holland_top3, qualifying_jd_count, status, is_standard_complete';
const PAGE = 1000;
const DISPLAY_GROUPS: DisplayGroup[] = ['parent', 'friend', 'teacher', 'mentor', 'others'];

interface CriterionMeta {
  id: string;
  dimensionCode: string;
  name: string;
  groupCode: string;
}

let criteriaCache: Promise<CriterionMeta[]> | null = null;

function loadCriteria(): Promise<CriterionMeta[]> {
  criteriaCache ??= (async () => {
    const [{ data: criteria, error }, { data: groups, error: groupError }] = await Promise.all([
      supabase.from('criteria').select('id, dimension_code, name, group_id').eq('is_active', true),
      supabase.from('criteria_groups').select('id, group_code'),
    ]);
    if (error) throw error;
    if (groupError) throw groupError;
    const groupCode = new Map((groups ?? []).map((g) => [g.id, g.group_code]));
    return (criteria ?? []).map((c) => ({
      id: c.id,
      dimensionCode: c.dimension_code,
      name: c.name,
      groupCode: groupCode.get(c.group_id) ?? '',
    }));
  })().catch((error) => {
    criteriaCache = null;
    throw error;
  });
  return criteriaCache;
}

// ---------------------------------------------------------------------------------------------
// Dữ liệu trả về từ RPC Career Fit (tính trên máy chủ)
// ---------------------------------------------------------------------------------------------

interface RawPolicy {
  w_main: number;
  w_g6: number;
  w_g7: number;
  min_fit: number;
  near_fit: number;
  top_n: number;
  gap_percent: number;
  decimals: number;
  riasec_method: string;
}

interface RawParts {
  match_g1_g5: number | null;
  match_g6: number | null;
  match_g7: number | null;
  applied_g1_g5?: number | null;
  applied_g6?: number | null;
  applied_g7?: number | null;
  completeness: number | null;
  riasec_method?: string;
  highest_weight_gap?: number;
  unmet?: number;
}

interface RawSuggestion extends RawParts {
  career_id: string;
  career_code: string;
  career_name: string;
  holland_top3: string | null;
  rank: number;
  fit: number;
  band: number;
  near: boolean;
  is_target: boolean;
}

interface RawTarget extends RawParts {
  career_id: string;
  career_code: string;
  career_name: string;
  fit: number | null;
  near: boolean;
  in_top: boolean;
}

interface RawRecommendations {
  has_result: boolean;
  has_scores: boolean;
  result_id?: string;
  status_label?: string;
  accepted_count?: number;
  finalized?: boolean;
  package_size?: number | null;
  learner_completeness?: number;
  policy: RawPolicy;
  items: RawSuggestion[];
  targets: RawTarget[];
}

interface RawCriterion {
  criteria_id: string;
  dimension_code: string;
  name: string;
  group_code: string;
  required_score: number;
  career_weight: number;
  user_score: number | null;
  fit: number | null;
  gap: number | null;
  is_core: boolean;
  priority: PriorityLevel | null;
  penalty_points: number;
  contribution_points: number;
}

interface RawDetail {
  has_result: boolean;
  has_scores: boolean;
  status_label?: string;
  accepted_count?: number;
  policy: RawPolicy;
  rank: number | null;
  fit: (RawParts & { career_fit_raw: number; rank_band: number }) | null;
  criteria: RawCriterion[];
  has_group_scores?: boolean;
  perception_gaps: Array<{
    dimension_code: string;
    name: string;
    group: DisplayGroup;
    self_percent: number;
    group_percent: number;
    delta_percent: number;
  }>;
}

const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

function mapPolicy(raw: RawPolicy): CareerPolicy {
  return {
    weights: { g1toG5: Number(raw.w_main), g6: Number(raw.w_g6), g7: Number(raw.w_g7) },
    minFitPercent: Number(raw.min_fit),
    nearFitPercent: Number(raw.near_fit),
    topN: Number(raw.top_n),
    perceptionGapPercent: Number(raw.gap_percent),
    riasecMethod: raw.riasec_method,
    decimals: Number(raw.decimals ?? 1),
  };
}

function part(match: unknown, originalWeight: number, applied: unknown, rows: CriterionEvaluation[]): ComponentMatch {
  const value = num(match);
  return {
    match: value,
    matchPercent: value === null ? null : value * 100,
    originalWeight,
    appliedWeight: num(applied) ?? 0,
    usedCriteria: rows.filter((row) => row.fit !== null).length,
    missingUserScores: rows.filter((row) => row.fit === null).length,
  };
}

function toComponents<T extends CriterionEvaluation>(
  raw: RawParts | null,
  fitRaw: number | null,
  band: number | null,
  criteria: T[],
  policy: CareerPolicy,
): Omit<CareerComponentResult, 'criteriaEvaluations'> & { criteriaEvaluations: T[] } {
  const main = criteria.filter((row) => row.groupCode !== 'G7');
  const g7 = criteria.filter((row) => row.groupCode === 'G7');
  const method = (raw?.riasec_method ?? 'missing') as CareerComponentResult['g6']['method'];
  return {
    g1toG5: part(raw?.match_g1_g5, policy.weights.g1toG5, raw?.applied_g1_g5, main),
    g6: { ...part(raw?.match_g6, policy.weights.g6, raw?.applied_g6, []), method },
    g7: part(raw?.match_g7, policy.weights.g7, raw?.applied_g7, g7),
    careerFitPercent: fitRaw,
    rankBand: band,
    componentCompleteness: num(raw?.completeness) ?? 0,
    highestWeightGap: num(raw?.highest_weight_gap) ?? 0,
    unmetCriteriaCount: num(raw?.unmet) ?? 0,
    criteriaEvaluations: criteria,
    status: fitRaw === null ? 'insufficient_data' : 'ready',
    notice: '',
  };
}

function mapCriterion(row: RawCriterion): CareerCriterionRow {
  const fit = num(row.fit);
  const gap = num(row.gap);
  return {
    criteriaId: row.criteria_id,
    dimensionCode: row.dimension_code,
    name: row.name,
    groupCode: row.group_code,
    careerWeight: Number(row.career_weight),
    requiredScore: Number(row.required_score),
    userScore: num(row.user_score),
    fit,
    gap,
    priority: row.priority,
    status: fit === null ? 'missing' : gap !== null && gap > 0 ? 'gap' : 'met',
    penaltyPoints: Number(row.penalty_points),
    contributionPoints: Number(row.contribution_points),
    isCore: row.is_core,
  };
}

/** R20: Top nghề phù hợp (máy chủ tính và tự cập nhật khi kết quả hoặc danh mục nghề đổi). */
export async function recommendCareers(subjectUserId?: string): Promise<CareerRecommendations> {
  const raw = await callRpc<RawRecommendations>('get_career_recommendations', subjectUserId ? { p_user_id: subjectUserId } : {});
  const policy = mapPolicy(raw.policy);
  const items: CareerSuggestion[] = (raw.items ?? []).map((item) => {
    const fit = Number(item.fit);
    return {
      careerId: item.career_id,
      careerCode: item.career_code,
      careerName: item.career_name,
      hollandTop3: item.holland_top3,
      fitPercent: fit,
      rankBand: Number(item.band),
      highestWeightGap: Number(item.highest_weight_gap ?? 0),
      unmetCriteriaCount: Number(item.unmet ?? 0),
      componentCompleteness: Number(item.completeness ?? 0),
      nearThreshold: item.near,
      rank: item.rank,
      isTarget: item.is_target,
      result: toComponents(item, fit, Number(item.band), [], policy),
    };
  });
  const targets: TargetCareerFit[] = (raw.targets ?? []).map((item) => ({
    careerId: item.career_id,
    careerCode: item.career_code,
    careerName: item.career_name,
    fitPercent: num(item.fit),
    nearThreshold: item.near,
    inTop: item.in_top,
    result: toComponents(item, num(item.fit), null, [], policy),
  }));
  return {
    hasResult: raw.has_result,
    hasScores: raw.has_scores,
    resultId: raw.result_id ?? null,
    statusLabel: raw.status_label ?? null,
    acceptedCount: raw.accepted_count ?? 0,
    finalized: Boolean(raw.finalized),
    packageSize: raw.package_size ?? null,
    learnerCompleteness: Number(raw.learner_completeness ?? 0),
    policy,
    items,
    targets,
    belowThreshold: !items.some((item) => !item.nearThreshold),
  };
}

/** Chi tiết phù hợp của một nghề; `subjectUserId` dùng khi phụ huynh xem kết quả con đã chia sẻ */
export async function loadCareerDetail(careerId: string, subjectUserId?: string): Promise<CareerDetail | null> {
  const [{ data: career, error }, raw, { data: holland, error: hollandError }] = await Promise.all([
    supabase.from('careers').select(CAREER_COLUMNS).eq('id', careerId).maybeSingle(),
    callRpc<RawDetail>('get_career_fit_detail', { p_career_id: careerId, p_user_id: subjectUserId ?? null }),
    supabase.from('career_holland_profiles').select('holland_code, strength, jd_count').eq('career_id', careerId),
  ]);
  if (error) throw error;
  if (hollandError) throw hollandError;
  if (!career) return null;
  const policy = mapPolicy(raw.policy);
  const criteria = (raw.criteria ?? []).map(mapCriterion);
  const components = toComponents(raw.fit, raw.fit ? Number(raw.fit.career_fit_raw) : null, raw.fit ? Number(raw.fit.rank_band) : null, criteria, policy);
  const hollandRows = (holland ?? []).map((h) => ({ code: h.holland_code, strength: Number(h.strength), jdCount: h.jd_count }));
  const status = careerStandardStatus({
    weightedCriteria: criteria.length,
    hasMainComponent: criteria.some((c) => c.groupCode !== 'G7'),
    hasG7Component: criteria.some((c) => c.groupCode === 'G7'),
    hasHollandProfile: hollandRows.some((h) => h.jdCount > 0) || Boolean(career.holland_top3),
  });
  return {
    career,
    holland: hollandRows,
    components,
    perceptionGaps: (raw.perception_gaps ?? []).map((gap) => ({
      dimensionCode: gap.dimension_code,
      dimensionName: gap.name,
      group: gap.group,
      selfPercent: Number(gap.self_percent),
      groupPercent: Number(gap.group_percent),
      deltaPercent: Number(gap.delta_percent),
    })),
    standardNote: status.note,
    hasResult: raw.has_result,
    hasUserScores: raw.has_scores,
    hasGroupScores: Boolean(raw.has_group_scores),
    statusLabel: raw.status_label ?? null,
    acceptedCount: raw.accepted_count ?? 0,
    rank: raw.rank ?? null,
    policy,
  };
}

export async function loadLearnerProfile(userId: string): Promise<LearnerProfile> {
  const { data: result, error } = await supabase
    .from('assessment_results')
    .select('id, status_label')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const empty = Object.fromEntries(DISPLAY_GROUPS.map((g) => [g, {}])) as Record<DisplayGroup, Record<string, number | null>>;
  if (!result) {
    return {
      resultId: null,
      statusLabel: null,
      scoreByCriterionId: new Map(),
      scoreByDimension: {},
      selfPercentByDimension: {},
      groupPercentByDimension: empty,
    };
  }
  const [criteria, { data: scores, error: scoreError }] = await Promise.all([
    loadCriteria(),
    supabase.from('assessment_result_scores').select('criteria_id, score_source, score_1_5, score_percent').eq('result_id', result.id),
  ]);
  if (scoreError) throw scoreError;
  const dimensionOf = new Map(criteria.map((c) => [c.id, c.dimensionCode]));
  const scoreByCriterionId = new Map<string, number>();
  const scoreByDimension: Record<string, number | null> = {};
  const selfPercentByDimension: Record<string, number | null> = {};
  for (const row of scores ?? []) {
    const dimension = dimensionOf.get(row.criteria_id);
    if (!dimension || row.score_1_5 === null) continue;
    const value = Number(row.score_1_5);
    const percent = row.score_percent === null ? null : Number(row.score_percent);
    if (row.score_source === 'combined_360' || (row.score_source === 'self' && !scoreByCriterionId.has(row.criteria_id))) {
      scoreByCriterionId.set(row.criteria_id, value);
      scoreByDimension[dimension] = value;
    }
    if (row.score_source === 'self') selfPercentByDimension[dimension] = percent;
    if ((DISPLAY_GROUPS as string[]).includes(row.score_source)) {
      empty[row.score_source as DisplayGroup][dimension] = percent;
    }
  }
  return {
    resultId: result.id,
    statusLabel: result.status_label,
    scoreByCriterionId,
    scoreByDimension,
    selfPercentByDimension,
    groupPercentByDimension: empty,
  };
}

let publishedCache: { at: number; rows: CareerListItem[] } | null = null;

export async function listPublishedCareers(): Promise<CareerListItem[]> {
  if (publishedCache && Date.now() - publishedCache.at < 60_000) return publishedCache.rows;
  const rows: CareerListItem[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('careers')
      .select(CAREER_COLUMNS)
      .eq('status', 'published')
      .order('career_name')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  publishedCache = { at: Date.now(), rows };
  return rows;
}

/** FR04.01.01: tìm tên nghề có dấu hoặc không dấu, chỉ nghề đã công bố. */
export async function searchCareers(query: string): Promise<CareerListItem[]> {
  const text = toSearchKey(query);
  const rows = await listPublishedCareers();
  if (!text) return rows;
  return rows
    .filter((row) => toSearchKey(row.career_name).includes(text) || toSearchKey(row.career_code).includes(text));
}

export interface CareerFilterChoices {
  salaries: string[];
  environments: string[];
  education: string[];
  growth: string[];
}

const uniqueText = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'vi'));

/** FR04.01.04: các giá trị lọc lấy từ JD và cột growth_level đã có, không bịa mức mới. */
export async function loadCareerFilterChoices(): Promise<CareerFilterChoices> {
  const [{ data: jobs, error: jobError }, { data: careers, error: careerError }] = await Promise.all([
    supabase.from('career_job_descriptions').select('salary_reference, work_environment, education_requirement').limit(5000),
    supabase.from('careers').select('growth_level').eq('status', 'published'),
  ]);
  if (jobError) throw jobError;
  if (careerError) throw careerError;
  return {
    salaries: uniqueText((jobs ?? []).map((row) => row.salary_reference)),
    environments: uniqueText((jobs ?? []).map((row) => row.work_environment)),
    education: uniqueText((jobs ?? []).map((row) => row.education_requirement)),
    growth: uniqueText((careers ?? []).map((row) => row.growth_level as string | null)),
  };
}

export async function careerIdsMatchingFilters(filters: { salary: string; environment: string; education: string; growth: string }): Promise<Set<string> | null> {
  if (!filters.salary && !filters.environment && !filters.education && !filters.growth) return null;
  let ids: Set<string> | null = null;
  const narrow = (next: Set<string>) => {
    ids = ids === null ? next : new Set([...ids].filter((id) => next.has(id)));
  };
  if (filters.growth) {
    const { data, error } = await supabase.from('careers').select('id').eq('status', 'published').eq('growth_level', filters.growth);
    if (error) throw error;
    narrow(new Set((data ?? []).map((row) => row.id)));
  }
  if (filters.salary || filters.environment || filters.education) {
    let request = supabase.from('career_job_descriptions').select('career_id').limit(5000);
    if (filters.salary) request = request.eq('salary_reference', filters.salary);
    if (filters.environment) request = request.eq('work_environment', filters.environment);
    if (filters.education) request = request.eq('education_requirement', filters.education);
    const { data, error } = await request;
    if (error) throw error;
    narrow(new Set((data ?? []).map((row) => row.career_id)));
  }
  return ids ?? new Set();
}

export async function loadCareerFields(): Promise<CareerFieldNode[]> {
  const { data, error } = await supabase
    .from('career_fields')
    .select('id, parent_field_id, field_name, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export function fieldAndDescendants(fields: CareerFieldNode[], rootId: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const field of fields) {
    if (!field.parent_field_id) continue;
    const list = children.get(field.parent_field_id) ?? [];
    list.push(field.id);
    children.set(field.parent_field_id, list);
  }
  const ids = new Set<string>();
  const walk = (id: string) => {
    if (ids.has(id)) return;
    ids.add(id);
    for (const child of children.get(id) ?? []) walk(child);
  };
  walk(rootId);
  return ids;
}

export type CareerBookmarkKind = 'saved' | 'target';

export interface SavedCareer {
  career_id: string;
  kind: CareerBookmarkKind;
  career_name: string;
  career_code: string;
  created_at?: string;
}

export function saveCareerBookmark(careerId: string, kind: CareerBookmarkKind) {
  return callRpc<void>('save_career_bookmark', { p_career_id: careerId, p_kind: kind });
}

export function removeCareerBookmark(careerId: string, kind: CareerBookmarkKind) {
  return callRpc<void>('remove_career_bookmark', { p_career_id: careerId, p_kind: kind });
}

export function listSavedCareers() {
  return callRpc<SavedCareer[]>('list_my_saved_careers');
}

export function setCareerStatus(careerId: string, status: string) {
  return callRpc<void>('set_career_status', { p_career_id: careerId, p_status: status });
}

export interface CareerCompareFacts {
  id: string;
  career_name: string;
  fieldName: string | null;
  salary: string | null;
  trainingYears: number | null;
  holland_top3: string | null;
  workEnvironment: string | null;
  skills: string | null;
  sourceUrl: string | null;
  reviewedAt: string | null;
  fitPercent: number | null;
  hasUserScores: boolean;
}

function firstText(values: Array<string | null | undefined>): string | null {
  return values.map((v) => v?.trim()).find((v) => v) ?? null;
}

/** FR04.02.12–13: thông tin công bố + % phù hợp để so sánh 2–4 nghề */
export async function loadCareerCompareRows(ids: string[]): Promise<CareerCompareFacts[]> {
  const unique = [...new Set(ids)].slice(0, 4);
  const fits = await callRpc<{ has_scores: boolean; items: Array<{ career_id: string; fit: number }> }>(
    'get_career_fit_many', { p_career_ids: unique },
  );
  const fitById = new Map((fits.items ?? []).map((item) => [item.career_id, Number(item.fit)]));
  const rows = await Promise.all(unique.map(async (id) => {
    const { data: career, error } = await supabase
      .from('careers')
      .select('id, career_name, holland_top3, status, data_checked_at, field:career_fields(field_name)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!career || career.status !== 'published') return null;

    const [{ data: jds }, { data: links }] = await Promise.all([
      supabase
        .from('career_job_descriptions')
        .select('salary_reference, work_environment, professional_skills, jd_url, data_source')
        .eq('career_id', id)
        .order('career_level')
        .limit(20),
      supabase.from('career_major_links').select('major_id').eq('career_id', id),
    ]);
    const majorIds = (links ?? []).map((l) => l.major_id);
    const { data: programs } = majorIds.length
      ? await supabase.from('training_programs').select('study_years').in('major_id', majorIds).not('study_years', 'is', null).limit(80)
      : { data: [] };
    const years = (programs ?? []).map((p) => Number(p.study_years)).filter((n) => Number.isFinite(n) && n > 0);
    const field = career.field as { field_name: string } | { field_name: string }[] | null;
    return {
      id: career.id,
      career_name: career.career_name,
      fieldName: Array.isArray(field) ? field[0]?.field_name ?? null : field?.field_name ?? null,
      salary: firstText((jds ?? []).map((j) => j.salary_reference)),
      trainingYears: years.length ? Number((years.reduce((a, b) => a + b, 0) / years.length).toFixed(1)) : null,
      holland_top3: career.holland_top3,
      workEnvironment: firstText((jds ?? []).map((j) => j.work_environment)),
      skills: firstText((jds ?? []).map((j) => j.professional_skills)),
      sourceUrl: firstText((jds ?? []).map((j) => j.jd_url ?? j.data_source)),
      reviewedAt: career.data_checked_at,
      fitPercent: fitById.get(id) ?? null,
      hasUserScores: fits.has_scores,
    };
  }));
  return rows.filter((row): row is CareerCompareFacts => row !== null);
}

export interface CareerProfileSection {
  key: string;
  title: string;
  items: string[];
}

export interface CareerProfileInfo {
  sections: CareerProfileSection[];
  majors: Array<{ id: string; name: string; direct: boolean }>;
}

const PROFILE_SECTIONS: Array<{ key: string; title: string }> = [
  { key: 'main_tasks', title: 'Công việc chính' },
  { key: 'professional_skills', title: 'Kỹ năng chuyên môn' },
  { key: 'soft_skills', title: 'Kỹ năng mềm' },
  { key: 'tools_technologies', title: 'Công cụ và công nghệ' },
  { key: 'work_environment', title: 'Môi trường làm việc' },
  { key: 'career_path', title: 'Lộ trình nghề nghiệp' },
  { key: 'salary_reference', title: 'Mức lương tham khảo' },
];

/** Tách văn bản JD thành các ý ngắn, bỏ trùng, giữ thứ tự xuất hiện nhiều nhất */
function topItems(texts: string[], limit: number, wholeLines = false): string[] {
  const counts = new Map<string, { text: string; n: number }>();
  for (const raw of texts) {
    for (const part of wholeLines ? raw.split(/\r?\n/) : raw.split(/\r?\n|;|•|(?:^|\s)[-–]\s/)) {
      const text = part.replace(/^\s*\d+[.)]\s*/, '').trim();
      if (text.length < 3 || text.length > 220) continue;
      const key = toSearchKey(text);
      const hit = counts.get(key);
      if (hit) hit.n += 1;
      else counts.set(key, { text, n: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, limit).map((x) => x.text);
}

/** Mô tả nghề tổng hợp từ các JD và các ngành liên quan */
export async function loadCareerProfileInfo(careerId: string): Promise<CareerProfileInfo> {
  const columns = PROFILE_SECTIONS.map((s) => s.key).join(',');
  const [jds, links] = await Promise.all([
    supabase.from('career_job_descriptions').select(columns).eq('career_id', careerId).limit(60),
    supabase.from('career_major_links').select('major_id, link_level, majors(major_name)').eq('career_id', careerId).limit(40),
  ]);
  if (jds.error) throw jds.error;
  const rows = (jds.data ?? []) as unknown as Array<Record<string, string | null>>;
  const sections = PROFILE_SECTIONS.map(({ key, title }) => ({
    key,
    title,
    items: topItems(rows.map((row) => row[key] ?? '').filter(Boolean), key === 'salary_reference' ? 2 : 6, key === 'salary_reference'),
  })).filter((section) => section.items.length > 0);
  const majors = ((links.data ?? []) as unknown as Array<{ major_id: string; link_level: string; majors: { major_name: string } | null }>)
    .filter((row) => row.majors)
    .map((row) => ({ id: row.major_id, name: row.majors!.major_name, direct: row.link_level === 'direct' }))
    .sort((a, b) => Number(b.direct) - Number(a.direct) || a.name.localeCompare(b.name, 'vi'));
  return { sections, majors };
}
