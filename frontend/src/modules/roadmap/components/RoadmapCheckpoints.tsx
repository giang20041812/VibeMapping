import React, { useState } from 'react';
import { CalendarClock, Flag, Plus } from 'lucide-react';
import { Alert, Badge, Button, DataTable, Input, Select, Textarea, type DataTableColumn } from '../../../components/common';
import { PILLAR_LABEL, PILLAR_ORDER, formatDate, stageLabel } from '../roadmap.logic';
import type { Milestone, RoadmapPillar } from '../roadmap.types';

interface DueConflict {
  id: string;
  title: string;
  due_date: string;
}

interface Props {
  checkpoints: Milestone[];
  activities: Milestone[];
  readOnly: boolean;
  busy: boolean;
  onAdd: (values: { title: string; due: string; pillar: RoadmapPillar; passCriteria: string }) => Promise<void>;
  onPreviewDue: (id: string, due: string) => Promise<{ conflicts: DueConflict[] }>;
  onApplyDue: (id: string, due: string) => Promise<void>;
}

function statusOf(m: Milestone, today: string): { label: string; variant: 'success' | 'danger' | 'default' } {
  if (m.done) return { label: 'Hoàn thành', variant: 'success' };
  if (m.due_date && m.due_date < today) return { label: 'Quá hạn', variant: 'danger' };
  return { label: 'Chưa đến hạn', variant: 'default' };
}

const PILLAR_OPTIONS = PILLAR_ORDER.map((value) => ({ value, label: PILLAR_LABEL[value] }));

/** Cột mốc, thời hạn hoạt động (sửa được, báo cột mốc bị ảnh hưởng) và thêm cột mốc riêng */
export const RoadmapCheckpoints: React.FC<Props> = ({ checkpoints, activities, readOnly, busy, onAdd, onPreviewDue, onApplyDue }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ title: '', due: '', pillar: 'exploration' as RoadmapPillar, passCriteria: '' });
  const [pendingDue, setPendingDue] = useState<{ id: string; title: string; value: string; conflicts: DueConflict[] } | null>(null);
  const [dueError, setDueError] = useState(false);

  const nextCheckpoint = (m: Milestone) =>
    checkpoints.find((c) => c.id !== m.id && c.due_date && m.due_date && c.due_date >= m.due_date)?.title ?? '';

  const changeDue = async (m: Milestone, value: string) => {
    setDueError(false);
    if (!value || value === m.due_date) return;
    try {
      const { conflicts } = await onPreviewDue(m.id, value);
      if (conflicts.length > 0) setPendingDue({ id: m.id, title: m.title, value, conflicts });
      else {
        setPendingDue(null);
        await onApplyDue(m.id, value);
      }
    } catch {
      setDueError(true);
    }
  };

  const checkpointColumns: DataTableColumn<Milestone>[] = [
    { key: 'title', header: 'Cột mốc', align: 'left', render: (m) => <strong>{m.title}</strong> },
    {
      key: 'source',
      header: 'Nguồn',
      nowrap: true,
      render: (m) => (m.source === 'user' ? <Badge variant="info" size="sm">Của bạn</Badge> : <Badge size="sm">Tự động</Badge>),
    },
    { key: 'due', header: 'Hạn', nowrap: true, render: (m) => formatDate(m.due_date) },
    {
      key: 'criteria',
      header: 'Tiêu chí đạt / chưa đạt',
      align: 'left',
      render: (m) => (
        <>
          {m.pass_criteria && <div><b>Đạt:</b> {m.pass_criteria}</div>}
          {m.fail_criteria && <div><b>Chưa đạt:</b> {m.fail_criteria}</div>}
        </>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (m) => {
        const status = statusOf(m, today);
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
  ];

  const dueColumns: DataTableColumn<Milestone>[] = [
    { key: 'title', header: 'Hoạt động', align: 'left', render: (m) => m.title },
    { key: 'stage', header: 'Giai đoạn', nowrap: true, render: (m) => (m.due_date ? stageLabel(m.due_date.slice(0, 7)) : '') },
    { key: 'next', header: 'Cột mốc liên quan', align: 'left', render: nextCheckpoint },
    {
      key: 'due',
      header: 'Hạn',
      nowrap: true,
      render: (m) =>
        readOnly ? (
          formatDate(m.due_date)
        ) : (
          <Input
            type="date"
            aria-label={`Hạn của ${m.title}`}
            value={pendingDue?.id === m.id ? pendingDue.value : (m.due_date ?? '')}
            disabled={busy}
            onChange={(event) => void changeDue(m, event.target.value)}
          />
        ),
    },
  ];

  const submit = async () => {
    await onAdd(form);
    setForm({ ...form, title: '', due: '', passCriteria: '' });
  };

  const plain = activities.filter((m) => !m.is_checkpoint);

  return (
    <div className="roadmap-columns">
      <div className="roadmap-stack">
        <section className="roadmap-block roadmap-tone-gold">
          <h2 className="roadmap-block-title">
            <span className="roadmap-block-icon" aria-hidden="true"><Flag /></span>
            Danh sách cột mốc
          </h2>
          <DataTable columns={checkpointColumns} rows={checkpoints} rowKey={(m) => m.id} emptyText="Chưa có cột mốc" />
        </section>

        <section className="roadmap-block roadmap-tone-blue">
          <h2 className="roadmap-block-title">
            <span className="roadmap-block-icon" aria-hidden="true"><CalendarClock /></span>
            Thời hạn hoạt động
          </h2>
          {dueError && <Alert variant="danger">Không đổi được hạn. Thử lại sau.</Alert>}
          {pendingDue && (
            <div className="roadmap-swap">
              <Alert variant="warning" title="Hạn mới ảnh hưởng cột mốc khác.">
                {pendingDue.title} · hạn mới {formatDate(pendingDue.value)} · cột mốc bị ảnh hưởng:{' '}
                {pendingDue.conflicts.map((c) => `${c.title} (${formatDate(c.due_date)})`).join(', ')}
              </Alert>
              <div className="roadmap-swap-actions">
                <Button
                  size="sm"
                  isLoading={busy}
                  onClick={() => {
                    const current = pendingDue;
                    setPendingDue(null);
                    void onApplyDue(current.id, current.value);
                  }}
                >
                  Giữ thay đổi
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPendingDue(null)}>
                  Hoàn tác
                </Button>
              </div>
            </div>
          )}
          <DataTable columns={dueColumns} rows={plain} rowKey={(m) => m.id} emptyText="Chưa có hoạt động" />
        </section>
      </div>

      {!readOnly && (
        <section className="roadmap-block roadmap-tone-teal">
          <h2 className="roadmap-block-title">Thêm cột mốc riêng</h2>
          <div className="roadmap-fields is-single">
            <Input label="Tên cột mốc" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input label="Hạn" required type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
            <Select label="Trụ cột" options={PILLAR_OPTIONS} value={form.pillar} onChange={(value) => setForm({ ...form, pillar: value as RoadmapPillar })} />
            <Textarea label="Tiêu chí đạt" rows={3} value={form.passCriteria} onChange={(e) => setForm({ ...form, passCriteria: e.target.value })} />
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
