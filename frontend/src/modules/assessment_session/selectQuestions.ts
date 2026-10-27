import type { BankQuestion, PackageSize } from './assessmentSession.types';

/** Số câu thêm theo nhóm của gói Tiêu chuẩn so với gói Cơ bản: mỗi nhóm 2 câu, riêng G2 là 3 */
const EXTRA_STANDARD: Record<string, number> = { G1: 2, G2: 3, G3: 2, G4: 2, G5: 2, G6: 2, G7: 2 };
/** Số câu thêm theo nhóm của gói Chuyên sâu so với Tiêu chuẩn: mỗi nhóm 3 câu, riêng G2, G3, G5, G6 là 4 */
const EXTRA_DEEP: Record<string, number> = { G1: 3, G2: 4, G3: 4, G4: 3, G5: 4, G6: 4, G7: 3 };

function extraQuota(groupCode: string, size: PackageSize): number {
  if (size === 35) return 0;
  const standard = EXTRA_STANDARD[groupCode] ?? 2;
  if (size === 50) return standard;
  return standard + (EXTRA_DEEP[groupCode] ?? 3);
}

const compare = (a: BankQuestion, b: BankQuestion) =>
  a.part - b.part ||
  a.round - b.round ||
  a.groupSort - b.groupSort ||
  a.criteriaSort - b.criteriaSort ||
  a.questionCode.localeCompare(b.questionCode);

/**
 * Chọn câu hỏi cho một gói.
 * - Quản trị đã gán câu vào gói thì dùng đúng danh sách đó.
 * - Chưa gán thì chọn theo quy tắc của gói: mỗi tiêu chí 1 câu, câu thêm chia đều trong từng nhóm.
 * Kết quả ổn định (cùng đầu vào luôn cho cùng danh sách) để tiếp tục được bài đang làm dở.
 */
export function selectQuestions(bank: BankQuestion[], size: PackageSize, assignedIds?: Set<string>): BankQuestion[] {
  if (assignedIds && assignedIds.size > 0) {
    return bank
      .filter((q) => assignedIds.has(q.id))
      .map((q) => ({ ...q, round: 0 }))
      .sort(compare);
  }

  const byCriteria = new Map<string, BankQuestion[]>();
  for (const question of bank) {
    const list = byCriteria.get(question.criteriaId) ?? [];
    list.push(question);
    byCriteria.set(question.criteriaId, list);
  }
  for (const list of byCriteria.values()) list.sort((a, b) => a.questionCode.localeCompare(b.questionCode));

  const criteriaByGroup = new Map<string, BankQuestion[][]>();
  for (const list of byCriteria.values()) {
    const groupCode = list[0].groupCode;
    const groupLists = criteriaByGroup.get(groupCode) ?? [];
    groupLists.push(list);
    criteriaByGroup.set(groupCode, groupLists);
  }

  const selected: BankQuestion[] = [];
  for (const [groupCode, lists] of criteriaByGroup) {
    lists.sort((a, b) => a[0].criteriaSort - b[0].criteriaSort);

    // Câu nền: mỗi tiêu chí một câu
    for (const list of lists) selected.push({ ...list[0], round: 0 });

    // Câu thêm: lần lượt qua các tiêu chí của nhóm cho tới khi đủ số lượng
    let remaining = extraQuota(groupCode, size);
    let round = 1;
    while (remaining > 0) {
      let tookAny = false;
      for (const list of lists) {
        if (remaining <= 0) break;
        const next = list[round];
        if (next) {
          selected.push({ ...next, round });
          remaining -= 1;
          tookAny = true;
        }
      }
      if (!tookAny) break;
      round += 1;
    }
  }

  return selected.sort(compare);
}

export function groupByPart<T extends { part: number }>(items: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items) {
    const list = map.get(item.part) ?? [];
    list.push(item);
    map.set(item.part, list);
  }
  return map;
}
