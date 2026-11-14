import React from 'react';
import './Skeleton.css';

export type SkeletonShape =
  | 'text'
  | 'heading'
  | 'title'
  | 'chip'
  | 'bar'
  | 'input'
  | 'button-sm'
  | 'button'
  | 'button-lg'
  | 'circle'
  | 'block';

export type SkeletonWidth = 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55 | 60 | 65 | 70 | 75 | 80 | 85 | 90 | 100;

export interface SkeletonProps {
  /** Hình khối khớp với phần tử thật mà nó thay thế (chiều cao lấy theo cỡ chữ / ô điều khiển) */
  shape?: SkeletonShape;
  /** Chiều rộng theo % của khung chứa; bỏ trống thì dùng mặc định của hình khối */
  width?: SkeletonWidth;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ shape = 'block', width, className = '' }) => (
  <span
    className={`app-skeleton skeleton-${shape} ${width ? `skeleton-w-${width}` : ''} ${className}`}
    aria-hidden="true"
  />
);

/** Vùng đang tải: báo cho trình đọc màn hình, các Skeleton bên trong chỉ để nhìn */
export const SkeletonRegion: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={className} role="status" aria-busy="true" aria-live="polite">
    <span className="sr-only">Đang tải</span>
    {children}
  </div>
);

/** Một ô nhập liệu đang tải: nhãn phía trên và ô nhập, cùng khoảng cách như Input thật */
export const SkeletonField: React.FC<{ labelWidth?: SkeletonWidth }> = ({ labelWidth = 30 }) => (
  <div className="app-input-group" aria-hidden="true">
    <Skeleton shape="text" width={labelWidth} />
    <Skeleton shape="input" />
  </div>
);
