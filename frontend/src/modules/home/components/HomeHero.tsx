import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Building2,
  Compass,
  Layers,
  Target,
  Users,
} from 'lucide-react';
import {
  Magnetic,
  Reveal,
  RollText,
  SplitText,
  SpotlightCard,
} from '../../../components/common';
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
  {
    num: '01',
    targetId: 'step-self',
    icon: Users,
    title: 'Đánh giá năng lực 360°',
    meta: '7 nhóm tố chất · 4 góc nhìn khách quan',
  },
  {
    num: '02',
    targetId: 'step-fit',
    icon: Compass,
    title: 'Đối chiếu nghề – ngành – trường',
    meta: 'Xếp hạng tương thích · Điểm chuẩn · Học phí',
  },
  {
    num: '03',
    targetId: 'step-roadmap',
    icon: Target,
    title: 'Lộ trình phát triển cá nhân',
    meta: 'Kiến thức · Kỹ năng · Dự án thực tế',
  },
] as const;

/**
 * Phần mở đầu trang chủ phong cách HTDNSK:
 * SplitText trồi từng chữ, CTA Magnetic + btn-fill + RollText,
 * 3 thẻ SpotlightCard tương tác và 4 thẻ quy mô (Câu hỏi, Nghề, Ngành, Trường) phân tách rõ ràng.
 */
export const HomeHero: React.FC<HomeHeroProps> = ({
  canExplore,
  testPath,
  journeyId,
  questionRange,
  minuteRange,
  scale,
}) => {
  const careersCount = scale?.careers != null ? scale.careers.toLocaleString('vi-VN') : '120+';
  const majorsCount = scale?.majors != null ? scale.majors.toLocaleString('vi-VN') : '180+';
  const schoolsCount = scale?.schools != null ? scale.schools.toLocaleString('vi-VN') : '250+';

  const scrollToTarget = (e: React.MouseEvent, targetId: string) => {
    const el = document.getElementById(targetId);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-bg" aria-hidden="true">
        <span className="hero-grid-layer hero-grid" />
        <span className="hero-ambient-top" />
        <span className="hero-ambient-corner" />
      </div>

      <div className="hero-inner">
        {/* Khối 1: Tiêu đề & Nút kêu gọi hành động */}
        <div className="hero-header-block">
          <Reveal y={16} delayMs={20}>
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-line" aria-hidden="true" />
              <span className="hero-eyebrow-code">01 //</span>
              <span>Hệ thống định hướng nghề nghiệp & phát triển năng lực</span>
            </div>
          </Reveal>

          <h1 id="hero-title" className="hero-title">
            <SplitText text="Biết mình là ai," delayMs={60} staggerMs={75} />
            <SplitText
              text="vững bước tương lai."
              className="hero-title-accent"
              delayMs={320}
              staggerMs={75}
            />
          </h1>

          <Reveal y={20} delayMs={480} className="hero-actions">
            {canExplore && (
              <Magnetic strength={0.16} className="hero-cta-wrap">
                <Link to={testPath} className="hero-cta-primary btn-fill">
                  <RollText text="Bắt đầu làm bài đánh giá" />
                  <ArrowRight size={18} className="btn-arrow-slide" aria-hidden="true" />
                </Link>
              </Magnetic>
            )}

            <Magnetic strength={0.12} className="hero-cta-wrap">
              <a
                href={`#${journeyId}`}
                className="hero-cta-secondary roll-trigger"
                onClick={(e) => {
                  const el = document.getElementById(journeyId);
                  if (el) {
                    e.preventDefault();
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              >
                <RollText text="Khám phá lộ trình 5 bước" />
                <ArrowDown size={17} className="hero-arrow-down" aria-hidden="true" />
              </a>
            </Magnetic>
          </Reveal>
        </div>

        {/* Khối 2: 3 Trụ cột năng lực cốt lõi (Spotlight Cards đồng nhất, không dùng viền cạnh lệch) */}
        <div className="hero-section-group">
          <div className="hero-divider-bar">
            <span className="hero-divider-label">Trọng tâm hệ thống</span>
            <span className="hero-divider-line" aria-hidden="true" />
          </div>

          <div className="hero-capabilities" role="list" aria-label="Ba trọng tâm cốt lõi">
            {CORE_CAPABILITIES.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.num} y={28} delayMs={560 + idx * 90} className="hero-capability-cell">
                  <SpotlightCard
                    role="listitem"
                    className="hero-capability-card"
                    onClick={(e) => scrollToTarget(e, item.targetId)}
                  >
                    <div className="hero-capability-top">
                      <span className="hero-capability-num">{item.num}</span>
                      <span className="hero-capability-icon" aria-hidden="true">
                        <Icon size={18} />
                      </span>
                      <ArrowUpRight size={17} className="hero-capability-arrow" aria-hidden="true" />
                    </div>
                    <div className="hero-capability-body">
                      <strong className="hero-capability-title">{item.title}</strong>
                      <span className="hero-capability-meta">{item.meta}</span>
                    </div>
                  </SpotlightCard>
                </Reveal>
              );
            })}
          </div>
        </div>

        {/* Khối 3: Quy mô hệ thống (Số câu hỏi · Số nghề · Số ngành · Số trường) */}
        <div className="hero-section-group">
          <div className="hero-divider-bar">
            <span className="hero-divider-label">Quy mô dữ liệu chuẩn hóa</span>
            <span className="hero-divider-line" aria-hidden="true" />
          </div>

          <dl className="hero-stats" aria-label="Quy mô hệ thống">
            <Reveal y={24} delayMs={760}>
              <SpotlightCard className="hero-stat">
                <dt className="hero-stat-label">
                  <span className="hero-stat-icon" aria-hidden="true">
                    <Layers size={15} />
                  </span>
                  <span>Quy mô bài đánh giá</span>
                </dt>
                <dd className="hero-stat-value">{questionRange} câu</dd>
                <dd className="hero-stat-sub">{minuteRange.replace('′', '')} phút thực hiện · 4 phần</dd>
              </SpotlightCard>
            </Reveal>

            <Reveal y={24} delayMs={830}>
              <SpotlightCard className="hero-stat">
                <dt className="hero-stat-label">
                  <span className="hero-stat-icon" aria-hidden="true">
                    <Compass size={15} />
                  </span>
                  <span>Nghề nghiệp chuẩn hóa</span>
                </dt>
                <dd className="hero-stat-value">{careersCount}</dd>
                <dd className="hero-stat-sub">Ma trận tiêu chí & mã Holland</dd>
              </SpotlightCard>
            </Reveal>

            <Reveal y={24} delayMs={900}>
              <SpotlightCard className="hero-stat">
                <dt className="hero-stat-label">
                  <span className="hero-stat-icon" aria-hidden="true">
                    <BookOpen size={15} />
                  </span>
                  <span>Ngành đào tạo</span>
                </dt>
                <dd className="hero-stat-value">{majorsCount}</dd>
                <dd className="hero-stat-sub">Liên kết chuẩn nghề nghiệp</dd>
              </SpotlightCard>
            </Reveal>

            <Reveal y={24} delayMs={970}>
              <SpotlightCard className="hero-stat">
                <dt className="hero-stat-label">
                  <span className="hero-stat-icon" aria-hidden="true">
                    <Building2 size={15} />
                  </span>
                  <span>Trường ĐH & Cao đẳng</span>
                </dt>
                <dd className="hero-stat-value">{schoolsCount}</dd>
                <dd className="hero-stat-sub">Điểm chuẩn & học phí cập nhật</dd>
              </SpotlightCard>
            </Reveal>
          </dl>
        </div>
      </div>
    </section>
  );
};
