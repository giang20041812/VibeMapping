import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, BadgeCheck, CheckCircle2, Gauge, Lightbulb, RefreshCw, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Card, Checkbox, DataTable, ProgressBar, StatTile, type DataTableColumn } from '../../../components/common';
import { DISCLAIMER_TEXT } from '../../assessment_result/assessmentResult.constants';
import { FRAMEWORK_SECTION_LABEL } from '../../career_explorer/careerLevelFramework.constants';
import { GAP_STATUS_LABEL, GAP_STATUS_VARIANT, IMPACT_LABEL } from '../portfolio.constants';
import type { CourseSuggestion, GapResult, GapRow } from '../portfolio.types';
import { formatLevel } from '../skillGap.logic';
import { GapChart } from './GapChart';
import { GapSuggestions } from './GapSuggestions';

interface Props {
  result: GapResult;
  suggestions: CourseSuggestion[];
  busy: boolean;
  onReanalyse: () => void;
  onChangePosition: () => void;
  onAddToProfile: (row: GapRow) => void;
  onEditLevel: (row: GapRow) => void;
  onAddToRoadmap: (title: string) => void;
}

const rowKey = (row: GapRow) => `${row.section}-${row.item_id ?? row.content}`;
const STATUS_ICON = { met: CheckCircle2, near: AlertTriangle, unmet: XCircle } as const;

const StatusBadge: React.FC<{ row: GapRow }> = ({ row }) => {
  const Icon = STATUS_ICON[row.status];
  return (
    <Badge size="sm" variant={GAP_STATUS_VARIANT[row.status]}>
      <Icon size={12} aria-hidden="true" /> {GAP_STATUS_LABEL[row.status]}
    </Badge>
  );
};

/** Bước 2: kết quả phân tích khoảng cách năng lực so với vị trí đã chọn */
export const GapResultView: React.FC<Props> = ({
  result, suggestions, busy, onReanalyse, onChangePosition, onAddToProfile, onEditLevel, onAddToRoadmap,
}) => {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const pickedRows = useMemo(() => result.ranked.filter((row) => picked.has(rowKey(row))), [result.ranked, picked]);
  const allPicked = result.ranked.length > 0 && pickedRows.length === result.ranked.length;

  const toggle = (row: GapRow, checked: boolean) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowKey(row));
      else next.delete(rowKey(row));
      return next;
    });
  };

  const columns: DataTableColumn<GapRow>[] = [
    {
      key: 'content',
      header: 'Kỹ năng',
      render: (row) => (
        <div className="pf-cell-skill">
          <span>{row.content}</span>
          {row.detail && <small>{row.detail}</small>}
        </div>
      ),
    },
    { key: 'section', header: 'Loại', render: (row) => FRAMEWORK_SECTION_LABEL[row.section], nowrap: true },
    { key: 'required', header: 'Yêu cầu', align: 'right', render: (row) => formatLevel(row.required_level) },
    {
      key: 'current',
      header: 'Hiện có',
      align: 'right',
      render: (row) => (row.current_level === null ? <span className="pf-muted" title="Chưa có trong hồ sơ">Chưa có</span> : formatLevel(row.current_level)),
    },
    { key: 'gap', header: 'Chênh', align: 'right', render: (row) => (row.gap > 0 ? `−${formatLevel(row.gap)}` : '0') },
    { key: 'impact', header: 'Ảnh hưởng', align: 'center', render: (row) => IMPACT_LABEL[row.impact], nowrap: true },
    { key: 'status', header: 'Kết quả', align: 'center', render: (row) => <StatusBadge row={row} />, nowrap: true },
    {
      key: 'source',
      header: 'Nguồn',
      align: 'center',
      nowrap: true,
      render: (row) => (row.verified_360
        ? <Badge size="sm" variant="success"><BadgeCheck size={12} aria-hidden="true" /> 360°</Badge>
        : row.current_level !== null ? 'Tự chấm' : '–'),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      nowrap: true,
      render: (row) => (row.profile_item_id
        ? <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onEditLevel(row)}>Sửa mức</Button>
        : <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onAddToProfile(row)}>Thêm vào hồ sơ</Button>),
    },
  ];

  return (
    <div className="pf-result">
      <div className="pf-result-head">
        <div className="pf-result-title">
          <h2>{result.position_name}</h2>
          <span>Phân tích lúc {new Date(result.analysed_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>
        <div className="module-actions">
          <Button type="button" variant="ghost" leftIcon={<RefreshCw size={16} />} isLoading={busy} onClick={onReanalyse}>Phân tích lại</Button>
          <Button type="button" variant="outline" leftIcon={<ArrowLeftRight size={16} />} onClick={onChangePosition}>Đổi vị trí</Button>
        </div>
      </div>

      <div className="pf-stats">
        <StatTile label="Mức đạt tổng thể" tone="blue" icon={<Gauge />} value={result.overall_percent.toLocaleString('vi-VN')} unit="%">
          <ProgressBar value={result.overall_percent} label="Mức đạt tổng thể" />
        </StatTile>
        <StatTile label={GAP_STATUS_LABEL.met} tone="teal" icon={<CheckCircle2 />} value={result.counts.met} unit="kỹ năng" />
        <StatTile label={GAP_STATUS_LABEL.near} tone="gold" icon={<AlertTriangle />} value={result.counts.near} unit="kỹ năng" />
        <StatTile label={GAP_STATUS_LABEL.unmet} tone="coral" icon={<XCircle />} value={result.counts.unmet} unit="kỹ năng" />
      </div>

      <div className="pf-result-grid">
        <Card title="Biểu đồ khoảng cách năng lực" className="pf-result-chart">
          <GapChart rows={result.rows} />
        </Card>

        <Card
          title="Kỹ năng cần bổ sung"
          className="pf-result-ranking"
          action={result.ranked.length > 0 ? (
            <Checkbox
              label="Chọn tất cả"
              checked={allPicked}
              indeterminate={pickedRows.length > 0 && !allPicked}
              onChange={(checked) => setPicked(checked ? new Set(result.ranked.map(rowKey)) : new Set())}
            />
          ) : undefined}
        >
          {result.ranked.length === 0 ? (
            <div className="pf-empty">
              <CheckCircle2 aria-hidden="true" />
              <p>Hồ sơ đã đáp ứng mọi kỹ năng của vị trí này.</p>
            </div>
          ) : (
            <>
              <ol className="pf-rank-list">
                {result.ranked.map((row, index) => (
                  <li key={rowKey(row)} className={picked.has(rowKey(row)) ? 'is-picked' : ''}>
                    <Checkbox label="" aria-label={`Chọn ${row.content}`} checked={picked.has(rowKey(row))} onChange={(checked) => toggle(row, checked)} />
                    <span className="pf-rank-no">{index + 1}</span>
                    <span className="pf-rank-body">
                      <span className="pf-rank-name">{row.content}</span>
                      <span className="pf-rank-meta">
                        Thiếu {formatLevel(row.gap)} mức · Ảnh hưởng {IMPACT_LABEL[row.impact].toLowerCase()}
                      </span>
                    </span>
                    <StatusBadge row={row} />
                  </li>
                ))}
              </ol>
              <Button
                type="button"
                block
                leftIcon={<Lightbulb size={16} />}
                disabled={pickedRows.length === 0}
                onClick={() => setShowSuggestions(true)}
              >
                Gợi ý dự án, khóa học ({pickedRows.length} kỹ năng)
              </Button>
            </>
          )}
        </Card>
      </div>

      {showSuggestions && pickedRows.length > 0 && (
        <GapSuggestions rows={pickedRows} suggestions={suggestions} onAddToRoadmap={onAddToRoadmap} onClose={() => setShowSuggestions(false)} />
      )}

      <Card title="So sánh chi tiết từng tiêu chí" noPadding>
        <DataTable columns={columns} rows={result.rows} rowKey={rowKey} caption="So sánh chi tiết từng tiêu chí" />
      </Card>

      <Alert variant="warning">{DISCLAIMER_TEXT}</Alert>
    </div>
  );
};
