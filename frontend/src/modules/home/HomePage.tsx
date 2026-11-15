import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Alert } from '../../components/common';
import type { PolygonAxis } from '../../components/charts/PolygonChart/PolygonChart';
import { COMPETENCY_LEVELS, GROUP_ICONS, GROUP_SHORT_LABELS } from '../assessment_result/assessmentResult.constants';
import { getLatestAssessmentResult } from '../assessment_result/assessmentResult.service';
import type { AssessmentResultSummary } from '../assessment_result/assessmentResult.types';
import { RATER_NODES } from '../assessment_360/assessment360.constants';
import { PACKAGES } from '../assessment_session/assessmentSession.constants';
import { MAX_EXPECTED_PER_GROUP } from '../invitation_link/invitation.constants';
import { getCatalogScale, type CatalogScale } from './home.service';
import { HomeHero } from './components/HomeHero';
import { HomeJourney } from './components/HomeJourney';
import { useAuth } from '../auth/AuthContext';
import { isLearnerRole } from '../profile/profile.logic';
import './HomePage.css';

interface RouteState {
  draftSaved?: boolean;
}

/* Số liệu mẫu cho bản đồ minh họa: đủ các nhóm tiêu chí như trong đánh giá cá nhân */
const SAMPLE_SCORES: Record<string, number> = { G1: 78, G2: 88, G3: 70, G4: 84, G5: 62, G6: 91, G7: 74 };
const SAMPLE_AXES: PolygonAxis[] = Object.keys(GROUP_SHORT_LABELS).map((code) => ({
  key: code,
  label: GROUP_SHORT_LABELS[code],
  value: SAMPLE_SCORES[code] ?? 0,
  icon: GROUP_ICONS[code],
}));

/** Bản đồ từ kết quả của chính người dùng, cùng cách lấy điểm như trang kết quả */
function resultToAxes(result: AssessmentResultSummary): PolygonAxis[] {
  const hasCombined = result.groups.some((g) => g.combined !== null);
  return result.groups.map((g) => ({
    key: g.groupCode,
    label: GROUP_SHORT_LABELS[g.groupCode] ?? g.name,
    value: hasCombined ? g.combined : g.self,
    icon: GROUP_ICONS[g.groupCode] ?? GROUP_ICONS.G1,
  }));
}
const POLYGON_LEVELS = COMPETENCY_LEVELS.map(({ min, label }) => ({ min, label }));

/* Quy mô một bài tự đánh giá lấy từ các gói: số câu ít nhất – nhiều nhất, số phút ngắn nhất – dài nhất */
const PACKAGE_SIZES = PACKAGES.map((p) => p.size);
const PACKAGE_MINUTES = PACKAGES.flatMap((p) => (p.minutes.match(/\d+/g) ?? []).map(Number));
const QUESTION_RANGE = `${Math.min(...PACKAGE_SIZES)}–${Math.max(...PACKAGE_SIZES)}`;
const MINUTE_RANGE = `${Math.min(...PACKAGE_MINUTES)}–${Math.max(...PACKAGE_MINUTES)}′`;

const JOURNEY_ID = 'hanh-trinh';

/**
 * Trang giới thiệu: phần mở đầu (lời hứa, nút chính, bản đồ tố chất) rồi hành trình năm bước theo đúng thứ tự dùng sản phẩm.
 * Mỗi thông tin chỉ xuất hiện một lần, ở đúng bước của nó.
 */
export const HomePage: React.FC = () => {
  const { profile, session, isGuest, isProfileLoading } = useAuth();
  const location = useLocation();
  const draftSaved = (location.state as RouteState | null)?.draftSaved;
  const learner = isLearnerRole(profile?.role);
  /* Khách thấy nút khám phá; bấm vào sẽ được đưa tới đăng nhập rồi quay lại đúng trang */
  const canExplore = isGuest || learner;
  /* Khách làm bài test ngay không cần đăng nhập; người có tài khoản làm trong trang tổng quan */
  const testPath = isGuest ? '/lam-bai' : '/danh-gia-360';
  const userId = session?.user.id;
  const [result, setResult] = useState<AssessmentResultSummary | null>(null);
  const [isResultLoading, setIsResultLoading] = useState(true);
  const [scale, setScale] = useState<CatalogScale | null>(null);

  useEffect(() => {
    let active = true;
    getCatalogScale()
      .then((value) => {
        if (active) setScale(value);
      })
      .catch(() => {
        if (active) setScale(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!userId || !learner || isGuest) {
      setResult(null);
      setIsResultLoading(false);
      return;
    }
    let active = true;
    setIsResultLoading(true);
    getLatestAssessmentResult(userId)
      .then((value) => {
        if (active) setResult(value);
      })
      .catch(() => {
        if (active) setResult(null);
      })
      .finally(() => {
        if (active) setIsResultLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, learner, isGuest]);

  const axes = useMemo(() => (result ? resultToAxes(result) : SAMPLE_AXES), [result]);
  /* Chờ biết người dùng có kết quả hay chưa, tránh bản đồ mẫu nháy lên rồi đổi sang bản đồ thật */
  const isChartLoading = isProfileLoading || (learner && !isGuest && isResultLoading);

  return (
    <div className="home">
      {draftSaved && <Alert variant="success">Đã lưu tạm. Bạn có thể quay lại làm tiếp trong 7 ngày.</Alert>}

      <HomeHero
        canExplore={canExplore}
        testPath={testPath}
        axes={axes}
        levels={POLYGON_LEVELS}
        isOwnResult={result !== null}
        isLoading={isChartLoading}
        journeyId={JOURNEY_ID}
      />

      {!isGuest && !isProfileLoading && !learner && <Alert variant="info">Tài khoản của bạn chưa có chức năng nào trong giai đoạn này.</Alert>}

      <HomeJourney
        id={JOURNEY_ID}
        canExplore={canExplore}
        testPath={testPath}
        questionRange={QUESTION_RANGE}
        minuteRange={MINUTE_RANGE}
        raters={RATER_NODES}
        ratersPerGroup={MAX_EXPECTED_PER_GROUP}
        careers={scale?.careers ?? null}
      />
    </div>
  );
};
