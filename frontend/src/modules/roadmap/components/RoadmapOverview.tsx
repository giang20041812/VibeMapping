import React from 'react';
import { Flag, RefreshCw, ShieldAlert } from 'lucide-react';
import { Badge, Button } from '../../../components/common';
import { formatDate } from '../roadmap.logic';
import type { Roadmap, Stage, StageStatus } from '../roadmap.types';

const STATUS_LABEL: Record<StageStatus, string> = {
  done: 'Đã xong',
  current: 'Đang thực hiện',
  late: 'Trễ hạn',
  upcoming: 'Sắp tới',
};

export interface OverviewProgress {
  actualPercent: number;
  plannedPercent: number;
  offTrack: boolean;
  delayPercent: number;
  missedCheckpoints: { id: string; title: string }[];
}

interface Props {
  roadmap: Roadmap;
  stages: Stage[];
  progress: OverviewProgress;
  monthsLeft: number | null;
  daysLeft: number | null;
  readOnly: boolean;
  onPickStage: (key: string) => void;
  onRegenerate: () => void;
}

/** Tổng quan: số liệu chính, đường đi xuất phát → các giai đoạn → mục tiêu, và cảnh báo chệch hướng */
export const RoadmapOverview: React.FC<Props> = ({ roadmap, stages, progress, monthsLeft, daysLeft, readOnly, onPickStage, onRegenerate }) => {
  const start = [roadmap.education_level, roadmap.school_year].filter(Boolean).join(' · ') || 'Điểm xuất phát';
  const goal = [roadmap.career_name, roadmap.program_title].filter(Boolean).join(' · ');
  /* Đoạn đường thứ k nối mốc k với mốc k+1 (mốc 0 là xuất phát, mốc cuối là mục tiêu): đầy bao nhiêu thì chặng tương ứng xong bấy nhiêu */
  const count = stages.length;
  const segment = (k: number) => {
    if (count === 0) return 0;
    const value = k < count ? stages[k].actualPercent / 100 : stages[count - 1].status === 'done' ? 1 : 0;
    return Math.max(0, Math.min(1, value));
  };
  const fill = (inSeg: number | null, outSeg: number | null) =>
    ({ '--in': inSeg === null ? 0 : segment(inSeg), '--out': outSeg === null ? 0 : segment(outSeg) }) as React.CSSProperties;
  const remaining = daysLeft !== null && daysLeft < 0 ? 'Quá hạn' : monthsLeft === null ? '—' : `${monthsLeft} tháng`;

  return (
    <>
      <section className="roadmap-overview" aria-label="Tổng quan lộ trình">
        <dl className="roadmap-kpis">
          <div><dt>Hoàn thành</dt><dd>{Math.round(progress.actualPercent)}%</dd></div>
          <div><dt>Kế hoạch đến hôm nay</dt><dd>{Math.round(progress.plannedPercent)}%</dd></div>
          <div><dt>Còn lại</dt><dd>{remaining}</dd></div>
          <div>
            <dt>Trạng thái</dt>
            <dd><Badge variant={progress.offTrack ? 'danger' : 'success'}>{progress.offTrack ? 'Chệch hướng' : 'Đúng hướng'}</Badge></dd>
          </div>
        </dl>

        <ol className="roadmap-path" aria-label="Bản đồ đường đi">
          <li className="roadmap-node is-start" style={fill(null, 0)}>
            <div className="roadmap-node-body">
              <span className="roadmap-node-dot" aria-hidden="true" />
              <b>Xuất phát</b>
              <small>{start}</small>
            </div>
          </li>
          {stages.map((stage, index) => (
            <li key={stage.key} className={`roadmap-node is-${stage.status}`} style={fill(index, index + 1)}>
              <button type="button" className="roadmap-node-body" onClick={() => onPickStage(stage.key)}>
                <span className="roadmap-node-dot" aria-hidden="true" />
                <b>{stage.key === 'none' ? 'Chưa hạn' : `T${stage.key.slice(5, 7)}/${stage.key.slice(2, 4)}`}</b>
                <small>{STATUS_LABEL[stage.status]}</small>
              </button>
            </li>
          ))}
          <li className="roadmap-node is-goal" style={fill(count, null)}>
            <div className="roadmap-node-body">
              <span className="roadmap-node-dot" aria-hidden="true"><Flag size={14} /></span>
              <b>Mục tiêu</b>
              <small>{goal || 'Chưa chọn nghề'}</small>
              {roadmap.target_date && <small>{formatDate(roadmap.target_date)}</small>}
            </div>
          </li>
        </ol>
      </section>

      {progress.offTrack && !readOnly && (
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
      )}
    </>
  );
};
