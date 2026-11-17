import React from 'react';
import { Link } from 'react-router-dom';
import { RollText, SplitText } from '../../../components/common';
import { BrandLink } from '../../../components/layout/BrandLink';
import { topbarItemsFor } from '../../../components/layout/navigation';
import { BRAND_SLOGAN_SUB } from '../home.constants';
import './HomeFooter.css';

export interface HomeFooterProps {
  isGuest: boolean;
}

/**
 * Phần kết trang giới thiệu: câu khẩu hiệu thứ hai ở cỡ chữ lớn nhất trang,
 * bên dưới là một hàng chân trang gồm logo, các mục điều hướng và dòng bản quyền.
 */
export const HomeFooter: React.FC<HomeFooterProps> = ({ isGuest }) => (
  <footer className="home-footer">
    <p className="home-footer-slogan">
      <SplitText text={BRAND_SLOGAN_SUB[0]} className="home-footer-line" staggerMs={80} />
      <SplitText text={BRAND_SLOGAN_SUB[1]} className="home-footer-line split-accent" delayMs={260} staggerMs={80} />
    </p>

    <div className="home-footer-bar">
      <BrandLink compact />

      <nav className="home-footer-links" aria-label="Chân trang">
        {topbarItemsFor(isGuest).map((item) => (
          <Link key={item.to} to={item.to} className="home-footer-link roll-trigger">
            <RollText text={item.label} />
          </Link>
        ))}
      </nav>

      <span className="home-footer-copy">© {new Date().getFullYear()} Vibe Mapping</span>
    </div>
  </footer>
);
