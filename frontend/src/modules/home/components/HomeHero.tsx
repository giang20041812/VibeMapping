import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, Trophy } from 'lucide-react';
import { Button } from '../../../components/common';
import { PolygonChart } from '../../../components/charts/PolygonChart/PolygonChart';
import type { PolygonAxis, PolygonLevel } from '../../../components/charts/PolygonChart/PolygonChart';
import { PolygonChartSkeleton } from '../../../components/charts/PolygonChart/PolygonChartSkeleton';
import { useParallax } from '../../../hooks/useParallax';
import './HomeHero.css';

interface HomeHeroProps {
  canExplore: boolean;
  testPath: string;
  axes: PolygonAxis[];
  levels: PolygonLevel[];
  /** Biểu đồ là kết quả thật của người dùng (không phải ví dụ) */
  isOwnResult: boolean;
  isLoading: boolean;
  /** id của phần hành trình để liên kết phụ cuộn tới */
  journeyId: string;
}

const CYCLE_MS = 2200;

/** Nhóm có điểm cao nhất, hiện thành nhãn cam trên bản đồ */
function topAxis(axes: PolygonAxis[]) {
  return axes.reduce<PolygonAxis | null>((best, a) => (a.value !== null && (best === null || (best.value ?? -1) < a.value) ? a : best), null);
}

/**
 * Phần mở đầu trang giới thiệu: nền navy với quầng sáng cam và xanh trời, tiêu đề lớn hiện từng dòng, nút chính cam
 * và bản đồ tố chất bảy nhóm phát sáng (kết quả thật nếu đã làm bài, nếu chưa là ví dụ), tự làm nổi lần lượt từng nhóm.
 */
export const HomeHero: React.FC<HomeHeroProps> = ({ canExplore, testPath, axes, levels, isOwnResult, isLoading, journeyId }) => {
  const heroRef = useRef<HTMLElement>(null);
  useParallax(heroRef);
  const top = topAxis(axes);

  return (
    <section ref={heroRef} className="hero" aria-labelledby="hero-title">
      <div className="hero-bg" aria-hidden="true">
        <span className="hero-orb hero-orb-coral" />
        <span className="hero-orb hero-orb-sky" />
        <span className="hero-orb hero-orb-deep" />
        <span className="hero-flutes" />
      </div>

      <div className="hero-copy">
        <h1 id="hero-title" className="hero-title">
          <span className="hero-line">
            <span>Biết mình là ai,</span>
          </span>
          <span className="hero-line">
            <span className="hero-title-accent">vững bước tương lai.</span>
          </span>
        </h1>
        <div className="hero-actions">
          {canExplore && (
            <Link to={testPath} className="hero-cta">
              <Button size="lg" rightIcon={<ArrowRight size={18} />}>
                Làm bài test
              </Button>
            </Link>
          )}
          <a href={`#${journeyId}`} className="hero-link">
            Xem hành trình
            <ArrowDown size={18} aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="hero-map">
        <div className="hero-map-head">
          {!isLoading && <span className="hero-chip">{isOwnResult ? 'Kết quả của bạn' : 'Ví dụ'}</span>}
          {!isLoading && top && (
            <span className="hero-chip is-highlight">
              <Trophy size={14} aria-hidden="true" />
              Nổi bật · {top.shortLabel ?? top.label}
            </span>
          )}
        </div>
        {isLoading ? (
          <PolygonChartSkeleton />
        ) : (
          <PolygonChart axes={axes} levels={levels} showReadout={false} showNodeValues autoCycleMs={CYCLE_MS} />
        )}
      </div>
    </section>
  );
};
