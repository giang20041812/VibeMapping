const CAREER_KEY = 'vm.careerCompare';
const PROGRAM_KEY = 'vm.programCompare';
const CAREER_MIN = 2;
const CAREER_MAX = 4;
const PROGRAM_MAX = 4;

export interface ProgramCompareItem {
  programId: string;
  title: string;
  careerId: string;
  admissionFloor: string;
  tuitionPerYear: string;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

export function readCareerCompare(): string[] {
  return readJson<string[]>(CAREER_KEY, []).filter((id) => typeof id === 'string');
}

export function toggleCareerCompare(id: string): { ids: string[]; message?: string } {
  const current = readCareerCompare();
  if (current.includes(id)) {
    const ids = current.filter((item) => item !== id);
    writeJson(CAREER_KEY, ids);
    return { ids };
  }
  if (current.length >= CAREER_MAX) {
    return { ids: current, message: `Chỉ được chọn từ ${CAREER_MIN} đến ${CAREER_MAX} nghề.` };
  }
  const ids = [...current, id];
  writeJson(CAREER_KEY, ids);
  return { ids };
}

export function careerCompareReady(ids = readCareerCompare()): boolean {
  return ids.length >= CAREER_MIN && ids.length <= CAREER_MAX;
}

export function readProgramCompare(): ProgramCompareItem[] {
  return readJson<ProgramCompareItem[]>(PROGRAM_KEY, []).filter((item) => item?.programId);
}

export function addProgramCompare(item: ProgramCompareItem): { items: ProgramCompareItem[]; message?: string } {
  const current = readProgramCompare();
  if (current.some((row) => row.programId === item.programId)) {
    return { items: current, message: 'Chương trình này đã nằm trong danh sách so sánh.' };
  }
  if (current.length >= PROGRAM_MAX) {
    return { items: current, message: 'Chỉ được chọn tối đa 4 phương án.' };
  }
  const items = [...current, item];
  writeJson(PROGRAM_KEY, items);
  return { items };
}

export function clearProgramCompare() {
  writeJson(PROGRAM_KEY, []);
}
