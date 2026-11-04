import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Badge, Card, Spinner } from '../../../components/common';
import { careerCompareReady, readCareerCompare } from '../../../lib/selectionCart';
import { useAuth } from '../../auth/AuthContext';
import { loadCareerCompareRows, type CareerCompareFacts } from '../career.service';
import { percentText } from './CareerDetailPage';
import './CareerPages.css';

const MISSING = 'Đang cập nhật';

function cell(value: string | number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined || value === '') return MISSING;
  return `${value}${suffix}`;
}

export const CareerComparePage: React.FC = () => {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const ids = useMemo(() => {
    const fromQuery = params.get('ids')?.split(',').filter(Boolean) ?? [];
    return fromQuery.length >= 2 ? fromQuery : readCareerCompare();
  }, [params]);
  const [rows, setRows] = useState<CareerCompareFacts[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user.id || !careerCompareReady(ids)) {
      setRows([]);
      return;
    }
    let active = true;
    loadCareerCompareRows(ids)
      .then((value) => active && setRows(value))
      .catch(() => active && setError('Không tải được bảng so sánh nghề.'));
    return () => {
      active = false;
    };
  }, [ids, session?.user.id]);

  const differs = (pick: (row: CareerCompareFacts) => string) => {
    const known = (rows ?? []).map(pick).filter((v) => v !== MISSING);
    return known.length >= 2 && new Set(known).size > 1;
  };

  if (!careerCompareReady(ids)) {
    return (
      <div className="module-page">
        <h1>So sánh nghề</h1>
        <Alert variant="info">Chọn từ 2 đến 4 nghề khác nhau ở danh sách nghề, rồi mở lại trang này.</Alert>
        <Link to="/nghe">Chọn nghề</Link>
      </div>
    );
  }

  return (
    <div className="module-page">
      <p><Link to="/nghe">Danh sách nghề</Link></p>
      <h1>So sánh nghề</h1>
      {error && <Alert variant="danger">{error}</Alert>}
      {rows === null && <Spinner />}
      {rows && rows.length < 2 && <Alert variant="info">Một nghề đã chọn không còn công bố. Chọn lại 2–4 nghề.</Alert>}
      {rows && rows.length >= 2 && (
        <Card title="Đối chiếu thông tin công bố và mức phù hợp">
          <p className="explain-note">Ô có nhãn “Khác” là tiêu chí các nghề không giống nhau. Ô thiếu dữ liệu ghi “Đang cập nhật” và không tham gia kết luận.</p>
          <div className="explain-table-wrap">
            <table className="explain-table compare-table">
              <thead>
                <tr>
                  <th>Thông tin</th>
                  {rows.map((row) => (
                    <th key={row.id}><Link to={`/nghe/${row.id}`}>{row.career_name}</Link></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <CompareRow label="Lĩnh vực" values={rows.map((r) => cell(r.fieldName))} highlight={differs((r) => cell(r.fieldName))} />
                <CompareRow label="Thu nhập công bố" values={rows.map((r) => cell(r.salary))} highlight={differs((r) => cell(r.salary))} />
                <CompareRow label="Thời gian đào tạo" values={rows.map((r) => (r.trainingYears === null ? MISSING : `${r.trainingYears} năm`))} highlight={differs((r) => (r.trainingYears === null ? MISSING : String(r.trainingYears)))} />
                <CompareRow
                  label="% phù hợp của bạn"
                  values={rows.map((r) => (!r.hasUserScores ? 'Chưa có kết quả đánh giá' : percentText(r.fitPercent)))}
                  highlight={differs((r) => (!r.hasUserScores ? 'Chưa có kết quả đánh giá' : percentText(r.fitPercent)))}
                />
                <CompareRow label="Mã Holland" values={rows.map((r) => cell(r.holland_top3))} highlight={differs((r) => cell(r.holland_top3))} />
                <CompareRow label="Môi trường làm việc" values={rows.map((r) => cell(r.workEnvironment))} highlight={differs((r) => cell(r.workEnvironment))} />
                <CompareRow label="Kỹ năng" values={rows.map((r) => cell(r.skills))} highlight={differs((r) => cell(r.skills))} />
                <tr>
                  <th>Nguồn</th>
                  {rows.map((row) => (
                    <td key={row.id}>
                      {row.sourceUrl ? <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">Xem nguồn</a> : MISSING}
                      {row.reviewedAt && <span className="explain-note"> · {new Date(row.reviewedAt).toLocaleDateString('vi-VN')}</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="explain-note">G6 đang ở mức Demo (R05 chưa chốt). % phù hợp là tham khảo, không phải cam kết việc làm.</p>
        </Card>
      )}
    </div>
  );
};

const CompareRow: React.FC<{ label: string; values: string[]; highlight: boolean }> = ({ label, values, highlight }) => (
  <tr className={highlight ? 'compare-diff' : undefined}>
    <th>{label}{highlight && <Badge>Khác</Badge>}</th>
    {values.map((value, index) => <td key={`${label}-${index}`}>{value}</td>)}
  </tr>
);
