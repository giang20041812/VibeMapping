export type PackageSize = 35 | 50 | 75;
export type PartNumber = 1 | 2 | 3 | 4;

/** Một câu hỏi tự đánh giá lấy từ ngân hàng câu hỏi, kèm thông tin tiêu chí */
export interface BankQuestion {
  id: string;
  questionCode: string;
  content: string;
  answerOptions: string[];
  criteriaId: string;
  dimensionCode: string;
  criteriaName: string;
  criteriaSort: number;
  groupCode: string;
  groupName: string;
  groupSort: number;
  hollandCode: string | null;
  part: PartNumber;
  /** Lượt trong tiêu chí (0 là câu nền của gói cơ bản) để xen kẽ các tiêu chí khi làm bài */
  round: number;
}

export interface AssessmentSession {
  id: string;
  packageSize: PackageSize;
  currentPart: PartNumber;
  status: 'in_progress' | 'completed' | 'expired';
  startedAt: string;
  completedAt: string | null;
  draftExpiresAt: string | null;
}

export interface AnswerValue {
  score: number | null;
  insufficient: boolean;
}

export type AnswerMap = Map<string, AnswerValue>;

export interface CoreValue {
  id: string;
  code: string;
  name: string;
}

export interface EvidenceValues {
  gradePointAverage: string;
  certificates: string;
  achievements: string;
}
