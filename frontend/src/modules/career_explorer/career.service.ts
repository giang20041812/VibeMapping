import {
  careerComponents,
  careerStandardStatus,
  findPerceptionGaps,
  rankCareerRecommendations,
  type CareerComponentResult,
  type CareerRankItem,
  type CriterionRequirement,
  type DisplayGroup,
  type PerceptionGapItem,
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
}

export interface CareerDetail {
  career: CareerListItem;
  holland: { code: string; strength: number; jdCount: number }[];
  components: CareerComponentResult;
  perceptionGaps: PerceptionGapItem[];
  standardNote: string;
  hasUserScores: boolean;
  policy: CareerPolicy;
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

async function paramValue(code: string): Promise<unknown> {
  const { data, error } = await supabase
    .from('operation_parameters')
    .select('param_value')
    .eq('param_code', code)
    .eq('is_current', true)
    .maybeSingle();
  if (error) throw error;
  return data?.param_value ?? null;
}

export async function loadCareerPolicy(): Promise<CareerPolicy> {
  const codes = [
    'career_fit_weight_competency',
    'career_fit_weight_interest',
    'career_fit_weight_motivation',
    'career_fit_min_percent',
    'career_near_fit_percent',
    'career_top_n',
    'perception_gap_percent',
    'riasec_match_method',
  ];
  const values = await Promise.all(codes.map(paramValue));
  const num = (value: unknown, fallback: number) => (typeof value === 'number' ? value : fallback);
  return {
    weights: { g1toG5: num(values[0], 0.4), g6: num(values[1], 0.3), g7: num(values[2], 0.3) },
    minFitPercent: num(values[3], 50),
    nearFitPercent: num(values[4], 40),
    topN: num(values[5], 5),
    perceptionGapPercent: num(values[6], 25),
    riasecMethod: typeof values[7] === 'string' ? values[7] : 'profile_6d_demo',
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

async function fetchAllRequirements(careerIds?: string[]) {
  const rows: { career_id: string; criteria_id: string; required_score: number; career_weight: number }[] = [];
  for (let from = 0; ; from += PAGE) {
    let request = supabase
      .from('career_requirements')
      .select('career_id, criteria_id, required_score, career_weight')
      .gt('career_weight', 0)
      .order('id')
      .range(from, from + PAGE - 1);
    if (careerIds) request = request.in('career_id', careerIds);
    const { data, error } = await request;
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function fetchAllHolland(careerIds?: string[]) {
  const rows: { career_id: string; holland_code: string; strength: number; jd_count: number }[] = [];
  for (let from = 0; ; from += PAGE) {
    let request = supabase
      .from('career_holland_profiles')
      .select('career_id, holland_code, strength, jd_count')
      .order('id')
      .range(from, from + PAGE - 1);
    if (careerIds) request = request.in('career_id', careerIds);
    const { data, error } = await request;
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

function evaluateCareer(
  career: CareerListItem,
  requirements: { criteria_id: string; required_score: number; career_weight: number }[],
  holland: { holland_code: string; strength: number }[],
  learner: LearnerProfile,
  criteria: Map<string, CriterionMeta>,
  policy: CareerPolicy,
): CareerComponentResult {
  const rows: CriterionRequirement[] = requirements.flatMap((req) => {
    const meta = criteria.get(req.criteria_id);
    if (!meta) return [];
    return [{
      dimensionCode: meta.dimensionCode,
      name: meta.name,
      groupCode: meta.groupCode,
      careerWeight: Number(req.career_weight),
      requiredScore: Number(req.required_score),
      userScore: learner.scoreByCriterionId.get(req.criteria_id) ?? null,
    }];
  });
  const profile = policy.riasecMethod === 'top3_overlap_demo'
    ? undefined
    : Object.fromEntries(holland.map((h) => [h.holland_code, Number(h.strength)]));
  return careerComponents(rows, {
    learnerDimensionScores1to5: learner.scoreByDimension,
    careerHollandProfile: profile,
    careerHollandTop3: career.holland_top3,
    weights: policy.weights,
  });
}

/** R20: Top N nghề phù hợp từ toàn bộ nghề đã công bố; lưu bản chụp khi thứ hạng thay đổi */
export async function recommendCareers(userId: string): Promise<{
  items: CareerRankItem[];
  learner: LearnerProfile;
  policy: CareerPolicy;
  belowThreshold: boolean;
}> {
  const [learner, policy, criteria] = await Promise.all([loadLearnerProfile(userId), loadCareerPolicy(), loadCriteria()]);
  if (!learner.resultId || learner.scoreByCriterionId.size === 0) {
    return { items: [], learner, policy, belowThreshold: false };
  }
  const careers: CareerListItem[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('careers')
      .select(CAREER_COLUMNS)
      .eq('status', 'published')
      .order('career_code')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    careers.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  const [requirements, holland] = await Promise.all([fetchAllRequirements(), fetchAllHolland()]);
  const reqByCareer = groupBy(requirements, (r) => r.career_id);
  const hollandByCareer = groupBy(holland, (h) => h.career_id);
  const criteriaById = new Map(criteria.map((c) => [c.id, c]));

  const candidates = careers.map((career) => ({
    careerId: career.id,
    careerCode: career.career_code,
    careerName: career.career_name,
    hollandTop3: career.holland_top3,
    result: evaluateCareer(career, reqByCareer.get(career.id) ?? [], hollandByCareer.get(career.id) ?? [], learner, criteriaById, policy),
  }));
  const items = rankCareerRecommendations(candidates, policy.topN, policy.minFitPercent, policy.nearFitPercent);

  if (items.length > 0) {
    await callRpc('save_career_match_snapshot', {
      p_result_id: learner.resultId,
      p_payload: {
        weights: policy.weights,
        riasec_method: policy.riasecMethod,
        ranking: items.map((item) => ({ career_id: item.careerId, fit: item.fitPercent, band: item.rankBand })),
        details: items.map((item) => ({
          career_id: item.careerId,
          g1to5: item.result.g1toG5.matchPercent,
          g6: item.result.g6.matchPercent,
          g7: item.result.g7.matchPercent,
          completeness: item.componentCompleteness,
          near_threshold: item.nearThreshold,
          criteria: item.result.criteriaEvaluations.map((c) => ({
            d: c.dimensionCode, req: c.requiredScore, us: c.userScore, cw: c.careerWeight, fit: c.fit, gap: c.gap, p: c.priority,
          })),
        })),
      },
    }).catch(() => undefined);
  }
  return { items, learner, policy, belowThreshold: !items.some((item) => !item.nearThreshold) };
}

export async function loadCareerDetail(careerId: string, userId: string): Promise<CareerDetail | null> {
  const { data: career, error } = await supabase.from('careers').select(CAREER_COLUMNS).eq('id', careerId).maybeSingle();
  if (error) throw error;
  if (!career) return null;
  const [learner, policy, criteria, requirements, holland] = await Promise.all([
    loadLearnerProfile(userId),
    loadCareerPolicy(),
    loadCriteria(),
    fetchAllRequirements([careerId]),
    fetchAllHolland([careerId]),
  ]);
  const criteriaById = new Map(criteria.map((c) => [c.id, c]));
  const components = evaluateCareer(career, requirements, holland, learner, criteriaById, policy);
  const perceptionGaps = findPerceptionGaps(
    learner.selfPercentByDimension,
    learner.groupPercentByDimension,
    components.criteriaEvaluations.map((c) => ({ dimensionCode: c.dimensionCode, name: c.name ?? c.dimensionCode, careerWeight: c.careerWeight })),
    policy.perceptionGapPercent,
  );
  const status = careerStandardStatus({
    weightedCriteria: components.criteriaEvaluations.length,
    hasMainComponent: components.criteriaEvaluations.some((c) => c.groupCode !== 'G7'),
    hasG7Component: components.criteriaEvaluations.some((c) => c.groupCode === 'G7'),
    hasHollandProfile: holland.some((h) => h.jd_count > 0) || Boolean(career.holland_top3),
  });
  return {
    career,
    holland: holland.map((h) => ({ code: h.holland_code, strength: Number(h.strength), jdCount: h.jd_count })),
    components,
    perceptionGaps,
    standardNote: status.note,
    hasUserScores: learner.scoreByCriterionId.size > 0,
    policy,
  };
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(key(row)) ?? [];
    list.push(row);
    map.set(key(row), list);
  }
  return map;
}

export function saveCareerBookmark(careerId: string, kind: 'saved' | 'target') {
  return callRpc<void>('save_career_bookmark', { p_career_id: careerId, p_kind: kind });
}

export function listSavedCareers() {
  return callRpc<Array<{ career_id: string; kind: string; career_name: string; career_code: string }>>('list_my_saved_careers');
}

export function setCareerStatus(careerId: string, status: string) {
  return callRpc<void>('set_career_status', { p_career_id: careerId, p_status: status });
}

export const RIASEC_DEMO_NOTE =
  'G6 (Sở thích RIASEC) đang tính theo phương pháp thử nghiệm (Demo) vì công thức R05 chưa được BA/PO chốt. Phương pháp hiện tại được cấu hình ở tham số riasec_match_method.';

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
export async function loadCareerCompareRows(ids: string[], userId: string): Promise<CareerCompareFacts[]> {
  const unique = [...new Set(ids)].slice(0, 4);
  const rows = await Promise.all(unique.map(async (id) => {
    const [{ data: career, error }, detail] = await Promise.all([
      supabase
        .from('careers')
        .select('id, career_name, holland_top3, status, data_checked_at, field:career_fields(field_name)')
        .eq('id', id)
        .maybeSingle(),
      loadCareerDetail(id, userId),
    ]);
    if (error) throw error;
    if (!career || career.status !== 'published' || !detail) return null;

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
      fitPercent: detail.components.careerFitPercent,
      hasUserScores: detail.hasUserScores,
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
    for (const part of raw.split(/\r?\n|;|•|(?:^|\s)[-–]\s/)) {
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
