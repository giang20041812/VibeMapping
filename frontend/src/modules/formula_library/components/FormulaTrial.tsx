import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Alert, Button, Input } from '../../../components/common';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import {
  FormulaEvalError,
  collectNeeds,
  evaluate,
  formulaToLatex,
  type LatexContext,
  type TraceStep,
  type Value,
} from '../../../domain/formula';
import { formatValue } from '../formula.logic';
import { contextFromState, stateFromInputs, text, type TrialState } from '../formula.trial';
import type { FormulaLibrary, FormulaRecord, FormulaTestRow } from '../formula.types';
import { FormulaMath } from './FormulaMath';

export interface FormulaTrialProps {
  formula: FormulaRecord;
  library: FormulaLibrary;
  latexContext: LatexContext;
  tests: FormulaTestRow[];
  /** Giá trị hiện hành của tham số vận hành, theo mã tham số */
  currentParams: Record<string, unknown>;
}

function errorText(error: unknown): string {
  if (error instanceof FormulaEvalError) {
    if (error.code === 'missing_input') return 'Còn thiếu giá trị đầu vào.';
    if (error.code === 'type_mismatch') return 'Có ô cần nhập số nhưng đang là chữ.';
    return 'Không tính được với dữ liệu này.';
  }
  return 'Không tính được với dữ liệu này.';
}

/** Nhập giá trị, xem công thức thay số và từng bước tính như lời giải trên giấy */
export const FormulaTrial: React.FC<FormulaTrialProps> = ({ formula, library, latexContext, tests, currentParams }) => {
  const expression = formula.expression;
  const needs = useMemo(() => (expression ? collectNeeds(expression) : null), [expression]);
  const [state, setState] = useState<TrialState>(() => (needs ? stateFromInputs(needs, tests[0]?.inputs ?? {}, currentParams) : { vars: {}, refs: {}, sets: {} }));
  const [caseId, setCaseId] = useState<string>(tests[0]?.id ?? '');

  const nameOfSymbol = (code: string) => latexContext.symbols[code]?.name ?? code;
  const labelOfSymbol = (code: string) => {
    const symbol = latexContext.symbols[code];
    if (!symbol) return code;
    return symbol.unit ? `${symbol.name} (${symbol.unit})` : symbol.name;
  };
  const formulaByCode = useMemo(() => new Map(library.formulas.map((item) => [item.formula_code, item])), [library]);
  const refLabel = (code: string) => formulaByCode.get(code)?.formula_name ?? code;
  const refLatex = (code: string) => {
    const output = formulaByCode.get(code)?.output_symbol;
    return output ? latexContext.symbols[output]?.latex ?? output : code;
  };

  const outcome = useMemo(() => {
    if (!expression) return null;
    const context = contextFromState(state);
    const substitution: LatexContext = {
      ...latexContext,
      resolve: (kind, key) => {
        const value = kind === 'ref' ? context.refs?.[key] : context.vars?.[key];
        return typeof value === 'number' ? value : undefined;
      },
    };
    const outputLatex = latexContext.symbols[formula.output_symbol]?.latex ?? formula.output_symbol;
    const definition = { output: { symbol: formula.output_symbol, latex: outputLatex, name: formula.formula_name }, expression };
    const trace: TraceStep[] = [];
    try {
      const value = evaluate(expression, context, { trace, latex: substitution });
      return { value, trace, error: null as string | null, substituted: formulaToLatex(definition, substitution) };
    } catch (error) {
      return { value: null as Value, trace, error: errorText(error), substituted: formulaToLatex(definition, substitution) };
    }
  }, [expression, state, latexContext, formula]);

  if (!expression || !needs || !outcome) return <div className="formula-tab-body"><p className="formula-empty">Chưa có phiên bản hiệu lực</p></div>;

  const setVar = (key: string, value: string) => setState((current) => ({ ...current, vars: { ...current.vars, [key]: value } }));
  const setRef = (key: string, value: string) => setState((current) => ({ ...current, refs: { ...current.refs, [key]: value } }));
  const setCell = (set: string, index: number, key: string, value: string) =>
    setState((current) => ({
      ...current,
      sets: { ...current.sets, [set]: current.sets[set].map((row, i) => (i === index ? { ...row, [key]: value } : row)) },
    }));
  const addRow = (set: string) =>
    setState((current) => ({
      ...current,
      sets: { ...current.sets, [set]: [...current.sets[set], Object.fromEntries(needs.sets[set].fields.map((field) => [field.key, '']))] },
    }));
  const removeRow = (set: string, index: number) =>
    setState((current) => ({ ...current, sets: { ...current.sets, [set]: current.sets[set].filter((_, i) => i !== index) } }));

  const loadCase = (id: string) => {
    setCaseId(id);
    const test = tests.find((item) => item.id === id);
    if (test) setState(stateFromInputs(needs, test.inputs, currentParams));
  };

  const useCurrentParams = () =>
    setState((current) => ({
      ...current,
      vars: { ...current.vars, ...Object.fromEntries(needs.params.map((key) => [key, text(currentParams[key] ?? current.vars[key])])) },
    }));

  const outputUnit = latexContext.symbols[formula.output_symbol]?.unit;
  const caseOptions = tests.map((test) => ({ value: test.id, label: test.case_name }));

  return (
    <div className="formula-tab-body">
      {tests.length > 0 && (
        <div className="formula-trial-case">
          <SearchableSelect label="Nạp ca thử" placeholder="Chọn ca thử" options={caseOptions} value={caseId} onChange={loadCase} />
        </div>
      )}

      {needs.vars.length > 0 && (
        <section className="formula-trial-section">
          <h3 className="admin-form-section-title">Dữ liệu đầu vào</h3>
          <div className="admin-form-grid">
            {needs.vars.map((key) => (
              <Input key={key} label={labelOfSymbol(key)} inputMode="decimal" value={state.vars[key] ?? ''} onChange={(event) => setVar(key, event.target.value)} />
            ))}
          </div>
        </section>
      )}

      {needs.refs.length > 0 && (
        <section className="formula-trial-section">
          <h3 className="admin-form-section-title">Kết quả của công thức khác</h3>
          <div className="admin-form-grid">
            {needs.refs.map((key) => (
              <Input key={key} label={refLabel(key)} inputMode="decimal" value={state.refs[key] ?? ''} onChange={(event) => setRef(key, event.target.value)} />
            ))}
          </div>
        </section>
      )}

      {needs.params.length > 0 && (
        <section className="formula-trial-section">
          <div className="formula-trial-heading">
            <h3 className="admin-form-section-title">Tham số</h3>
            <Button type="button" size="sm" variant="outline" onClick={useCurrentParams}>
              Dùng giá trị hiện hành
            </Button>
          </div>
          <div className="admin-form-grid">
            {needs.params.map((key) => (
              <Input key={key} label={labelOfSymbol(key)} inputMode="decimal" value={state.vars[key] ?? ''} onChange={(event) => setVar(key, event.target.value)} />
            ))}
          </div>
        </section>
      )}

      {Object.entries(needs.sets).map(([name, need]) =>
        need.fields.length === 0 ? null : (
          <section key={name} className="formula-trial-section">
            <div className="formula-trial-heading">
              <h3 className="admin-form-section-title">{setTitle(name, expression)}</h3>
              <Button type="button" size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => addRow(name)}>
                Thêm dòng
              </Button>
            </div>
            <div className="formula-trial-table-wrap">
              <table className="formula-trial-table">
                <thead>
                  <tr>
                    {need.fields.map((field) => (
                      <th key={`${field.kind}:${field.key}`} scope="col">
                        <FormulaMath latex={field.kind === 'ref' ? refLatex(field.key) : latexContext.symbols[field.key]?.latex ?? field.key} />
                        <span className="admin-cell-sub">{field.kind === 'ref' ? refLabel(field.key) : nameOfSymbol(field.key)}</span>
                      </th>
                    ))}
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {(state.sets[name] ?? []).map((row, index) => (
                    <tr key={index}>
                      {need.fields.map((field) => (
                        <td key={`${field.kind}:${field.key}`}>
                          <Input
                            aria-label={field.kind === 'ref' ? refLabel(field.key) : nameOfSymbol(field.key)}
                            inputMode="decimal"
                            value={row[field.key] ?? ''}
                            onChange={(event) => setCell(name, index, field.key, event.target.value)}
                          />
                        </td>
                      ))}
                      <td>
                        <Button type="button" size="sm" variant="ghost" aria-label="Xóa dòng" onClick={() => removeRow(name, index)}>
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(state.sets[name] ?? []).length === 0 && (
                    <tr>
                      <td colSpan={need.fields.length + 1} className="formula-empty">
                        Chưa có dòng
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ),
      )}

      <section className="formula-trial-section">
        <h3 className="admin-form-section-title">Thay số</h3>
        <div className="formula-display">
          <FormulaMath latex={outcome.substituted} block />
        </div>
      </section>

      {outcome.trace.length > 0 && (
        <section className="formula-trial-section">
          <h3 className="admin-form-section-title">Từng bước</h3>
          <ol className="formula-steps">
            {outcome.trace.map((step, index) => (
              <li key={index} className="formula-step">
                <FormulaMath latex={step.latex} />
                <span className="formula-step-value">{`= ${formatValue(step.value)}`}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {outcome.error ? (
        <Alert variant="warning">{outcome.error}</Alert>
      ) : (
        <div className="formula-result">
          <FormulaMath latex={`${latexContext.symbols[formula.output_symbol]?.latex ?? formula.output_symbol} =`} />
          <strong>{`${formatValue(outcome.value)}${outputUnit && outcome.value !== null ? ` ${outputUnit}` : ''}`}</strong>
        </div>
      )}
    </div>
  );
};

/** Tiêu đề bảng dữ liệu: lấy nhãn của phép tổng dùng tập đó */
function setTitle(name: string, expression: NonNullable<FormulaRecord['expression']>): string {
  let label = name;
  const walk = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) return;
    const record = node as Record<string, unknown>;
    if (record.t === 'agg' && record.over === name && typeof record.label === 'string') label = record.label;
    Object.values(record).forEach((child) => (Array.isArray(child) ? child.forEach(walk) : walk(child)));
  };
  walk(expression);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
