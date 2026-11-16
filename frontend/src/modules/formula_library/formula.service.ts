import { supabase } from '../../lib/supabase';
import type { Json } from '../../types/supabase';
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

export interface FormulaDraft {
  id: string;
  version_no: number;
  note: string | null;
  expression: Expr;
}

/** Bản nháp đang soạn của công thức (mỗi công thức tối đa một bản) */
export async function getFormulaDraft(formulaId: string): Promise<FormulaDraft | null> {
  const { data, error } = await supabase
    .from('formula_versions')
    .select('id, version_no, note, expression')
    .eq('formula_id', formulaId)
    .eq('status', 'draft')
    .maybeSingle();
  if (error) fail('bản nháp công thức', error.message);
  if (!data || !isExpr(data.expression)) return null;
  return { id: data.id, version_no: data.version_no, note: data.note, expression: data.expression };
}

export interface SaveVersionInput {
  formulaId: string;
  /** Bản nháp đang soạn; bỏ trống khi chưa có */
  draftId: string | null;
  expression: Expr;
  note: string;
  userId: string;
}

/** Lưu bản nháp: sửa bản nháp đang có hoặc tạo mới. Trả về mã bản nháp */
export async function saveFormulaDraft(input: SaveVersionInput): Promise<string> {
  const payload = { expression: input.expression as unknown as Json, note: input.note.trim() || null, changed_by: input.userId };
  if (input.draftId) {
    const { error } = await supabase.from('formula_versions').update(payload).eq('id', input.draftId).eq('status', 'draft');
    if (error) throw new Error(error.message);
    return input.draftId;
  }
  const { data, error } = await supabase
    .from('formula_versions')
    .insert({ ...payload, formula_id: input.formulaId, status: 'draft' })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

/** Áp dụng: bản này thành bản hiệu lực, bản cũ chuyển sang đã thay. Đổi trạng thái công thức nếu có */
export async function applyFormulaVersion(
  input: Omit<SaveVersionInput, 'expression'> & { expression: Expr | null; verification: string | null },
): Promise<void> {
  const payload = { expression: input.expression as unknown as Json, note: input.note.trim(), changed_by: input.userId, status: 'active' as const };
  if (input.expression === null) {
    // Không có nội dung mới: chỉ đổi trạng thái công thức
  } else if (input.draftId) {
    const { error } = await supabase.from('formula_versions').update(payload).eq('id', input.draftId).eq('status', 'draft');
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('formula_versions').insert({ ...payload, formula_id: input.formulaId });
    if (error) throw new Error(error.message);
  }
  if (input.verification) {
    const { error } = await supabase.from('formulas').update({ verification_level: input.verification }).eq('id', input.formulaId);
    if (error) throw new Error(error.message);
  }
}

export async function deleteFormulaDraft(draftId: string): Promise<void> {
  const { error } = await supabase.from('formula_versions').delete().eq('id', draftId).eq('status', 'draft');
  if (error) throw new Error(error.message);
}
