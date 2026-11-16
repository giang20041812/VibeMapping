import type { GroupDef, SymbolDef } from '../types';

const L = String.raw;

export const GROUPS: GroupDef[] = [
  { code: 'personal', name: 'Đánh giá cá nhân' },
  { code: 'rater_360', name: 'Đánh giá 360°' },
  { code: 'career_fit', name: 'Phù hợp nghề' },
  { code: 'decision_compare', name: 'So sánh phương án' },
  { code: 'school_major', name: 'Ngành – Trường' },
  { code: 'profile_roadmap', name: 'Hồ sơ năng lực và lộ trình' },
];

/** Tham số vận hành: mã ký hiệu trùng mã tham số trong operation_parameters */
export const PARAM_SYMBOLS: SymbolDef[] = [
  { code: 'self_weight', latex: L`w_{\text{bản thân}}`, name: 'Trọng số bản thân', kind: 'param', ref: 'self_weight', min: 0, max: 1 },
  { code: 'unreviewed_supplemental_default', latex: L`S_{\text{mặc định}}`, name: 'Điểm hiểu biết bổ sung khi chưa chấm định tính', kind: 'param', ref: 'unreviewed_supplemental_default', min: 0, max: 100 },
  { code: 'understanding_percent_floor', latex: L`TH\%_{\text{sàn}}`, name: 'Sàn tỷ lệ thấu hiểu', kind: 'param', ref: 'understanding_percent_floor', unit: '%', min: 0, max: 100 },
  { code: 'insufficient_basis_warning_ratio', latex: L`r_{\max}`, name: 'Ngưỡng cảnh báo thiếu dữ liệu', kind: 'param', ref: 'insufficient_basis_warning_ratio', min: 0, max: 1 },
  { code: 'confidence_high_coverage', latex: L`c_{\text{cao}}`, name: 'Ngưỡng độ phủ cho mức tin cậy Cao', kind: 'param', ref: 'confidence_high_coverage', min: 0, max: 1 },
  { code: 'confidence_medium_coverage', latex: L`c_{\text{vừa}}`, name: 'Ngưỡng độ phủ cho mức tin cậy Trung bình', kind: 'param', ref: 'confidence_medium_coverage', min: 0, max: 1 },
  { code: 'trust_seconds_per_question', latex: L`s_{\text{câu}}`, name: 'Số giây tối thiểu mỗi câu', kind: 'param', ref: 'trust_seconds_per_question', unit: 'giây' },
  { code: 'trust_idle_gap_seconds', latex: L`t_{\text{nghỉ}}`, name: 'Ngưỡng quãng nghỉ bị loại khỏi thời gian làm bài', kind: 'param', ref: 'trust_idle_gap_seconds', unit: 'giây' },
  { code: 'trust_dispersion_coefficient', latex: L`k_{\text{phân tán}}`, name: 'Hệ số độ phân tán', kind: 'param', ref: 'trust_dispersion_coefficient', min: 0.01, max: 1 },
  { code: 'trust_min_criteria', latex: L`m_{\text{tiêu chí}}`, name: 'Số tiêu chí tối thiểu để kiểm tra độ phân tán', kind: 'param', ref: 'trust_min_criteria', min: 1 },
  { code: 'trust_label_trusted', latex: L`u_{\text{tin cậy}}`, name: 'Ngưỡng nhãn Tin cậy', kind: 'param', ref: 'trust_label_trusted', min: 0, max: 1 },
  { code: 'trust_label_consider', latex: L`u_{\text{cân nhắc}}`, name: 'Ngưỡng nhãn Cần cân nhắc', kind: 'param', ref: 'trust_label_consider', min: 0, max: 1 },
  { code: 'trust_min_time_ratio', latex: L`u_{\text{thời gian}}`, name: 'Tỷ lệ thời gian tối thiểu', kind: 'param', ref: 'trust_min_time_ratio', min: 0, max: 1 },
  { code: 'perception_gap_percent', latex: L`\delta_{\text{lệch}}`, name: 'Mức chênh cảnh báo lệch góc nhìn', kind: 'param', ref: 'perception_gap_percent', unit: 'điểm %' },
  { code: 'career_fit_weight_competency', latex: L`w_{\text{G1–G5}}`, name: 'Tỷ trọng Năng lực (G1–G5) trong độ phù hợp nghề', kind: 'param', ref: 'career_fit_weight_competency', min: 0, max: 1 },
  { code: 'career_fit_weight_interest', latex: L`w_{\text{G6}}`, name: 'Tỷ trọng Sở thích (G6) trong độ phù hợp nghề', kind: 'param', ref: 'career_fit_weight_interest', min: 0, max: 1 },
  { code: 'career_fit_weight_motivation', latex: L`w_{\text{G7}}`, name: 'Tỷ trọng Động lực (G7) trong độ phù hợp nghề', kind: 'param', ref: 'career_fit_weight_motivation', min: 0, max: 1 },
  { code: 'career_fit_min_percent', latex: L`\theta_{\text{phù hợp}}`, name: 'Ngưỡng độ phù hợp tối thiểu', kind: 'param', ref: 'career_fit_min_percent', unit: '%' },
  { code: 'career_near_fit_percent', latex: L`\theta_{\text{gần đạt}}`, name: 'Ngưỡng nghề gần đạt', kind: 'param', ref: 'career_near_fit_percent', unit: '%' },
  { code: 'career_rank_band_percent', latex: L`b`, name: 'Độ rộng bậc khi xếp hạng', kind: 'param', ref: 'career_rank_band_percent', unit: 'điểm %', min: 0.01 },
  { code: 'gap_priority_p1', latex: L`\gamma_{\text{P1}}`, name: 'Ngưỡng ưu tiên P1', kind: 'param', ref: 'gap_priority_p1', unit: 'mức' },
  { code: 'gap_priority_p2', latex: L`\gamma_{\text{P2}}`, name: 'Ngưỡng ưu tiên P2', kind: 'param', ref: 'gap_priority_p2', unit: 'mức' },
  { code: 'gap_large_level', latex: L`\gamma_{\text{thiếu nhiều}}`, name: 'Ngưỡng thiếu nhiều', kind: 'param', ref: 'gap_large_level', unit: 'mức' },
];

/** Dữ liệu đầu vào của công thức */
export const INPUT_SYMBOLS: SymbolDef[] = [
  // Đánh giá cá nhân và 360°
  { code: 'answer_score', latex: L`x_{k}`, name: 'Điểm câu trả lời', kind: 'input', unit: 'điểm', min: 1, max: 5 },
  { code: 'th_score', latex: L`TH`, name: 'Tổng điểm ba câu hỏi ngữ cảnh', kind: 'input', unit: 'điểm', min: 3, max: 12 },
  { code: 'ea_item', latex: L`EA_{k}`, name: 'Điểm EA của câu k', kind: 'input', unit: 'điểm', min: 0, max: 2 },
  { code: 'solo_item', latex: L`SOLO_{k}`, name: 'Điểm SOLO của câu k', kind: 'input', unit: 'điểm', min: 1, max: 5 },
  { code: 'carkhuff_score', latex: L`CK`, name: 'Điểm Carkhuff', kind: 'input', unit: 'điểm', min: 1, max: 5 },
  { code: 'rater_group', latex: L`\text{Nhóm}`, name: 'Nhóm người chấm', kind: 'input' },
  { code: 'n_questions', latex: L`N`, name: 'Số câu hỏi của bài', kind: 'input', min: 0 },
  { code: 'raw_seconds', latex: L`T_{\text{thô}}`, name: 'Thời gian làm bài ghi nhận', kind: 'input', unit: 'giây', min: 0 },
  { code: 'idle_seconds', latex: L`t_{k}`, name: 'Thời lượng một quãng nghỉ', kind: 'input', unit: 'giây', min: 0 },
  { code: 'valid_count', latex: L`n_{\text{hợp lệ}}`, name: 'Số câu có điểm hợp lệ', kind: 'input', min: 0 },
  { code: 'na_count', latex: L`n_{\text{không đủ cơ sở}}`, name: 'Số câu chọn không đủ cơ sở', kind: 'input', min: 0 },
  { code: 'same_share', latex: L`p`, name: 'Tỷ lệ câu cùng một mức điểm nhiều nhất', kind: 'input', min: 0, max: 1 },
  { code: 'insufficient_ratio', latex: L`r`, name: 'Tỷ lệ câu không đủ cơ sở', kind: 'input', min: 0, max: 1 },
  { code: 'group_valid', latex: L`v_{g}`, name: 'Nhóm có điểm hợp lệ (1 là có, 0 là không)', kind: 'input', min: 0, max: 1 },
  { code: 'self_percent', latex: L`\text{Đ}_{\text{bản thân}}`, name: 'Điểm bản thân', kind: 'input', unit: '%', min: 0, max: 100 },
  { code: 'group_percent', latex: L`\text{Đ}_{\text{nhóm}}`, name: 'Điểm của một nhóm người chấm', kind: 'input', unit: '%', min: 0, max: 100 },
  // Phù hợp nghề
  { code: 'user_score', latex: L`U`, name: 'Điểm của người học tại tiêu chí', kind: 'input', unit: 'điểm', min: 1, max: 5 },
  { code: 'required_score', latex: L`Req`, name: 'Mức yêu cầu của nghề tại tiêu chí', kind: 'input', unit: 'điểm', min: 1, max: 5 },
  { code: 'career_weight', latex: L`CW`, name: 'Trọng số tiêu chí của nghề', kind: 'input', min: 0, max: 1 },
  { code: 'learner_dim', latex: L`L_{k}`, name: 'Điểm người học ở chiều Holland k, chia 5', kind: 'input', min: 0, max: 1 },
  { code: 'career_profile', latex: L`C_{k}`, name: 'Độ đậm chiều Holland k của nghề', kind: 'input', min: 0, max: 1 },
  { code: 'comp_w', latex: L`w_{c}`, name: 'Tỷ trọng của thành phần c', kind: 'input', min: 0, max: 1 },
  { code: 'comp_m', latex: L`M_{c}`, name: 'Mức phù hợp của thành phần c', kind: 'input', min: 0, max: 1 },
  // So sánh phương án
  { code: 'floor_score', latex: L`D_{\text{chuẩn}}`, name: 'Điểm chuẩn mới nhất', kind: 'input', min: 0.01 },
  { code: 'learner_exam_score', latex: L`D_{\text{người học}}`, name: 'Điểm của người học', kind: 'input', min: 0 },
  { code: 'tuition', latex: L`H`, name: 'Học phí một năm của phương án', kind: 'input', unit: 'đồng', min: 0 },
  { code: 'budget', latex: L`B`, name: 'Ngân sách học phí một năm', kind: 'input', unit: 'đồng', min: 0 },
  { code: 'min_tuition', latex: L`H_{\min}`, name: 'Học phí thấp nhất trong các phương án', kind: 'input', unit: 'đồng', min: 0 },
  { code: 'max_tuition', latex: L`H_{\max}`, name: 'Học phí cao nhất trong các phương án', kind: 'input', unit: 'đồng', min: 0 },
  { code: 'city', latex: L`\text{TP}`, name: 'Thành phố của phương án', kind: 'input' },
  { code: 'preferred_city', latex: L`\text{TP}_{\text{ưu tiên}}`, name: 'Thành phố người học ưu tiên', kind: 'input' },
  { code: 'weight_career_fit', latex: L`u_{\text{nghề}}`, name: 'Mức quan trọng của độ phù hợp nghề', kind: 'input', min: 0, max: 3 },
  { code: 'weight_admission', latex: L`u_{\text{đầu vào}}`, name: 'Mức quan trọng của đáp ứng đầu vào', kind: 'input', min: 0, max: 3 },
  { code: 'weight_finance', latex: L`u_{\text{tài chính}}`, name: 'Mức quan trọng của tài chính', kind: 'input', min: 0, max: 3 },
  { code: 'weight_location', latex: L`u_{\text{địa điểm}}`, name: 'Mức quan trọng của địa điểm', kind: 'input', min: 0, max: 3 },
  { code: 'option_w', latex: L`u_{c}`, name: 'Mức quan trọng của tiêu chí c', kind: 'input', min: 0, max: 3 },
  { code: 'option_v', latex: L`V_{c}`, name: 'Điểm của phương án ở tiêu chí c', kind: 'input', unit: 'điểm', min: 0, max: 100 },
  // Ngành – Trường
  { code: 'tuition_per_semester', latex: L`H_{\text{kỳ}}`, name: 'Học phí một kỳ', kind: 'input', unit: 'đồng', min: 0 },
  { code: 'semesters_per_year', latex: L`n_{\text{kỳ}}`, name: 'Số kỳ mỗi năm', kind: 'input', min: 1 },
  { code: 'tuition_total', latex: L`H_{\text{khóa}}`, name: 'Tổng học phí toàn khóa', kind: 'input', unit: 'đồng', min: 0 },
  { code: 'study_years', latex: L`n_{\text{năm}}`, name: 'Số năm đào tạo', kind: 'input', min: 1 },
  // Hồ sơ năng lực và lộ trình
  { code: 'milestone_weight', latex: L`m_{k}`, name: 'Trọng số của hoạt động k', kind: 'input', min: 0 },
  { code: 'milestone_done', latex: L`d_{k}`, name: 'Hoạt động k đã hoàn thành (1 là rồi, 0 là chưa)', kind: 'input', min: 0, max: 1 },
  { code: 'elapsed_days', latex: L`t_{\text{đã qua}}`, name: 'Số ngày đã trôi từ lúc bắt đầu', kind: 'input', unit: 'ngày' },
  { code: 'total_days', latex: L`t_{\text{tổng}}`, name: 'Tổng số ngày từ lúc bắt đầu đến đích', kind: 'input', unit: 'ngày' },
  { code: 'missed_checkpoints', latex: L`n_{\text{quá hạn}}`, name: 'Số cột mốc chính quá hạn chưa xong', kind: 'input', min: 0 },
];

/** Ký hiệu phụ: cùng một công thức xuất hiện ở nhiều vai, mỗi vai một ký hiệu hiển thị */
export const ALIAS_SYMBOLS: SymbolDef[] = [
  { code: 'rs_self', latex: L`RS_{\text{bản thân}}`, name: 'Điểm bản thân tại tiêu chí', kind: 'formula', ref: 'rater_rs', unit: 'điểm', min: 1, max: 5 },
  { code: 'rs_rater', latex: L`RS_{j}`, name: 'Điểm của người chấm j tại tiêu chí', kind: 'formula', ref: 'rater_rs', unit: 'điểm', min: 1, max: 5 },
];
