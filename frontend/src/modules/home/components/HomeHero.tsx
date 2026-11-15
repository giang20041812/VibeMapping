import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Building2,
  Compass,
  Layers,
  Target,
  Users,
} from 'lucide-react';
import { Button } from '../../../components/common';
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
    icon: Users,
    title: 'Đánh giá năng lực 360°',
    meta: '7 nhóm tố chất · 4 góc nhìn khách quan',
  },
  {
    icon: Compass,
    title: 'Đối chiếu nghề – ngành – trường',
    meta: 'Xếp hạng tương thích · Điểm chuẩn · Học phí',
  },
  {
    icon: Target,
    title: 'Lộ trình phát triển cá nhân',
    meta: 'Kiến thức · Kỹ năng · Dự án thực tế',
  },
] as const;

/**
 * Phần mở đầu trang chủ: trình bày gọn gàng, sạch sẽ, không có mô tả thừa hay quy trình lặp lại,
 * hiển thị đầy đủ quy mô nghề nghiệp, ngành đào tạo, trường đại học/cao đẳng và 3 năng lực cốt lõi.
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

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-bg" aria-hidden="true">
        <span className="hero-grid-layer hero-grid" />
      </div>

      <div className="hero-inner">
        <div className="hero-main">
          <div className="hero-copy">
            <span className="hero-eyebrow">
              <span className="hero-eyebrow-line" aria-hidden="true" />
              Hệ thống định hướng nghề nghiệp & phát triển năng lực
            </span>

            <h1 id="hero-title" className="hero-title">
              <span>Biết mình là ai,</span>
              <span className="hero-title-accent">vững bước tương lai.</span>
            </h1>

            <div className="hero-actions">
              {canExplore && (
                <Link to={testPath} className="hero-cta">
                  <Button size="lg" rightIcon={<ArrowRight size={18} />}>
                    Bắt đầu làm bài đánh giá
                  </Button>
                </Link>
              )}
              <a
                href={`#${journeyId}`}
                className="hero-link"
                onClick={(e) => {
                  const el = document.getElementById(journeyId);
                  if (el) {
                    e.preventDefault();
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              >
                <span>Xem lộ trình 5 bước</span>
                <ArrowDown size={17} aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* 3 Năng lực trọng tâm — ngắn gọn, không văn bản giải thích dài dòng */}
          <ul className="hero-capabilities" aria-label="Năng lực cốt lõi">
            {CORE_CAPABILITIES.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="hero-capability">
                  <span className="hero-capability-icon" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <div className="hero-capability-body">
                    <strong className="hero-capability-title">{item.title}</strong>
                    <span className="hero-capability-meta">{item.meta}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Thanh thống kê quy mô đầy đủ: Bài đánh giá · Nghề nghiệp · Ngành đào tạo · Trường đào tạo */}
        <dl className="hero-stats" aria-label="Quy mô hệ thống">
          <div className="hero-stat">
            <dt className="hero-stat-label">
              <Layers size={15} aria-hidden="true" />
              <span>Quy mô bài đánh giá</span>
            </dt>
            <dd className="hero-stat-value">{questionRange} câu</dd>
            <dd className="hero-stat-sub">{minuteRange.replace('′', '')} phút thực hiện · 4 phần</dd>
          </div>

          <div className="hero-stat">
            <dt className="hero-stat-label">
              <Compass size={15} aria-hidden="true" />
              <span>Nghề nghiệp chuẩn hóa</span>
            </dt>
            <dd className="hero-stat-value">{careersCount}</dd>
            <dd className="hero-stat-sub">Ma trận tiêu chí & mã Holland</dd>
          </div>

          <div className="hero-stat">
            <dt className="hero-stat-label">
              <BookOpen size={15} aria-hidden="true" />
              <span>Ngành đào tạo</span>
            </dt>
            <dd className="hero-stat-value">{majorsCount}</dd>
            <dd className="hero-stat-sub">Liên kết chuẩn nghề nghiệp</dd>
          </div>

          <div className="hero-stat">
            <dt className="hero-stat-label">
              <Building2 size={15} aria-hidden="true" />
              <span>Trường ĐH & Cao đẳng</span>
            </dt>
            <dd className="hero-stat-value">{schoolsCount}</dd>
            <dd className="hero-stat-sub">Điểm chuẩn & học phí cập nhật</dd>
          </div>
        </dl>
      </div>
    </section>
  );
};
