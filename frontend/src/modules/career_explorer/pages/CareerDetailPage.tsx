import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bookmark, GitCompare, Target } from 'lucide-react';
import { Alert, Badge, Button, Skeleton } from '../../../components/common';
import { PolygonChart } from '../../../components/charts/PolygonChart/PolygonChart';
import type { PolygonAxis } from '../../../components/charts/PolygonChart/PolygonChart';
import { careerCompareReady, readCareerCompare, toggleCareerCompare } from '../../../lib/selectionCart';
import { GROUP_ICONS, GROUP_SHORT_LABELS } from '../../assessment_result/assessmentResult.constants';
import { useAuth } from '../../auth/AuthContext';
import { loadCareerDetail, saveCareerBookmark, type CareerDetail } from '../career.service';
import { CareerProfile } from '../components/CareerProfile';
import { CriterionExplanation } from '../components/CriterionExplanation';
import { FitBars } from '../components/FitBars';
import { FitRing } from '../components/FitRing';
import './CareerPages.css';
import './CareerFit.css';

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

/** Điểm yêu cầu của nghề và điểm của người học theo nhóm tiêu chí, thang 0–100 */
function groupAxes(detail: CareerDetail): PolygonAxis[] {
  const byGroup = new Map<string, { w: number; req: number; user: number; userW: number }>();
  for (const row of detail.components.criteriaEvaluations) {
    if (!(row.careerWeight > 0)) continue;
    const entry = byGroup.get(row.groupCode) ?? { w: 0, req: 0, user: 0, userW: 0 };
    entry.w += row.careerWeight;
    entry.req += row.careerWeight * (row.requiredScore / 5);
    if (row.userScore !== null) {
      entry.userW += row.careerWeight;
      entry.user += row.careerWeight * (row.userScore / 5);
    }
    byGroup.set(row.groupCode, entry);
  }
  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, e]) => ({
      key: code,
      label: GROUP_SHORT_LABELS[code] ?? code,
      value: e.userW > 0 ? Math.round((e.user / e.userW) * 100) : null,
      reference: Math.round((e.req / e.w) * 100),
      icon: GROUP_ICONS[code] ?? GROUP_ICONS.G1,
    }));
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

  const axes = useMemo(() => (detail ? groupAxes(detail) : []), [detail]);

  const bookmark = async (kind: 'saved' | 'target') => {
    setNotice(null);
    try {
      await saveCareerBookmark(careerId, kind);
      setNotice(kind === 'target' ? 'Đã đặt làm nghề mục tiêu.' : 'Đã lưu vào nghề quan tâm.');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String((caught as { message?: string })?.message ?? '');
      setNotice(message.includes('target_career_limit') ? 'Bạn đã có đủ 2 nghề mục tiêu.' : 'Không lưu được nghề.');
    }
  };

  if (loading) return <div className="module-page"><Skeleton shape="block" /></div>;
  if (error || !detail) return <div className="module-page"><Alert variant="danger">{error ?? 'Không tìm thấy nghề.'}</Alert></div>;

  const { components } = detail;
  const fit = components.careerFitPercent;
  const unmet = components.criteriaEvaluations.filter((row) => row.status === 'gap');
  return (
    <div className="module-page career-detail">
      <Link to="/nghe" className="career-back">← Danh sách nghề</Link>
      <header className="career-detail-head">
        {fit !== null && detail.hasUserScores && <FitRing percent={fit} size={104} />}
        <div className="career-detail-title">
          <h1>{detail.career.career_name}</h1>
          <div className="career-chips">
            {fit !== null && fit < detail.policy.minFitPercent && <Badge variant="warning">Nghề gần đạt</Badge>}
            {components.componentCompleteness < 1 && detail.hasUserScores && <Badge>Dữ liệu {Math.round(components.componentCompleteness * 100)}%</Badge>}
          </div>
        </div>
        {isLearner && (
          <div className="fit-actions">
            <Button variant="outline" leftIcon={<Bookmark size={16} />} onClick={() => void bookmark('saved')}>Lưu quan tâm</Button>
            <Button leftIcon={<Target size={16} />} onClick={() => void bookmark('target')}>Đặt làm mục tiêu</Button>
            <Button
              variant={picked.includes(careerId) ? 'primary' : 'outline'}
              leftIcon={<GitCompare size={16} />}
              onClick={() => {
                const next = toggleCareerCompare(careerId);
                setPicked(next.ids);
                setNotice(next.message ?? (careerCompareReady(next.ids) ? null : `Đã chọn ${next.ids.length}/4 nghề.`));
              }}
            >
              {picked.includes(careerId) ? 'Bỏ so sánh' : 'So sánh'}
            </Button>
            {careerCompareReady(picked) && <Link className="compare-tray-go" to={`/nghe/so-sanh?ids=${picked.join(',')}`}>So sánh ngay</Link>}
          </div>
        )}
      </header>
      {notice && <Alert variant="info">{notice}</Alert>}

      {detail.hasUserScores ? (
        <section className="career-block">
          <h2>Vì sao phù hợp</h2>
          <div className="career-why">
            <FitBars result={components} />
            {axes.length >= 3 && (
              <div className="career-why-chart">
                <PolygonChart axes={axes} valueLabel="Bạn" referenceLabel="Yêu cầu nghề" showReadout={false} showNodeValues autoCycleMs={0} />
              </div>
            )}
          </div>
          {unmet.length === 0 ? (
            <Alert variant="success">Bạn đã đáp ứng toàn diện các yêu cầu của nghề này.</Alert>
          ) : (
            <div className="career-gaps">
              <h3>Cần bổ sung</h3>
              <ul className="career-chips">
                {unmet.slice(0, 8).map((row) => <li key={row.dimensionCode}><Badge variant="warning">{row.name ?? row.dimensionCode}</Badge></li>)}
              </ul>
            </div>
          )}
          <details className="career-more">
            <summary>Chi tiết từng tiêu chí</summary>
            <CriterionExplanation rows={components.criteriaEvaluations} />
          </details>
        </section>
      ) : (
        <div className="fit-empty">
          <h2>Làm bài đánh giá để xem mức phù hợp với nghề này</h2>
          <Link className="compare-tray-go" to="/danh-gia-ca-nhan">Làm bài đánh giá</Link>
        </div>
      )}

      {detail.perceptionGaps.length > 0 && (
        <section className="career-block">
          <h2>Lệch góc nhìn</h2>
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
        </section>
      )}

      <CareerProfile careerId={careerId} />

      <p className="explain-note">Mức phù hợp chỉ mang tính tham khảo, không thay thế quyết định của bạn.</p>
    </div>
  );
};
