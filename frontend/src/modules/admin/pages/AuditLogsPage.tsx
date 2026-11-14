import React, { useEffect, useMemo, useState } from 'react';
import { Search, User } from 'lucide-react';
import { Alert, Card, DataTable, Input, Modal, Pagination } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import type { FilterOption } from '../../../types/filter';
import { ADMIN_PAGE_SIZE } from '../admin.constants';
import { formatDateTime } from '../admin.logic';
import type { AuditLogFilter, AuditLogRow } from '../admin.types';
import { EMPTY_AUDIT_LOG_FILTER, listAuditLogs, listAuditTargetTypes } from '../audit_logs.service';
import { TARGET_TYPE_LABEL, actionLabel } from '../audit_logs.constants';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { useAdminFilter } from '../useAdminFilter';
import './AdminPages.css';

export const AuditLogsPage: React.FC = () => {
  const { draft, applied, patch, apply, reset } = useAdminFilter<AuditLogFilter>(EMPTY_AUDIT_LOG_FILTER);
  const [targetTypes, setTargetTypes] = useState<FilterOption[]>([]);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditLogRow | null>(null);

  useEffect(() => {
    listAuditTargetTypes()
      .then((types) => setTargetTypes(types.map((type) => ({ value: type, label: TARGET_TYPE_LABEL[type] ?? type }))))
      .catch(() => setError('Không tải được danh sách loại đối tượng.'));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [applied]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    listAuditLogs(applied, page)
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
        setError(null);
      })
      .catch(() => active && setError('Không tải được nhật ký.'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [applied, page]);

  const columns = useMemo<DataTableColumn<AuditLogRow>[]>(
    () => [
      { key: 'created_at', header: 'Thời gian', nowrap: true, render: (row) => formatDateTime(row.created_at) },
      { key: 'actor', header: 'Người thực hiện', nowrap: true, render: (row) => row.actor_name ?? 'Hệ thống' },
      { key: 'subject', header: 'Học sinh liên quan', nowrap: true, render: (row) => row.subject_name ?? '—' },
      { key: 'action', header: 'Thao tác', render: (row) => <span className="admin-cell-text">{actionLabel(row.action)}</span> },
      {
        key: 'target_type',
        header: 'Đối tượng',
        nowrap: true,
        render: (row) => (row.target_type ? (TARGET_TYPE_LABEL[row.target_type] ?? row.target_type) : '—'),
      },
    ],
    [],
  );

  return (
    <>
      <div className="admin-page-header">
        <h1 className="page-title">Nhật ký</h1>
      </div>

      {error && (
        <div className="admin-alert-slot">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      <FilterBar onReset={reset} onSubmit={apply} isLoading={isLoading} totalResults={total}>
        <div className="filter-item-search">
          <Input
            label="Tìm kiếm"
            placeholder="Thao tác"
            leftIcon={<Search size={16} />}
            value={draft.keyword}
            onChange={(event) => patch({ keyword: event.target.value })}
          />
        </div>
        <Input
          label="Người dùng"
          placeholder="Họ tên"
          leftIcon={<User size={16} />}
          value={draft.person}
          onChange={(event) => patch({ person: event.target.value })}
        />
        <SearchableSelect
          label="Đối tượng"
          placeholder="Tất cả"
          options={targetTypes}
          value={draft.targetType}
          onChange={(value) => patch({ targetType: value })}
        />
        <Input label="Từ ngày" type="date" value={draft.dateFrom} onChange={(event) => patch({ dateFrom: event.target.value })} />
        <Input label="Đến ngày" type="date" value={draft.dateTo} onChange={(event) => patch({ dateTo: event.target.value })} />
      </FilterBar>

      <Card noPadding>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyText="Không có bản ghi phù hợp"
          caption="Nhật ký"
          onRowClick={setDetail}
        />
        <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={total} onChange={setPage} disabled={isLoading} />
      </Card>

      <Modal open={detail !== null} title="Chi tiết" wide onClose={() => setDetail(null)}>
        {detail && (
          <>
            <dl className="admin-meta-list">
              <dt>Thời gian</dt>
              <dd>{formatDateTime(detail.created_at)}</dd>
              <dt>Thao tác</dt>
              <dd>{actionLabel(detail.action)}</dd>
              <dt>Người thực hiện</dt>
              <dd>{detail.actor_name ?? 'Hệ thống'}</dd>
              {detail.subject_name && (
                <>
                  <dt>Học sinh liên quan</dt>
                  <dd>{detail.subject_name}</dd>
                </>
              )}
            </dl>
            <pre className="admin-details">{JSON.stringify(detail.details, null, 2)}</pre>
          </>
        )}
      </Modal>
    </>
  );
};
