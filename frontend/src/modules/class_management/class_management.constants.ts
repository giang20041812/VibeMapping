import type { MemberRole, MemberStatus } from './class_management.types';

export const REPORT_MIN_STUDENTS = 5;

export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  homeroom_teacher: 'Giáo viên chủ nhiệm',
  subject_teacher: 'Giáo viên bộ môn',
  student: 'Học sinh',
};

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  invited: 'Chưa tham gia',
  joined: 'Đã tham gia',
  left: 'Đã rời lớp',
  removed: 'Đã xóa khỏi lớp',
};

export const GRADE_OPTIONS = ['9', '10', '11', '12'].map((grade) => ({ value: grade, label: `Lớp ${grade}` }));

export const ROSTER_ERROR_TEXT: Record<string, string> = {
  missing_field: 'Thiếu mã học sinh hoặc họ tên',
  duplicate_in_file: 'Mã học sinh trùng trong tệp',
  already_in_class: 'Mã học sinh đã có trong lớp',
};

export const ROSTER_TEMPLATE_HEADERS = ['Mã học sinh', 'Họ và tên'] as const;

export const STAFF_ERROR_TEXT: Record<string, string> = {
  user_not_found: 'Không tìm thấy tài khoản với email này.',
  not_a_teacher: 'Tài khoản này không phải giáo viên.',
  not_school_staff: 'Giáo viên này chưa thuộc trường của lớp.',
};

/** Mã lỗi RAISE EXCEPTION từ create_class */
export const CREATE_CLASS_ERROR_TEXT: Record<string, string> = {
  forbidden: 'Tài khoản chưa thuộc trường này nên không tạo được lớp.',
  invalid_class: 'Nhập tên lớp và năm học.',
};

export const JOIN_ERROR_TEXT: Record<string, string> = {
  class_not_found: 'Không tìm thấy lớp với mã này.',
  removed: 'Bạn đã bị xóa khỏi lớp này.',
};

export const GRID_BLOCK_TEXT: Record<string, string> = {
  empty_cells: 'Còn ô chưa chấm.',
  guardian_pending: 'Có học sinh dưới 16 tuổi chưa được người giám hộ xác nhận.',
  missing_understanding: 'Còn học sinh chưa có đủ ba câu mức thấu hiểu.',
};
