import { Globe, Home, Radar, type LucideIcon } from 'lucide-react';
import type { UserRole } from '../../modules/auth/auth.types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Chỉ hiện cho các vai trò này; bỏ trống là hiện cho mọi vai trò */
  roles?: UserRole[];
  end?: boolean;
}

/** Mục điều hướng chính của thanh bên trái; hồ sơ, đổi mật khẩu, thông báo nằm trong menu avatar */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Trang chủ', icon: Home, end: true },
  { to: '/danh-gia-ca-nhan', label: 'Đánh giá cá nhân', icon: Radar, roles: ['student', 'university_student'] },
  { to: '/danh-gia-360', label: 'Đánh giá 360', icon: Globe, roles: ['student', 'university_student'] },
];

export function navItemsFor(role: UserRole | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || (role !== undefined && item.roles.includes(role)));
}
