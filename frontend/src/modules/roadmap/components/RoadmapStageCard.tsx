import React from 'react';
import { CalendarClock, CalendarCog, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Badge, Button, Checkbox, ProgressBar, Textarea } from '../../../components/common';
import { ACTIVITY_TYPE_LABEL, PILLAR_LABEL, formatDate } from '../roadmap.logic';
import type { Milestone, RoadmapPillar, Stage, StageStatus } from '../roadmap.types';
import { PillarBadge } from './PillarBadge';

const STATUS_LABEL: Record<StageStatus, string> = {
  done: 'Đã xong',
  current: 'Đang thực hiện',
  late: 'Trễ hạn',
  upcoming: 'Sắp tới',
};
const STATUS_VARIANT: Record<StageStatus, 'success' | 'info' | 'danger' | 'default'> = {
  done: 'success',
  current: 'info',
  late: 'danger',
  upcoming: 'default',
};

/** Kết quả kỳ vọng của giai đoạn: gộp kết quả của các hoạt động trong giai đoạn */
const expectedOf = (stage: Stage) =>
  [...new Set(stage.items.map((i) => i.expected_result).filter(Boolean))].join('; ');

export interface PendingChange {
  done?: boolean;
  note?: string;
}

interface Props {
  stage: Stage;
  open: boolean;
  readOnly: boolean;
  busy: boolean;
  pending: Record<string, PendingChange>;
  onToggle: () => void;
  onChange: (item: Milestone, patch: PendingChange) => void;
  onEditDue: (item: Milestone) => void;
  onAddMissing: (stage: Stage, pillar: RoadmapPillar) => void;
}

/** Thẻ giai đoạn: thu gọn còn một dòng, mở ra thì tick hoàn thành ngay trên từng hoạt động */
export const RoadmapStageCard: React.FC<Props> = ({ stage, open, readOnly, busy, pending, onToggle, onChange, onEditDue, onAddMissing }) => {
  const doneCount = stage.items.filter((m) => pending[m.id]?.done ?? m.done).length;
  const dues = [...new Set(stage.items.map((m) => m.due_date).filter(Boolean))] as string[];
  const sharedDue = dues.length === 1 && stage.items.every((m) => m.due_date) ? dues[0] : null;
  const expected = expectedOf(stage);

  if (!open) {
    return (
      <article id={`stage-${stage.key}`} className={`roadmap-stage is-collapsed is-${stage.status}`}>
        <button type="button" className="roadmap-stage-toggle" aria-expanded="false" onClick={onToggle}>
          <ChevronRight size={18} aria-hidden="true" />
          <span className="roadmap-stage-name">{stage.label}</span>
          <Badge variant={STATUS_VARIANT[stage.status]} size="sm">{STATUS_LABEL[stage.status]}</Badge>
          <span className="roadmap-stage-count">{doneCount}/{stage.items.length} hoạt động</span>
          <span className="roadmap-stage-percent">{stage.actualPercent}%</span>
        </button>
      </article>
    );
  }

  return (
    <article id={`stage-${stage.key}`} className={`roadmap-stage is-${stage.status}`}>
      <header className="roadmap-stage-head">
        <button type="button" className="roadmap-stage-toggle" aria-expanded="true" onClick={onToggle}>
          <CalendarClock size={18} aria-hidden="true" />
          <span className="roadmap-stage-name">{stage.label}</span>
          <Badge variant={STATUS_VARIANT[stage.status]} size="sm">{STATUS_LABEL[stage.status]}</Badge>
          {sharedDue && <span className="roadmap-stage-count">Hạn {formatDate(sharedDue)}</span>}
          <span className="roadmap-stage-count">{doneCount}/{stage.items.length}</span>
          <span className="roadmap-stage-percent">{stage.actualPercent}%</span>
          <ChevronDown size={18} aria-hidden="true" />
        </button>
        <ProgressBar value={stage.actualPercent} label={`Hoàn thành ${stage.label}`} />
      </header>

      <ul className="roadmap-activities">
        {stage.items.map((item) => {
          const checked = pending[item.id]?.done ?? item.done;
          const note = pending[item.id]?.note ?? item.note ?? '';
          return (
            <li key={item.id} className={checked ? 'is-done' : undefined}>
              <div className="roadmap-activity-line">
                <PillarBadge pillar={item.pillar} />
                <Checkbox
                  className="roadmap-activity-check"
                  label={item.title}
                  checked={checked}
                  disabled={readOnly || busy}
                  onChange={(value) => onChange(item, { done: value })}
                />
                {item.activity_type && <Badge size="sm">{ACTIVITY_TYPE_LABEL[item.activity_type]}</Badge>}
                {item.is_partner && <Badge variant="warning" size="sm">Quảng cáo/Đối tác</Badge>}
                {item.is_checkpoint && <Badge variant="warning" size="sm">Cột mốc</Badge>}
                {!sharedDue && item.due_date && <span className="roadmap-activity-due">Hạn {formatDate(item.due_date)}</span>}
                {!readOnly && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="roadmap-activity-edit"
                    aria-label={`Đổi hạn: ${item.title}`}
                    title="Đổi hạn"
                    disabled={busy}
                    onClick={() => onEditDue(item)}
                  >
                    <CalendarCog size={16} aria-hidden="true" />
                  </Button>
                )}
              </div>
              {checked && (
                <Textarea
                  className="roadmap-note"
                  label="Ghi chú kết quả"
                  rows={2}
                  value={note}
                  disabled={readOnly || busy}
                  onChange={(event) => onChange(item, { note: event.target.value })}
                />
              )}
            </li>
          );
        })}
      </ul>

      {expected && (
        <p className="roadmap-expected">
          <b>Kết quả kỳ vọng:</b> {expected}
        </p>
      )}

      {!readOnly && stage.missingPillars.length > 0 && stage.status !== 'done' && (
        <div className="roadmap-missing">
          <span>Còn thiếu trụ cột {stage.missingPillars.map((p) => PILLAR_LABEL[p]).join(', ')}</span>
          <Button size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => onAddMissing(stage, stage.missingPillars[0])}>
            Thêm hoạt động
          </Button>
        </div>
      )}
    </article>
  );
};
