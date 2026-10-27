import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Alert, Badge, Button, Card, DataTable, Skeleton } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { RATER_GROUP_LABEL } from '../admin.constants';
import type { Criteria, CriteriaGroup, CriteriaRaterVisibility, HollandCode } from '../admin.types';
import { CriteriaFormModal } from '../components/CriteriaFormModal';
import { CriteriaGroupFormModal } from '../components/CriteriaGroupFormModal';
import { listCriteria, listCriteriaGroups, listCriteriaRaterVisibility, listHollandCodes } from '../criteria.service';
import './AdminPages.css';

const GROUP_SKELETONS = [0, 1, 2];

export const CriteriaPage: React.FC = () => {
  const [groups, setGroups] = useState<CriteriaGroup[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [visibility, setVisibility] = useState<CriteriaRaterVisibility[]>([]);
  const [hollandCodes, setHollandCodes] = useState<HollandCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editingGroup, setEditingGroup] = useState<CriteriaGroup | null>(null);
  const [editingCriteria, setEditingCriteria] = useState<Criteria | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    Promise.all([listCriteriaGroups(), listCriteria(), listCriteriaRaterVisibility(), listHollandCodes()])
      .then(([groupList, criteriaList, visibilityList, hollandList]) => {
        if (!active) return;
        setGroups(groupList);
        setCriteria(criteriaList);
        setVisibility(visibilityList);
        setHollandCodes(hollandList);
        setError(null);
      })
      .catch(() => active && setError('Không tải được bộ tiêu chí.'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  const columns = useMemo<DataTableColumn<Criteria>[]>(
    () => [
      { key: 'dimension_code', header: 'Mã tiêu chí', nowrap: true, render: (row) => <span className="admin-code">{row.dimension_code}</span> },
      { key: 'name', header: 'Tên tiêu chí', render: (row) => <span className="admin-cell-text">{row.name}</span> },
      { key: 'holland_code', header: 'Mã Holland', align: 'center', nowrap: true, render: (row) => row.holland_code ?? '—' },
      { key: 'sort_order', header: 'Thứ tự', align: 'center', nowrap: true, render: (row) => row.sort_order },
      {
        key: 'visibility',
        header: 'Hiển thị cho',
        render: (row) => {
          const visible = visibility.filter((item) => item.criteria_id === row.id && item.is_visible);
          if (visible.length === 0) return '—';
          return (
            <div className="admin-badge-list">
              {visible.map((item) => (
                <Badge key={item.rater_group} variant="info" size="sm">
                  {RATER_GROUP_LABEL[item.rater_group]}
                </Badge>
              ))}
            </div>
          );
        },
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
          <Button type="button" size="sm" variant="outline" leftIcon={<Pencil size={14} />} onClick={() => setEditingCriteria(row)}>
            Sửa
          </Button>
        ),
      },
    ],
    [visibility],
  );

  return (
    <>
      <div className="admin-page-header">
        <h1 className="page-title">Tiêu chí</h1>
      </div>

      {error && (
        <div className="admin-alert-slot">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      <div className="admin-stack">
        {isLoading &&
          groups.length === 0 &&
          GROUP_SKELETONS.map((slot) => (
            <Card
              key={slot}
              noPadding
              title={<Skeleton shape="heading" className="admin-skeleton-title" />}
              action={<Skeleton shape="button-sm" />}
            >
              <DataTable columns={columns} rows={[]} rowKey={() => ''} isLoading skeletonRows={3} />
            </Card>
          ))}
        {groups.map((group) => (
          <Card
            key={group.id}
            noPadding
            title={`${group.group_code} · ${group.name}`}
            action={
              <div className="admin-row-actions">
                {!group.is_active && <Badge variant="default">Đã ẩn</Badge>}
                <Button type="button" size="sm" variant="outline" leftIcon={<Pencil size={14} />} onClick={() => setEditingGroup(group)}>
                  Sửa nhóm
                </Button>
              </div>
            }
          >
            <DataTable
              columns={columns}
              rows={criteria.filter((item) => item.group_id === group.id)}
              rowKey={(row) => row.id}
              isLoading={isLoading}
              emptyText="Nhóm chưa có tiêu chí"
              caption={`Tiêu chí nhóm ${group.group_code}`}
            />
          </Card>
        ))}
      </div>

      <CriteriaGroupFormModal
        open={editingGroup !== null}
        group={editingGroup}
        onClose={() => setEditingGroup(null)}
        onSaved={() => {
          setEditingGroup(null);
          reload();
        }}
      />
      <CriteriaFormModal
        open={editingCriteria !== null}
        criteria={editingCriteria}
        visibility={visibility}
        hollandCodes={hollandCodes}
        onClose={() => setEditingCriteria(null)}
        onSaved={() => {
          setEditingCriteria(null);
          reload();
        }}
      />
    </>
  );
};
