import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, BookOpen, Briefcase, Gauge, Layers, ListChecks, Orbit, School, Timer, Trophy, Users } from 'lucide-react';
import { Alert, Badge, Button, LogoMark } from '../../components/common';
import { Globe360 } from '../../components/charts/Globe360/Globe360';
import { PolygonChart } from '../../components/charts/PolygonChart/PolygonChart';
import type { PolygonAxis } from '../../components/charts/PolygonChart/PolygonChart';
import { PolygonChartSkeleton } from '../../components/charts/PolygonChart/PolygonChartSkeleton';
import { COMPETENCY_LEVELS, GROUP_ICONS, GROUP_SHORT_LABELS } from '../assessment_result/assessmentResult.constants';
import { getLatestAssessmentResult } from '../assessment_result/assessmentResult.service';
import type { AssessmentResultSummary } from '../assessment_result/assessmentResult.types';
import { GLOBE_NODES } from '../assessment_360/assessment360.constants';
import { PACKAGES } from '../assessment_session/assessmentSession.constants';
import { MAX_EXPECTED_PER_GROUP } from '../invitation_link/invitation.constants';
import { getCatalogScale, type CatalogScale } from './home.service';
import { StatSticker, StatTiles, StatInline, type StatItem } from './components/HomeStats';
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

const VIEW_STATS: StatItem[] = [
  { key: 'groups', value: GLOBE_NODES.length, label: 'Nhóm góc nhìn', icon: Users, tone: 'gold' },
  { key: 'raters', value: MAX_EXPECTED_PER_GROUP, label: 'Người mỗi nhóm', icon: Orbit, tone: 'cyan' },
  { key: 'merge', value: '360°', label: 'Kết quả gộp', icon: Gauge, tone: 'magenta' },
];

/** Điểm trung bình và nhóm nổi bật nhất của biểu đồ, hiện thành nhãn dán trên hình */
function summarize(axes: PolygonAxis[]) {
  const scored = axes.filter((a): a is PolygonAxis & { value: number } => a.value !== null);
  if (scored.length === 0) return null;
  const average = Math.round(scored.reduce((sum, a) => sum + a.value, 0) / scored.length);
  const top = scored.reduce((best, a) => (a.value > best.value ? a : best));
  return { average, top: top.shortLabel ?? top.label };
}

/** Chờ hình tải xong tối đa chừng này rồi vẫn hiện, để hàng không trống mãi khi máy chủ chậm */
const READY_TIMEOUT_MS = 3000;

interface FeatureProps {
  id: string;
  /** Đưa hình minh họa sang bên trái, chữ sang bên phải */
  flip?: boolean;
  /** Hình đã tải xong; chưa xong thì chưa nhún, để khung chờ tải không nhún vào trang */
  ready?: boolean;
  /** Hình minh họa; dạng hàm nhận `started` để hình nghỉ việc nặng khi chưa tới lượt hiện */
  visual: React.ReactNode | ((started: boolean) => React.ReactNode);
  children: React.ReactNode;
}

/** Một hàng giới thiệu: chữ một bên, hình minh họa một bên; hàng sau đổi bên so với hàng trước.
 *  Khi hàng hiện ra, từng phần nhún vào lần lượt (hình, nhãn dán, tiêu đề, mô tả, số liệu, nút). */
const Feature: React.FC<FeatureProps> = ({ id, flip = false, ready = true, visual, children }) => {
  const { ref, seen } = useInView<HTMLElement>(0.3);
  const [waitedEnough, setWaitedEnough] = useState(false);

  useEffect(() => {
    if (!seen || ready) return;
    const timer = window.setTimeout(() => setWaitedEnough(true), READY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [seen, ready]);

  const started = seen && (ready || waitedEnough);
  return (
    <section ref={ref} className={`feature ${flip ? 'feature-flip' : ''} ${started ? 'is-visible' : ''}`} aria-labelledby={`${id}-title`}>
      <div className="feature-copy">{children}</div>
      <div className="feature-visual">{typeof visual === 'function' ? visual(started) : visual}</div>
    </section>
  );
};

/** Khoảng cách từ biểu tượng tới giữa tiêu đề: biểu tượng bắt đầu ở giữa rồi trượt về chỗ của nó.
 *  Đo lại khi phông chữ tải xong vì độ rộng chữ đổi vị trí biểu tượng. */
function useCenterShift() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const title = titleRef.current;
      const mark = markRef.current;
      if (!title || !mark) return;
      /* Tiêu đề là khung định vị của biểu tượng; offsetLeft đo theo bố cục, bỏ qua transform đang chạy */
      title.style.setProperty('--brand-shift', `${title.clientWidth / 2 - (mark.offsetLeft + mark.offsetWidth / 2)}px`);
    };
    measure();
    let active = true;
    document.fonts?.ready.then(() => {
      if (active) measure();
    });
    return () => {
      active = false;
    };
  }, []);

  return { titleRef, markRef };
}

export const HomePage: React.FC = () => {
  const { titleRef, markRef } = useCenterShift();
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
  const selfStats: StatItem[] = [
    { key: 'groups', value: axes.length, label: 'Nhóm tiêu chí', icon: Layers, tone: 'violet' },
    { key: 'questions', value: QUESTION_RANGE, label: 'Câu hỏi', icon: ListChecks, tone: 'sky' },
    { key: 'minutes', value: MINUTE_RANGE, label: 'Tự đánh giá', icon: Timer, tone: 'teal' },
  ];
  const scaleStats: StatItem[] = [];
  if (scale) {
    if (scale.careers !== null) scaleStats.push({ key: 'careers', value: scale.careers, label: 'Nghề nghiệp', icon: Briefcase, tone: 'violet' });
    if (scale.majors !== null) scaleStats.push({ key: 'majors', value: scale.majors, label: 'Ngành học', icon: BookOpen, tone: 'cyan' });
    if (scale.schools !== null) scaleStats.push({ key: 'schools', value: scale.schools, label: 'Trường', icon: School, tone: 'magenta' });
  }

  return (
    <div className="home">
      {draftSaved && <Alert variant="success">Đã lưu tạm. Bạn có thể quay lại làm tiếp trong 7 ngày.</Alert>}

      <header className="home-brand">
        <h1 ref={titleRef} className="home-brand-title" aria-label="Vibe Mapping">
          <span className="home-brand-word">
            <span ref={markRef} className="home-brand-mark" aria-hidden="true">
              <LogoMark animated draw />
            </span>
            <span className="home-brand-vibe">Vibe</span>
          </span>
          <span className="home-brand-mapping">Mapping</span>
        </h1>
        <p className="home-brand-lead">Biết mình là ai, vững bước tương lai.</p>
      </header>

      {!isGuest && !isProfileLoading && !learner && <Alert variant="info">Tài khoản của bạn chưa có chức năng nào trong giai đoạn này.</Alert>}

      <Feature
        id="feature-self"
        ready={!isChartLoading}
        visual={
          <div className="feature-stage">
            {result && <span className="feature-badge"><Badge variant="success">Đánh giá của bạn</Badge></span>}
            {!result && !isChartLoading && <span className="feature-badge"><Badge variant="default">Ví dụ</Badge></span>}
            {isChartLoading ? (
              <PolygonChartSkeleton />
            ) : (
              <PolygonChart axes={axes} levels={POLYGON_LEVELS} showReadout={false} showNodeValues />
            )}
            {!isChartLoading && summary && (
              <>
                <StatSticker place="top-left" tone="violet" icon={Gauge} value={`${summary.average}%`} label="Trung bình" />
                <StatSticker place="bottom-right" tone="gold" icon={Trophy} value={summary.top} label="Nổi bật" />
              </>
            )}
          </div>
        }
      >
        <h2 id="feature-self-title" className="feature-title">
          Tự đánh giá qua biểu đồ <span className="text-spectrum">{axes.length} nhóm tiêu chí</span>
        </h2>
        <p className="feature-lead">Đánh giá cá nhân qua biểu đồ tố chất, từ đó gợi ý những ngành nghề phù hợp với bạn.</p>
        <StatTiles items={selfStats} />
        {canExplore && (
          <Link to={testPath} className="feature-link">
            <Button size="lg" rightIcon={<ArrowRight size={18} />}>
              Làm bài test
            </Button>
          </Link>
        )}
        {scaleStats.length > 0 && <StatInline items={scaleStats} />}
      </Feature>

      <Feature
        id="feature-360"
        flip
        visual={(started) => (
          <div className="feature-stage">
            <Globe360 nodes={GLOBE_NODES} paused={!started} />
            <StatSticker place="top-left" tone="cyan" icon={Orbit} value="360°" label="Đa góc nhìn" />
            <StatSticker place="bottom-right" tone="magenta" icon={Users} value={`${GLOBE_NODES.length} + Bạn`} label="Người đánh giá" />
          </div>
        )}
      >
        <h2 id="feature-360-title" className="feature-title">
          Đánh giá <span className="text-spectrum">360°</span> từ những người hiểu bạn
        </h2>
        <p className="feature-lead">
          Phụ huynh, bạn bè, giáo viên và người hướng dẫn cùng góp góc nhìn để kết quả không chỉ là cảm nhận của riêng bạn.
        </p>
        <StatTiles items={VIEW_STATS} />
        {canExplore && (
          <Link to="/danh-gia-360" className="feature-link">
            <Button size="lg" rightIcon={<ArrowRight size={18} />}>
              Khám phá
            </Button>
          </Link>
        )}
      </Feature>

    </div>
  );
};
