export type InviteGroup = 'parent' | 'friend' | 'teacher' | 'mentor';

export const INVITE_GROUPS: { key: InviteGroup; label: string }[] = [
  { key: 'parent', label: 'Phụ huynh' },
  { key: 'friend', label: 'Bạn bè' },
  { key: 'teacher', label: 'Giáo viên' },
  { key: 'mentor', label: 'Người hướng dẫn' },
];

export const GROUP_LABEL: Record<string, string> = Object.fromEntries(INVITE_GROUPS.map((g) => [g.key, g.label]));

/** Hạn đường dẫn mặc định (ngày) khi tham số vận hành chưa đọc được */
export const DEFAULT_LINK_DAYS = 14;
export const MAX_EXPECTED_PER_GROUP = 50;

export const CONSENT_QUESTION =
  'Bạn có đồng ý cho người khác (phụ huynh, bạn bè, giáo viên, người hướng dẫn) đánh giá bạn không?';
export const CONSENT_NOTE = 'Bạn có thể tắt việc mời bất kỳ lúc nào và tự quyết định bài nào được tính vào kết quả.';

export const inviteUrl = (token: string) => `${window.location.origin}/moi/${token}`;

/** Đường dẫn chung: chứa token các nhóm đang mở, người quét tự chọn mình thuộc nhóm nào */
export const sharedInviteUrl = (tokens: string[]) => `${window.location.origin}/moi?t=${tokens.join(',')}`;
