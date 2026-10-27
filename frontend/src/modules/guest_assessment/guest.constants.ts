import type { InviteGroup } from '../invitation_link/invitation.constants';

export const RELATIONSHIPS: Record<InviteGroup, string[]> = {
  parent: ['Cha', 'Mẹ', 'Người giám hộ khác'],
  friend: ['Bạn cùng lớp', 'Bạn thân', 'Bạn cùng câu lạc bộ hoặc nhóm học', 'Khác'],
  teacher: ['Giáo viên chủ nhiệm', 'Giáo viên bộ môn', 'Khác'],
  mentor: ['Cố vấn học tập', 'Quản lý thực tập', 'Chuyên gia', 'Khác'],
};

/** Bảng quy đổi mặc định của ba câu ngữ cảnh (mỗi câu 1–4 điểm) */
export const DURATION_OPTIONS = [
  { label: 'Dưới 6 tháng', value: 1 },
  { label: '6–12 tháng', value: 2 },
  { label: '1–3 năm', value: 3 },
  { label: 'Trên 3 năm', value: 4 },
];

export const FREQUENCY_OPTIONS = [
  { label: 'Hiếm khi', value: 1 },
  { label: 'Vài lần mỗi tháng', value: 2 },
  { label: 'Vài lần mỗi tuần', value: 3 },
  { label: 'Hằng ngày', value: 4 },
];

export const DEPTH_OPTIONS = [
  { label: 'Biết sơ qua', value: 1 },
  { label: 'Khá hiểu', value: 2 },
  { label: 'Hiểu rõ', value: 3 },
  { label: 'Rất hiểu', value: 4 },
];

/** Thời gian tối thiểu mỗi câu (giây) để bài không bị coi là làm quá nhanh */
export const MIN_SECONDS_PER_QUESTION = 3;
/** Số tiêu chí tối thiểu để kiểm tra chấm cùng một mức điểm */
export const UNIFORM_MIN_CRITERIA = 7;

export const resumeKey = (token: string) => `vm_resume_${token}`;

export const UNAVAILABLE_TEXT: Record<string, string> = {
  expired: 'Đợt đánh giá đã kết thúc. Đường dẫn này đã hết hạn sử dụng.',
  revoked: 'Đường dẫn này đã bị thu hồi.',
  full: 'Đường dẫn này đã nhận đủ số bài.',
  not_found: 'Không tìm thấy đường dẫn này.',
  duplicate: 'Không thể truy cập. Mỗi IP chỉ được nộp tối đa 1 bài trên đường dẫn này.',
  own_link: 'Đây là đường dẫn mời của bạn. Bạn không thể tự đánh giá mình qua đường dẫn này.',
  error: 'Không mở được bài đánh giá. Vui lòng thử lại sau.',
};
