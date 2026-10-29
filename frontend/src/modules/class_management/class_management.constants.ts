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
  invalid_date: 'Ngày sinh không hợp lệ',
};

export const ACCOUNT_ERROR_TEXT: Record<string, string> = {
  invalid_student_code: 'Mã học sinh không dùng được để tạo email',
  duplicate_email: 'Mã học sinh trùng email với dòng khác',
  create_failed: 'Không tạo được tài khoản',
  link_failed: 'Không đưa được vào lớp',
  not_pending: 'Dòng này đã có tài khoản',
  not_a_student: 'Email này thuộc tài khoản không phải học sinh',
  already_member: 'Tài khoản đã có trong lớp',
};

export const ROSTER_TEMPLATE_HEADERS = ['Mã học sinh', 'Họ và tên', 'Ngày sinh'] as const;

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

/** Lý do chặn nộp bảng điểm; kèm tên học sinh bị chặn khi có */
export const GRID_BLOCK_TEXT: Record<string, string> = {
  empty_cells: 'Còn ô chưa chấm',
  guardian_pending: 'Dưới 16 tuổi, chưa có xác nhận của người giám hộ',
  missing_understanding: 'Chưa có đủ ba câu mức thấu hiểu',
  no_students: 'Bảng chưa có học sinh nào',
  already_submitted: 'Bảng điểm đã nộp',
  short_set_not_configured: 'Chưa có tiêu chí nào thuộc bộ câu hỏi rút gọn',
};
