/**
 * Tách số liệu học phí từ chữ tự do của file research.
 *
 * Quy ước đầu ra (đơn vị đồng, khoảng min–max):
 *   - perYear       : số duy nhất dùng để so sánh giữa các chương trình
 *   - perSemester   : mỗi kỳ (ghi rõ trong chữ gốc, hoặc perYear ÷ số kỳ/năm)
 *   - total         : tổng cả khóa nếu chữ gốc ghi rõ
 *   - perCredit     : đơn giá tín chỉ; perMonth: đơn giá tháng (chỉ lưu, không quy đổi khi thiếu dữ kiện)
 *
 * Thứ tự ưu tiên khi nhiều dòng cùng nói về học phí: kỳ ghi rõ -> năm ghi rõ -> tổng khóa ÷ số năm ->
 * đơn giá tín chỉ × khung tín chỉ ÷ số năm. Hai nhóm sau và tín chỉ là ước tính (isEstimate).
 * Không đoán: thiếu dữ kiện thì để trống và ghi trạng thái.
 */

export type TuitionStatus = 'amount' | 'free' | 'credit_only' | 'unpublished' | 'unclear';
export type TuitionBasis = 'semester' | 'year' | 'total' | 'credit';
export type Range = [min: number, max: number];

export interface TuitionParse {
  status: TuitionStatus;
  basis: TuitionBasis | null;
  isEstimate: boolean;
  semestersPerYear: number | null;
  perSemester: Range | null;
  perYear: Range | null;
  total: Range | null;
  perCredit: Range | null;
  credits: number | null;
  perMonth: Range | null;
  /** Dòng cần BA/dev xem lại: lệch giữa các dòng, bị loại do ngoài khoảng hợp lý */
  warnings: string[];
}

/** Một năm học phí hợp lý của chương trình đại học/sau đại học ở Việt Nam */
export const YEAR_MIN = 3_000_000;
export const YEAR_MAX = 600_000_000;
const DEFAULT_SEMESTERS_PER_YEAR = 2;
const CONFLICT_RATIO = 0.3;

type Kind = 'semester' | 'year' | 'total' | 'credit' | 'month';
interface Candidate {
  kind: Kind;
  range: Range;
  years: number | null;
  semestersPerYear: number | null;
  credits: number | null;
  /** Số tiền nằm trong ngoặc của dòng tháng, ví dụ "(≈80 triệu/năm, 10 tháng)" */
  yearHint: Range | null;
  line: string;
}

const UNIT = String.raw`(?:(tri[eệ]u|tr)(?:\s*(?:đồng|đ|vnđ|vnd))?|(đồng|đ|vnđ|vnd))(?![\p{L}])`;
const NUM = String.raw`(\d[\d.,]*)`;
const MONEY_RANGE = new RegExp(String.raw`${NUM}\s*(?:${UNIT})?\s*(?:[–—-]|đến|tới)\s*[≈~]?\s*${NUM}\s*${UNIT}`, 'iu');
const MONEY_ONE = new RegExp(String.raw`${NUM}\s*${UNIT}`, 'iu');
const MONEY_ONE_G = new RegExp(String.raw`${NUM}\s*${UNIT}`, 'giu');
const SUFFIX = /^\s*(?:\/|trên\s|mỗi\s)\s*(tháng|năm|học\s*kỳ|kỳ|hk|tín\s*chỉ|tchp|tc|học\s*phần|môn)(?![\p{L}])/iu;

const RELEVANT = /học phí|đơn giá|^\W*mức|toàn khóa|trọn khóa|toàn chương trình|lộ trình\s*\d+\s*năm/i;
const EXCLUDED = /lệ phí|phí xét tuyển|phí hồ sơ|phí nhập học|học bổng|bổ sung kiến thức|cam kết không tăng|giai đoạn|lộ trình tăng|tăng\s*\d+\s*(?:%|phần trăm|triệu)|ký túc|thi ngoại ngữ/i;
const FREE = /miễn (?:học )?phí|(?<![\d.,])0\s*(?:vnđ|vnd|đồng|đ)(?![\p{L}\/])/iu;
const NOT_PUBLISHED = /chưa (?:có|công bố|tìm|thể|xác minh|rõ)|cần (?:đối chiếu|bổ sung|research)|đang cập nhật|không công bố/i;

const stripParens = (text: string): string => {
  let out = text;
  for (let guard = 0; guard < 4 && /\([^()]*\)/.test(out); guard += 1) out = out.replace(/\([^()]*\)/g, ' ');
  return out;
};
const parensOf = (text: string): string[] => [...text.matchAll(/\(([^()]*)\)/g)].map((m) => m[1]);

/** Số kiểu Việt Nam: tiền đồng thì dấu chấm/phẩy là phân nhóm hàng nghìn; còn lại dấu phẩy là thập phân */
function toNumber(raw: string, dong: boolean): number {
  if (dong) return Number(raw.replace(/[.,]/g, ''));
  const cleaned = raw.replace(/,/g, '.');
  return Number((cleaned.match(/\./g) ?? []).length > 1 ? cleaned.replace(/\./g, '') : cleaned);
}

interface Money { range: Range; start: number; end: number }

const isMillion = (unit: string | undefined) => /^tr/i.test(unit ?? '');

function readMoney(text: string): Money | null {
  const range = MONEY_RANGE.exec(text);
  if (range) {
    const million = isMillion(range[2]) || isMillion(range[5]) ? 1_000_000 : 1;
    const low = toNumber(range[1], million === 1);
    const high = toNumber(range[4], million === 1);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return { range: [Math.round(Math.min(low, high) * million), Math.round(Math.max(low, high) * million)], start: range.index, end: range.index + range[0].length };
    }
  }
  const one = MONEY_ONE.exec(text);
  if (!one) return null;
  const million = isMillion(one[2]) ? 1_000_000 : 1;
  const value = toNumber(one[1], million === 1);
  if (!Number.isFinite(value)) return null;
  const amount = Math.round(value * million);
  return { range: [amount, amount], start: one.index, end: one.index + one[0].length };
}

/** null = đơn vị không dùng được (theo học phần, theo môn): bỏ cả dòng */
const kindOfSuffix = (suffix: string): Kind | null => {
  const s = suffix.toLowerCase().replace(/\s+/g, ' ');
  if (s === 'tháng') return 'month';
  if (s === 'năm') return 'year';
  if (s === 'kỳ' || s === 'học kỳ' || s === 'hk') return 'semester';
  if (s === 'học phần' || s === 'môn') return null;
  return 'credit';
};

const kindOfLabel = (label: string): Kind | null => {
  if (/tổng học phí|học phí toàn khóa|toàn khóa|trọn khóa|toàn chương trình|học phí khóa\s*[:(]/i.test(label)) return 'total';
  if (/(?:1|một|mỗi)\s*(?:kỳ|học kỳ)|học kỳ\s*\d|bình quân.*kỳ/i.test(label)) return 'semester';
  if (/(?:1|một|mỗi)\s*năm|năm học|năm thứ nhất/i.test(label)) return 'year';
  if (/tín chỉ|đơn giá/i.test(label)) return 'credit';
  return null;
};

function readYears(line: string, stripped: string): number | null {
  const label = /(?:tổng học phí|học phí toàn khóa|trọn khóa|toàn khóa)\s*(\d+(?:[.,]\d+)?)\s*năm/i.exec(stripped) ?? /thời gian đào tạo\s*(\d+(?:[.,]\d+)?)\s*năm/i.exec(line);
  if (label) {
    const value = toNumber(label[1], false);
    if (Number.isFinite(value) && value > 0 && value <= 8) return value;
  }
  const months = /\((\d+)\s*tháng\)/i.exec(line);
  if (months) {
    const m = Number(months[1]);
    if (m >= 12 && m <= 72) return m / 12;
  }
  return null;
}

function readCredits(line: string): number | null {
  const match = /khung\s*(?:CTĐT|chương trình)[^\d]{0,8}(\d{2,3})\s*(?:TC|tín chỉ)/i.exec(line) ?? /\((?:[≈~]\s*)?(\d{2,3})(?:\s*[–-]\s*\d{2,3})?\s*(?:TC|tín chỉ)\)/i.exec(line);
  const value = match ? Number(match[1]) : NaN;
  return Number.isFinite(value) && value >= 30 && value <= 400 ? value : null;
}

function readSemestersPerYear(line: string): number | null {
  const match = /(\d+)\s*(?:học\s*)?kỳ\s*\/\s*năm/i.exec(line);
  const value = match ? Number(match[1]) : NaN;
  return value >= 1 && value <= 4 ? value : null;
}

function candidateOf(rawLine: string): Candidate | null {
  const line = rawLine.replace(/[≈~]/g, ' ').replace(/\s+/g, ' ').trim();
  const stripped = stripParens(line);
  if (!RELEVANT.test(line) || EXCLUDED.test(stripped)) return null;
  const money = readMoney(stripped);
  if (!money || money.range[1] <= 0) return null;

  const suffix = SUFFIX.exec(stripped.slice(money.end));
  const kind = suffix ? kindOfSuffix(suffix[1]) : kindOfLabel(stripped.slice(0, money.start));
  if (!kind) return null;

  let range = money.range;
  if (kind === 'credit') {
    // Nhiều khối ngành trên một dòng: lấy khoảng thấp nhất–cao nhất
    const all = [...stripped.matchAll(MONEY_ONE_G)]
      .map((m) => {
        const million = isMillion(m[2]) ? 1_000_000 : 1;
        return toNumber(m[1], million === 1) * million;
      })
      .filter((v) => Number.isFinite(v) && v >= 100_000 && v <= 10_000_000);
    if (all.length > 0) range = [Math.round(Math.min(...all, range[0])), Math.round(Math.max(...all, range[1]))];
  }

  let yearHint: Range | null = null;
  if (kind === 'month') {
    for (const inner of parensOf(line)) {
      const hint = readMoney(inner);
      if (hint && SUFFIX.exec(inner.slice(hint.end))?.[1]?.toLowerCase() === 'năm') yearHint = hint.range;
    }
  }
  return { kind, range, years: readYears(line, stripped), semestersPerYear: readSemestersPerYear(line), credits: readCredits(line), yearHint, line };
}

const inYearBounds = (r: Range) => r[0] >= YEAR_MIN && r[1] <= YEAR_MAX && r[0] <= r[1];
const round = (r: Range): Range => [Math.round(r[0]), Math.round(r[1])];
const scale = (r: Range, k: number): Range => [r[0] * k, r[1] * k];

export function parseTuition(text: string | null, studyYears: number | null): TuitionParse {
  const result: TuitionParse = {
    status: 'unpublished', basis: null, isEstimate: false, semestersPerYear: null,
    perSemester: null, perYear: null, total: null, perCredit: null, credits: null, perMonth: null, warnings: [],
  };
  if (!text || !text.trim()) return result;

  const candidates = text.split(/\r?\n/).map(candidateOf).filter((c): c is Candidate => c !== null);
  const firstOf = (kind: Kind) => candidates.filter((c) => c.kind === kind);
  const spy = candidates.find((c) => c.semestersPerYear !== null)?.semestersPerYear ?? null;
  const perYearOf = (kind: Kind, c: Candidate): Range | null => {
    switch (kind) {
      case 'semester': return scale(c.range, c.semestersPerYear ?? spy ?? DEFAULT_SEMESTERS_PER_YEAR);
      case 'year': return c.range;
      case 'total': {
        const years = c.years ?? studyYears;
        return years && years > 0 ? scale(c.range, 1 / years) : null;
      }
      case 'credit': {
        const credits = c.credits ?? candidates.find((x) => x.credits !== null)?.credits ?? null;
        return credits && studyYears ? scale(c.range, credits / studyYears) : null;
      }
      default: return c.yearHint;
    }
  };

  // Mỗi nhóm lấy dòng đầu tiên cho ra số hợp lý; dòng bị loại vì ngoài khoảng được ghi lại
  const derived: { kind: Kind; candidate: Candidate; year: Range }[] = [];
  for (const kind of ['semester', 'year', 'total', 'credit', 'month'] as Kind[]) {
    for (const candidate of firstOf(kind)) {
      const year = perYearOf(kind, candidate);
      if (!year) continue;
      if (!inYearBounds(year)) {
        result.warnings.push(`out_of_range:${kind}:${candidate.line.slice(0, 120)}`);
        continue;
      }
      derived.push({ kind, candidate, year: round(year) });
      break;
    }
  }

  const chosen = derived[0];
  if (chosen) {
    for (const other of derived.slice(1)) {
      const a = (chosen.year[0] + chosen.year[1]) / 2;
      const b = (other.year[0] + other.year[1]) / 2;
      if (Math.abs(a - b) / Math.max(a, b) > CONFLICT_RATIO) result.warnings.push(`conflict:${chosen.kind}=${Math.round(a)} vs ${other.kind}=${Math.round(b)}`);
    }
    const kind: TuitionBasis = chosen.kind === 'month' ? 'year' : (chosen.kind as TuitionBasis);
    const semesters = chosen.candidate.semestersPerYear ?? spy ?? DEFAULT_SEMESTERS_PER_YEAR;
    result.status = 'amount';
    result.basis = kind;
    result.isEstimate = kind === 'total' || kind === 'credit';
    result.semestersPerYear = chosen.candidate.semestersPerYear ?? spy;
    result.perYear = chosen.year;
    result.perSemester = chosen.kind === 'semester' ? round(chosen.candidate.range) : round(scale(chosen.year, 1 / semesters));
  }

  const total = firstOf('total')[0];
  if (total && total.range[0] >= YEAR_MIN && total.range[1] <= YEAR_MAX * 8) result.total = total.range;
  const credit = firstOf('credit')[0];
  if (credit) {
    result.perCredit = credit.range;
    result.credits = credit.credits ?? candidates.find((c) => c.credits !== null)?.credits ?? null;
  }
  const month = firstOf('month')[0];
  if (month) result.perMonth = month.range;

  if (result.status === 'amount') return result;
  if (credit) { result.status = 'credit_only'; return result; }

  const feeLines = text.split(/\r?\n/).filter((line) => RELEVANT.test(line) && !EXCLUDED.test(line));
  const feeText = stripParens((feeLines.length > 0 ? feeLines : text.split(/\r?\n/).filter((line) => !EXCLUDED.test(line))).join('\n'));
  const positive = /(?<![\d.,])[1-9][\d.,]*\s*(?:tri|tr\b|đ|vn)/i.test(feeText);
  if (FREE.test(feeText) && !positive) {
    result.status = 'free';
    result.basis = 'semester';
    result.perSemester = [0, 0];
    result.perYear = [0, 0];
    return result;
  }
  result.status = !month && !positive && NOT_PUBLISHED.test(feeText) ? 'unpublished' : 'unclear';
  return result;
}
