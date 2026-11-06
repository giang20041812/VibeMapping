import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Alert, Badge, Button, Card, DataTable, Pagination, Select } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { FilterSearch } from '../../../components/filters/FilterSearch/FilterSearch';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { db } from '../../../lib/rpc';
import { toSearchKey } from '../../../lib/vnSearch';
import type { FilterOption } from '../../../types/filter';
import {
  CAREER_ADMIN_PAGE_SIZE,
  CAREER_STATUS_LABEL,
  CAREER_STATUS_OPTIONS,
  CAREER_STATUS_VARIANT,
  CHECKED_KIND_LABEL,
  COMPLETE_FILTER_OPTIONS,
  DEFAULT_REVIEW_MONTHS,
  REVIEW_FILTER_OPTIONS,
  formatDate,
} from '../career_admin.constants';
import { listAdminCareers, listCareerFieldOptions } from '../career_admin.service';
import type { AdminCareerRow, CareerFieldOption } from '../career_admin.types';
import { useAdminFilter } from '../useAdminFilter';
import './AdminPages.css';

interface CareerFilter {
  keyword: string;
  status: string;
  fieldId: string;
  completeness: string;
  review: string;
}

const EMPTY_FILTER: CareerFilter = { keyword: '', status: '', fieldId: '', completeness: '', review: '' };

export const CareerAdminListPage: React.FC = () => {
  const navigate = useNavigate();
  const { draft, applied, patch, apply, reset } = useAdminFilter(EMPTY_FILTER);
  const [careers, setCareers] = useState<AdminCareerRow[]>([]);
  const [fields, setFields] = useState<CareerFieldOption[]>([]);
  const [reviewMonths, setReviewMonths] = useState(DEFAULT_REVIEW_MONTHS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    Promise.all([
      listAdminCareers(),
      listCareerFieldOptions(),
      db.from('operation_parameters').select('param_value').eq('param_code', 'career_review_months').eq('is_current', true).maybeSingle(),
    ])
      .then(([careerRows, fieldRows, parameter]) => {
        if (!active) return;
        setCareers(careerRows);
        setFields(fieldRows);
        const months = Number((parameter.data as { param_value: unknown } | null)?.param_value);
        if (Number.isFinite(months) && months > 0) setReviewMonths(months);
      })
      .catch(() => active && setError('Không tải được danh sách nghề.'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const fieldName = useMemo(() => new Map(fields.map((f) => [f.id, f.field_name])), [fields]);
  const parentOf = useMemo(() => new Map(fields.map((f) => [f.id, f.parent_field_id])), [fields]);
  const fieldOptions = useMemo<FilterOption[]>(
    () => fields.map((f) => ({ value: f.id, label: f.parent_field_id ? `${fieldName.get(f.parent_field_id) ?? ''} › ${f.field_name}` : f.field_name })),
    [fields, fieldName],
  );

  const staleBefore = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - reviewMonths);
    return cutoff.toISOString().slice(0, 10);
  }, [reviewMonths]);
  const isStale = (row: AdminCareerRow) => row.data_checked_at !== null && row.data_checked_at < staleBefore;

  const filtered = useMemo(() => {
    const key = toSearchKey(applied.keyword);
    return careers.filter((row) => {
      if (key && !toSearchKey(row.career_name).includes(key) && !toSearchKey(row.career_code).includes(key)) return false;
      if (applied.status && row.status !== applied.status) return false;
      if (applied.fieldId && row.career_field_id !== applied.fieldId && parentOf.get(row.career_field_id) !== applied.fieldId) return false;
      if (applied.completeness === 'complete' && !row.is_standard_complete) return false;
      if (applied.completeness === 'incomplete' && row.is_standard_complete) return false;
      if (applied.review === 'stale' && !isStale(row)) return false;
      if (applied.review === 'fresh' && (row.data_checked_at === null || isStale(row))) return false;
      if (applied.review === 'none' && row.data_checked_at !== null) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careers, applied, parentOf, staleBefore]);

  useEffect(() => setPage(1), [applied]);
  const pageRows = useMemo(() => filtered.slice((page - 1) * CAREER_ADMIN_PAGE_SIZE, page * CAREER_ADMIN_PAGE_SIZE), [filtered, page]);

  const columns = useMemo<DataTableColumn<AdminCareerRow>[]>(
    () => [
      { key: 'code', header: 'Mã nghề', nowrap: true, render: (row) => row.career_code },
      { key: 'name', header: 'Tên nghề', render: (row) => row.career_name },
      { key: 'field', header: 'Lĩnh vực', render: (row) => fieldName.get(row.career_field_id) ?? '' },
      { key: 'jd', header: 'Số JD', align: 'center', nowrap: true, render: (row) => row.qualifying_jd_count },
      { key: 'holland', header: 'Holland', align: 'center', nowrap: true, render: (row) => row.holland_top3 ?? '' },
      {
        key: 'standard',
        header: 'Thành phần',
        align: 'center',
        render: (row) => <Badge variant={row.is_standard_complete ? 'success' : 'warning'}>{row.is_standard_complete ? 'Đủ 3 thành phần' : 'Thiếu thành phần'}</Badge>,
      },
      {
        key: 'checked',
        header: 'Ngày kiểm tra',
        align: 'center',
        render: (row) => (row.data_checked_at ? (
          <>
            {formatDate(row.data_checked_at)} {row.data_checked_kind && <Badge size="sm">{CHECKED_KIND_LABEL[row.data_checked_kind]}</Badge>}
            {isStale(row) && <Badge variant="danger" size="sm">Quá hạn rà soát</Badge>}
          </>
        ) : ''),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        align: 'center',
        render: (row) => <Badge variant={CAREER_STATUS_VARIANT[row.status]}>{CAREER_STATUS_LABEL[row.status]}</Badge>,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fieldName, staleBefore],
  );

  return (
    <>
      <div className="admin-page-header">
        <h1 className="page-title">Quản lý nghề</h1>
        <Button type="button" leftIcon={<Plus size={16} />} onClick={() => navigate('/quan-tri/nghe/moi')}>
          Thêm nghề
        </Button>
      </div>

      {error && (
        <div className="admin-alert-slot">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      <FilterBar onReset={reset} onSubmit={apply} isLoading={isLoading} totalResults={filtered.length}>
        <FilterSearch placeholder="Mã hoặc tên nghề" value={draft.keyword} onChange={(keyword) => patch({ keyword })} />
        <Select label="Trạng thái" emptyLabel="Tất cả" value={draft.status} options={CAREER_STATUS_OPTIONS} onChange={(status) => patch({ status })} />
        <SearchableSelect label="Lĩnh vực" placeholder="Tất cả" options={fieldOptions} value={draft.fieldId} onChange={(fieldId) => patch({ fieldId })} />
        <Select label="Thành phần" emptyLabel="Tất cả" value={draft.completeness} options={COMPLETE_FILTER_OPTIONS} onChange={(completeness) => patch({ completeness })} />
        <Select label="Rà soát" emptyLabel="Tất cả" value={draft.review} options={REVIEW_FILTER_OPTIONS} onChange={(review) => patch({ review })} />
      </FilterBar>

      <Card noPadding>
        <DataTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyText="Không có nghề phù hợp"
          caption="Danh sách nghề"
          onRowClick={(row) => navigate(`/quan-tri/nghe/${row.id}`)}
        />
        <Pagination page={page} pageSize={CAREER_ADMIN_PAGE_SIZE} total={filtered.length} onChange={setPage} disabled={isLoading} />
      </Card>
    </>
  );
};
