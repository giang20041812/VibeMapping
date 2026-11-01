/** Sinh lộ trình 3 trụ từ thư viện đã duyệt (F07.01). Port logic CNS, trụ cột theo tên VM. */

export type RoadmapPillar = 'knowledge' | 'experience' | 'exploration';

export interface ApprovedActivityTemplate {
  id: string;
  pillar: RoadmapPillar;
  title: string;
  durationWeeks: number;
  hours: number;
  criteriaId: string | null;
  repeatable: boolean;
}

export interface GeneratedMilestone {
  pillar: RoadmapPillar;
  title: string;
  dueDate: string;
  weight: number;
  isCheckpoint: boolean;
  activityId: string;
}

const PILLARS: RoadmapPillar[] = ['knowledge', 'experience', 'exploration'];

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addMonths(start: Date, amount: number): Date {
  const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + amount, 1));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(start.getUTCDate(), last));
  return date;
}

function weakness(template: ApprovedActivityTemplate, scores: Readonly<Record<string, number | null>>): number {
  if (!template.criteriaId) return 101;
  const score = scores[template.criteriaId];
  return typeof score === 'number' ? score : 101;
}

export function generateRoadmapFromLibrary(input: {
  startDay: string;
  targetDate: string;
  hoursPerWeek: number;
  templates: readonly ApprovedActivityTemplate[];
  scoresByCriterionId?: Readonly<Record<string, number | null>>;
}): GeneratedMilestone[] {
  if (!(input.hoursPerWeek >= 1)) throw new Error('hours_per_week');
  const start = utcDate(input.startDay);
  const target = utcDate(input.targetDate);
  if (!(target > start) || target > addMonths(start, 120)) throw new Error('horizon_invalid');
  if (PILLARS.some((pillar) => !input.templates.some((row) => row.pillar === pillar))) {
    throw new Error('library_incomplete');
  }

  const scores = input.scoresByCriterionId ?? {};
  const sorted = [...input.templates]
    .filter((row) => PILLARS.includes(row.pillar))
    .sort(
      (a, b) =>
        weakness(a, scores) - weakness(b, scores) ||
        a.title.localeCompare(b.title, 'vi') ||
        a.id.localeCompare(b.id),
    );
  const used = new Set<string>();
  const milestones: GeneratedMilestone[] = [];

  for (let offset = 0; ; offset += offset < 12 ? 1 : 3) {
    const phaseStart = addMonths(start, offset);
    if (phaseStart >= target) break;
    const rawEnd = addMonths(start, offset + (offset < 12 ? 1 : 3));
    rawEnd.setUTCDate(rawEnd.getUTCDate() - 1);
    const phaseEnd = rawEnd > target ? target : rawEnd;
    const weeks = (phaseEnd.getTime() - phaseStart.getTime() + 86400000) / 604800000;
    let remainingHours = weeks * input.hoursPerWeek;
    const phaseItems: GeneratedMilestone[] = [];

    for (const pillar of PILLARS) {
      const candidate = sorted.find(
        (row) =>
          row.pillar === pillar &&
          row.durationWeeks <= weeks &&
          row.hours <= remainingHours &&
          (row.repeatable || !used.has(row.id)),
      );
      if (!candidate) continue;
      remainingHours -= candidate.hours;
      if (!candidate.repeatable) used.add(candidate.id);
      phaseItems.push({
        pillar,
        title: candidate.title,
        dueDate: isoDay(phaseEnd),
        weight: Number(Math.max(1, candidate.hours / 6).toFixed(2)),
        isCheckpoint: false,
        activityId: candidate.id,
      });
    }

    if (phaseItems.length === 0) {
      if (milestones.length === 0) throw new Error('library_incomplete');
      break;
    }
    phaseItems[phaseItems.length - 1].isCheckpoint = true;
    milestones.push(...phaseItems);
  }

  if (milestones.length === 0) throw new Error('library_incomplete');
  return milestones;
}
