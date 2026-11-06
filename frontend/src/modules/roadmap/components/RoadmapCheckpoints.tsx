import React, { useState } from 'react';
import { Flag, Plus } from 'lucide-react';
import { Badge, Button, DataTable, Input, Select, type DataTableColumn } from '../../../components/common';
import { PILLAR_LABEL, PILLAR_ORDER, formatDate, stageLabel } from '../roadmap.logic';
import type { Milestone, RoadmapPillar } from '../roadmap.types';

interface Props {
  checkpoints: Milestone[];
  readOnly: boolean;
  busy: boolean;
  onAdd: (values: { title: string; due: string; pillar: RoadmapPillar }) => Promise<void>;
}

function statusOf(m: Milestone, today: string): { label: string; variant: 'success' | 'danger' | 'default' } {
  if (m.done) return { label: 'Hoàn thành', variant: 'success' };
  if (m.due_date && m.due_date < today) return { label: 'Quá hạn', variant: 'danger' };
  return { label: 'Chưa đến hạn', variant: 'default' };
}

const PILLAR_OPTIONS = PILLAR_ORDER.map((value) => ({ value, label: PILLAR_LABEL[value] }));

/** Danh sách cột mốc và thêm cột mốc riêng */
export const RoadmapCheckpoints: React.FC<Props> = ({ checkpoints, readOnly, busy, onAdd }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ title: '', due: '', pillar: 'exploration' as RoadmapPillar });

  const columns: DataTableColumn<Milestone>[] = [
    { key: 'title', header: 'Cột mốc', align: 'left', render: (m) => <strong>{m.title}</strong> },
    { key: 'stage', header: 'Giai đoạn', nowrap: true, render: (m) => (m.due_date ? stageLabel(m.due_date.slice(0, 7)) : '') },
    { key: 'due', header: 'Hạn', nowrap: true, render: (m) => formatDate(m.due_date) },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (m) => {
        const status = statusOf(m, today);
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
  ];

  const submit = async () => {
    await onAdd(form);
    setForm({ ...form, title: '', due: '' });
  };

  return (
    <div className="roadmap-columns">
      <section className="roadmap-block roadmap-tone-gold">
        <h2 className="roadmap-block-title">
          <span className="roadmap-block-icon" aria-hidden="true"><Flag /></span>
          Danh sách cột mốc
        </h2>
        <DataTable columns={columns} rows={checkpoints} rowKey={(m) => m.id} emptyText="Chưa có cột mốc" />
      </section>

      {!readOnly && (
        <section className="roadmap-block roadmap-tone-teal">
          <h2 className="roadmap-block-title">Thêm cột mốc riêng</h2>
          <div className="roadmap-fields is-single">
            <Input label="Tên cột mốc" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input label="Hạn" required type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
            <Select label="Trụ cột" options={PILLAR_OPTIONS} value={form.pillar} onChange={(value) => setForm({ ...form, pillar: value as RoadmapPillar })} />
            <Button
              leftIcon={<Plus size={16} />}
              isLoading={busy}
              disabled={!form.title.trim() || !form.due}
              onClick={() => void submit()}
            >
              Thêm cột mốc
            </Button>
          </div>
        </section>
      )}
    </div>
  );
};
