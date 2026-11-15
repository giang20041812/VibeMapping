import { supabase } from '../../lib/supabase';
import type { EvalContext, Expr, SymbolDef, Value, VerificationLevel } from '../../domain/formula';
import type { FormulaGroupRow, FormulaLibrary, FormulaRecord, FormulaTestRow, FormulaVersionRow } from './formula.types';

type EmbeddedVersion = { version_no: number; effective_from: string | null; expression: unknown };

function fail(what: string, message: string): never {
  console.error(`Lỗi tải ${what}:`, message);
  throw new Error(what);
}

function isExpr(value: unknown): value is Expr {
  return typeof value === 'object' && value !== null && typeof (value as { t?: unknown }).t === 'string';
}

/** Nhóm, ký hiệu và toàn bộ công thức kèm phiên bản đang hiệu lực */
export async function loadFormulaLibrary(): Promise<FormulaLibrary> {
  const [groups, symbols, formulas] = await Promise.all([
    supabase.from('formula_groups').select('id, group_code, group_name, sort_order').order('sort_order'),
    supabase
      .from('formula_symbols')
      .select('symbol_code, display_latex, symbol_name, source_kind, source_ref, unit, value_min, value_max')
      .limit(1000),
    supabase
      .from('formulas')
      .select(
        'id, formula_code, formula_name, group_id, output_symbol, output_unit, verification_level, sort_order, group:formula_groups(group_name), formula_versions(version_no, effective_from, expression)',
      )
      .eq('formula_versions.status', 'active')
      .order('sort_order')
      .limit(1000),
  ]);
  if (groups.error) fail('nhóm công thức', groups.error.message);
  if (symbols.error) fail('ký hiệu công thức', symbols.error.message);
  if (formulas.error) fail('công thức', formulas.error.message);

  const symbolList: SymbolDef[] = symbols.data.map((row) => ({
    code: row.symbol_code,
    latex: row.display_latex,
    name: row.symbol_name,
    kind: row.source_kind as SymbolDef['kind'],
    ref: row.source_ref ?? undefined,
    unit: row.unit ?? undefined,
    min: row.value_min ?? undefined,
    max: row.value_max ?? undefined,
  }));

  const formulaList: FormulaRecord[] = formulas.data.map((row) => {
    const version = (row.formula_versions as EmbeddedVersion[] | null)?.[0] ?? null;
    return {
      id: row.id,
      formula_code: row.formula_code,
      formula_name: row.formula_name,
      group_id: row.group_id,
      group_name: row.group?.group_name ?? '',
      output_symbol: row.output_symbol,
      output_unit: row.output_unit,
      verification_level: row.verification_level as VerificationLevel,
      sort_order: row.sort_order,
      version_no: version?.version_no ?? null,
      effective_from: version?.effective_from ?? null,
      expression: version && isExpr(version.expression) ? version.expression : null,
    };
  });

  return { groups: groups.data as FormulaGroupRow[], symbols: symbolList, formulas: formulaList };
}

export async function listFormulaVersions(formulaId: string): Promise<FormulaVersionRow[]> {
  const { data, error } = await supabase
    .from('formula_versions')
    .select('id, version_no, status, note, effective_from, created_at')
    .eq('formula_id', formulaId)
    .order('version_no', { ascending: false })
    .limit(200);
  if (error) fail('lịch sử phiên bản', error.message);
  return data as FormulaVersionRow[];
}

export async function listFormulaTests(formulaId: string): Promise<FormulaTestRow[]> {
  const { data, error } = await supabase
    .from('formula_test_cases')
    .select('id, case_name, inputs, expected, tolerance')
    .eq('formula_id', formulaId)
    .order('case_name')
    .limit(500);
  if (error) fail('ca thử', error.message);
  return data.map((row) => ({
    id: row.id,
    case_name: row.case_name,
    inputs: row.inputs as unknown as EvalContext,
    expected: row.expected as Value,
    tolerance: Number(row.tolerance),
  }));
}

/** Giá trị hiện hành của các tham số vận hành, theo mã tham số */
export async function listCurrentParamValues(codes: string[]): Promise<Record<string, unknown>> {
  if (codes.length === 0) return {};
  const { data, error } = await supabase
    .from('operation_parameters')
    .select('param_code, param_value')
    .eq('is_current', true)
    .in('param_code', codes)
    .limit(200);
  if (error) fail('giá trị tham số', error.message);
  return Object.fromEntries(data.map((row) => [row.param_code, row.param_value]));
}
