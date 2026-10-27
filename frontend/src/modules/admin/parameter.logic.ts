/** Một giá trị số (lá) của tham số, ví dụ `understanding_conversion.contact_frequency.rarely` */
export interface ParameterLeaf {
  path: string[];
  value: number | null;
}

export type ParameterShape = 'scalar' | 'nested';

export function parameterShape(value: unknown): ParameterShape {
  return typeof value === 'object' && value !== null ? 'nested' : 'scalar';
}

export function flattenParameter(value: unknown, path: string[] = []): ParameterLeaf[] {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => flattenParameter(child, [...path, key]));
  }
  return [{ path, value: typeof value === 'number' ? value : null }];
}

export function buildParameter(template: unknown, leaves: ParameterLeaf[]): unknown {
  if (parameterShape(template) === 'scalar') return leaves[0]?.value ?? null;
  const result: Record<string, unknown> = {};
  for (const leaf of leaves) {
    let cursor = result;
    leaf.path.forEach((key, index) => {
      if (index === leaf.path.length - 1) {
        cursor[key] = leaf.value;
      } else {
        cursor[key] = (cursor[key] as Record<string, unknown> | undefined) ?? {};
        cursor = cursor[key] as Record<string, unknown>;
      }
    });
  }
  return result;
}

export function formatParameterValue(value: unknown): string {
  if (value === null || value === undefined) return 'Chưa đặt';
  if (typeof value === 'object') {
    return flattenParameter(value)
      .map((leaf) => `${leaf.path.join('.')}: ${leaf.value ?? '—'}`)
      .join('; ');
  }
  return String(value);
}

const isNumber = (value: number | null): value is number => value !== null && Number.isFinite(value);

/**
 * Kiểm tra tham số trước khi lưu. Trả về thông báo lỗi, hoặc null nếu hợp lệ.
 * Khớp với trigger `validate_operation_parameter` ở database.
 */
export function validateParameter(paramCode: string, leaves: ParameterLeaf[]): string | null {
  const first = leaves[0]?.value ?? null;

  switch (paramCode) {
    case 'self_weight':
      if (!isNumber(first) || first < 0 || first > 1) return 'Trọng số bản thân phải nằm trong khoảng 0–1.';
      return null;
    case 'insufficient_basis_warning_ratio':
      if (!isNumber(first) || first < 0 || first > 1) return 'Ngưỡng phải nằm trong khoảng 0–1.';
      return null;
    case 'link_expiry_days':
    case 'draft_retention_hours':
    case 'uniform_score_min_criteria':
      if (!isNumber(first) || first < 1 || !Number.isInteger(first)) return 'Giá trị phải là số nguyên từ 1 trở lên.';
      return null;
    case 'retake_min_interval_hours':
      if (!isNumber(first) || first < 0) return 'Giá trị không được âm.';
      return null;
    case 'min_completion_seconds':
      if (first !== null && (!isNumber(first) || first < 0)) return 'Giá trị không được âm.';
      return null;
    case 'competency_levels': {
      const byKey = Object.fromEntries(leaves.map((leaf) => [leaf.path[0], leaf.value]));
      const { very_high: veryHigh, high, medium } = byKey;
      const all = [veryHigh, high, medium];
      if (!all.every((value) => isNumber(value ?? null) && (value as number) >= 0 && (value as number) <= 100)) {
        return 'Mỗi ngưỡng phải nằm trong khoảng 0–100.';
      }
      if (!((veryHigh as number) > (high as number) && (high as number) > (medium as number))) {
        return 'Ngưỡng phải giảm dần: rất cao > cao > trung bình.';
      }
      return null;
    }
    case 'understanding_conversion':
      if (leaves.some((leaf) => !isNumber(leaf.value) || leaf.value <= 0)) return 'Mọi mức quy đổi phải lớn hơn 0.';
      return null;
    default:
      if (leaves.some((leaf) => leaf.value !== null && !isNumber(leaf.value))) return 'Giá trị phải là số.';
      return null;
  }
}
