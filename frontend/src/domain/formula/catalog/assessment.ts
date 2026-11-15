import {
  absOf,
  add,
  and,
  avg,
  cases,
  cmp,
  count,
  div,
  maxOf,
  minOf,
  mul,
  na,
  notnull,
  num,
  or,
  param,
  ref,
  sub,
  sum,
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

// Điểm nằm trong [1, 5] ở dữ liệu thật; tỷ lệ thấu hiểu nằm trong [0, 100]
const validAnswer = notnull(sym('answer_score'));

/** Đánh giá cá nhân */
export const PERSONAL_FORMULAS: FormulaDef[] = [
  {
    code: 'rater_rs',
    name: 'Điểm một người chấm tại một tiêu chí',
    group: 'personal',
    output: { symbol: 'RS', latex: L`RS`, name: 'Điểm một người chấm tại một tiêu chí', unit: 'điểm', min: 1, max: 5 },
    // Câu "không đủ cơ sở" là rỗng: bỏ khỏi cả tử số và mẫu số, không phải 0 và không bị phạt
    expression: div(
      sum('k', 'answers', 'câu có điểm hợp lệ', sym('answer_score'), validAnswer),
      count('k', 'answers', 'câu có điểm hợp lệ', validAnswer),
      na,
    ),
    verification: 'approved',
    specRef: 'SRS 4.3 BR-005',
    tests: [
      tc('bỏ câu không đủ cơ sở', { sets: { answers: [{ answer_score: 4 }, { answer_score: 5 }, { answer_score: null }, { answer_score: 3 }] } }, 4),
      tc('tất cả câu không đủ cơ sở', { sets: { answers: [{ answer_score: null }, { answer_score: null }] } }, null),
    ],
  },
  {
    code: 'criterion_percent',
    name: 'Điểm tiêu chí theo phần trăm',
    group: 'personal',
    output: { symbol: 'criterion_percent', latex: L`\text{Đ}\%`, name: 'Điểm tiêu chí theo phần trăm', unit: '%', min: 0, max: 100 },
    expression: mul(div(ref('criterion_score_360'), num(5)), num(100)),
    verification: 'approved',
    tests: [
      tc('4,25 điểm', { refs: { criterion_score_360: 4.25 } }, 85),
      tc('chưa có điểm', { refs: { criterion_score_360: null } }, null),
    ],
  },
  {
    code: 'group_score',
    name: 'Điểm nhóm tiêu chí',
    group: 'personal',
    output: { symbol: 'group_score', latex: L`\text{Đ}_{\text{nhóm}}`, name: 'Điểm nhóm tiêu chí (G1–G7)', unit: 'điểm', min: 1, max: 5 },
    expression: avg('i', 'criteria', 'tiêu chí có dữ liệu', ref('criterion_score_360')),
    verification: 'approved',
    specRef: 'SRS 4.3',
    tests: [
      tc('bỏ tiêu chí chưa có dữ liệu', { sets: { criteria: [{ criterion_score_360: 4.25 }, { criterion_score_360: null }, { criterion_score_360: 3.75 }] } }, 4),
    ],
  },
  {
    code: 'competency_level',
    name: 'Mức năng lực',
    group: 'personal',
    output: { symbol: 'competency_level', latex: L`\text{Mức}`, name: 'Mức năng lực' },
    expression: cases(
      [
        [cmp('>=', ref('criterion_percent'), num(80)), text('Rất cao')],
        [cmp('>=', ref('criterion_percent'), num(65)), text('Cao')],
        [cmp('>=', ref('criterion_percent'), num(50)), text('Trung bình')],
      ],
      text('Thấp'),
    ),
    verification: 'approved',
    specRef: 'SRS 4.3',
    tests: [
      tc('rất cao', { refs: { criterion_percent: 85 } }, 'Rất cao'),
      tc('đúng ngưỡng cao', { refs: { criterion_percent: 65 } }, 'Cao'),
      tc('đúng ngưỡng trung bình', { refs: { criterion_percent: 50 } }, 'Trung bình'),
      tc('dưới ngưỡng', { refs: { criterion_percent: 49.9 } }, 'Thấp'),
    ],
  },
];

/** Đánh giá 360° */
export const RATER_360_FORMULAS: FormulaDef[] = [
  {
    code: 'th_percent',
    name: 'Tỷ lệ thấu hiểu',
    group: 'rater_360',
    output: { symbol: 'th_percent', latex: L`TH\%`, name: 'Tỷ lệ thấu hiểu ngữ cảnh', unit: '%', min: 0, max: 100 },
    expression: maxOf(param('understanding_percent_floor'), mul(div(sub(sym('th_score'), num(3)), num(9)), num(100))),
    verification: 'approved',
    specRef: 'SRS 4.3 TH%',
    tests: [
      tc('thấu hiểu tối đa', { vars: { th_score: 12, understanding_percent_floor: 0 } }, 100, { engineFn: 'understandingPercent', engineArgs: { th: 12, floor: 0 } }),
      tc('thấu hiểu giữa', { vars: { th_score: 6, understanding_percent_floor: 0 } }, 100 / 3, { engineFn: 'understandingPercent', engineArgs: { th: 6, floor: 0 } }),
      tc('thấu hiểu tối thiểu', { vars: { th_score: 3, understanding_percent_floor: 0 } }, 0, { engineFn: 'understandingPercent', engineArgs: { th: 3, floor: 0 } }),
      tc('có sàn', { vars: { th_score: 3, understanding_percent_floor: 10 } }, 10, { engineFn: 'understandingPercent', engineArgs: { th: 3, floor: 10 } }),
    ],
  },
  {
    code: 'ea_percent',
    name: 'Tỷ lệ EA',
    group: 'rater_360',
    output: { symbol: 'ea_percent', latex: L`EA\%`, name: 'Tỷ lệ EA', unit: '%', min: 0, max: 100 },
    expression: mul(div(sum('k', 'ea_items', 'câu EA', sym('ea_item')), num(8)), num(100)),
    verification: 'approved',
    specRef: 'Tài liệu 04 mục 4',
    tests: [tc('bốn câu EA', { sets: { ea_items: [{ ea_item: 2 }, { ea_item: 1 }, { ea_item: 2 }, { ea_item: 1 }] } }, 75)],
  },
  {
    code: 'solo_percent',
    name: 'Tỷ lệ SOLO',
    group: 'rater_360',
    output: { symbol: 'solo_percent', latex: L`SOLO\%`, name: 'Tỷ lệ SOLO', unit: '%', min: 0, max: 100 },
    expression: mul(div(sum('k', 'solo_items', 'câu SOLO', sym('solo_item')), num(20)), num(100)),
    verification: 'approved',
    specRef: 'Tài liệu 04 mục 4',
    tests: [tc('bốn câu SOLO', { sets: { solo_items: [{ solo_item: 4 }, { solo_item: 3 }, { solo_item: 5 }, { solo_item: 4 }] } }, 80)],
  },
  {
    code: 'carkhuff_percent',
    name: 'Tỷ lệ Carkhuff',
    group: 'rater_360',
    output: { symbol: 'carkhuff_percent', latex: L`CK\%`, name: 'Tỷ lệ Carkhuff', unit: '%', min: 0, max: 100 },
    expression: mul(div(sym('carkhuff_score'), num(5)), num(100)),
    verification: 'approved',
    specRef: 'Tài liệu 04 mục 4',
    tests: [tc('điểm 4', { vars: { carkhuff_score: 4 } }, 80)],
  },
  {
    code: 'supplemental_score',
    name: 'Điểm hiểu biết bổ sung',
    group: 'rater_360',
    output: { symbol: 'supplemental_score', latex: L`S`, name: 'Điểm hiểu biết bổ sung của người chấm', unit: 'điểm', min: 0, max: 100 },
    expression: cases(
      [
        [cmp('=', sym('rater_group'), text('Phụ huynh')), add(mul(num(0.5), ref('ea_percent')), mul(num(0.25), ref('solo_percent')), mul(num(0.25), ref('carkhuff_percent')))],
        [cmp('=', sym('rater_group'), text('Bạn bè')), add(mul(num(0.7), ref('ea_percent')), mul(num(0.3), ref('solo_percent')))],
        [cmp('=', sym('rater_group'), text('Giáo viên')), add(mul(num(0.4), ref('ea_percent')), mul(num(0.4), ref('solo_percent')), mul(num(0.2), ref('carkhuff_percent')))],
        [cmp('=', sym('rater_group'), text('Mentor')), add(mul(num(0.35), ref('ea_percent')), mul(num(0.35), ref('solo_percent')), mul(num(0.3), ref('carkhuff_percent')))],
      ],
      na,
    ),
    verification: 'pending_ba',
    specRef: 'Tài liệu 04 mục 4.2',
    tests: [
      tc('phụ huynh', { vars: { rater_group: 'Phụ huynh' }, refs: { ea_percent: 75, solo_percent: 80, carkhuff_percent: 80 } }, 77.5, {
        engineFn: 'supplementalUnderstandingScore',
        engineArgs: { group: 'parent', ea: [2, 1, 2, 1], solo: [4, 3, 5, 4], carkhuff: 4 },
      }),
      tc('bạn bè', { vars: { rater_group: 'Bạn bè' }, refs: { ea_percent: 75, solo_percent: 80, carkhuff_percent: null } }, 76.5, {
        engineFn: 'supplementalUnderstandingScore',
        engineArgs: { group: 'friend', ea: [2, 1, 2, 1], solo: [4, 3, 5, 4] },
      }),
      tc('giáo viên', { vars: { rater_group: 'Giáo viên' }, refs: { ea_percent: 75, solo_percent: 80, carkhuff_percent: 80 } }, 78, {
        engineFn: 'supplementalUnderstandingScore',
        engineArgs: { group: 'teacher', ea: [2, 1, 2, 1], solo: [4, 3, 5, 4], carkhuff: 4 },
      }),
      tc('mentor', { vars: { rater_group: 'Mentor' }, refs: { ea_percent: 75, solo_percent: 80, carkhuff_percent: 80 } }, 78.25, {
        engineFn: 'supplementalUnderstandingScore',
        engineArgs: { group: 'mentor', ea: [2, 1, 2, 1], solo: [4, 3, 5, 4], carkhuff: 4 },
      }),
    ],
  },
  {
    code: 'rater_weight',
    name: 'Trọng số bài đánh giá',
    group: 'rater_360',
    output: { symbol: 'rater_weight', latex: L`w_{j}`, name: 'Trọng số bài của người chấm j' },
    // Chưa chấm định tính thì dùng điểm mặc định để bài vẫn được tính
    expression: mul(
      ref('th_percent'),
      cases([[notnull(ref('supplemental_score')), ref('supplemental_score')]], param('unreviewed_supplemental_default')),
    ),
    verification: 'pending_ba',
    specRef: 'SRS 4.3 BR-006',
    tests: [
      tc('chưa chấm định tính, dùng mặc định', { vars: { unreviewed_supplemental_default: 100 }, refs: { th_percent: 100, supplemental_score: null } }, 10000, {
        engineFn: 'raterWeight',
        engineArgs: { th: 12, s: null },
      }),
      tc('đã chấm định tính', { vars: { unreviewed_supplemental_default: 100 }, refs: { th_percent: 100, supplemental_score: 80 } }, 8000, {
        engineFn: 'raterWeight',
        engineArgs: { th: 12, s: 80 },
      }),
      tc('thấu hiểu giữa', { vars: { unreviewed_supplemental_default: 100 }, refs: { th_percent: 100 / 3, supplemental_score: 60 } }, 2000, {
        tolerance: 0.001,
        engineFn: 'raterWeight',
        engineArgs: { th: 6, s: 60 },
      }),
    ],
  },
  {
    code: 'rater_share',
    name: 'Tỷ trọng chuẩn hóa của một bài',
    group: 'rater_360',
    output: { symbol: 'rater_share', latex: L`\alpha_{j}`, name: 'Tỷ trọng chuẩn hóa của người chấm j', min: 0, max: 1 },
    // Tổng trọng số bằng 0 (mọi bài thấu hiểu tối thiểu) thì chia đều, giữ đóng góp của 360°
    expression: div(
      ref('rater_weight'),
      sum('j', 'raters', 'người chấm hợp lệ', ref('rater_weight')),
      div(num(1), count('j', 'raters', 'người chấm hợp lệ'), na),
    ),
    verification: 'pending_ba',
    specRef: 'SRS 4.3',
    tests: [
      tc('chia theo trọng số', { refs: { rater_weight: 3000 }, sets: { raters: [{ rater_weight: 3000 }, { rater_weight: 1000 }] } }, 0.75, {
        engineFn: 'poolShare',
        engineArgs: { weights: [3000, 1000], index: 0 },
      }),
      tc('tổng bằng 0 thì chia đều', { refs: { rater_weight: 0 }, sets: { raters: [{ rater_weight: 0 }, { rater_weight: 0 }] } }, 0.5, {
        engineFn: 'poolShare',
        engineArgs: { weights: [0, 0], index: 0 },
      }),
    ],
  },
  {
    code: 'criterion_score_360',
    name: 'Điểm tiêu chí tổng hợp',
    group: 'rater_360',
    output: { symbol: 'criterion_score_360', latex: L`\text{Đ}_{\text{tiêu chí}}`, name: 'Điểm tiêu chí tổng hợp', unit: 'điểm', min: 1, max: 5 },
    // Bản thân giữ trọng số cố định; các bài ngoài chia phần còn lại theo tỷ trọng chuẩn hóa tại từng tiêu chí
    expression: cases(
      [[cmp('=', count('j', 'raters', 'người chấm hợp lệ'), num(0)), ref('rater_rs', 'rs_self')]],
      add(
        mul(param('self_weight'), ref('rater_rs', 'rs_self')),
        mul(
          sub(num(1), param('self_weight')),
          sum('j', 'raters', 'người chấm hợp lệ', mul(ref('rater_share'), ref('rater_rs', 'rs_rater'))),
        ),
      ),
    ),
    verification: 'approved',
    specRef: 'SRS 4.3',
    tests: [
      tc(
        'bản thân 4, hai người ngoài',
        { vars: { self_weight: 0.5 }, refs: { rater_rs: 4 }, sets: { raters: [{ rater_share: 0.75, rater_rs: 5 }, { rater_share: 0.25, rater_rs: 3 }] } },
        4.25,
      ),
      tc('chưa có người ngoài thì lấy điểm bản thân', { vars: { self_weight: 0.5 }, refs: { rater_rs: 4 }, sets: { raters: [] } }, 4),
    ],
  },
  {
    code: 'coverage',
    name: 'Độ phủ',
    group: 'rater_360',
    output: { symbol: 'coverage', latex: L`\text{Cov}`, name: 'Độ phủ nhóm người chấm', min: 0, max: 1 },
    expression: div(
      count('g', 'groups', 'nhóm có điểm hợp lệ', cmp('=', sym('group_valid'), num(1))),
      count('g', 'groups', 'nhóm được phân công'),
      num(0),
    ),
    verification: 'pending_ba',
    specRef: 'SRS R10',
    tests: [
      tc('ba trên bốn nhóm', { sets: { groups: [{ group_valid: 1 }, { group_valid: 1 }, { group_valid: 0 }, { group_valid: 1 }] } }, 0.75, {
        engineFn: 'coverageRatio',
        engineArgs: { assigned: ['parent', 'friend', 'teacher', 'mentor'], valid: ['parent', 'friend', 'mentor'] },
      }),
      tc('chưa phân công nhóm nào', { sets: { groups: [] } }, 0, { engineFn: 'coverageRatio', engineArgs: { assigned: [], valid: [] } }),
    ],
  },
  {
    code: 'confidence',
    name: 'Mức tin cậy của tiêu chí',
    group: 'rater_360',
    output: { symbol: 'confidence', latex: L`\text{Tin cậy}`, name: 'Mức tin cậy của tiêu chí' },
    expression: cases(
      [
        [cmp('>', sym('insufficient_ratio'), param('insufficient_basis_warning_ratio')), text('Thấp')],
        [cmp('>=', ref('coverage'), param('confidence_high_coverage')), text('Cao')],
        [cmp('>=', ref('coverage'), param('confidence_medium_coverage')), text('Trung bình')],
      ],
      text('Thấp'),
    ),
    verification: 'demo',
    specRef: 'SRS R11',
    tests: [
      tc('độ phủ cao', { vars: { insufficient_ratio: 0.1, insufficient_basis_warning_ratio: 0.4, confidence_high_coverage: 0.8, confidence_medium_coverage: 0.6 }, refs: { coverage: 0.85 } }, 'Cao', {
        engineFn: 'deriveConfidence',
        engineArgs: { coverage: 0.85, insufficient: 0.1 },
      }),
      tc('độ phủ vừa', { vars: { insufficient_ratio: 0.1, insufficient_basis_warning_ratio: 0.4, confidence_high_coverage: 0.8, confidence_medium_coverage: 0.6 }, refs: { coverage: 0.7 } }, 'Trung bình', {
        engineFn: 'deriveConfidence',
        engineArgs: { coverage: 0.7, insufficient: 0.1 },
      }),
      tc('độ phủ thấp', { vars: { insufficient_ratio: 0.1, insufficient_basis_warning_ratio: 0.4, confidence_high_coverage: 0.8, confidence_medium_coverage: 0.6 }, refs: { coverage: 0.5 } }, 'Thấp', {
        engineFn: 'deriveConfidence',
        engineArgs: { coverage: 0.5, insufficient: 0.1 },
      }),
      tc('quá nhiều câu không đủ cơ sở', { vars: { insufficient_ratio: 0.5, insufficient_basis_warning_ratio: 0.4, confidence_high_coverage: 0.8, confidence_medium_coverage: 0.6 }, refs: { coverage: 0.9 } }, 'Thấp', {
        engineFn: 'deriveConfidence',
        engineArgs: { coverage: 0.9, insufficient: 0.5 },
      }),
    ],
  },
  {
    code: 'trust_effective_seconds',
    name: 'Thời gian làm bài hiệu dụng',
    group: 'rater_360',
    output: { symbol: 'trust_effective_seconds', latex: L`T_{\text{hiệu dụng}}`, name: 'Thời gian làm bài hiệu dụng', unit: 'giây', min: 0 },
    expression: maxOf(
      num(0),
      sub(
        sym('raw_seconds'),
        sum('k', 'idles', 'quãng nghỉ vượt ngưỡng', sym('idle_seconds'), cmp('>', sym('idle_seconds'), param('trust_idle_gap_seconds'))),
      ),
    ),
    verification: 'demo',
    specRef: 'SRS R14',
    tests: [
      tc('trừ quãng nghỉ dài', { vars: { raw_seconds: 500, trust_idle_gap_seconds: 120 }, sets: { idles: [{ idle_seconds: 30 }, { idle_seconds: 150 }, { idle_seconds: 200 }] } }, 150, {
        engineFn: 'trustEffectiveSeconds',
        engineArgs: { rawDurationSeconds: 500, idlePeriodsSeconds: [30, 150, 200] },
      }),
    ],
  },
  {
    code: 'trust_time_ratio',
    name: 'Tỷ lệ thời gian làm bài',
    group: 'rater_360',
    output: { symbol: 'trust_time_ratio', latex: L`T`, name: 'Tỷ lệ thời gian làm bài', min: 0, max: 1 },
    expression: minOf(num(1), div(ref('trust_effective_seconds'), maxOf(num(1), mul(sym('n_questions'), param('trust_seconds_per_question'))))),
    verification: 'demo',
    specRef: 'SRS R14',
    tests: [
      tc('làm một nửa thời gian tối thiểu', { vars: { n_questions: 100, trust_seconds_per_question: 3 }, refs: { trust_effective_seconds: 150 } }, 0.5),
      tc('đủ thời gian', { vars: { n_questions: 100, trust_seconds_per_question: 3 }, refs: { trust_effective_seconds: 400 } }, 1),
    ],
  },
  {
    code: 'trust_dispersion',
    name: 'Độ phân tán điểm',
    group: 'rater_360',
    output: { symbol: 'trust_dispersion', latex: L`D`, name: 'Độ phân tán điểm', min: 0, max: 1 },
    expression: cases(
      [[cmp('<', sym('valid_count'), param('trust_min_criteria')), num(1)]],
      minOf(num(1), div(sub(num(1), sym('same_share')), param('trust_dispersion_coefficient'))),
    ),
    verification: 'demo',
    specRef: 'SRS R14',
    tests: [
      tc('điểm đa dạng', { vars: { valid_count: 8, same_share: 0.25, trust_min_criteria: 7, trust_dispersion_coefficient: 0.3 } }, 1),
      tc('nhiều câu cùng một mức', { vars: { valid_count: 8, same_share: 0.8, trust_min_criteria: 7, trust_dispersion_coefficient: 0.3 } }, 0.2 / 0.3),
      tc('ít câu nên bỏ qua', { vars: { valid_count: 5, same_share: 1, trust_min_criteria: 7, trust_dispersion_coefficient: 0.3 } }, 1),
    ],
  },
  {
    code: 'trust_answer_ratio',
    name: 'Tỷ lệ câu có cơ sở',
    group: 'rater_360',
    output: { symbol: 'trust_answer_ratio', latex: L`A`, name: 'Tỷ lệ câu có cơ sở', min: 0, max: 1 },
    expression: maxOf(num(0), sub(num(1), div(sym('na_count'), sym('n_questions'), num(0)))),
    verification: 'demo',
    specRef: 'SRS R14',
    tests: [
      tc('hai trên mười câu không đủ cơ sở', { vars: { na_count: 2, n_questions: 10 } }, 0.8),
      tc('bài không có câu nào', { vars: { na_count: 0, n_questions: 0 } }, 1),
    ],
  },
  {
    code: 'trust_index',
    name: 'Trust Index',
    group: 'rater_360',
    output: { symbol: 'trust_index', latex: L`TI`, name: 'Trust Index', unit: '%', min: 0, max: 100 },
    expression: mul(div(add(ref('trust_time_ratio'), ref('trust_dispersion'), ref('trust_answer_ratio')), num(3)), num(100)),
    verification: 'demo',
    specRef: 'SRS R14',
    tests: [
      tc('T = 1, D = 0,8333, A = 0,8', { refs: { trust_time_ratio: 1, trust_dispersion: 0.25 / 0.3, trust_answer_ratio: 0.8 } }, 87.7778, {
        tolerance: 0.01,
        engineFn: 'trustIndex',
        engineArgs: { scores: [4, 4, 4, 4, 4, 4, 2, 5, null, null], totalQuestions: 10, rawDurationSeconds: 300 },
      }),
    ],
  },
  {
    code: 'trust_label',
    name: 'Nhãn tin cậy của bài',
    group: 'rater_360',
    output: { symbol: 'trust_label', latex: L`\text{Nhãn}`, name: 'Nhãn tin cậy của bài' },
    // Chỉ gắn cờ đề xuất, không tự loại bài
    expression: cases(
      [
        [
          or(
            cmp('<', ref('trust_time_ratio'), param('trust_min_time_ratio')),
            and(cmp('=', sym('same_share'), num(1)), cmp('>=', sym('valid_count'), param('trust_min_criteria'))),
            cmp('<', ref('trust_index'), mul(param('trust_label_consider'), num(100))),
          ),
          text('Đề xuất loại'),
        ],
        [cmp('>=', ref('trust_index'), mul(param('trust_label_trusted'), num(100))), text('Tin cậy')],
      ],
      text('Cần cân nhắc'),
    ),
    verification: 'demo',
    specRef: 'SRS R14',
    tests: [
      tc(
        'bài đáng tin',
        { vars: { same_share: 0.75, valid_count: 8, trust_min_time_ratio: 0.5, trust_min_criteria: 7, trust_label_consider: 0.4, trust_label_trusted: 0.7 }, refs: { trust_time_ratio: 1, trust_index: 87.7778 } },
        'Tin cậy',
        { engineFn: 'trustLabel', engineArgs: { scores: [4, 4, 4, 4, 4, 4, 2, 5, null, null], totalQuestions: 10, rawDurationSeconds: 300 } },
      ),
      tc(
        'chấm toàn một mức',
        { vars: { same_share: 1, valid_count: 8, trust_min_time_ratio: 0.5, trust_min_criteria: 7, trust_label_consider: 0.4, trust_label_trusted: 0.7 }, refs: { trust_time_ratio: 1, trust_index: 66.6667 } },
        'Đề xuất loại',
        { engineFn: 'trustLabel', engineArgs: { scores: [4, 4, 4, 4, 4, 4, 4, 4], totalQuestions: 8, rawDurationSeconds: 100 } },
      ),
      tc(
        'làm quá nhanh',
        { vars: { same_share: 0.2, valid_count: 10, trust_min_time_ratio: 0.5, trust_min_criteria: 7, trust_label_consider: 0.4, trust_label_trusted: 0.7 }, refs: { trust_time_ratio: 5 / 30, trust_index: 72.2222 } },
        'Đề xuất loại',
        { engineFn: 'trustLabel', engineArgs: { scores: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5], totalQuestions: 10, rawDurationSeconds: 5 } },
      ),
      tc(
        'cần cân nhắc',
        { vars: { same_share: 0.4, valid_count: 5, trust_min_time_ratio: 0.5, trust_min_criteria: 7, trust_label_consider: 0.4, trust_label_trusted: 0.7 }, refs: { trust_time_ratio: 0.5, trust_index: 66.6667 } },
        'Cần cân nhắc',
        { engineFn: 'trustLabel', engineArgs: { scores: [3, 4, 3, 4, 5, null, null, null, null, null], totalQuestions: 10, rawDurationSeconds: 15 } },
      ),
    ],
  },
  {
    code: 'perception_delta',
    name: 'Chênh lệch góc nhìn',
    group: 'rater_360',
    output: { symbol: 'perception_delta', latex: L`\Delta`, name: 'Chênh lệch giữa một nhóm người chấm và bản thân', unit: 'điểm %' },
    expression: sub(sym('group_percent'), sym('self_percent')),
    verification: 'approved',
    specRef: 'SRS BR-016',
    tests: [
      tc('nhóm chấm thấp hơn bản thân', { vars: { group_percent: 45, self_percent: 80 } }, -35, { engineFn: 'perceptionDelta', engineArgs: { self: 80, group: 45 } }),
    ],
  },
  {
    code: 'perception_flag',
    name: 'Cảnh báo lệch góc nhìn',
    group: 'rater_360',
    output: { symbol: 'perception_flag', latex: L`\text{Cảnh báo}`, name: 'Cảnh báo lệch góc nhìn' },
    expression: cases([[cmp('>=', absOf(ref('perception_delta')), param('perception_gap_percent')), text('Lệch góc nhìn')]], text('Không lệch')),
    verification: 'approved',
    specRef: 'SRS BR-016',
    tests: [
      tc('chênh 35 điểm', { vars: { perception_gap_percent: 25 }, refs: { perception_delta: -35 } }, 'Lệch góc nhìn', { engineFn: 'perceptionFlag', engineArgs: { self: 80, group: 45 } }),
      tc('chênh đúng 25 điểm', { vars: { perception_gap_percent: 25 }, refs: { perception_delta: -25 } }, 'Lệch góc nhìn', { engineFn: 'perceptionFlag', engineArgs: { self: 80, group: 55 } }),
      tc('chênh 10 điểm', { vars: { perception_gap_percent: 25 }, refs: { perception_delta: 10 } }, 'Không lệch', { engineFn: 'perceptionFlag', engineArgs: { self: 60, group: 70 } }),
    ],
  },
];
