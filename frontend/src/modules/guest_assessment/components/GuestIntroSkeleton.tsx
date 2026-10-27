import React from 'react';
import { Card, Skeleton, SkeletonField, SkeletonRegion } from '../../../components/common';
import type { SkeletonWidth } from '../../../components/common';
import '../pages/GuestAssessmentPage.css';
import './ChoiceGroup.css';
import './GuestIntroSkeleton.css';

/** Số lựa chọn ở bốn nhóm câu hỏi giới thiệu: mối quan hệ, thời gian quen biết, tần suất tiếp xúc, mức độ hiểu */
const CHOICE_GROUPS: { label: SkeletonWidth; options: number }[] = [
  { label: 30, options: 4 },
  { label: 35, options: 4 },
  { label: 30, options: 4 },
  { label: 25, options: 3 },
];

/** Khung chờ của trang khách mời: tiêu đề kèm nhãn nhóm, ô biệt danh, các nhóm lựa chọn và nút bắt đầu */
export const GuestIntroSkeleton: React.FC = () => (
  <Card className="guest-card">
    <SkeletonRegion className="guest-intro">
      <div className="guest-intro-head" aria-hidden="true">
        <Skeleton shape="heading" width={55} className="guest-skeleton-title" />
        <Skeleton shape="chip" />
      </div>

      <SkeletonField labelWidth={20} />

      {CHOICE_GROUPS.map((group, index) => (
        <div key={index} className="choice-group" aria-hidden="true">
          <Skeleton shape="text" width={group.label} className="guest-skeleton-legend" />
          <div className="choice-options">
            {Array.from({ length: group.options }, (_, option) => (
              <Skeleton key={option} shape="block" className="guest-skeleton-option" />
            ))}
          </div>
        </div>
      ))}

      <Skeleton shape="button-lg" className="guest-skeleton-submit" />
    </SkeletonRegion>
  </Card>
);
