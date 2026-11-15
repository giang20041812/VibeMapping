import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, UserRound, type LucideIcon } from 'lucide-react';
import { Button } from '../../../components/common';
import type { PolygonAxis } from '../../../components/charts/PolygonChart/PolygonChart';
import type { RaterNode } from '../../../components/charts/Rater360/Rater360';
import { useCountUp } from '../../../hooks/useCountUp';
import { useInView } from '../../../hooks/useInView';
import { useParallax } from '../../../hooks/useParallax';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import './HomeHero.css';

export interface HeroFact {
  key: string;
  value: number | string;
  label: string;
  icon: LucideIcon;
}

interface HomeHeroProps {
  canExplore: boolean;
  testPath: string;
  axes: PolygonAxis[];
  /** Biểu đồ là kết quả thật của người dùng (không phải ví dụ) */
  isOwnResult: boolean;
  isLoading: boolean;
  raters: RaterNode[];
  ratersPerGroup: number;
  facts: HeroFact[];
}

const FACT_MS = 3200;

/** Số đếm dần khi hiện ra; giá trị chữ (ví dụ "6–18′") hiện nguyên */
const CountValue: React.FC<{ value: number | string; run: boolean }> = ({ value, run }) => {
  const isNumber = typeof value === 'number';
  const counted = useCountUp(isNumber && run ? value : null, 1200);
  if (!isNumber) return <>{value}</>;
  return <>{Math.round(run ? (counted ?? 0) : 0).toLocaleString('vi-VN')}</>;
};

/** Thẻ kính xem trước kết quả tự đánh giá: điểm trung bình và ba nhóm cao nhất, nhóm cao nhất tô cam */
const ResultCard: React.FC<{ axes: PolygonAxis[]; isOwnResult: boolean; isLoading: boolean }> = ({ axes, isOwnResult, isLoading }) => {
  const scored = axes.filter((a): a is PolygonAxis & { value: number } => a.value !== null);
  const average = scored.length ? Math.round(scored.reduce((sum, a) => sum + a.value, 0) / scored.length) : null;
  const top = [...scored].sort((a, b) => b.value - a.value).slice(0, 3);
  return (
    <div className="hero-card hero-card-result">
      <div className="hero-card-head">
        <span className="hero-card-title">{isOwnResult ? 'Kết quả của bạn' : 'Tự đánh giá'}</span>
        {!isOwnResult && !isLoading && <span className="hero-card-chip">Ví dụ</span>}
      </div>
      {isLoading || average === null ? (
        <div className="hero-card-wait" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ) : (
        <>
          <div className="hero-card-score">
            <b>{average}%</b>
            <span>Trung bình</span>
          </div>
          <ul className="hero-bars">
            {top.map((axis, i) => (
              <li key={axis.key} className={`hero-bar ${i === 0 ? 'is-top' : ''}`} style={{ '--value': `${axis.value}%`, '--i': i } as React.CSSProperties}>
                <span className="hero-bar-name">{axis.shortLabel ?? axis.label}</span>
                <span className="hero-bar-track">
                  <span className="hero-bar-fill" />
                </span>
                <span className="hero-bar-value">{Math.round(axis.value)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

/** Thẻ kính tóm tắt đánh giá 360°: bạn ở giữa, các nhóm người đánh giá xếp quanh */
const RaterCard: React.FC<{ raters: RaterNode[]; perGroup: number }> = ({ raters, perGroup }) => (
  <div className="hero-card hero-card-raters">
    <div className="hero-card-head">
      <span className="hero-card-title">Đánh giá 360</span>
      <span className="hero-card-meta">{perGroup} người mỗi nhóm</span>
    </div>
    <div className="hero-raters">
      {raters.slice(0, 2).map(({ key, label, Icon }) => (
        <span key={key} className="hero-rater" title={label}>
          <Icon aria-hidden="true" />
        </span>
      ))}
      <span className="hero-rater hero-rater-self" title="Bạn">
        <UserRound aria-hidden="true" />
      </span>
      {raters.slice(2).map(({ key, label, Icon }) => (
        <span key={key} className="hero-rater" title={label}>
          <Icon aria-hidden="true" />
        </span>
      ))}
    </div>
    <ul className="hero-rater-names">
      {raters.map(({ key, label }) => (
        <li key={key}>{label}</li>
      ))}
    </ul>
  </div>
);

/**
 * Phần mở đầu trang giới thiệu: nền navy với quầng sáng cam và xanh trời, tiêu đề lớn hiện từng dòng,
 * nút chính cam, thẻ kính xem trước kết quả và dải chỉ số tự làm nổi lần lượt từng mục.
 */
export const HomeHero: React.FC<HomeHeroProps> = ({ canExplore, testPath, axes, isOwnResult, isLoading, raters, ratersPerGroup, facts }) => {
  const heroRef = useRef<HTMLElement>(null);
  useParallax(heroRef);
  const reduced = useReducedMotion();
  const { ref: stripRef, inView: stripInView, seen: stripSeen } = useInView<HTMLUListElement>(0.4);
  const [factIndex, setFactIndex] = useState(0);
  const cycling = stripInView && !reduced && facts.length > 1;

  useEffect(() => {
    if (!cycling) return;
    const id = window.setInterval(() => setFactIndex((i) => (i + 1) % facts.length), FACT_MS);
    return () => window.clearInterval(id);
  }, [cycling, facts.length]);

  return (
    <section ref={heroRef} className="hero" aria-labelledby="hero-title">
      <div className="hero-bg" aria-hidden="true">
        <span className="hero-orb hero-orb-coral" />
        <span className="hero-orb hero-orb-sky" />
        <span className="hero-orb hero-orb-deep" />
        <span className="hero-flutes" />
      </div>

      <div className="hero-main">
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
            <Link to="/danh-muc-nghe" className="hero-link">
              Khám phá nghề nghiệp
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="hero-preview">
          <ResultCard axes={axes} isOwnResult={isOwnResult} isLoading={isLoading} />
          <RaterCard raters={raters} perGroup={ratersPerGroup} />
        </div>
      </div>

      <ul ref={stripRef} className={`hero-strip ${cycling ? 'is-cycling' : ''}`}>
        {facts.map(({ key, value, label, icon: Icon }, i) => (
          <li key={key} className={`hero-fact ${i === factIndex ? 'is-active' : ''}`} style={{ '--i': i } as React.CSSProperties}>
            <span className="hero-fact-icon" aria-hidden="true">
              <Icon size={18} strokeWidth={2} />
            </span>
            <span className="hero-fact-text">
              <b>
                <CountValue value={value} run={stripSeen} />
              </b>
              <span>{label}</span>
            </span>
            <span className="hero-fact-progress" key={i === factIndex ? `on-${factIndex}` : 'off'} aria-hidden="true" />
          </li>
        ))}
      </ul>
    </section>
  );
};
