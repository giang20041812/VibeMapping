import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ClipboardCheck,
  Compass,
  Layers,
  Route,
  Scale,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { Button } from '../../../components/common';
import { useParallax } from '../../../hooks/useParallax';
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

const trackSpotlight = (e: React.PointerEvent<HTMLElement>) => {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
  el.style.setProperty('--my', `${e.clientY - rect.top}px`);
};

const OVERVIEW_PILLARS = [
  {
    code: '01',
    icon: Users,
    title: 'Đánh giá năng lực đa chiều',
    summary:
      'Kết hợp bài tự đánh giá 7 nhóm tố chất cá nhân với phản hồi 360° khách quan từ Phụ huynh, Giáo viên, Bạn bè và Người hướng dẫn.',
    tag: 'Tự đánh giá & 360°',
  },
  {
    code: '02',
    icon: Scale,
    title: 'Đối chiếu nghề & trường đào tạo',
    summary:
      'Xếp hạng nghề nghiệp theo độ tương thích thực tế, đặt các phương án Trường – Ngành cạnh nhau theo điểm chuẩn, học phí và địa điểm.',
    tag: 'Nghề phù hợp & So sánh',
  },
  {
    code: '03',
    icon: Target,
    title: 'Thiết lập lộ trình thực chiến',
    summary:
      'Chuyển hóa mục tiêu nghề nghiệp thành kế hoạch hành động cụ thể qua từng chặng kiến thức, kỹ năng và dự án thực tế.',
    tag: 'Kế hoạch từng chặng',
  },
] as const;

const PIPELINE_STEPS = [
  { step: '01', id: 'step-self', label: 'Tự đánh giá', sub: '7 nhóm tố chất', icon: ClipboardCheck },
  { step: '02', id: 'step-360', label: 'Đánh giá 360°', sub: '4 góc nhìn khách quan', icon: Users },
  { step: '03', id: 'step-fit', label: 'Nghề phù hợp', sub: 'Xếp hạng tương thích', icon: Compass },
  { step: '04', id: 'step-compare', label: 'So sánh phương án', sub: 'Trường · Ngành · Học phí', icon: Scale },
  { step: '05', id: 'step-roadmap', label: 'Lộ trình cá nhân', sub: 'Cột mốc tới mục tiêu', icon: Route },
] as const;

const SplitWords: React.FC<{ text: string; baseDelay?: number; stepDelay?: number; accent?: boolean }> = ({
  text,
  baseDelay = 0,
  stepDelay = 65,
  accent = false,
}) => {
  const words = text.split(' ');
  return (
    <span className={`hero-split-line ${accent ? 'is-accent' : ''}`} aria-label={text}>
      {words.map((word, index) => (
        <React.Fragment key={`${word}-${index}`}>
          <span className="hero-word-mask" aria-hidden="true">
            <span
              className="hero-word"
              style={{ '--word-delay': `${baseDelay + index * stepDelay}ms` } as React.CSSProperties}
            >
              {word}
            </span>
          </span>
          {index < words.length - 1 && ' '}
        </React.Fragment>
      ))}
    </span>
  );
};

/**
 * Phần mở đầu trang chủ: giới thiệu tổng quan gọn gàng, sâu sắc về hệ thống Vibe Mapping,
 * 3 trụ cột giá trị cốt lõi và chuỗi 5 bước định hướng (không đặt biểu đồ đánh giá cá nhân ở đầu trang).
 */
export const HomeHero: React.FC<HomeHeroProps> = ({
  canExplore,
  testPath,
  journeyId,
  questionRange,
  minuteRange,
  scale,
}) => {
  const heroRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useParallax(heroRef);

  // Chiều sâu khi cuộn qua Hero (kế thừa từ HTDNSK HeroSection): thu nhẹ + mờ dần khi cuộn xuống
  useEffect(() => {
    const hero = heroRef.current;
    const content = contentRef.current;
    if (!hero || !content) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    const updateDepth = () => {
      raf = 0;
      const rect = hero.getBoundingClientRect();
      const height = Math.max(rect.height, 1);
      const progress = Math.max(0, Math.min(1, -rect.top / height));
      const scaleVal = 1 - progress * 0.045;
      const opacityVal = Math.max(0.25, 1 - progress * 0.72);
      const yVal = progress * 44;
      content.style.transform = `translate3d(0, ${yVal.toFixed(1)}px, 0) scale(${scaleVal.toFixed(4)})`;
      content.style.opacity = opacityVal.toFixed(3);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(updateDepth);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const scrollToElement = (e: React.MouseEvent, targetId: string) => {
    const el = document.getElementById(targetId);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <section ref={heroRef} className="hero" aria-labelledby="hero-title">
      <div className="hero-bg" aria-hidden="true">
        <span className="hero-grid-layer hero-grid" />
        <span className="hero-orb hero-orb-coral" />
        <span className="hero-orb hero-orb-sky" />
        <span className="hero-orb hero-orb-deep" />
        <span className="hero-flutes" />
      </div>

      <div ref={contentRef} className="hero-inner">
        {/* Dòng định danh hệ thống */}
        <div className="hero-top-row">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-line" aria-hidden="true" />
            <Sparkles size={14} aria-hidden="true" />
            <span>Hệ thống định hướng nghề nghiệp & phát triển năng lực</span>
          </div>

          <div className="hero-meta-pills">
            <span className="hero-meta-pill">
              <Layers size={13} aria-hidden="true" />
              {questionRange} câu hỏi · {minuteRange.replace('′', '')} phút
            </span>
            {scale?.careers != null && (
              <span className="hero-meta-pill">
                <Compass size={13} aria-hidden="true" />
                {scale.careers.toLocaleString('vi-VN')} nghề nghiệp chuẩn hóa
              </span>
            )}
          </div>
        </div>

        {/* Tiêu đề chính & Tổng quan hệ thống */}
        <div className="hero-CopyBlock">
          <h1 id="hero-title" className="hero-title">
            <SplitWords text="Biết mình là ai," baseDelay={40} stepDelay={70} />
            <SplitWords text="vững bước tương lai." baseDelay={320} stepDelay={70} accent />
          </h1>

          <p className="hero-overview">
            Vibe Mapping đồng hành cùng học sinh và sinh viên trên trọn vẹn hành trình hướng nghiệp: từ{' '}
            <strong>đánh giá bản thân đa chiều</strong>, <strong>lắng nghe phản hồi 360°</strong>,{' '}
            <strong>xác định nghề phù hợp</strong>, <strong>so sánh trường đào tạo</strong> đến{' '}
            <strong>xây dựng lộ trình học tập thực tế</strong> để chạm tới mục tiêu.
          </p>

          <div className="hero-actions">
            {canExplore && (
              <Link to={testPath} className="hero-cta">
                <Button size="lg" rightIcon={<ArrowRight size={18} />}>
                  <span className="roll">
                    <span className="roll-inner" data-text="Bắt đầu làm bài đánh giá">
                      Bắt đầu làm bài đánh giá
                    </span>
                  </span>
                </Button>
              </Link>
            )}
            <a
              href={`#${journeyId}`}
              className="hero-link roll-trigger"
              onClick={(e) => {
                const el = document.getElementById(journeyId);
                if (el) {
                  e.preventDefault();
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              <span className="roll">
                <span className="roll-inner" data-text="Khám phá hành trình 5 bước">
                  Khám phá hành trình 5 bước
                </span>
              </span>
              <ArrowDown size={17} aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* 3 Trụ cột tổng quan (Spotlight Cards kế thừa từ HTDNSK) */}
        <div className="hero-pillars" role="list" aria-label="Ba trụ cột cốt lõi">
          {OVERVIEW_PILLARS.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.code}
                role="listitem"
                className="hero-pillar spotlight"
                style={{ '--pillar-i': idx } as React.CSSProperties}
                onPointerMove={trackSpotlight}
              >
                <div className="hero-pillar-head">
                  <span className="hero-pillar-icon" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <span className="hero-pillar-tag">{pillar.tag}</span>
                  <span className="hero-pillar-code">{pillar.code}</span>
                </div>
                <h2 className="hero-pillar-title">{pillar.title}</h2>
                <p className="hero-pillar-summary">{pillar.summary}</p>
              </article>
            );
          })}
        </div>

        {/* Thanh tổng quan quy trình 5 bước nối tiếp */}
        <div className="hero-pipeline-wrap">
          <div className="hero-pipeline-head">
            <span className="hero-pipeline-label">Quy trình định hướng khép kín 5 bước</span>
            <span className="hero-pipeline-hint">Chọn một bước để xem chi tiết bên dưới</span>
          </div>
          <ol className="hero-pipeline">
            {PIPELINE_STEPS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <li key={item.id} className="hero-pipeline-item" style={{ '--step-i': idx } as React.CSSProperties}>
                  <a
                    href={`#${item.id}`}
                    className="hero-pipeline-card spotlight"
                    onPointerMove={trackSpotlight}
                    onClick={(e) => scrollToElement(e, item.id)}
                  >
                    <span className="hero-pipeline-num">{item.step}</span>
                    <span className="hero-pipeline-icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <span className="hero-pipeline-text">
                      <strong className="hero-pipeline-name">{item.label}</strong>
                      <span className="hero-pipeline-sub">{item.sub}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
};
