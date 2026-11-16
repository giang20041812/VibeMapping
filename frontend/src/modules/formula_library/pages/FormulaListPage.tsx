import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Network, Search } from 'lucide-react';
import { Alert, Button, Card, Input, Spinner, useConfirm } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { walkExpr } from '../../../domain/formula';
import { useAdminFilter } from '../../admin/useAdminFilter';
import { FormulaRow } from '../components/FormulaRow';
import type { EditorKit } from '../components/TokenEditor';
import { listAllFormulaTests } from '../formula.service';
import { VERIFICATION_OPTIONS, buildLatexContext, matchesFormulaFilter } from '../formula.logic';
import type { FormulaFilter, FormulaTestRow } from '../formula.types';
import { useFormulaLibrary } from '../useFormulaLibrary';
import '../../admin/pages/AdminPages.css';
import './FormulaLibrary.css';

const EMPTY_FILTER: FormulaFilter = { keyword: '', groupId: '', verification: '' };
const NO_TESTS: FormulaTestRow[] = [];
const HIGHLIGHT_MS = 1600;

export const FormulaListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { library, isLoading, error, reload } = useFormulaLibrary();
  const { draft, applied, patch, apply, reset } = useAdminFilter(EMPTY_FILTER);
  const [tests, setTests] = useState<Record<string, FormulaTestRow[]>>({});
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [pendingScroll, setPendingScroll] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  /** Dòng đang sửa có thay đổi chưa lưu */
  const dirtyRef = useRef(false);

  const editingId = searchParams.get('sua');

  useEffect(() => {
    let active = true;
    listAllFormulaTests()
      .then((rows) => active && setTests(rows))
      .catch(() => active && setTests({}));
    return () => {
      active = false;
    };
  }, []);

  const baseKit = useMemo<Omit<EditorKit, 'env'> | null>(() => {
    if (!library) return null;
    const symbols = Object.fromEntries(library.symbols.map((symbol) => [symbol.code, symbol]));
    // Các tập dữ liệu đang có, để chọn khi thêm phép tổng
    const sets = new Map<string, string>();
    for (const formula of library.formulas) {
      if (!formula.expression) continue;
      walkExpr(formula.expression, (node) => {
        if (node.t === 'agg' && !node.rows && node.over && !sets.has(node.over)) sets.set(node.over, node.label);
      });
    }
    return {
      names: { symbols, formulas: Object.fromEntries(library.formulas.map((formula) => [formula.formula_code, formula.formula_name])) },
      ctx: { symbols },
      latex: buildLatexContext(library),
      sets: [...sets].map(([over, label]) => ({ over, label })),
    };
  }, [library]);

  const filtered = useMemo(() => (library?.formulas ?? []).filter((formula) => matchesFormulaFilter(formula, applied)), [library, applied]);

  const sections = useMemo(
    () =>
      (library?.groups ?? [])
        .map((group) => ({ group, formulas: filtered.filter((formula) => formula.group_id === group.id) }))
        .filter((section) => section.formulas.length > 0),
    [library, filtered],
  );

  const groupOptions = useMemo(() => (library?.groups ?? []).map((group) => ({ value: group.id, label: group.group_name })), [library]);

  const setEditing = useCallback(
    (id: string | null) => {
      dirtyRef.current = false;
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (id) next.set('sua', id);
          else next.delete('sua');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  /** Chuyển sang sửa dòng khác: hỏi trước nếu dòng đang sửa còn thay đổi chưa lưu */
  const startEdit = useCallback(
    async (id: string) => {
      if (editingId && editingId !== id && dirtyRef.current) {
        const accepted = await confirm({ title: 'Bỏ thay đổi', message: 'Thay đổi chưa lưu ở công thức đang sửa sẽ mất.', confirmLabel: 'Bỏ thay đổi', danger: true });
        if (!accepted) return;
      }
      setEditing(id);
    },
    [editingId, confirm, setEditing],
  );

  // Mở từ trang chi tiết: cuộn tới dòng đang sửa
  useEffect(() => {
    if (!editingId || !library) return;
    const formula = library.formulas.find((item) => item.id === editingId);
    if (formula) setPendingScroll(formula.formula_code);
    // chỉ chạy khi vừa tải xong thư viện
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library === null]);

  // Bấm vào thẻ công thức khác: cuộn tới dòng đó; đang bị lọc mất thì bỏ lọc trước
  const jumpTo = useCallback(
    (code: string) => {
      if (!filtered.some((formula) => formula.formula_code === code)) reset();
      setPendingScroll(code);
    },
    [filtered, reset],
  );

  useEffect(() => {
    if (!pendingScroll) return;
    const element = document.getElementById(`cong-thuc-${pendingScroll}`);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlighted(pendingScroll);
    setPendingScroll(null);
    const timer = window.setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [pendingScroll, sections]);

  return (
    <>
      <div className="admin-page-header">
        <h1 className="page-title">Công thức</h1>
        <Button type="button" variant="outline" leftIcon={<Network size={16} />} onClick={() => navigate('/quan-tri/cong-thuc/so-do')}>
          Sơ đồ liên kết
        </Button>
      </div>

      {error && (
        <div className="admin-alert-slot">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      <FilterBar onReset={reset} onSubmit={apply} isLoading={isLoading} totalResults={filtered.length}>
        <div className="filter-item-search">
          <Input
            label="Tìm kiếm"
            placeholder="Tên công thức"
            leftIcon={<Search size={16} />}
            value={draft.keyword}
            onChange={(event) => patch({ keyword: event.target.value })}
          />
        </div>
        <SearchableSelect label="Nhóm" placeholder="Tất cả" options={groupOptions} value={draft.groupId} onChange={(value) => patch({ groupId: value })} />
        <SearchableSelect
          label="Trạng thái"
          placeholder="Tất cả"
          options={VERIFICATION_OPTIONS}
          value={draft.verification}
          onChange={(value) => patch({ verification: value })}
        />
      </FilterBar>

      {isLoading && !library ? (
        <div className="formula-loading">
          <Spinner />
        </div>
      ) : sections.length === 0 || !library || !baseKit ? (
        <Card>
          <p className="formula-empty">Không có công thức phù hợp</p>
        </Card>
      ) : (
        <div className="fx-sections">
          {sections.map(({ group, formulas }) => (
            <Card key={group.id} title={group.group_name}>
              <div className="fx-rows">
                {formulas.map((formula) => (
                  <FormulaRow
                    key={formula.id}
                    formula={formula}
                    library={library}
                    baseKit={baseKit}
                    tests={tests[formula.id] ?? NO_TESTS}
                    editing={editingId === formula.id}
                    highlighted={highlighted === formula.formula_code}
                    onEdit={() => void startEdit(formula.id)}
                    onDirtyChange={(dirty) => {
                      dirtyRef.current = dirty;
                    }}
                    onClose={() => setEditing(null)}
                    onApplied={() => {
                      setEditing(null);
                      reload();
                    }}
                    onOpenDetail={() => navigate(`/quan-tri/cong-thuc/${formula.id}`)}
                    onRefClick={jumpTo}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
      {dialog}
    </>
  );
};
