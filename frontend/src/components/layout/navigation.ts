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
import { Globe360Icon, HomeIcon, type NavIconProps } from './NavIcons';
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
  { to: '/danh-gia-360', label: 'Đánh giá 360', icon: Globe360Icon, roles: ['student', 'university_student'] },
  { to: '/lop-hoc', label: 'Lớp học', icon: GraduationCap, roles: ['teacher', 'school_admin'] },
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
  { to: '/danh-gia-360', label: 'Tổng quan', requiresAccount: true },
  { to: '/', label: 'Giới thiệu', end: true },
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
