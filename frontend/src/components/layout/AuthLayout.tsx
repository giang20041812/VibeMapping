import React from 'react';
import { Outlet } from 'react-router-dom';
import { Reveal, SplitText, trackPointer } from '../common';
import { AuthHomeLink } from '../../modules/auth/components/AuthHomeLink';
import { BRAND_SLOGAN, BRAND_SLOGAN_SUB, CORE_CAPABILITIES } from '../../modules/home/home.constants';
import { BrandLink } from './BrandLink';
import './AuthLayout.css';

/**
 * Khung trang đăng nhập, đăng ký, quên mật khẩu và nhập mã OTP: cùng ngôn ngữ với trang giới thiệu.
 * Thanh trên có logo và đường về trang chủ; bên trái là khẩu hiệu cỡ lớn trên nền lưới mảnh cùng ba trọng tâm,
 * bên phải là mặt giấy trắng chứa form. Điện thoại chỉ giữ thanh trên và form.
 */
export const AuthLayout: React.FC = () => {
  return (
    <div className="auth-shell">
      <header className="auth-top">
        <BrandLink />
        <AuthHomeLink />
      </header>

      <div className="auth-body">
        <aside className="auth-hero" onPointerMove={trackPointer}>
          <div className="auth-hero-bg" aria-hidden="true">
            <span className="auth-hero-grid" />
            <span className="auth-hero-spot" />
            <span className="auth-hero-halo" />
          </div>

          <p className="auth-hero-slogan">
            <SplitText text={BRAND_SLOGAN[0]} className="auth-hero-line" delayMs={60} staggerMs={80} />
            <SplitText text={BRAND_SLOGAN[1]} className="auth-hero-line split-accent" delayMs={340} staggerMs={80} />
          </p>

          <div className="auth-hero-foot">
            <ul className="auth-hero-index">
              {CORE_CAPABILITIES.map((item, idx) => (
                <li key={item.targetId} className="auth-hero-index-cell">
                  <Reveal y={18} delayMs={620 + idx * 90} className="auth-hero-index-item">
                    <item.icon size={20} strokeWidth={1.8} className="auth-hero-index-icon" aria-hidden="true" />
                    <span className="auth-hero-index-title">{item.title}</span>
                  </Reveal>
                </li>
              ))}
            </ul>
            <p className="auth-hero-slogan-sub">{BRAND_SLOGAN_SUB.join(' ')}</p>
          </div>
        </aside>

        <main className="auth-panel">
          <div className="auth-panel-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
