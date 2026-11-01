import type React from 'react';
import {
  Briefcase,
  ClipboardList,
  Compass,
  FileText,
  GraduationCap,
  History,
  Layers,
  Library,
  Map as MapIcon,
  MessagesSquare,
  Scale,
  School,
  Shield,
  SlidersHorizontal,
} from 'lucide-react';
import { Globe360Icon, HomeIcon, PersonalIcon, type NavIconProps } from './NavIcons';
import type { UserRole } from '../../modules/auth/auth.types';

export interface NavItem {
  to: string;
  label: string;
  icon: React.FC<NavIconProps>;
  /** Chỉ hiện cho các vai trò này; bỏ trống là hiện cho mọi vai trò */
  roles?: UserRole[];
  end?: boolean;
}

/** Giáo viên vào thẳng lớp học, quản trị hệ thống vào thẳng khu quản trị: cả hai không dùng trang chủ */
const HOME_ROLES: UserRole[] = ['student', 'university_student', 'parent', 'mentor', 'school_admin'];
const ADMIN_ROLES: UserRole[] = ['system_admin'];

/** Mục điều hướng chính của thanh bên trái; hồ sơ, đổi mật khẩu, thông báo nằm trong menu avatar */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Trang chủ', icon: HomeIcon, roles: HOME_ROLES, end: true },
  { to: '/danh-gia-ca-nhan', label: 'Đánh giá cá nhân', icon: PersonalIcon, roles: ['student', 'university_student'] },
  { to: '/danh-gia-360', label: 'Đánh giá 360', icon: Globe360Icon, roles: ['student', 'university_student'] },
  { to: '/lop-hoc', label: 'Lớp học', icon: GraduationCap, roles: ['student', 'university_student', 'teacher', 'school_admin'] },
  { to: '/nghe', label: 'Nghề nghiệp', icon: Compass, roles: ['student', 'university_student', 'parent', 'teacher', 'mentor', 'school_admin'] },
  { to: '/nghe/so-sanh', label: 'So sánh nghề', icon: Layers, roles: ['student', 'university_student'] },
  { to: '/so-sanh', label: 'So sánh phương án', icon: Scale, roles: ['student', 'university_student'] },
  { to: '/bao-cao-duoc-chia-se', label: 'Báo cáo của con', icon: FileText, roles: ['parent'] },
  { to: '/lo-trinh', label: 'Lộ trình', icon: MapIcon, roles: ['student', 'university_student'] },
  { to: '/nang-luc', label: 'Hồ sơ năng lực', icon: Briefcase, roles: ['university_student'] },
  { to: '/cong-dong', label: 'Cộng đồng', icon: MessagesSquare, roles: ['student', 'university_student', 'parent', 'teacher', 'mentor', 'school_admin'] },
  { to: '/quyen-rieng-tu', label: 'Quyền riêng tư', icon: Shield, roles: ['student', 'university_student', 'parent', 'teacher', 'mentor', 'school_admin'] },
  { to: '/quan-tri/cham-dinh-tinh', label: 'Chấm định tính', icon: ClipboardList, roles: ADMIN_ROLES },
  { to: '/quan-tri/nghe', label: 'Quản lý nghề', icon: Compass, roles: ADMIN_ROLES },
  { to: '/quan-tri/thu-vien', label: 'Thư viện gợi ý', icon: Library, roles: ADMIN_ROLES },
  { to: '/quan-tri/cong-dong', label: 'Kiểm duyệt cộng đồng', icon: MessagesSquare, roles: ADMIN_ROLES },
  { to: '/quan-tri/truong', label: 'Trường học', icon: School, roles: ADMIN_ROLES },
  { to: '/quan-tri/goi-cau-hoi', label: 'Gán câu hỏi vào gói', icon: Layers, roles: ADMIN_ROLES },
  { to: '/quan-tri/cau-hoi', label: 'Ngân hàng câu hỏi', icon: Library, roles: ADMIN_ROLES },
  { to: '/quan-tri/tieu-chi', label: 'Tiêu chí', icon: ClipboardList, roles: ADMIN_ROLES },
  { to: '/quan-tri/tham-so', label: 'Tham số vận hành', icon: SlidersHorizontal, roles: ADMIN_ROLES },
  { to: '/quan-tri/nhat-ky', label: 'Nhật ký', icon: History, roles: ADMIN_ROLES },
];

export interface TopbarItem {
  to: string;
  label: string;
  end?: boolean;
  /** Chỉ hiện khi đã có tài khoản (trang đích yêu cầu đăng nhập) */
  requiresAccount?: boolean;
}

/** Mục điều hướng của thanh trên cùng: trang giới thiệu, khám phá trường và khi khách làm bài test */
export const TOPBAR_ITEMS: TopbarItem[] = [
  { to: '/danh-gia-ca-nhan', label: 'Tổng quan', requiresAccount: true },
  { to: '/', label: 'Giới thiệu', end: true },
  { to: '/nganh-nghe', label: 'Ngành nghề' },
  { to: '/danh-muc-nghe', label: 'Nghề nghiệp' },
  { to: '/kham-pha-truong', label: 'Khám phá trường' },
];

export function topbarItemsFor(isGuest: boolean): TopbarItem[] {
  return isGuest ? TOPBAR_ITEMS.filter((item) => !item.requiresAccount) : TOPBAR_ITEMS;
}

/** Chưa đăng nhập chỉ thấy trang chủ */
const GUEST_PATHS = ['/'];

export function navItemsFor(role: UserRole | undefined): NavItem[] {
  if (role === undefined) return NAV_ITEMS.filter((item) => GUEST_PATHS.includes(item.to));
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
