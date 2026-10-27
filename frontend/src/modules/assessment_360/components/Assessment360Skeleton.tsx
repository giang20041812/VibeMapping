import React from 'react';
import { Card, Skeleton, SkeletonRegion } from '../../../components/common';
import { GLOBE_NODES } from '../assessment360.constants';
import './GlobeSwitch.css';
import './Assessment360.css';
import './Assessment360Skeleton.css';

const REVIEW_TABS = [0, 1, 2];
const REVIEW_ROWS = [0, 1, 2];

/** Khung chờ của công tắc quả địa cầu: quả cầu, tiêu đề, nhãn trạng thái, bốn nhóm người đánh giá và công tắc */
export const GlobeSwitchSkeleton: React.FC = () => (
  <SkeletonRegion className="globe-switch is-off is-skeleton">
    <span className="globe-switch-globe" aria-hidden="true">
      <Skeleton shape="circle" />
    </span>
    <span className="globe-switch-body" aria-hidden="true">
      <Skeleton shape="text" width={45} className="globe-skeleton-title" />
      <Skeleton shape="chip" width={20} className="globe-skeleton-state" />
      <span className="globe-switch-groups">
        {GLOBE_NODES.map((node) => (
          <Skeleton key={node.key} shape="text" className="globe-skeleton-group" />
        ))}
      </span>
    </span>
    <span className="globe-switch-track globe-skeleton-track" aria-hidden="true" />
  </SkeletonRegion>
);

/** Khung chờ của danh sách bài đã nộp: tóm tắt tiến độ kèm nút chốt, thanh lọc nhóm và các dòng bài */
export const ReviewSkeleton: React.FC = () => (
  <SkeletonRegion className="t360-review-skeleton">
    <Card className="review-summary">
      <div className="review-summary-body" aria-hidden="true">
        <div className="review-progress">
          {REVIEW_TABS.map((slot) => (
            <Skeleton key={slot} shape="chip" className="review-skeleton-chip" />
          ))}
        </div>
        <Skeleton shape="button-lg" />
      </div>
    </Card>

    <div className="review-tabs" aria-hidden="true">
      {REVIEW_TABS.map((slot) => (
        <Skeleton key={slot} shape="block" className="review-skeleton-tab" />
      ))}
    </div>

    <ul className="review-list" aria-hidden="true">
      {REVIEW_ROWS.map((slot) => (
        <li key={slot} className="review-row review-row-skeleton">
          <div className="review-who">
            <Skeleton shape="block" className="review-skeleton-avatar" />
            <div className="review-who-text review-skeleton-text">
              <Skeleton shape="text" width={55} />
              <Skeleton shape="text" width={40} />
            </div>
          </div>
          <div className="review-quality">
            <Skeleton shape="text" width={50} />
            <div className="review-badges">
              <Skeleton shape="chip" />
              <Skeleton shape="chip" />
            </div>
          </div>
          <div className="review-actions">
            <Skeleton shape="button-sm" />
            <Skeleton shape="button-sm" />
          </div>
        </li>
      ))}
    </ul>
  </SkeletonRegion>
);
