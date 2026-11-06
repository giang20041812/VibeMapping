import React from 'react';
import { History, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge, Button, DataTable, type DataTableColumn } from '../../../components/common';
import { formatDate } from '../roadmap.logic';
import type { Roadmap } from '../roadmap.types';

interface Props {
  roadmap: Roadmap;
  history: Roadmap[];
  progress: { offTrack: boolean; delayPercent: number; missedCheckpoints: { id: string; title: string }[] };
  viewingId: string | null;
  onRegenerate: () => void;
  onView: (id: string) => void;
  onBackToActive: () => void;
}

/** Cảnh báo chệch hướng kèm nguyên nhân, nút tạo lại, và lịch sử lộ trình */
export const RoadmapAlerts: React.FC<Props> = ({ roadmap, history, progress, viewingId, onRegenerate, onView, onBackToActive }) => {
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
    <div className="roadmap-stack">
      {progress.offTrack ? (
        <section className="roadmap-banner is-danger" role="alert">
          <ShieldAlert size={32} aria-hidden="true" />
          <div>
            <h2>Lộ trình của bạn đang chệch hướng</h2>
            <ul>
              {progress.delayPercent > 20 && <li>Chậm tiến độ {Math.round(progress.delayPercent)} điểm phần trăm so với kế hoạch, vượt mức 20.</li>}
              {progress.missedCheckpoints.map((m) => (
                <li key={m.id}>Trễ cột mốc quan trọng: {m.title}</li>
              ))}
            </ul>
          </div>
          <Button leftIcon={<RefreshCw size={16} />} onClick={onRegenerate}>
            Tạo lại lộ trình
          </Button>
        </section>
      ) : (
        <section className="roadmap-banner is-ok">
          <ShieldCheck size={32} aria-hidden="true" />
          <div>
            <h2>Lộ trình đang đúng hướng</h2>
          </div>
          <Button variant="outline" leftIcon={<RefreshCw size={16} />} onClick={onRegenerate}>
            Tạo lại lộ trình
          </Button>
        </section>
      )}

      <section className="roadmap-block roadmap-tone-blue">
        <h2 className="roadmap-block-title">
          <span className="roadmap-block-icon" aria-hidden="true"><History /></span>
          Lịch sử lộ trình
        </h2>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
      </section>
    </div>
  );
};
