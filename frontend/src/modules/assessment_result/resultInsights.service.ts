import { deriveHollandTop3 } from '../../domain/assessmentRules';
import { db } from '../../lib/rpc';

export type SourceKey = 'self' | 'parent' | 'friend' | 'teacher' | 'mentor' | 'others' | 'combined_360';

export interface CriterionInsight {
  criteriaId: string;
  dimensionCode: string;
  name: string;
  groupCode: string;
  bySource: Partial<Record<SourceKey, number>>;
  coverage: number | null;
  confidence: 'high' | 'medium' | 'low' | null;
  level: 'very_high' | 'high' | 'medium' | 'low' | null;
}

export type ValidityKind = 'active' | 'reassess' | 'policy_pending';

export interface ResultInsights {
  resultId: string;
  statusLabel: string;
  calculatedAt: string | null;
  finalizedAt: string | null;
  qualitativeWeightStatus: string;
  criteria: CriterionInsight[];
  sourcesPresent: SourceKey[];
  holland: string | null;
  coreValues: string[];
  evidences: { kind: string; content: string }[];
  validity: { kind: ValidityKind; expiresAt: string | null; months: number; verification: string };
  versions: Record<string, string | null> | null;
}

export interface ResultHistoryItem {
  id: string;
  resultId: string;
  statusLabel: string;
  createdAt: string;
  groupPercents: Record<string, number>;
  versions: Record<string, string | null> | null;
}

const SOURCE_ORDER: SourceKey[] = ['self', 'parent', 'friend', 'teacher', 'mentor', 'others', 'combined_360'];

function addMonths(iso: string, months: number): Date {
  const date = new Date(iso);
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export async function loadResultInsights(userId: string, includePrivate: boolean): Promise<ResultInsights | null> {
  const { data: result, error } = await db
    .from('assessment_results')
    .select('id, session_id, status_label, calculated_at, finalized_at, qualitative_weight_status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!result) return null;

  const [criteriaRes, groupsRes, scoresRes, paramsRes, snapshotRes] = await Promise.all([
    db.from('criteria').select('id, dimension_code, name, group_id, sort_order').eq('is_active', true).order('sort_order'),
    db.from('criteria_groups').select('id, group_code'),
    db
      .from('assessment_result_scores')
      .select('criteria_id, score_source, score_1_5, score_percent, coverage, confidence, competency_level')
      .eq('result_id', result.id),
    db
      .from('operation_parameters')
      .select('param_code, param_value, verification_level')
      .in('param_code', ['result_validity_months'])
      .eq('is_current', true),
    db
      .from('assessment_result_snapshots')
      .select('snapshot_data')
      .eq('result_id', result.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  for (const response of [criteriaRes, groupsRes, scoresRes, paramsRes, snapshotRes]) {
    if (response.error) throw response.error;
  }

  const groupCode = new Map((groupsRes.data ?? []).map((g) => [g.id, g.group_code]));
  const byCriterion = new Map<string, CriterionInsight>();
  for (const c of criteriaRes.data ?? []) {
    byCriterion.set(c.id, {
      criteriaId: c.id,
      dimensionCode: c.dimension_code,
      name: c.name,
      groupCode: groupCode.get(c.group_id) ?? '',
      bySource: {},
      coverage: null,
      confidence: null,
      level: null,
    });
  }
  const present = new Set<SourceKey>();
  const score1to5: Record<string, number | null> = {};
  for (const row of scoresRes.data ?? []) {
    const item = byCriterion.get(row.criteria_id);
    if (!item || row.score_percent === null) continue;
    const source = row.score_source as SourceKey;
    item.bySource[source] = Number(row.score_percent);
    present.add(source);
    const isHeadline = source === 'combined_360' || (source === 'self' && item.bySource.combined_360 === undefined);
    if (isHeadline) {
      item.coverage = row.coverage === null ? item.coverage : Number(row.coverage);
      item.confidence = (row.confidence as CriterionInsight['confidence']) ?? item.confidence;
      item.level = (row.competency_level as CriterionInsight['level']) ?? item.level;
      score1to5[item.dimensionCode] = row.score_1_5 === null ? null : Number(row.score_1_5);
    }
  }

  let coreValues: string[] = [];
  let evidences: { kind: string; content: string }[] = [];
  if (includePrivate) {
    const [coreRes, evidenceRes] = await Promise.all([
      db.from('assessment_core_values').select('priority_rank, core_values(name)').eq('session_id', result.session_id).order('priority_rank'),
      db
        .from('assessment_evidences')
        .select('grade_point_average, certificates, achievements')
        .eq('session_id', result.session_id)
        .maybeSingle(),
    ]);
    if (!coreRes.error) {
      coreValues = (coreRes.data ?? []).map((row) => {
        const value = (row as unknown as { core_values: { name: string } | { name: string }[] | null }).core_values;
        return Array.isArray(value) ? value[0]?.name ?? '' : value?.name ?? '';
      }).filter(Boolean);
    }
    const evidence = evidenceRes.error ? null : evidenceRes.data;
    if (evidence) {
      const textOf = (item: unknown) =>
        typeof item === 'string' ? item : String((item as { name?: string; title?: string })?.name ?? (item as { title?: string })?.title ?? '');
      if (evidence.grade_point_average !== null) evidences.push({ kind: 'Điểm trung bình', content: String(evidence.grade_point_average) });
      for (const item of (evidence.certificates as unknown[]) ?? []) evidences.push({ kind: 'Chứng chỉ', content: textOf(item) });
      for (const item of (evidence.achievements as unknown[]) ?? []) evidences.push({ kind: 'Thành tích', content: textOf(item) });
      evidences = evidences.filter((e) => e.content);
    }
  }

  const monthsRow = (paramsRes.data ?? []).find((p) => p.param_code === 'result_validity_months');
  const months = typeof monthsRow?.param_value === 'number' ? monthsRow.param_value : 12;
  const verification = (monthsRow as { verification_level?: string } | undefined)?.verification_level ?? 'demo';
  const anchor = result.finalized_at ?? result.calculated_at;
  const expires = anchor ? addMonths(anchor, months) : null;
  const validityKind: ValidityKind = !expires ? 'policy_pending' : expires.getTime() <= Date.now() ? 'reassess' : 'active';

  const snapshot = (snapshotRes.data?.snapshot_data ?? null) as { versions?: Record<string, string | null> } | null;

  return {
    resultId: result.id,
    statusLabel: result.status_label,
    calculatedAt: result.calculated_at,
    finalizedAt: result.finalized_at,
    qualitativeWeightStatus: result.qualitative_weight_status,
    criteria: [...byCriterion.values()],
    sourcesPresent: SOURCE_ORDER.filter((s) => present.has(s)),
    holland: deriveHollandTop3(score1to5),
    coreValues,
    evidences,
    validity: { kind: validityKind, expiresAt: expires?.toISOString() ?? null, months, verification },
    versions: snapshot?.versions ?? null,
  };
}

export async function loadResultHistory(userId: string): Promise<ResultHistoryItem[]> {
  const [{ data, error }, { data: groups, error: groupError }] = await Promise.all([
    db
      .from('assessment_result_snapshots')
      .select('id, result_id, status_label, created_at, snapshot_data')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    db.from('criteria_groups').select('id, group_code'),
  ]);
  if (error) throw error;
  if (groupError) throw groupError;
  const codeOf = new Map((groups ?? []).map((g) => [g.id, g.group_code]));
  return (data ?? []).map((row) => {
    const snapshot = row.snapshot_data as {
      group_scores?: { group_id: string; source: string; score_percent: number | null }[];
      versions?: Record<string, string | null>;
    };
    const groupPercents: Record<string, number> = {};
    for (const gs of snapshot.group_scores ?? []) {
      const code = codeOf.get(gs.group_id);
      if (!code || gs.score_percent === null) continue;
      if (gs.source === 'combined_360' || groupPercents[code] === undefined) groupPercents[code] = Number(gs.score_percent);
    }
    return {
      id: row.id,
      resultId: row.result_id,
      statusLabel: row.status_label,
      createdAt: row.created_at,
      groupPercents,
      versions: snapshot.versions ?? null,
    };
  });
}
