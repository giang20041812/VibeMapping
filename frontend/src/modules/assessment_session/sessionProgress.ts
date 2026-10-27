import { PARTS } from './assessmentSession.constants';
import { isAnswered } from './assessmentScores';
import type { AnswerMap, BankQuestion, PartNumber } from './assessmentSession.types';

export interface PartProgress {
  part: PartNumber;
  total: number;
  answered: number;
  done: boolean;
}

export interface SessionProgress {
  parts: PartProgress[];
  total: number;
  answered: number;
  /** Phần đang làm dở (phần đầu tiên chưa xong); null khi đã trả lời hết mọi câu */
  currentPart: PartNumber | null;
  /** Vị trí câu chưa trả lời đầu tiên trong phần đang làm (0 bắt đầu) */
  currentIndex: number;
}

export function questionsOfPart(questions: BankQuestion[], part: PartNumber): BankQuestion[] {
  return questions.filter((q) => q.part === part);
}

export function computeProgress(questions: BankQuestion[], answers: AnswerMap): SessionProgress {
  const parts: PartProgress[] = PARTS.map(({ number }) => {
    const list = questionsOfPart(questions, number);
    const answered = list.filter((q) => isAnswered(answers, q.id)).length;
    return { part: number, total: list.length, answered, done: answered === list.length };
  });

  const firstOpen = parts.find((p) => !p.done);
  let currentIndex = 0;
  if (firstOpen) {
    const list = questionsOfPart(questions, firstOpen.part);
    const index = list.findIndex((q) => !isAnswered(answers, q.id));
    currentIndex = index < 0 ? 0 : index;
  }

  return {
    parts,
    total: questions.length,
    answered: parts.reduce((sum, p) => sum + p.answered, 0),
    currentPart: firstOpen ? firstOpen.part : null,
    currentIndex,
  };
}
