import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Save, Trash2, XCircle } from 'lucide-react';
import { Badge, Button, Input, Select, Spinner, useConfirm } from '../../../components/common';
import type { Expr, Value } from '../../../domain/formula';
import { useAuth } from '../../auth/AuthContext';
import { buildEditorEnv, checkDraft, runTests, saveErrorText } from '../editor.logic';
import { applyFormulaVersion, deleteFormulaDraft, getFormulaDraft, saveFormulaDraft } from '../formula.service';
import { VERIFICATION_LABEL, VERIFICATION_OPTIONS, VERIFICATION_VARIANT, liveStatus } from '../formula.logic';
import { exprToLine, lineToExpr, newBranch, type LineError, type LineTokens } from '../formula.tokens';
import type { FormulaLibrary, FormulaRecord, FormulaTestRow } from '../formula.types';
import { TokenList, formatViNumber, type TokenNames } from './TokenChips';
import { CasesFields, TokenEditor, type EditorKit } from './TokenEditor';
import './FormulaLine.css';

const MIN_NOTE_LENGTH = 5;

export function formatResult(value: Value | undefined): string {
  if (value === undefined) return '—';
  if (value === null) return 'Không có';
  return typeof value === 'number' ? formatViNumber(value) : value;
}

/* ---------- Xem một dòng công thức ---------- */

export const LineView: React.FC<{ line: LineTokens; names: TokenNames; onRefClick?: (code: string) => void }> = ({ line, names, onRefClick }) => {
  if (line.kind === 'flat') return <TokenList tokens={line.tokens} names={names} onRefClick={onRefClick} />;
  return (
    <div className="fx-cases">
      {line.branches.map((branch) => (
        <div className="fx-case" key={branch.id}>
          <span className="fx-case-key">Nếu</span>
          <span className="fx-case-cond">
            <TokenList tokens={branch.when} names={names} onRefClick={onRefClick} />
          </span>
          <span className="fx-case-key">thì</span>
          <span className="fx-case-value">
            <TokenList tokens={branch.then} names={names} onRefClick={onRefClick} />
          </span>
        </div>
      ))}
      <div className="fx-case fx-case-else">
        <span className="fx-case-key">Còn lại</span>
        <span className="fx-case-value">
          <TokenList tokens={line.otherwise} names={names} onRefClick={onRefClick} />
        </span>
      </div>
    </div>
  );
};

/** Kết quả tính thử: giá trị của ca thử đầu tiên, dấu tích khi mọi ca thử khớp */
const ResultLine: React.FC<{ expression: Expr | null; tests: readonly FormulaTestRow[]; unit: string | null; detailed?: boolean }> = ({ expression, tests, unit, detailed = false }) => {
  const outcomes = useMemo(() => (expression ? runTests(expression, tests) : []), [expression, tests]);
  if (outcomes.length === 0) return null;
  const matched = outcomes.filter((item) => item.state === 'match').length;
  const allMatch = matched === outcomes.length;
  const first = outcomes[0];
  const value = first.state === 'error' ? 'Lỗi' : `${formatResult(first.actual)}${unit && typeof first.actual === 'number' ? ` ${unit}` : ''}`;
  return (
    <div className={`fx-result${allMatch ? ' is-ok' : ' is-bad'}`} title={first.test.case_name}>
      {allMatch ? <CheckCircle2 size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />}
      <span>=</span>
      <strong>{value}</strong>
      {(detailed || !allMatch) && <span className="fx-result-note">{`${matched}/${outcomes.length} ca thử khớp`}</span>}
    </div>
  );
};

/* ---------- Một dòng trong danh sách ---------- */

export interface FormulaRowProps {
  formula: FormulaRecord;
  library: FormulaLibrary;
  baseKit: Omit<EditorKit, 'env'>;
  tests: readonly FormulaTestRow[];
  editing: boolean;
  highlighted: boolean;
  onEdit: () => void;
  onClose: () => void;
  onApplied: () => void;
  onOpenDetail: () => void;
  onRefClick: (code: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}

export const FormulaRow: React.FC<FormulaRowProps> = (props) => {
  const { formula, baseKit, tests, editing, highlighted, onEdit, onOpenDetail, onRefClick } = props;
  const line = useMemo(() => (formula.expression ? exprToLine(formula.expression) : null), [formula.expression]);

  return (
    <div className={`fx-row${editing ? ' is-editing' : ''}${highlighted ? ' is-highlighted' : ''}`} id={`cong-thuc-${formula.formula_code}`}>
      <button type="button" className="fx-name" onClick={onOpenDetail}>
        <span className="fx-name-text">{formula.formula_name}</span>
        {formula.verification_level !== 'approved' && (
          <Badge variant={VERIFICATION_VARIANT[formula.verification_level]} size="sm">
            {VERIFICATION_LABEL[formula.verification_level]}
          </Badge>
        )}
      </button>
      <span className="fx-eq" aria-hidden="true">
        =
      </span>
      {editing ? (
        <FormulaRowEditor {...props} />
      ) : (
        <div className="fx-main">
          <div
            className="fx-bar"
            role="button"
            tabIndex={0}
            aria-label={`Sửa ${formula.formula_name}`}
            onClick={onEdit}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onEdit();
              }
            }}
          >
            <div className="fx-bar-content">{line ? <LineView line={line} names={baseKit.names} onRefClick={onRefClick} /> : <span className="fx-placeholder">Chưa có nội dung</span>}</div>
            {formula.output_unit && <span className="fx-unit">{formula.output_unit}</span>}
          </div>
          <ResultLine expression={formula.expression} tests={tests} unit={formula.output_unit} />
        </div>
      )}
    </div>
  );
};

/* ---------- Sửa ngay trên dòng ---------- */

type Message = { tone: 'success' | 'danger'; text: string } | null;

function errorAtFor(error: LineError | null, part: 'flat'): number | undefined {
  return error && error.where.part === part ? error.at : undefined;
}

const FormulaRowEditor: React.FC<FormulaRowProps> = ({ formula, library, baseKit, tests, onClose, onApplied, onDirtyChange }) => {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const { confirm, dialog } = useConfirm();
  const kit = useMemo<EditorKit>(() => ({ ...baseKit, env: buildEditorEnv(library, formula.formula_code) }), [baseKit, library, formula.formula_code]);

  const [ready, setReady] = useState(false);
  const [line, setLine] = useState<LineTokens>({ kind: 'flat', tokens: [] });
  const [baseline, setBaseline] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [verification, setVerification] = useState(formula.verification_level as string);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    let active = true;
    getFormulaDraft(formula.id)
      .then((draft) => {
        if (!active) return;
        const start = draft?.expression ?? formula.expression;
        setLine(start ? exprToLine(start) : { kind: 'flat', tokens: [] });
        setBaseline(JSON.stringify(start));
        setDraftId(draft?.id ?? null);
        setNote(draft?.note ?? '');
        setReady(true);
      })
      .catch(() => active && setMessage({ tone: 'danger', text: 'Không tải được bản nháp.' }));
    return () => {
      active = false;
    };
  }, [formula.id, formula.expression]);

  const parsed = useMemo(() => lineToExpr(line, kit.ctx), [line, kit.ctx]);
  const expression = parsed.ok ? parsed.expr : null;
  const lineError = parsed.ok ? null : parsed.error;
  const issues = useMemo(() => (expression ? checkDraft(expression, formula.formula_code, library) : []), [expression, formula.formula_code, library]);
  const blocking = issues.some((issue) => issue.blocking);
  const outcomes = useMemo(() => (expression ? runTests(expression, tests) : []), [expression, tests]);
  const mismatched = outcomes.filter((item) => item.state !== 'match').length;

  const changed = expression !== null && JSON.stringify(expression) !== JSON.stringify(formula.expression);
  const unsaved = ready && expression !== null && JSON.stringify(expression) !== baseline;
  const verificationChanged = verification !== formula.verification_level;
  const noteReady = note.trim().length >= MIN_NOTE_LENGTH;
  const live = liveStatus(formula.formula_code);
  // Dòng đang sửa chưa đọc được (thiếu số, thừa ngoặc) cũng tính là có thay đổi chưa lưu
  const dirty = unsaved || (ready && expression === null);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

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

  const handleCancel = async () => {
    if (dirty) {
      const accepted = await confirm({ title: 'Bỏ thay đổi', message: 'Thay đổi chưa lưu sẽ mất.', confirmLabel: 'Bỏ thay đổi', danger: true });
      if (!accepted) return;
    }
    onClose();
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
      title: 'Áp dụng',
      message: `Bản này trở thành phiên bản hiệu lực của "${formula.formula_name}". ${mismatched > 0 ? `Có ${mismatched} ca thử không khớp.` : ''}`.trim(),
      confirmLabel: 'Áp dụng',
    });
    if (!accepted) return;
    await run(async () => {
      // Chỉ đổi trạng thái công thức, nội dung giữ nguyên: không tạo phiên bản mới
      const versionExpression = changed || draftId ? expression : null;
      await applyFormulaVersion({ formulaId: formula.id, draftId, expression: versionExpression, note, userId, verification: verificationChanged ? verification : null });
      onApplied();
    });
  };

  const handleDiscard = async () => {
    if (!draftId) return;
    const accepted = await confirm({ title: 'Bỏ bản nháp', message: 'Công thức giữ nguyên phiên bản đang hiệu lực.', confirmLabel: 'Bỏ bản nháp', danger: true });
    if (!accepted) return;
    await run(async () => {
      await deleteFormulaDraft(draftId);
      onApplied();
    });
  };

  if (!ready) {
    return (
      <div className="fx-main">
        {message ? <div className="fx-issue is-blocking">{message.text}</div> : <Spinner />}
      </div>
    );
  }

  return (
    <div className="fx-main">
      <div className="fx-edit-area">
        {line.kind === 'flat' ? (
          <TokenEditor
            tokens={line.tokens}
            onChange={(tokens) => setLine({ kind: 'flat', tokens })}
            kit={kit}
            errorAt={errorAtFor(lineError, 'flat')}
            label={formula.formula_name}
            autoFocus
            onConvertToCases={() => setLine({ kind: 'cases', branches: [newBranch()], otherwise: [] })}
          />
        ) : (
          <div className="fx-bar is-editing fx-bar-cases">
            <CasesFields
              value={line}
              onChange={(value) => setLine({ kind: 'cases', ...value })}
              kit={kit}
              error={lineError}
              onRemoveAll={() => setLine({ kind: 'flat', tokens: line.otherwise })}
            />
          </div>
        )}
      </div>

      {lineError && <div className="fx-issue is-blocking">{lineError.message}</div>}
      {issues.map((issue, index) => (
        <div key={index} className={`fx-issue${issue.blocking ? ' is-blocking' : ''}`}>
          {issue.message}
        </div>
      ))}
      {expression && <ResultLine expression={expression} tests={tests} unit={formula.output_unit} detailed />}

      <div className="fx-edit-footer">
        <div className="fx-edit-fields">
          <Input label="Ghi chú thay đổi" required value={note} onChange={(event) => setNote(event.target.value)} />
          <Select label="Trạng thái" options={VERIFICATION_OPTIONS} value={verification} onChange={setVerification} />
        </div>
        <div className="fx-edit-actions">
          <Badge variant={live.variant}>{live.label}</Badge>
          {draftId && <Badge variant="warning">Có bản nháp</Badge>}
          <span className="fx-edit-spacer" />
          {draftId && (
            <Button type="button" variant="ghost" leftIcon={<Trash2 size={16} />} disabled={busy} onClick={handleDiscard}>
              Bỏ bản nháp
            </Button>
          )}
          <Button type="button" variant="ghost" disabled={busy} onClick={handleCancel}>
            Hủy
          </Button>
          <Button type="button" variant="outline" leftIcon={<Save size={16} />} disabled={busy || !expression || blocking || !unsaved} onClick={handleSaveDraft}>
            Lưu nháp
          </Button>
          <Button
            type="button"
            isLoading={busy}
            disabled={!expression || issues.length > 0 || !noteReady || (!changed && !draftId && !verificationChanged)}
            onClick={handleApply}
          >
            Áp dụng
          </Button>
        </div>
        {message && <div className={`fx-issue${message.tone === 'danger' ? ' is-blocking' : ' is-success'}`}>{message.text}</div>}
      </div>
      {dialog}
    </div>
  );
};
