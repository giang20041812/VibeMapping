import type { FrameworkSection, FrameworkTier } from '../career_explorer/careerLevelFramework.types';
import type { GapImpact, GapParams, GapStatus, SkillKind } from './portfolio.types';

export const SKILL_KIND_LABEL: Record<SkillKind, string> = {
  hard_skill: 'Kỹ năng chuyên môn',
  soft_skill: 'Kỹ năng mềm',
  knowledge: 'Kiến thức',
  tool: 'Công cụ',
  language: 'Ngoại ngữ',
  certificate: 'Chứng chỉ',
  project: 'Dự án',
  experience: 'Kinh nghiệm',
};

/** Thứ tự nhóm trên hồ sơ */
export const SKILL_KIND_ORDER: SkillKind[] = ['hard_skill', 'knowledge', 'tool', 'soft_skill', 'language', 'certificate', 'project', 'experience'];

/** Loại sinh viên tự thêm; kỹ năng mềm lấy từ kết quả 360° hoặc từ yêu cầu JD */
export const MANUAL_SKILL_KINDS: SkillKind[] = ['hard_skill', 'knowledge', 'tool', 'language', 'certificate', 'project', 'experience'];

/** Thang tự chấm 1–5 */
export const PROFICIENCY_LABEL: Record<number, string> = {
  1: 'Mới biết khái niệm',
  2: 'Làm được khi có hướng dẫn',
  3: 'Tự làm độc lập',
  4: 'Xử lý được tình huống thực tế',
  5: 'Dẫn dắt được người khác',
};
export const PROFICIENCY_LEVELS = [1, 2, 3, 4, 5];

/** Mục yêu cầu của khung JD được đem ra so với hồ sơ */
export const GAP_SECTIONS: FrameworkSection[] = ['professional_skill', 'knowledge', 'tool', 'soft_skill', 'language', 'certificate'];

/** Mục của khung JD ứng với loại mục trên hồ sơ khi sinh viên thêm nhanh */
export const SECTION_TO_KIND: Partial<Record<FrameworkSection, SkillKind>> = {
  professional_skill: 'hard_skill',
  knowledge: 'knowledge',
  tool: 'tool',
  soft_skill: 'soft_skill',
  language: 'language',
  certificate: 'certificate',
};

export const TIER_TO_IMPACT: Record<FrameworkTier, GapImpact> = {
  required: 'high',
  common: 'medium',
  advantage: 'low',
};

export const IMPACT_LABEL: Record<GapImpact, string> = {
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
};

export const GAP_STATUS_LABEL: Record<GapStatus, string> = {
  met: 'Đạt',
  near: 'Gần đạt',
  unmet: 'Chưa đạt',
};

export const GAP_STATUS_VARIANT: Record<GapStatus, 'success' | 'warning' | 'danger'> = {
  met: 'success',
  near: 'warning',
  unmet: 'danger',
};

/** Ý nghĩa ba nhãn theo ngưỡng thiếu đang cấu hình */
export function gapStatusHint(status: GapStatus, largeGapLevel: number): string {
  const level = largeGapLevel.toLocaleString('vi-VN');
  if (status === 'met') return 'Bằng hoặc cao hơn mức yêu cầu';
  if (status === 'near') return `Thiếu chưa tới ${level} mức`;
  return `Thiếu từ ${level} mức hoặc chưa có trong hồ sơ`;
}

/** Dùng khi chưa đọc được tham số vận hành */
export const DEFAULT_GAP_PARAMS: GapParams = {
  impactWeights: { required: 3, common: 2, advantage: 1 },
  defaultRequiredLevel: 3,
  largeGapLevel: 1,
};

export const SUGGESTION_KIND_LABEL: Record<'course' | 'project' | 'certificate', string> = {
  course: 'Khóa học',
  project: 'Dự án',
  certificate: 'Chứng chỉ',
};
