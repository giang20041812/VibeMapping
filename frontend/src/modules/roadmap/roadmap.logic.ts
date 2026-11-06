import { evaluateRoadmapProgress } from '../../domain/assessmentRules';
import type { ActivityType, Milestone, RegenerateReason, Roadmap, RoadmapPillar, SetupErrors, SetupValues, Stage } from './roadmap.types';

export const PILLAR_ORDER: RoadmapPillar[] = ['knowledge', 'experience', 'exploration'];

export const PILLAR_LABEL: Record<RoadmapPillar, string> = {
  knowledge: 'Kiến thức',
  experience: 'Kinh nghiệm',
  exploration: 'Trải nghiệm',
};

export const EMPTY_SETUP: SetupValues = {
  careerIds: [],
  reason: '',
  educationLevel: '',
  schoolYear: '',
  skills: '',
  certificates: '',
  extracurricular: '',
  targetMonth: '',
  hoursPerWeek: '',
};

export const EDUCATION_LEVELS = [
  { value: 'Trung học phổ thông', label: 'Trung học phổ thông' },
  { value: 'Đại học / Cao đẳng', label: 'Đại học / Cao đẳng' },
];

const YEARS_BY_LEVEL: Record<string, string[]> = {
  'Trung học phổ thông': ['Lớp 9', 'Lớp 10', 'Lớp 11', 'Lớp 12'],
  'Đại học / Cao đẳng': ['Năm 1', 'Năm 2', 'Năm 3', 'Năm 4', 'Năm 5'],
};

export function schoolYearOptions(level: string) {
  return (YEARS_BY_LEVEL[level] ?? []).map((value) => ({ value, label: value }));
}

/** Điểm xuất phát lấy từ hồ sơ: vai trò quyết định cấp học, khối lớp lấy từ trường khối lớp/ngành */
export function originFromProfile(role: string | undefined, gradeOrMajor: string | null | undefined) {
  const level = role === 'university_student' ? 'Đại học / Cao đẳng' : 'Trung học phổ thông';
  const grade = (gradeOrMajor ?? '').match(/(?:lớp|khối)\s*(\d{1,2})/i);
  const year = grade ? `Lớp ${grade[1]}` : '';
  return { educationLevel: level, schoolYear: schoolYearOptions(level).some((o) => o.value === year) ? year : '' };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "06/2028" → ngày cuối tháng 2028-06-30; sai định dạng thì null */
export function monthEndFromInput(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})\s*\/\s*(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const year = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(last)}`;
}

export function monthInputFromIso(iso: string | null): string {
  return iso ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
}

export const REASON_OPTIONS: { value: RegenerateReason; label: string }[] = [
  { value: 'off_track', label: 'Chệch hướng so với kế hoạch' },
  { value: 'circumstances', label: 'Hoàn cảnh thay đổi' },
  { value: 'career_changed', label: 'Đổi nghề mục tiêu' },
  { value: 'not_admitted', label: 'Không trúng tuyển' },
];

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  course: 'Khóa học',
  book: 'Sách',
  exercise: 'Bài tập',
  project: 'Dự án nhỏ',
};

export function validateSetup(values: SetupValues, requireReason = false, todayIso = new Date().toISOString().slice(0, 10)): SetupErrors {
  const errors: SetupErrors = {};
  if (requireReason && !values.reason) errors.reason = 'Chọn lý do tạo lại.';
  if (values.careerIds.length === 0) errors.careerIds = 'Chọn nghề mục tiêu.';
  if (!values.educationLevel) errors.educationLevel = 'Chọn cấp học.';
  if (!values.schoolYear) errors.schoolYear = 'Chọn năm học hoặc lớp.';
  const end = monthEndFromInput(values.targetMonth);
  if (!values.targetMonth.trim()) errors.targetMonth = 'Vui lòng chọn thời hạn đạt mục tiêu.';
  else if (!end) errors.targetMonth = 'Nhập theo dạng tháng/năm.';
  else if (end <= todayIso) errors.targetMonth = 'Thời hạn phải ở tương lai.';
  else if (Date.parse(end) - Date.parse(todayIso) > 3653 * 86400000) errors.targetMonth = 'Tối đa 10 năm.';
  const hours = Number(values.hoursPerWeek);
  if (!values.hoursPerWeek.trim() || !Number.isInteger(hours) || hours <= 0) {
    errors.hoursPerWeek = 'Vui lòng nhập số giờ mỗi tuần (số nguyên lớn hơn 0).';
  }
  return errors;
}

/** "2026-11" → "Tháng 11/2026" */
export function stageLabel(key: string): string {
  return key === 'none' ? 'Chưa có hạn' : `Tháng ${key.slice(5, 7)}/${key.slice(0, 4)}`;
}

export function formatDate(iso: string | null): string {
  return iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('vi-VN') : '';
}

const weightOf = (m: Milestone) => Number(m.weight) || 1;

/** Nhóm hoạt động thành giai đoạn theo tháng của hạn; xác định giai đoạn đang diễn ra và trụ cột còn thiếu */
export function buildStages(milestones: readonly Milestone[], todayIso = new Date().toISOString().slice(0, 10)): Stage[] {
  const groups = new Map<string, Milestone[]>();
  for (const m of milestones) {
    const key = m.due_date ? m.due_date.slice(0, 7) : 'none';
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === 'none' ? 1 : b === 'none' ? -1 : a.localeCompare(b)));
  const todayKey = todayIso.slice(0, 7);
  const firstOpen = keys.find((k) => k !== 'none' && k >= todayKey && groups.get(k)!.some((m) => !m.done));
  const fallbackOpen = [...keys].reverse().find((k) => k !== 'none' && groups.get(k)!.some((m) => !m.done));
  const currentKey = firstOpen ?? fallbackOpen;

  return keys.map((key) => {
    const items = groups.get(key)!;
    const startIso = key === 'none' ? null : `${key}-01`;
    const endIso = key === 'none' ? null : new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).toISOString().slice(0, 10);
    const total = items.reduce((s, m) => s + weightOf(m), 0);
    const doneW = items.filter((m) => m.done).reduce((s, m) => s + weightOf(m), 0);
    const actualPercent = total > 0 ? Math.round((doneW / total) * 100) : 0;
    let plannedPercent = 0;
    if (startIso && endIso) {
      if (endIso < todayIso) plannedPercent = 100;
      else if (startIso <= todayIso) {
        const span = Date.parse(endIso) - Date.parse(startIso) + 86400000;
        plannedPercent = Math.round(((Date.parse(todayIso) - Date.parse(startIso) + 86400000) / span) * 100);
      }
    }
    const allDone = items.every((m) => m.done);
    const status = allDone ? 'done' : endIso && endIso < todayIso ? 'late' : key === currentKey ? 'current' : 'upcoming';
    return {
      key,
      label: stageLabel(key),
      startIso,
      endIso,
      items,
      missingPillars: PILLAR_ORDER.filter((p) => !items.some((m) => m.pillar === p)),
      actualPercent,
      plannedPercent,
      status,
    };
  });
}

/** Giai đoạn hiện tại: đang diễn ra, nếu không thì giai đoạn trễ gần nhất, nếu không thì giai đoạn mở kế tiếp */
export function currentStage(stages: readonly Stage[]): Stage | null {
  return (
    stages.find((s) => s.status === 'current') ??
    stages.find((s) => s.status === 'late') ??
    stages.find((s) => s.status === 'upcoming') ??
    null
  );
}

export function monthsLeft(targetIso: string | null, todayIso = new Date().toISOString().slice(0, 10)): number | null {
  if (!targetIso) return null;
  const t = new Date(`${targetIso}T00:00:00Z`);
  const n = new Date(`${todayIso}T00:00:00Z`);
  return Math.max(0, (t.getUTCFullYear() - n.getUTCFullYear()) * 12 + t.getUTCMonth() - n.getUTCMonth());
}

/** Tiến độ của một lộ trình, có thể giả định thêm các thay đổi hoàn thành chưa lưu */
export function progressOf(roadmap: Roadmap, overrides: Readonly<Record<string, boolean>> = {}) {
  return evaluateRoadmapProgress(
    roadmap.milestones.map((m) => ({
      id: m.id,
      pillar: m.pillar,
      title: m.title,
      done: overrides[m.id] ?? m.done,
      weight: Number(m.weight) || 1,
      dueDate: m.due_date,
      isCheckpoint: m.is_checkpoint,
    })),
    undefined,
    { startIso: roadmap.created_at, targetIso: roadmap.target_date },
  );
}
