import { Handshake, Presentation, UserRoundCheck, UsersRound, type LucideIcon } from 'lucide-react';
import type { RaterNode } from '../../components/charts/Rater360/Rater360';
import { INVITE_GROUPS } from '../invitation_link/invitation.constants';
import type { InviteGroup } from '../invitation_link/invitation.constants';

/** Biểu tượng của từng nhóm người đánh giá */
const RATER_ICONS: Record<InviteGroup, LucideIcon> = { parent: UsersRound, friend: Handshake, teacher: Presentation, mentor: UserRoundCheck };

/** Các nhóm người đánh giá quanh người được đánh giá trên sơ đồ 360° */
export const RATER_NODES: RaterNode[] = INVITE_GROUPS.map(({ key, label }) => ({
  key,
  label,
  Icon: RATER_ICONS[key],
}));
