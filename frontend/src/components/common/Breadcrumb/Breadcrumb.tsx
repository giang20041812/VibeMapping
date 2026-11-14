import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import './Breadcrumb.css';

export interface BreadcrumbItem {
  label: string;
  /** Bỏ trống ở mục cuối (trang hiện tại) */
  to?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => (
  <nav className="app-breadcrumb" aria-label="Đường dẫn">
    <ol>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <li key={`${index}-${item.label}`}>
            {last || !item.to ? (
              <span className="app-breadcrumb-current" aria-current={last ? 'page' : undefined}>{item.label}</span>
            ) : (
              <Link to={item.to} className="app-breadcrumb-link">{item.label}</Link>
            )}
            {!last && <ChevronRight size={14} className="app-breadcrumb-sep" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  </nav>
);
