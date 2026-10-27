import React from 'react';
import { Card, Skeleton, SkeletonRegion } from '../../../components/common';
import { PARTS } from '../assessmentSession.constants';
import './AssessmentStartPanel.css';
import './StartPanelSkeleton.css';

const PACKAGE_SLOTS = [0, 1, 2];

/** Khung chờ của phần chọn gói: ba thẻ gói, bảng số câu theo phần và nút bắt đầu */
export const StartPanelSkeleton: React.FC = () => (
  <SkeletonRegion className="start-layout">
    <div className="start-choice" aria-hidden="true">
      <div className="package-grid">
        {PACKAGE_SLOTS.map((slot) => (
          <div key={slot} className="package-card is-skeleton">
            <Skeleton shape="heading" width={50} />
            <Skeleton shape="heading" width={35} className="package-skeleton-count" />
            <Skeleton shape="text" width={40} />
            <Skeleton shape="text" width={70} />
          </div>
        ))}
      </div>

      <Card title="Số câu theo phần" className="parts-card">
        <div className="table-responsive parts-table-wrap">
          <table className="parts-table">
            <thead>
              <tr>
                <th scope="col">Phần</th>
                <th scope="col" className="parts-count-col">
                  Số câu
                </th>
              </tr>
            </thead>
            <tbody>
              {PARTS.map((part) => (
                <tr key={part.number}>
                  <td>
                    <span className="parts-skeleton-name">
                      <Skeleton shape="circle" className="parts-skeleton-number" />
                      <Skeleton shape="text" width={60} />
                    </span>
                  </td>
                  <td className="parts-count-col">
                    <Skeleton shape="text" width={30} className="parts-skeleton-count" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>

    <div className="start-actions" aria-hidden="true">
      <Skeleton shape="button-lg" />
    </div>
  </SkeletonRegion>
);
