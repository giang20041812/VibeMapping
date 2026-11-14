import {
  careerComponents,
  careerStandardStatus,
  compareDecisionOptions,
  computeSubmissionTrust,
  coverageRatio,
  criterionFit,
  criterionGap,
  criterionPriority,
  deriveHollandTop3,
  evaluateRoadmapProgress,
  findPerceptionGaps,
  includedInStudentCareerMatrix,
  poolWeights,
  rankCareerRecommendations,
  raterWeight,
  supplementalUnderstandingScore,
  understandingPercent,
  weightedMean,
} from '../src/domain/assessmentRules';
import { generateRoadmapFromLibrary } from '../src/domain/roadmapGeneration';
import { parseTuition } from '../../supabase/scripts/tuition-parser';

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message ?? `Kỳ vọng ${String(expected)}, nhận được ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message?: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(message ?? `Kỳ vọng ${b}, nhận được ${a}`);
  }
}

function assertThrows(fn: () => unknown, message?: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(message ?? 'Kỳ vọng hàm ném lỗi nhưng không ném');
  }
}

let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}:`, error);
  }
}

check('R02B: Khi chưa chấm S_i thì mặc định S_i = 100 để không vô hiệu hóa bài 360°; khi chấm 0 điểm thì bằng 0', () => {
  const unreviewed = raterWeight({ understandingScore: 12, supplementalScore: null });
  assertEqual(unreviewed.status, 'unreviewed_defaulted');
  assertEqual(unreviewed.effectiveSupplementalScore, 100);
  assertEqual(unreviewed.weight, 10000);

  const scoredZero = raterWeight({ understandingScore: 12, supplementalScore: 0 });
  assertEqual(scoredZero.status, 'zero');
  assertEqual(scoredZero.weight, 0);
});

check('R02B & R03: Khi tất cả người chấm có TH = 3 (tổng w = 0), chia đều an toàn không chia cho 0', () => {
  const w1 = raterWeight({ understandingScore: 3, supplementalScore: 80 });
  const w2 = raterWeight({ understandingScore: 3, supplementalScore: 60 });
  assertEqual(w1.weight, 0);
  const pool = poolWeights([w1, w2]);
  assertEqual(pool.state, 'equal_fallback');
  assertDeepEqual(pool.shares, [0.5, 0.5]);
  assertEqual(understandingPercent(12), 100);
  assertEqual(weightedMean([{ value: 4, weight: 0 }]), null);
});

check('File 04: Công thức S_i chuẩn cho 4 nhóm người chấm (EA, SOLO, Carkhuff)', () => {
  const scoreFriend = supplementalUnderstandingScore('friend', {
    empathicAccuracy: [2, 2, 2, 2],
    solo: [5, 5, 5, 5],
    carkhuff: null,
  });
  assertEqual(scoreFriend, 100);

  const scoreParent = supplementalUnderstandingScore('parent', {
    empathicAccuracy: [2, 2, 2, 2],
    solo: [4, 4, 4, 4],
    carkhuff: 4,
  });
  assertEqual(scoreParent, 90);

  assertThrows(() =>
    supplementalUnderstandingScore('parent', {
      empathicAccuracy: [1, 1, 1, 1],
      solo: [3, 3, 3, 3],
      carkhuff: null,
    }),
  );
  assertThrows(() =>
    supplementalUnderstandingScore('self', {
      empathicAccuracy: [1, 1, 1, 1],
      solo: [3, 3, 3, 3],
    }),
  );
});

check('R10: Coverage(d) tính cùng đơn vị nhóm góc nhìn trên Ma trận tiêu chí', () => {
  assertEqual(coverageRatio(['self', 'parent', 'teacher', 'mentor'], ['self', 'teacher']), 0.5);
  assertEqual(coverageRatio(['self', 'parent', 'teacher'], ['self', 'teacher']), 2 / 3);
  assertEqual(coverageRatio([], ['self']), 0);
});

check('R16: JD đầu vào cho HSSV lấy L0, L1, L2 (Thực tập sinh + Fresher + Junior)', () => {
  assertEqual(includedInStudentCareerMatrix(0), true);
  assertEqual(includedInStudentCareerMatrix(1), true);
  assertEqual(includedInStudentCareerMatrix(2), true);
  assertEqual(includedInStudentCareerMatrix(3), false);
  assertEqual(includedInStudentCareerMatrix(null), false);
});

check('R05, R06, R07, R08, R13, R20: Tính đủ Fit, Gap, Priority, G6 RIASEC Match, Career Fit 40/30/30 và xếp hạng Top 5', () => {
  assertEqual(criterionFit(null, 3), null);
  assertEqual(criterionFit(4, 2), 1);
  assertEqual(criterionGap(2, 3.5), 1.5);
  assertEqual(criterionPriority(0.6), 'P1');
  assertEqual(criterionPriority(0.3), 'P2');
  assertEqual(criterionPriority(0.1), 'P3');
  assertEqual(criterionPriority(0), null);

  const holland = deriveHollandTop3({
    'D6.1': 4.5,
    'D6.2': 4.8,
    'D6.3': 3.9,
    'D6.4': 2.5,
    'D6.5': 3.0,
    'D6.6': 2.0,
  });
  assertEqual(holland, 'IRA');

  const comp = careerComponents(
    [
      { dimensionCode: 'D1.1', groupCode: 'G1', careerWeight: 0.6, requiredScore: 4, userScore: 4 },
      { dimensionCode: 'D2.1', groupCode: 'G2', careerWeight: 0.4, requiredScore: 4, userScore: 2 },
      { dimensionCode: 'D7.1', groupCode: 'G7', careerWeight: 1.0, requiredScore: 4, userScore: 3.6 },
    ],
    {
      learnerHollandTop3: 'IRA',
      careerHollandTop3: 'IRC',
    },
  );
  // G1-5: 0.6*1 + 0.4*0.5 = 0.8 (80%)
  // G6: khớp I, R = 2/3 = 66.67%
  // G7: 3.6/4 = 0.9 (90%)
  // Career Fit = 0.4*80 + 0.3*66.6667 + 0.3*90 = 32 + 20 + 27 = 79%
  assertEqual(comp.g1toG5.matchPercent, 80);
  assertEqual(comp.g7.matchPercent, 90);
  assertEqual(comp.careerFitPercent, 79);
  assertEqual(comp.rankBand, 79);

  const ranked = rankCareerRecommendations([
    { careerId: '1', careerCode: 'C01', careerName: 'Kỹ sư dữ liệu', hollandTop3: 'IRC', result: comp },
  ]);
  assertEqual(ranked.length, 1);
  assertEqual(ranked[0].fitPercent, 79);
  assertEqual(
    careerStandardStatus({
      weightedCriteria: 8,
      hasMainComponent: true,
      hasG7Component: true,
      hasHollandProfile: true,
    }).standardComplete,
    true,
  );
});

check('R14, BR-016, M06, M07: Trust Index trừ thời gian nghỉ > 120s, Lệch góc nhìn >= 25%, So sánh phương án & Tiến độ lộ trình', () => {
  const trust = computeSubmissionTrust({
    scores: [4, 5, 3, 4, 5, 2, 4],
    totalQuestions: 7,
    rawDurationSeconds: 160,
    idlePeriodsSeconds: [130], // > 120s nên trừ đi còn 30s >= 21s
  });
  assertEqual(trust.effectiveSeconds, 30);
  assertEqual(trust.trustLabel, 'trusted');

  const gaps = findPerceptionGaps(
    { 'D1.1': 50 },
    { parent: { 'D1.1': 80 }, friend: {}, teacher: {}, mentor: {}, others: {} },
    [{ dimensionCode: 'D1.1', name: 'Tư duy logic', careerWeight: 0.3 }],
  );
  assertEqual(gaps.length, 1);
  assertEqual(gaps[0].deltaPercent, 30);

  const compared = compareDecisionOptions(
    [
      { id: 'A', title: 'Phương án A (Trượt ngưỡng)', admissionFloor: 26, learnerScore: 24, tuitionPerYear: 20, careerFitPercent: 95, locationScore: 90 },
      { id: 'B', title: 'Phương án B (Đạt ngưỡng)', admissionFloor: 23, learnerScore: 24, tuitionPerYear: 25, careerFitPercent: 75, locationScore: 80 },
    ],
    { careerFit: 40, admission: 30, finance: 20, location: 10 },
    30,
  );
  // Phương án B (MET) luôn xếp hạng 1 trên phương án A (NOT_MET) dù A có Career Fit cao hơn (BR-019)
  assertEqual(compared[0].id, 'B');

  const prog = evaluateRoadmapProgress(
    [
      { id: 'm1', pillar: 'knowledge', title: 'Học SQL', done: false, weight: 2, dueDate: '2026-01-01', isCheckpoint: true },
      { id: 'm2', pillar: 'experience', title: 'Làm project', done: true, weight: 1, dueDate: '2026-12-01' },
    ],
    '2026-06-01',
  );
  assertEqual(prog.offTrack, true);

  const generated = generateRoadmapFromLibrary({
    startDay: '2026-01-01',
    targetDate: '2026-07-01',
    hoursPerWeek: 8,
    templates: [
      { id: 'k', pillar: 'knowledge', title: 'Học nền', durationWeeks: 2, hours: 6, criteriaId: null, repeatable: true },
      { id: 'e', pillar: 'experience', title: 'Thực hành', durationWeeks: 2, hours: 6, criteriaId: null, repeatable: true },
      { id: 'x', pillar: 'exploration', title: 'Khám phá', durationWeeks: 2, hours: 4, criteriaId: null, repeatable: true },
    ],
  });
  assertEqual(generated.some((m) => m.pillar === 'knowledge'), true);
  assertEqual(generated.some((m) => m.isCheckpoint), true);
});

check('M05 & M06 mới: Tách số học phí (kỳ, năm, tổng khóa, tín chỉ, miễn) & công thức so sánh phương án mới', () => {
  const M = 1_000_000;
  assertDeepEqual(parseTuition('- Học phí 1 kỳ học: 15 – 18 triệu đồng', 4).perYear, [30 * M, 36 * M]);
  assertDeepEqual(parseTuition('Học phí 1 năm học (khóa 2026): 27,38 triệu đồng', 4).perYear, [27.38 * M, 27.38 * M]);
  const totalParsed = parseTuition('- Tổng học phí 4 năm: 120 triệu đồng', 4);
  assertEqual(totalParsed.basis, 'total');
  assertEqual(totalParsed.isEstimate, true);
  assertDeepEqual(totalParsed.perYear, [30 * M, 30 * M]);
  const creditParsed = parseTuition('Đơn giá 2026-2027: 500.000 đ/tín chỉ; khung CTĐT 140 TC', 4);
  assertEqual(creditParsed.basis, 'credit');
  assertEqual(creditParsed.isEstimate, true);
  assertDeepEqual(creditParsed.perYear, [17.5 * M, 17.5 * M]);
  assertEqual(parseTuition('- Học phí 1 kỳ học: 0 VNĐ. Có hỗ trợ sinh hoạt phí', 4).status, 'free');

  // Công thức so sánh mới: thang 30 và thang 1200, chấm tài chính tương đối khi không nhập ngân sách, chấm thành phố ưu tiên
  const noBudget = compareDecisionOptions(
    [
      { id: 'P1', title: 'Trường A', admissionFloor: 30, learnerScore: 28, tuitionPerYear: 20, careerFitPercent: 80, locationScore: null, city: 'TP.HCM' },
      { id: 'P2', title: 'Trường B', admissionFloor: 900, learnerScore: 950, tuitionPerYear: 40, careerFitPercent: 75, locationScore: null, city: 'Hà Nội' },
    ],
    { careerFit: 3, admission: 3, finance: 2, location: 1 },
    null,
    'TP.HCM',
  );
  // P2 đạt ngưỡng (MET) nên xếp hạng 1 trên P1 (NOT_MET)
  assertEqual(noBudget[0].id, 'P2');
  assertEqual(noBudget[0].financeScore, 50); // 20 / 40 * 100 = 50
  assertEqual(noBudget[0].locationScore, 0); // Hà Nội != TP.HCM
  assertEqual(noBudget[0].criteriaCount, 4);

  assertEqual(noBudget[1].id, 'P1');
  assertEqual(noBudget[1].financeScore, 100); // Rẻ nhất nhóm = 100
  assertEqual(noBudget[1].locationScore, 100); // Cùng TP.HCM = 100
  // Thang 30 thiếu 2 điểm: 100 - (2/30)*450 = 70; trung bình có trọng số = (80*3 + 70*3 + 100*2 + 100*1)/9 = 750/9 = 83.3
  assertEqual(noBudget[1].totalScore, 83.3);
});

if (failed > 0) {
  throw new Error(`${failed} kiểm thử thất bại`);
}
console.log('Tất cả kiểm thử công thức R01–R21 & M01–M09 đã qua');
