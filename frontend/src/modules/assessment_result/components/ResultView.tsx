import React, { useMemo } from 'react';
import { Badge, Alert, Card, ProgressBar, Stage } from '../../../components/common';
import { PolygonChart } from '../../../components/charts/PolygonChart/PolygonChart';
import type { PolygonAxis } from '../../../components/charts/PolygonChart/PolygonChart';
import { useCountUp } from '../../../hooks/useCountUp';
import {
  COMPETENCY_LEVELS,
  DISCLAIMER_TEXT,
  GROUP_ICONS,
  GROUP_SHORT_LABELS,
  NO_DATA_LABEL,
  competencyOf,
  statusCaption,
  statusTitle,
} from '../assessmentResult.constants';
import type { AssessmentResultSummary, CompetencyLevel, GroupScore } from '../assessmentResult.types';
import './ResultView.css';

const LEVEL_BADGE: Record<CompetencyLevel, 'success' | 'info' | 'default' | 'warning'> = {
  very_high: 'success',
  high: 'info',
  medium: 'default',
  low: 'warning',
};

const LEVELS = COMPETENCY_LEVELS.map(({ min, label }) => ({ min, label }));

const GroupRow: React.FC<{ group: GroupScore; index: number }> = ({ group, index }) => {
  const headline = group.combined ?? group.self;
  const animated = useCountUp(headline, 900, 200 + index * 70);
  const level = competencyOf(headline);

  return (
    <li className="group-row">
      <div className="group-row-head">
        <span className="group-row-name">{group.name}</span>
        <span className="group-row-score">{animated === null ? NO_DATA_LABEL : `${Math.round(animated)}%`}</span>
      </div>
      <div className="group-row-bars">
        <ProgressBar value={headline} label={group.name} />
        {group.combined !== null && group.self !== null && (
          <ProgressBar value={group.self} label={`${group.name} – tự đánh giá`} tone="secondary" className="group-row-self" />
        )}
      </div>
      <div className="group-row-foot">
        {level ? <Badge variant={LEVEL_BADGE[level.key]}>{level.label}</Badge> : <Badge>{NO_DATA_LABEL}</Badge>}
        {group.combined !== null && group.self !== null && (
          <span className="group-row-self-text">Tự đánh giá {Math.round(group.self)}%</span>
        )}
      </div>
    </li>
  );
};

export const ResultView: React.FC<{ result: AssessmentResultSummary; showDisclaimer?: boolean }> = ({ result, showDisclaimer = true }) => {
  const hasCombined = result.groups.some((g) => g.combined !== null);

  const axes: PolygonAxis[] = useMemo(
    () =>
      result.groups.map((g) => ({
        key: g.groupCode,
        label: GROUP_SHORT_LABELS[g.groupCode] ?? g.name,
        value: hasCombined ? g.combined : g.self,
        reference: hasCombined ? g.self : undefined,
        icon: GROUP_ICONS[g.groupCode] ?? GROUP_ICONS.G1,
      })),
    [result.groups, hasCombined],
  );

  const progress = result.expectedCount > 0 ? (result.acceptedCount / result.expectedCount) * 100 : null;

  return (
    <div className="result-view">
      <header className="result-hero">
        <div className="result-status">
          <span className={`result-status-chip status-${result.statusLabel}`}>
            <span className="result-status-dot" aria-hidden="true" />
            {statusTitle(result.statusLabel, result.acceptedCount, result.expectedCount)}
          </span>
          <p className="result-status-caption">{statusCaption(result.statusLabel, result.groupsCount)}</p>
        </div>

        {progress !== null && (
          <div className="result-progress">
            <div className="result-progress-head">
              <span>Bài đánh giá đã chấp nhận</span>
              <strong>
                {result.acceptedCount}/{result.expectedCount}
              </strong>
            </div>
            <ProgressBar value={progress} label="Tiến độ đánh giá 360°" />
          </div>
        )}
      </header>

      {result.thinDataFlag && (
        <Alert variant="warning" title="Dữ liệu mỏng">
          Kết quả hiện chỉ dựa trên 1 bài đánh giá.
        </Alert>
      )}
      {result.insufficientBasisWarning && (
        <Alert variant="warning" title="Thiếu dữ liệu đánh giá">
          Nhiều tiêu chí chưa có đủ cơ sở để kết luận mức năng lực.
        </Alert>
      )}

      <div className="result-grid">
        <Stage className="result-chart">
          <PolygonChart axes={axes} levels={LEVELS} valueLabel="Tổng hợp 360°" referenceLabel="Tự đánh giá" noDataLabel={NO_DATA_LABEL} />
        </Stage>

        <Card title="Điểm theo nhóm tiêu chí" className="result-groups-card">
          <ul className="group-list">
            {result.groups.map((group, index) => (
              <GroupRow key={group.groupCode} group={group} index={index} />
            ))}
          </ul>
        </Card>
      </div>

      {showDisclaimer && (
        <Alert variant="info" className="result-disclaimer">
          {DISCLAIMER_TEXT}
        </Alert>
      )}
    </div>
  );
};
