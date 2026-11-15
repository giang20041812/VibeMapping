import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, BookOpen, Briefcase, Layers, ListChecks, School, Timer, Trophy, Users } from 'lucide-react';
import { Alert, Badge, Button } from '../../components/common';
import { Rater360 } from '../../components/charts/Rater360/Rater360';
import { PolygonChart } from '../../components/charts/PolygonChart/PolygonChart';
import type { PolygonAxis } from '../../components/charts/PolygonChart/PolygonChart';
import { PolygonChartSkeleton } from '../../components/charts/PolygonChart/PolygonChartSkeleton';
import { COMPETENCY_LEVELS, GROUP_ICONS, GROUP_SHORT_LABELS } from '../assessment_result/assessmentResult.constants';
import { getLatestAssessmentResult } from '../assessment_result/assessmentResult.service';
import type { AssessmentResultSummary } from '../assessment_result/assessmentResult.types';
import { RATER_NODES } from '../assessment_360/assessment360.constants';
import { PACKAGES } from '../assessment_session/assessmentSession.constants';
import { MAX_EXPECTED_PER_GROUP } from '../invitation_link/invitation.constants';
import { getCatalogScale, type CatalogScale } from './home.service';
import { ExploreLinks, type ExploreItem } from './components/HomeStats';
import { HomeHero, type HeroFact } from './components/HomeHero';
import { useAuth } from '../auth/AuthContext';
import { isLearnerRole } from '../profile/profile.logic';
import { useInView } from '../../hooks/useInView';
import './HomePage.css';

interface RouteState {
  draftSaved?: boolean;
}

/* Số liệu mẫu cho biểu đồ minh họa: đủ các nhóm tiêu chí như trong đánh giá cá nhân */
const SAMPLE_SCORES: Record<string, number> = { G1: 78, G2: 88, G3: 70, G4: 84, G5: 62, G6: 91, G7: 74 };
const SAMPLE_AXES: PolygonAxis[] = Object.keys(GROUP_SHORT_LABELS).map((code) => ({
  key: code,
  label: GROUP_SHORT_LABELS[code],
  value: SAMPLE_SCORES[code] ?? 0,
  icon: GROUP_ICONS[code],
}));

/** Biểu đồ từ kết quả của chính người dùng, cùng cách lấy điểm như trang kết quả */
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

/** Điểm trung bình và nhóm nổi bật nhất của biểu đồ */
function summarize(axes: PolygonAxis[]) {
  const scored = axes.filter((a): a is PolygonAxis & { value: number } => a.value !== null);
  if (scored.length === 0) return null;
  const average = Math.round(scored.reduce((sum, a) => sum + a.value, 0) / scored.length);
  const top = scored.reduce((best, a) => (a.value > best.value ? a : best));
  return { average, top: top.shortLabel ?? top.label };
}

interface FeatureProps {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  lead: string;
  /** Liên kết hành động dưới mô tả */
  action?: { to: string; label: string };
  /** Đưa hình sang bên trái, chữ sang bên phải */
  flip?: boolean;
  visual: React.ReactNode;
}

/** Một hàng giới thiệu: chữ một bên, hình trong thẻ một bên. Khi cuộn tới, từng phần trồi lên và rõ dần nối tiếp nhau. */
const Feature: React.FC<FeatureProps> = ({ id, eyebrow, title, lead, action, flip = false, visual }) => {
  const { ref, seen } = useInView<HTMLElement>(0.2);
  return (
    <section ref={ref} className={`feature ${flip ? 'feature-flip' : ''} ${seen ? 'is-in' : ''}`} aria-labelledby={`${id}-title`}>
      <div className="feature-copy">
        <span className="home-eyebrow reveal">{eyebrow}</span>
        <h2 id={`${id}-title`} className="feature-title reveal" style={{ '--d': 1 } as React.CSSProperties}>
          {title}
        </h2>
        <p className="feature-lead reveal" style={{ '--d': 2 } as React.CSSProperties}>
          {lead}
        </p>
        {action && (
          <Link to={action.to} className="home-link reveal" style={{ '--d': 3 } as React.CSSProperties}>
            {action.label}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="feature-visual reveal reveal-scale" style={{ '--d': 1 } as React.CSSProperties}>
        {visual}
      </div>
    </section>
  );
};

/** Khối có tiêu đề và hiện ra khi cuộn tới */
const RevealSection: React.FC<{ className: string; labelledBy: string; children: React.ReactNode }> = ({ className, labelledBy, children }) => {
  const { ref, seen } = useInView<HTMLElement>(0.2);
  return (
    <section ref={ref} className={`${className} ${seen ? 'is-in' : ''}`} aria-labelledby={labelledBy}>
      {children}
    </section>
  );
};

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
  /* Chờ biết người dùng có kết quả hay chưa, tránh biểu đồ mẫu nháy lên rồi đổi sang biểu đồ thật */
  const isChartLoading = isProfileLoading || (learner && !isGuest && isResultLoading);
  const summary = useMemo(() => summarize(axes), [axes]);

  const heroFacts: HeroFact[] = [
    { key: 'groups', value: axes.length, label: 'Nhóm tiêu chí', icon: Layers },
    { key: 'questions', value: QUESTION_RANGE, label: 'Câu hỏi', icon: ListChecks },
    { key: 'minutes', value: MINUTE_RANGE, label: 'Tự đánh giá', icon: Timer },
    { key: 'raters', value: RATER_NODES.length, label: 'Nhóm góc nhìn', icon: Users },
  ];
  if (scale?.careers != null) heroFacts.push({ key: 'careers', value: scale.careers, label: 'Nghề nghiệp', icon: Briefcase });

  const exploreItems: ExploreItem[] = [
    { key: 'careers', value: scale?.careers ?? null, label: 'Nghề nghiệp', icon: Briefcase, to: '/danh-muc-nghe' },
    { key: 'majors', value: scale?.majors ?? null, label: 'Ngành học', icon: BookOpen, to: '/nganh-nghe' },
    { key: 'schools', value: scale?.schools ?? null, label: 'Trường', icon: School, to: '/kham-pha-truong' },
  ];

  return (
    <div className="home">
      {draftSaved && <Alert variant="success">Đã lưu tạm. Bạn có thể quay lại làm tiếp trong 7 ngày.</Alert>}

      <HomeHero
        canExplore={canExplore}
        testPath={testPath}
        axes={axes}
        isOwnResult={result !== null}
        isLoading={isChartLoading}
        raters={RATER_NODES}
        ratersPerGroup={MAX_EXPECTED_PER_GROUP}
        facts={heroFacts}
      />

      {!isGuest && !isProfileLoading && !learner && <Alert variant="info">Tài khoản của bạn chưa có chức năng nào trong giai đoạn này.</Alert>}

      <Feature
        id="feature-self"
        eyebrow="Tự đánh giá"
        title={
          <>
            Biểu đồ <span className="text-spectrum">{axes.length} nhóm tiêu chí</span> của riêng bạn
          </>
        }
        lead="Đánh giá cá nhân qua biểu đồ tố chất, từ đó gợi ý những ngành nghề phù hợp với bạn."
        action={canExplore ? { to: testPath, label: 'Làm bài test' } : undefined}
        visual={
          <div className="feature-panel">
            <div className="feature-panel-head">
              {isChartLoading ? <span /> : <Badge variant={result ? 'success' : 'default'}>{result ? 'Đánh giá của bạn' : 'Ví dụ'}</Badge>}
              {!isChartLoading && summary && (
                <div className="feature-panel-facts">
                  <span className="panel-fact">
                    Trung bình <b>{summary.average}%</b>
                  </span>
                  <span className="panel-fact is-highlight">
                    <Trophy size={14} aria-hidden="true" />
                    Nổi bật <b>{summary.top}</b>
                  </span>
                </div>
              )}
            </div>
            {isChartLoading ? (
              <PolygonChartSkeleton />
            ) : (
              <PolygonChart axes={axes} levels={POLYGON_LEVELS} showReadout={false} showNodeValues />
            )}
          </div>
        }
      />

      <Feature
        id="feature-360"
        flip
        eyebrow="Đánh giá 360"
        title={
          <>
            Đánh giá <span className="text-spectrum">360°</span> từ những người hiểu bạn
          </>
        }
        lead="Phụ huynh, bạn bè, giáo viên và người hướng dẫn cùng góp góc nhìn để kết quả không chỉ là cảm nhận của riêng bạn."
        action={canExplore ? { to: '/danh-gia-360', label: 'Khám phá' } : undefined}
        visual={
          <div className="feature-panel feature-panel-tint">
            <div className="feature-panel-head">
              <span className="panel-fact">
                <b>{RATER_NODES.length}</b> nhóm góc nhìn
              </span>
              <span className="panel-fact">
                <b>{MAX_EXPECTED_PER_GROUP}</b> người mỗi nhóm
              </span>
            </div>
            <Rater360 nodes={RATER_NODES} />
          </div>
        }
      />

      <RevealSection className="home-explore" labelledBy="home-explore-title">
        <div className="home-section-head">
          <span className="home-eyebrow reveal">Khám phá</span>
          <h2 id="home-explore-title" className="home-section-title reveal" style={{ '--d': 1 } as React.CSSProperties}>
            Nghề nghiệp, ngành học và trường
          </h2>
        </div>
        <ExploreLinks items={exploreItems} />
      </RevealSection>

      {canExplore && (
        <RevealSection className="home-closing" labelledBy="home-closing-title">
          <span className="home-closing-glow" aria-hidden="true" />
          <h2 id="home-closing-title" className="home-closing-title reveal">
            Biết mình là ai, <span>vững bước tương lai.</span>
          </h2>
          <Link to={testPath} className="home-closing-cta reveal" style={{ '--d': 1 } as React.CSSProperties}>
            <Button size="lg" rightIcon={<ArrowRight size={18} />}>
              Làm bài test
            </Button>
          </Link>
        </RevealSection>
      )}
    </div>
  );
};
