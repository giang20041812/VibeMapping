import { Compass, GraduationCap, House, Smile, type LucideIcon } from 'lucide-react';
import type { GlobeNode, GlobeTone } from '../../components/charts/Globe360/Globe360';
import { GLOBE_ICON_PATHS } from '../../components/charts/Globe360/globeIcons';
import { INVITE_GROUPS } from '../invitation_link/invitation.constants';
import type { InviteGroup } from '../invitation_link/invitation.constants';

/** Màu của từng nhóm người đánh giá trên quả địa cầu */
const GLOBE_TONES: Record<InviteGroup, GlobeTone> = { parent: 'gold', friend: 'cyan', teacher: 'violet', mentor: 'magenta' };

/** Biểu tượng của từng nhóm; đường vẽ tương ứng trong GLOBE_ICON_PATHS dùng cho canvas */
const GLOBE_ICONS: Record<InviteGroup, LucideIcon> = { parent: House, friend: Smile, teacher: GraduationCap, mentor: Compass };

export const GLOBE_NODES: GlobeNode[] = INVITE_GROUPS.map(({ key, label }) => ({
  key,
  label,
  tone: GLOBE_TONES[key],
  icon: GLOBE_ICON_PATHS[key],
  Icon: GLOBE_ICONS[key],
}));
