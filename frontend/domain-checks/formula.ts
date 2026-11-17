/**
 * Kiểm tra thư viện công thức:
 *  - cấu trúc danh mục (mã không trùng, ký hiệu và tham chiếu đều có thật, không có vòng lặp, không chia cho 0 chưa xử lý);
 *  - mỗi ca thử tính bằng bộ tính công thức phải ra đúng kết quả mong đợi;
 *  - ca thử có hàm đối chiếu thì hàm thật trong assessmentRules.ts cũng phải ra đúng kết quả đó.
 * Chạy từ thư mục gốc: supabase/scripts/node_modules/.bin/tsx frontend/domain-checks/formula.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  LIVE_BINDINGS,
  setFormulaOverrides,
  walkExpr,
  type Cond,
  type Expr,
  type Value,
} from '../src/domain/formula';
import { buildFormulaFixtureSql } from './formula-fixture';
import {
  condToTokens,
  exprToLine,
  exprToTokens,
  lineToExpr,
  parseTypedNumber,
  tok,
  tokensToCond,
  tokensToExpr,
  type Token,
  type TokenBody,
} from '../src/modules/formula_library/formula.tokens';
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
import {
  FN_ARITY,
  KIND_OPTIONS,
  allowedRefs,
  buildEditorEnv,
  changeNodeKind,
  checkDraft,
  defaultCond,
  defaultNode,
  fitFnArgs,
  runTests,
  saveErrorText,
} from '../src/modules/formula_library/editor.logic';
import type { FormulaLibrary, FormulaRecord, FormulaTestRow } from '../src/modules/formula_library/formula.types';
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

// 7. Trình soạn ---------------------------------------------------------------------------------------------------------
const library: FormulaLibrary = {
  groups: [],
  symbols: SYMBOLS,
  formulas: FORMULAS.map<FormulaRecord>((f, index) => ({
    id: f.code,
    formula_code: f.code,
    formula_name: f.name,
    group_id: f.group,
    group_name: f.group,
    output_symbol: f.output.symbol,
    output_unit: null,
    verification_level: f.verification,
    sort_order: index,
    version_no: 1,
    effective_from: null,
    expression: f.expression,
  })),
};
const editorSelf = 'career_fit';
const editorEnv = buildEditorEnv(library, editorSelf);

check('trình soạn: mỗi loại nút có giá trị mặc định dựng được thành công thức hiển thị được', () => {
  for (const option of KIND_OPTIONS) {
    const node = defaultNode(option.value, editorEnv);
    must(node.t === option.value, `${option.value}: loại nút sai`);
    katex.renderToString(formulaToLatex({ output: { symbol: 'x', latex: 'X', name: 'X' }, expression: node }, latexContext), { throwOnError: true, strict: 'ignore' });
  }
  for (const kind of ['cmp', 'notnull', 'and', 'or'] as const) must(defaultCond(kind).c === kind, `điều kiện ${kind}`);
});
check('trình soạn: nút mặc định tính được và không báo lỗi cấu trúc', () => {
  const needsOf = (node: Expr) => {
    const needs = collectNeeds(node);
    return { vars: Object.fromEntries([...needs.vars, ...needs.params].map((k) => [k, 1])), refs: Object.fromEntries(needs.refs.map((k) => [k, 1])), sets: Object.fromEntries(Object.keys(needs.sets).map((k) => [k, [{}]])) };
  };
  for (const option of KIND_OPTIONS) {
    const node = defaultNode(option.value, editorEnv);
    const issues = validateExpression(node, { symbols: SYMBOLS_BY_CODE, formulaCodes: new Set(FORMULAS.map((f) => f.code)) });
    must(issues.length === 0, `${option.value}: ${issues.map((i) => i.message).join('; ')}`);
    evaluate(node, needsOf(node));
  }
});
check('trình soạn: đổi giữa phép tính và phân số giữ nguyên hai vế', () => {
  const bin: Expr = { t: 'bin', op: '+', l: { t: 'num', v: 3 }, r: { t: 'num', v: 4 } };
  const div = changeNodeKind(bin, 'div', editorEnv);
  must(div.t === 'div' && div.n.t === 'num' && div.n.v === 3 && div.d.t === 'num' && div.d.v === 4, JSON.stringify(div));
  const back = changeNodeKind(div, 'bin', editorEnv);
  must(back.t === 'bin' && back.op === '*', JSON.stringify(back));
  must(changeNodeKind(bin, 'bin', editorEnv) === bin, 'cùng loại thì giữ nguyên');
});
check('trình soạn: số đối số khớp với hàm', () => {
  for (const [name, [min, max]] of Object.entries(FN_ARITY)) {
    const fitted = fitFnArgs(name as keyof typeof FN_ARITY, []);
    must(fitted.length === min, `${name}: ${fitted.length} đối số`);
    const many = fitFnArgs(name as keyof typeof FN_ARITY, Array.from({ length: 5 }, () => ({ t: 'num', v: 1 }) as Expr));
    must(many.length === (Number.isFinite(max) ? max : 5), `${name}: cắt còn ${many.length}`);
  }
});
check('trình soạn: không cho chọn công thức tạo vòng lặp', () => {
  const codes = allowedRefs(editorSelf, library.formulas).map((f) => f.formula_code);
  must(!codes.includes(editorSelf), 'không được chọn chính nó');
  for (const user of ['option_total_score', 'career_rank_band', 'career_fit_class']) must(!codes.includes(user), `${user} đang dùng career_fit`);
  for (const dependency of ['match_g1_g5', 'criterion_fit', 'th_percent']) must(codes.includes(dependency), `${dependency} phải chọn được`);
});
check('trình soạn: kiểm tra bản đang soạn', () => {
  must(checkDraft(FORMULAS_BY_CODE.career_fit.expression, editorSelf, library).length === 0, 'công thức hiện hành phải sạch');
  const cycle = checkDraft({ t: 'ref', formula: 'option_total_score' }, editorSelf, library);
  must(cycle.some((i) => i.blocking && i.message.includes('vòng lặp')), 'phải báo vòng lặp');
  const unknown = checkDraft({ t: 'sym', id: 'khong_co' }, editorSelf, library);
  must(unknown.some((i) => i.blocking), 'ký hiệu chưa khai báo phải chặn');
  const risky = checkDraft({ t: 'div', n: { t: 'num', v: 1 }, d: { t: 'sym', id: 'budget' } }, editorSelf, library);
  must(risky.length === 1 && !risky[0].blocking, 'chia cho 0 chỉ là cảnh báo');
});
check('trình soạn: ca thử phát hiện chỗ lệch khi sửa công thức', () => {
  const f = FORMULAS_BY_CODE.th_percent;
  const tests: FormulaTestRow[] = f.tests.map((t, i) => ({ id: String(i), case_name: t.name, inputs: t.inputs, expected: t.expected, tolerance: t.tolerance ?? 0.0001 }));
  must(runTests(f.expression, tests).every((o) => o.state === 'match'), 'công thức gốc phải khớp hết');
  const edited: Expr = { t: 'bin', op: '*', l: f.expression, r: { t: 'num', v: 2 } };
  must(runTests(edited, tests).some((o) => o.state === 'mismatch'), 'sửa nhân đôi phải làm lệch ca thử');
  const broken: Expr = { t: 'sym', id: 'khong_co' };
  must(runTests(broken, tests).every((o) => o.state === 'error'), 'thiếu đầu vào phải báo lỗi chứ không treo');
});
check('trình soạn: thông báo lỗi từ cơ sở dữ liệu', () => {
  must(saveErrorText('formula_cycle').includes('vòng lặp'), 'vòng lặp');
  must(saveErrorText('xyz').includes('Không lưu được'), 'lỗi chung');
});

// 7. Engine đọc công thức từ thư viện ------------------------------------------------------------------------------
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readRepo = (...parts: string[]): string => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

check('danh sách công thức đã nối khớp với mã nguồn', () => {
  const sqlText = fs
    .readdirSync(path.join(repoRoot, 'supabase', 'migrations'))
    .filter((name) => name.includes('formula_runtime_wiring'))
    .map((name) => readRepo('supabase', 'migrations', name))
    .join('\n');
  const tsText = readRepo('frontend', 'src', 'domain', 'assessmentRules.ts');
  const sqlCodes = new Set([...sqlText.matchAll(/formula_apply_(?:num|label)\(\s*'([a-z0-9_]+)'/g)].map((m) => m[1]));
  const tsCodes = new Set([...tsText.matchAll(/apply(?:Number|Label)\(\s*'([a-z0-9_]+)'/g)].map((m) => m[1]));
  for (const [code, binding] of Object.entries(LIVE_BINDINGS)) {
    must(FORMULAS_BY_CODE[code] !== undefined, `${code} không có trong danh mục`);
    must(Boolean(binding.sql) === sqlCodes.has(code), `${code}: khai báo sql=${Boolean(binding.sql)} nhưng mã SQL ${sqlCodes.has(code) ? 'có' : 'không có'} lời gọi`);
    must(Boolean(binding.ts) === tsCodes.has(code), `${code}: khai báo ts=${Boolean(binding.ts)} nhưng mã TS ${tsCodes.has(code) ? 'có' : 'không có'} lời gọi`);
  }
  for (const code of [...sqlCodes, ...tsCodes]) must(LIVE_BINDINGS[code] !== undefined, `${code} có lời gọi trong mã nguồn nhưng thiếu trong danh sách đã nối`);
});
check('tệp kiểm thử SQL sinh từ danh mục không bị cũ', () => {
  const onDisk = readRepo('supabase', 'tests', 'formula_catalog_fixture.sql').replace(/\r\n/g, '\n');
  must(onDisk === buildFormulaFixtureSql(), 'danh mục đã đổi: chạy npm run gen:formula-fixture');
});

const ACTIVE_EXPRESSIONS = Object.fromEntries(FORMULAS.map((f) => [f.code, f.expression]));
const asOverrides = (codes: string[], edited: Record<string, Expr> = {}) =>
  setFormulaOverrides({
    formulas: Object.fromEntries(codes.map((code) => [code, { expression: edited[code] ?? FORMULAS_BY_CODE[code].expression, params: {} }])),
    active: { ...ACTIVE_EXPRESSIONS, ...edited },
    params: {},
  });
const tsCodesLive = Object.entries(LIVE_BINDINGS).filter(([, b]) => b.ts).map(([code]) => code);

const DECISION_OPTIONS: R.DecisionOptionInput[] = [
  { id: 'a', title: 'A', admissionFloor: 30, learnerScore: 28, tuitionPerYear: 20, careerFitPercent: 80, locationScore: null, city: 'TP.HCM' },
  { id: 'b', title: 'B', admissionFloor: 900, learnerScore: 950, tuitionPerYear: 40, careerFitPercent: 75, locationScore: null, city: 'Hà Nội' },
  { id: 'c', title: 'C', admissionFloor: null, learnerScore: 20, tuitionPerYear: 0, careerFitPercent: 60, locationScore: 40, city: null },
  { id: 'd', title: 'D', admissionFloor: 25, learnerScore: null, tuitionPerYear: null, careerFitPercent: null, locationScore: null, city: 'Đà Nẵng' },
];
const DECISION_WEIGHTS = { careerFit: 3, admission: 3, finance: 2, location: 1 };
const decisionRuns = () => [
  R.compareDecisionOptions(DECISION_OPTIONS, DECISION_WEIGHTS, 30, 'TP.HCM'),
  R.compareDecisionOptions(DECISION_OPTIONS, DECISION_WEIGHTS, null, 'hà nội'),
  R.compareDecisionOptions(DECISION_OPTIONS, { ...DECISION_WEIGHTS, finance: 0 }, null, null),
  R.compareDecisionOptions(DECISION_OPTIONS.slice(0, 2), DECISION_WEIGHTS, 25, null),
];
const ROADMAP_MILESTONES: R.RoadmapMilestoneProgressInput[] = [
  { id: '1', pillar: 'knowledge', title: 'A', done: true, weight: 2, dueDate: '2026-01-10' },
  { id: '2', pillar: 'knowledge', title: 'B', done: false, weight: 1, dueDate: '2026-02-01' },
  { id: '3', pillar: 'experience', title: 'C', done: false, weight: 1, dueDate: '2026-01-20', isCheckpoint: true },
];
const roadmapRuns = () => [
  R.evaluateRoadmapProgress(ROADMAP_MILESTONES, '2026-03-01', { startIso: '2026-01-01', targetIso: '2026-04-01' }),
  R.evaluateRoadmapProgress(ROADMAP_MILESTONES, '2026-03-01'),
  R.evaluateRoadmapProgress([], '2026-03-01', { startIso: '2026-01-01', targetIso: '2026-04-01' }),
];
const SUPPLEMENTAL_INPUT = { empathicAccuracy: [2, 1, 2, 1], solo: [4, 3, 5, 4], carkhuff: 4 };
const supplementalRuns = () => (['parent', 'friend', 'teacher', 'mentor'] as const).map((g) => R.supplementalUnderstandingScore(g, SUPPLEMENTAL_INPUT));

check('engine: đặt đúng biểu thức gốc thì kết quả giữ nguyên', () => {
  setFormulaOverrides(null);
  const before = JSON.stringify([decisionRuns(), roadmapRuns(), supplementalRuns()]);
  asOverrides(tsCodesLive);
  const after = JSON.stringify([decisionRuns(), roadmapRuns(), supplementalRuns()]);
  setFormulaOverrides(null);
  must(before === after, 'kết quả đổi dù biểu thức không đổi');
});
check('engine: sửa công thức thì kết quả đổi theo', () => {
  setFormulaOverrides(null);
  const baseline = decisionRuns()[0];
  asOverrides(['option_total_score'], { option_total_score: { t: 'num', v: 50 } });
  const edited = decisionRuns()[0];
  must(edited.every((o) => o.totalScore === 50), 'điểm tổng phải theo công thức mới');
  must(baseline.some((o) => o.totalScore !== 50), 'điểm gốc phải khác 50');
  asOverrides(['roadmap_off_track'], { roadmap_off_track: { t: 'text', v: 'Đúng hướng' } });
  must(R.evaluateRoadmapProgress(ROADMAP_MILESTONES, '2026-03-01', { startIso: '2026-01-01', targetIso: '2026-04-01' }).offTrack === false, 'cảnh báo chệch hướng phải theo công thức mới');
  asOverrides(['supplemental_score'], { supplemental_score: { t: 'num', v: 42 } });
  must(R.supplementalUnderstandingScore('mentor', SUPPLEMENTAL_INPUT) === 42, 'điểm bổ sung phải theo công thức mới');
  setFormulaOverrides(null);
});
check('engine: biểu thức lỗi thì quay về kết quả sẵn có', () => {
  setFormulaOverrides(null);
  const baseline = JSON.stringify(decisionRuns());
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    asOverrides(['admission_score'], { admission_score: { t: 'sym', id: 'budget' } });
    must(JSON.stringify(decisionRuns()) === baseline, 'lỗi biểu thức không được làm đổi kết quả');
  } finally {
    console.warn = warn;
    setFormulaOverrides(null);
  }
});

// Soạn công thức dạng chuỗi thẻ ------------------------------------------------------------------------------------
const tokenCtx = { symbols: SYMBOLS_BY_CODE };
const sameTree = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const typed = (...bodies: TokenBody[]): Token[] => bodies.map(tok);
const n = (v: number): TokenBody => ({ k: 'val', expr: { t: 'num', v } });

check('chuỗi thẻ: mọi công thức chuyển sang thẻ rồi đọc lại ra đúng cây', () => {
  for (const f of FORMULAS) {
    const back = lineToExpr(exprToLine(f.expression), tokenCtx);
    must(back.ok && sameTree(back.expr, f.expression), `${f.code}: ${back.ok ? 'khác cây' : back.error.message}`);
  }
});
check('chuỗi thẻ: mọi biểu thức con và điều kiện bên trong thẻ khối cũng đọc lại đúng', () => {
  const conds: Cond[] = [];
  for (const f of FORMULAS) {
    walkExpr(f.expression, (node) => {
      const back = tokensToExpr(exprToTokens(node), tokenCtx);
      must(back.ok && sameTree(back.value, node), `${f.code}: biểu thức con ${node.t}`);
      if (node.t === 'cases') conds.push(...node.branches.map((branch) => branch.when));
      if (node.t === 'agg' && node.where) conds.push(node.where);
    });
  }
  for (const cond of conds) {
    const back = tokensToCond(condToTokens(cond), tokenCtx);
    must(back.ok && sameTree(back.value, cond), `điều kiện ${JSON.stringify(cond)}`);
  }
});
check('chuỗi thẻ: ngoặc giữ đúng thứ tự tính', () => {
  const a: Expr = { t: 'sym', id: 'th_score' };
  const b: Expr = { t: 'num', v: 2 };
  const c: Expr = { t: 'num', v: 3 };
  const trees: Expr[] = [
    { t: 'bin', op: '-', l: a, r: { t: 'bin', op: '-', l: b, r: c } },
    { t: 'bin', op: '+', l: a, r: { t: 'bin', op: '+', l: b, r: c } },
    { t: 'bin', op: '*', l: a, r: { t: 'div', n: b, d: c } },
    { t: 'div', n: a, d: { t: 'bin', op: '*', l: b, r: c } },
    { t: 'bin', op: '*', l: { t: 'bin', op: '+', l: a, r: b }, r: c },
  ];
  for (const tree of trees) {
    const back = tokensToExpr(exprToTokens(tree), tokenCtx);
    must(back.ok && sameTree(back.value, tree), JSON.stringify(tree));
  }
  const nested: Cond = { c: 'and', items: [{ c: 'or', items: [{ c: 'notnull', e: a }, { c: 'cmp', op: '>', l: a, r: b }] }, { c: 'cmp', op: '<', l: a, r: c }] };
  const back = tokensToCond(condToTokens(nested), tokenCtx);
  must(back.ok && sameTree(back.value, nested), 'hoặc lồng trong và');
});
check('chuỗi thẻ: gõ 3 + 4 × 2 nhân trước cộng sau', () => {
  const parsed = tokensToExpr(typed(n(3), { k: 'op', op: '+' }, n(4), { k: 'op', op: '*' }, n(2)), tokenCtx);
  must(parsed.ok && evaluate(parsed.value, {}) === 11, parsed.ok ? String(evaluate(parsed.value, {})) : parsed.message);
});
check('chuỗi thẻ: báo lỗi đúng chỗ khi gõ thiếu', () => {
  const missing = tokensToExpr(typed(n(3), { k: 'op', op: '+' }), tokenCtx);
  must(!missing.ok && missing.at === 1, 'thiếu giá trị sau dấu cộng');
  const extra = tokensToExpr(typed(n(3), { k: 'close' }), tokenCtx);
  must(!extra.ok && extra.at === 1, 'dấu đóng ngoặc thừa');
  const gap = tokensToExpr(typed(n(3), n(4)), tokenCtx);
  must(!gap.ok && gap.at === 1, 'thiếu dấu giữa hai số');
  const unclosed = tokensToExpr(typed({ k: 'fn', name: 'max' }, n(1), { k: 'comma' }, n(2)), tokenCtx);
  must(!unclosed.ok, 'thiếu đóng ngoặc của hàm');
  must(!tokensToCond(typed(n(1)), tokenCtx).ok, 'điều kiện thiếu phép so sánh');
});
check('chuỗi thẻ: dấu chia mới gõ tự bỏ giá trị khi mẫu bằng 0 nếu mẫu chắc chắn khác 0', () => {
  const div: TokenBody = { k: 'op', op: '/', ifZero: { t: 'na' }, auto: true };
  const byNumber = tokensToExpr(typed({ k: 'val', expr: { t: 'sym', id: 'th_score' } }, div, n(9)), tokenCtx);
  must(byNumber.ok && byNumber.value.t === 'div' && byNumber.value.ifZero === undefined, 'chia cho 9 không cần nhánh dự phòng');
  const bySymbol = tokensToExpr(typed(n(1), div, { k: 'val', expr: { t: 'sym', id: 'n_questions' } }), tokenCtx);
  must(bySymbol.ok && bySymbol.value.t === 'div' && bySymbol.value.ifZero?.t === 'na', 'chia cho ký hiệu có thể bằng 0 thì giữ "không có giá trị"');
});
check('chuỗi thẻ: đọc số người dùng gõ', () => {
  must(parseTypedNumber('0,5') === 0.5 && parseTypedNumber('0.5') === 0.5 && parseTypedNumber('-3') === -3, 'số thập phân và số âm');
  must(parseTypedNumber('5.000.000') === 5000000 && parseTypedNumber('1.250,5') === 1250.5, 'dấu chấm ngăn hàng nghìn');
  must(parseTypedNumber('0.250') === 0.25, '0.250 là số thập phân');
  must(parseTypedNumber('abc') === null && parseTypedNumber('') === null && parseTypedNumber('-') === null, 'không phải số');
});

console.log(`${passed} kiểm tra đạt, ${failed} thất bại; ${FORMULAS.length} công thức, ${SYMBOLS.length} ký hiệu`);
if (failed > 0) throw new Error(`${failed} kiểm tra thất bại`);
