/**
 * Logic và kiểm tra dữ liệu cho phân hệ So sánh và Ra quyết định (Decision Support)
 */

export function parseNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateAdmissionScore(scoreStr: string, required = false): string | undefined {
  const trimmed = scoreStr.trim().replace(',', '.');
  if (!trimmed) {
    return required ? 'Vui lòng nhập điểm xét tuyển' : undefined;
  }
  const n = Number(trimmed);
  if (Number.isNaN(n) || !Number.isFinite(n)) {
    return 'Điểm xét tuyển không hợp lệ';
  }
  if (n < 0) {
    return 'Điểm xét tuyển không được nhỏ hơn 0';
  }
  if (n > 40) {
    return 'Điểm xét tuyển tối đa là 40 điểm';
  }
  return undefined;
}

export function validateYearlyBudget(budgetStr: string, required = false): string | undefined {
  const trimmed = budgetStr.trim().replace(',', '.');
  if (!trimmed) {
    return required ? 'Vui lòng nhập ngân sách học phí' : undefined;
  }
  const n = Number(trimmed);
  if (Number.isNaN(n) || !Number.isFinite(n)) {
    return 'Ngân sách không hợp lệ';
  }
  if (n < 0) {
    return 'Ngân sách không được nhỏ hơn 0';
  }
  if (n > 2000) {
    return 'Ngân sách tối đa 2.000 triệu/năm';
  }
  return undefined;
}

