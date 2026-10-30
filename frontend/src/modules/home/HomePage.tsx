import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Alert, Badge, Button, LogoMark } from '../../components/common';
import { Globe360 } from '../../components/charts/Globe360/Globe360';
import { PolygonChart } from '../../components/charts/PolygonChart/PolygonChart';
import type { PolygonAxis } from '../../components/charts/PolygonChart/PolygonChart';
import { PolygonChartSkeleton } from '../../components/charts/PolygonChart/PolygonChartSkeleton';
import { COMPETENCY_LEVELS, GROUP_ICONS, GROUP_SHORT_LABELS } from '../assessment_result/assessmentResult.constants';
import { getLatestAssessmentResult } from '../assessment_result/assessmentResult.service';
import type { AssessmentResultSummary } from '../assessment_result/assessmentResult.types';
import { GLOBE_NODES } from '../assessment_360/assessment360.constants';
import { useAuth } from '../auth/AuthContext';
import { isLearnerRole } from '../profile/profile.logic';
import { useInView } from '../../hooks/useInView';
import { useStarFlight } from './useStarFlight';
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

/** Chưa tới lượt bay, đang bay, đã đáp */
type FlightPhase = 'waiting' | 'flying' | 'landed';

interface FeatureProps {
  id: string;
  /** Đưa hình minh họa sang bên trái, chữ sang bên phải */
  flip?: boolean;
  /** Hình đã tải xong; chưa xong thì chưa bay, để khung chờ tải không bay vào trang */
  ready?: boolean;
  /** Hình minh họa; dạng hàm nhận giai đoạn chuyến bay để hình nghỉ việc nặng khi chưa bay và làm nhẹ đi trong lúc bay */
  visual: React.ReactNode | ((phase: FlightPhase) => React.ReactNode);
  children: React.ReactNode;
}

/** Một hàng giới thiệu: chữ một bên, hình minh họa một bên; hàng sau đổi bên so với hàng trước.
 *  Hình bay vào như một ngôi sao theo đường cong, đuôi quét ngang qua chữ; sao đi qua rồi chữ mới hiện ra dần. */
const Feature: React.FC<FeatureProps> = ({ id, flip = false, ready = true, visual, children }) => {
  /* Chờ hàng hiện rõ hơn mới bắt đầu bay để người xem kịp thấy cả chặng bay */
  const { ref, seen } = useInView<HTMLElement>(0.3);
  const { copyRef, visualRef, canvasRef, started, landed } = useStarFlight(ref, seen, ready, flip);
  return (
    <section
      ref={ref}
      className={`feature ${flip ? 'feature-flip' : ''} ${started ? 'is-visible' : ''} ${landed ? 'is-landed' : ''}`}
      aria-labelledby={`${id}-title`}
    >
      {/* Canvas nằm dưới chữ: đuôi sao đi qua chữ, chữ hiện lên rõ nét trên đuôi */}
      <canvas ref={canvasRef} className="feature-trail" aria-hidden="true" />
      <div ref={copyRef} className="feature-copy">
        {children}
      </div>
      <div ref={visualRef} className="feature-visual">
        {typeof visual === 'function' ? visual(landed ? 'landed' : started ? 'flying' : 'waiting') : visual}
      </div>
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
  const testPath = isGuest ? '/lam-bai' : '/danh-gia-ca-nhan';
  const userId = session?.user.id;
  const [result, setResult] = useState<AssessmentResultSummary | null>(null);
  const [isResultLoading, setIsResultLoading] = useState(true);

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
            {isChartLoading ? (
              <PolygonChartSkeleton />
            ) : (
              <PolygonChart axes={axes} levels={POLYGON_LEVELS} showReadout={false} showNodeValues />
            )}
          </div>
        }
      >
        <h2 id="feature-self-title" className="feature-title">
          Tự đánh giá qua biểu đồ <span className="text-spectrum">{axes.length} nhóm tiêu chí</span>
        </h2>
        <p className="feature-lead">Trả lời từng câu hỏi ngắn, xem tố chất của bạn hiện lên thành một biểu đồ.</p>
        {canExplore && (
          <Link to={testPath} className="feature-link">
            <Button size="lg" rightIcon={<ArrowRight size={18} />}>
              Làm bài test
            </Button>
          </Link>
        )}
      </Feature>

      <Feature
        id="feature-360"
        flip
        visual={(phase) => (
          <div className="feature-stage">
            <Globe360 nodes={GLOBE_NODES} paused={phase === 'waiting'} lite={phase === 'flying'} />
          </div>
        )}
      >
        <h2 id="feature-360-title" className="feature-title">
          Đánh giá <span className="text-spectrum">360°</span> từ những người hiểu bạn
        </h2>
        <p className="feature-lead">
          Phụ huynh, bạn bè, giáo viên và người hướng dẫn cùng góp góc nhìn để kết quả không chỉ là cảm nhận của riêng bạn.
        </p>
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
