import type { Cond, Expr, SymbolDef } from './types';

export type IssueCode =
  | 'unknown_symbol'
  | 'unknown_param'
  | 'unknown_formula'
  | 'wrong_symbol_kind'
  | 'division_by_zero_risk'
  | 'bad_arity'
  | 'missing_body'
  | 'empty_cases';

export interface ValidationIssue {
  code: IssueCode;
  message: string;
}

export interface ValidationContext {
  symbols: Readonly<Record<string, SymbolDef>>;
  /** Mã các công thức đang có */
  formulaCodes: ReadonlySet<string>;
}

const ARITY: Record<string, [number, number]> = {
  min: [2, Infinity],
  max: [2, Infinity],
  floor: [1, 1],
  abs: [1, 1],
  round: [1, 2],
  clamp: [3, 3],
};

/** Duyệt mọi nút biểu thức, kể cả trong điều kiện */
export function walkExpr(expr: Expr, visit: (node: Expr) => void): void {
  visit(expr);
  const walkCond = (cond: Cond): void => {
    if (cond.c === 'cmp') {
      walkExpr(cond.l, visit);
      walkExpr(cond.r, visit);
    } else if (cond.c === 'notnull') {
      walkExpr(cond.e, visit);
    } else {
      cond.items.forEach(walkCond);
    }
  };
  switch (expr.t) {
    case 'bin':
      walkExpr(expr.l, visit);
      walkExpr(expr.r, visit);
      return;
    case 'div':
      walkExpr(expr.n, visit);
      walkExpr(expr.d, visit);
      if (expr.ifZero) walkExpr(expr.ifZero, visit);
      return;
    case 'fn':
      expr.args.forEach((arg) => walkExpr(arg, visit));
      return;
    case 'agg':
      expr.rows?.forEach((row) => Object.values(row).forEach((cell) => walkExpr(cell, visit)));
      if (expr.where) walkCond(expr.where);
      if (expr.body) walkExpr(expr.body, visit);
      return;
    case 'cases':
      expr.branches.forEach((branch) => {
        walkCond(branch.when);
        walkExpr(branch.then, visit);
      });
      walkExpr(expr.otherwise, visit);
      return;
    default:
  }
}

export interface Dependencies {
  formulas: string[];
  params: string[];
  symbols: string[];
}

/** Công thức, tham số và ký hiệu mà biểu thức dùng (không trùng, giữ thứ tự xuất hiện) */
export function collectDependencies(expr: Expr): Dependencies {
  const formulas = new Set<string>();
  const params = new Set<string>();
  const symbols = new Set<string>();
  walkExpr(expr, (node) => {
    if (node.t === 'ref') formulas.add(node.formula);
    else if (node.t === 'param') params.add(node.code);
    else if (node.t === 'sym') symbols.add(node.id);
  });
  return { formulas: [...formulas], params: [...params], symbols: [...symbols] };
}

/** Mẫu số chắc chắn khác 0, nên không cần nhánh dự phòng */
export function isProvablyNonZero(expr: Expr, symbols: Readonly<Record<string, SymbolDef>>): boolean {
  switch (expr.t) {
    case 'num':
      return expr.v !== 0;
    case 'fn':
      return expr.name === 'max' && expr.args.some((arg) => arg.t === 'num' && arg.v > 0);
    case 'bin':
      return expr.op === '*' && isProvablyNonZero(expr.l, symbols) && isProvablyNonZero(expr.r, symbols);
    case 'sym':
    case 'param': {
      const def = symbols[expr.t === 'sym' ? expr.id : expr.code];
      return def !== undefined && ((def.min !== undefined && def.min > 0) || (def.max !== undefined && def.max < 0));
    }
    default:
      return false;
  }
}

export function validateExpression(expr: Expr, ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (code: IssueCode, message: string): void => {
    issues.push({ code, message });
  };
  walkExpr(expr, (node) => {
    switch (node.t) {
      case 'sym': {
        const def = ctx.symbols[node.id];
        if (!def) add('unknown_symbol', `Ký hiệu chưa khai báo: ${node.id}`);
        else if (def.kind === 'param') add('wrong_symbol_kind', `${node.id} là tham số, không dùng như dữ liệu đầu vào`);
        return;
      }
      case 'param': {
        const def = ctx.symbols[node.code];
        if (!def) add('unknown_param', `Tham số chưa khai báo: ${node.code}`);
        else if (def.kind !== 'param') add('wrong_symbol_kind', `${node.code} không phải tham số`);
        return;
      }
      case 'ref':
        if (!ctx.formulaCodes.has(node.formula)) add('unknown_formula', `Công thức không tồn tại: ${node.formula}`);
        return;
      case 'div':
        if (!node.ifZero && !isProvablyNonZero(node.d, ctx.symbols)) {
          add('division_by_zero_risk', 'Mẫu số có thể bằng 0, cần ghi giá trị khi mẫu số bằng 0');
        }
        return;
      case 'fn': {
        const [min, max] = ARITY[node.name];
        if (node.args.length < min || node.args.length > max) {
          add('bad_arity', `Hàm ${node.name} nhận ${min === max ? min : `${min}${max === Infinity ? '+' : `–${max}`}`} đối số`);
        }
        return;
      }
      case 'agg':
        if (node.kind !== 'count' && !node.body) add('missing_body', `Phép ${node.kind} thiếu biểu thức bên trong`);
        return;
      case 'cases':
        if (node.branches.length === 0) add('empty_cases', 'Phân nhánh cần ít nhất một điều kiện');
        return;
      default:
    }
  });
  return issues;
}

/** Tìm một vòng lặp trong đồ thị phụ thuộc (mã công thức → các mã nó dùng). Không có vòng thì trả null */
export function findCycle(graph: Readonly<Record<string, readonly string[]>>): string[] | null {
  const state = new Map<string, 'visiting' | 'done'>();
  const path: string[] = [];
  const visit = (node: string): string[] | null => {
    const mark = state.get(node);
    if (mark === 'done') return null;
    if (mark === 'visiting') return [...path.slice(path.indexOf(node)), node];
    state.set(node, 'visiting');
    path.push(node);
    for (const next of graph[node] ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    path.pop();
    state.set(node, 'done');
    return null;
  };
  for (const node of Object.keys(graph)) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}
