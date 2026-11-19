/**
 * Sinh lộ trình từ lộ trình mẫu theo band (file BA "[VIBE MAPPING] ROADMAP.xlsx").
 *
 *  - Band của mỗi nhóm tiêu chí chỉ phụ thuộc % đạt: B1 [0,25), B2 [25,50), B3 [50,80), B4 [80,100];
 *    ranh giới thuộc band cao hơn. Chưa có điểm thì coi như 0% (bắt đầu từ B1).
 *  - Thứ tự ưu tiên giữa các nhóm: điểm thiếu = trọng số nghề × (1 − % đạt). Mẫu không có trọng số thì chia đều.
 *  - Xếp theo lượt: lượt 1 gồm các mục ở band hiện tại của mọi nhóm (nhóm thiếu nhiều đứng trước), lượt 2 là band kế
 *    tiếp của mọi nhóm…, để nhóm nào cũng được rèn trước khi đẩy sâu một nhóm.
 *  - Số mục chạy song song = số giờ mỗi tuần ÷ số giờ một mục cần (tối thiểu 1). Mục bắt đầu sau khi xong các mục
 *    tiên quyết và các mục band trước của cùng nhóm; mục không kịp xong trước thời hạn thì bỏ, kéo theo mục phụ thuộc.
 *  - Nhóm có 3 cấp (Lãnh đạo & Tổ chức) chọn cấp theo số giờ mỗi mục: ≤ 1 giờ/tuần cấp 1, < 2,5 cấp 2, còn lại cấp 3.
 */

export type CriteriaGroupCode = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7';
export type BandCode = 'B1' | 'B2' | 'B3' | 'B4';
export type ItemLevel = 1 | 2 | 3;

export const CRITERIA_GROUP_CODES: CriteriaGroupCode[] = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'];
export const BAND_CODES: BandCode[] = ['B1', 'B2', 'B3', 'B4'];
/** % đạt tối thiểu của từng band */
export const DEFAULT_BAND_MIN: Record<BandCode, number> = { B1: 0, B2: 25, B3: 50, B4: 80 };
export const DEFAULT_ITEM_HOURS_PER_WEEK = 2;

export interface RoadmapTemplateItem {
  id: string;
  itemCode: string;
  groupCode: CriteriaGroupCode;
  bandCode: BandCode;
  title: string;
  durationWeeks: number;
  levelDurationWeeks: Partial<Record<'1' | '2' | '3', number>> | null;
  prerequisiteCodes: readonly string[];
  passCriteria: string | null;
  completionEvidence: string | null;
  sortOrder: number;
}

export interface RoadmapTemplateOption {
  code: string;
  learnerLevel: 'high_school' | 'university';
  careerCodePatterns: readonly string[];
  isLevelDefault: boolean;
  sortOrder: number;
}

export interface GroupPriority {
  groupCode: CriteriaGroupCode;
  percent: number | null;
  band: BandCode;
  weight: number;
  gap: number;
}

export interface TemplateMilestone {
  templateItemId: string;
  itemCode: string;
  criteriaGroup: CriteriaGroupCode;
  title: string;
  startDate: string;
  dueDate: string;
  weight: number;
  isCheckpoint: boolean;
  itemLevel: ItemLevel | null;
  passCriteria: string | null;
  expectedResult: string | null;
}

const DAY_MS = 86400000;

function utcDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

function isoAfter(startIso: string, days: number): string {
  return new Date(utcDate(startIso).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Band theo % đạt; ranh giới thuộc band cao hơn, chưa có điểm thì B1 */
export function bandOf(percent: number | null | undefined, minByBand: Record<BandCode, number> = DEFAULT_BAND_MIN): BandCode {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return 'B1';
  return [...BAND_CODES].reverse().find((band) => percent >= minByBand[band]) ?? 'B1';
}

/** Xếp nhóm theo điểm thiếu giảm dần; không có trọng số nào thì chia đều 100 cho 7 nhóm */
export function rankGroups(
  percents: Partial<Record<CriteriaGroupCode, number | null>>,
  weights: Partial<Record<CriteriaGroupCode, number>> = {},
  minByBand: Record<BandCode, number> = DEFAULT_BAND_MIN,
): GroupPriority[] {
  const hasWeights = CRITERIA_GROUP_CODES.some((g) => typeof weights[g] === 'number');
  const equal = 100 / CRITERIA_GROUP_CODES.length;
  return CRITERIA_GROUP_CODES.map((groupCode) => {
    const raw = percents[groupCode];
    const percent = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : null;
    const weight = hasWeights ? weights[groupCode] ?? 0 : equal;
    return {
      groupCode,
      percent,
      band: bandOf(percent, minByBand),
      weight: Number(weight.toFixed(2)),
      gap: Number((weight * (1 - (percent ?? 0) / 100)).toFixed(2)),
    };
  }).sort(
    (a, b) =>
      b.gap - a.gap || b.weight - a.weight || CRITERIA_GROUP_CODES.indexOf(a.groupCode) - CRITERIA_GROUP_CODES.indexOf(b.groupCode),
  );
}

/** Cấp của nhóm có 3 cấp theo số giờ mỗi tuần dành cho một mục */
export function itemLevelFor(hoursPerItem: number): ItemLevel {
  if (hoursPerItem <= 1) return 1;
  if (hoursPerItem < 2.5) return 2;
  return 3;
}

function likeToRegExp(pattern: string): RegExp {
  const body = pattern
    .split('')
    .map((ch) => (ch === '%' ? '.*' : ch === '_' ? '.' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${body}$`, 'i');
}

/** Mẫu cho cấp học: mẫu đầu tiên có mã nghề mục tiêu khớp, nếu không thì mẫu mặc định của cấp học */
export function pickTemplate(
  templates: readonly RoadmapTemplateOption[],
  learnerLevel: 'high_school' | 'university' | null,
  careerCodes: readonly string[],
): string | null {
  if (!learnerLevel) return null;
  const ofLevel = templates.filter((t) => t.learnerLevel === learnerLevel).sort((a, b) => a.sortOrder - b.sortOrder);
  const matched = ofLevel.find((t) =>
    t.careerCodePatterns.some((pattern) => careerCodes.some((code) => likeToRegExp(pattern).test(code))),
  );
  return (matched ?? ofLevel.find((t) => t.isLevelDefault) ?? ofLevel[0])?.code ?? null;
}

export function generateRoadmapFromTemplates(input: {
  startDay: string;
  targetDate: string;
  hoursPerWeek: number;
  items: readonly RoadmapTemplateItem[];
  groups: readonly GroupPriority[];
  itemHoursPerWeek?: number;
  /** Mục mẫu đã có trong lộ trình, không gợi ý lại */
  excludeItemIds?: ReadonlySet<string>;
}): TemplateMilestone[] {
  if (!(input.hoursPerWeek >= 1)) throw new Error('hours_per_week');
  const start = utcDate(input.startDay);
  const target = utcDate(input.targetDate);
  const maxTarget = new Date(Date.UTC(start.getUTCFullYear() + 10, start.getUTCMonth(), start.getUTCDate()));
  if (!(target > start) || target > maxTarget) throw new Error('horizon_invalid');
  if (input.items.length === 0) throw new Error('library_incomplete');

  const itemHours = input.itemHoursPerWeek && input.itemHoursPerWeek > 0 ? input.itemHoursPerWeek : DEFAULT_ITEM_HOURS_PER_WEEK;
  const lanes = Math.max(1, Math.min(CRITERIA_GROUP_CODES.length, Math.floor(input.hoursPerWeek / itemHours)));
  const level = itemLevelFor(input.hoursPerWeek / lanes);
  const horizonDays = Math.round((target.getTime() - start.getTime()) / DAY_MS) + 1;
  const exclude = input.excludeItemIds ?? new Set<string>();

  // Thứ tự xét: theo lượt band, trong lượt theo điểm thiếu của nhóm, trong ô theo thứ tự trong file
  const cellOf = (group: CriteriaGroupCode, band: BandCode) =>
    input.items
      .filter((item) => item.groupCode === group && item.bandCode === band && !exclude.has(item.id))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.itemCode.localeCompare(b.itemCode));
  const queue: { item: RoadmapTemplateItem; pass: number; bandIndex: number }[] = [];
  for (let pass = 0; pass < BAND_CODES.length; pass += 1) {
    for (const group of input.groups) {
      const bandIndex = BAND_CODES.indexOf(group.band) + pass;
      if (bandIndex >= BAND_CODES.length) continue;
      for (const item of cellOf(group.groupCode, BAND_CODES[bandIndex])) queue.push({ item, pass, bandIndex });
    }
  }
  if (queue.length === 0) throw new Error('library_incomplete');

  const queuedCodes = new Set(queue.map((q) => q.item.itemCode));
  const endByCode = new Map<string, number>();
  const skipped = new Set<string>();
  const cellEnd = new Map<string, number>();
  const cellQueued = new Set(queue.map((q) => `${q.item.groupCode}|${q.bandIndex}`));
  const laneFree = Array.from({ length: lanes }, () => 0);
  const placed: { q: (typeof queue)[number]; startDay: number; endDay: number; weeks: number; level: ItemLevel | null }[] = [];

  for (const q of queue) {
    const { item } = q;
    const deps = item.prerequisiteCodes.filter((code) => queuedCodes.has(code));
    const prevCell = `${item.groupCode}|${q.bandIndex - 1}`;
    const prevCellBlocked = cellQueued.has(prevCell) && !cellEnd.has(prevCell);
    if (prevCellBlocked || deps.some((code) => skipped.has(code) || !endByCode.has(code))) {
      skipped.add(item.itemCode);
      continue;
    }
    const ready = Math.max(0, cellEnd.get(prevCell) ?? 0, ...deps.map((code) => endByCode.get(code) ?? 0));
    // Ưu tiên làn rảnh muộn nhất nhưng không muộn hơn lúc sẵn sàng, để các làn rảnh sớm dành cho mục khác
    const fitting = laneFree.map((free, lane) => ({ free, lane })).filter((x) => x.free <= ready);
    const lane = fitting.length > 0
      ? fitting.reduce((a, b) => (b.free > a.free ? b : a)).lane
      : laneFree.indexOf(Math.min(...laneFree));
    const itemLevel = item.levelDurationWeeks ? level : null;
    const weeks = (itemLevel && item.levelDurationWeeks?.[String(itemLevel) as '1' | '2' | '3']) || item.durationWeeks;
    const startDay = Math.max(laneFree[lane], ready);
    const endDay = startDay + weeks * 7;
    if (endDay > horizonDays) {
      skipped.add(item.itemCode);
      continue;
    }
    laneFree[lane] = endDay;
    endByCode.set(item.itemCode, endDay);
    const key = `${item.groupCode}|${q.bandIndex}`;
    cellEnd.set(key, Math.max(cellEnd.get(key) ?? 0, endDay));
    placed.push({ q, startDay, endDay, weeks, level: itemLevel });
  }

  // Thời hạn quá ngắn cho mọi mục: vẫn giao mục đầu tiên, hạn là thời hạn mục tiêu
  if (placed.length === 0) {
    const first = queue[0];
    const itemLevel = first.item.levelDurationWeeks ? level : null;
    placed.push({ q: first, startDay: 0, endDay: horizonDays, weeks: first.item.durationWeeks, level: itemLevel });
  }

  // Cột mốc: mục kết thúc muộn nhất của mỗi lượt
  const lastOfPass = new Map<number, (typeof placed)[number]>();
  for (const p of placed) {
    const current = lastOfPass.get(p.q.pass);
    if (!current || p.endDay > current.endDay) lastOfPass.set(p.q.pass, p);
  }
  const checkpoints = new Set(lastOfPass.values());

  return placed
    .sort((a, b) => a.endDay - b.endDay || a.startDay - b.startDay)
    .map((p) => ({
      templateItemId: p.q.item.id,
      itemCode: p.q.item.itemCode,
      criteriaGroup: p.q.item.groupCode,
      title: p.q.item.title,
      startDate: isoAfter(input.startDay, p.startDay),
      dueDate: isoAfter(input.startDay, Math.min(p.endDay, horizonDays) - 1),
      weight: Number(Math.max(0.5, p.weeks / 4).toFixed(2)),
      isCheckpoint: checkpoints.has(p),
      itemLevel: p.level,
      passCriteria: p.q.item.passCriteria,
      expectedResult: p.q.item.completionEvidence,
    }));
}
