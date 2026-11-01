import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Card, Spinner } from '../../../components/common';
import type { CareerRankItem } from '../../../domain/assessmentRules';
import { useAuth } from '../../auth/AuthContext';
import { RIASEC_DEMO_NOTE, recommendCareers } from '../career.service';
import { CriterionExplanation } from './CriterionExplanation';

/** R20: Top nghề phù hợp kèm giải thích tầng 2 khi bấm "Xem vì sao" */
export const TopCareers: React.FC = () => {
  const { session } = useAuth();
  const [items, setItems] = useState<CareerRankItem[] | null>(null);
  const [hasResult, setHasResult] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

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

  return (
    <Card title="Nghề phù hợp nhất với bạn">
      {error && <Alert variant="danger">{error}</Alert>}
      {!error && items === null && <Spinner label="Đang tính mức phù hợp" />}
      {items !== null && !hasResult && (
        <Alert variant="info">Bạn chưa có kết quả đánh giá. <Link to="/danh-gia-ca-nhan">Làm bài đánh giá</Link> để xem nghề phù hợp.</Alert>
      )}
      {items !== null && hasResult && items.length === 0 && (
        <Alert variant="info">Chưa có nghề đạt từ 40% trở lên với hồ sơ hiện tại. Hãy thu thập thêm đánh giá 360° hoặc khám phá danh mục bên dưới.</Alert>
      )}
      {items && items.length > 0 && (
        <ol className="top-careers">
          {items.map((item) => (
            <li key={item.careerId}>
              <div className="top-career-head">
                <Link to={`/nghe/${item.careerId}`}>{item.careerName}</Link>
                <strong>{item.fitPercent.toFixed(1)}%</strong>
                {item.nearThreshold && <Badge variant="warning">Nghề gần đạt</Badge>}
                {item.componentCompleteness < 1 && <Badge>Dữ liệu {Math.round(item.componentCompleteness * 100)}%</Badge>}
                <button type="button" className="link-button" onClick={() => setOpenId(openId === item.careerId ? null : item.careerId)}>
                  {openId === item.careerId ? 'Ẩn giải thích' : 'Xem vì sao'}
                </button>
              </div>
              <p className="explain-note">
                G1–G5 {item.result.g1toG5.matchPercent ?? '–'}% · G6 {item.result.g6.matchPercent ?? '–'}% (Demo) · G7 {item.result.g7.matchPercent ?? '–'}%
              </p>
              {openId === item.careerId && <CriterionExplanation rows={item.result.criteriaEvaluations} />}
            </li>
          ))}
        </ol>
      )}
      <p className="explain-note">{RIASEC_DEMO_NOTE}</p>
    </Card>
  );
};
