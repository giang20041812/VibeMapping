import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Trash2 } from 'lucide-react';
import { Alert, Badge, Breadcrumb, Button, Card, DataTable, Input, Select, Spinner, useConfirm } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { formulaToLatex, isFormulaLive, type Expr } from '../../../domain/formula';
import { useAuth } from '../../auth/AuthContext';
import { ExprEditor } from '../components/ExprEditor';
import { FormulaMath } from '../components/FormulaMath';
import { buildEditorEnv, checkDraft, runTests, saveErrorText, type TestOutcome } from '../editor.logic';
import { applyFormulaVersion, deleteFormulaDraft, getFormulaDraft, listFormulaTests, saveFormulaDraft } from '../formula.service';
import { VERIFICATION_LABEL, VERIFICATION_OPTIONS, VERIFICATION_VARIANT, buildLatexContext, formatValue, liveStatus } from '../formula.logic';
import type { FormulaTestRow } from '../formula.types';
import { useFormulaLibrary } from '../useFormulaLibrary';
import '../../admin/pages/AdminPages.css';
import './FormulaLibrary.css';

const MIN_NOTE_LENGTH = 5;

type Message = { tone: 'success' | 'danger'; text: string } | null;

export const FormulaEditPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const { library, isLoading, error } = useFormulaLibrary();
  const { confirm, dialog } = useConfirm();

  const formula = useMemo(() => library?.formulas.find((item) => item.id === id) ?? null, [library, id]);
  const latexContext = useMemo(() => (library ? buildLatexContext(library) : null), [library]);
  const env = useMemo(() => (library && formula ? buildEditorEnv(library, formula.formula_code) : null), [library, formula]);

  const [ready, setReady] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [expression, setExpression] = useState<Expr | null>(null);
  const [baseline, setBaseline] = useState('');
  const [verification, setVerification] = useState('');
  const [note, setNote] = useState('');
  const [tests, setTests] = useState<FormulaTestRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    if (!formula) return;
    let active = true;
    Promise.all([getFormulaDraft(formula.id), listFormulaTests(formula.id)])
      .then(([draft, testRows]) => {
        if (!active) return;
        const start = draft?.expression ?? formula.expression;
        setDraftId(draft?.id ?? null);
        setExpression(start);
        setBaseline(JSON.stringify(start));
        setNote(draft?.note ?? '');
        setVerification(formula.verification_level);
        setTests(testRows);
        setReady(true);
      })
      .catch(() => active && setMessage({ tone: 'danger', text: 'Không tải được bản nháp và ca thử.' }));
    return () => {
      active = false;
    };
  }, [formula]);

  const issues = useMemo(() => (expression && library && formula ? checkDraft(expression, formula.formula_code, library) : []), [expression, library, formula]);
  const blocking = issues.some((issue) => issue.blocking);
  const outcomes = useMemo(() => (expression ? runTests(expression, tests) : []), [expression, tests]);
  const matched = outcomes.filter((item) => item.state === 'match').length;

  const latex = useMemo(() => {
    if (!expression || !latexContext || !formula) return '';
    const output = latexContext.symbols[formula.output_symbol];
    return formulaToLatex({ output: { symbol: formula.output_symbol, latex: output?.latex ?? formula.output_symbol, name: formula.formula_name }, expression }, latexContext);
  }, [expression, latexContext, formula]);

  const changed = formula?.expression ? JSON.stringify(expression) !== JSON.stringify(formula.expression) : expression !== null;
  const unsaved = ready && JSON.stringify(expression) !== baseline;
  const verificationChanged = formula !== null && verification !== formula.verification_level;
  const noteReady = note.trim().length >= MIN_NOTE_LENGTH;

  const outcomeColumns = useMemo<DataTableColumn<TestOutcome>[]>(
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

  if (isLoading) {
    return (
      <div className="formula-loading">
        <Spinner />
      </div>
    );
  }
  if (error || !library || !formula || !latexContext || !env) {
    return (
      <>
        <Breadcrumb items={[{ label: 'Công thức', to: '/quan-tri/cong-thuc' }, { label: 'Không tìm thấy' }]} />
        <Alert variant="danger">{error ?? 'Không tìm thấy công thức.'}</Alert>
      </>
    );
  }

  const backToDetail = () => navigate(`/quan-tri/cong-thuc/${formula.id}`);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (failure) {
      setMessage({ tone: 'danger', text: saveErrorText(failure instanceof Error ? failure.message : '') });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDraft = () =>
    run(async () => {
      if (!expression) return;
      const savedId = await saveFormulaDraft({ formulaId: formula.id, draftId, expression, note, userId });
      setDraftId(savedId);
      setBaseline(JSON.stringify(expression));
      setMessage({ tone: 'success', text: 'Đã lưu bản nháp.' });
    });

  const handleApply = async () => {
    if (!expression) return;
    const accepted = await confirm({
      title: 'Áp dụng phiên bản mới',
      message: `Bản này trở thành phiên bản hiệu lực của "${formula.formula_name}", bản hiện tại chuyển sang đã thay. ${matched < outcomes.length ? `Có ${outcomes.length - matched} ca thử không khớp.` : ''}`.trim(),
      confirmLabel: 'Áp dụng',
    });
    if (!accepted) return;
    await run(async () => {
      // Chỉ đổi trạng thái công thức, nội dung giữ nguyên: không tạo phiên bản mới
      const versionExpression = changed || draftId ? expression : null;
      await applyFormulaVersion({ formulaId: formula.id, draftId, expression: versionExpression, note, userId, verification: verificationChanged ? verification : null });
      backToDetail();
    });
  };

  const handleDiscard = async () => {
    if (!draftId) return;
    const accepted = await confirm({ title: 'Bỏ bản nháp', message: 'Bản nháp sẽ bị xóa, công thức giữ nguyên phiên bản hiệu lực.', confirmLabel: 'Bỏ bản nháp', danger: true });
    if (!accepted) return;
    await run(async () => {
      await deleteFormulaDraft(draftId);
      backToDetail();
    });
  };

  const handleCancel = async () => {
    if (unsaved) {
      const accepted = await confirm({ title: 'Rời khỏi trang', message: 'Thay đổi chưa lưu sẽ mất.', confirmLabel: 'Rời khỏi', danger: true });
      if (!accepted) return;
    }
    backToDetail();
  };

  return (
    <>
      <Breadcrumb items={[{ label: 'Công thức', to: '/quan-tri/cong-thuc' }, { label: formula.formula_name, to: `/quan-tri/cong-thuc/${formula.id}` }, { label: 'Sửa' }]} />
      <div className="admin-page-header">
        <h1 className="page-title">{`Sửa: ${formula.formula_name}`}</h1>
        <div className="admin-badge-list">
          <Badge variant={VERIFICATION_VARIANT[formula.verification_level]}>{VERIFICATION_LABEL[formula.verification_level]}</Badge>
          <Badge variant={liveStatus(formula.formula_code).variant}>{liveStatus(formula.formula_code).label}</Badge>
          {draftId && <Badge variant="warning">Có bản nháp</Badge>}
        </div>
      </div>

      <div className="admin-alert-slot">
        {isFormulaLive(formula.formula_code) ? (
          <Alert variant="info">Công thức này đã nối vào hệ thống tính. Bản áp dụng có hiệu lực từ lần tính kế tiếp, kết quả đã lưu không đổi.</Alert>
        ) : (
          <Alert variant="warning">Công thức này chưa nối vào hệ thống tính. Áp dụng chỉ lưu phiên bản, kết quả tính chưa thay đổi.</Alert>
        )}
      </div>
      {message && (
        <div className="admin-alert-slot">
          <Alert variant={message.tone}>{message.text}</Alert>
        </div>
      )}

      {!ready || !expression ? (
        <div className="formula-loading">
          <Spinner />
        </div>
      ) : (
        <div className="admin-stack">
          <Card title="Xem trước">
            <div className="formula-display">
              <FormulaMath latex={latex} block />
            </div>
          </Card>

          <Card title="Cấu trúc công thức">
            <ExprEditor env={env} latex={latexContext} value={expression} onChange={setExpression} />
          </Card>

          <Card title="Kiểm tra" noPadding>
            {issues.length > 0 && (
              <div className="formula-tab-body">
                {issues.map((issue, index) => (
                  <Alert key={index} variant={issue.blocking ? 'danger' : 'warning'}>
                    {issue.message}
                  </Alert>
                ))}
              </div>
            )}
            <div className="formula-tab-body">
              <span className="formula-expansion-count">{`${matched}/${outcomes.length} ca thử khớp`}</span>
            </div>
            <DataTable columns={outcomeColumns} rows={outcomes} rowKey={(row) => row.test.id} emptyText="Chưa có ca thử" caption="Ca thử" />
          </Card>

          <Card title="Áp dụng">
            <div className="admin-form">
              <div className="admin-form-grid">
                <Select label="Trạng thái công thức" options={VERIFICATION_OPTIONS} value={verification} onChange={setVerification} />
                <Input label="Ghi chú thay đổi" required value={note} onChange={(event) => setNote(event.target.value)} />
              </div>
              <div className="admin-row-actions formula-edit-actions">
                {draftId && (
                  <Button type="button" variant="ghost" leftIcon={<Trash2 size={16} />} disabled={busy} onClick={handleDiscard}>
                    Bỏ bản nháp
                  </Button>
                )}
                <Button type="button" variant="ghost" disabled={busy} onClick={handleCancel}>
                  Hủy
                </Button>
                <Button type="button" variant="outline" leftIcon={<Save size={16} />} disabled={busy || blocking || !unsaved} onClick={handleSaveDraft}>
                  Lưu bản nháp
                </Button>
                <Button type="button" isLoading={busy} disabled={issues.length > 0 || !noteReady || (!changed && !draftId && !verificationChanged)} onClick={handleApply}>
                  Áp dụng
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      {dialog}
    </>
  );
};
