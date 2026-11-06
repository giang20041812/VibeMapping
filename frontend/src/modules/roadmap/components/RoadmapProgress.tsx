import React, { useMemo, useState } from 'react';
import { ListChecks, Save } from 'lucide-react';
import { Alert, Button, Checkbox, DataTable, ProgressBar, Select, type DataTableColumn } from '../../../components/common';
import { PILLAR_LABEL, formatDate, progressOf } from '../roadmap.logic';
import type { Roadmap, Stage } from '../roadmap.types';
import { PillarBadge } from './PillarBadge';

interface Props {
  roadmap: Roadmap;
  stages: Stage[];
  focusKey: string;
  readOnly: boolean;
  busy: boolean;
  onSave: (changes: Record<string, boolean>) => Promise<void>;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Tiến độ: tick hoàn thành nhiều hoạt động rồi lưu một lần; so sánh kế hoạch với thực tế theo giai đoạn */
export const RoadmapProgress: React.FC<Props> = ({ roadmap, stages, focusKey, readOnly, busy, onSave }) => {
  const [stageKey, setStageKey] = useState(focusKey);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<{ from: number; to: number } | null>(null);

  const progress = useMemo(() => progressOf(roadmap), [roadmap]);
  const stage = stages.find((s) => s.key === stageKey) ?? stages[0];
  const pendingCount = Object.keys(pending).length;

  const toggle = (id: string, done: boolean, original: boolean) => {
    setSaved(null);
    setPending((prev) => {
      const next = { ...prev };
      if (done === original) delete next[id];
      else next[id] = done;
      return next;
    });
  };

  const save = async () => {
    const from = progress.actualPercent;
    const to = progressOf(roadmap, pending).actualPercent;
    await onSave(pending);
    setPending({});
    setSaved({ from: Math.round(from), to: Math.round(to) });
  };

  const rows = stages.map((s) => ({ ...s, diff: s.actualPercent - s.plannedPercent }));
  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    { key: 'stage', header: 'Giai đoạn', nowrap: true, render: (s) => s.label },
    { key: 'plan', header: 'Kế hoạch', nowrap: true, render: (s) => `${s.plannedPercent}%` },
    { key: 'actual', header: 'Thực tế', nowrap: true, render: (s) => `${s.actualPercent}%` },
    {
      key: 'diff',
      header: 'Chênh lệch',
      nowrap: true,
      render: (s) => <span className={s.diff < 0 ? 'roadmap-diff is-behind' : 'roadmap-diff'}>{signed(s.diff)}</span>,
    },
  ];

  return (
    <div className="roadmap-columns">
      <section className="roadmap-block roadmap-tone-blue">
        <h2 className="roadmap-block-title">
          <span className="roadmap-block-icon" aria-hidden="true"><ListChecks /></span>
          Hoạt động
        </h2>
        {stage ? (
          <>
            <Select
              label="Giai đoạn"
              options={stages.map((s) => ({ value: s.key, label: s.label }))}
              value={stage.key}
              onChange={(value) => {
                setStageKey(value);
                setSaved(null);
              }}
            />
            <ul className="roadmap-checklist">
              {stage.items.map((item) => {
                const checked = pending[item.id] ?? item.done;
                return (
                  <li key={item.id} className={checked ? 'is-done' : undefined}>
                    <Checkbox
                      label={item.title}
                      checked={checked}
                      disabled={readOnly || busy}
                      onChange={(value) => toggle(item.id, value, item.done)}
                    />
                    <PillarBadge pillar={item.pillar} />
                    {item.due_date && <span className="roadmap-activity-due">Hạn {formatDate(item.due_date)}</span>}
                  </li>
                );
              })}
            </ul>
            {!readOnly && (
              <div className="roadmap-form-actions">
                {saved && (
                  <Alert variant="success">
                    Đã đánh dấu hoàn thành. Tiến độ tổng thể cập nhật từ {saved.from}% lên {saved.to}%.
                  </Alert>
                )}
                <Button leftIcon={<Save size={16} />} isLoading={busy} disabled={pendingCount === 0} onClick={() => void save()}>
                  Lưu cập nhật
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="sticker-empty">Chưa có hoạt động</div>
        )}
      </section>

      <div className="roadmap-stack">
        <section className="roadmap-block roadmap-tone-gold">
          <h2 className="roadmap-block-title">Tiến độ theo trụ cột</h2>
          <ul className="roadmap-balance">
            {progress.byPillar.map((p) => (
              <li key={p.pillar}>
                <div className="roadmap-balance-head">
                  <PillarBadge pillar={p.pillar} />
                  <span>{p.done}/{p.total} hoạt động</span>
                  <b>{p.percent === null ? '—' : `${Math.round(p.percent)}%`}</b>
                </div>
                <ProgressBar value={p.percent} label={`Hoàn thành ${PILLAR_LABEL[p.pillar]}`} />
              </li>
            ))}
          </ul>
        </section>

        <section className="roadmap-block roadmap-tone-violet">
          <h2 className="roadmap-block-title">Kế hoạch so với thực tế</h2>
          <div className="roadmap-compare-chart" role="img" aria-label="Biểu đồ so sánh kế hoạch và thực tế theo giai đoạn">
            {stages.map((s) => (
              <div key={s.key} className="roadmap-compare-col">
                <div className="roadmap-compare-bars">
                  <span className="is-plan" style={{ '--h': `${s.plannedPercent}%` } as React.CSSProperties} title={`Kế hoạch ${s.plannedPercent}%`} />
                  <span className="is-actual" style={{ '--h': `${s.actualPercent}%` } as React.CSSProperties} title={`Thực tế ${s.actualPercent}%`} />
                </div>
                <small>{s.key === 'none' ? '—' : `T${s.key.slice(5, 7)}`}</small>
              </div>
            ))}
          </div>
          <div className="roadmap-legend">
            <span><i className="is-plan" aria-hidden="true" /> Kế hoạch</span>
            <span><i className="is-actual" aria-hidden="true" /> Thực tế</span>
          </div>
          <DataTable columns={columns} rows={rows} rowKey={(s) => s.key} emptyText="Chưa có giai đoạn" />
        </section>
      </div>
    </div>
  );
};
