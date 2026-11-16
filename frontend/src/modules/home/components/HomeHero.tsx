import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Building2, Compass, Layers, Target, Users } from 'lucide-react';
import { Magnetic, Reveal, RollText, SplitText, trackPointer } from '../../../components/common';
import { useCountUp } from '../../../hooks/useCountUp';
import { useInView } from '../../../hooks/useInView';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { PARTS } from '../../assessment_session/assessmentSession.constants';
import type { CatalogScale } from '../home.service';
import './HomeHero.css';

export interface HomeHeroProps {
  canExplore: boolean;
  testPath: string;
  journeyId: string;
  questionRange: string;
  minuteRange: string;
  scale: CatalogScale | null;
}

const CORE_CAPABILITIES = [
  { targetId: 'step-self', icon: Users, title: 'Đánh giá năng lực 360°' },
  { targetId: 'step-fit', icon: Compass, title: 'Đối chiếu nghề – ngành – trường' },
  { targetId: 'step-roadmap', icon: Target, title: 'Lộ trình phát triển cá nhân' },
] as const;

const MARQUEE_TOP = PARTS.map((part) => part.short);
const MARQUEE_BOTTOM = ['Đánh giá 360°', 'Nghề phù hợp', 'So sánh phương án', 'Lộ trình'];

const parseRange = (range: string): [number, number] | null => {
  const nums = range.match(/\d+/g)?.map(Number) ?? [];
  return nums.length >= 2 ? [nums[0], nums[1]] : null;
};

const formatCount = (value: number | null) => (value === null ? '—' : Math.round(value).toLocaleString('vi-VN'));

/** Số đếm từ 0 khi khối chỉ số lần đầu lọt vào khung nhìn */
const CountUp: React.FC<{ value: number | null; active: boolean; delayMs?: number }> = ({ value, active, delayMs = 0 }) => {
  const current = useCountUp(active ? value : null, 1400, delayMs);
  if (value === null) return <>—</>;
  return <>{formatCount(active ? current : 0)}</>;
};

/** Dải chữ chạy vô hạn: tăng tốc và đổi chiều theo tốc độ cuộn trang, chậm lại khi rê chuột */
const VelocityMarquee: React.FC<{ items: string[]; baseVelocity: number; outline?: boolean }> = ({
  items,
  baseVelocity,
  outline = false,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const row = rowRef.current;
    const track = trackRef.current;
    if (!row || !track || reduced) return;

    let x = 0;
    let dir = 1;
    let velocity = 0;
    let speed = 1;
    let targetSpeed = 1;
    let lastTime = 0;
    let lastY = window.scrollY;
    let raf = 0;
    let visible = false;

    const tick = (now: number) => {
      const dt = lastTime ? Math.min(now - lastTime, 64) / 1000 : 0;
      lastTime = now;
      const y = window.scrollY;
      const instant = dt > 0 ? (y - lastY) / dt : 0;
      lastY = y;
      velocity += (instant - velocity) * 0.12;
      const factor = velocity / 250;
      if (factor < -0.05) dir = -1;
      else if (factor > 0.05) dir = 1;
      speed += (targetSpeed - speed) * 0.08;
      x += dir * baseVelocity * dt * (1 + Math.min(Math.abs(factor), 6)) * speed;
      x = ((((x + 25) % 25) + 25) % 25) - 50;
      track.style.transform = `translate3d(${x.toFixed(3)}%, 0, 0)`;
      raf = visible ? requestAnimationFrame(tick) : 0;
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) {
        lastTime = 0;
        lastY = window.scrollY;
        raf = requestAnimationFrame(tick);
      }
    });
    observer.observe(row);

    const slow = () => (targetSpeed = 0.18);
    const resume = () => (targetSpeed = 1);
    row.addEventListener('pointerenter', slow);
    row.addEventListener('pointerleave', resume);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      row.removeEventListener('pointerenter', slow);
      row.removeEventListener('pointerleave', resume);
    };
  }, [baseVelocity, reduced]);

  return (
    <div ref={rowRef} className={`hero-marquee-row ${outline ? 'is-outline' : ''}`}>
      <div ref={trackRef} className="hero-marquee-track">
        {[0, 1, 2, 3].map((copy) => (
          <span key={copy} className="hero-marquee-copy">
            {items.map((item) => (
              <span key={item} className="hero-marquee-item">
                <span className="hero-marquee-word">{item}</span>
                <span className="hero-marquee-dot" />
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
};

/**
 * Phần mở đầu trang chủ: nền trắng liền mạch với trang, chữ mực đậm, không khung bo góc.
 * Tiêu đề lớn trồi từng chữ, dòng nhấn được tô dần; ba trọng tâm và bốn chỉ số chỉ phân tách bằng đường kẻ thẳng.
 */
export const HomeHero: React.FC<HomeHeroProps> = ({
  canExplore,
  testPath,
  journeyId,
  questionRange,
  minuteRange,
  scale,
}) => {
  const { ref: statsRef, seen: statsSeen } = useInView<HTMLDListElement>(0.3);
  const questions = parseRange(questionRange);
  const minutes = minuteRange.replace('′', '');

  const scrollToTarget = (e: React.MouseEvent, targetId: string) => {
    const el = document.getElementById(targetId);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: targetId === journeyId ? 'start' : 'center' });
  };

  /* Mục danh mục không đọc được (null sau khi tải xong) thì ẩn; trong lúc tải vẫn giữ chỗ */
  const hidden = (value: number | null | undefined) => scale !== null && value == null;

  const stats = [
    {
      key: 'questions',
      isHidden: false,
      icon: Layers,
      label: 'Quy mô bài đánh giá',
      value: questions ? (
        <>
          <CountUp value={questions[0]} active={statsSeen} />
          <span className="hero-stat-dash">–</span>
          <CountUp value={questions[1]} active={statsSeen} delayMs={120} />
          <span className="hero-stat-unit">câu</span>
        </>
      ) : (
        questionRange
      ),
      sub: `${minutes} phút thực hiện · ${PARTS.length} phần`,
    },
    {
      key: 'careers',
      isHidden: hidden(scale?.careers),
      icon: Compass,
      label: 'Nghề nghiệp chuẩn hóa',
      value: <CountUp value={scale?.careers ?? null} active={statsSeen} delayMs={90} />,
      sub: 'Ma trận tiêu chí & mã Holland',
    },
    {
      key: 'majors',
      isHidden: hidden(scale?.majors),
      icon: BookOpen,
      label: 'Ngành đào tạo',
      value: <CountUp value={scale?.majors ?? null} active={statsSeen} delayMs={180} />,
      sub: 'Liên kết chuẩn nghề nghiệp',
    },
    {
      key: 'schools',
      isHidden: hidden(scale?.schools),
      icon: Building2,
      label: 'Trường ĐH & Cao đẳng',
      value: <CountUp value={scale?.schools ?? null} active={statsSeen} delayMs={270} />,
      sub: 'Điểm chuẩn & học phí cập nhật',
    },
  ].filter((stat) => !stat.isHidden);

  return (
    <section className="hero" aria-labelledby="hero-title" onPointerMove={trackPointer}>
      <div className="hero-bg" aria-hidden="true">
        <span className="hero-bg-grid" />
        <span className="hero-bg-spot" />
        <span className="hero-bg-halo" />
      </div>

      <div className="hero-top">
        <h1 id="hero-title" className="hero-title">
          <SplitText text="Biết mình là ai," className="hero-title-line" delayMs={60} staggerMs={80} />
          <SplitText
            text="vững bước tương lai."
            className="hero-title-line hero-title-accent"
            delayMs={340}
            staggerMs={80}
          />
        </h1>

        <Reveal y={20} delayMs={620} className="hero-actions">
          {canExplore && (
            <Magnetic strength={0.16} className="hero-cta-wrap">
              <Link to={testPath} className="hero-cta-primary btn-fill btn-fill-ink">
                <RollText text="Bắt đầu làm bài đánh giá" />
                <ArrowRight size={18} className="btn-arrow-slide" aria-hidden="true" />
              </Link>
            </Magnetic>
          )}

          <a
            href={`#${journeyId}`}
            className="hero-cta-link roll-trigger"
            onClick={(e) => scrollToTarget(e, journeyId)}
          >
            <RollText text="Khám phá lộ trình 5 bước" />
            <span className="hero-cta-link-icon" aria-hidden="true">
              <ArrowDown size={16} />
            </span>
          </a>
        </Reveal>
      </div>

      <ul className="hero-index" aria-label="Trọng tâm">
        {CORE_CAPABILITIES.map((item, idx) => (
          <li key={item.targetId} className="hero-index-cell">
            <Reveal y={22} delayMs={760 + idx * 90}>
              <a
                href={`#${item.targetId}`}
                className="hero-index-item"
                onClick={(e) => scrollToTarget(e, item.targetId)}
              >
                <span className="hero-index-num" aria-hidden="true">
                  <item.icon size={22} strokeWidth={1.8} />
                </span>
                <span className="hero-index-title">{item.title}</span>
                <ArrowUpRight size={20} className="hero-index-arrow" aria-hidden="true" />
              </a>
            </Reveal>
          </li>
        ))}
      </ul>

      <dl
        ref={statsRef}
        className={`hero-stats ${statsSeen ? 'is-visible' : ''}`}
        style={{ '--stat-cols': stats.length } as React.CSSProperties}
      >
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.key}
              className="hero-stat"
              style={{ '--stat-i': idx } as React.CSSProperties}
            >
              <dt className="hero-stat-label">
                <Icon size={16} className="hero-stat-icon" aria-hidden="true" />
                <span>{stat.label}</span>
              </dt>
              <dd className="hero-stat-value">{stat.value}</dd>
              <dd className="hero-stat-sub">{stat.sub}</dd>
            </div>
          );
        })}
      </dl>

      <div className="hero-marquee" aria-hidden="true">
        <VelocityMarquee items={MARQUEE_TOP} baseVelocity={-1.8} />
        <VelocityMarquee items={MARQUEE_BOTTOM} baseVelocity={1.8} outline />
      </div>
    </section>
  );
};
