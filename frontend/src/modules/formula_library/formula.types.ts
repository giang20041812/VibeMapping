import type { EvalContext, Expr, SymbolDef, Value, VerificationLevel } from '../../domain/formula';

export interface FormulaGroupRow {
  id: string;
  group_code: string;
  group_name: string;
  sort_order: number;
}

export interface FormulaRecord {
  id: string;
  formula_code: string;
  formula_name: string;
  group_id: string;
  group_name: string;
  output_symbol: string;
  output_unit: string | null;
  verification_level: VerificationLevel;
  sort_order: number;
  /** Phiên bản đang hiệu lực; null khi công thức chưa có bản nào */
  version_no: number | null;
  effective_from: string | null;
  expression: Expr | null;
}

export interface FormulaLibrary {
  groups: FormulaGroupRow[];
  symbols: SymbolDef[];
  formulas: FormulaRecord[];
}

export interface FormulaVersionRow {
  id: string;
  version_no: number;
  status: 'draft' | 'active' | 'retired';
  note: string | null;
  effective_from: string | null;
  created_at: string;
}

export interface FormulaTestRow {
  id: string;
  case_name: string;
  inputs: EvalContext;
  expected: Value;
  tolerance: number;
}

export interface FormulaFilter {
  keyword: string;
  groupId: string;
  verification: string;
}
