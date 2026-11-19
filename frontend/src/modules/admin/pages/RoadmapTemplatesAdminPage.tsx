import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Pencil } from 'lucide-react';
import { Alert, Badge, Button, Card, DataTable, Pagination } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import type { FilterOption } from '../../../types/filter';
import { GroupBadge } from '../../roadmap/components/GroupBadge';
import type { CriteriaGroupCode } from '../../roadmap/roadmap.types';
import { ADMIN_PAGE_SIZE } from '../admin.constants';
import { RoadmapTemplateFilterFields } from '../components/RoadmapTemplateFilterFields';
import { RoadmapTemplateItemModal } from '../components/RoadmapTemplateItemModal';
import {
  EMPTY_ROADMAP_TEMPLATE_FILTER,
  listRoadmapTemplateItems,
  listRoadmapTemplateNames,
  updateRoadmapTemplateItem,
  type RoadmapTemplateItemRow,
} from '../roadmap_templates_admin.service';
import { useAdminFilter } from '../useAdminFilter';
import '../../roadmap/pages/RoadmapPage.css';
import './AdminPages.css';

const CHECK_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'info'> = {
  'Đã duyệt': 'success',
  'Đã check': 'info',
  'Cần sửa': 'danger',
  'Nháp - cần check': 'warning',
};

/** Quản trị mục của lộ trình mẫu: lọc theo lộ trình, nhóm, giai đoạn, trạng thái kiểm tra; sửa nội dung và kế hoạch mẫu */
export const RoadmapTemplatesAdminPage: React.FC = () => {
  const { draft, applied, patch, apply, reset } = useAdminFilter(EMPTY_ROADMAP_TEMPLATE_FILTER);
  const [templates, setTemplates] = useState<FilterOption[]>([]);
  const [rows, setRows] = useState<RoadmapTemplateItemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RoadmapTemplateItemRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    listRoadmapTemplateNames().then(setTemplates).catch(() => setError('Không tải được danh sách lộ trình mẫu.'));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [applied]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    listRoadmapTemplateItems(applied, page)
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
        setError(null);
      })
      .catch(() => active && setError('Không tải được mục lộ trình mẫu.'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [applied, page, reloadKey]);

  const templateName = useCallback((code: string) => templates.find((t) => t.value === code)?.label ?? code, [templates]);

  const toggleActive = useCallback(async (row: RoadmapTemplateItemRow) => {
    setBusyId(row.id);
    try {
      await updateRoadmapTemplateItem(row.id, { is_active: !row.is_active });
      setRows((current) => current.map((item) => (item.id === row.id ? { ...item, is_active: !row.is_active } : item)));
      setError(null);
    } catch {
      setError('Không đổi được trạng thái mục. Thử lại sau.');
    } finally {
      setBusyId(null);
    }
  }, []);

  const columns = useMemo<DataTableColumn<RoadmapTemplateItemRow>[]>(
    () => [
      { key: 'item_code', header: 'Mã mục', nowrap: true, render: (row) => <span className="admin-code">{row.item_code}</span> },
      { key: 'template', header: 'Lộ trình', render: (row) => <span className="admin-cell-text">{templateName(row.template_code)}</span> },
      { key: 'group', header: 'Nhóm', nowrap: true, render: (row) => <GroupBadge group={row.group_code as CriteriaGroupCode} /> },
      { key: 'stage', header: 'Giai đoạn', nowrap: true, render: (row) => row.stage_name },
      { key: 'title', header: 'Tên mục', render: (row) => <span className="admin-cell-text">{row.title}</span> },
      {
        key: 'duration',
        header: 'Thời lượng',
        nowrap: true,
        render: (row) =>
          row.level_duration_weeks
            ? (['1', '2', '3'] as const).map((k) => row.level_duration_weeks?.[k] ?? '—').join(' / ') + ' tuần'
            : `${row.duration_weeks} tuần`,
      },
      {
        key: 'check',
        header: 'Kiểm tra',
        nowrap: true,
        render: (row) => (
          <span className="admin-badge-list">
            {row.check_status ? <Badge variant={CHECK_VARIANT[row.check_status] ?? 'default'}>{row.check_status}</Badge> : '—'}
            {row.updated_by && <Badge variant="info">Sửa trong ứng dụng</Badge>}
          </span>
        ),
      },
      {
        key: 'is_active',
        header: 'Trạng thái',
        nowrap: true,
        render: (row) => <Badge variant={row.is_active ? 'success' : 'default'}>{row.is_active ? 'Đang dùng' : 'Đã ẩn'}</Badge>,
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        nowrap: true,
        render: (row) => (
          <div className="admin-row-actions">
            <Button type="button" size="sm" variant="outline" leftIcon={<Pencil size={14} />} onClick={() => setEditing(row)}>
              Sửa
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              leftIcon={row.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
              disabled={busyId === row.id}
              onClick={() => void toggleActive(row)}
            >
              {row.is_active ? 'Ẩn' : 'Hiện'}
            </Button>
          </div>
        ),
      },
    ],
    [busyId, templateName, toggleActive],
  );

  return (
    <>
      <div className="admin-page-header">
        <h1 className="page-title">Lộ trình mẫu</h1>
      </div>

      {error && (
        <div className="admin-alert-slot">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      <FilterBar onReset={reset} onSubmit={apply} isLoading={isLoading} totalResults={total}>
        <RoadmapTemplateFilterFields draft={draft} onChange={patch} templates={templates} />
      </FilterBar>

      <Card noPadding>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyText="Không có mục phù hợp"
          caption="Mục lộ trình mẫu"
        />
        <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={total} onChange={setPage} disabled={isLoading} />
      </Card>

      {editing && (
        <RoadmapTemplateItemModal
          key={editing.id}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setReloadKey((value) => value + 1);
          }}
        />
      )}
    </>
  );
};
