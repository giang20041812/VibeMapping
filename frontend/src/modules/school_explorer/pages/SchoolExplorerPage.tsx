import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { Alert, Badge, Card, DataTable, Input, Pagination, Select } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import type { FilterOption } from '../../../types/filter';
import { useAdminFilter } from '../../admin/useAdminFilter';
import {
  INSTITUTION_TYPE_LABEL,
  INSTITUTION_TYPE_OPTIONS,
  OWNERSHIP_LABEL,
  OWNERSHIP_OPTIONS,
  SCHOOL_PAGE_SIZE,
} from '../school_explorer.constants';
import {
  EMPTY_INSTITUTION_FILTER,
  listCityOptions,
  listFieldOptions,
  listInstitutions,
  listMajorOptions,
} from '../school_explorer.service';
import type { InstitutionFilter, InstitutionRow } from '../school_explorer.types';
import './SchoolExplorerPage.css';

export const SchoolExplorerPage: React.FC = () => {
  const { draft, applied, patch, apply, reset } = useAdminFilter<InstitutionFilter>(EMPTY_INSTITUTION_FILTER);
  const [cities, setCities] = useState<FilterOption[]>([]);
  const [fields, setFields] = useState<FilterOption[]>([]);
  const [majors, setMajors] = useState<FilterOption[]>([]);
  const [rows, setRows] = useState<InstitutionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listCityOptions(), listFieldOptions(), listMajorOptions()])
      .then(([cityOptions, fieldOptions, majorOptions]) => {
        setCities(cityOptions);
        setFields(fieldOptions);
        setMajors(majorOptions);
      })
      .catch(() => setError('Không tải được các mục lọc.'));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [applied]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    listInstitutions(applied, page)
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
        setError(null);
      })
      .catch(() => active && setError('Không tải được danh sách trường.'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [applied, page]);

  const columns = useMemo<DataTableColumn<InstitutionRow>[]>(
    () => [
      {
        key: 'institution_name',
        header: 'Tên trường',
        render: (row) => (
          <span className="school-explorer-name">
            {row.institution_name}
            {row.website_url && (
              <a className="school-explorer-link" href={row.website_url} target="_blank" rel="noopener noreferrer" aria-label={`Website ${row.institution_name}`}>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}
          </span>
        ),
      },
      { key: 'institution_type', header: 'Loại cơ sở', nowrap: true, render: (row) => INSTITUTION_TYPE_LABEL[row.institution_type] },
      {
        key: 'ownership',
        header: 'Loại hình',
        nowrap: true,
        render: (row) => (row.ownership ? <Badge variant={row.ownership === 'public' ? 'info' : 'default'}>{OWNERSHIP_LABEL[row.ownership]}</Badge> : '—'),
      },
      { key: 'city', header: 'Tỉnh/thành', nowrap: true, render: (row) => row.city ?? '—' },
      { key: 'field_name', header: 'Lĩnh vực', render: (row) => row.field_name ?? '—' },
      { key: 'program_count', header: 'Chương trình', align: 'right', nowrap: true, render: (row) => row.program_count },
    ],
    [],
  );

  return (
    <>
      <h1 className="page-title">Khám phá trường</h1>

      {error && (
        <div className="school-explorer-alert">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      <FilterBar onReset={reset} onSubmit={apply} isLoading={isLoading} totalResults={total}>
        <div className="filter-item-search">
          <Input
            label="Tìm kiếm"
            placeholder="Tên trường"
            leftIcon={<Search size={16} />}
            value={draft.keyword}
            onChange={(event) => patch({ keyword: event.target.value })}
          />
        </div>
        <SearchableSelect label="Ngành" placeholder="Tất cả" options={majors} value={draft.majorId} onChange={(value) => patch({ majorId: value })} />
        <SearchableSelect label="Tỉnh/thành" placeholder="Tất cả" options={cities} value={draft.city} onChange={(value) => patch({ city: value })} />
        <SearchableSelect label="Lĩnh vực" placeholder="Tất cả" options={fields} value={draft.fieldId} onChange={(value) => patch({ fieldId: value })} />
        <Select
          label="Loại hình"
          emptyLabel="Tất cả"
          options={OWNERSHIP_OPTIONS}
          value={draft.ownership}
          onChange={(value) => patch({ ownership: value as InstitutionFilter['ownership'] })}
        />
        <Select
          label="Loại cơ sở"
          emptyLabel="Tất cả"
          options={INSTITUTION_TYPE_OPTIONS}
          value={draft.institutionType}
          onChange={(value) => patch({ institutionType: value as InstitutionFilter['institutionType'] })}
        />
      </FilterBar>

      <Card noPadding>
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} isLoading={isLoading} emptyText="Không có trường phù hợp" caption="Danh sách trường" />
        <Pagination page={page} pageSize={SCHOOL_PAGE_SIZE} total={total} onChange={setPage} disabled={isLoading} />
      </Card>
    </>
  );
};
