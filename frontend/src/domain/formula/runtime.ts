/**
 * Cầu nối giữa hàm tính điểm sẵn có và thư viện công thức.
 * Công thức chưa bị thay thì các hàm trả đúng kết quả cũ. Công thức bị thay (phiên bản hiệu lực khác bản gốc)
 * thì tính theo biểu thức mới. Biểu thức lỗi hoặc thiếu đầu vào thì quay về kết quả cũ.
 */
import { evaluate } from './evaluate';
import type { EvalContext, Expr, Value } from './types';

export interface FormulaOverridePayload {
  /** Công thức đang bị thay, khóa là mã công thức */
  formulas: Record<string, { expression: Expr; params: Record<string, Value> }>;
  /** Bản hiệu lực của mọi công thức, để tự tính công thức con */
  active: Record<string, Expr>;
  /** Giá trị tham số vận hành theo mã ký hiệu */
  params: Record<string, Value>;
}

let overrides: Record<string, Expr> = {};
let activeFormulas: Record<string, Expr> = {};
let paramValues: Record<string, Value> = {};
const warned = new Set<string>();

export function setFormulaOverrides(payload: FormulaOverridePayload | null | undefined): void {
  overrides = {};
  activeFormulas = payload?.active ?? {};
  paramValues = payload?.params ?? {};
  for (const [code, entry] of Object.entries(payload?.formulas ?? {})) overrides[code] = entry.expression;
}

export function isFormulaOverridden(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(overrides, code);
}

function run(code: string, ctx: EvalContext): Value | undefined {
  const expression = overrides[code];
  if (!expression) return undefined;
  try {
    return evaluate(expression, { ...ctx, vars: { ...paramValues, ...ctx.vars }, formulas: activeFormulas });
  } catch (error) {
    if (!warned.has(code)) {
      warned.add(code);
      console.warn(`Công thức ${code} lỗi, dùng kết quả sẵn có:`, error instanceof Error ? error.message : error);
    }
    return undefined;
  }
}

/** Công thức cho ra số (hoặc rỗng) */
export function applyNumber(code: string, native: number | null, ctx: EvalContext = {}): number | null {
  const value = run(code, ctx);
  if (value === undefined) return native;
  if (value === null || typeof value === 'number') return value;
  return native;
}

/** Công thức cho ra nhãn chữ; map đổi nhãn trong công thức sang giá trị dùng trong dữ liệu */
export function applyLabel<T extends string>(code: string, native: T, map: Readonly<Record<string, T>>, ctx: EvalContext = {}): T {
  const value = run(code, ctx);
  if (typeof value !== 'string') return native;
  return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : native;
}
