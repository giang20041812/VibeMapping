import React, { useMemo } from 'react';
import { AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react';
import { Button, Card, ProgressBar } from '../../../components/common';
import { PolygonChart } from '../../../components/charts/PolygonChart/PolygonChart';
import type { PolygonAxis } from '../../../components/charts/PolygonChart/PolygonChart';
import { useCountUp } from '../../../hooks/useCountUp';
import { GROUP_ICONS, GROUP_SHORT_LABELS, NO_DATA_LABEL } from '../assessmentResult.constants';
import type { AssessmentResultSummary, GroupScore } from '../assessmentResult.types';
import './ResultView.css';

const formatPercent = (value: number | null) => (value === null ? '–' : `${Math.round(value)}%`);

/** Một đường thẳng xám cho điểm cuối; vạch đứng nhỏ đánh dấu điểm tự đánh giá khi khác điểm sau 360° (chi tiết nằm ở chú thích khi rê chuột) */
const ScoreLine: React.FC<{ value: number | null; self: number | null; label: string; className?: string }> = ({ value, self, label, className = '' }) => {
  const hasTick = self !== null && value !== null && Math.round(self) !== Math.round(value);
  const title = [self !== null ? `Tự đánh giá ${Math.round(self)}%` : null, value !== null && hasTick ? `Sau 360° ${Math.round(value)}%` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <span className={`score-line ${className}`} title={title || undefined}>
      <ProgressBar value={value} label={label} />
      {hasTick && <span className="score-line-tick" style={{ left: `${Math.max(0, Math.min(self, 100))}%` }} aria-hidden="true" />}
    </span>
  );
};

const GroupRow: React.FC<{ group: GroupScore; index: number }> = ({ group, index }) => {
  const headline = group.combined ?? group.self;
  const animated = useCountUp(headline, 900, 200 + index * 70);
  const hasDetail = group.criteria.length > 0 || group.self !== null || group.combined !== null;

  return (
    <li className="group-row" data-group={group.groupCode} tabIndex={hasDetail ? 0 : undefined}>
      <div className="group-row-head">
        <span className="group-row-name" title={group.name}>{group.name}</span>
        <span className={`group-row-score ${animated === null ? 'is-empty' : ''}`}>
          {animated === null ? NO_DATA_LABEL : `${Math.round(animated)}%`}
        </span>
      </div>
      <div className="group-meter">
        <ProgressBar value={headline} label={group.name} />
      </div>
      {hasDetail && (
        <div className="group-detail" role="group" aria-label={`Tiêu chí – ${group.name}`}>
          {group.criteria.length > 0 && (
            <ul className="criterion-list">
              {group.criteria.map((criterion) => {
                const value = criterion.combined ?? criterion.self;
                return (
                  <li key={criterion.dimensionCode} className="criterion-row">
                    <span className="criterion-name" title={criterion.name}>{criterion.name}</span>
                    <span className="criterion-score">{formatPercent(value)}</span>
                    <ScoreLine value={value} self={criterion.self} label={criterion.name} className="criterion-bar" />
                  </li>
                );
              })}
            </ul>
          )}
          <div className="group-detail-total">
            <span className="criterion-name">Cả nhóm</span>
            <span className="criterion-score">{formatPercent(headline)}</span>
            <ScoreLine value={headline} self={group.self} label={`Cả nhóm ${group.name}`} className="criterion-bar" />
          </div>
        </div>
      )}
    </li>
  );
};

interface ResultViewProps {
  result: AssessmentResultSummary;
  onRetake?: () => void;
  onContinue?: () => void;
  /** Phủ lên biểu đồ và bảng điểm (ví dụ nút làm bài khi chưa có kết quả); nội dung bên dưới bị làm mờ và khóa */
  cover?: React.ReactNode;
  /** Đầu thẻ điểm: trạng thái, hiệu lực và chọn lịch sử */
  header?: React.ReactNode;
  /** Cuối thẻ điểm: giá trị cốt lõi và minh chứng */
  footer?: React.ReactNode;
}

export const ResultView: React.FC<ResultViewProps> = ({ result, onRetake, onContinue, cover, header, footer }) => {
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
      <div className={`result-stage ${cover ? 'has-cover' : ''}`}>
      <div className="result-grid" aria-hidden={cover ? true : undefined} inert={cover ? true : undefined}>
        <div className="result-chart">
          <PolygonChart
            axes={axes}
            valueLabel={hasCombined ? 'Tổng hợp 360°' : 'Tự đánh giá'}
            referenceLabel="Tự đánh giá"
            noDataLabel={NO_DATA_LABEL}
            showNodeValues
            showReadout={false}
          />
        </div>

        <Card className="result-groups-card">
          {(result.thinDataFlag || result.insufficientBasisWarning) && (
            <div className="result-notes">
              {result.thinDataFlag && (
                <span className="result-note" title="Kết quả hiện chỉ dựa trên 1 bài đánh giá">
                  <AlertTriangle size={14} aria-hidden="true" />
                  Dữ liệu mỏng
                </span>
              )}
              {result.insufficientBasisWarning && (
                <span className="result-note" title="Nhiều tiêu chí chưa có đủ cơ sở để kết luận mức năng lực">
                  <AlertTriangle size={14} aria-hidden="true" />
                  Thiếu dữ liệu đánh giá
                </span>
              )}
            </div>
          )}
          {header}
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
          <ul className="group-list">
            {result.groups.map((group, index) => (
              <GroupRow key={group.groupCode} group={group} index={index} />
            ))}
          </ul>
          {footer}
          {(onRetake || onContinue) && (
            <div className="result-retake">
              {onContinue && (
                <Button onClick={onContinue} rightIcon={<ArrowRight size={18} />}>
                  Tiếp tục bài đang làm dở
                </Button>
              )}
              {onRetake && (
                <Button variant={onContinue ? 'secondary' : 'primary'} onClick={onRetake} leftIcon={<RotateCcw size={18} />}>
                  Làm lại đánh giá
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>
      {cover && <div className="result-cover">{cover}</div>}
      </div>
    </div>
  );
};
