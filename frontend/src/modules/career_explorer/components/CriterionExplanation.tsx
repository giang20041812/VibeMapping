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
    <div className="explain-table-wrap">
      <table className="explain-table">
        <thead>
          <tr>
            <th scope="col">Phần</th>
            <th scope="col">Tỷ trọng</th>
            <th scope="col">Mức khớp</th>
            <th scope="col">Điểm góp</th>
          </tr>
        </thead>
        <tbody>
          {FIT_PARTS.map(({ key, label }) => {
            const part = result[key];
            return (
              <tr key={key}>
                <td>{label}</td>
                <td>{part.appliedWeight > 0 ? formatPercent(part.appliedWeight * 100, 0) : 'Chưa đủ dữ liệu'}</td>
                <td>{formatPercent(part.matchPercent)}</td>
                <td>{part.match === null ? '–' : formatScore(part.match * part.appliedWeight * 100)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {sorted.length > 0 && (
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
                <td>{row.name ?? row.dimensionCode}</td>
                <td>{formatScore(row.requiredScore)}</td>
                <td>{formatScore(row.userScore)}</td>
                <td>{formatPercent(row.careerWeight * 100, 0)}</td>
                <td>{row.fit === null ? '–' : formatPercent(row.fit * 100, 0)}</td>
                <td>{row.gap === null || row.gap <= 0 ? '–' : formatScore(row.gap)}</td>
                <td>
                  {row.priority
                    ? <Badge variant={row.priority === 'P1' ? 'danger' : 'warning'}>{PRIORITY_LABEL[row.priority]}</Badge>
                    : STATUS_TEXT[row.status]}
                </td>
                <td>{formatScore(row.penaltyPoints)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
