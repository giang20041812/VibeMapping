import { collectDependencies, formatNumber, walkExpr, type LatexContext, type SymbolDef, type Value } from '../../domain/formula';
import { normalizeSearchText } from '../../lib/searchText';
import type { FormulaFilter, FormulaLibrary, FormulaRecord } from './formula.types';

export const VERIFICATION_LABEL: Record<string, string> = {
  approved: 'Đã chốt',
  demo: 'Demo',
  pending_ba: 'Chờ chốt',
  blocked: 'Chưa dùng được',
};

export const VERIFICATION_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  approved: 'success',
  demo: 'info',
  pending_ba: 'warning',
  blocked: 'danger',
};

export const VERIFICATION_OPTIONS = Object.entries(VERIFICATION_LABEL).map(([value, label]) => ({ value, label }));

export const SYMBOL_KIND_LABEL: Record<SymbolDef['kind'], string> = {
  input: 'Dữ liệu đầu vào',
  param: 'Tham số',
  formula: 'Kết quả công thức',
};

export function buildLatexContext(library: FormulaLibrary): LatexContext {
  return {
    symbols: Object.fromEntries(library.symbols.map((symbol) => [symbol.code, symbol])),
    outputs: Object.fromEntries(library.formulas.map((formula) => [formula.formula_code, formula.output_symbol])),
  };
}

/** Mã công thức mà công thức này dùng, theo bản đang hiệu lực */
export function formulaDependencies(formula: FormulaRecord): string[] {
  return formula.expression ? collectDependencies(formula.expression).formulas : [];
}

export function paramDependencies(formula: FormulaRecord): string[] {
  return formula.expression ? collectDependencies(formula.expression).params : [];
}

/** Các công thức đang dùng công thức có mã này */
export function formulaDependents(code: string, formulas: FormulaRecord[]): FormulaRecord[] {
  return formulas.filter((item) => formulaDependencies(item).includes(code));
}

/**
 * Ký hiệu xuất hiện ở vế phải: dữ liệu đầu vào, tham số và kết quả của công thức khác
 * (kể cả ký hiệu hiển thị riêng của nút tham chiếu). Giữ thứ tự xuất hiện.
 */
export function symbolsInFormula(formula: FormulaRecord, library: FormulaLibrary): SymbolDef[] {
  if (!formula.expression) return [];
  const byCode = new Map(library.symbols.map((symbol) => [symbol.code, symbol]));
  const outputOf = new Map(library.formulas.map((item) => [item.formula_code, item.output_symbol]));
  const codes: string[] = [];
  const push = (code: string | undefined) => {
    if (code && !codes.includes(code)) codes.push(code);
  };
  walkExpr(formula.expression, (node) => {
    if (node.t === 'sym') push(node.id);
    else if (node.t === 'param') push(node.code);
    else if (node.t === 'ref') push(node.show ?? outputOf.get(node.formula));
  });
  return codes.flatMap((code) => {
    const symbol = byCode.get(code);
    return symbol ? [symbol] : [];
  });
}

export function formatRange(symbol: SymbolDef): string {
  const unit = symbol.unit ? ` ${symbol.unit}` : '';
  if (symbol.min !== undefined && symbol.max !== undefined) return `${symbol.min} – ${symbol.max}${unit}`;
  if (symbol.min !== undefined) return `từ ${symbol.min}${unit}`;
  if (symbol.max !== undefined) return `đến ${symbol.max}${unit}`;
  return unit.trim() || '—';
}

export function formatValue(value: Value | undefined): string {
  if (value === undefined) return '—';
  if (value === null) return 'Không có';
  if (typeof value === 'number') return formatNumber(value).replace('{,}', ',');
  return value;
}

/** Giá trị tham số dạng số, dùng để thay số vào công thức; tham số không phải số thì bỏ qua */
export function numericParamValues(raw: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, number] => typeof entry[1] === 'number'));
}

/** Công thức có khớp bộ lọc của danh sách và sơ đồ không */
export function matchesFormulaFilter(
  formula: Pick<FormulaRecord, 'formula_name' | 'formula_code' | 'group_name' | 'group_id'> & { verification_level: string },
  filter: FormulaFilter,
): boolean {
  if (filter.groupId && formula.group_id !== filter.groupId) return false;
  if (filter.verification && formula.verification_level !== filter.verification) return false;
  const keyword = normalizeSearchText(filter.keyword);
  if (!keyword) return true;
  return normalizeSearchText(`${formula.formula_name} ${formula.formula_code} ${formula.group_name}`).includes(keyword);
}
