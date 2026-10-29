/** Nhãn thao tác trong nhật ký; thao tác chưa có nhãn hiển thị nguyên mã */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  submit_360: 'Nộp bài đánh giá 360',
  decide_submission: 'Duyệt bài đánh giá',
  submit_class_grid: 'Nộp bảng lưới lớp',
  submit_class_grid_student: 'Nộp điểm học sinh trong lớp',
  create_roster_account: 'Tạo tài khoản học sinh từ danh sách',
  complete_self_assessment: 'Hoàn thành tự đánh giá',
  finalize_result: 'Chốt kết quả',
  set_package_assignments: 'Gán câu hỏi vào gói',
};

const TABLE_LABEL: Record<string, string> = {
  criteria_groups: 'nhóm tiêu chí',
  criteria: 'tiêu chí',
  criteria_rater_visibility: 'hiển thị tiêu chí',
  questions: 'câu hỏi',
  operation_parameters: 'tham số vận hành',
};

const OPERATION_LABEL: Record<string, string> = {
  insert: 'Thêm',
  update: 'Sửa',
  delete: 'Xóa',
};

export function actionLabel(action: string): string {
  if (AUDIT_ACTION_LABEL[action]) return AUDIT_ACTION_LABEL[action];
  const [operation, table] = action.split(':');
  if (OPERATION_LABEL[operation] && TABLE_LABEL[table]) return `${OPERATION_LABEL[operation]} ${TABLE_LABEL[table]}`;
  return action;
}

export const TARGET_TYPE_LABEL: Record<string, string> = {
  assessment_360_submissions: 'Bài đánh giá 360',
  assessment_results: 'Kết quả đánh giá',
  assessment_sessions: 'Phiên tự đánh giá',
  class_assessment_grids: 'Bảng lưới lớp',
  class_assessment_grid_students: 'Điểm học sinh trong lớp',
  question_package_assignments: 'Gói câu hỏi',
  questions: 'Câu hỏi',
  criteria: 'Tiêu chí',
  criteria_groups: 'Nhóm tiêu chí',
  criteria_rater_visibility: 'Hiển thị tiêu chí',
  operation_parameters: 'Tham số vận hành',
};
