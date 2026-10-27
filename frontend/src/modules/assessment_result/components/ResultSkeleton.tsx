import React from 'react';
import { Card, Skeleton, SkeletonRegion } from '../../../components/common';
import { PolygonChartSkeleton } from '../../../components/charts/PolygonChart/PolygonChartSkeleton';
import { GROUP_SHORT_LABELS } from '../assessmentResult.constants';
import './ResultView.css';

const GROUP_ROWS = Object.keys(GROUP_SHORT_LABELS);

/** Khung chờ của ResultView: biểu đồ bên trái, bảng điểm theo nhóm bên phải, dùng lại đúng lưới của trang kết quả */
export const ResultSkeleton: React.FC = () => (
  <SkeletonRegion className="result-view">
    <div className="result-grid">
      <div className="result-chart">
        <PolygonChartSkeleton />
      </div>

      <Card title="Điểm theo nhóm tiêu chí" className="result-groups-card">
        <ul className="group-list" aria-hidden="true">
          {GROUP_ROWS.map((code) => (
            <li key={code} className="group-row">
              <div className="group-row-head">
                <Skeleton shape="text" width={55} />
                <Skeleton shape="heading" width={15} />
              </div>
              <div className="group-row-bars">
                <Skeleton shape="bar" />
              </div>
              <div className="group-row-foot">
                <Skeleton shape="chip" />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  </SkeletonRegion>
);
