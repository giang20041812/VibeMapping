import React, { useMemo, useState } from 'react';
import { Award, BarChart3, BookOpen, Hammer, Languages, Radar, Users, Wrench, type LucideIcon } from 'lucide-react';
import { Checkbox, Tabs } from '../../../components/common';
import { PolygonChart, type PolygonAxis } from '../../../components/charts/PolygonChart/PolygonChart';
import { FRAMEWORK_SECTION_LABEL } from '../../career_explorer/careerLevelFramework.constants';
import type { FrameworkSection } from '../../career_explorer/careerLevelFramework.types';
import { GAP_STATUS_LABEL } from '../portfolio.constants';
import type { GapRow } from '../portfolio.types';
import { formatLevel, sectionAttainment } from '../skillGap.logic';

interface Props {
  rows: GapRow[];
}

const SECTION_ICON: Partial<Record<FrameworkSection, LucideIcon>> = {
  professional_skill: Wrench,
  knowledge: BookOpen,
  tool: Hammer,
  soft_skill: Users,
  language: Languages,
  certificate: Award,
};
const MAX_LEVEL = 5;
const TICKS = [0, 1, 2, 3, 4, 5];
const pct = (level: number | null) => `${(Math.min(level ?? 0, MAX_LEVEL) / MAX_LEVEL) * 100}%`;
const at = (level: number) => ({ '--pf-at': pct(level) }) as React.CSSProperties;
const width = (level: number | null) => ({ '--pf-w': pct(level) }) as React.CSSProperties;

/** Biểu đồ khoảng cách năng lực (FR08.02.04): cột ngang từng kỹ năng, hoặc radar theo nhóm kỹ năng */
export const GapChart: React.FC<Props> = ({ rows }) => {
  const [mode, setMode] = useState('bar');
  const [onlyGaps, setOnlyGaps] = useState(false);
  const sections = useMemo(() => sectionAttainment(rows), [rows]);
  const canRadar = sections.length >= 3;
  const ordered = useMemo(
    () => [...rows]
      .filter((row) => !onlyGaps || row.status !== 'met')
      .sort((a, b) => b.weight - a.weight || b.gap - a.gap || a.content.localeCompare(b.content, 'vi')),
    [rows, onlyGaps],
  );

  const axes: PolygonAxis[] = sections.map((s) => ({
    key: s.section,
    label: FRAMEWORK_SECTION_LABEL[s.section],
    value: s.percent,
    reference: 100,
    icon: SECTION_ICON[s.section] ?? Wrench,
  }));

  return (
    <div className="pf-chart">
      <div className="pf-chart-head">
        <Tabs
          label="Dạng biểu đồ"
          value={canRadar ? mode : 'bar'}
          onChange={setMode}
          items={[
            { value: 'bar', label: 'Biểu đồ cột', icon: <BarChart3 /> },
            ...(canRadar ? [{ value: 'radar', label: 'Biểu đồ radar', icon: <Radar /> }] : []),
          ]}
        />
        {mode === 'bar' && <Checkbox label="Chỉ kỹ năng cần bổ sung" checked={onlyGaps} onChange={setOnlyGaps} />}
      </div>

      {mode === 'radar' && canRadar ? (
        <PolygonChart axes={axes} valueLabel="Mức đạt" referenceLabel="Yêu cầu" showNodeValues className="pf-radar" />
      ) : (
        <>
          <ul className="pf-chart-legend" aria-label="Chú giải">
            <li><span className="pf-swatch is-required" aria-hidden="true" />Mức yêu cầu</li>
            <li><span className="pf-swatch is-current" aria-hidden="true" />Mức hiện có</li>
          </ul>
          <div className="pf-bars" role="list" aria-label="Khoảng cách từng kỹ năng">
            <div className="pf-bars-axis" aria-hidden="true">
              <span />
              <div className="pf-bars-ticks">
                {TICKS.map((tick) => <span key={tick} style={at(tick)}>{tick}</span>)}
              </div>
              <span />
            </div>
            {ordered.length === 0 && <p className="pf-muted">Không còn kỹ năng nào cần bổ sung.</p>}
            {ordered.map((row) => {
              const label = `${row.content}: yêu cầu ${formatLevel(row.required_level)}, hiện có ${row.current_level === null ? 'chưa có trong hồ sơ' : formatLevel(row.current_level)}, ${GAP_STATUS_LABEL[row.status]}`;
              return (
                <div key={`${row.section}-${row.content}`} className={`pf-bar-row is-${row.status}`} role="listitem" tabIndex={0} aria-label={label}>
                  <span className="pf-bar-label" title={row.content}>{row.content}</span>
                  <div className="pf-bar-track">
                    {TICKS.slice(1).map((tick) => <span key={tick} className="pf-bar-grid" style={at(tick)} aria-hidden="true" />)}
                    <span className="pf-bar is-required" style={width(row.required_level)} />
                    <span className="pf-bar is-current" style={width(row.current_level)} />
                  </div>
                  <span className="pf-bar-value">
                    {row.current_level === null ? <em>Chưa có</em> : formatLevel(row.current_level)}
                    <span className="pf-bar-sep">/</span>
                    {formatLevel(row.required_level)}
                  </span>
                  <span className="pf-bar-tip" role="tooltip">
                    <strong>{row.content}</strong>
                    <span>Yêu cầu: {formatLevel(row.required_level)}</span>
                    <span>Hiện có: {row.current_level === null ? 'Chưa có trong hồ sơ' : formatLevel(row.current_level)}</span>
                    <span>Chênh: {row.gap > 0 ? `−${formatLevel(row.gap)}` : '0'} · {GAP_STATUS_LABEL[row.status]}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
