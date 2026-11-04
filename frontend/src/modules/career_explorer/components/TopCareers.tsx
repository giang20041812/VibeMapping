import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, GitCompare, Sparkles } from 'lucide-react';
import { Alert, Badge, Button, Skeleton } from '../../../components/common';
import type { CareerRankItem } from '../../../domain/assessmentRules';
import { useAuth } from '../../auth/AuthContext';
import { recommendCareers } from '../career.service';
import { FitBars } from './FitBars';
import { FitRing } from './FitRing';
import '../pages/CareerFit.css';

interface Props {
  picked?: string[];
  onToggleCompare?: (id: string) => void;
  onBrowse?: () => void;
}

/** Nghề phù hợp nhất và các nghề tiếp theo của người học */
export const TopCareers: React.FC<Props> = ({ picked = [], onToggleCompare, onBrowse }) => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<CareerRankItem[] | null>(null);
  const [hasResult, setHasResult] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user.id) return;
    let active = true;
    recommendCareers(session.user.id)
      .then((value) => {
        if (!active) return;
        setItems(value.items);
        setHasResult(Boolean(value.learner.resultId));
      })
      .catch(() => active && setError('Không tính được nghề phù hợp.'));
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (items === null) return <Skeleton shape="block" />;
  if (!hasResult) {
    return (
      <div className="fit-empty">
        <Sparkles size={28} aria-hidden="true" />
        <h2>Chưa có kết quả đánh giá</h2>
        <Button onClick={() => navigate('/danh-gia-ca-nhan')}>Làm bài đánh giá</Button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="fit-empty">
        <Sparkles size={28} aria-hidden="true" />
        <h2>Chưa có nghề đạt mức phù hợp tối thiểu</h2>
        <div className="fit-empty-actions">
          <Button onClick={() => navigate('/danh-gia-360')}>Mời người đánh giá 360°</Button>
          <Button variant="outline" onClick={onBrowse ?? (() => navigate('/nghe'))}>Xem danh mục nghề</Button>
        </div>
      </div>
    );
  }

  const [top, ...rest] = items;
  const completeness = Math.round(Math.min(...items.map((item) => item.componentCompleteness)) * 100);
  return (
    <div className="fit-section">
      <article className="fit-hero">
        <FitRing percent={top.fitPercent} size={132} />
        <div className="fit-hero-body">
          <span className="fit-eyebrow">Phù hợp nhất với bạn</span>
          <h2>{top.careerName}</h2>
          {top.nearThreshold && <Badge variant="warning">Nghề gần đạt</Badge>}
          <FitBars result={top.result} />
          <div className="fit-actions">
            <Button onClick={() => navigate(`/nghe/${top.careerId}`)} rightIcon={<ArrowRight size={16} />}>Xem chi tiết</Button>
            {onToggleCompare && (
              <Button variant={picked.includes(top.careerId) ? 'primary' : 'outline'} leftIcon={<GitCompare size={16} />} onClick={() => onToggleCompare(top.careerId)}>
                {picked.includes(top.careerId) ? 'Bỏ so sánh' : 'So sánh'}
              </Button>
            )}
          </div>
        </div>
      </article>

      {rest.length > 0 && (
        <ul className="fit-grid">
          {rest.map((item, index) => (
            <li key={item.careerId} className="fit-card">
              <span className="fit-card-rank">{index + 2}</span>
              <FitRing percent={item.fitPercent} size={64} />
              <div className="fit-card-body">
                <Link to={`/nghe/${item.careerId}`} className="fit-card-title">{item.careerName}</Link>
                {item.nearThreshold && <Badge variant="warning" size="sm">Nghề gần đạt</Badge>}
                <FitBars result={item.result} />
              </div>
              {onToggleCompare && (
                <Button size="sm" variant={picked.includes(item.careerId) ? 'primary' : 'outline'} onClick={() => onToggleCompare(item.careerId)}>
                  {picked.includes(item.careerId) ? 'Bỏ so sánh' : 'So sánh'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="fit-completeness">
        <span>Độ đầy đủ dữ liệu {completeness}%</span>
        <span className="fit-bar-track"><span className="fit-bar-fill" style={{ width: `${completeness}%` }} /></span>
        {completeness < 100 && <Link to="/danh-gia-360">Mời thêm góc nhìn 360°</Link>}
      </div>
    </div>
  );
};
