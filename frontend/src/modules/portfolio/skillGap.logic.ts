import { normalizeSearchText } from '../../lib/searchText';
import type { CareerLevelFramework, FrameworkTier } from '../career_explorer/careerLevelFramework.types';
import { GAP_SECTIONS, TIER_TO_IMPACT } from './portfolio.constants';
import type { CourseSuggestion, GapParams, GapResult, GapRow, GapStatus, SkillProfileItem } from './portfolio.types';

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Hai tên kỹ năng được coi là một khi trùng nhau sau khi bỏ dấu, hoặc tên này chứa trọn tên kia (từ 4 ký tự) */
export function sameSkill(a: string, b: string): boolean {
  const x = normalizeSearchText(a).replace(/\s+/g, ' ');
  const y = normalizeSearchText(b).replace(/\s+/g, ' ');
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 4 && long.includes(short);
}

/** Mục hồ sơ ứng với một kỹ năng JD: gắn đúng dòng yêu cầu trước, sau đó trùng tên */
export function findProfileItem(items: SkillProfileItem[], itemId: string | null, content: string): SkillProfileItem | null {
  if (itemId) {
    const linked = items.find((item) => item.framework_item_id === itemId);
    if (linked) return linked;
  }
  return items.find((item) => sameSkill(item.title, content)) ?? null;
}

export function classifyGap(gap: number, largeGapLevel: number): GapStatus {
  if (gap <= 0) return 'met';
  return gap < largeGapLevel ? 'near' : 'unmet';
}

/**
 * So hồ sơ năng lực với các kỹ năng của một bậc JD (FR08.02.01–03).
 * Kỹ năng JD mà hồ sơ chưa có, hoặc có nhưng chưa tự chấm, là Chưa đạt (BR-030).
 * Mức đạt tổng thể = Σ(trọng số × min(hiện có / yêu cầu, 1)) ÷ Σ trọng số.
 * Kỹ năng cần bổ sung xếp giảm dần theo mức ảnh hưởng, rồi theo mức thiếu (BR-031).
 */
export function analyseSkillGap(
  framework: CareerLevelFramework,
  positionName: string,
  items: SkillProfileItem[],
  params: GapParams,
): GapResult {
  const required = framework.required_level ?? params.defaultRequiredLevel;
  const rows: GapRow[] = framework.items
    .filter((item) => GAP_SECTIONS.includes(item.section))
    .map((item) => {
      const tier: FrameworkTier = item.tier ?? 'common';
      const match = findProfileItem(items, item.id ?? null, item.content);
      const current = match?.self_level ?? null;
      const gap = current === null ? required : Math.max(0, round1(required - current));
      return {
        item_id: item.id ?? null,
        section: item.section,
        tier,
        content: item.content,
        detail: item.detail,
        impact: TIER_TO_IMPACT[tier],
        weight: params.impactWeights[tier] ?? 1,
        required_level: required,
        current_level: current,
        profile_item_id: match?.id ?? null,
        criteria_id: match?.criteria_id ?? null,
        verified_360: Boolean(match?.verified_360),
        gap,
        status: current === null ? 'unmet' : classifyGap(gap, params.largeGapLevel),
      };
    });

  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  const achieved = rows.reduce((sum, row) => sum + row.weight * Math.min((row.current_level ?? 0) / required, 1), 0);
  const counts: Record<GapStatus, number> = { met: 0, near: 0, unmet: 0 };
  for (const row of rows) counts[row.status] += 1;

  const ranked = rows
    .filter((row) => row.status !== 'met')
    .sort((a, b) => b.weight - a.weight || b.gap - a.gap || a.content.localeCompare(b.content, 'vi'));

  return {
    framework_id: framework.id,
    career_id: framework.career_id,
    position_name: positionName,
    analysed_at: new Date().toISOString(),
    overall_percent: totalWeight === 0 ? 0 : round1((achieved / totalWeight) * 100),
    counts,
    rows,
    ranked,
  };
}

/** Gợi ý khớp một kỹ năng: theo từ khóa kỹ năng, hoặc theo tiêu chí 360° của kỹ năng mềm đã xác thực */
export function suggestionsForSkill(row: GapRow, suggestions: CourseSuggestion[]): CourseSuggestion[] {
  return suggestions.filter((s) =>
    (row.criteria_id !== null && s.criteria_id === row.criteria_id)
    || s.skill_keywords.some((keyword) => sameSkill(keyword, row.content)));
}

/** Mức trung bình (0–100) của từng mục yêu cầu, để vẽ biểu đồ radar theo nhóm kỹ năng */
export function sectionAttainment(rows: GapRow[]): { section: GapRow['section']; percent: number; count: number }[] {
  const groups = new Map<GapRow['section'], GapRow[]>();
  for (const row of rows) groups.set(row.section, [...(groups.get(row.section) ?? []), row]);
  return GAP_SECTIONS.filter((section) => groups.has(section)).map((section) => {
    const list = groups.get(section)!;
    const avg = list.reduce((sum, row) => sum + Math.min((row.current_level ?? 0) / row.required_level, 1), 0) / list.length;
    return { section, percent: Math.round(avg * 100), count: list.length };
  });
}

export function formatLevel(value: number | null): string {
  return value === null ? '–' : value.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}
