import type { FrameworkSection } from '../career_explorer/careerLevelFramework.types';

export type FrameworkItemField = 'group_label' | 'content' | 'detail' | 'note' | 'salary_min' | 'salary_max' | 'target_career_id' | 'target_level';

export interface FrameworkFieldSpec {
  key: FrameworkItemField;
  label: string;
  multiline?: boolean;
}

export interface FrameworkSectionSpec {
  tiered: boolean;
  fields: FrameworkFieldSpec[];
}

const single = (label: string): FrameworkSectionSpec => ({ tiered: true, fields: [{ key: 'content', label }] });

/** Ô nhập của từng mục; nhãn theo nghĩa của cột trong mục đó */
export const FRAMEWORK_SECTION_SPEC: Record<FrameworkSection, FrameworkSectionSpec> = {
  task: {
    tiered: true,
    fields: [
      { key: 'group_label', label: 'Nhóm nhiệm vụ' },
      { key: 'content', label: 'Nhiệm vụ chính', multiline: true },
      { key: 'detail', label: 'Hoạt động thực tế', multiline: true },
    ],
  },
  output: { tiered: false, fields: [{ key: 'content', label: 'Kết quả', multiline: true }] },
  stakeholder: {
    tiered: false,
    fields: [
      { key: 'group_label', label: 'Nhóm' },
      { key: 'content', label: 'Đối tượng' },
      { key: 'detail', label: 'Cách phối hợp', multiline: true },
    ],
  },
  knowledge: single('Kiến thức'),
  professional_skill: single('Kỹ năng'),
  soft_skill: single('Kỹ năng'),
  tool: single('Công cụ'),
  education: single('Học vấn'),
  certificate: single('Chứng chỉ'),
  experience: single('Kinh nghiệm'),
  language: single('Ngoại ngữ'),
  special_requirement: single('Yêu cầu'),
  benefit: { tiered: true, fields: [{ key: 'content', label: 'Quyền lợi', multiline: true }] },
  salary: {
    tiered: false,
    fields: [
      { key: 'group_label', label: 'Nhóm doanh nghiệp' },
      { key: 'salary_min', label: 'Từ (triệu/tháng)' },
      { key: 'salary_max', label: 'Đến (triệu/tháng)' },
      { key: 'detail', label: 'Thực nhận' },
      { key: 'note', label: 'Mức công bố' },
      { key: 'content', label: 'Ví dụ', multiline: true },
    ],
  },
  competency: {
    tiered: false,
    fields: [
      { key: 'group_label', label: 'Năng lực' },
      { key: 'content', label: 'Mức yêu cầu', multiline: true },
      { key: 'detail', label: 'Biểu hiện cần thấy', multiline: true },
      { key: 'note', label: 'Dưới chuẩn', multiline: true },
    ],
  },
  industry_variant: {
    tiered: false,
    fields: [
      { key: 'group_label', label: 'Ngành' },
      { key: 'content', label: 'Kiến thức bổ sung', multiline: true },
      { key: 'detail', label: 'Công cụ, đầu ra', multiline: true },
      { key: 'note', label: 'Lưu ý', multiline: true },
    ],
  },
  company_variant: {
    tiered: false,
    fields: [
      { key: 'group_label', label: 'Mô hình công ty' },
      { key: 'content', label: 'Đặc điểm công việc', multiline: true },
      { key: 'detail', label: 'Yêu cầu nổi bật', multiline: true },
      { key: 'note', label: 'Lưu ý', multiline: true },
    ],
  },
  career_move: {
    tiered: false,
    fields: [
      { key: 'group_label', label: 'Hướng' },
      { key: 'content', label: 'Mô tả', multiline: true },
      { key: 'target_career_id', label: 'Nghề đích' },
      { key: 'target_level', label: 'Bậc' },
    ],
  },
  pass_threshold: { tiered: false, fields: [{ key: 'content', label: 'Ngưỡng đạt', multiline: true }] },
  interview_question: { tiered: false, fields: [{ key: 'content', label: 'Câu hỏi', multiline: true }] },
};

/** Nhóm mục theo tab trong trình sửa khung */
export const FRAMEWORK_EDITOR_TABS: { value: string; label: string; sections: FrameworkSection[] }[] = [
  { value: 'info', label: 'Thông tin chung', sections: [] },
  { value: 'tasks', label: 'Nhiệm vụ', sections: ['task', 'output', 'stakeholder'] },
  { value: 'requirements', label: 'Yêu cầu', sections: ['knowledge', 'professional_skill', 'soft_skill', 'tool', 'education', 'certificate', 'experience', 'language', 'special_requirement'] },
  { value: 'income', label: 'Thu nhập', sections: ['salary', 'benefit'] },
  { value: 'competency', label: 'Năng lực', sections: ['competency', 'pass_threshold', 'interview_question'] },
  { value: 'variants', label: 'Biến thể', sections: ['industry_variant', 'company_variant'] },
  { value: 'moves', label: 'Hướng phát triển', sections: ['career_move'] },
];

export const FRAMEWORK_STATUS_LABEL = { draft: 'Bản nháp', published: 'Đã công bố' } as const;
export const FRAMEWORK_STATUS_VARIANT = { draft: 'default', published: 'success' } as const;
