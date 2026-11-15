import {
  and,
  cases,
  cmp,
  div,
  floorOf,
  maxOf,
  minOf,
  mul,
  na,
  notnull,
  num,
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

const row = (dimensionCode: string, groupCode: string, careerWeight: number, requiredScore: number, userScore: number | null) => ({
  dimensionCode,
  groupCode,
  careerWeight,
  requiredScore,
  userScore,
});

/** Hai dòng G1–G5 và một dòng G7 dùng chung cho các ca thử đối chiếu careerComponents */
const MAIN_ROWS = [row('D1.1', 'G1', 0.6, 5, 4), row('D2.1', 'G2', 0.4, 3, 3), row('D3.1', 'G3', 0.5, 4, null)];
const MOTIVATION_ROW = row('D7.1', 'G7', 1, 4, 2);
const HOLLAND_LEARNER = { 'D6.1': 2, 'D6.2': 1, 'D6.3': 2, 'D6.4': 3, 'D6.5': 1, 'D6.6': 1 };
const HOLLAND_CAREER = { R: 0.5, I: 0.3, A: 0.1, S: 0, E: 0.1, C: 0 };

const readyCriterion = (fit: string) => and(cmp('>', sym('career_weight'), num(0)), notnull(ref(fit)));

export const CAREER_FORMULAS: FormulaDef[] = [
  {
    code: 'criterion_fit',
    name: 'Mức đáp ứng một tiêu chí',
    group: 'career_fit',
    output: { symbol: 'criterion_fit', latex: L`Fit_{i}`, name: 'Mức đáp ứng tiêu chí i của nghề', min: 0, max: 1 },
    expression: minOf(div(sym('user_score'), sym('required_score')), num(1)),
    verification: 'approved',
    specRef: 'SRS R06',
    tests: [
      tc('chưa đủ mức yêu cầu', { vars: { user_score: 4, required_score: 5 } }, 0.8, { engineFn: 'criterionFit', engineArgs: { user: 4, required: 5 } }),
      tc('vượt mức yêu cầu', { vars: { user_score: 5, required_score: 4 } }, 1, { engineFn: 'criterionFit', engineArgs: { user: 5, required: 4 } }),
      tc('chưa có điểm người học', { vars: { user_score: null, required_score: 4 } }, null, { engineFn: 'criterionFit', engineArgs: { user: null, required: 4 } }),
    ],
  },
  {
    code: 'criterion_gap',
    name: 'Khoảng thiếu một tiêu chí',
    group: 'career_fit',
    output: { symbol: 'criterion_gap', latex: L`Gap_{i}`, name: 'Khoảng thiếu tại tiêu chí i', unit: 'mức', min: 0, max: 4 },
    expression: maxOf(sub(sym('required_score'), sym('user_score')), num(0)),
    verification: 'approved',
    specRef: 'SRS R06',
    tests: [
      tc('thiếu một mức', { vars: { user_score: 3.5, required_score: 4.5 } }, 1, { engineFn: 'criterionGap', engineArgs: { user: 3.5, required: 4.5 } }),
      tc('đã đạt', { vars: { user_score: 5, required_score: 4 } }, 0, { engineFn: 'criterionGap', engineArgs: { user: 5, required: 4 } }),
      tc('chưa có điểm người học', { vars: { user_score: null, required_score: 4 } }, null, { engineFn: 'criterionGap', engineArgs: { user: null, required: 4 } }),
    ],
  },
  {
    code: 'criterion_priority',
    name: 'Mức ưu tiên phát triển',
    group: 'career_fit',
    output: { symbol: 'criterion_priority', latex: L`\text{Ưu tiên}`, name: 'Mức ưu tiên phát triển tiêu chí' },
    expression: cases(
      [
        [cmp('>=', ref('criterion_gap'), param('gap_priority_p1')), text('P1')],
        [cmp('>=', ref('criterion_gap'), param('gap_priority_p2')), text('P2')],
        [cmp('>', ref('criterion_gap'), num(0)), text('P3')],
      ],
      na,
    ),
    verification: 'demo',
    specRef: 'SRS R07',
    tests: [
      tc('thiếu nhiều', { vars: { gap_priority_p1: 0.5, gap_priority_p2: 0.25 }, refs: { criterion_gap: 0.6 } }, 'P1', { engineFn: 'criterionPriority', engineArgs: { gap: 0.6 } }),
      tc('thiếu vừa', { vars: { gap_priority_p1: 0.5, gap_priority_p2: 0.25 }, refs: { criterion_gap: 0.3 } }, 'P2', { engineFn: 'criterionPriority', engineArgs: { gap: 0.3 } }),
      tc('thiếu ít', { vars: { gap_priority_p1: 0.5, gap_priority_p2: 0.25 }, refs: { criterion_gap: 0.1 } }, 'P3', { engineFn: 'criterionPriority', engineArgs: { gap: 0.1 } }),
      tc('đã đạt', { vars: { gap_priority_p1: 0.5, gap_priority_p2: 0.25 }, refs: { criterion_gap: 0 } }, null, { engineFn: 'criterionPriority', engineArgs: { gap: 0 } }),
    ],
  },
  {
    code: 'match_g1_g5',
    name: 'Mức phù hợp Năng lực',
    group: 'career_fit',
    output: { symbol: 'match_g1_g5', latex: L`M_{\text{G1–G5}}`, name: 'Mức phù hợp thành phần Năng lực (G1–G5)', min: 0, max: 1 },
    // Chỉ tính các tiêu chí nghề có trọng số và người học đã có điểm; tiêu chí thiếu điểm không bị tính 0
    expression: div(
      sum('i', 'main_criteria', 'tiêu chí Năng lực đã có điểm', mul(ref('criterion_fit'), sym('career_weight')), readyCriterion('criterion_fit')),
      sum('i', 'main_criteria', 'tiêu chí Năng lực đã có điểm', sym('career_weight'), readyCriterion('criterion_fit')),
      na,
    ),
    verification: 'approved',
    specRef: 'SRS R08',
    tests: [
      tc('bỏ tiêu chí chưa có điểm', { sets: { main_criteria: [{ criterion_fit: 0.8, career_weight: 0.6 }, { criterion_fit: 1, career_weight: 0.4 }, { criterion_fit: null, career_weight: 0.5 }] } }, 0.88, {
        engineFn: 'careerMatchMain',
        engineArgs: { rows: MAIN_ROWS },
      }),
      tc('chưa có tiêu chí nào', { sets: { main_criteria: [] } }, null, { engineFn: 'careerMatchMain', engineArgs: { rows: [] } }),
    ],
  },
  {
    code: 'match_g7',
    name: 'Mức phù hợp Động lực',
    group: 'career_fit',
    output: { symbol: 'match_g7', latex: L`M_{\text{G7}}`, name: 'Mức phù hợp thành phần Động lực (G7)', min: 0, max: 1 },
    expression: div(
      sum('i', 'motivation_criteria', 'tiêu chí Động lực đã có điểm', mul(ref('criterion_fit'), sym('career_weight')), readyCriterion('criterion_fit')),
      sum('i', 'motivation_criteria', 'tiêu chí Động lực đã có điểm', sym('career_weight'), readyCriterion('criterion_fit')),
      na,
    ),
    verification: 'approved',
    specRef: 'SRS R08',
    tests: [
      tc('một tiêu chí động lực', { sets: { motivation_criteria: [{ criterion_fit: 0.5, career_weight: 1 }] } }, 0.5, {
        engineFn: 'careerMatchMotivation',
        engineArgs: { rows: [MOTIVATION_ROW] },
      }),
    ],
  },
  {
    code: 'riasec_match',
    name: 'Mức phù hợp Sở thích (RIASEC)',
    group: 'career_fit',
    output: { symbol: 'riasec_match', latex: L`M_{\text{G6}}`, name: 'Mức phù hợp thành phần Sở thích (G6)', min: 0, max: 1 },
    // Chế độ thử nghiệm theo hồ sơ sáu chiều; công thức chính thức chưa được chốt
    expression: div(
      sum(
        'k',
        'holland_dims',
        'chiều Holland đã có điểm',
        mul(minOf(div(sym('learner_dim'), maxOf(sym('career_profile'), num(0.2))), num(1)), sym('career_profile')),
        and(notnull(sym('learner_dim')), cmp('>', sym('career_profile'), num(0))),
      ),
      sum('k', 'holland_dims', 'chiều Holland đã có điểm', sym('career_profile'), and(notnull(sym('learner_dim')), cmp('>', sym('career_profile'), num(0)))),
      na,
    ),
    verification: 'blocked',
    specRef: 'SRS R05',
    tests: [
      tc(
        'đủ sáu chiều',
        {
          sets: {
            holland_dims: [
              { learner_dim: 0.4, career_profile: 0.5 },
              { learner_dim: 0.2, career_profile: 0.3 },
              { learner_dim: 0.4, career_profile: 0.1 },
              { learner_dim: 0.6, career_profile: 0 },
              { learner_dim: 0.2, career_profile: 0.1 },
              { learner_dim: 0.2, career_profile: 0 },
            ],
          },
        },
        0.8,
        { engineFn: 'riasecMatch', engineArgs: { learner: HOLLAND_LEARNER, career: HOLLAND_CAREER } },
      ),
      tc(
        'thiếu điểm một chiều',
        {
          sets: {
            holland_dims: [
              { learner_dim: 0.4, career_profile: 0.5 },
              { learner_dim: null, career_profile: 0.3 },
              { learner_dim: 0.4, career_profile: 0.1 },
              { learner_dim: 0.6, career_profile: 0 },
              { learner_dim: 0.2, career_profile: 0.1 },
              { learner_dim: 0.2, career_profile: 0 },
            ],
          },
        },
        0.6 / 0.7,
        { engineFn: 'riasecMatch', engineArgs: { learner: { ...HOLLAND_LEARNER, 'D6.2': null }, career: HOLLAND_CAREER } },
      ),
    ],
  },
  {
    code: 'career_fit',
    name: 'Độ phù hợp nghề',
    group: 'career_fit',
    output: { symbol: 'career_fit', latex: L`CF`, name: 'Độ phù hợp nghề', unit: '%', min: 0, max: 100 },
    // Thành phần chưa có dữ liệu thì bỏ đi và chuẩn hóa lại tỷ trọng trên các thành phần còn lại
    expression: mul(
      div(
        sumRows(
          'c',
          'thành phần có dữ liệu',
          [
            { comp_w: param('career_fit_weight_competency'), comp_m: ref('match_g1_g5') },
            { comp_w: param('career_fit_weight_interest'), comp_m: ref('riasec_match') },
            { comp_w: param('career_fit_weight_motivation'), comp_m: ref('match_g7') },
          ],
          mul(sym('comp_w'), sym('comp_m')),
          and(cmp('>', sym('comp_w'), num(0)), notnull(sym('comp_m'))),
        ),
        sumRows(
          'c',
          'thành phần có dữ liệu',
          [
            { comp_w: param('career_fit_weight_competency'), comp_m: ref('match_g1_g5') },
            { comp_w: param('career_fit_weight_interest'), comp_m: ref('riasec_match') },
            { comp_w: param('career_fit_weight_motivation'), comp_m: ref('match_g7') },
          ],
          sym('comp_w'),
          and(cmp('>', sym('comp_w'), num(0)), notnull(sym('comp_m'))),
        ),
        na,
      ),
      num(100),
    ),
    verification: 'demo',
    specRef: 'SRS R08, R13',
    tests: [
      tc(
        'đủ ba thành phần',
        { vars: { career_fit_weight_competency: 0.4, career_fit_weight_interest: 0.3, career_fit_weight_motivation: 0.3 }, refs: { match_g1_g5: 0.88, riasec_match: 0.8, match_g7: 0.5 } },
        74.2,
        { tolerance: 0.01, engineFn: 'careerFitPercent', engineArgs: { rows: [...MAIN_ROWS, MOTIVATION_ROW], learner: HOLLAND_LEARNER, career: HOLLAND_CAREER } },
      ),
      tc(
        'thiếu Sở thích thì chuẩn hóa lại',
        { vars: { career_fit_weight_competency: 0.4, career_fit_weight_interest: 0.3, career_fit_weight_motivation: 0.3 }, refs: { match_g1_g5: 0.88, riasec_match: null, match_g7: 0.5 } },
        (0.352 + 0.15) / 0.7 * 100,
        { tolerance: 0.01, engineFn: 'careerFitPercent', engineArgs: { rows: [...MAIN_ROWS, MOTIVATION_ROW] } },
      ),
      tc(
        'chưa có thành phần nào',
        { vars: { career_fit_weight_competency: 0.4, career_fit_weight_interest: 0.3, career_fit_weight_motivation: 0.3 }, refs: { match_g1_g5: null, riasec_match: null, match_g7: null } },
        null,
        { engineFn: 'careerFitPercent', engineArgs: { rows: [] } },
      ),
    ],
  },
  {
    code: 'career_rank_band',
    name: 'Bậc xếp hạng nghề',
    group: 'career_fit',
    output: { symbol: 'career_rank_band', latex: L`\text{Bậc}`, name: 'Bậc xếp hạng nghề' },
    expression: floorOf(div(ref('career_fit'), param('career_rank_band_percent'))),
    verification: 'demo',
    specRef: 'SRS R20',
    tests: [
      tc('74,2% về bậc 74', { vars: { career_rank_band_percent: 1 }, refs: { career_fit: 74.2 } }, 74, {
        engineFn: 'careerRankBand',
        engineArgs: { rows: [...MAIN_ROWS, MOTIVATION_ROW], learner: HOLLAND_LEARNER, career: HOLLAND_CAREER },
      }),
      tc('74,99% vẫn bậc 74', { vars: { career_rank_band_percent: 1 }, refs: { career_fit: 74.99 } }, 74),
    ],
  },
  {
    code: 'career_fit_class',
    name: 'Nhóm độ phù hợp nghề',
    group: 'career_fit',
    output: { symbol: 'career_fit_class', latex: L`\text{Nhóm}_{\text{nghề}}`, name: 'Nhóm độ phù hợp nghề' },
    expression: cases(
      [
        [cmp('>', ref('career_fit'), param('career_fit_min_percent')), text('Phù hợp')],
        [cmp('>=', ref('career_fit'), param('career_near_fit_percent')), text('Nghề gần đạt')],
      ],
      text('Chưa đạt'),
    ),
    verification: 'demo',
    specRef: 'SRS R20',
    tests: [
      tc('trên ngưỡng', { vars: { career_fit_min_percent: 50, career_near_fit_percent: 40 }, refs: { career_fit: 74.2 } }, 'Phù hợp', { engineFn: 'careerFitClass', engineArgs: { fit: 74.2 } }),
      tc('đúng ngưỡng tối thiểu', { vars: { career_fit_min_percent: 50, career_near_fit_percent: 40 }, refs: { career_fit: 50 } }, 'Nghề gần đạt', { engineFn: 'careerFitClass', engineArgs: { fit: 50 } }),
      tc('đúng ngưỡng gần đạt', { vars: { career_fit_min_percent: 50, career_near_fit_percent: 40 }, refs: { career_fit: 40 } }, 'Nghề gần đạt', { engineFn: 'careerFitClass', engineArgs: { fit: 40 } }),
      tc('dưới ngưỡng gần đạt', { vars: { career_fit_min_percent: 50, career_near_fit_percent: 40 }, refs: { career_fit: 39.9 } }, 'Chưa đạt', { engineFn: 'careerFitClass', engineArgs: { fit: 39.9 } }),
    ],
  },
];
