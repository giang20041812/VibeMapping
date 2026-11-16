import { evaluate, findCycle, collectDependencies, validateExpression, valuesMatch, type Cond, type Expr, type FnName, type SymbolDef, type Value } from '../../domain/formula';
import type { FormulaLibrary, FormulaRecord, FormulaTestRow } from './formula.types';

export type NodeKind = Expr['t'];

export const KIND_OPTIONS: { value: NodeKind; label: string }[] = [
  { value: 'num', label: 'Số' },
  { value: 'text', label: 'Chữ' },
  { value: 'na', label: 'Không xác định' },
  { value: 'sym', label: 'Dữ liệu đầu vào' },
  { value: 'param', label: 'Tham số' },
  { value: 'ref', label: 'Công thức khác' },
  { value: 'bin', label: 'Cộng, trừ, nhân' },
  { value: 'div', label: 'Phân số' },
  { value: 'fn', label: 'Hàm' },
  { value: 'agg', label: 'Tổng, trung bình, đếm' },
  { value: 'cases', label: 'Phân nhánh' },
];

export const COND_KIND_OPTIONS: { value: Cond['c']; label: string }[] = [
  { value: 'cmp', label: 'So sánh' },
  { value: 'notnull', label: 'Có giá trị' },
  { value: 'and', label: 'Và' },
  { value: 'or', label: 'Hoặc' },
];

export const BIN_OPTIONS = [
  { value: '+', label: 'Cộng' },
  { value: '-', label: 'Trừ' },
  { value: '*', label: 'Nhân' },
];

export const CMP_OPTIONS = [
  { value: '>=', label: 'Lớn hơn hoặc bằng' },
  { value: '>', label: 'Lớn hơn' },
  { value: '<=', label: 'Nhỏ hơn hoặc bằng' },
  { value: '<', label: 'Nhỏ hơn' },
  { value: '=', label: 'Bằng' },
  { value: '!=', label: 'Khác' },
];

export const FN_OPTIONS: { value: FnName; label: string }[] = [
  { value: 'min', label: 'Nhỏ nhất' },
  { value: 'max', label: 'Lớn nhất' },
  { value: 'floor', label: 'Làm tròn xuống' },
  { value: 'abs', label: 'Giá trị tuyệt đối' },
  { value: 'round', label: 'Làm tròn' },
  { value: 'clamp', label: 'Giới hạn trong khoảng' },
];

/** Số đối số của mỗi hàm: [tối thiểu, tối đa] */
export const FN_ARITY: Record<FnName, [number, number]> = {
  min: [2, Infinity],
  max: [2, Infinity],
  floor: [1, 1],
  abs: [1, 1],
  round: [1, 2],
  clamp: [3, 3],
};

export const AGG_KIND_OPTIONS = [
  { value: 'sum', label: 'Tổng' },
  { value: 'avg', label: 'Trung bình' },
  { value: 'count', label: 'Đếm' },
  { value: 'min', label: 'Nhỏ nhất' },
  { value: 'max', label: 'Lớn nhất' },
];

/** Những gì trình soạn cho chọn: dữ liệu đầu vào, tham số và công thức khác được phép dùng */
export interface EditorEnv {
  inputSymbols: SymbolDef[];
  paramSymbols: SymbolDef[];
  formulas: { code: string; name: string }[];
}

const zero: Expr = { t: 'num', v: 0 };

export function defaultCond(kind: Cond['c']): Cond {
  switch (kind) {
    case 'cmp':
      return { c: 'cmp', op: '>=', l: zero, r: zero };
    case 'notnull':
      return { c: 'notnull', e: zero };
    case 'and':
    case 'or':
      return { c: kind, items: [defaultCond('cmp')] };
  }
}

export function defaultNode(kind: NodeKind, env: EditorEnv): Expr {
  switch (kind) {
    case 'num':
      return zero;
    case 'text':
      return { t: 'text', v: '' };
    case 'na':
      return { t: 'na' };
    case 'sym':
      return { t: 'sym', id: env.inputSymbols[0]?.code ?? '' };
    case 'param':
      return { t: 'param', code: env.paramSymbols[0]?.code ?? '' };
    case 'ref':
      return { t: 'ref', formula: env.formulas[0]?.code ?? '' };
    case 'bin':
      return { t: 'bin', op: '+', l: zero, r: zero };
    case 'div':
      return { t: 'div', n: zero, d: { t: 'num', v: 1 } };
    case 'fn':
      return { t: 'fn', name: 'min', args: [zero, zero] };
    case 'agg':
      return { t: 'agg', kind: 'sum', index: 'i', over: 'items', label: 'mục', body: zero };
    case 'cases':
      return { t: 'cases', branches: [{ when: defaultCond('cmp'), then: zero }], otherwise: zero };
  }
}

/** Đổi loại nút; giữ lại các vế khi đổi giữa phép tính và phân số */
export function changeNodeKind(current: Expr, kind: NodeKind, env: EditorEnv): Expr {
  if (current.t === kind) return current;
  if (current.t === 'bin' && kind === 'div') return { t: 'div', n: current.l, d: current.r };
  if (current.t === 'div' && kind === 'bin') return { t: 'bin', op: '*', l: current.n, r: current.d };
  return defaultNode(kind, env);
}

/** Chỉnh số đối số của hàm cho đúng với hàm vừa chọn */
export function fitFnArgs(name: FnName, args: Expr[]): Expr[] {
  const [min, max] = FN_ARITY[name];
  const next = args.slice(0, Number.isFinite(max) ? max : args.length);
  while (next.length < min) next.push(zero);
  return next;
}

/** Công thức có thể dùng trong công thức này: không phải chính nó và không phải công thức đang dùng nó (tránh vòng lặp) */
export function allowedRefs(selfCode: string, formulas: readonly FormulaRecord[]): FormulaRecord[] {
  const users = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const formula of formulas) {
      if (users.has(formula.formula_code) || !formula.expression) continue;
      const deps = collectDependencies(formula.expression).formulas;
      if (deps.includes(selfCode) || deps.some((code) => users.has(code))) {
        users.add(formula.formula_code);
        grew = true;
      }
    }
  }
  return formulas.filter((formula) => formula.formula_code !== selfCode && !users.has(formula.formula_code));
}

export function buildEditorEnv(library: FormulaLibrary, selfCode: string): EditorEnv {
  return {
    inputSymbols: library.symbols.filter((symbol) => symbol.kind === 'input'),
    paramSymbols: library.symbols.filter((symbol) => symbol.kind === 'param'),
    formulas: allowedRefs(selfCode, library.formulas).map((formula) => ({ code: formula.formula_code, name: formula.formula_name })),
  };
}

export interface DraftIssue {
  message: string;
  /** Lỗi chặn lưu; cảnh báo (mẫu số có thể bằng 0) vẫn cho lưu bản nháp */
  blocking: boolean;
}

/** Kiểm tra bản đang soạn: ký hiệu, tham chiếu, chia cho 0 và vòng lặp với các công thức khác */
export function checkDraft(expression: Expr, selfCode: string, library: FormulaLibrary): DraftIssue[] {
  const symbols = Object.fromEntries(library.symbols.map((symbol) => [symbol.code, symbol]));
  const issues: DraftIssue[] = validateExpression(expression, {
    symbols,
    formulaCodes: new Set(library.formulas.map((formula) => formula.formula_code)),
  }).map((issue) => ({ message: issue.message, blocking: issue.code !== 'division_by_zero_risk' }));

  const graph: Record<string, string[]> = {};
  for (const formula of library.formulas) {
    graph[formula.formula_code] = formula.formula_code === selfCode ? collectDependencies(expression).formulas : formula.expression ? collectDependencies(formula.expression).formulas : [];
  }
  const cycle = findCycle(graph);
  if (cycle) issues.push({ message: 'Công thức tạo vòng lặp với công thức khác', blocking: true });
  return issues;
}

export interface TestOutcome {
  test: FormulaTestRow;
  actual: Value | undefined;
  state: 'match' | 'mismatch' | 'error';
}

/** Tính lại các ca thử bằng một cây biểu thức */
export function runTests(expression: Expr, tests: readonly FormulaTestRow[]): TestOutcome[] {
  return tests.map((test) => {
    try {
      const actual = evaluate(expression, test.inputs);
      return { test, actual, state: valuesMatch(actual, test.expected, test.tolerance) ? 'match' : 'mismatch' };
    } catch {
      return { test, actual: undefined, state: 'error' };
    }
  });
}

/** Chuyển lỗi từ cơ sở dữ liệu thành câu cho người dùng */
export function saveErrorText(message: string): string {
  if (message.includes('formula_cycle')) return 'Công thức tạo vòng lặp với công thức khác.';
  if (message.includes('formula_ref_not_found')) return 'Có công thức được dùng nhưng không còn tồn tại.';
  if (message.includes('formula_param_not_found')) return 'Có tham số được dùng nhưng không còn tồn tại.';
  if (message.includes('formula_symbol_not_found')) return 'Có ký hiệu được dùng nhưng chưa khai báo.';
  if (message.includes('formula_version_immutable')) return 'Phiên bản đã hiệu lực không sửa được nội dung.';
  if (message.includes('uq_formula_versions_draft')) return 'Đã có một bản nháp khác, tải lại trang để tiếp tục.';
  return 'Không lưu được công thức. Thử lại sau.';
}
