import {
  and,
  avg,
  cases,
  clampOf,
  cmp,
  count,
  div,
  maxOf,
  mul,
  na,
  notnull,
  num,
  or,
  param,
  ref,
  sub,
  sum,
  sumRows,
  sym,
  text,
} from '../build';
import type { FormulaDef, TestCase } from '../types';

const L = String.raw;

const tc = (
  name: string,
  inputs: TestCase['inputs'],
  expected: TestCase['expected'],
  extra: Partial<Pick<TestCase, 'tolerance' | 'engineFn' | 'engineArgs'>> = {},
): TestCase => ({ name, inputs, expected, ...extra });

// Hai phương án dùng chung cho các ca thử đối chiếu compareDecisionOptions
const OPTION_A = { id: 'P1', title: 'Trường A', admissionFloor: 30, learnerScore: 28, tuitionPerYear: 20, careerFitPercent: 80, locationScore: null, city: 'TP.HCM' };
const OPTION_B = { id: 'P2', title: 'Trường B', admissionFloor: 900, learnerScore: 950, tuitionPerYear: 40, careerFitPercent: 75, locationScore: null, city: 'Hà Nội' };
const WEIGHTS = { careerFit: 3, admission: 3, finance: 2, location: 1 };
const ZERO_WEIGHTS = { careerFit: 0, admission: 0, finance: 0, location: 0 };

const optionRows = (w: { career: string; admission: string; finance: string; location: string }) => [
  { option_w: sym(w.career), option_v: ref('career_fit') },
  { option_w: sym(w.admission), option_v: ref('admission_score') },
  { option_w: sym(w.finance), option_v: ref('finance_score') },
  { option_w: sym(w.location), option_v: ref('location_score') },
];
const optionReady = and(cmp('>', sym('option_w'), num(0)), notnull(sym('option_v')));
const WEIGHT_SYMS = { career: 'weight_career_fit', admission: 'weight_admission', finance: 'weight_finance', location: 'weight_location' };

const RELATIVE = { min_tuition: 20, max_tuition: 40 };

export const DECISION_FORMULAS: FormulaDef[] = [
  {
    code: 'score_gap',
    name: 'Điểm còn thiếu so với điểm chuẩn',
    group: 'decision_compare',
    output: { symbol: 'score_gap', latex: L`\text{Thiếu}`, name: 'Điểm còn thiếu so với điểm chuẩn', unit: 'điểm', min: 0 },
    expression: maxOf(sub(sym('floor_score'), sym('learner_exam_score')), num(0)),
    verification: 'pending_ba',
    specRef: 'FR06.01.05',
    tests: [
      tc('thiếu 2 điểm', { vars: { floor_score: 30, learner_exam_score: 28 } }, 2, { engineFn: 'decisionScoreGap', engineArgs: { option: OPTION_A } }),
      tc('đạt điểm chuẩn', { vars: { floor_score: 900, learner_exam_score: 950 } }, 0, { engineFn: 'decisionScoreGap', engineArgs: { option: OPTION_B } }),
    ],
  },
  {
    code: 'admission_score',
    name: 'Điểm đáp ứng đầu vào',
    group: 'decision_compare',
    output: { symbol: 'admission_score', latex: L`V_{\text{đầu vào}}`, name: 'Điểm đáp ứng đầu vào', unit: 'điểm', min: 0, max: 100 },
    // Thiếu 1% điểm chuẩn thì trừ 4,5 điểm: thang 30 tương đương trừ 15 điểm cho mỗi điểm thiếu
    expression: cases(
      [[cmp('=', ref('score_gap'), num(0)), num(100)]],
      maxOf(num(0), sub(num(100), mul(div(ref('score_gap'), sym('floor_score')), num(450)))),
    ),
    verification: 'pending_ba',
    specRef: 'FR06.01.05',
    tests: [
      tc('thiếu 2 trên thang 30', { vars: { floor_score: 30 }, refs: { score_gap: 2 } }, 70, { tolerance: 0.05, engineFn: 'decisionAdmission', engineArgs: { option: OPTION_A } }),
      tc('đạt điểm chuẩn', { vars: { floor_score: 900 }, refs: { score_gap: 0 } }, 100, { engineFn: 'decisionAdmission', engineArgs: { option: OPTION_B } }),
      tc('thiếu quá nhiều thì về 0', { vars: { floor_score: 30 }, refs: { score_gap: 10 } }, 0),
    ],
  },
  {
    code: 'finance_score_budget',
    name: 'Điểm tài chính theo ngân sách',
    group: 'decision_compare',
    output: { symbol: 'finance_score_budget', latex: L`V_{\text{tài chính}}^{B}`, name: 'Điểm tài chính khi có ngân sách', unit: 'điểm', min: 0, max: 100 },
    expression: cases(
      [[cmp('<=', sym('tuition'), sym('budget')), num(100)]],
      maxOf(num(0), sub(num(100), mul(div(sub(sym('tuition'), sym('budget')), sym('budget'), na), num(100)))),
    ),
    verification: 'pending_ba',
    specRef: 'FR06.01.05',
    tests: [
      tc('trong ngân sách', { vars: { tuition: 20, budget: 40 } }, 100, { engineFn: 'decisionFinance', engineArgs: { option: OPTION_A, others: [], budget: 40 } }),
      tc('vượt ngân sách 25%', { vars: { tuition: 50, budget: 40 } }, 75, { engineFn: 'decisionFinance', engineArgs: { option: { ...OPTION_A, tuitionPerYear: 50 }, others: [], budget: 40 } }),
    ],
  },
  {
    code: 'finance_score_relative',
    name: 'Điểm tài chính so với phương án rẻ nhất',
    group: 'decision_compare',
    output: { symbol: 'finance_score_relative', latex: L`V_{\text{tài chính}}^{H}`, name: 'Điểm tài chính khi không nhập ngân sách', unit: 'điểm', min: 0, max: 100 },
    expression: cases(
      [
        [cmp('=', sym('tuition'), num(0)), num(100)],
        [cmp('=', sym('min_tuition'), num(0)), maxOf(num(0), mul(sub(num(1), div(sym('tuition'), sym('max_tuition'), na)), num(100)))],
      ],
      clampOf(mul(div(sym('min_tuition'), sym('tuition'), na), num(100)), num(0), num(100)),
    ),
    verification: 'pending_ba',
    specRef: 'FR06.01.05',
    tests: [
      tc('phương án rẻ nhất', { vars: { tuition: 20, ...RELATIVE } }, 100, { engineFn: 'decisionFinance', engineArgs: { option: OPTION_A, others: [OPTION_B], budget: null } }),
      tc('đắt gấp đôi', { vars: { tuition: 40, ...RELATIVE } }, 50, { engineFn: 'decisionFinance', engineArgs: { option: OPTION_B, others: [OPTION_A], budget: null } }),
      tc('có phương án miễn phí', { vars: { tuition: 20, min_tuition: 0, max_tuition: 40 } }, 50, {
        engineFn: 'decisionFinance',
        engineArgs: { option: OPTION_A, others: [{ ...OPTION_B, tuitionPerYear: 0 }, { ...OPTION_B, id: 'P3', tuitionPerYear: 40 }], budget: null },
      }),
    ],
  },
  {
    code: 'finance_score',
    name: 'Điểm tài chính',
    group: 'decision_compare',
    output: { symbol: 'finance_score', latex: L`V_{\text{tài chính}}`, name: 'Điểm tài chính', unit: 'điểm', min: 0, max: 100 },
    expression: cases(
      [[and(notnull(sym('budget')), cmp('>', sym('budget'), num(0))), ref('finance_score_budget')]],
      ref('finance_score_relative'),
    ),
    verification: 'pending_ba',
    specRef: 'FR06.01.05',
    tests: [
      tc('có ngân sách', { vars: { budget: 40 }, refs: { finance_score_budget: 75, finance_score_relative: 50 } }, 75),
      tc('không nhập ngân sách', { vars: { budget: null }, refs: { finance_score_budget: 75, finance_score_relative: 50 } }, 50),
    ],
  },
  {
    code: 'location_score',
    name: 'Điểm địa điểm',
    group: 'decision_compare',
    output: { symbol: 'location_score', latex: L`V_{\text{địa điểm}}`, name: 'Điểm địa điểm', unit: 'điểm', min: 0, max: 100 },
    expression: cases(
      [
        [and(notnull(sym('city')), notnull(sym('preferred_city')), cmp('=', sym('city'), sym('preferred_city'))), num(100)],
        [and(notnull(sym('city')), notnull(sym('preferred_city'))), num(0)],
      ],
      na,
    ),
    verification: 'pending_ba',
    specRef: 'FR06.01.05',
    tests: [
      tc('cùng thành phố', { vars: { city: 'TP.HCM', preferred_city: 'TP.HCM' } }, 100, { engineFn: 'decisionLocation', engineArgs: { option: OPTION_A, preferredCity: 'TP.HCM' } }),
      tc('khác thành phố', { vars: { city: 'Hà Nội', preferred_city: 'TP.HCM' } }, 0, { engineFn: 'decisionLocation', engineArgs: { option: OPTION_B, preferredCity: 'TP.HCM' } }),
      tc('chưa chọn thành phố ưu tiên', { vars: { city: 'Hà Nội', preferred_city: null } }, null, { engineFn: 'decisionLocation', engineArgs: { option: OPTION_B, preferredCity: null } }),
    ],
  },
  {
    code: 'option_total_score',
    name: 'Điểm tổng hợp của phương án',
    group: 'decision_compare',
    output: { symbol: 'option_total_score', latex: L`V`, name: 'Điểm tổng hợp của phương án', unit: 'điểm', min: 0, max: 100 },
    // Tiêu chí chưa có dữ liệu bị bỏ khỏi cả tử và mẫu, phương án hiện rõ "Đủ x/4 tiêu chí"
    expression: div(
      sumRows('c', 'tiêu chí có dữ liệu', optionRows(WEIGHT_SYMS), mul(sym('option_w'), sym('option_v')), optionReady),
      sumRows('c', 'tiêu chí có dữ liệu', optionRows(WEIGHT_SYMS), sym('option_w'), optionReady),
      na,
    ),
    verification: 'pending_ba',
    specRef: 'FR06.01.05',
    tests: [
      tc(
        'đủ bốn tiêu chí, phương án A',
        { vars: { weight_career_fit: 3, weight_admission: 3, weight_finance: 2, weight_location: 1 }, refs: { career_fit: 80, admission_score: 70, finance_score: 100, location_score: 100 } },
        750 / 9,
        { tolerance: 0.05, engineFn: 'decisionTotal', engineArgs: { options: [OPTION_A, OPTION_B], weights: WEIGHTS, budget: null, preferredCity: 'TP.HCM', pick: 'P1' } },
      ),
      tc(
        'đủ bốn tiêu chí, phương án B',
        { vars: { weight_career_fit: 3, weight_admission: 3, weight_finance: 2, weight_location: 1 }, refs: { career_fit: 75, admission_score: 100, finance_score: 50, location_score: 0 } },
        625 / 9,
        { tolerance: 0.05, engineFn: 'decisionTotal', engineArgs: { options: [OPTION_A, OPTION_B], weights: WEIGHTS, budget: null, preferredCity: 'TP.HCM', pick: 'P2' } },
      ),
      tc(
        'thiếu tài chính và địa điểm',
        { vars: { weight_career_fit: 3, weight_admission: 3, weight_finance: 2, weight_location: 1 }, refs: { career_fit: 80, admission_score: 70, finance_score: null, location_score: null } },
        75,
        {
          tolerance: 0.05,
          engineFn: 'decisionTotal',
          engineArgs: { options: [{ ...OPTION_A, tuitionPerYear: null, city: null }], weights: WEIGHTS, budget: null, preferredCity: null, pick: 'P1' },
        },
      ),
      tc(
        'bỏ tiêu chí có mức quan trọng 0',
        { vars: { weight_career_fit: 3, weight_admission: 0, weight_finance: 0, weight_location: 0 }, refs: { career_fit: 80, admission_score: 70, finance_score: 100, location_score: 100 } },
        80,
        { tolerance: 0.05, engineFn: 'decisionTotal', engineArgs: { options: [OPTION_A], weights: { ...ZERO_WEIGHTS, careerFit: 3 }, budget: null, preferredCity: null, pick: 'P1' } },
      ),
    ],
  },
];

export const SCHOOL_MAJOR_FORMULAS: FormulaDef[] = [
  {
    code: 'tuition_per_year_from_semester',
    name: 'Học phí một năm tính từ học phí một kỳ',
    group: 'school_major',
    output: { symbol: 'tuition_per_year_from_semester', latex: L`H_{\text{năm}}`, name: 'Học phí một năm', unit: 'đồng', min: 0 },
    expression: mul(sym('tuition_per_semester'), sym('semesters_per_year')),
    verification: 'approved',
    tests: [
      tc('29,5 triệu mỗi kỳ, hai kỳ', { vars: { tuition_per_semester: 29_500_000, semesters_per_year: 2 } }, 59_000_000, {
        tolerance: 1,
        engineFn: 'tuitionPerYear',
        engineArgs: { text: '- Học phí 1 kỳ học: ≈29,5 triệu đồng', studyYears: null },
      }),
      tc('ba kỳ mỗi năm', { vars: { tuition_per_semester: 12_180_000, semesters_per_year: 3 } }, 36_540_000, {
        tolerance: 1,
        engineFn: 'tuitionPerYear',
        engineArgs: { text: '- Học phí 1 kỳ học: 12.180.000 đồng (3 kỳ/năm)', studyYears: null },
      }),
    ],
  },
  {
    code: 'tuition_per_year_from_total',
    name: 'Học phí một năm chia từ tổng học phí toàn khóa',
    group: 'school_major',
    output: { symbol: 'tuition_per_year_from_total', latex: L`H_{\text{năm}}'`, name: 'Học phí một năm (ước tính)', unit: 'đồng', min: 0 },
    expression: div(sym('tuition_total'), sym('study_years')),
    verification: 'approved',
    tests: [
      tc('308 triệu trong bốn năm', { vars: { tuition_total: 308_000_000, study_years: 4 } }, 77_000_000, {
        tolerance: 1,
        engineFn: 'tuitionPerYear',
        engineArgs: { text: '- Tổng học phí 4 năm: 308 – 320 triệu đồng', studyYears: null },
      }),
      tc('74 triệu trong bốn năm', { vars: { tuition_total: 74_000_000, study_years: 4 } }, 18_500_000, {
        tolerance: 1,
        engineFn: 'tuitionPerYear',
        engineArgs: { text: '- Tổng học phí toàn khóa: 74.000.000 VNĐ (ước tính theo thời gian đào tạo 4 năm).', studyYears: null },
      }),
    ],
  },
];

const PILLAR_MILESTONES = [
  { id: 'm1', pillar: 'knowledge', title: 'Hoạt động 1', done: true, weight: 1 },
  { id: 'm2', pillar: 'knowledge', title: 'Hoạt động 2', done: false, weight: 2 },
  { id: 'm3', pillar: 'knowledge', title: 'Hoạt động 3', done: true, weight: 1 },
];
const ROADMAP_RANGE = { startIso: '2026-01-01', targetIso: '2026-05-01', todayIso: '2026-03-02' };
const ROADMAP_MILESTONES = [
  { id: 'a', pillar: 'knowledge', title: 'A', done: true, weight: 1, dueDate: '2026-02-01' },
  { id: 'b', pillar: 'knowledge', title: 'B', done: false, weight: 1, dueDate: '2026-04-01' },
  { id: 'c', pillar: 'exploration', title: 'C', done: false, weight: 1, dueDate: '2026-04-15' },
];

export const PROFILE_ROADMAP_FORMULAS: FormulaDef[] = [
  {
    code: 'competency_status',
    name: 'Trạng thái đạt của một tiêu chí',
    group: 'profile_roadmap',
    output: { symbol: 'competency_status', latex: L`\text{Trạng thái}`, name: 'Trạng thái đạt của tiêu chí' },
    expression: cases(
      [
        [and(notnull(ref('criterion_gap')), cmp('=', ref('criterion_gap'), num(0))), text('Đạt')],
        [and(notnull(ref('criterion_gap')), cmp('<', ref('criterion_gap'), param('gap_large_level'))), text('Gần đạt')],
        [notnull(ref('criterion_gap')), text('Chưa đạt')],
      ],
      na,
    ),
    verification: 'pending_ba',
    specRef: 'Mục 5.3 STT 5',
    tests: [
      tc('không thiếu', { vars: { gap_large_level: 1 }, refs: { criterion_gap: 0 } }, 'Đạt'),
      tc('thiếu dưới một mức', { vars: { gap_large_level: 1 }, refs: { criterion_gap: 0.5 } }, 'Gần đạt'),
      tc('thiếu từ một mức', { vars: { gap_large_level: 1 }, refs: { criterion_gap: 1 } }, 'Chưa đạt'),
      tc('chưa có điểm', { vars: { gap_large_level: 1 }, refs: { criterion_gap: null } }, null),
    ],
  },
  {
    code: 'overall_met_ratio',
    name: 'Mức đạt tổng thể so với vị trí',
    group: 'profile_roadmap',
    output: { symbol: 'overall_met_ratio', latex: L`\text{Đạt}\%`, name: 'Mức đạt tổng thể so với vị trí', unit: '%', min: 0, max: 100 },
    expression: mul(
      div(
        count('i', 'criteria', 'tiêu chí đã đạt', and(notnull(ref('criterion_gap')), cmp('=', ref('criterion_gap'), num(0)))),
        count('i', 'criteria', 'tiêu chí của nghề'),
        na,
      ),
      num(100),
    ),
    verification: 'pending_ba',
    specRef: 'UI_08',
    tests: [
      tc('ba trên năm tiêu chí', { sets: { criteria: [{ criterion_gap: 0 }, { criterion_gap: 0 }, { criterion_gap: 1 }, { criterion_gap: 0.5 }, { criterion_gap: 0 }] } }, 60),
      tc('nghề chưa có tiêu chí', { sets: { criteria: [] } }, null),
    ],
  },
  {
    code: 'roadmap_pillar_percent',
    name: 'Tiến độ một trụ cột lộ trình',
    group: 'profile_roadmap',
    output: { symbol: 'roadmap_pillar_percent', latex: L`R_{p}`, name: 'Tiến độ trụ cột p', unit: '%', min: 0, max: 100 },
    expression: mul(
      div(
        sum('k', 'milestones', 'hoạt động đã xong', sym('milestone_weight'), cmp('=', sym('milestone_done'), num(1))),
        sum('k', 'milestones', 'hoạt động trong trụ cột', sym('milestone_weight')),
        na,
      ),
      num(100),
    ),
    verification: 'approved',
    specRef: 'BR-027',
    tests: [
      tc(
        'hai trên bốn phần việc xong',
        { sets: { milestones: [{ milestone_weight: 1, milestone_done: 1 }, { milestone_weight: 2, milestone_done: 0 }, { milestone_weight: 1, milestone_done: 1 }] } },
        50,
        { engineFn: 'roadmapPillar', engineArgs: { milestones: PILLAR_MILESTONES } },
      ),
      tc('trụ cột chưa có hoạt động', { sets: { milestones: [] } }, null),
    ],
  },
  {
    code: 'roadmap_actual_percent',
    name: 'Tiến độ thực tế của lộ trình',
    group: 'profile_roadmap',
    output: { symbol: 'roadmap_actual_percent', latex: L`R_{\text{thực tế}}`, name: 'Tiến độ thực tế', unit: '%', min: 0, max: 100 },
    expression: avg('p', 'pillars', 'trụ cột có hoạt động', ref('roadmap_pillar_percent')),
    verification: 'approved',
    specRef: 'BR-027',
    tests: [
      tc('ba trụ cột, một trụ chưa có hoạt động', { sets: { pillars: [{ roadmap_pillar_percent: 50 }, { roadmap_pillar_percent: null }, { roadmap_pillar_percent: 100 }] } }, 75, {
        engineFn: 'roadmapActual',
        engineArgs: {
          milestones: [
            { id: 'a', pillar: 'knowledge', title: 'A', done: true, weight: 1 },
            { id: 'b', pillar: 'knowledge', title: 'B', done: false, weight: 1 },
            { id: 'c', pillar: 'exploration', title: 'C', done: true, weight: 1 },
          ],
        },
      }),
    ],
  },
  {
    code: 'roadmap_planned_percent',
    name: 'Tiến độ kế hoạch của lộ trình',
    group: 'profile_roadmap',
    output: { symbol: 'roadmap_planned_percent', latex: L`R_{\text{kế hoạch}}`, name: 'Tiến độ theo kế hoạch', unit: '%', min: 0, max: 100 },
    expression: mul(clampOf(div(sym('elapsed_days'), sym('total_days'), num(1)), num(0), num(1)), num(100)),
    verification: 'approved',
    specRef: 'BR-027',
    tests: [
      tc('30 trên 120 ngày', { vars: { elapsed_days: 30, total_days: 120 } }, 25, {
        engineFn: 'roadmapPlanned',
        engineArgs: { milestones: ROADMAP_MILESTONES, ...ROADMAP_RANGE, todayIso: '2026-01-31' },
      }),
      tc('quá đích thì giữ 100', { vars: { elapsed_days: 200, total_days: 120 } }, 100),
      tc('đích trùng ngày bắt đầu', { vars: { elapsed_days: 0, total_days: 0 } }, 100),
    ],
  },
  {
    code: 'roadmap_delay',
    name: 'Độ chậm tiến độ',
    group: 'profile_roadmap',
    output: { symbol: 'roadmap_delay', latex: L`\text{Chậm}`, name: 'Độ chậm so với kế hoạch', unit: 'điểm %', min: 0, max: 100 },
    expression: maxOf(num(0), sub(ref('roadmap_planned_percent'), ref('roadmap_actual_percent'))),
    verification: 'approved',
    specRef: 'BR-027',
    tests: [
      tc('kế hoạch 50, thực tế 25', { refs: { roadmap_planned_percent: 50, roadmap_actual_percent: 25 } }, 25, {
        engineFn: 'roadmapDelay',
        engineArgs: { milestones: ROADMAP_MILESTONES, ...ROADMAP_RANGE },
      }),
      tc('làm vượt kế hoạch', { refs: { roadmap_planned_percent: 30, roadmap_actual_percent: 60 } }, 0),
    ],
  },
  {
    code: 'roadmap_off_track',
    name: 'Cảnh báo chệch hướng',
    group: 'profile_roadmap',
    output: { symbol: 'roadmap_off_track', latex: L`\text{Hướng đi}`, name: 'Cảnh báo chệch hướng' },
    expression: cases([[or(cmp('>', ref('roadmap_delay'), num(20)), cmp('>', sym('missed_checkpoints'), num(0))), text('Chệch hướng')]], text('Đúng hướng')),
    verification: 'approved',
    specRef: 'BR-027',
    tests: [
      tc('chậm 25 điểm', { vars: { missed_checkpoints: 0 }, refs: { roadmap_delay: 25 } }, 'Chệch hướng', {
        engineFn: 'roadmapOffTrack',
        engineArgs: { milestones: ROADMAP_MILESTONES, ...ROADMAP_RANGE },
      }),
      tc('đúng tiến độ', { vars: { missed_checkpoints: 0 }, refs: { roadmap_delay: 0 } }, 'Đúng hướng', {
        engineFn: 'roadmapOffTrack',
        engineArgs: { milestones: [{ id: 'a', pillar: 'knowledge', title: 'A', done: true, weight: 1 }] },
      }),
      tc('quá hạn một cột mốc chính', { vars: { missed_checkpoints: 1 }, refs: { roadmap_delay: 5 } }, 'Chệch hướng', {
        engineFn: 'roadmapOffTrack',
        engineArgs: {
          milestones: [{ id: 'a', pillar: 'knowledge', title: 'A', done: false, weight: 1, dueDate: '2026-02-01', isCheckpoint: true }],
          todayIso: '2026-03-02',
        },
      }),
    ],
  },
];
