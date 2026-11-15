import type { LucideIcon } from 'lucide-react';
import {
  FriendRaterIcon,
  MentorRaterIcon,
  ParentRaterIcon,
  TeacherRaterIcon,
} from '../../components/charts/ArtifactIcons';
import type { RaterNode } from '../../components/charts/Rater360/Rater360';
import { INVITE_GROUPS } from '../invitation_link/invitation.constants';
import type { InviteGroup } from '../invitation_link/invitation.constants';

/** Biểu tượng thiết kế riêng của từng nhóm người đánh giá */
const RATER_ICONS: Record<InviteGroup, LucideIcon> = {
  parent: ParentRaterIcon,
  friend: FriendRaterIcon,
  teacher: TeacherRaterIcon,
  mentor: MentorRaterIcon,
};

/** Các nhóm người đánh giá quanh người được đánh giá trên sơ đồ 360° */
export const RATER_NODES: RaterNode[] = INVITE_GROUPS.map(({ key, label }) => ({
  key,
  label,
  Icon: RATER_ICONS[key],
}));
