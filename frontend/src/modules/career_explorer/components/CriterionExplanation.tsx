import React from 'react';
import { Badge } from '../../../components/common';
import type { CriterionEvaluation } from '../../../domain/assessmentRules';

const STATUS_TEXT: Record<CriterionEvaluation['status'], string> = {
  missing: 'Chưa đủ dữ liệu',
  met: 'Đạt',
  gap: 'Cần phát triển',
};

/** Bảng giải thích tầng 2 (R19): Req, điểm người học, CW, Fit, Gap, ưu tiên và phần điểm bị trừ */
export const CriterionExplanation: React.FC<{ rows: CriterionEvaluation[] }> = ({ rows }) => {
  if (rows.length === 0) return <p>Nghề chưa có tiêu chí có trọng số CW &gt; 0.</p>;
  const sorted = [...rows].sort((a, b) => (b.penaltyPoints - a.penaltyPoints) || a.dimensionCode.localeCompare(b.dimensionCode));
  return (
    <div className="explain-table-wrap">
      <table className="explain-table">
        <thead>
          <tr>
            <th scope="col">Tiêu chí</th>
            <th scope="col">Yêu cầu</th>
            <th scope="col">Điểm của bạn</th>
            <th scope="col">CW</th>
            <th scope="col">Fit</th>
            <th scope="col">Gap</th>
            <th scope="col">Ưu tiên</th>
            <th scope="col">Điểm bị trừ</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.dimensionCode}>
              <td>{row.dimensionCode} · {row.name ?? ''}</td>
              <td>{row.requiredScore.toFixed(2)}</td>
              <td>{row.userScore === null ? '–' : row.userScore.toFixed(2)}</td>
              <td>{(row.careerWeight * 100).toFixed(1)}%</td>
              <td>{row.fit === null ? '–' : `${Math.round(row.fit * 100)}%`}</td>
              <td>{row.gap === null ? '–' : row.gap.toFixed(2)}</td>
              <td>{row.priority ? <Badge variant={row.priority === 'P1' ? 'danger' : 'warning'}>{row.priority}</Badge> : STATUS_TEXT[row.status]}</td>
              <td>{row.penaltyPoints.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="explain-note">Ngưỡng ưu tiên P1 ≥ 0,5 điểm, P2 ≥ 0,25 điểm (P40, P41 – mức Demo). Ưu tiên chỉ sắp xếp việc cải thiện, không dùng để xếp hạng nghề.</p>
    </div>
  );
};
