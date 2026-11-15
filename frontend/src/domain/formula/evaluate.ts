import { expressionToLatex, type LatexContext } from './latex';
import type { Cond, EvalContext, Expr, TraceStep, Value } from './types';

export class FormulaEvalError extends Error {
  constructor(
    readonly code: 'missing_input' | 'missing_set' | 'missing_formula' | 'type_mismatch' | 'cycle',
    detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = 'FormulaEvalError';
  }
}

type Scope = Readonly<Record<string, Value>>;

export interface EvalOptions {
  /** Có thì ghi lại từng bước trung gian (phân số, hàm, tổng, phân nhánh, công thức con) */
  trace?: TraceStep[];
  latex?: LatexContext;
}

function has(record: Readonly<Record<string, unknown>> | undefined | null, key: string): boolean {
  return record !== undefined && record !== null && Object.prototype.hasOwnProperty.call(record, key);
}

function asNumber(value: Value, where: string): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new FormulaEvalError('type_mismatch', `${where} cần số, nhận ${JSON.stringify(value)}`);
  }
  return value;
}

export function evaluate(expr: Expr, ctx: EvalContext, options: EvalOptions = {}): Value {
  const note = (node: Expr, value: Value): void => {
    if (!options.trace || !options.latex) return;
    options.trace.push({ latex: expressionToLatex(node, options.latex), value });
  };

  const lookup = (kind: 'vars' | 'refs', key: string, scope: Scope): Value | undefined => {
    if (has(scope, key)) return scope[key];
    const bag = kind === 'vars' ? ctx.vars : ctx.refs;
    return has(bag, key) ? (bag as Record<string, Value>)[key] : undefined;
  };

  const test = (cond: Cond, scope: Scope, stack: readonly string[]): boolean => {
    if (cond.c === 'notnull') return ev(cond.e, scope, stack) !== null;
    if (cond.c === 'and') return cond.items.every((item) => test(item, scope, stack));
    if (cond.c === 'or') return cond.items.some((item) => test(item, scope, stack));
    const l = ev(cond.l, scope, stack);
    const r = ev(cond.r, scope, stack);
    if (l === null || r === null) return false;
    if (typeof l === 'string' || typeof r === 'string') {
      if (cond.op === '=') return l === r;
      if (cond.op === '!=') return l !== r;
      return false;
    }
    switch (cond.op) {
      case '>=':
        return l >= r;
      case '>':
        return l > r;
      case '<=':
        return l <= r;
      case '<':
        return l < r;
      case '=':
        return l === r;
      case '!=':
        return l !== r;
    }
  };

  const ev = (expr: Expr, scope: Scope, stack: readonly string[]): Value => {
    switch (expr.t) {
      case 'num':
        return expr.v;
      case 'text':
        return expr.v;
      case 'na':
        return null;
      case 'sym':
      case 'param': {
        const key = expr.t === 'sym' ? expr.id : expr.code;
        const value = lookup('vars', key, scope);
        if (value === undefined) throw new FormulaEvalError('missing_input', key);
        return value;
      }
      case 'ref': {
        const direct = lookup('refs', expr.formula, scope);
        if (direct !== undefined) return direct;
        const sub = ctx.formulas?.[expr.formula];
        if (!sub) throw new FormulaEvalError('missing_formula', expr.formula);
        if (stack.includes(expr.formula)) throw new FormulaEvalError('cycle', [...stack, expr.formula].join(' → '));
        const value = ev(sub, scope, [...stack, expr.formula]);
        note(expr, value);
        return value;
      }
      case 'bin': {
        const l = asNumber(ev(expr.l, scope, stack), expr.op);
        const r = asNumber(ev(expr.r, scope, stack), expr.op);
        if (l === null || r === null) return null;
        return expr.op === '+' ? l + r : expr.op === '-' ? l - r : l * r;
      }
      case 'div': {
        const d = asNumber(ev(expr.d, scope, stack), 'mẫu số');
        const n = asNumber(ev(expr.n, scope, stack), 'tử số');
        let value: Value;
        if (d === null) value = null;
        else if (d === 0) value = expr.ifZero ? ev(expr.ifZero, scope, stack) : null;
        else value = n === null ? null : n / d;
        note(expr, value);
        return value;
      }
      case 'fn': {
        const args = expr.args.map((arg) => asNumber(ev(arg, scope, stack), expr.name));
        let value: Value;
        if (args.some((arg) => arg === null)) value = null;
        else {
          const nums = args as number[];
          switch (expr.name) {
            case 'min':
              value = Math.min(...nums);
              break;
            case 'max':
              value = Math.max(...nums);
              break;
            case 'floor':
              value = Math.floor(nums[0]);
              break;
            case 'abs':
              value = Math.abs(nums[0]);
              break;
            case 'round': {
              const scale = 10 ** (nums[1] ?? 0);
              value = Math.round(nums[0] * scale) / scale;
              break;
            }
            case 'clamp':
              value = Math.min(Math.max(nums[0], nums[1]), nums[2]);
              break;
          }
        }
        note(expr, value);
        return value;
      }
      case 'agg': {
        const rows = expr.rows
          ? expr.rows.map((row) =>
              Object.fromEntries(Object.entries(row).map(([key, cell]) => [key, ev(cell, scope, stack)])),
            )
          : ctx.sets?.[expr.over];
        if (!rows) throw new FormulaEvalError('missing_set', expr.over);
        const values: number[] = [];
        let count = 0;
        for (const row of rows) {
          const rowScope: Scope = { ...scope, ...row };
          if (expr.where && !test(expr.where, rowScope, stack)) continue;
          count += 1;
          if (expr.kind === 'count' || !expr.body) continue;
          const v = asNumber(ev(expr.body, rowScope, stack), `thân ${expr.kind}`);
          if (v !== null) values.push(v);
        }
        let value: Value;
        switch (expr.kind) {
          case 'count':
            value = count;
            break;
          case 'sum':
            value = values.reduce((total, v) => total + v, 0);
            break;
          case 'avg':
            value = values.length > 0 ? values.reduce((total, v) => total + v, 0) / values.length : null;
            break;
          case 'min':
            value = values.length > 0 ? Math.min(...values) : null;
            break;
          case 'max':
            value = values.length > 0 ? Math.max(...values) : null;
            break;
        }
        note(expr, value);
        return value;
      }
      case 'cases': {
        const hit = expr.branches.find((branch) => test(branch.when, scope, stack));
        const value = ev(hit ? hit.then : expr.otherwise, scope, stack);
        note(expr, value);
        return value;
      }
    }
  };

  return ev(expr, {}, []);
}

/** So kết quả với giá trị mong đợi: số theo sai số, chuỗi và null theo đúng giá trị */
export function valuesMatch(actual: Value, expected: Value, tolerance = 0.0001): boolean {
  if (actual === null || expected === null) return actual === expected;
  if (typeof actual === 'number' && typeof expected === 'number') return Math.abs(actual - expected) <= tolerance;
  return actual === expected;
}
