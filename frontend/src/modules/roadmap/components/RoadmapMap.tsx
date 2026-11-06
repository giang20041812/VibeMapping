import React, { useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, Flag, MapPinned, Plus, Sparkles } from 'lucide-react';
import { Alert, Badge, Button, ProgressBar } from '../../../components/common';
import { PILLAR_LABEL, PILLAR_ORDER, formatDate } from '../roadmap.logic';
import type { Roadmap, RoadmapPillar, Stage, StageStatus } from '../roadmap.types';
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

/** Số giai đoạn hiển thị sẵn; các giai đoạn còn lại thu gọn sau khung nét đứt */
const VISIBLE_STAGES = 3;

interface Props {
  roadmap: Roadmap;
  stages: Stage[];
  readOnly: boolean;
  onSuggest: () => void;
  onAddToStage: (stage: Stage, pillar: RoadmapPillar) => void;
}

/** Bản đồ đường đi: xuất phát → các giai đoạn → mục tiêu, cùng thẻ giai đoạn và cân đối ba trụ cột */
export const RoadmapMap: React.FC<Props> = ({ roadmap, stages, readOnly, onSuggest, onAddToStage }) => {
  const [expanded, setExpanded] = useState(false);

  const pillarShare = useMemo(() => {
    const total = roadmap.milestones.reduce((s, m) => s + (Number(m.weight) || 1), 0);
    return PILLAR_ORDER.map((pillar) => {
      const w = roadmap.milestones.filter((m) => m.pillar === pillar).reduce((s, m) => s + (Number(m.weight) || 1), 0);
      return { pillar, percent: total > 0 ? Math.round((w / total) * 100) : 0 };
    });
  }, [roadmap.milestones]);

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
  const shown = expanded ? ordered : ordered.slice(0, VISIBLE_STAGES);
  const hidden = ordered.length - shown.length;
  const start = [roadmap.education_level, roadmap.school_year].filter(Boolean).join(' · ') || 'Điểm xuất phát';

  return (
    <div className="roadmap-map">
      <ol className="roadmap-path" aria-label="Bản đồ đường đi">
        <li className="roadmap-node is-start">
          <span className="roadmap-node-dot" aria-hidden="true" />
          <b>Xuất phát</b>
          <small>{start}</small>
        </li>
        {stages.map((stage) => (
          <li key={stage.key} className={`roadmap-node is-${stage.status}`}>
            <span className="roadmap-node-dot" aria-hidden="true" />
            <b>{stage.key === 'none' ? 'Chưa hạn' : `T${stage.key.slice(5, 7)}/${stage.key.slice(2, 4)}`}</b>
            <small>{STATUS_LABEL[stage.status]}</small>
          </li>
        ))}
        <li className="roadmap-node is-goal">
          <span className="roadmap-node-dot" aria-hidden="true"><Flag size={14} /></span>
          <b>Mục tiêu</b>
          <small>{[roadmap.career_name, roadmap.program_title, roadmap.target_date ? formatDate(roadmap.target_date) : null].filter(Boolean).join(' · ')}</small>
        </li>
      </ol>

      <div className="roadmap-map-body">
        <div className="roadmap-stages">
          {shown.map((stage) => (
            <article key={stage.key} className={`roadmap-stage is-${stage.status}`}>
              <header className="roadmap-stage-head">
                <h3>
                  <CalendarClock size={18} aria-hidden="true" />
                  {stage.label}
                </h3>
                <Badge variant={STATUS_VARIANT[stage.status]}>{STATUS_LABEL[stage.status]}</Badge>
                <span className="roadmap-stage-percent">{stage.actualPercent}%</span>
              </header>
              <ProgressBar value={stage.actualPercent} label={`Hoàn thành ${stage.label}`} />
              <ul className="roadmap-activities">
                {stage.items.map((item) => (
                  <li key={item.id} className={item.done ? 'is-done' : undefined}>
                    <PillarBadge pillar={item.pillar} />
                    <span className="roadmap-activity-title">{item.title}</span>
                    {item.is_checkpoint && (
                      <Badge variant="warning" size="sm">Cột mốc</Badge>
                    )}
                    {item.due_date && <span className="roadmap-activity-due">Hạn {formatDate(item.due_date)}</span>}
                  </li>
                ))}
              </ul>
              {!readOnly && stage.missingPillars.length > 0 && stage.status !== 'done' && (
                <div className="roadmap-missing">
                  <Alert variant="warning">
                    Giai đoạn này còn thiếu trụ cột {stage.missingPillars.map((p) => PILLAR_LABEL[p]).join(', ')}.
                  </Alert>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<Plus size={14} />}
                    onClick={() => onAddToStage(stage, stage.missingPillars[0])}
                  >
                    Thêm hoạt động gợi ý
                  </Button>
                </div>
              )}
            </article>
          ))}
          {hidden > 0 && (
            <button type="button" className="roadmap-more" onClick={() => setExpanded(true)}>
              Còn {hidden} giai đoạn · Mở rộng
              <ChevronDown size={18} aria-hidden="true" />
            </button>
          )}
          {expanded && ordered.length > VISIBLE_STAGES && (
            <button type="button" className="roadmap-more" onClick={() => setExpanded(false)}>
              Thu gọn
            </button>
          )}
        </div>

        <aside className="roadmap-side" aria-label="Cân đối ba trụ cột">
          <section className="roadmap-block roadmap-tone-violet">
            <h2 className="roadmap-block-title">Cân đối ba trụ cột</h2>
            <ul className="roadmap-balance">
              {pillarShare.map((p) => (
                <li key={p.pillar}>
                  <div className="roadmap-balance-head">
                    <PillarBadge pillar={p.pillar} />
                    <b>{p.percent}%</b>
                  </div>
                  <ProgressBar value={p.percent} label={`Tỷ trọng ${PILLAR_LABEL[p.pillar]}`} />
                </li>
              ))}
            </ul>
          </section>
          {!readOnly && (
            <Button variant="outline" leftIcon={<Sparkles size={16} />} onClick={onSuggest}>
              Gợi ý hoạt động
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
};
