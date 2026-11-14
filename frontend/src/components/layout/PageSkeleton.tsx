import React from 'react';
import { Card, Skeleton, SkeletonRegion } from '../common';
import type { SkeletonWidth } from '../common';
import './PageSkeleton.css';

const LINE_WIDTHS: SkeletonWidth[] = [100, 85, 100, 70, 90, 60];

/** Khung chờ chung của một trang nội dung khi chưa biết trang đó dựng gì: tiêu đề và một thẻ nhiều dòng */
export const PageSkeleton: React.FC = () => (
  <SkeletonRegion>
    <Skeleton shape="title" className="page-skeleton-title" />
    <Card>
      <div className="page-skeleton-lines" aria-hidden="true">
        {LINE_WIDTHS.map((width, index) => (
          <Skeleton key={index} shape="text" width={width} />
        ))}
      </div>
    </Card>
  </SkeletonRegion>
);
