import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Building2, Compass, Layers } from 'lucide-react';
import { Magnetic, Reveal, RollText, SplitText, trackPointer } from '../../../components/common';
import { useCountUp } from '../../../hooks/useCountUp';
import { useInView } from '../../../hooks/useInView';
import { PARTS } from '../../assessment_session/assessmentSession.constants';
import { BRAND_SLOGAN, CORE_CAPABILITIES } from '../home.constants';
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
          <SplitText text={BRAND_SLOGAN[0]} className="hero-title-line" delayMs={60} staggerMs={80} />
          <SplitText
            text={BRAND_SLOGAN[1]}
            className="hero-title-line split-accent"
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
                className="hero-index-item hover-sweep"
                onClick={(e) => scrollToTarget(e, item.targetId)}
              >
                <span className="hero-index-num" aria-hidden="true">
                  <item.icon size={22} strokeWidth={1.8} />
                </span>
                <span className="hero-index-title">{item.title}</span>
                <ArrowUpRight size={20} className="hero-index-arrow hover-sweep-arrow" aria-hidden="true" />
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
    </section>
  );
};
