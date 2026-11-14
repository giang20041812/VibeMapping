import React from 'react';

export interface NavIconProps {
  size?: number;
}

/* Biểu tượng song sắc: nét viền currentColor, phần tô nhạt currentColor để nổi khối */
const Svg: React.FC<NavIconProps & { children: React.ReactNode }> = ({ size = 22, children }) => (
  <svg
    className="nav-icon"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const HomeIcon: React.FC<NavIconProps> = (props) => (
  <Svg {...props}>
    <path className="nav-icon-fill" d="M3.5 11 12 3.5 20.5 11V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19Z" />
    <path d="M9.5 20.5v-5.2a2.5 2.5 0 0 1 5 0v5.2" />
  </Svg>
);

/** Ngũ giác méo giống thoi, có tâm và các trục tỏa ra như biểu đồ năng lực */
export const PersonalIcon: React.FC<NavIconProps> = (props) => (
  <Svg {...props}>
    <path className="nav-icon-fill" d="M12 2.8 20.2 9.4 17 20 7 20 3.8 9.4Z" />
    <path className="nav-icon-inner" d="M12 8 16 11 14.6 15.6 9.4 15.6 8 11Z" />
    <path className="nav-icon-axis" d="M12 2.8V8M20.2 9.4 16 11M17 20l-2.4-4.4M7 20l2.4-4.4M3.8 9.4 8 11" />
  </Svg>
);

/** Quả cầu có kinh tuyến và vĩ tuyến */
export const Globe360Icon: React.FC<NavIconProps> = (props) => (
  <Svg {...props}>
    <circle className="nav-icon-fill" cx="12" cy="12" r="9" />
    <ellipse className="nav-icon-axis" cx="12" cy="12" rx="3.8" ry="9" />
    <path className="nav-icon-axis" d="M3 12h18M4.6 7.4h14.8M4.6 16.6h14.8" />
  </Svg>
);
