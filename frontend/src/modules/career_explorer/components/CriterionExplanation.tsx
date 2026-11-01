import React from 'react';
import { Badge } from '../../../components/common';
import type { CareerComponentResult } from '../../../domain/assessmentRules';
import type { CareerCriterionRow } from '../career.service';
import { FIT_PARTS, PRIORITY_LABEL, formatPercent, formatScore } from '../careerFit.constants';

const STATUS_TEXT: Record<CareerCriterionRow['status'], string> = {
  missing: 'Chưa đủ dữ liệu',
  met: 'Đạt',
  gap: 'Cần phát triển',
};

interface Props {
  result: CareerComponentResult;
  rows: CareerCriterionRow[];
}

/** Giải thích theo ba phần và từng tiêu chí: mức khớp, điểm góp vào % phù hợp, điểm bị trừ */
export const CriterionExplanation: React.FC<Props> = ({ result, rows }) => {
  const sorted = [...rows].sort((a, b) => (b.penaltyPoints - a.penaltyPoints) || (b.careerWeight - a.careerWeight));
  return (
    <div className="explain-stack">
      <ul className="explain-parts">
        {FIT_PARTS.map(({ key, label }) => {
          const part = result[key];
          const pct = part.match === null ? 0 : Math.round(part.match * 100);
          return (
            <li key={key} className={`explain-part explain-part-${key}`}>
              <span className="explain-part-label">{label}</span>
              <span className="explain-part-score">
                {part.match === null ? '–' : formatScore(part.match * part.appliedWeight * 100)}
                <small>điểm</small>
              </span>
              <span className="explain-meter" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
              <span className="explain-part-meta">
                <span>Khớp <b>{formatPercent(part.matchPercent)}</b></span>
                <span>Tỷ trọng <b>{part.appliedWeight > 0 ? formatPercent(part.appliedWeight * 100, 0) : 'Chưa đủ dữ liệu'}</b></span>
              </span>
            </li>
          );
        })}
      </ul>

      {sorted.length > 0 && (
        <div className="explain-table-wrap">
          <table className="explain-table">
            <thead>
              <tr>
                <th scope="col">Tiêu chí</th>
                <th scope="col">Yêu cầu</th>
                <th scope="col">Điểm của bạn</th>
                <th scope="col">Mức quan trọng</th>
                <th scope="col">Mức đáp ứng</th>
                <th scope="col">Còn thiếu</th>
                <th scope="col">Ưu tiên cải thiện</th>
                <th scope="col">Điểm bị trừ</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.criteriaId}>
                  <th scope="row">{row.name ?? row.dimensionCode}</th>
                  <td className="is-num">{formatScore(row.requiredScore)}</td>
                  <td className="is-num is-strong">{formatScore(row.userScore)}</td>
                  <td className="is-num">{formatPercent(row.careerWeight * 100, 0)}</td>
                  <td>
                    {row.fit === null ? '–' : (
                      <span className="explain-cell-meter">
                        <span className="explain-meter" aria-hidden="true"><span style={{ width: `${Math.round(row.fit * 100)}%` }} /></span>
                        <b>{formatPercent(row.fit * 100, 0)}</b>
                      </span>
                    )}
                  </td>
                  <td className="is-num">{row.gap === null || row.gap <= 0 ? '–' : formatScore(row.gap)}</td>
                  <td>
                    {row.priority
                      ? <Badge variant={row.priority === 'P1' ? 'danger' : 'warning'}>{PRIORITY_LABEL[row.priority]}</Badge>
                      : row.status === 'met'
                        ? <Badge variant="success">{STATUS_TEXT[row.status]}</Badge>
                        : STATUS_TEXT[row.status]}
                  </td>
                  <td className={`is-num${row.penaltyPoints > 0 ? ' is-penalty' : ''}`}>{formatScore(row.penaltyPoints)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
