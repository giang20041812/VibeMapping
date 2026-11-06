import React from 'react';
import { History } from 'lucide-react';
import { Badge, Button, DataTable, type DataTableColumn } from '../../../components/common';
import { REASON_OPTIONS, formatDate } from '../roadmap.logic';
import type { Roadmap } from '../roadmap.types';

interface Props {
  roadmap: Roadmap;
  history: Roadmap[];
  viewingId: string | null;
  onView: (id: string) => void;
  onBackToActive: () => void;
}

/** Lịch sử lộ trình: lộ trình đang thực hiện và các lộ trình đã lưu trữ */
export const RoadmapHistory: React.FC<Props> = ({ roadmap, history, viewingId, onView, onBackToActive }) => {
  const rows = [roadmap, ...history];
  const columns: DataTableColumn<Roadmap>[] = [
    {
      key: 'title',
      header: 'Lộ trình',
      align: 'left',
      render: (r) => (
        <>
          <strong>{r.title}</strong>
          <br />
          <small>{formatDate(r.created_at.slice(0, 10))}</small>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (r) => (r.is_active ? <Badge variant="info">Đang thực hiện</Badge> : <Badge>Đã lưu trữ</Badge>),
    },
    {
      key: 'reason',
      header: 'Lý do tạo lại',
      align: 'left',
      render: (r) => REASON_OPTIONS.find((o) => o.value === r.regenerate_reason)?.label ?? '',
    },
    {
      key: 'progress',
      header: 'Hoàn thành',
      nowrap: true,
      render: (r) => `${r.milestones.filter((m) => m.done).length}/${r.milestones.length} hoạt động`,
    },
    {
      key: 'action',
      header: 'Hành động',
      render: (r) =>
        (r.is_active && !viewingId) || r.id === viewingId ? (
          <Badge variant="success">Đang xem</Badge>
        ) : (
          <Button size="sm" variant="outline" onClick={() => (r.is_active ? onBackToActive() : onView(r.id))}>
            Xem lại
          </Button>
        ),
    },
  ];

  return (
    <section className="roadmap-block roadmap-tone-blue">
      <h2 className="roadmap-block-title">
        <span className="roadmap-block-icon" aria-hidden="true"><History /></span>
        Lịch sử lộ trình
      </h2>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
    </section>
  );
};
