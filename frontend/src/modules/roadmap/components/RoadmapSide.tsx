import React, { useMemo } from 'react';
import { Flag, Plus } from 'lucide-react';
import { Badge, Button, ProgressBar } from '../../../components/common';
import { PILLAR_LABEL, PILLAR_ORDER, formatDate } from '../roadmap.logic';
import type { Milestone, Roadmap, SoftSkill, Stage } from '../roadmap.types';
import { PillarBadge } from './PillarBadge';

const SOFT_SKILL_LIMIT = 3;

interface Props {
  roadmap: Roadmap;
  stages: Stage[];
  softSkills: SoftSkill[];
  byPillar: { pillar: Milestone['pillar']; total: number; done: number }[];
  actualPercent: number;
  plannedPercent: number;
  readOnly: boolean;
  onAddCheckpoint: () => void;
}

function checkpointStatus(m: Milestone, today: string): { label: string; variant: 'success' | 'danger' | 'default' } {
  if (m.done) return { label: 'Hoàn thành', variant: 'success' };
  if (m.due_date && m.due_date < today) return { label: 'Quá hạn', variant: 'danger' };
  return { label: 'Chưa đến hạn', variant: 'default' };
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Cột phải: cân đối ba trụ cột, kỹ năng mềm cần rèn, cột mốc, kế hoạch so với thực tế */
export const RoadmapSide: React.FC<Props> = ({ roadmap, stages, softSkills, byPillar, actualPercent, plannedPercent, readOnly, onAddCheckpoint }) => {
  const today = new Date().toISOString().slice(0, 10);

  const share = useMemo(() => {
    const total = roadmap.milestones.reduce((s, m) => s + (Number(m.weight) || 1), 0);
    return PILLAR_ORDER.map((pillar) => {
      const w = roadmap.milestones.filter((m) => m.pillar === pillar).reduce((s, m) => s + (Number(m.weight) || 1), 0);
      return { pillar, percent: total > 0 ? Math.round((w / total) * 100) : 0 };
    });
  }, [roadmap.milestones]);

  const checkpoints = useMemo(
    () => roadmap.milestones.filter((m) => m.is_checkpoint).sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')),
    [roadmap.milestones],
  );

  const diff = Math.round(actualPercent - plannedPercent);

  return (
    <aside className="roadmap-side" aria-label="Chỉ số lộ trình">
      <section className="roadmap-block roadmap-tone-violet">
        <h2 className="roadmap-block-title">Cân đối ba trụ cột</h2>
        <div
          className="roadmap-stack-bar"
          role="img"
          aria-label={share.map((p) => `${PILLAR_LABEL[p.pillar]} ${p.percent}%`).join(', ')}
        >
          {share.map((p) => (
            <span key={p.pillar} className={`pillar-${p.pillar}`} style={{ flexGrow: p.percent }} title={`${PILLAR_LABEL[p.pillar]} ${p.percent}%`} />
          ))}
        </div>
        <ul className="roadmap-balance">
          {share.map((p) => {
            const progress = byPillar.find((b) => b.pillar === p.pillar);
            return (
              <li key={p.pillar}>
                <div className="roadmap-balance-head">
                  <PillarBadge pillar={p.pillar} />
                  <span>{progress?.done ?? 0}/{progress?.total ?? 0} xong</span>
                  <b>{p.percent}%</b>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {softSkills.length > 0 && (
        <section className="roadmap-block roadmap-tone-gold">
          <h2 className="roadmap-block-title">Kỹ năng mềm cần rèn</h2>
          <ul className="roadmap-balance">
            {softSkills.slice(0, SOFT_SKILL_LIMIT).map((skill) => (
              <li key={skill.criteria_id}>
                <div className="roadmap-balance-head">
                  <strong>{skill.name}</strong>
                  {skill.reasons.includes('low') && <Badge variant="warning" size="sm">Điểm thấp</Badge>}
                  {skill.reasons.includes('gap') && (
                    <span title={`Lệch ${Math.round(skill.gap ?? 0)} điểm giữa tự đánh giá và người khác`}>
                      <Badge variant="info" size="sm">Lệch {Math.round(skill.gap ?? 0)}</Badge>
                    </span>
                  )}
                  <b>{skill.score_percent === null ? '—' : `${Math.round(skill.score_percent)}%`}</b>
                </div>
                <ProgressBar value={skill.score_percent} label={`Điểm ${skill.name}`} tone="accent" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="roadmap-block roadmap-tone-teal">
        <h2 className="roadmap-block-title">
          <span className="roadmap-block-icon" aria-hidden="true"><Flag /></span>
          Cột mốc
          {!readOnly && (
            <Button size="sm" variant="outline" className="roadmap-block-action" leftIcon={<Plus size={14} />} onClick={onAddCheckpoint}>
              Thêm
            </Button>
          )}
        </h2>
        {checkpoints.length === 0 ? (
          <p className="roadmap-empty-line">Chưa có cột mốc</p>
        ) : (
          <ul className="roadmap-checkpoints">
            {checkpoints.map((m) => {
              const status = checkpointStatus(m, today);
              return (
                <li key={m.id}>
                  <div className="roadmap-checkpoint-head">
                    <strong>{m.title}</strong>
                    <Badge variant={status.variant} size="sm">{status.label}</Badge>
                  </div>
                  <small>
                    {m.due_date ? `Hạn ${formatDate(m.due_date)}` : 'Chưa có hạn'}
                    {m.source === 'user' && ' · Của bạn'}
                    {m.pass_criteria && ` · Đạt: ${m.pass_criteria}`}
                  </small>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="roadmap-block roadmap-tone-blue">
        <h2 className="roadmap-block-title">Kế hoạch so với thực tế</h2>
        <p className="roadmap-compare-sum">
          Thực tế {Math.round(actualPercent)}% · Kế hoạch {Math.round(plannedPercent)}%{' '}
          <span className={diff < 0 ? 'roadmap-diff is-behind' : 'roadmap-diff'}>({signed(diff)})</span>
        </p>
        <div className="roadmap-compare-chart" role="img" aria-label="Biểu đồ so sánh kế hoạch và thực tế theo giai đoạn">
          {stages.map((s) => (
            <div key={s.key} className="roadmap-compare-col">
              <div className="roadmap-compare-bars">
                <span className="is-plan" style={{ '--h': `${s.plannedPercent}%` } as React.CSSProperties} title={`${s.label}: kế hoạch ${s.plannedPercent}%`} />
                <span className="is-actual" style={{ '--h': `${s.actualPercent}%` } as React.CSSProperties} title={`${s.label}: thực tế ${s.actualPercent}%`} />
              </div>
              <small>{s.key === 'none' ? '—' : `T${s.key.slice(5, 7)}`}</small>
            </div>
          ))}
        </div>
        <div className="roadmap-legend">
          <span><i className="is-plan" aria-hidden="true" /> Kế hoạch</span>
          <span><i className="is-actual" aria-hidden="true" /> Thực tế</span>
        </div>
      </section>
    </aside>
  );
};
