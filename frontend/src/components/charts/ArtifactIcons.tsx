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

/** Phụ huynh: Mái ấm gia đình với hai bậc cha mẹ đồng hành, che chở cho con ở giữa */
export const ParentRaterIcon: LucideIcon = createBespokeIcon('ParentRaterIcon', () => (
  <>
    {/* Mái nhà ấm áp phía trên */}
    <path d="M3 10.2 12 3l9 7.2" opacity="0.85" />
    {/* Hai bậc phụ huynh hai bên */}
    <circle cx="7.2" cy="11.2" r="2.1" fill="currentColor" fillOpacity="0.18" />
    <circle cx="16.8" cy="11.2" r="2.1" fill="currentColor" fillOpacity="0.18" />
    <path d="M3.4 19.8c0-2.3 1.7-3.9 3.8-3.9 1.1 0 2.1.4 2.8 1.1" />
    <path d="M20.6 19.8c0-2.3-1.7-3.9-3.8-3.9-1.1 0-2.1.4-2.8 1.1" />
    {/* Người con ở chính giữa được che chở */}
    <circle cx="12" cy="13.8" r="1.8" fill="currentColor" fillOpacity="0.28" />
    <path d="M8.8 20.5c0-1.8 1.4-3.1 3.2-3.1s3.2 1.3 3.2 3.1" />
  </>
));

/** Giáo viên: Mũ học vị tri thức, bảng giảng dạy và cuốn sách mở dẫn dắt học trò */
export const TeacherRaterIcon: LucideIcon = createBespokeIcon('TeacherRaterIcon', () => (
  <>
    {/* Mũ cử nhân / học vị trên đỉnh */}
    <path d="M12 2.8 4.2 6.4 12 10l7.8-3.6L12 2.8Z" fill="currentColor" fillOpacity="0.22" />
    <path d="M19.8 6.4v4.2" />
    <path d="M7.5 8.1v2.6c0 1.4 2 2.5 4.5 2.5s4.5-1.1 4.5-2.5V8.1" />
    {/* Cuốn sách mở nâng đỡ bên dưới */}
    <path
      d="M4 15.2c2.5-.6 5.2-.2 8 1.3 2.8-1.5 5.5-1.9 8-1.3v5.2c-2.5-.6-5.2-.2-8 1.3-2.8-1.5-5.5-1.9-8-1.3v-5.2Z"
      fill="currentColor"
      fillOpacity="0.14"
    />
    <path d="M12 16.5v5.2" />
  </>
));

/** Bạn bè: Hai người bạn đồng trang lứa gắn kết cùng ngôi sao chia sẻ tương tác */
export const FriendRaterIcon: LucideIcon = createBespokeIcon('FriendRaterIcon', () => (
  <>
    {/* Hai người bạn ngang hàng */}
    <circle cx="8.2" cy="9.2" r="2.5" fill="currentColor" fillOpacity="0.2" />
    <circle cx="15.8" cy="9.2" r="2.5" fill="currentColor" fillOpacity="0.2" />
    {/* Khoác vai kết nối */}
    <path d="M3.5 20c0-3 2.1-5.2 4.9-5.2 1.6 0 2.9.7 3.6 1.8.7-1.1 2-1.8 3.6-1.8 2.8 0 4.9 2.2 4.9 5.2" />
    {/* Tia sáng / bong bóng kết nối phía trên */}
    <path d="M12 3.2v2.2M10.9 4.3h2.2" />
  </>
));

/** Người hướng dẫn (Mentor): La bàn định hướng chiến lược kết hợp ngôi sao dẫn đường */
export const MentorRaterIcon: LucideIcon = createBespokeIcon('MentorRaterIcon', () => (
  <>
    {/* Vòng la bàn định hướng */}
    <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.12" />
    <circle cx="12" cy="12" r="6.4" strokeDasharray="2 2" opacity="0.6" />
    {/* Kim la bàn chỉ hướng Bắc - Đông Bắc */}
    <polygon
      points="15.6,8.4 13.3,13.3 8.4,15.6 10.7,10.7"
      fill="currentColor"
      fillOpacity="0.28"
    />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    {/* Bốn mốc phương hướng */}
    <path d="M12 3v1.6M12 19.4V21M3 12h1.6M19.4 12H21" />
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

/** G7 – Động lực: Tên lửa bứt phá vươn tới mục tiêu */
export const MotivationGroupIcon: LucideIcon = createBespokeIcon('MotivationGroupIcon', () => (
  <>
    <path
      d="M14.5 4.2c2.8-.5 5.3.2 5.3.2s.7 2.5.2 5.3c-.5 2.6-2.4 5.2-4.8 7l-4.4-4.4c1.8-2.4 4.4-4.3 7-4.8Z"
      fill="currentColor"
      fillOpacity="0.2"
    />
    <path d="M10.8 12.3 7.2 13l-2.4 2.4 3.4.8.8 3.4 2.4-2.4.7-3.6" />
    <circle cx="15.2" cy="8.8" r="1.3" fill="currentColor" />
    <path d="M4.5 19.5c1.2-.2 2.4-.9 3.1-1.9" />
  </>
));
