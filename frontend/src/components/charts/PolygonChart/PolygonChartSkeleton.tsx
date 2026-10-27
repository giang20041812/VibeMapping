import React from 'react';
import './PolygonChartSkeleton.css';

/** Khung chờ của biểu đồ đa giác: hai lớp đa giác bảy cạnh lồng nhau, cùng cỡ với biểu đồ thật */
export const PolygonChartSkeleton: React.FC = () => (
  <div className="polygon-skeleton" aria-hidden="true">
    <span className="app-skeleton polygon-skeleton-outer" />
    <span className="app-skeleton polygon-skeleton-inner" />
  </div>
);
