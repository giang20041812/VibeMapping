import React from 'react';
import { PolygonChartSkeleton } from '../../components/charts/PolygonChart/PolygonChartSkeleton';
import { PageSkeleton } from '../../components/layout/PageSkeleton';
import { GlobeSwitchSkeleton, ReviewSkeleton } from '../assessment_360/components/Assessment360Skeleton';
import { ResultSkeleton } from '../assessment_result/components/ResultSkeleton';
import { RunSkeleton } from '../assessment_session/components/RunSkeleton';
import { StartPanelSkeleton } from '../assessment_session/components/StartPanelSkeleton';
import { GuestIntroSkeleton } from '../guest_assessment/components/GuestIntroSkeleton';
import { ProfileSkeleton } from '../profile/components/ProfileSkeleton';

/** Xem lần lượt mọi khung chờ để đối chiếu với trang thật (chỉ có khi chạy dev) */
export const SkeletonSamplePage: React.FC = () => (
  <>
    <h1 className="page-title">Hồ sơ cá nhân</h1>
    <ProfileSkeleton />
    <h1 className="page-title">Đánh giá cá nhân</h1>
    <ResultSkeleton />
    <h1 className="page-title">Làm bài đánh giá</h1>
    <StartPanelSkeleton />
    <h1 className="page-title">Đang làm bài</h1>
    <RunSkeleton />
    <h1 className="page-title">Đánh giá 360</h1>
    <GlobeSwitchSkeleton />
    <ReviewSkeleton />
    <h1 className="page-title">Khách mời</h1>
    <GuestIntroSkeleton />
    <h1 className="page-title">Biểu đồ trang chủ</h1>
    <PolygonChartSkeleton />
    <h1 className="page-title">Trang chung</h1>
    <PageSkeleton />
  </>
);
