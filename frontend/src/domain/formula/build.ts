import type { AggKind, Cond, Expr, FnName } from './types';

/** Hàm dựng cây biểu thức gọn, dùng cho danh mục công thức và trình soạn */

export const num = (v: number): Expr => ({ t: 'num', v });
export const text = (v: string): Expr => ({ t: 'text', v });
export const na: Expr = { t: 'na' };
export const sym = (id: string): Expr => ({ t: 'sym', id });
export const param = (code: string): Expr => ({ t: 'param', code });
export const ref = (formula: string, show?: string): Expr => (show ? { t: 'ref', formula, show } : { t: 'ref', formula });

export const add = (first: Expr, ...rest: Expr[]): Expr =>
  rest.reduce<Expr>((l, r) => ({ t: 'bin', op: '+', l, r }), first);
export const sub = (l: Expr, r: Expr): Expr => ({ t: 'bin', op: '-', l, r });
export const mul = (first: Expr, ...rest: Expr[]): Expr =>
  rest.reduce<Expr>((l, r) => ({ t: 'bin', op: '*', l, r }), first);
export const div = (n: Expr, d: Expr, ifZero?: Expr): Expr => (ifZero ? { t: 'div', n, d, ifZero } : { t: 'div', n, d });

const fn = (name: FnName, ...args: Expr[]): Expr => ({ t: 'fn', name, args });
export const minOf = (...args: Expr[]): Expr => fn('min', ...args);
export const maxOf = (...args: Expr[]): Expr => fn('max', ...args);
export const floorOf = (x: Expr): Expr => fn('floor', x);
export const absOf = (x: Expr): Expr => fn('abs', x);
export const clampOf = (x: Expr, lo: Expr, hi: Expr): Expr => fn('clamp', x, lo, hi);

const agg =
  (kind: AggKind) =>
  (index: string, over: string, label: string, body?: Expr, where?: Cond): Expr => ({
    t: 'agg',
    kind,
    index,
    over,
    label,
    ...(where ? { where } : {}),
    ...(body ? { body } : {}),
  });
export const sum = agg('sum');

/** Tổng trên tập dòng viết thẳng: mỗi dòng gán biểu thức cho các khóa dùng trong where và body */
export const sumRows = (index: string, label: string, rows: Record<string, Expr>[], body: Expr, where?: Cond): Expr => ({
  t: 'agg',
  kind: 'sum',
  index,
  over: '',
  label,
  rows,
  body,
  ...(where ? { where } : {}),
});
export const avg = agg('avg');
export const maxAgg = agg('max');
export const count = (index: string, over: string, label: string, where?: Cond): Expr =>
  agg('count')(index, over, label, undefined, where);

export const cmp = (op: '>=' | '>' | '<=' | '<' | '=' | '!=', l: Expr, r: Expr): Cond => ({ c: 'cmp', op, l, r });
export const notnull = (e: Expr): Cond => ({ c: 'notnull', e });
export const and = (...items: Cond[]): Cond => ({ c: 'and', items });
export const or = (...items: Cond[]): Cond => ({ c: 'or', items });

export const cases = (branches: Array<[Cond, Expr]>, otherwise: Expr): Expr => ({
  t: 'cases',
  branches: branches.map(([when, then]) => ({ when, then })),
  otherwise,
});
