import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { Alert, Card, DataTable, Input, Pagination } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import type { FilterOption } from '../../../types/filter';
import { useAdminFilter } from '../../admin/useAdminFilter';
import { listCityOptions, listFieldOptions } from '../../school_explorer/school_explorer.service';
import { EMPTY_MAJOR_FILTER, MAJOR_PAGE_SIZE, listMajors } from '../major_explorer.service';
import type { MajorFilter, MajorRow } from '../major_explorer.types';
import './MajorExplorerPage.css';

/** Danh mục ngành đào tạo; mỗi ngành dẫn sang danh sách trường có đào tạo ngành đó */
export const MajorExplorerPage: React.FC = () => {
  const { draft, applied, patch, apply, reset } = useAdminFilter<MajorFilter>(EMPTY_MAJOR_FILTER);
  const [cities, setCities] = useState<FilterOption[]>([]);
  const [fields, setFields] = useState<FilterOption[]>([]);
  const [rows, setRows] = useState<MajorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listCityOptions(), listFieldOptions()])
      .then(([cityOptions, fieldOptions]) => {
        setCities(cityOptions);
        setFields(fieldOptions);
      })
      .catch(() => setError('Không tải được các mục lọc.'));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [applied]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    listMajors(applied, page)
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
        setError(null);
      })
      .catch(() => active && setError('Không tải được danh sách ngành.'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [applied, page]);

  const columns = useMemo<DataTableColumn<MajorRow>[]>(
    () => [
      { key: 'major_name', header: 'Ngành', render: (row) => <span className="major-explorer-name">{row.major_name}</span> },
      { key: 'program_count', header: 'Chương trình', align: 'right', nowrap: true, render: (row) => row.program_count },
      {
        key: 'schools',
        header: 'Trường đào tạo',
        nowrap: true,
        render: (row) => (
          <Link className="major-explorer-link" to={`/kham-pha-truong?nganh=${row.id}`}>
            Xem trường
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <h1 className="page-title">Ngành nghề</h1>

      {error && (
        <div className="major-explorer-alert">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      <FilterBar onReset={reset} onSubmit={apply} isLoading={isLoading} totalResults={total}>
        <div className="filter-item-search">
          <Input
            label="Tìm kiếm"
            placeholder="Tên ngành"
            leftIcon={<Search size={16} />}
            value={draft.keyword}
            onChange={(event) => patch({ keyword: event.target.value })}
          />
        </div>
        <SearchableSelect label="Lĩnh vực" placeholder="Tất cả" options={fields} value={draft.fieldId} onChange={(value) => patch({ fieldId: value })} />
        <SearchableSelect label="Tỉnh/thành" placeholder="Tất cả" options={cities} value={draft.city} onChange={(value) => patch({ city: value })} />
      </FilterBar>

      <Card noPadding>
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} isLoading={isLoading} emptyText="Không có ngành phù hợp" caption="Danh sách ngành" />
        <Pagination page={page} pageSize={MAJOR_PAGE_SIZE} total={total} onChange={setPage} disabled={isLoading} />
      </Card>
    </>
  );
};
