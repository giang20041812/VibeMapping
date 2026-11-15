/**
 * Kiểm tra thư viện công thức:
 *  - cấu trúc danh mục (mã không trùng, ký hiệu và tham chiếu đều có thật, không có vòng lặp, không chia cho 0 chưa xử lý);
 *  - mỗi ca thử tính bằng bộ tính công thức phải ra đúng kết quả mong đợi;
 *  - ca thử có hàm đối chiếu thì hàm thật trong assessmentRules.ts cũng phải ra đúng kết quả đó.
 * Chạy từ thư mục gốc: supabase/scripts/node_modules/.bin/tsx frontend/domain-checks/formula.ts
 */
import katex from 'katex';
import * as R from '../src/domain/assessmentRules';
import {
  FORMULAS,
  FORMULAS_BY_CODE,
  GROUPS,
  SYMBOLS,
  SYMBOLS_BY_CODE,
  catalogLatexContext,
} from '../src/domain/formula/catalog';
import {
  collectDependencies,
  collectFallbacks,
  collectNeeds,
  evaluate,
  findCycle,
  formulaToLatex,
  validateExpression,
  valuesMatch,
  type Expr,
  type Value,
} from '../src/domain/formula';
import {
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  buildEdges,
  computeDepths,
  dependencyLevels,
  layoutGraph,
  relatedCodes,
  visibleCodes,
  type GraphFormula,
} from '../src/modules/formula_library/formula.graph';
import { contextFromState, parseCell, stateFromInputs } from '../src/modules/formula_library/formula.trial';
import { parseTuition } from '../../supabase/scripts/tuition-parser';

type Args = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const CONFIDENCE_LABEL = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' } as const;
const TRUST_LABEL = { trusted: 'Tin cậy', consider: 'Cần cân nhắc', suggest_reject: 'Đề xuất loại' } as const;

const compare = (options: Args[], weights: Args, budget: number | null, city: string | null) =>
  R.compareDecisionOptions(options as R.DecisionOptionInput[], weights as never, budget, city);
const only = (key: 'careerFit' | 'admission' | 'finance' | 'location') => ({ careerFit: 0, admission: 0, finance: 0, location: 0, [key]: 1 });
const rowOf = (options: Args[], id: string) => {
  const found = options.find((o) => o.id === id);
  if (!found) throw new Error(`Không có phương án ${id}`);
  return found;
};
const gapsOf = (self: number, group: number) =>
  R.findPerceptionGaps(
    { D1: self },
    { parent: { D1: group }, friend: {}, teacher: {}, mentor: {}, others: {} },
    [{ dimensionCode: 'D1', name: 'Tiêu chí thử' }],
  );
const careerResult = (a: Args) =>
  R.careerComponents(a.rows, {
    ...(a.learner ? { learnerDimensionScores1to5: a.learner } : {}),
    ...(a.career ? { careerHollandProfile: a.career } : {}),
  });
const roadmapOf = (a: Args) =>
  R.evaluateRoadmapProgress(a.milestones, a.todayIso, a.startIso && a.targetIso ? { startIso: a.startIso, targetIso: a.targetIso } : undefined);

/** Hàm thật trong assessmentRules.ts (và bộ tách học phí) dùng đối chiếu, theo tên ghi trong ca thử */
const ENGINES: Record<string, (a: Args) => Value> = {
  understandingPercent: (a) => R.understandingPercent(a.th, a.floor),
  supplementalUnderstandingScore: (a) =>
    R.supplementalUnderstandingScore(a.group, { empathicAccuracy: a.ea, solo: a.solo, carkhuff: a.carkhuff ?? null }),
  raterWeight: (a) => R.raterWeight({ understandingScore: a.th, supplementalScore: a.s }).weight,
  poolShare: (a) =>
    R.poolWeights(
      (a.weights as number[]).map((weight) => ({
        status: weight > 0 ? ('positive' as const) : ('zero' as const),
        understandingPercent: 0,
        effectiveSupplementalScore: null,
        weight,
      })),
    ).shares[a.index],
  coverageRatio: (a) => R.coverageRatio(a.assigned, a.valid),
  deriveConfidence: (a) => CONFIDENCE_LABEL[R.deriveConfidence(a.coverage, a.insufficient, 0.8, 0.6, 0.4)],
  trustEffectiveSeconds: (a) =>
    R.computeSubmissionTrust({ scores: [], totalQuestions: 1, rawDurationSeconds: a.rawDurationSeconds, idlePeriodsSeconds: a.idlePeriodsSeconds }).effectiveSeconds,
  trustIndex: (a) => R.computeSubmissionTrust(a as never).trustIndexPercent,
  trustLabel: (a) => TRUST_LABEL[R.computeSubmissionTrust(a as never).trustLabel],
  perceptionDelta: (a) => gapsOf(a.self, a.group)[0]?.deltaPercent ?? null,
  perceptionFlag: (a) => (gapsOf(a.self, a.group).length > 0 ? 'Lệch góc nhìn' : 'Không lệch'),
  criterionFit: (a) => R.criterionFit(a.user, a.required),
  criterionGap: (a) => R.criterionGap(a.user, a.required),
  criterionPriority: (a) => R.criterionPriority(a.gap),
  careerMatchMain: (a) => R.careerComponents(a.rows).g1toG5.match,
  careerMatchMotivation: (a) => R.careerComponents(a.rows).g7.match,
  riasecMatch: (a) => R.computeRiasecMatch({ learnerDimensionScores1to5: a.learner, careerHollandProfile: a.career }).match,
  careerFitPercent: (a) => careerResult(a).careerFitPercent,
  careerRankBand: (a) => careerResult(a).rankBand,
  careerFitClass: (a) => {
    const fit = a.fit as number;
    const ranked = R.rankCareerRecommendations([
      {
        careerId: '1',
        careerCode: 'A',
        careerName: 'A',
        hollandTop3: null,
        result: { careerFitPercent: fit, rankBand: Math.floor(fit), highestWeightGap: 0, unmetCriteriaCount: 0, componentCompleteness: 1 } as unknown as R.CareerComponentResult,
      },
    ]);
    return ranked.length === 0 ? 'Chưa đạt' : ranked[0].nearThreshold ? 'Nghề gần đạt' : 'Phù hợp';
  },
  decisionScoreGap: (a) => compare([a.option], only('admission'), null, null)[0].scoreGap,
  decisionAdmission: (a) => compare([a.option], only('admission'), null, null)[0].totalScore,
  decisionFinance: (a) => {
    const options = [a.option, ...a.others];
    return compare(options, only('finance'), a.budget, null).find((o) => o.id === a.option.id)?.financeScore ?? null;
  },
  decisionLocation: (a) => compare([a.option], only('location'), null, a.preferredCity)[0].totalScore,
  decisionTotal: (a) => compare(a.options, a.weights, a.budget, a.preferredCity).find((o) => o.id === rowOf(a.options, a.pick).id)?.totalScore ?? null,
  tuitionPerYear: (a) => parseTuition(a.text, a.studyYears).perYear?.[0] ?? null,
  roadmapPillar: (a) => roadmapOf(a).byPillar.find((p) => p.pillar === 'knowledge')?.percent ?? null,
  roadmapActual: (a) => roadmapOf(a).actualPercent,
  roadmapPlanned: (a) => roadmapOf(a).plannedPercent,
  roadmapDelay: (a) => roadmapOf(a).delayPercent,
  roadmapOffTrack: (a) => (roadmapOf(a).offTrack ? 'Chệch hướng' : 'Đúng hướng'),
};

let failed = 0;
let passed = 0;
function check(name: string, run: () => void): void {
  try {
    run();
    passed += 1;
  } catch (error) {
    failed += 1;
    console.error(`THẤT BẠI: ${name}\n  ${error instanceof Error ? error.message : String(error)}`);
  }
}
function must(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
const show = (v: Value): string => JSON.stringify(v);

// 1. Cấu trúc danh mục ---------------------------------------------------------------------------------------------
check('mã công thức không trùng', () => {
  const codes = FORMULAS.map((f) => f.code);
  must(new Set(codes).size === codes.length, `Trùng: ${codes.filter((c, i) => codes.indexOf(c) !== i).join(', ')}`);
});
check('mã ký hiệu không trùng', () => {
  const codes = SYMBOLS.map((s) => s.code);
  must(new Set(codes).size === codes.length, `Trùng: ${codes.filter((c, i) => codes.indexOf(c) !== i).join(', ')}`);
});
check('mọi công thức thuộc một nhóm có thật', () => {
  const groups = new Set(GROUPS.map((g) => g.code));
  for (const f of FORMULAS) must(groups.has(f.group), `${f.code}: nhóm ${f.group} không tồn tại`);
});
check('ký hiệu công thức tạo ra khai báo đúng', () => {
  for (const f of FORMULAS) {
    const out = SYMBOLS_BY_CODE[f.output.symbol];
    must(out?.kind === 'formula' && out.ref === f.code, `${f.code}: ký hiệu ${f.output.symbol} không trỏ về công thức`);
  }
});
check('mọi công thức có ca thử', () => {
  for (const f of FORMULAS) must(f.tests.length > 0, `${f.code} chưa có ca thử`);
});

const graph: Record<string, string[]> = {};
for (const f of FORMULAS) {
  check(`cây biểu thức hợp lệ: ${f.code}`, () => {
    const issues = validateExpression(f.expression, { symbols: SYMBOLS_BY_CODE, formulaCodes: new Set(FORMULAS.map((x) => x.code)) });
    must(issues.length === 0, issues.map((i) => i.message).join('; '));
  });
  graph[f.code] = collectDependencies(f.expression).formulas;
  check(`ký hiệu hiển thị của ref có thật: ${f.code}`, () => {
    const JSONexpr = JSON.stringify(f.expression);
    for (const match of JSONexpr.matchAll(/"show":"([^"]+)"/g)) must(SYMBOLS_BY_CODE[match[1]] !== undefined, `Thiếu ký hiệu ${match[1]}`);
  });
}
check('không có vòng lặp giữa các công thức', () => {
  const cycle = findCycle(graph);
  must(cycle === null, `Vòng lặp: ${cycle?.join(' → ')}`);
});
check('không công thức nào tự tham chiếu mình hay trỏ tới công thức không có', () => {
  for (const [code, deps] of Object.entries(graph)) {
    must(!deps.includes(code), `${code} tự tham chiếu`);
    for (const dep of deps) must(FORMULAS_BY_CODE[dep] !== undefined, `${code} trỏ tới ${dep} không có`);
  }
});

// 2. Kiểm tra bản thân bộ kiểm tra ----------------------------------------------------------------------------------
check('phát hiện chia cho 0 chưa xử lý', () => {
  const risky: Expr = { t: 'div', n: { t: 'sym', id: 'x_k' }, d: { t: 'sym', id: 'x_k' } };
  const issues = validateExpression(risky, { symbols: { x_k: { code: 'x_k', latex: 'x', name: 'x', kind: 'input' } }, formulaCodes: new Set() });
  must(issues.some((i) => i.code === 'division_by_zero_risk'), 'Không báo chia cho 0');
});
check('phát hiện vòng lặp trong đồ thị', () => {
  must(findCycle({ a: ['b'], b: ['c'], c: ['a'] })?.join('>') === 'a>b>c>a', 'Không tìm ra vòng a→b→c→a');
  must(findCycle({ a: ['b'], b: [] }) === null, 'Báo nhầm vòng lặp');
});

// 3. Ca thử --------------------------------------------------------------------------------------------------------------
for (const f of FORMULAS) {
  for (const test of f.tests) {
    check(`ca thử: ${f.code} – ${test.name}`, () => {
      const tolerance = test.tolerance ?? 0.0001;
      const actual = evaluate(f.expression, test.inputs);
      must(valuesMatch(actual, test.expected, tolerance), `công thức cho ${show(actual)}, mong đợi ${show(test.expected)}`);
      if (test.engineFn) {
        const engine = ENGINES[test.engineFn];
        must(engine !== undefined, `Chưa có hàm đối chiếu ${test.engineFn}`);
        const fromEngine = engine(test.engineArgs as Args);
        must(valuesMatch(fromEngine, test.expected, tolerance), `hàm ${test.engineFn} cho ${show(fromEngine)}, mong đợi ${show(test.expected)}`);
      }
    });
  }
}
check('mọi tên hàm đối chiếu trong ca thử đều có', () => {
  const names = new Set(FORMULAS.flatMap((f) => f.tests.flatMap((t) => (t.engineFn ? [t.engineFn] : []))));
  for (const name of names) must(ENGINES[name] !== undefined, `Thiếu ${name}`);
  for (const name of Object.keys(ENGINES)) must(names.has(name), `Hàm ${name} không ca thử nào dùng`);
});

// 4. Hiển thị ---------------------------------------------------------------------------------------------------------------
const latexContext = catalogLatexContext();
check('mọi công thức dựng được LaTeX, không còn ký hiệu rơi về dạng chữ thô', () => {
  for (const f of FORMULAS) {
    const latex = formulaToLatex(f, latexContext);
    must(latex.length > 0, `${f.code}: rỗng`);
    must(!/\\text\{[a-z]+(_[a-z0-9]+)+\}/.test(latex), `${f.code}: có ký hiệu chưa khai báo trong ${latex}`);
  }
});
check('KaTeX dựng được mọi công thức và mọi ký hiệu', () => {
  for (const f of FORMULAS) {
    katex.renderToString(formulaToLatex(f, latexContext), { throwOnError: true, displayMode: true, strict: 'ignore' });
  }
  for (const s of SYMBOLS) katex.renderToString(s.latex, { throwOnError: true, strict: 'ignore' });
});
check('LaTeX của tỷ lệ thấu hiểu viết như trên tài liệu', () => {
  const latex = formulaToLatex(FORMULAS_BY_CODE.th_percent, latexContext);
  must(latex === String.raw`TH\% = \max\left(TH\%_{\text{sàn}},\ \frac{TH - 3}{9} \times 100\right)`, latex);
});
check('LaTeX của độ phù hợp nghề có tổng và phân số', () => {
  const latex = formulaToLatex(FORMULAS_BY_CODE.career_fit, latexContext);
  must(latex.startsWith(String.raw`CF = \frac{\sum_{c \in \text{thành phần có dữ liệu}} w_{c} \cdot M_{c}}{\sum_{c \in \text{thành phần có dữ liệu}} w_{c}} \times 100`), latex);
});
check('thay số vào công thức', () => {
  const latex = formulaToLatex(FORMULAS_BY_CODE.th_percent, {
    ...latexContext,
    resolve: (kind, key) => (kind === 'sym' && key === 'th_score' ? 6 : kind === 'param' && key === 'understanding_percent_floor' ? 0 : undefined),
  });
  must(latex.includes(String.raw`\frac{6 - 3}{9} \times 100`), latex);
});
check('ghi chú khi mẫu số bằng 0', () => {
  const notes = collectFallbacks(FORMULAS_BY_CODE.rater_share.expression, latexContext);
  must(notes.length === 1 && notes[0].fallback.includes(String.raw`\frac{1}`), JSON.stringify(notes));
});
check('tính có vết các bước trung gian', () => {
  const trace: { latex: string; value: Value }[] = [];
  const f = FORMULAS_BY_CODE.criterion_fit;
  evaluate(f.expression, { vars: { user_score: 4, required_score: 5 } }, { trace, latex: latexContext });
  must(trace.length === 2 && trace[0].value === 0.8 && trace[1].value === 0.8, JSON.stringify(trace));
});
check('tự tính đệ quy khi chưa có giá trị của công thức con', () => {
  const formulas = Object.fromEntries(FORMULAS.map((f) => [f.code, f.expression]));
  const value = evaluate(formulas.criterion_percent, { vars: { self_weight: 0.5 }, refs: { rater_rs: 4 }, sets: { raters: [] }, formulas });
  must(valuesMatch(value, 80), `Nhận ${show(value)}`);
});

// 5. Sơ đồ liên kết ---------------------------------------------------------------------------------------------------
const graphFormulas: GraphFormula[] = FORMULAS.map((f, index) => ({
  id: f.code,
  formula_code: f.code,
  formula_name: f.name,
  group_id: f.group,
  group_name: GROUPS.find((g) => g.code === f.group)?.name ?? f.group,
  verification_level: f.verification,
  sort_order: index,
  expression: f.expression,
}));
const graphEdges = buildEdges(graphFormulas);
const allCodes = new Set(graphFormulas.map((f) => f.formula_code));

check('sơ đồ: số cạnh khớp số công thức được dùng', () => {
  const expected = FORMULAS.reduce((total, f) => total + collectDependencies(f.expression).formulas.length, 0);
  must(graphEdges.length === expected && expected > 0, `${graphEdges.length} cạnh, mong đợi ${expected}`);
});
check('sơ đồ: tầng của công thức lớn hơn tầng của mọi công thức nó dùng', () => {
  const depths = computeDepths([...allCodes], graphEdges);
  must(depths.get('rater_rs') === 0 && depths.get('th_percent') === 0, 'công thức chỉ dùng dữ liệu đầu vào phải ở tầng 0');
  for (const edge of graphEdges) must((depths.get(edge.to) ?? 0) > (depths.get(edge.from) ?? 0), `${edge.from} → ${edge.to} không đi từ trái sang phải`);
  must((depths.get('option_total_score') ?? 0) >= 3, 'điểm tổng hợp phương án phải ở tầng sâu');
});
check('sơ đồ: chuỗi phía trước và phía sau', () => {
  const related = relatedCodes('career_fit', graphEdges);
  for (const code of ['match_g1_g5', 'match_g7', 'riasec_match', 'criterion_fit']) must(related.ancestors.has(code), `thiếu ${code} phía trước career_fit`);
  for (const code of ['option_total_score', 'career_rank_band', 'career_fit_class']) must(related.descendants.has(code), `thiếu ${code} phía sau career_fit`);
  must(!related.ancestors.has('career_fit') && !related.descendants.has('career_fit'), 'công thức không được nằm trong chuỗi của chính nó');
});
check('sơ đồ: lọc giữ nguyên chuỗi liên kết', () => {
  const visible = visibleCodes(graphFormulas, graphEdges, (f) => f.formula_code === 'career_rank_band');
  must(visible.has('career_fit') && visible.has('criterion_fit'), 'lọc phải giữ các công thức phía trước');
  must(!visible.has('trust_index'), 'không liên quan thì phải bị loại');
});
check('sơ đồ: bố cục không chồng nút và mọi dây đi từ trái sang phải', () => {
  const layout = layoutGraph(graphFormulas, graphEdges, allCodes);
  must(layout.nodes.length === FORMULAS.length, `${layout.nodes.length} nút`);
  const seen = new Set<string>();
  for (const node of layout.nodes) {
    const key = `${node.x}:${node.y}`;
    must(!seen.has(key), `hai nút chồng nhau tại ${key}`);
    seen.add(key);
    must(node.x + GRAPH_NODE_WIDTH <= layout.width && node.y + GRAPH_NODE_HEIGHT <= layout.height, `${node.code} nằm ngoài khung`);
  }
  const byCode = new Map(layout.nodes.map((n) => [n.code, n]));
  for (const edge of layout.edges) must((byCode.get(edge.from)?.x ?? 0) < (byCode.get(edge.to)?.x ?? 0), `${edge.from} → ${edge.to}`);
});
check('sơ đồ: bộ lọc rỗng cho bố cục rỗng', () => {
  const layout = layoutGraph(graphFormulas, graphEdges, new Set());
  must(layout.nodes.length === 0 && layout.edges.length === 0, 'phải rỗng');
});

// 6. Tính thử và khai triển --------------------------------------------------------------------------------------------
check('cần nhập gì: điểm tiêu chí tổng hợp', () => {
  const needs = collectNeeds(FORMULAS_BY_CODE.criterion_score_360.expression);
  must(needs.params.join() === 'self_weight', `tham số ${needs.params.join()}`);
  must(needs.refs.join() === 'rater_rs', `công thức ${needs.refs.join()}`);
  const fields = needs.sets.raters?.fields.map((f) => `${f.kind}:${f.key}`).sort().join() ?? '';
  must(fields === 'ref:rater_rs,ref:rater_share', `trường dòng ${fields}`);
});
check('cần nhập gì: tập viết thẳng của độ phù hợp nghề chỉ cần công thức và tham số', () => {
  const needs = collectNeeds(FORMULAS_BY_CODE.career_fit.expression);
  must(Object.keys(needs.sets).length === 0, 'không cần tập dòng');
  must(needs.refs.length === 3 && needs.params.length === 3 && needs.vars.length === 0, JSON.stringify(needs));
});
check('cần nhập gì: đủ để tính mọi công thức không báo thiếu đầu vào', () => {
  for (const f of FORMULAS) {
    const needs = collectNeeds(f.expression);
    const sets = Object.fromEntries(Object.entries(needs.sets).map(([name]) => [name, [] as Record<string, Value>[]]));
    const vars: Record<string, Value> = {};
    for (const key of [...needs.vars, ...needs.params]) vars[key] = null;
    const refs: Record<string, Value> = {};
    for (const key of needs.refs) refs[key] = null;
    try {
      evaluate(f.expression, { vars, refs, sets });
    } catch (error) {
      throw new Error(`${f.code}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});
check('tính thử: mọi ca thử đi qua ô nhập dạng chữ vẫn ra đúng kết quả', () => {
  for (const f of FORMULAS) {
    const needs = collectNeeds(f.expression);
    for (const test of f.tests) {
      const context = contextFromState(stateFromInputs(needs, test.inputs, {}));
      const actual = evaluate(f.expression, context);
      must(valuesMatch(actual, test.expected, test.tolerance ?? 0.0001), `${f.code} – ${test.name}: ${show(actual)}, mong đợi ${show(test.expected)}`);
    }
  }
});
check('tính thử: đọc ô nhập', () => {
  must(parseCell('') === null && parseCell('  ') === null, 'ô trống là không có dữ liệu');
  must(parseCell('4,25') === 4.25 && parseCell('-3') === -3 && parseCell('0.5') === 0.5, 'đọc số có dấu phẩy');
  must(parseCell('Phụ huynh') === 'Phụ huynh' && parseCell('12abc') === '12abc', 'chữ giữ nguyên');
});
check('tính thử: tham số hiện hành điền vào khi ca thử không có', () => {
  const needs = collectNeeds(FORMULAS_BY_CODE.th_percent.expression);
  const state = stateFromInputs(needs, { vars: { th_score: 6 } }, { understanding_percent_floor: 5 });
  must(state.vars.understanding_percent_floor === '5' && state.vars.th_score === '6', JSON.stringify(state.vars));
});
check('khai triển theo cấp', () => {
  const levels = dependencyLevels('career_fit', graphFormulas);
  const codes = (n: number) => levels[n - 1].map((f) => f.formula_code).sort().join();
  must(codes(1) === 'match_g1_g5,match_g7,riasec_match', `cấp 1: ${codes(1)}`);
  must(levels[1].some((f) => f.formula_code === 'criterion_fit') && levels.length === 2, `số cấp ${levels.length}`);
  const all = levels.flat().map((f) => f.formula_code);
  must(new Set(all).size === all.length && !all.includes('career_fit'), 'mỗi công thức chỉ một lần và không có chính nó');
  must(dependencyLevels('rater_rs', graphFormulas).length === 0, 'công thức không dùng công thức khác thì không có cấp');
  const deep = dependencyLevels('trust_label', graphFormulas);
  must(deep.flat().some((f) => f.formula_code === 'trust_effective_seconds'), 'phải đi tới tận công thức đầu chuỗi');
});

console.log(`${passed} kiểm tra đạt, ${failed} thất bại; ${FORMULAS.length} công thức, ${SYMBOLS.length} ký hiệu`);
if (failed > 0) throw new Error(`${failed} kiểm tra thất bại`);
