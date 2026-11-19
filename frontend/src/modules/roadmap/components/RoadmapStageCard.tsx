import React, { useState } from 'react';
import { CalendarClock, CalendarCog, ChevronDown, ChevronRight, ChevronUp, ListChecks } from 'lucide-react';
import { Badge, Button, Checkbox, ProgressBar, Select, Textarea } from '../../../components/common';
import { ACTIVITY_TYPE_LABEL, formatDate } from '../roadmap.logic';
import type { Milestone, SamplePlan, Stage, StageStatus } from '../roadmap.types';
import { TrackBadge } from './GroupBadge';

export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  done: 'Đã xong',
  current: 'Đang thực hiện',
  late: 'Trễ hạn',
  upcoming: 'Sắp tới',
};
export const STAGE_STATUS_VARIANT: Record<StageStatus, 'success' | 'info' | 'danger' | 'default'> = {
  done: 'success',
  current: 'info',
  late: 'danger',
  upcoming: 'default',
};

/** Kết quả kỳ vọng của giai đoạn: gộp kết quả của các hoạt động không từ lộ trình mẫu (mục mẫu có trong Chi tiết) */
const expectedOf = (stage: Stage) =>
  [...new Set(stage.items.filter((i) => !i.detail).map((i) => i.expected_result).filter(Boolean))].join('; ');

export interface PendingChange {
  done?: boolean;
  note?: string;
}

interface Props {
  stage: Stage;
  /** Thứ tự chặng (từ 0) để hiện mã chặng ở đầu thẻ */
  index: number;
  open: boolean;
  readOnly: boolean;
  busy: boolean;
  pending: Record<string, PendingChange>;
  onToggle: () => void;
  onChange: (item: Milestone, patch: PendingChange) => void;
  onEditDue: (item: Milestone) => void;
  onChangeLevel: (item: Milestone, level: 1 | 2 | 3) => void;
  onQuiz: (item: Milestone) => void;
}

const LEVEL_KEYS = ['1', '2', '3'] as const;

/** Chi tiết hoạt động từ lộ trình mẫu: cách làm, bằng chứng, tiêu chí đạt, kỹ năng, thời lượng */
const ActivityDetail: React.FC<{
  item: Milestone;
  id: string;
  readOnly: boolean;
  busy: boolean;
  onChangeLevel: (level: 1 | 2 | 3) => void;
  onQuiz: () => void;
}> = ({ item, id, readOnly, busy, onChangeLevel, onQuiz }) => {
  const d = item.detail;
  const span = item.start_date && item.due_date ? `${formatDate(item.start_date)} – ${formatDate(item.due_date)}` : null;
  const levels = LEVEL_KEYS.filter((key) => d?.level_duration_weeks?.[key]);
  const level = item.item_level ?? 2;
  const scheduleOf = (plan: SamplePlan) =>
    level === 1 ? plan.schedule_level_1 : level === 3 ? plan.schedule_level_3 : plan.schedule_level_2;
  return (
    <div id={id} className="roadmap-activity-detail">
      {(levels.length > 0 || d?.has_quiz) && (
        <div className="roadmap-activity-tools is-wide">
          {levels.length > 0 && (
            <Select
              label="Cấp thực hiện"
              options={levels.map((key) => ({ value: key, label: `Cấp ${key} · ${d?.level_duration_weeks?.[key]} tuần` }))}
              value={String(level)}
              disabled={readOnly || busy}
              onChange={(value) => onChangeLevel(Number(value) as 1 | 2 | 3)}
            />
          )}
          {d?.has_quiz && (
            <div className="roadmap-quiz-slot">
              {item.quiz_total ? (
                <Badge variant={item.quiz_passed_at ? 'success' : 'default'} size="sm">
                  Kiểm tra nhanh {item.quiz_score}/{item.quiz_total}{item.quiz_passed_at ? ' · Đạt' : ''}
                </Badge>
              ) : null}
              {!readOnly && (
                <Button type="button" size="sm" variant="outline" leftIcon={<ListChecks size={14} />} disabled={busy} onClick={onQuiz}>
                  {item.quiz_total ? 'Làm lại kiểm tra nhanh' : 'Kiểm tra nhanh'}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {d?.level_guide && (
        <section className="is-wide">
          <h4>Gợi ý chọn cấp</h4>
          <p>{d.level_guide}</p>
        </section>
      )}
      {d?.prior_knowledge && (
        <section>
          <h4>Cần biết trước</h4>
          <p>{d.prior_knowledge}</p>
        </section>
      )}
      {d?.experience_task && (
        <section>
          <h4>Trải nghiệm</h4>
          <p>{d.experience_task}</p>
        </section>
      )}
      {d?.how_to && (
        <section className="is-wide">
          <h4>Cách làm</h4>
          <p>{d.how_to}</p>
        </section>
      )}
      {item.expected_result && (
        <section>
          <h4>Bằng chứng hoàn thành</h4>
          <p>{item.expected_result}</p>
        </section>
      )}
      {item.pass_criteria && (
        <section>
          <h4>Tiêu chí đạt</h4>
          <p>{item.pass_criteria}</p>
        </section>
      )}
      {d?.skills_gained && (
        <section>
          <h4>Kỹ năng đạt được</h4>
          <p>{d.skills_gained}</p>
        </section>
      )}
      {(span || d?.duration_text) && (
        <section>
          <h4>Thời gian</h4>
          <p>{[span, item.item_level ? null : d?.duration_text].filter(Boolean).join(' · ')}</p>
        </section>
      )}
      {d?.extra_hours_text && (
        <section>
          <h4>Giờ phụ thêm (gọn – vừa – kỹ)</h4>
          <p>{d.extra_hours_text}</p>
        </section>
      )}
      {d?.fallback_options && (
        <section>
          <h4>Đường lui &amp; linh hoạt</h4>
          <p>{d.fallback_options}</p>
        </section>
      )}
      {d?.plans && d.plans.length > 0 && (
        <section className="is-wide">
          <h4>Kế hoạch mẫu</h4>
          <ul className="roadmap-plan-samples">
            {d.plans.map((plan) => (
              <li key={plan.id}>
                <div className="roadmap-plan-sample-head">
                  <strong>{plan.title}</strong>
                  <Badge size="sm">Gợi ý</Badge>
                </div>
                {plan.fit_when && <small>Hợp khi: {plan.fit_when}</small>}
                {scheduleOf(plan) && <p>{scheduleOf(plan)}</p>}
                {plan.suggested_output && <small>Đầu ra: {plan.suggested_output}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

const hasDetail = (item: Milestone) => Boolean(item.detail || item.expected_result || item.pass_criteria);

/** Thẻ giai đoạn: thu gọn còn một dòng, mở ra thì tick hoàn thành ngay trên từng hoạt động */
export const RoadmapStageCard: React.FC<Props> = ({ stage, index, open, readOnly, busy, pending, onToggle, onChange, onEditDue, onChangeLevel, onQuiz }) => {
  const [shown, setShown] = useState<Set<string>>(() => new Set());
  const toggleDetail = (id: string) =>
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const code = `Chặng ${String(index + 1).padStart(2, '0')}`;
  const doneCount = stage.items.filter((m) => pending[m.id]?.done ?? m.done).length;
  const dues = [...new Set(stage.items.map((m) => m.due_date).filter(Boolean))] as string[];
  const sharedDue = dues.length === 1 && stage.items.every((m) => m.due_date) ? dues[0] : null;
  const expected = expectedOf(stage);

  if (!open) {
    return (
      <article id={`stage-${stage.key}`} className={`roadmap-stage is-collapsed is-${stage.status}`}>
        <button type="button" className="roadmap-stage-toggle" aria-expanded="false" onClick={onToggle}>
          <ChevronRight size={18} aria-hidden="true" />
          <span className="roadmap-stage-code">{code}</span>
          <span className="roadmap-stage-name">{stage.label}</span>
          <Badge variant={STAGE_STATUS_VARIANT[stage.status]} size="sm">{STAGE_STATUS_LABEL[stage.status]}</Badge>
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
          <span className="roadmap-stage-code">{code}</span>
          <span className="roadmap-stage-name">{stage.label}</span>
          <Badge variant={STAGE_STATUS_VARIANT[stage.status]} size="sm">{STAGE_STATUS_LABEL[stage.status]}</Badge>
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
          const detailOpen = shown.has(item.id);
          const detailId = `activity-detail-${item.id}`;
          return (
            <li key={item.id} className={checked ? 'is-done' : undefined}>
              <div className="roadmap-activity-line">
                <TrackBadge item={item} />
                <Checkbox
                  className="roadmap-activity-check"
                  label={item.title}
                  checked={checked}
                  disabled={readOnly || busy}
                  onChange={(value) => onChange(item, { done: value })}
                />
                {item.detail && <Badge size="sm">{item.detail.stage_name}</Badge>}
                {item.item_level && <Badge size="sm">Cấp {item.item_level}</Badge>}
                {item.activity_type && <Badge size="sm">{ACTIVITY_TYPE_LABEL[item.activity_type]}</Badge>}
                {item.is_partner && <Badge variant="warning" size="sm">Quảng cáo/Đối tác</Badge>}
                {item.is_checkpoint && <Badge variant="warning" size="sm">Cột mốc</Badge>}
                {!sharedDue && item.due_date && <span className="roadmap-activity-due">Hạn {formatDate(item.due_date)}</span>}
                {hasDetail(item) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="roadmap-activity-detail-toggle"
                    aria-expanded={detailOpen}
                    aria-controls={detailId}
                    rightIcon={detailOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    onClick={() => toggleDetail(item.id)}
                  >
                    Chi tiết
                  </Button>
                )}
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
              {detailOpen && (
                <ActivityDetail
                  item={item}
                  id={detailId}
                  readOnly={readOnly}
                  busy={busy}
                  onChangeLevel={(level) => onChangeLevel(item, level)}
                  onQuiz={() => onQuiz(item)}
                />
              )}
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
    </article>
  );
};
