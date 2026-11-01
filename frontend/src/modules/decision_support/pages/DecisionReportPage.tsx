import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Spinner, Textarea } from '../../../components/common';
import { callRpc } from '../../../lib/rpc';
import { downloadPdf } from '../../../lib/printProfile';
import '../../career_explorer/pages/CareerPages.css';

interface RankRow {
  id: string;
  title: string;
  eligibility: 'MET' | 'NOT_MET' | 'UNKNOWN';
  totalScore: number | null;
  careerFitPercent: number | null;
  overBudget?: boolean;
  tuitionPerYear?: number | null;
  missingCriteria: string[];
}
interface Report {
  id: string;
  title: string;
  owner_name: string;
  is_owner: boolean;
  include_finance: boolean;
  budget_per_year: number | null;
  ranking: RankRow[];
  preferred_option_id: string | null;
  preferred_reason: string | null;
  owner_confirmed_at: string | null;
  shares: { user_id: string; consensus_at: string | null; comment: string | null }[];
}
const ELIGIBILITY_LABEL = { MET: 'Đáp ứng', NOT_MET: 'Chưa đáp ứng', UNKNOWN: 'Chưa đủ dữ liệu' } as const;

/** F06.02: báo cáo quyết định gia đình, chỉ đọc với phụ huynh; tài chính ẩn khi HS không cho phép */
export const DecisionReportPage: React.FC = () => {
  const { reportId = '' } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const reload = useCallback(() => callRpc<Report>('get_decision_report', { p_report_id: reportId }).then(setReport), [reportId]);
  useEffect(() => {
    reload().catch(() => setError('Bạn không có quyền xem báo cáo này hoặc báo cáo không tồn tại.'));
  }, [reload]);

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!report) return <Spinner />;
  const preferred = report.ranking.find((r) => r.id === report.preferred_option_id);
  const myShare = !report.is_owner ? report.shares[0] : null;

  return (
    <div className="module-page">
      <p><Link to={report.is_owner ? '/so-sanh' : '/bao-cao-duoc-chia-se'}>Quay lại</Link></p>
      <h1>Báo cáo quyết định: {report.title}</h1>
      <Button type="button" variant="outline" onClick={() => downloadPdf('bao-cao-quyet-dinh.pdf', [
        `Bao cao quyet dinh: ${report.title}`,
        `Nguoi lap: ${report.owner_name}`,
        report.include_finance && report.budget_per_year !== null ? `Ngan sach: ${report.budget_per_year}` : 'Tai chinh: an hoac chua khai',
        ...report.ranking.map((row, index) => `${index + 1}. ${row.title} - ${ELIGIBILITY_LABEL[row.eligibility]}`),
      ])}>Tải PDF</Button>
      <p>Người lập: {report.owner_name} {report.is_owner ? '' : '· Chế độ chỉ đọc'}</p>
      {!report.include_finance && !report.is_owner && <Alert variant="info">Học sinh đã ẩn thông tin tài chính trong báo cáo này.</Alert>}
      <Card title="Thứ hạng phương án">
        <ol className="top-careers">
          {report.ranking.map((r) => (
            <li key={r.id}>
              <div className="top-career-head">
                <strong>{r.title}</strong>
                <Badge variant={r.eligibility === 'MET' ? 'success' : r.eligibility === 'NOT_MET' ? 'danger' : 'default'}>{ELIGIBILITY_LABEL[r.eligibility]}</Badge>
                {r.overBudget && <Badge variant="warning">Vượt ngân sách</Badge>}
                <span>Điểm tổng hợp: {r.totalScore ?? 'Chưa đủ dữ liệu'}</span>
                {r.tuitionPerYear !== undefined && r.tuitionPerYear !== null && <span>Học phí {r.tuitionPerYear} triệu/năm</span>}
              </div>
              <p className="explain-note">Phù hợp nghề {r.careerFitPercent === null ? 'chưa có' : `${r.careerFitPercent.toFixed(1)}%`}</p>
            </li>
          ))}
        </ol>
        {report.budget_per_year !== null && <p>Ngân sách: {report.budget_per_year} triệu/năm.</p>}
        {preferred && <Alert variant="info" title="Phương án ưu tiên">{preferred.title}{report.preferred_reason ? ` – ${report.preferred_reason}` : ''}</Alert>}
      </Card>
      <Card title="Đồng thuận">
        <p>Học sinh: {report.owner_confirmed_at ? `đã xác nhận ${new Date(report.owner_confirmed_at).toLocaleDateString('vi-VN')}` : 'chưa xác nhận'}</p>
        {report.shares.map((s) => (
          <p key={s.user_id}>Phụ huynh: {s.consensus_at ? `đã đồng thuận ${new Date(s.consensus_at).toLocaleDateString('vi-VN')}` : 'chưa xác nhận'}{s.comment ? ` – "${s.comment}"` : ''}</p>
        ))}
        {report.is_owner && !report.owner_confirmed_at && (
          <Button type="button" onClick={() => void callRpc('confirm_decision_consensus', { p_report_id: report.id }).then(reload)}>Tôi xác nhận lựa chọn</Button>
        )}
        {myShare && !myShare.consensus_at && (
          <>
            <Textarea label="Ý kiến của phụ huynh (không bắt buộc)" value={comment} onChange={(e) => setComment(e.target.value)} />
            <Button type="button" onClick={() => void callRpc('confirm_decision_consensus', { p_report_id: report.id, p_comment: comment }).then(reload)}>Xác nhận đồng thuận</Button>
          </>
        )}
      </Card>
    </div>
  );
};

export const SharedReportsPage: React.FC = () => {
  const [rows, setRows] = useState<{ id: string; title: string; owner_name: string; consensus_at: string | null }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    callRpc<typeof rows>('list_shared_decision_reports').then(setRows).catch(() => setError('Không tải được báo cáo.'));
  }, []);
  return (
    <div className="module-page">
      <h1>Báo cáo quyết định được chia sẻ</h1>
      {error && <Alert variant="danger">{error}</Alert>}
      {!error && rows === null && <Spinner />}
      {rows && rows.length === 0 && <p>Chưa có báo cáo nào được chia sẻ với bạn.</p>}
      <ul className="module-list">
        {(rows ?? []).map((r) => (
          <li key={r.id}>
            <Link to={`/bao-cao-quyet-dinh/${r.id}`}>{r.title}</Link>
            <span>{r.owner_name}</span>
            <Badge variant={r.consensus_at ? 'success' : 'default'}>{r.consensus_at ? 'Đã đồng thuận' : 'Chờ xác nhận'}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
};
