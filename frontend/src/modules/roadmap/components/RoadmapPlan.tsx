import React, { useMemo, useState } from 'react';
import { MapPinned, Plus, Save, Sparkles, Undo2 } from 'lucide-react';
import { Alert, Button } from '../../../components/common';
import { progressOf } from '../roadmap.logic';
import type { Milestone, Roadmap, RoadmapPillar, SoftSkill, Stage } from '../roadmap.types';
import type { AddInitial } from './RoadmapAddDialog';
import { RoadmapDueDialog } from './RoadmapDueDialog';
import { RoadmapOverview } from './RoadmapOverview';
import { RoadmapSide } from './RoadmapSide';
import { RoadmapStageCard, type PendingChange } from './RoadmapStageCard';

interface DueConflict {
  id: string;
  title: string;
  due_date: string;
}

interface Props {
  roadmap: Roadmap;
  stages: Stage[];
  softSkills: SoftSkill[];
  readOnly: boolean;
  busy: boolean;
  monthsLeft: number | null;
  daysLeft: number | null;
  onSave: (changes: Record<string, PendingChange>) => Promise<void>;
  onSuggest: () => void;
  onAdd: (initial: AddInitial) => void;
  onPreviewDue: (id: string, due: string) => Promise<{ conflicts: DueConflict[] }>;
  onApplyDue: (id: string, due: string) => Promise<void>;
  onRegenerate: () => void;
}

/** Lộ trình: tổng quan, các giai đoạn tick hoàn thành tại chỗ, và cột chỉ số bên phải */
export const RoadmapPlan: React.FC<Props> = ({
  roadmap,
  stages,
  softSkills,
  readOnly,
  busy,
  monthsLeft,
  daysLeft,
  onSave,
  onSuggest,
  onAdd,
  onPreviewDue,
  onApplyDue,
  onRegenerate,
}) => {
  const progress = useMemo(() => progressOf(roadmap), [roadmap]);
  const [openKeys, setOpenKeys] = useState<Set<string>>(
    () => new Set(stages.filter((s) => s.status === 'current' || s.status === 'late').map((s) => s.key)),
  );
  const [pending, setPending] = useState<Record<string, PendingChange>>({});
  const [saved, setSaved] = useState<{ from: number; to: number } | null>(null);
  const [dueTarget, setDueTarget] = useState<Milestone | null>(null);
  const pendingCount = Object.keys(pending).length;

  if (stages.length === 0) {
    return (
      <div className="sticker-empty">
        <MapPinned size={40} aria-hidden="true" />
        Chưa có hoạt động
        {!readOnly && (
          <Button leftIcon={<Sparkles size={16} />} onClick={onSuggest}>
            Gợi ý hoạt động
          </Button>
        )}
      </div>
    );
  }

  const currentIndex = Math.max(0, stages.findIndex((s) => s.status === 'current' || s.status === 'late'));
  const ordered = [...stages.slice(currentIndex), ...stages.slice(0, currentIndex)];
  const allOpen = ordered.every((s) => openKeys.has(s.key));

  const toggle = (key: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const pickStage = (key: string) => {
    setOpenKeys((prev) => new Set(prev).add(key));
    window.setTimeout(() => document.getElementById(`stage-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
  };

  const change = (item: Milestone, patch: PendingChange) => {
    setSaved(null);
    setPending((prev) => {
      const merged = { ...prev[item.id], ...patch };
      const next = { ...prev };
      const sameDone = merged.done === undefined || merged.done === item.done;
      const sameNote = merged.note === undefined || merged.note === (item.note ?? '');
      if (sameDone && sameNote) delete next[item.id];
      else next[item.id] = merged;
      return next;
    });
  };

  const save = async () => {
    const from = progress.actualPercent;
    const overrides = Object.fromEntries(Object.entries(pending).filter(([, v]) => v.done !== undefined).map(([id, v]) => [id, v.done as boolean]));
    const to = progressOf(roadmap, overrides).actualPercent;
    await onSave(pending);
    setPending({});
    setSaved({ from: Math.round(from), to: Math.round(to) });
  };

  const addMissing = (stage: Stage, pillar: RoadmapPillar) => onAdd({ kind: 'activity', pillar, due: stage.endIso ?? '' });

  return (
    <div className="roadmap-plan">
      <RoadmapOverview
        roadmap={roadmap}
        stages={stages}
        progress={progress}
        monthsLeft={monthsLeft}
        daysLeft={daysLeft}
        readOnly={readOnly}
        onPickStage={pickStage}
        onRegenerate={onRegenerate}
      />

      <div className="roadmap-map-body">
        <div className="roadmap-stages">
          <div className="roadmap-stages-bar">
            <Button size="sm" variant="ghost" onClick={() => setOpenKeys(allOpen ? new Set() : new Set(ordered.map((s) => s.key)))}>
              {allOpen ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
            </Button>
            {!readOnly && (
              <>
                <Button size="sm" variant="outline" leftIcon={<Sparkles size={14} />} onClick={onSuggest}>
                  Gợi ý hoạt động
                </Button>
                <Button size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => onAdd({ kind: 'activity', pillar: 'knowledge', due: '' })}>
                  Thêm
                </Button>
              </>
            )}
          </div>

          {saved && (
            <Alert variant="success">
              Đã đánh dấu hoàn thành. Tiến độ tổng thể cập nhật từ {saved.from}% lên {saved.to}%.
            </Alert>
          )}

          {ordered.map((stage) => (
            <RoadmapStageCard
              key={stage.key}
              stage={stage}
              open={openKeys.has(stage.key)}
              readOnly={readOnly}
              busy={busy}
              pending={pending}
              onToggle={() => toggle(stage.key)}
              onChange={change}
              onEditDue={setDueTarget}
              onAddMissing={addMissing}
            />
          ))}
        </div>

        <RoadmapSide
          roadmap={roadmap}
          stages={stages}
          softSkills={softSkills}
          byPillar={progress.byPillar}
          actualPercent={progress.actualPercent}
          plannedPercent={progress.plannedPercent}
          readOnly={readOnly}
          onAddCheckpoint={() => onAdd({ kind: 'checkpoint', pillar: 'exploration', due: '' })}
        />
      </div>

      {!readOnly && pendingCount > 0 && (
        <div className="roadmap-save-bar" role="region" aria-label="Cập nhật chưa lưu">
          <span><b>{pendingCount}</b> thay đổi chưa lưu</span>
          <div className="roadmap-save-actions">
            <Button variant="outline" leftIcon={<Undo2 size={16} />} disabled={busy} onClick={() => setPending({})}>
              Hoàn tác
            </Button>
            <Button leftIcon={<Save size={16} />} isLoading={busy} onClick={() => void save()}>
              Lưu cập nhật
            </Button>
          </div>
        </div>
      )}

      {dueTarget && (
        <RoadmapDueDialog
          key={dueTarget.id}
          milestone={dueTarget}
          busy={busy}
          onClose={() => setDueTarget(null)}
          onPreviewDue={onPreviewDue}
          onApplyDue={onApplyDue}
        />
      )}
    </div>
  );
};
