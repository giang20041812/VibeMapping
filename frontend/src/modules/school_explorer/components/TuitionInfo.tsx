import React from 'react';
import { Badge } from '../../../components/common';
import { describeTuition, type TuitionInput, type TuitionKind } from '../tuition';
import './TuitionInfo.css';

const KIND_VARIANT: Record<TuitionKind, 'info' | 'success' | 'default'> = {
  semester: 'info',
  year: 'info',
  month: 'info',
  credit: 'info',
  total: 'info',
  free: 'success',
  unpublished: 'default',
  unclear: 'default',
};

export const TuitionKindBadge: React.FC<{ kind: TuitionKind; label: string }> = ({ kind, label }) => (
  <Badge variant={KIND_VARIANT[kind]}>{label}</Badge>
);

/** Gọn: cách thu + số gốc kèm đơn vị; dòng dưới là học phí năm quy đổi để so giữa các chương trình */
export const TuitionSummary: React.FC<{ program: TuitionInput }> = ({ program }) => {
  const view = describeTuition(program);
  const hasAmount = view.figures.length > 0;
  return (
    <div className="tuition-summary">
      <div className="tuition-summary-main">
        {hasAmount && <TuitionKindBadge kind={view.kind} label={view.kindLabel} />}
        <span className="tuition-headline">{hasAmount ? view.headline : view.kindLabel}</span>
      </div>
      {view.yearly && <span className="tuition-yearly">{view.yearly.value} · quy đổi</span>}
    </div>
  );
};

/** Đầy đủ: mỗi đơn vị một dòng, số quy đổi được đánh dấu */
export const TuitionBreakdown: React.FC<{ program: TuitionInput }> = ({ program }) => {
  const view = describeTuition(program);
  if (view.figures.length === 0) {
    return (
      <div className="tuition-breakdown">
        <TuitionKindBadge kind={view.kind} label={view.kindLabel} />
        {view.kind !== 'free' && program.tuitionText && <p className="tuition-source">{program.tuitionText}</p>}
      </div>
    );
  }
  return (
    <div className="tuition-breakdown">
      <TuitionKindBadge kind={view.kind} label={view.kindLabel} />
      <div className="explain-table-wrap">
        <table className="explain-table tuition-table">
          <tbody>
            {view.figures.map((f) => (
              <tr key={f.unit} className={f.derived ? 'is-derived' : undefined}>
                <th scope="row">{f.label}</th>
                <td>
                  <span className="tuition-figure-value">{f.value}</span>
                  {f.note && <span className="tuition-figure-note"> · {f.note}</span>}
                </td>
                <td className="tuition-figure-tag">{f.derived ? <Badge>Quy đổi</Badge> : <Badge variant="highlight">Nguồn ghi</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
