import type { FrameworkSection, FrameworkTier } from './careerLevelFramework.types';

/** Tên mặc định của các bậc L0–L7; mỗi nghề đặt tên hiển thị riêng trong khung */
export const CAREER_LEVEL_NAMES = ['Thực tập sinh', 'Fresher', 'Junior', 'Middle', 'Senior', 'Trưởng nhóm', 'Quản lý', 'Lãnh đạo'] as const;
export const CAREER_LEVELS = CAREER_LEVEL_NAMES.map((_, level) => level);
export const careerLevelCode = (level: number) => `L${level}`;

export const FRAMEWORK_TIER_LABEL: Record<FrameworkTier, string> = {
  required: 'Bắt buộc',
  common: 'Thường gặp',
  advantage: 'Lợi thế',
};

/** Quyền lợi dùng cùng ba mức nhưng gọi theo cách khác */
export const BENEFIT_TIER_LABEL: Record<FrameworkTier, string> = {
  required: 'Theo luật',
  common: 'Thường gặp',
  advantage: 'Lợi thế cạnh tranh',
};

export const FRAMEWORK_TIER_VARIANT: Record<FrameworkTier, 'danger' | 'info' | 'success'> = {
  required: 'danger',
  common: 'info',
  advantage: 'success',
};

export const FRAMEWORK_TIERS: FrameworkTier[] = ['required', 'common', 'advantage'];

/** Các mục yêu cầu ứng viên, theo thứ tự hiển thị */
export const REQUIREMENT_SECTIONS: FrameworkSection[] = [
  'knowledge', 'professional_skill', 'soft_skill', 'tool', 'education', 'certificate', 'experience', 'language', 'special_requirement',
];

/** Mục chỉ quản trị thấy (RLS cũng chặn ở cơ sở dữ liệu) */
export const ADMIN_ONLY_SECTIONS: FrameworkSection[] = ['pass_threshold', 'interview_question'];

export const FRAMEWORK_SECTION_LABEL: Record<FrameworkSection, string> = {
  task: 'Nhiệm vụ',
  output: 'Kết quả đầu ra',
  stakeholder: 'Người phối hợp',
  knowledge: 'Kiến thức',
  professional_skill: 'Kỹ năng chuyên môn',
  soft_skill: 'Kỹ năng mềm',
  tool: 'Công cụ',
  education: 'Học vấn',
  certificate: 'Chứng chỉ',
  experience: 'Kinh nghiệm',
  language: 'Ngoại ngữ',
  special_requirement: 'Yêu cầu đặc thù',
  benefit: 'Quyền lợi',
  salary: 'Thu nhập',
  competency: 'Biểu hiện năng lực',
  industry_variant: 'Theo ngành',
  company_variant: 'Theo mô hình công ty',
  career_move: 'Hướng phát triển',
  pass_threshold: 'Ngưỡng đạt',
  interview_question: 'Câu hỏi phỏng vấn',
};

/** "15–25 triệu", "Tới 30 triệu", "Từ 8 triệu" */
export function formatSalaryRange(min: number | null, max: number | null): string {
  const n = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  if (min !== null && max !== null) return min === max ? `${n(min)} triệu` : `${n(min)}–${n(max)} triệu`;
  if (max !== null) return `Tới ${n(max)} triệu`;
  if (min !== null) return `Từ ${n(min)} triệu`;
  return '';
}

/** Khoảng lương bao trùm các nhóm doanh nghiệp của một bậc */
export function salarySpan(items: { section: FrameworkSection; salary_min: number | null; salary_max: number | null }[]): string {
  const rows = items.filter((i) => i.section === 'salary' && (i.salary_min !== null || i.salary_max !== null));
  if (rows.length === 0) return '';
  const mins = rows.map((r) => r.salary_min).filter((v): v is number => v !== null);
  const maxes = rows.map((r) => r.salary_max).filter((v): v is number => v !== null);
  return formatSalaryRange(mins.length ? Math.min(...mins) : null, maxes.length ? Math.max(...maxes) : null);
}
