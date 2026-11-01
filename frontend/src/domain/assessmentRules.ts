/**
 * Gói thuật toán chuẩn R01–R21, M01–M09 hợp nhất từ @cns/domain sang VibeMapping.
 * Đã gỡ bỏ 5 cổng chặn cứng (Hard Blockers) của CNS để chạy 100% trên dữ liệu thật của BA:
 *  1) R05/R08: Tính RIASEC Match(c) theo vector 6 chiều career_holland_profiles hoặc Top 3 chữ cái Holland (kèm nhãn chế độ Demo).
 *  2) R02B/R03: Khi chưa có Admin chấm tay câu hỏi mở, cho phép S_i mặc định = 100 (cấu hình được) và xử lý TH_i = 3 an toàn.
 *  3) R16/R06: Đối sánh trên tập tiêu chí nghề có CW(d,c) > 0 từ JD (L0–L2), không ép bắt buộc đủ 25/25 tiêu chí.
 *  4) M04/M06/M07: Cho phép HS/SV đặt tối đa 2 nghề mục tiêu và lập lộ trình không bị khóa bởi assertFamilyGoal.
 */

export type RaterGroup = 'self' | 'parent' | 'friend' | 'teacher' | 'mentor';
export type DisplayGroup = 'parent' | 'friend' | 'teacher' | 'mentor' | 'others';
export type CompetencyLevel = 'very_high' | 'high' | 'medium' | 'low';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type PriorityLevel = 'P1' | 'P2' | 'P3';

// ============================================================================
// 1. R02B & FILE 04: THẤU HIỂU NGỮ CẢNH (TH_i), ĐỊNH TÍNH (S_i) & TRỌNG SỐ (w_i)
// ============================================================================

export interface RaterWeightPolicy {
  /** Mặc định S_i = 100 khi chưa được Admin chấm tay câu hỏi mở để không làm mất điểm 360° */
  readonly defaultUnreviewedSupplementalScore: number | null;
  /** Sàn TH% khi TH_i = 3 (mặc định 0 theo công thức gốc, hoặc đặt > 0 theo cấu hình để vẫn có tỷ trọng nhỏ) */
  readonly minUnderstandingPercentFloor: number;
}

export const DEFAULT_RATER_WEIGHT_POLICY: RaterWeightPolicy = {
  defaultUnreviewedSupplementalScore: 100,
  minUnderstandingPercentFloor: 0,
};

export interface RaterWeightInput {
  /** TH_i trong [3, 12] từ 3 câu hỏi ngữ cảnh */
  understandingScore: number | null;
  /** S_i thang 0–100 từ chấm định tính EA/SOLO/Carkhuff; null là chưa chấm tay */
  supplementalScore: number | null;
}

export interface RaterWeight {
  status: 'unreviewed_defaulted' | 'unreviewed' | 'zero' | 'positive';
  understandingPercent: number;
  effectiveSupplementalScore: number | null;
  weight: number;
}

export function understandingPercent(
  understandingScore: number,
  floor = 0,
): number {
  if (!Number.isFinite(understandingScore) || understandingScore < 3 || understandingScore > 12) {
    throw new Error('TH_i phải nằm trong khoảng 3..12');
  }
  const raw = ((understandingScore - 3) / 9) * 100;
  return Math.max(raw, floor);
}

export function understandingLabel(score: number): 'low' | 'fair' | 'clear' | 'very_clear' {
  if (score <= 5) return 'low';
  if (score <= 8) return 'fair';
  if (score <= 10) return 'clear';
  return 'very_clear';
}

/**
 * R02B: w_i = TH%_i * S_i.
 * - Khi S_i chưa chấm (null) và policy cho phép mặc định 100 -> dùng 100 (trạng thái unreviewed_defaulted).
 * - Khi S_i đã chấm = 0 -> giữ đúng 0 (trạng thái zero).
 */
export function raterWeight(
  input: RaterWeightInput,
  policy: RaterWeightPolicy = DEFAULT_RATER_WEIGHT_POLICY,
): RaterWeight {
  const thScore = input.understandingScore ?? 3;
  const thPct = understandingPercent(thScore, policy.minUnderstandingPercentFloor);

  if (input.supplementalScore === null) {
    if (policy.defaultUnreviewedSupplementalScore === null) {
      return {
        status: 'unreviewed',
        understandingPercent: thPct,
        effectiveSupplementalScore: null,
        weight: 0,
      };
    }
    const s = policy.defaultUnreviewedSupplementalScore;
    const w = thPct * s;
    return {
      status: w > 0 ? 'unreviewed_defaulted' : 'zero',
      understandingPercent: thPct,
      effectiveSupplementalScore: s,
      weight: w,
    };
  }

  if (!Number.isFinite(input.supplementalScore) || input.supplementalScore < 0 || input.supplementalScore > 100) {
    throw new Error('S_i phải nằm trong khoảng 0..100 hoặc null');
  }
  const w = thPct * input.supplementalScore;
  return {
    status: w > 0 ? 'positive' : 'zero',
    understandingPercent: thPct,
    effectiveSupplementalScore: input.supplementalScore,
    weight: w,
  };
}

export interface WeightPool {
  state: 'empty' | 'equal_fallback' | 'included';
  unreviewedCount: number;
  zeroCount: number;
  /** Tỷ trọng chuẩn hóa của từng bài (tổng = 1). Khi tổng w = 0 (ví dụ mọi bài đều TH = 3), chia đều 1/n để không chia 0 và vẫn giữ đóng góp 360°. */
  shares: number[];
}

export function poolWeights(weights: RaterWeight[], allowEqualFallbackOnZero = true): WeightPool {
  const unreviewedCount = weights.filter((w) => w.status === 'unreviewed' || w.status === 'unreviewed_defaulted').length;
  const zeroCount = weights.filter((w) => w.status === 'zero').length;
  if (weights.length === 0) {
    return { state: 'empty', unreviewedCount: 0, zeroCount: 0, shares: [] };
  }
  const sum = weights.reduce((acc, item) => acc + Math.max(0, item.weight), 0);
  if (sum <= 0) {
    if (!allowEqualFallbackOnZero) {
      return { state: 'equal_fallback', unreviewedCount, zeroCount, shares: weights.map(() => 0) };
    }
    const equal = 1 / weights.length;
    return {
      state: 'equal_fallback',
      unreviewedCount,
      zeroCount,
      shares: weights.map(() => equal),
    };
  }
  return {
    state: 'included',
    unreviewedCount,
    zeroCount,
    shares: weights.map((item) => Math.max(0, item.weight) / sum),
  };
}

export interface SupplementalInput {
  empathicAccuracy: readonly number[];
  solo: readonly number[];
  carkhuff?: number | null;
}

/**
 * Công thức S_i từ điểm EA (0..2), SOLO (1..5), Carkhuff (1..5) theo tài liệu 04 mục 4.
 * Phụ huynh: 0.5*EA% + 0.25*SOLO% + 0.25*Carkhuff%
 * Bạn bè:    0.7*EA% + 0.3*SOLO%
 * Giáo viên: 0.4*EA% + 0.4*SOLO% + 0.2*Carkhuff%
 * Mentor:    0.35*EA% + 0.35*SOLO% + 0.3*Carkhuff%
 */
export function supplementalUnderstandingScore(group: RaterGroup, scores: SupplementalInput): number {
  if (group === 'self') throw new Error('Bản thân là mốc chuẩn EA, không tính S_i');
  if (
    scores.empathicAccuracy.length !== 4 ||
    scores.empathicAccuracy.some((v) => !Number.isInteger(v) || v < 0 || v > 2)
  ) {
    throw new Error('EA cần 4 điểm nguyên từ 0 đến 2');
  }
  if (
    scores.solo.length !== 4 ||
    scores.solo.some((v) => !Number.isInteger(v) || v < 1 || v > 5)
  ) {
    throw new Error('SOLO cần 4 điểm nguyên từ 1 đến 5');
  }
  const ea = (scores.empathicAccuracy.reduce((t, v) => t + v, 0) / 8) * 100;
  const solo = (scores.solo.reduce((t, v) => t + v, 0) / 20) * 100;
  if (group === 'friend') return Number((0.7 * ea + 0.3 * solo).toFixed(2));

  const carkhuff = scores.carkhuff;
  if (typeof carkhuff !== 'number' || !Number.isFinite(carkhuff) || carkhuff < 1 || carkhuff > 5) {
    throw new Error('Carkhuff cần điểm trong khoảng 1..5 cho Phụ huynh, Giáo viên và Người hướng dẫn');
  }
  const carkhuffPct = (carkhuff / 5) * 100;
  if (group === 'parent') return Number((0.5 * ea + 0.25 * solo + 0.25 * carkhuffPct).toFixed(2));
  if (group === 'teacher') return Number((0.4 * ea + 0.4 * solo + 0.2 * carkhuffPct).toFixed(2));
  return Number((0.35 * ea + 0.35 * solo + 0.3 * carkhuffPct).toFixed(2));
}

// ============================================================================
// 2. R03, R04, R10, R11, R14: COVERAGE, CONFIDENCE, HOLLAND TOP 3 & TRUST INDEX
// ============================================================================

/** R10: Coverage(d) = số nhóm góc nhìn hợp lệ / số nhóm góc nhìn được phân công trên Ma trận tiêu chí */
export function coverageRatio(assignedGroups: readonly string[], validGroups: readonly string[]): number {
  const assigned = new Set(assignedGroups);
  if (assigned.size === 0) return 0;
  let valid = 0;
  for (const g of new Set(validGroups)) {
    if (assigned.has(g)) valid += 1;
  }
  return Math.min(1, valid / assigned.size);
}

export function deriveConfidence(
  coverage: number,
  insufficientBasisRatio = 0,
  highThreshold = 0.8,
  mediumThreshold = 0.6,
  maxInsufficientRatio = 0.4,
): ConfidenceLevel {
  if (insufficientBasisRatio > maxInsufficientRatio) return 'low';
  if (coverage >= highThreshold) return 'high';
  if (coverage >= mediumThreshold) return 'medium';
  return 'low';
}

const HOLLAND_ORDER = 'RIASEC';
const DIMENSION_TO_HOLLAND: Readonly<Record<string, string>> = {
  'D6.1': 'R',
  'D6.2': 'I',
  'D6.3': 'A',
  'D6.4': 'S',
  'D6.5': 'E',
  'D6.6': 'C',
};

/** R05: Ánh xạ điểm D6.1–D6.6 sang mã Holland Top 3 (ưu tiên R > I > A > S > E > C khi bằng điểm) */
export function deriveHollandTop3(scoresByDimension: Readonly<Record<string, number | null>>): string | null {
  const entries = Object.entries(DIMENSION_TO_HOLLAND)
    .map(([dim, letter]) => ({ letter, score: scoresByDimension[dim] ?? null }))
    .filter((item): item is { letter: string; score: number } => typeof item.score === 'number' && Number.isFinite(item.score));
  if (entries.length < 3) return null;
  entries.sort(
    (a, b) => b.score - a.score || HOLLAND_ORDER.indexOf(a.letter) - HOLLAND_ORDER.indexOf(b.letter),
  );
  return entries
    .slice(0, 3)
    .map((e) => e.letter)
    .join('');
}

export interface TrustCalcInput {
  readonly scores: readonly (number | null)[];
  readonly totalQuestions: number;
  readonly rawDurationSeconds: number;
  readonly idlePeriodsSeconds?: readonly number[];
  readonly minSecondsPerQuestion?: number;
  readonly idleCutoffSeconds?: number;
  readonly dispersionScale?: number;
  readonly minCriteriaForDispersion?: number;
}

export interface TrustCalcResult {
  readonly effectiveSeconds: number;
  readonly timeRatio: number;
  readonly dispersionRatio: number;
  readonly answerRatio: number;
  readonly trustIndexPercent: number;
  readonly trustLabel: 'trusted' | 'consider' | 'suggest_reject';
  readonly qualityFlag: 'ok' | 'too_fast' | 'uniform_scores' | 'both';
}

/** R14: Trust Index = (T + D + A) / 3, có trừ các quãng nghỉ > P08 (120 giây) */
export function computeSubmissionTrust(input: TrustCalcInput): TrustCalcResult {
  const minSecPerQ = input.minSecondsPerQuestion ?? 3;
  const idleCutoff = input.idleCutoffSeconds ?? 120;
  const dispScale = input.dispersionScale ?? 0.3;
  const minCrit = input.minCriteriaForDispersion ?? 7;

  const omittedIdle = (input.idlePeriodsSeconds ?? [])
    .filter((sec) => sec > idleCutoff)
    .reduce((acc, sec) => acc + sec, 0);
  const effectiveSeconds = Math.max(0, input.rawDurationSeconds - omittedIdle);
  const minTotalSeconds = Math.max(1, input.totalQuestions * minSecPerQ);
  const timeRatio = Math.min(1, effectiveSeconds / minTotalSeconds);

  const validScores = input.scores.filter((s): s is number => typeof s === 'number' && Number.isFinite(s));
  const naCount = input.scores.length - validScores.length;
  const answerRatio = input.totalQuestions > 0 ? Math.max(0, 1 - naCount / input.totalQuestions) : 1;

  let dispersionRatio = 1;
  let uniform = false;
  if (validScores.length >= minCrit) {
    const counts = new Map<number, number>();
    for (const s of validScores) counts.set(s, (counts.get(s) ?? 0) + 1);
    const maxSame = Math.max(...counts.values());
    const p = maxSame / validScores.length;
    uniform = p === 1;
    dispersionRatio = Math.min(1, (1 - p) / dispScale);
  }

  const tooFast = timeRatio < 0.5;
  const rawTrust = (timeRatio + dispersionRatio + answerRatio) / 3;
  const trustIndexPercent = Number((rawTrust * 100).toFixed(2));
  const forceReject = uniform || tooFast;
  const trustLabel: TrustCalcResult['trustLabel'] =
    forceReject || rawTrust < 0.4 ? 'suggest_reject' : rawTrust >= 0.7 ? 'trusted' : 'consider';
  const qualityFlag: TrustCalcResult['qualityFlag'] =
    tooFast && uniform ? 'both' : tooFast ? 'too_fast' : uniform ? 'uniform_scores' : 'ok';

  return {
    effectiveSeconds,
    timeRatio: Number(timeRatio.toFixed(3)),
    dispersionRatio: Number(dispersionRatio.toFixed(3)),
    answerRatio: Number(answerRatio.toFixed(3)),
    trustIndexPercent,
    trustLabel,
    qualityFlag,
  };
}

// ============================================================================
// 3. R05, R06, R07, R08, R13, R16, R19, R20: FIT, GAP, PRIORITY & CAREER MATCHING
// ============================================================================

/** R16: JD đầu vào cho HSSV gồm L0 (Intern), L1 (Fresher) và L2 (Junior) trong dữ liệu 06_CAREER_PROFILE */
export function includedInStudentCareerMatrix(
  careerLevel: number | null,
  includeInternL0 = true,
): boolean {
  if (careerLevel === null) return false;
  return includeInternL0 ? careerLevel >= 0 && careerLevel <= 2 : careerLevel === 1 || careerLevel === 2;
}

export function criterionFit(userScore1to5: number | null, requiredScore1to5: number | null): number | null {
  if (userScore1to5 === null || requiredScore1to5 === null) return null;
  if (!(requiredScore1to5 > 0) || !Number.isFinite(userScore1to5)) return null;
  return Math.min(userScore1to5 / requiredScore1to5, 1);
}

export function criterionGap(userScore1to5: number | null, requiredScore1to5: number | null): number | null {
  if (userScore1to5 === null || requiredScore1to5 === null) return null;
  if (!Number.isFinite(userScore1to5) || !Number.isFinite(requiredScore1to5)) return null;
  return Number(Math.max(requiredScore1to5 - userScore1to5, 0).toFixed(2));
}

/** R07: Priority P1 (Gap >= 0.5), P2 (0.25 <= Gap < 0.5), P3 (0 < Gap < 0.25) */
export function criterionPriority(
  gap: number | null,
  p1Threshold = 0.5,
  p2Threshold = 0.25,
): PriorityLevel | null {
  if (gap === null || gap <= 0) return null;
  if (gap >= p1Threshold) return 'P1';
  if (gap >= p2Threshold) return 'P2';
  return 'P3';
}

/**
 * R05: Tính RIASEC Match(c) trong [0..1] (kèm nhãn chế độ thử nghiệm Demo).
 * Ưu tiên độ tương đồng trên hồ sơ 6 chiều R-I-A-S-E-C nếu nghề có career_holland_profiles;
 * nếu chỉ có mã Top 3 chữ cái thì dùng tỷ lệ chữ cái khớp / 3.
 */
export function computeRiasecMatch(input: {
  learnerDimensionScores1to5: Readonly<Record<string, number | null>>;
  learnerHollandTop3?: string | null;
  careerHollandProfile?: Readonly<Record<string, number>>;
  careerHollandTop3?: string | null;
}): { match: number | null; method: 'profile_6d_demo' | 'top3_overlap_demo' | 'missing' } {
  const letters = ['R', 'I', 'A', 'S', 'E', 'C'] as const;
  const dims = ['D6.1', 'D6.2', 'D6.3', 'D6.4', 'D6.5', 'D6.6'] as const;

  const learnerVec = dims.map((d) => {
    const s = input.learnerDimensionScores1to5[d];
    return typeof s === 'number' && Number.isFinite(s) ? Math.max(0, Math.min(1, s / 5)) : null;
  });

  if (input.careerHollandProfile && Object.keys(input.careerHollandProfile).length > 0) {
    let weightedSum = 0;
    let weightTotal = 0;
    for (let i = 0; i < letters.length; i += 1) {
      const lScore = learnerVec[i];
      const cStrength = input.careerHollandProfile[letters[i]] ?? 0;
      if (lScore !== null && cStrength > 0) {
        weightedSum += Math.min(lScore / Math.max(cStrength, 0.2), 1) * cStrength;
        weightTotal += cStrength;
      }
    }
    if (weightTotal > 0) {
      return { match: Number((weightedSum / weightTotal).toFixed(4)), method: 'profile_6d_demo' };
    }
  }

  const lTop3 =
    input.learnerHollandTop3 ??
    deriveHollandTop3(input.learnerDimensionScores1to5);
  const cTop3 = input.careerHollandTop3 ?? null;
  if (lTop3 && cTop3) {
    const cSet = new Set(cTop3.toUpperCase().split(''));
    const lChars = [...new Set(lTop3.toUpperCase().split(''))].slice(0, 3);
    const hits = lChars.filter((ch) => cSet.has(ch)).length;
    return {
      match: Number((hits / Math.max(1, Math.min(3, cSet.size))).toFixed(4)),
      method: 'top3_overlap_demo',
    };
  }

  return { match: null, method: 'missing' };
}

export interface CriterionRequirement {
  dimensionCode: string;
  name?: string;
  groupCode: string;
  careerWeight: number;
  requiredScore: number;
  userScore: number | null;
}

export interface CriterionEvaluation extends CriterionRequirement {
  fit: number | null;
  gap: number | null;
  priority: PriorityLevel | null;
  status: 'missing' | 'met' | 'gap';
  penaltyPoints: number;
}

export interface ComponentMatch {
  match: number | null;
  matchPercent: number | null;
  originalWeight: number;
  appliedWeight: number;
  usedCriteria: number;
  missingUserScores: number;
}

export interface CareerComponentResult {
  g1toG5: ComponentMatch;
  g6: ComponentMatch & { method: 'profile_6d_demo' | 'top3_overlap_demo' | 'missing' };
  g7: ComponentMatch;
  /** Điểm phù hợp nghề tổng hợp thang 0–100 (R08 + R13 chuẩn hóa lại trọng số khi thiếu thành phần) */
  careerFitPercent: number | null;
  /** Bậc xếp hạng 1% (P24): FLOOR(careerFitPercent / 1) */
  rankBand: number | null;
  /** Độ đầy đủ dữ liệu thành phần (tổng trọng số gốc của các thành phần có dữ liệu, 0..1) */
  componentCompleteness: number;
  highestWeightGap: number;
  unmetCriteriaCount: number;
  criteriaEvaluations: CriterionEvaluation[];
  status: 'ready' | 'insufficient_data';
  notice: string;
}

const MAIN_GROUPS = ['G1', 'G2', 'G3', 'G4', 'G5'] as const;

function calcComponent(rows: CriterionRequirement[], originalWeight: number): ComponentMatch {
  const applicable = rows.filter((row) => row.careerWeight > 0);
  const ready = applicable.filter((row) => criterionFit(row.userScore, row.requiredScore) !== null);
  const weightSum = ready.reduce((total, row) => total + row.careerWeight, 0);
  if (!(weightSum > 0)) {
    return {
      match: null,
      matchPercent: null,
      originalWeight,
      appliedWeight: 0,
      usedCriteria: 0,
      missingUserScores: applicable.length - ready.length,
    };
  }
  const match =
    ready.reduce((total, row) => total + (criterionFit(row.userScore, row.requiredScore) ?? 0) * row.careerWeight, 0) /
    weightSum;
  return {
    match: Number(match.toFixed(4)),
    matchPercent: Number((match * 100).toFixed(2)),
    originalWeight,
    appliedWeight: 0,
    usedCriteria: ready.length,
    missingUserScores: applicable.length - ready.length,
  };
}

/**
 * R08, R13, R19, R20: Tính đầy đủ Match G1–G5 (40%), Match G6 (30%), Match G7 (30%) và Career Fit tổng.
 * Nếu một thành phần chưa có dữ liệu của người học, tự động chuẩn hóa lại trọng số trên các thành phần còn lại (R13).
 */
export function careerComponents(
  rows: CriterionRequirement[],
  options?: {
    learnerDimensionScores1to5?: Readonly<Record<string, number | null>>;
    learnerHollandTop3?: string | null;
    careerHollandProfile?: Readonly<Record<string, number>>;
    careerHollandTop3?: string | null;
    weights?: { g1toG5?: number; g6?: number; g7?: number };
  },
): CareerComponentResult {
  const wMain = options?.weights?.g1toG5 ?? 0.4;
  const wG6 = options?.weights?.g6 ?? 0.3;
  const wG7 = options?.weights?.g7 ?? 0.3;

  const g1toG5 = calcComponent(
    rows.filter((row) => (MAIN_GROUPS as readonly string[]).includes(row.groupCode)),
    wMain,
  );
  const g7 = calcComponent(
    rows.filter((row) => row.groupCode === 'G7'),
    wG7,
  );

  const dimensionMap: Record<string, number | null> = { ...(options?.learnerDimensionScores1to5 ?? {}) };
  for (const r of rows) {
    if (dimensionMap[r.dimensionCode] === undefined) {
      dimensionMap[r.dimensionCode] = r.userScore;
    }
  }

  const riasec = computeRiasecMatch({
    learnerDimensionScores1to5: dimensionMap,
    learnerHollandTop3: options?.learnerHollandTop3,
    careerHollandProfile: options?.careerHollandProfile,
    careerHollandTop3: options?.careerHollandTop3,
  });

  const g6: CareerComponentResult['g6'] = {
    match: riasec.match,
    matchPercent: riasec.match !== null ? Number((riasec.match * 100).toFixed(2)) : null,
    originalWeight: wG6,
    appliedWeight: 0,
    usedCriteria: riasec.match !== null ? 6 : 0,
    missingUserScores: riasec.match !== null ? 0 : 6,
    method: riasec.method,
  };

  const activeParts: Array<{ key: 'g1toG5' | 'g6' | 'g7'; match: number; weight: number }> = [];
  if (g1toG5.match !== null && wMain > 0) activeParts.push({ key: 'g1toG5', match: g1toG5.match, weight: wMain });
  if (g6.match !== null && wG6 > 0) activeParts.push({ key: 'g6', match: g6.match, weight: wG6 });
  if (g7.match !== null && wG7 > 0) activeParts.push({ key: 'g7', match: g7.match, weight: wG7 });

  const componentCompleteness = Number(activeParts.reduce((s, p) => s + p.weight, 0).toFixed(4));
  let careerFitPercent: number | null = null;
  if (componentCompleteness > 0) {
    const weighted = activeParts.reduce((s, p) => s + p.match * (p.weight / componentCompleteness), 0);
    careerFitPercent = Number((weighted * 100).toFixed(2));
    if (g1toG5.match !== null) g1toG5.appliedWeight = Number((wMain / componentCompleteness).toFixed(4));
    if (g6.match !== null) g6.appliedWeight = Number((wG6 / componentCompleteness).toFixed(4));
    if (g7.match !== null) g7.appliedWeight = Number((wG7 / componentCompleteness).toFixed(4));
  }

  let highestImportance = -1;
  let highestWeightGap = 0;
  let unmetCriteriaCount = 0;

  const criteriaEvaluations: CriterionEvaluation[] = rows
    .filter((r) => r.careerWeight > 0)
    .map((r) => {
      const fit = criterionFit(r.userScore, r.requiredScore);
      const gap = criterionGap(r.userScore, r.requiredScore);
      const priority = criterionPriority(gap);
      const isMain = (MAIN_GROUPS as readonly string[]).includes(r.groupCode);
      const compApplied = isMain ? g1toG5.appliedWeight : g7.appliedWeight;
      const penaltyPoints =
        fit !== null ? Number(((1 - fit) * r.careerWeight * compApplied * 100).toFixed(2)) : 0;

      if (gap !== null && gap > 0) {
        unmetCriteriaCount += 1;
        if (r.careerWeight > highestImportance) {
          highestImportance = r.careerWeight;
          highestWeightGap = gap;
        } else if (r.careerWeight === highestImportance) {
          highestWeightGap = Math.max(highestWeightGap, gap);
        }
      }

      return {
        ...r,
        fit,
        gap,
        priority,
        status: fit === null ? 'missing' : gap && gap > 0 ? 'gap' : 'met',
        penaltyPoints,
      };
    });

  return {
    g1toG5,
    g6,
    g7,
    careerFitPercent,
    rankBand: careerFitPercent !== null ? Math.floor(careerFitPercent) : null,
    componentCompleteness,
    highestWeightGap: Number(highestWeightGap.toFixed(2)),
    unmetCriteriaCount,
    criteriaEvaluations,
    status: careerFitPercent !== null ? 'ready' : 'insufficient_data',
    notice:
      careerFitPercent !== null
        ? `Career Fit = 40% Năng lực (G1–G5) + 30% Sở thích (G6 – chế độ thử nghiệm Demo) + 30% Động lực (G7). Độ đầy đủ thành phần: ${Math.round(componentCompleteness * 100)}%.`
        : 'Chưa có điểm đánh giá của người học để tính độ phù hợp nghề.',
  };
}

export interface CareerRankItem {
  careerId: string;
  careerCode: string;
  careerName: string;
  hollandTop3: string | null;
  fitPercent: number;
  rankBand: number;
  highestWeightGap: number;
  unmetCriteriaCount: number;
  componentCompleteness: number;
  nearThreshold: boolean;
  result: CareerComponentResult;
}

/**
 * R20: Xếp hạng và lọc Top 5 nghề phù hợp:
 * - Xếp theo bậc 1% (rankBand giảm dần) -> highestWeightGap tăng dần -> unmetCriteriaCount tăng dần -> careerCode tăng dần.
 * - Lọc nghề có fitPercent > 50% (P06); nếu chưa đủ 5 nghề thì bổ sung Nghề gần đạt 40% <= fitPercent <= 50% (P25) kèm cờ nearThreshold.
 */
export function rankCareerRecommendations(
  candidates: readonly {
    careerId: string;
    careerCode: string;
    careerName: string;
    hollandTop3: string | null;
    result: CareerComponentResult;
  }[],
  maxResults = 5,
  minFitPercent = 50,
  nearFitPercent = 40,
): CareerRankItem[] {
  const valid: CareerRankItem[] = candidates.flatMap((c) => {
    if (c.result.careerFitPercent === null || c.result.rankBand === null) return [];
    return [
      {
        careerId: c.careerId,
        careerCode: c.careerCode,
        careerName: c.careerName,
        hollandTop3: c.hollandTop3,
        fitPercent: c.result.careerFitPercent,
        rankBand: c.result.rankBand,
        highestWeightGap: c.result.highestWeightGap,
        unmetCriteriaCount: c.result.unmetCriteriaCount,
        componentCompleteness: c.result.componentCompleteness,
        nearThreshold: c.result.careerFitPercent <= minFitPercent,
        result: c.result,
      },
    ];
  });

  valid.sort(
    (a, b) =>
      b.rankBand - a.rankBand ||
      a.highestWeightGap - b.highestWeightGap ||
      a.unmetCriteriaCount - b.unmetCriteriaCount ||
      a.careerCode.localeCompare(b.careerCode),
  );

  const passing = valid.filter((item) => item.fitPercent > minFitPercent);
  const near = valid.filter((item) => item.fitPercent <= minFitPercent && item.fitPercent >= nearFitPercent);
  return [...passing, ...near].slice(0, maxResults);
}

/** BR-016 / P28: Phát hiện tiêu chí có chênh lệch >= 25 điểm % giữa Tự đánh giá và một nhóm đánh giá (ẩn danh theo nhóm) */
export interface PerceptionGapItem {
  dimensionCode: string;
  dimensionName: string;
  group: DisplayGroup;
  selfPercent: number;
  groupPercent: number;
  deltaPercent: number;
}

export function findPerceptionGaps(
  selfScoresPercent: Readonly<Record<string, number | null>>,
  groupScoresPercent: Readonly<Record<DisplayGroup, Readonly<Record<string, number | null>>>>,
  criteriaMeta: readonly { dimensionCode: string; name: string; careerWeight?: number }[],
  thresholdPercentPoints = 25,
): PerceptionGapItem[] {
  const items: PerceptionGapItem[] = [];
  for (const meta of criteriaMeta) {
    if (meta.careerWeight !== undefined && meta.careerWeight <= 0) continue;
    const selfVal = selfScoresPercent[meta.dimensionCode];
    if (typeof selfVal !== 'number') continue;
    for (const [group, byDim] of Object.entries(groupScoresPercent) as [DisplayGroup, Readonly<Record<string, number | null>>][]) {
      const otherVal = byDim?.[meta.dimensionCode];
      if (typeof otherVal !== 'number') continue;
      const delta = Number((otherVal - selfVal).toFixed(1));
      if (Math.abs(delta) >= thresholdPercentPoints) {
        items.push({
          dimensionCode: meta.dimensionCode,
          dimensionName: meta.name,
          group,
          selfPercent: selfVal,
          groupPercent: otherVal,
          deltaPercent: delta,
        });
      }
    }
  }
  return items.sort((a, b) => Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent));
}

export function careerStandardStatus(input: {
  weightedCriteria: number;
  hasMainComponent: boolean;
  hasG7Component: boolean;
  hasHollandProfile: boolean;
}): {
  standardComplete: boolean;
  verificationLevel: 'per_jd_data';
  weightedCriteria: number;
  hasHollandProfile: boolean;
  note: string;
} {
  const complete = input.hasMainComponent && input.hasG7Component && input.hasHollandProfile && input.weightedCriteria > 0;
  return {
    standardComplete: complete,
    verificationLevel: 'per_jd_data',
    weightedCriteria: input.weightedCriteria,
    hasHollandProfile: input.hasHollandProfile,
    note: complete
      ? `Hồ sơ nghề tổng hợp từ dữ liệu JD (L0–L2) với ${input.weightedCriteria} tiêu chí trọng tâm có CW > 0 và mã Holland.`
      : 'Nghề đang chờ bổ sung đủ 3 thành phần (Năng lực G1–G5, Sở thích G6, Động lực G7) từ JD.',
  };
}

// ============================================================================
// 4. M06 DECISION COMPARISON & M07 ROADMAP PROGRESS (PORT TỪ @cns/domain)
// ============================================================================

export type EligibilityStatus = 'MET' | 'NOT_MET' | 'UNKNOWN';

export interface DecisionOptionInput {
  id: string;
  title: string;
  admissionFloor: number | null;
  learnerScore: number | null;
  tuitionPerYear: number | null;
  careerFitPercent: number | null;
  locationScore: number | null;
}

export interface RankedDecisionOption extends DecisionOptionInput {
  eligibility: EligibilityStatus;
  scoreGap: number | null;
  overBudget: boolean;
  financeScore: number | null;
  totalScore: number | null;
  rank: number;
  missingCriteria: string[];
}

/** BR-019 / BR-021 / BR-023: Phương án Chưa đáp ứng điều kiện bắt buộc không bao giờ xếp trên phương án Đáp ứng */
export function compareDecisionOptions(
  options: readonly DecisionOptionInput[],
  weights: { careerFit: number; admission: number; finance: number; location: number },
  budgetPerYear?: number | null,
): RankedDecisionOption[] {
  const order: Record<EligibilityStatus, number> = { MET: 0, UNKNOWN: 1, NOT_MET: 2 };
  const evaluated = options.map((opt) => {
    let eligibility: EligibilityStatus = 'UNKNOWN';
    let scoreGap: number | null = null;
    if (opt.admissionFloor !== null && opt.learnerScore !== null) {
      const diff = Number((opt.admissionFloor - opt.learnerScore).toFixed(2));
      if (diff > 0) {
        eligibility = 'NOT_MET';
        scoreGap = diff;
      } else {
        eligibility = 'MET';
        scoreGap = 0;
      }
    }

    const hasBudget = typeof budgetPerYear === 'number' && budgetPerYear > 0;
    const financeScore =
      !hasBudget || opt.tuitionPerYear === null
        ? null
        : opt.tuitionPerYear <= budgetPerYear
          ? 100
          : Math.max(0, 100 - ((opt.tuitionPerYear - budgetPerYear) / budgetPerYear) * 100);

    const admissionScore = eligibility === 'UNKNOWN' ? null : eligibility === 'MET' ? 100 : Math.max(0, 100 - (scoreGap ?? 0) * 15);
    const pairs: Array<{ key: string; val: number | null; w: number }> = [
      { key: 'Độ phù hợp nghề', val: opt.careerFitPercent, w: weights.careerFit },
      { key: 'Đáp ứng đầu vào', val: admissionScore, w: weights.admission },
      { key: 'Tài chính / Học phí', val: financeScore, w: hasBudget ? weights.finance : 0 },
      { key: 'Khu vực / Địa điểm', val: opt.locationScore, w: weights.location },
    ];

    let wSum = 0;
    let acc = 0;
    const missingCriteria: string[] = [];
    for (const p of pairs) {
      if (p.w <= 0) continue;
      if (p.val === null || p.val === undefined) {
        missingCriteria.push(p.key);
        continue;
      }
      wSum += p.w;
      acc += p.val * p.w;
    }

    return {
      ...opt,
      eligibility,
      scoreGap,
      overBudget: Boolean(hasBudget && opt.tuitionPerYear !== null && opt.tuitionPerYear > budgetPerYear!),
      financeScore: financeScore !== null ? Number(financeScore.toFixed(1)) : null,
      totalScore: wSum > 0 ? Number((acc / wSum).toFixed(1)) : null,
      rank: 0,
      missingCriteria,
    };
  });

  evaluated.sort(
    (a, b) => order[a.eligibility] - order[b.eligibility] || (b.totalScore ?? -1) - (a.totalScore ?? -1),
  );
  return evaluated.map((item, idx) => ({ ...item, rank: idx + 1 }));
}

export interface RoadmapMilestoneProgressInput {
  id: string;
  pillar: 'knowledge' | 'experience' | 'exploration';
  title: string;
  done: boolean;
  weight?: number;
  dueDate?: string | null;
  isCheckpoint?: boolean;
}

/** BR-027: Tính tiến độ 3 trụ cột và cảnh báo chệch hướng khi chậm > 20% hoặc trễ cột mốc quan trọng */
export function evaluateRoadmapProgress(
  milestones: readonly RoadmapMilestoneProgressInput[],
  todayIso = new Date().toISOString().slice(0, 10),
) {
  const totalWeight = milestones.reduce((s, m) => s + (m.weight ?? 1), 0);
  const completedWeight = milestones.filter((m) => m.done).reduce((s, m) => s + (m.weight ?? 1), 0);
  const dueWeight = milestones
    .filter((m) => m.dueDate && m.dueDate <= todayIso)
    .reduce((s, m) => s + (m.weight ?? 1), 0);

  const actualPercent = totalWeight > 0 ? Number(((completedWeight / totalWeight) * 100).toFixed(1)) : 0;
  const plannedPercent = totalWeight > 0 ? Number(((dueWeight / totalWeight) * 100).toFixed(1)) : 0;
  const delayPercent =
    dueWeight > 0 ? Number(Math.max(0, ((dueWeight - completedWeight) / dueWeight) * 100).toFixed(1)) : 0;
  const missedCheckpoints = milestones.filter(
    (m) => m.isCheckpoint && !m.done && m.dueDate && m.dueDate < todayIso,
  );

  const byPillar = (['knowledge', 'experience', 'exploration'] as const).map((pillar) => {
    const items = milestones.filter((m) => m.pillar === pillar);
    const w = items.reduce((s, m) => s + (m.weight ?? 1), 0);
    const doneW = items.filter((m) => m.done).reduce((s, m) => s + (m.weight ?? 1), 0);
    return {
      pillar,
      total: items.length,
      done: items.filter((m) => m.done).length,
      percent: w > 0 ? Number(((doneW / w) * 100).toFixed(1)) : 0,
    };
  });

  const offTrack = delayPercent > 20 || missedCheckpoints.length > 0;
  return {
    actualPercent,
    plannedPercent,
    delayPercent,
    offTrack,
    missedCheckpoints,
    byPillar,
  };
}

export function weightedMean(parts: Array<{ value: number; weight: number }>): number | null {
  const sum = parts.reduce((total, part) => total + part.weight, 0);
  if (!(sum > 0)) return null;
  return parts.reduce((total, part) => total + part.value * part.weight, 0) / sum;
}
