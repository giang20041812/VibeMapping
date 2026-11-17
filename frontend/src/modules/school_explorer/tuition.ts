import type { ProgramSummary } from './education.service';

/**
 * Cách thu học phí của một chương trình. Mỗi trường công bố một kiểu khác nhau, nên mỗi chương trình có đúng một
 * "đơn vị gốc" (số do nguồn ghi rõ); các đơn vị còn lại hoặc cũng do nguồn ghi (tín chỉ, tháng, tổng khóa)
 * hoặc là số quy đổi (kỳ ↔ năm, năm × số năm).
 */
export type TuitionUnit = 'semester' | 'year' | 'month' | 'credit' | 'total';
export type TuitionKind = TuitionUnit | 'free' | 'unpublished' | 'unclear';

export type TuitionInput = Pick<
  ProgramSummary,
  | 'studyYears'
  | 'tuitionText'
  | 'tuitionMin'
  | 'tuitionMax'
  | 'tuitionYearMin'
  | 'tuitionYearMax'
  | 'tuitionTotalMin'
  | 'tuitionTotalMax'
  | 'tuitionPerCredit'
  | 'programCredits'
  | 'tuitionPerMonth'
  | 'tuitionBasis'
  | 'tuitionStatus'
>;

export interface TuitionFigure {
  unit: TuitionUnit;
  label: string;
  value: string;
  /** true: số quy đổi từ đơn vị khác, không phải số nguồn ghi */
  derived: boolean;
  note?: string;
}

export interface TuitionView {
  kind: TuitionKind;
  kindLabel: string;
  /** Số gốc kèm đơn vị của chính nó */
  headline: string;
  /** Mọi số có được, số gốc đứng đầu */
  figures: TuitionFigure[];
  /** Số học phí năm quy đổi để so giữa các chương trình; trống khi đơn vị gốc đã là năm hoặc không quy đổi được */
  yearly: TuitionFigure | null;
}

const KIND_LABEL: Record<TuitionKind, string> = {
  semester: 'Theo học kỳ',
  year: 'Theo năm',
  month: 'Theo tháng',
  credit: 'Theo tín chỉ',
  total: 'Trọn khóa',
  free: 'Miễn học phí',
  unpublished: 'Chưa công bố',
  unclear: 'Đang cập nhật',
};

const UNIT_LABEL: Record<TuitionUnit, string> = {
  semester: 'Mỗi học kỳ',
  year: 'Mỗi năm',
  month: 'Mỗi tháng',
  credit: 'Mỗi tín chỉ',
  total: 'Cả khóa',
};

const UNIT_SUFFIX: Record<TuitionUnit, string> = {
  semester: '/kỳ',
  year: '/năm',
  month: '/tháng',
  credit: '/tín chỉ',
  total: ' cả khóa',
};

const FIGURE_ORDER: TuitionUnit[] = ['semester', 'year', 'month', 'credit', 'total'];

const vn = (n: number, digits: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: digits });

export function formatMoney(v: number): string {
  if (v === 0) return '0 đồng';
  if (v >= 1_000_000_000) return `${vn(v / 1_000_000_000, 2)} tỷ`;
  if (v >= 1_000_000) return `${vn(v / 1_000_000, 1)} triệu`;
  if (v >= 1_000) return `${vn(v / 1_000, 0)} nghìn`;
  return `${vn(v, 0)} đồng`;
}

type Range = [min: number, max: number];

const rangeOf = (min: number | null, max: number | null): Range | null => (min === null ? null : [min, max ?? min]);
const formatRange = ([low, high]: Range): string => (low === high ? formatMoney(low) : `${formatMoney(low)}–${formatMoney(high)}`);
const scaled = ([low, high]: Range, k: number): Range => [Math.round(low * k), Math.round(high * k)];

/** Đơn vị mà số liệu gốc của chương trình được ghi theo */
function nativeUnit(p: TuitionInput, has: Record<TuitionUnit, boolean>): TuitionUnit | null {
  switch (p.tuitionBasis) {
    case 'semester': return 'semester';
    case 'year': return has.month ? 'month' : 'year';
    case 'total': return 'total';
    case 'credit': return 'credit';
    default: break;
  }
  return FIGURE_ORDER.find((unit) => has[unit]) ?? null;
}

export function describeTuition(p: TuitionInput): TuitionView {
  const semester = rangeOf(p.tuitionMin, p.tuitionMax);
  const year = rangeOf(p.tuitionYearMin, p.tuitionYearMax);
  const total = rangeOf(p.tuitionTotalMin, p.tuitionTotalMax);
  const month: Range | null = p.tuitionPerMonth !== null ? [p.tuitionPerMonth, p.tuitionPerMonth] : null;
  const credit: Range | null = p.tuitionPerCredit !== null ? [p.tuitionPerCredit, p.tuitionPerCredit] : null;

  const view = (kind: TuitionKind, headline: string, figures: TuitionFigure[] = [], yearly: TuitionFigure | null = null): TuitionView => ({
    kind, kindLabel: KIND_LABEL[kind], headline, figures, yearly,
  });

  if (p.tuitionStatus === 'free' || semester?.[1] === 0 || year?.[1] === 0) return view('free', KIND_LABEL.free);

  const values: Record<TuitionUnit, Range | null> = { semester, year, month, credit, total };
  const has = Object.fromEntries(FIGURE_ORDER.map((unit) => [unit, values[unit] !== null])) as Record<TuitionUnit, boolean>;
  const native = nativeUnit(p, has);
  if (!native) return view(p.tuitionStatus === 'unpublished' ? 'unpublished' : 'unclear', p.tuitionStatus === 'unpublished' ? KIND_LABEL.unpublished : KIND_LABEL.unclear);

  const figure = (unit: TuitionUnit, range: Range, derived: boolean, note?: string): TuitionFigure => ({
    unit, label: UNIT_LABEL[unit], value: `${formatRange(range)}${UNIT_SUFFIX[unit]}`, derived, note,
  });

  const figures: TuitionFigure[] = [];
  for (const unit of FIGURE_ORDER) {
    const range = values[unit];
    if (range) {
      // Kỳ và năm thường là số quy đổi; tháng, tín chỉ, tổng khóa chỉ có khi nguồn ghi
      const derived = unit !== native && (unit === 'semester' || unit === 'year');
      figures.push(figure(unit, range, derived, unit === 'credit' && p.programCredits ? `khung ${p.programCredits} tín chỉ` : undefined));
    }
  }
  if (!total) {
    const years = p.studyYears && p.studyYears > 0 ? p.studyYears : null;
    if (year && years) figures.push(figure('total', scaled(year, years), true));
    else if (credit && p.programCredits) figures.push(figure('total', scaled(credit, p.programCredits), true));
  }
  figures.sort((a, b) => Number(b.unit === native) - Number(a.unit === native) || FIGURE_ORDER.indexOf(a.unit) - FIGURE_ORDER.indexOf(b.unit));

  const headline = figures.find((f) => f.unit === native)?.value ?? KIND_LABEL.unclear;
  const yearly = native === 'year' ? null : figures.find((f) => f.unit === 'year') ?? null;
  return view(native, headline, figures, yearly);
}

export function formatTuition(p: TuitionInput): string {
  return describeTuition(p).headline;
}

const NOT_CONVERTIBLE = 'Chưa quy đổi được';

function figureLabel(view: TuitionView, unit: TuitionUnit): { label: string; isEstimate: boolean } {
  if (view.kind === 'free') return { label: KIND_LABEL.free, isEstimate: false };
  const found = view.figures.find((f) => f.unit === unit);
  if (found) return { label: found.value, isEstimate: found.derived };
  return { label: view.kind === 'unpublished' || view.kind === 'unclear' ? KIND_LABEL.unpublished : NOT_CONVERTIBLE, isEstimate: false };
}

export function formatYearlyTuition(p: TuitionInput): { label: string; isEstimate: boolean } {
  return figureLabel(describeTuition(p), 'year');
}

export function formatTotalTuition(p: TuitionInput): { label: string; isEstimate: boolean } {
  return figureLabel(describeTuition(p), 'total');
}
