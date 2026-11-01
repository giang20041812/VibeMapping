import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Spinner } from '../../../components/common';
import { careerCompareReady, readCareerCompare, toggleCareerCompare } from '../../../lib/selectionCart';
import { useAuth } from '../../auth/AuthContext';
import { RIASEC_DEMO_NOTE, loadCareerDetail, saveCareerBookmark, type CareerDetail } from '../career.service';
import { CriterionExplanation } from '../components/CriterionExplanation';
import './CareerPages.css';

const GROUP_LABEL: Record<string, string> = {
  parent: 'Phụ huynh',
  friend: 'Bạn bè',
  teacher: 'Giáo viên',
  mentor: 'Người hướng dẫn',
  others: 'Người khác',
};

export function percentText(value: number | null, decimals = 1): string {
  return value === null ? 'Chưa đủ dữ liệu' : `${value.toFixed(decimals)}%`;
}

export const CareerDetailPage: React.FC = () => {
  const { careerId = '' } = useParams();
  const { session, profile } = useAuth();
  const [detail, setDetail] = useState<CareerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [picked, setPicked] = useState(() => readCareerCompare());
  const isLearner = profile?.role === 'student' || profile?.role === 'university_student';

  useEffect(() => {
    if (!session?.user.id || !careerId) return;
    let active = true;
    setLoading(true);
    loadCareerDetail(careerId, session.user.id)
      .then((value) => {
        if (!active) return;
        setDetail(value);
        setError(value ? null : 'Không tìm thấy nghề hoặc nghề chưa được công bố.');
      })
      .catch(() => active && setError('Không tải được hồ sơ nghề.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [careerId, session?.user.id]);

  const bookmark = async (kind: 'saved' | 'target') => {
    setNotice(null);
    try {
      await saveCareerBookmark(careerId, kind);
      setNotice(kind === 'target' ? 'Đã đặt làm nghề mục tiêu (tối đa 2 nghề).' : 'Đã lưu vào nghề quan tâm.');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String((caught as { message?: string })?.message ?? '');
      setNotice(message.includes('target_career_limit') ? 'Bạn đã có đủ 2 nghề mục tiêu.' : 'Không lưu được nghề.');
    }
  };

  if (loading) return <div className="module-page"><Spinner /></div>;
  if (error || !detail) return <div className="module-page"><Alert variant="danger">{error ?? 'Không tìm thấy nghề.'}</Alert></div>;

  const { components } = detail;
  return (
    <div className="module-page">
      <p><Link to="/nghe">Danh sách nghề</Link> · <Link to={`/ban-do/${detail.career.id}`}>Ngành và trường đào tạo</Link></p>
      <h1>{detail.career.career_name}</h1>
      {!detail.hasUserScores && (
        <Alert variant="info" title="Chưa có điểm người học">
          Hoàn thành bài đánh giá để xem mức phù hợp. Yêu cầu nghề vẫn hiển thị từ dữ liệu JD.
        </Alert>
      )}
      {notice && <Alert variant="info">{notice}</Alert>}
      {isLearner && (
        <div className="module-actions">
          <Button type="button" variant="outline" onClick={() => void bookmark('saved')}>Lưu quan tâm</Button>
          <Button type="button" onClick={() => void bookmark('target')}>Đặt làm mục tiêu</Button>
          <Button
            type="button"
            variant={picked.includes(careerId) ? 'primary' : 'outline'}
            onClick={() => {
              const next = toggleCareerCompare(careerId);
              setPicked(next.ids);
              setNotice(next.message ?? (careerCompareReady(next.ids) ? 'Đã đủ 2–4 nghề. Mở trang so sánh nghề.' : `Đã chọn ${next.ids.length}/4 nghề.`));
            }}
          >
            {picked.includes(careerId) ? 'Bỏ so sánh' : 'Thêm vào so sánh nghề'}
          </Button>
          {careerCompareReady(picked) && <Link to={`/nghe/so-sanh?ids=${picked.join(',')}`}>Xem so sánh nghề</Link>}
        </div>
      )}

      <Card title="Mức phù hợp nghề (R08)">
        <p className="career-fit-total">{percentText(components.careerFitPercent)}</p>
        <ul className="module-list">
          <li>
            <span>Năng lực G1–G5</span>
            <span>{percentText(components.g1toG5.matchPercent)}</span>
            <span>Trọng số gốc {Math.round(components.g1toG5.originalWeight * 100)}% · áp dụng {Math.round(components.g1toG5.appliedWeight * 100)}%</span>
          </li>
          <li>
            <span>Sở thích G6 <Badge variant="warning">Demo</Badge></span>
            <span>{percentText(components.g6.matchPercent)}</span>
            <span>Trọng số gốc {Math.round(components.g6.originalWeight * 100)}% · áp dụng {Math.round(components.g6.appliedWeight * 100)}%</span>
          </li>
          <li>
            <span>Động lực G7</span>
            <span>{percentText(components.g7.matchPercent)}</span>
            <span>Trọng số gốc {Math.round(components.g7.originalWeight * 100)}% · áp dụng {Math.round(components.g7.appliedWeight * 100)}%</span>
          </li>
        </ul>
        <p>Độ đầy đủ thành phần: {Math.round(components.componentCompleteness * 100)}%. Thành phần thiếu dữ liệu được loại và chia lại trọng số (R13).</p>
        <Alert variant="warning">{RIASEC_DEMO_NOTE}</Alert>
      </Card>

      {detail.perceptionGaps.length > 0 && (
        <Card title="Cảnh báo lệch góc nhìn">
          <ul className="module-list">
            {detail.perceptionGaps.map((gap) => (
              <li key={`${gap.dimensionCode}-${gap.group}`}>
                <span>{gap.dimensionName}</span>
                <span>Bạn tự đánh giá {Math.round(gap.selfPercent)}%</span>
                <span>{GROUP_LABEL[gap.group]} đánh giá {Math.round(gap.groupPercent)}%</span>
                <Badge variant="warning">Chênh {Math.abs(gap.deltaPercent)} điểm</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Xem vì sao (giải thích tầng 2)">
        <CriterionExplanation rows={components.criteriaEvaluations} />
      </Card>

      <Card title="Hồ sơ Holland của nghề">
        <p>Mã Top 3: {detail.career.holland_top3 ?? 'Chưa có'}</p>
        {detail.holland.length === 0 ? <p>Chưa có hồ sơ sáu chiều.</p> : (
          <ul className="module-list">
            {detail.holland.map((row) => (
              <li key={row.code}>
                <Badge>{row.code}</Badge>
                <span>{Math.round(row.strength * 100)}% JD có gắn</span>
                <span>{row.jdCount} JD</span>
              </li>
            ))}
          </ul>
        )}
        <p>{detail.standardNote} Mức kiểm định: theo dữ liệu JD.</p>
      </Card>
    </div>
  );
};
