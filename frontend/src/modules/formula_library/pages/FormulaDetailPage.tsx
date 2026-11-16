import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Network, Pencil } from 'lucide-react';
import { Alert, Badge, Breadcrumb, Button, Card, Checkbox, DataTable, Spinner, Tabs } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { collectFallbacks, formulaToLatex, type SymbolDef } from '../../../domain/formula';
import { runTests, type TestOutcome } from '../editor.logic';
import { formatDateTime } from '../../admin/admin.logic';
import { FormulaExpansion } from '../components/FormulaExpansion';
import { FormulaMath } from '../components/FormulaMath';
import { FormulaTrial } from '../components/FormulaTrial';
import { listCurrentParamValues, listFormulaTests, listFormulaVersions } from '../formula.service';
import {
  SYMBOL_KIND_LABEL,
  VERIFICATION_LABEL,
  VERIFICATION_VARIANT,
  buildLatexContext,
  formatRange,
  formatValue,
  formulaDependencies,
  formulaDependents,
  liveStatus,
  numericParamValues,
  paramDependencies,
  symbolsInFormula,
} from '../formula.logic';
import type { FormulaRecord, FormulaTestRow, FormulaVersionRow } from '../formula.types';
import { useFormulaLibrary } from '../useFormulaLibrary';
import '../../admin/pages/AdminPages.css';
import './FormulaLibrary.css';

const TAB_ITEMS = [
  { value: 'trial', label: 'Tính thử' },
  { value: 'expansion', label: 'Khai triển' },
  { value: 'tests', label: 'Ca thử' },
  { value: 'versions', label: 'Phiên bản' },
];

const VERSION_STATUS_LABEL = { draft: 'Bản nháp', active: 'Đang hiệu lực', retired: 'Đã thay' } as const;
const VERSION_STATUS_VARIANT = { draft: 'warning', active: 'success', retired: 'default' } as const;

export const FormulaDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { library, isLoading, error } = useFormulaLibrary();
  const [tab, setTab] = useState('trial');
  const [extraLoaded, setExtraLoaded] = useState(false);
  const [showParamValues, setShowParamValues] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({});
  const [tests, setTests] = useState<FormulaTestRow[]>([]);
  const [versions, setVersions] = useState<FormulaVersionRow[]>([]);
  const [extraError, setExtraError] = useState<string | null>(null);

  const formula = useMemo(() => library?.formulas.find((item) => item.id === id) ?? null, [library, id]);
  const latexContext = useMemo(() => (library ? buildLatexContext(library) : null), [library]);

  useEffect(() => {
    if (!formula) return;
    let active = true;
    Promise.all([listFormulaTests(formula.id), listFormulaVersions(formula.id), listCurrentParamValues(paramDependencies(formula))])
      .then(([testRows, versionRows, params]) => {
        if (!active) return;
        setTests(testRows);
        setVersions(versionRows);
        setParamValues(params);
        setExtraError(null);
      })
      .catch(() => active && setExtraError('Không tải được ca thử và phiên bản.'))
      .finally(() => active && setExtraLoaded(true));
    return () => {
      active = false;
    };
  }, [formula]);

  const numericParams = useMemo(() => numericParamValues(paramValues), [paramValues]);

  const latex = useMemo(() => {
    if (!formula?.expression || !latexContext || !library) return '';
    const outputSymbol = latexContext.symbols[formula.output_symbol];
    const context = showParamValues
      ? { ...latexContext, resolve: (kind: 'sym' | 'param' | 'ref', key: string) => (kind === 'param' ? numericParams[key] : undefined) }
      : latexContext;
    return formulaToLatex(
      { output: { symbol: formula.output_symbol, latex: outputSymbol?.latex ?? formula.output_symbol, name: formula.formula_name }, expression: formula.expression },
      context,
    );
  }, [formula, latexContext, library, showParamValues, numericParams]);

  const fallbacks = useMemo(
    () => (formula?.expression && latexContext ? collectFallbacks(formula.expression, latexContext) : []),
    [formula, latexContext],
  );

  const usedSymbols = useMemo(() => (formula && library ? symbolsInFormula(formula, library) : []), [formula, library]);
  const usesFormulas = useMemo(
    () => (formula && library ? library.formulas.filter((item) => formulaDependencies(formula).includes(item.formula_code)) : []),
    [formula, library],
  );
  const usedBy = useMemo(() => (formula && library ? formulaDependents(formula.formula_code, library.formulas) : []), [formula, library]);

  const testResults = useMemo<TestOutcome[]>(() => (formula?.expression ? runTests(formula.expression, tests) : []), [formula, tests]);

  const formulaIdByCode = useMemo(() => new Map((library?.formulas ?? []).map((item) => [item.formula_code, item.id])), [library]);

  const symbolColumns = useMemo<DataTableColumn<SymbolDef>[]>(
    () => [
      { key: 'latex', header: 'Ký hiệu', nowrap: true, render: (row) => <FormulaMath latex={row.latex} /> },
      {
        key: 'name',
        header: 'Ý nghĩa',
        render: (row) => {
          const targetId = row.kind === 'formula' && row.ref ? formulaIdByCode.get(row.ref) : undefined;
          return targetId ? (
            <Link className="formula-link" to={`/quan-tri/cong-thuc/${targetId}`}>
              {row.name}
            </Link>
          ) : (
            <span className="admin-cell-text">{row.name}</span>
          );
        },
      },
      { key: 'kind', header: 'Loại', nowrap: true, render: (row) => SYMBOL_KIND_LABEL[row.kind] },
      {
        key: 'value',
        header: 'Giá trị',
        nowrap: true,
        render: (row) => {
          if (row.kind === 'param' && row.ref && row.ref in paramValues) {
            const raw = paramValues[row.ref];
            return typeof raw === 'number' ? `${formatValue(raw)}${row.unit ? ` ${row.unit}` : ''}` : String(raw);
          }
          return formatRange(row);
        },
      },
    ],
    [formulaIdByCode, paramValues],
  );

  const testColumns = useMemo<DataTableColumn<TestOutcome>[]>(
    () => [
      { key: 'case_name', header: 'Ca thử', render: (row) => <span className="admin-cell-text">{row.test.case_name}</span> },
      { key: 'expected', header: 'Mong đợi', nowrap: true, render: (row) => formatValue(row.test.expected) },
      { key: 'actual', header: 'Tính được', nowrap: true, render: (row) => (row.state === 'error' ? 'Lỗi' : formatValue(row.actual)) },
      {
        key: 'state',
        header: 'Kết quả',
        nowrap: true,
        render: (row) =>
          row.state === 'match' ? <Badge variant="success">Khớp</Badge> : row.state === 'mismatch' ? <Badge variant="danger">Lệch</Badge> : <Badge variant="warning">Lỗi</Badge>,
      },
    ],
    [],
  );

  const versionColumns = useMemo<DataTableColumn<FormulaVersionRow>[]>(
    () => [
      { key: 'version_no', header: 'Phiên bản', nowrap: true, render: (row) => `v${row.version_no}` },
      {
        key: 'status',
        header: 'Trạng thái',
        nowrap: true,
        render: (row) => <Badge variant={VERSION_STATUS_VARIANT[row.status]}>{VERSION_STATUS_LABEL[row.status]}</Badge>,
      },
      { key: 'effective_from', header: 'Hiệu lực từ', nowrap: true, render: (row) => (row.effective_from ? formatDateTime(row.effective_from) : '—') },
      { key: 'note', header: 'Ghi chú', render: (row) => <span className="admin-cell-text">{row.note ?? '—'}</span> },
    ],
    [],
  );

  if (isLoading) {
    return (
      <div className="formula-loading">
        <Spinner />
      </div>
    );
  }

  if (error || !library || !formula || !latexContext) {
    return (
      <>
        <Breadcrumb items={[{ label: 'Công thức', to: '/quan-tri/cong-thuc' }, { label: 'Không tìm thấy' }]} />
        <Alert variant="danger">{error ?? 'Không tìm thấy công thức.'}</Alert>
      </>
    );
  }

  const linkList = (items: FormulaRecord[]) =>
    items.length === 0 ? (
      <p className="formula-empty">Không có</p>
    ) : (
      <ul className="formula-link-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link className="formula-link" to={`/quan-tri/cong-thuc/${item.id}`}>
              {item.formula_name}
            </Link>
            <span className="admin-cell-sub">{item.group_name}</span>
          </li>
        ))}
      </ul>
    );

  return (
    <>
      <Breadcrumb items={[{ label: 'Công thức', to: '/quan-tri/cong-thuc' }, { label: formula.formula_name }]} />
      <div className="admin-page-header">
        <h1 className="page-title">{formula.formula_name}</h1>
        <div className="admin-badge-list">
          <Badge variant={VERIFICATION_VARIANT[formula.verification_level]}>{VERIFICATION_LABEL[formula.verification_level]}</Badge>
          <Badge variant={liveStatus(formula.formula_code).variant}>{liveStatus(formula.formula_code).label}</Badge>
          <Badge>{formula.group_name}</Badge>
          {formula.version_no && <Badge>{`v${formula.version_no}`}</Badge>}
          <Button
            type="button"
            size="sm"
            variant="outline"
            leftIcon={<Network size={14} />}
            onClick={() => navigate(`/quan-tri/cong-thuc/so-do?chon=${encodeURIComponent(formula.formula_code)}`)}
          >
            Xem trên sơ đồ
          </Button>
          <Button type="button" size="sm" leftIcon={<Pencil size={14} />} onClick={() => navigate(`/quan-tri/cong-thuc/${formula.id}/sua`)}>
            Sửa công thức
          </Button>
        </div>
      </div>

      {extraError && (
        <div className="admin-alert-slot">
          <Alert variant="danger">{extraError}</Alert>
        </div>
      )}

      <div className="admin-stack">
        <Card
          title="Công thức"
          action={
            paramDependencies(formula).length > 0 ? (
              <Checkbox label="Thay giá trị tham số hiện hành" checked={showParamValues} onChange={setShowParamValues} />
            ) : undefined
          }
        >
          {latex ? (
            <>
              <div className="formula-display">
                <FormulaMath latex={latex} block />
              </div>
              {fallbacks.length > 0 && (
                <ul className="formula-notes">
                  {fallbacks.map((note, index) => (
                    <li key={index}>
                      Khi mẫu số <FormulaMath latex={note.denominator} /> bằng 0 thì kết quả là <FormulaMath latex={note.fallback} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="formula-empty">Chưa có phiên bản hiệu lực</p>
          )}
        </Card>

        <Card title="Trong đó" noPadding>
          <DataTable columns={symbolColumns} rows={usedSymbols} rowKey={(row) => row.code} emptyText="Không có ký hiệu" caption="Ký hiệu trong công thức" />
        </Card>

        <div className="formula-link-grid">
          <Card title="Dùng kết quả của">{linkList(usesFormulas)}</Card>
          <Card title="Được dùng bởi">{linkList(usedBy)}</Card>
        </div>

        <Card noPadding>
          <div className="formula-tabs">
            <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} label="Tính thử, khai triển, ca thử và phiên bản" />
          </div>
          {tab === 'trial' &&
            (extraLoaded ? (
              <FormulaTrial key={formula.id} formula={formula} library={library} latexContext={latexContext} tests={tests} currentParams={paramValues} />
            ) : (
              <div className="formula-loading">
                <Spinner />
              </div>
            ))}
          {tab === 'expansion' && <FormulaExpansion key={formula.id} formula={formula} library={library} latexContext={latexContext} />}
          {tab === 'tests' && <DataTable columns={testColumns} rows={testResults} rowKey={(row) => row.test.id} emptyText="Chưa có ca thử" caption="Ca thử" />}
          {tab === 'versions' && <DataTable columns={versionColumns} rows={versions} rowKey={(row) => row.id} emptyText="Chưa có phiên bản" caption="Phiên bản" />}
        </Card>
      </div>
    </>
  );
};
