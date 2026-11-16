import type { EvalContext, FormulaNeeds, Value } from '../../domain/formula';

export type Row = Record<string, string>;
export interface TrialState {
  vars: Record<string, string>;
  refs: Record<string, string>;
  sets: Record<string, Row[]>;
}

export const text = (value: Value | undefined | unknown): string => (value === undefined || value === null ? '' : String(value));

/** Ô trống là không có dữ liệu; chuỗi số là số; còn lại giữ nguyên chữ */
export function parseCell(raw: string): Value {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (/^-?\d+([.,]\d+)?$/.test(trimmed)) return Number(trimmed.replace(',', '.'));
  return trimmed;
}

export function stateFromInputs(needs: FormulaNeeds, inputs: EvalContext, currentParams: Record<string, unknown>): TrialState {
  const vars: Record<string, string> = {};
  for (const key of needs.vars) vars[key] = text(inputs.vars?.[key]);
  for (const key of needs.params) vars[key] = text(inputs.vars?.[key] ?? currentParams[key]);
  const refs: Record<string, string> = {};
  for (const key of needs.refs) refs[key] = text(inputs.refs?.[key]);
  const sets: Record<string, Row[]> = {};
  for (const [name, need] of Object.entries(needs.sets)) {
    sets[name] = (inputs.sets?.[name] ?? []).map((row) => Object.fromEntries(need.fields.map((field) => [field.key, text(row[field.key])])));
  }
  return { vars, refs, sets };
}

export function contextFromState(state: TrialState): EvalContext {
  return {
    vars: Object.fromEntries(Object.entries(state.vars).map(([key, raw]) => [key, parseCell(raw)])),
    refs: Object.fromEntries(Object.entries(state.refs).map(([key, raw]) => [key, parseCell(raw)])),
    sets: Object.fromEntries(
      Object.entries(state.sets).map(([name, rows]) => [name, rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, raw]) => [key, parseCell(raw)])))]),
    ),
  };
}
