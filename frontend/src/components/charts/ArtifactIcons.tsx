import React, { forwardRef } from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';

function createBespokeIcon(displayName: string, renderPaths: () => React.ReactNode): LucideIcon {
  const Component = forwardRef<SVGSVGElement, LucideProps>(
    ({ size = 24, strokeWidth = 1.85, className = '', ...rest }, ref) => (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`bespoke-icon ${className}`}
        aria-hidden="true"
        {...rest}
      >
        {renderPaths()}
      </svg>
    ),
  );
  Component.displayName = displayName;
  return Component as unknown as LucideIcon;
}

/* ==========================================================================
   NHÓM NGƯỜI ĐÁNH GIÁ 360° (PHỤ HUYNH, GIÁO VIÊN, BẠN BÈ, NGƯỜI HƯỚNG DẪN)
   ========================================================================== */

/** Phụ huynh: Người lớn dắt tay người con, nét gọn để rõ ở kích thước nhỏ */
export const ParentRaterIcon: LucideIcon = createBespokeIcon('ParentRaterIcon', () => (
  <>
    <circle cx="8.5" cy="6.5" r="2.8" fill="currentColor" fillOpacity="0.2" />
    <path d="M3.5 20.5v-2.2a5 5 0 0 1 10 0v2.2" />
    <circle cx="17.2" cy="11" r="2.1" fill="currentColor" fillOpacity="0.2" />
    <path d="M14.2 20.5v-1.3a3 3 0 0 1 6 0v1.3" />
  </>
));

/** Giáo viên: Mũ học vị tri thức */
export const TeacherRaterIcon: LucideIcon = createBespokeIcon('TeacherRaterIcon', () => (
  <>
    <path d="M12 4 2.5 8.8 12 13.6l9.5-4.8L12 4Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M6.5 11v4.6c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3V11" />
    <path d="M21.5 8.8v5.4" />
  </>
));

/** Bạn bè: Hai người bạn ngang hàng đứng cạnh nhau */
export const FriendRaterIcon: LucideIcon = createBespokeIcon('FriendRaterIcon', () => (
  <>
    <circle cx="8.5" cy="8" r="2.8" fill="currentColor" fillOpacity="0.2" />
    <path d="M3.5 20v-1.5a5 5 0 0 1 10 0V20" />
    <circle cx="16" cy="8" r="2.8" fill="currentColor" fillOpacity="0.2" />
    <path d="M15.6 13.5a5 5 0 0 1 4.9 5V20" />
  </>
));

/** Người hướng dẫn (Mentor): La bàn định hướng */
export const MentorRaterIcon: LucideIcon = createBespokeIcon('MentorRaterIcon', () => (
  <>
    <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.12" />
    <path d="m15.8 8.2-2.3 5.3-5.3 2.3 2.3-5.3 5.3-2.3Z" fill="currentColor" fillOpacity="0.35" />
  </>
));

/** Trung tâm sơ đồ 360° (Bạn): Học sinh / Sinh viên ở vị trí trung tâm với huy hiệu tỏa sáng */
export const LearnerCenterIcon: LucideIcon = createBespokeIcon('LearnerCenterIcon', () => (
  <>
    <circle cx="12" cy="8.5" r="3.6" fill="currentColor" fillOpacity="0.24" />
    <path
      d="M5.2 20.2c0-3.5 3-6.2 6.8-6.2s6.8 2.7 6.8 6.2"
      fill="currentColor"
      fillOpacity="0.16"
    />
    <path d="M12 14v3.2M10.4 15.6h3.2" />
  </>
));

/* ==========================================================================
   7 NHÓM TỐ CHẤT ĐÁNH GIÁ CÁ NHÂN (G1 – G7)
   ========================================================================== */

/** G1 – Tính cách: Lăng kính kim cương đa diện thể hiện bản sắc cá nhân */
export const PersonalityGroupIcon: LucideIcon = createBespokeIcon('PersonalityGroupIcon', () => (
  <>
    <polygon
      points="12,2.8 19.5,8.2 16.6,19.8 7.4,19.8 4.5,8.2"
      fill="currentColor"
      fillOpacity="0.18"
    />
    <path d="M4.5 8.2h15M12 2.8l-3.2 5.4L12 19.8l3.2-11.6L12 2.8Z" />
  </>
));

/** G2 – Tư duy: Mạng liên kết trí tuệ và phân tích logic */
export const ThinkingGroupIcon: LucideIcon = createBespokeIcon('ThinkingGroupIcon', () => (
  <>
    <path
      d="M9.5 4.2a3.5 3.5 0 0 0-3.4 4.3A3.8 3.8 0 0 0 4.5 12c0 1.7 1.1 3.1 2.6 3.6a3.4 3.4 0 0 0 3.4 4.2h1v-15.6h-2Z"
      fill="currentColor"
      fillOpacity="0.18"
    />
    <path
      d="M14.5 4.2a3.5 3.5 0 0 1 3.4 4.3A3.8 3.8 0 0 1 19.5 12c0 1.7-1.1 3.1-2.6 3.6a3.4 3.4 0 0 1-3.4 4.2h-1v-15.6h2Z"
      fill="currentColor"
      fillOpacity="0.18"
    />
    <circle cx="9" cy="9.5" r="1" fill="currentColor" />
    <circle cx="15" cy="9.5" r="1" fill="currentColor" />
    <circle cx="9" cy="14.5" r="1" fill="currentColor" />
    <circle cx="15" cy="14.5" r="1" fill="currentColor" />
    <path d="M9 9.5h6M9 14.5h6" />
  </>
));

/** G3 – Giao tiếp: Hai luồng hội thoại kết nối đa chiều */
export const CommunicationGroupIcon: LucideIcon = createBespokeIcon('CommunicationGroupIcon', () => (
  <>
    <path
      d="M4 6.5A2.5 2.5 0 0 1 6.5 4h7A2.5 2.5 0 0 1 16 6.5v4A2.5 2.5 0 0 1 13.5 13H8l-4 3V6.5Z"
      fill="currentColor"
      fillOpacity="0.2"
    />
    <path d="M16 8.5h1.5A2.5 2.5 0 0 1 20 11v4a2.5 2.5 0 0 1-2.5 2.5H16l3.5 2.8v-2.8" />
    <path d="M7.5 8.5h5M7.5 10.8h3" />
  </>
));

/** G4 – Thái độ: Tấm khiên chuẩn mực và ngôi sao trách nhiệm bền bỉ */
export const AttitudeGroupIcon: LucideIcon = createBespokeIcon('AttitudeGroupIcon', () => (
  <>
    <path
      d="M12 3 4.8 6.2v5.4c0 4.8 3.1 8.9 7.2 10.4 4.1-1.5 7.2-5.6 7.2-10.4V6.2L12 3Z"
      fill="currentColor"
      fillOpacity="0.18"
    />
    <path d="m9.2 12.2 2 2 3.8-3.8" strokeWidth="2.1" />
  </>
));

/** G5 – Lãnh đạo: Vương miện & ngọn cờ dẫn dắt đội ngũ */
export const LeadershipGroupIcon: LucideIcon = createBespokeIcon('LeadershipGroupIcon', () => (
  <>
    <path
      d="M3.8 17.5 5.5 7.8l4.3 3.7L12 5.5l2.2 6 4.3-3.7 1.7 9.7H3.8Z"
      fill="currentColor"
      fillOpacity="0.2"
    />
    <path d="M4.2 20.2h15.6" />
  </>
));

/** G6 – Sở thích: Trái tim đam mê kết hợp tia sáng khám phá */
export const InterestGroupIcon: LucideIcon = createBespokeIcon('InterestGroupIcon', () => (
  <>
    <path
      d="M12 20.2s-7.2-4.4-7.2-9.8A4.3 4.3 0 0 1 9.1 6c1.3 0 2.3.6 2.9 1.6.6-1 1.6-1.6 2.9-1.6a4.3 4.3 0 0 1 4.3 4.4c0 5.4-7.2 9.8-7.2 9.8Z"
      fill="currentColor"
      fillOpacity="0.2"
    />
    <path d="M12 10.2v3.6M10.2 12h3.6" />
  </>
));

/** G7 – Động lực: Tên lửa đứng phóng lên, thân – cửa sổ – cánh – lửa tách bạch để rõ ở kích thước nhỏ */
export const MotivationGroupIcon: LucideIcon = createBespokeIcon('MotivationGroupIcon', () => (
  <>
    <path
      d="M12 2.5c2.8 2.1 4.2 5.1 4.2 8.7V16H7.8v-4.8c0-3.6 1.4-6.6 4.2-8.7Z"
      fill="currentColor"
      fillOpacity="0.2"
    />
    <circle cx="12" cy="9.6" r="1.7" />
    <path d="M7.8 12 5 14.8V18l2.8-2M16.2 12l2.8 2.8V18l-2.8-2" />
    <path d="M10.3 16v1.4c0 1.4.6 2.7 1.7 4.1 1.1-1.4 1.7-2.7 1.7-4.1V16" />
  </>
));
