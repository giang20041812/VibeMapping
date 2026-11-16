import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Network, Search } from 'lucide-react';
import { Alert, Badge, Button, Card, DataTable, Input, Pagination } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { ADMIN_PAGE_SIZE } from '../../admin/admin.constants';
import { useAdminFilter } from '../../admin/useAdminFilter';
import { FormulaMath } from '../components/FormulaMath';
import { VERIFICATION_LABEL, VERIFICATION_OPTIONS, VERIFICATION_VARIANT, formulaDependencies, liveStatus, matchesFormulaFilter } from '../formula.logic';
import type { FormulaFilter, FormulaRecord } from '../formula.types';
import { useFormulaLibrary } from '../useFormulaLibrary';
import '../../admin/pages/AdminPages.css';
import './FormulaLibrary.css';

const EMPTY_FILTER: FormulaFilter = { keyword: '', groupId: '', verification: '' };

export const FormulaListPage: React.FC = () => {
  const navigate = useNavigate();
  const { library, isLoading, error } = useFormulaLibrary();
  const { draft, applied, patch, apply, reset } = useAdminFilter(EMPTY_FILTER);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [applied]);

  const symbolLatex = useMemo(() => new Map((library?.symbols ?? []).map((symbol) => [symbol.code, symbol.latex])), [library]);

  /** Số công thức khác đang dùng kết quả của mỗi công thức */
  const usedByCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const formula of library?.formulas ?? []) {
      for (const code of formulaDependencies(formula)) counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return counts;
  }, [library]);

  const filtered = useMemo(() => (library?.formulas ?? []).filter((formula) => matchesFormulaFilter(formula, applied)), [library, applied]);

  const pageRows = useMemo(() => filtered.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE), [filtered, page]);

  const groupOptions = useMemo(() => (library?.groups ?? []).map((group) => ({ value: group.id, label: group.group_name })), [library]);

  const columns = useMemo<DataTableColumn<FormulaRecord>[]>(
    () => [
      {
        key: 'formula_name',
        header: 'Công thức',
        render: (row) => (
          <span className="admin-cell-text">
            {row.formula_name}
            <span className="admin-cell-sub admin-code">{row.formula_code}</span>
          </span>
        ),
      },
      { key: 'group_name', header: 'Nhóm', nowrap: true, render: (row) => row.group_name },
      {
        key: 'output',
        header: 'Kết quả',
        nowrap: true,
        render: (row) => <FormulaMath latex={symbolLatex.get(row.output_symbol) ?? row.output_symbol} />,
      },
      {
        key: 'verification_level',
        header: 'Trạng thái',
        nowrap: true,
        render: (row) => <Badge variant={VERIFICATION_VARIANT[row.verification_level]}>{VERIFICATION_LABEL[row.verification_level]}</Badge>,
      },
      {
        key: 'live',
        header: 'Áp dụng',
        nowrap: true,
        render: (row) => {
          const status = liveStatus(row.formula_code);
          return <Badge variant={status.variant}>{status.label}</Badge>;
        },
      },
      { key: 'version_no', header: 'Phiên bản', align: 'center', nowrap: true, render: (row) => (row.version_no ? `v${row.version_no}` : '—') },
      { key: 'uses', header: 'Dùng', align: 'center', nowrap: true, render: (row) => formulaDependencies(row).length },
      { key: 'used_by', header: 'Được dùng', align: 'center', nowrap: true, render: (row) => usedByCount.get(row.formula_code) ?? 0 },
      {
        key: 'actions',
        header: '',
        align: 'right',
        nowrap: true,
        render: (row) => (
          <Button type="button" size="sm" variant="outline" leftIcon={<Eye size={14} />} onClick={() => navigate(`/quan-tri/cong-thuc/${row.id}`)}>
            Xem
          </Button>
        ),
      },
    ],
    [navigate, symbolLatex, usedByCount],
  );

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

      <Card noPadding>
        <DataTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyText="Không có công thức phù hợp"
          caption="Danh sách công thức"
          onRowClick={(row) => navigate(`/quan-tri/cong-thuc/${row.id}`)}
        />
        <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={filtered.length} onChange={setPage} disabled={isLoading} />
      </Card>
    </>
  );
};
