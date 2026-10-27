import React from 'react';
import { Card, Skeleton, SkeletonField, SkeletonRegion } from '../../../components/common';
import '../pages/ProfilePage.css';

/** Khung chờ của trang hồ sơ: nhãn nhóm, lưới sáu ô nhập, nút lưu, đúng bố cục của form thật */
export const ProfileSkeleton: React.FC = () => (
  <>
    <h1 className="page-title">Hồ sơ cá nhân</h1>
    <Card className="profile-card">
      <SkeletonRegion className="profile-form">
        <div className="profile-group" aria-hidden="true">
          <Skeleton shape="chip" width={30} />
        </div>
        <div className="profile-grid" aria-hidden="true">
          <SkeletonField labelWidth={30} />
          <SkeletonField labelWidth={20} />
          <SkeletonField labelWidth={25} />
          <SkeletonField labelWidth={35} />
          <SkeletonField labelWidth={15} />
          <SkeletonField labelWidth={40} />
        </div>
        <div className="profile-actions" aria-hidden="true">
          <Skeleton shape="button-lg" />
        </div>
      </SkeletonRegion>
    </Card>
  </>
);
