import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Alert, Button, Modal, Skeleton } from '../../../components/common';
import { callRpc } from '../../../lib/rpc';
import type { Milestone, QuizQuestion, QuizResult } from '../roadmap.types';

const LETTERS = ['A', 'B', 'C'] as const;

interface Props {
  milestone: Milestone;
  onClose: () => void;
  onSubmitted: () => void;
}

/** Kiểm tra nhanh 5 câu của một hoạt động: tự chấm, đạt khi đúng từ 80%, làm lại tùy ý */
export const RoadmapQuizDialog: React.FC<Props> = ({ milestone, onClose, onSubmitted }) => {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    callRpc<QuizQuestion[]>('get_roadmap_quiz', { p_milestone_id: milestone.id })
      .then((rows) => alive && setQuestions(rows ?? []))
      .catch(() => alive && setError('Không tải được câu hỏi.'));
    return () => {
      alive = false;
    };
  }, [milestone.id]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const value = await callRpc<QuizResult>('submit_roadmap_quiz', {
        p_milestone_id: milestone.id,
        p_answers: Object.fromEntries(Object.entries(answers).map(([no, letter]) => [String(no), letter])),
      });
      setResult(value);
      onSubmitted();
    } catch {
      setError('Không nộp được bài. Thử lại sau.');
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    setAnswers({});
    setResult(null);
  };

  const ready = questions !== null && questions.length > 0 && questions.every((q) => answers[q.question_no]);
  const outcome = (no: number, letter: string) => {
    const row = result?.results.find((r) => r.question_no === no);
    if (!row) return '';
    if (row.correct_option === letter) return ' is-correct';
    return row.chosen === letter ? ' is-wrong' : '';
  };

  return (
    <Modal
      open
      title={`Kiểm tra nhanh: ${milestone.title}`}
      onClose={onClose}
      locked={busy}
      actions={
        result ? (
          <>
            <Button variant="outline" leftIcon={<RotateCcw size={16} />} onClick={retry}>Làm lại</Button>
            <Button onClick={onClose}>Đóng</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>Hủy</Button>
            <Button isLoading={busy} disabled={!ready} onClick={() => void submit()}>Nộp bài</Button>
          </>
        )
      }
    >
      {error && <Alert variant="danger">{error}</Alert>}
      {result && (
        <Alert variant={result.passed ? 'success' : 'warning'}>
          Đúng {result.correct}/{result.total} câu{result.passed ? ' · Đạt' : ' · Chưa đạt'}
        </Alert>
      )}
      {questions === null && !error ? (
        <Skeleton shape="block" />
      ) : (
        <ol className="roadmap-quiz">
          {(questions ?? []).map((q) => (
            <li key={q.question_no} className="roadmap-quiz-question">
              <p>{q.question_no}. {q.question_text}</p>
              <div className="roadmap-quiz-options" role="radiogroup" aria-label={`Câu ${q.question_no}`}>
                {LETTERS.map((letter) => {
                  const selected = answers[q.question_no] === letter;
                  return (
                    <button
                      key={letter}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={Boolean(result) || busy}
                      className={`roadmap-quiz-option${selected ? ' is-selected' : ''}${outcome(q.question_no, letter)}`}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.question_no]: letter }))}
                    >
                      <span className="roadmap-quiz-letter">{letter}.</span>
                      <span>{q.options[letter]}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
};
