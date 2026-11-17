import { Compass, Target, Users, type LucideIcon } from 'lucide-react';

export interface CoreCapability {
  /** Bước của hành trình trên trang giới thiệu mà trọng tâm này dẫn tới */
  targetId: string;
  icon: LucideIcon;
  title: string;
}

/** Ba trọng tâm của sản phẩm: hiện ở phần mở đầu trang giới thiệu và ở khối thương hiệu trang đăng nhập */
export const CORE_CAPABILITIES: CoreCapability[] = [
  { targetId: 'step-self', icon: Users, title: 'Đánh giá năng lực 360°' },
  { targetId: 'step-fit', icon: Compass, title: 'Đối chiếu nghề – ngành – trường' },
  { targetId: 'step-roadmap', icon: Target, title: 'Lộ trình phát triển cá nhân' },
];

/** Hai câu khẩu hiệu của thương hiệu, mỗi câu tách hai vế để xuống dòng đúng nhịp */
export const BRAND_SLOGAN = ['Biết mình là ai,', 'vững bước tương lai!'] as const;
export const BRAND_SLOGAN_SUB = ['Vẽ bản đồ chất,', 'để tương lai phất!'] as const;
