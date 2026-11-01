import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, Badge, Button, Modal, ProgressBar } from '../../../components/common';
import type { Understanding } from '../class_assessment_grid.service';
import type { CellValue, GridQuestion, GridStudent } from '../class_assessment_grid.types';
import type { AnswerOption } from '../grid.logic';
import { UnderstandingFields } from './UnderstandingFields';
import './ClassGradeTable.css';

/** Phím của từng đáp án: 1–5, rồi X cho "Không đủ cơ sở" */
const optionKey = (value: CellValue) => (value === 'na' ? 'X' : value);
const INSUFFICIENT_KEYS = ['x', 'n', 'k'];

interface QuestionRowProps {
  item: GridQuestion;
  options: AnswerOption[];
  value: CellValue;
  disabled: boolean;
  /** Câu đang được chấm bằng bàn phím */
  active: boolean;
  onChange: (questionId: string, value: CellValue) => void;
  onActivate: (questionId: string) => void;
}

/** Một câu hỏi; memo để chọn đáp án một câu không vẽ lại cả danh sách */
const QuestionRow = React.memo<QuestionRowProps>(function QuestionRow({ item, options, value, disabled, active, onChange, onActivate }) {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active) rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [active]);

  return (
    <div
      ref={rowRef}
      className={`grade-row ${value === '' ? 'is-empty' : ''} ${active ? 'is-active' : ''}`}
      onClick={() => onActivate(item.question_id)}
    >
      <span className="grade-row-name">{item.content}</span>
      <div className="grade-row-options" role="group" aria-label={item.content}>
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? 'primary' : 'outline'}
            aria-pressed={value === option.value}
            aria-keyshortcuts={optionKey(option.value)}
            title={option.detail}
            disabled={disabled}
            onClick={() => onChange(item.question_id, value === option.value ? '' : option.value)}
          >
            <kbd className="grade-option-key" aria-hidden="true">
              {optionKey(option.value)}
            </kbd>
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
});

interface GradeStudentModalProps {
  student: GridStudent;
  /** Toàn bộ câu hỏi của gói */
  questions: GridQuestion[];
  /** Đáp án của từng câu hỏi theo mã câu hỏi */
  answers: Map<string, AnswerOption[]>;
  /** Đáp án hiện có của em này, theo mã câu hỏi */
  values: Map<string, CellValue>;
  /** Vị trí trong danh sách đang hiển thị */
  position: { index: number; total: number } | null;
  /** Học sinh đã làm bài tự đánh giá */
  hasResult: boolean;
  /** Bảng điểm đã nộp: không sửa được */
  readOnly: boolean;
  onChangeCell: (questionId: string, value: CellValue) => void;
  onChangeUnderstanding: (value: Understanding) => void;
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
}

export const GradeStudentModal: React.FC<GradeStudentModalProps> = ({
  student,
  questions,
  answers,
  values,
  position,
  hasResult,
  readOnly,
  onChangeCell,
  onChangeUnderstanding,
  onPrevious,
  onNext,
  onClose,
}) => {
  const filled = questions.filter((item) => values.get(item.question_id)).length;

  /* Câu đang chấm: mở một học sinh thì đứng ở câu chưa chấm đầu tiên */
  const [activeId, setActiveId] = useState<string | null>(null);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  useEffect(() => {
    const firstOpen = questions.find((item) => !valuesRef.current.get(item.question_id)) ?? questions[0];
    setActiveId(firstOpen?.question_id ?? null);
  }, [student.grid_student_id, questions]);

  const onChangeCellRef = useRef(onChangeCell);
  onChangeCellRef.current = onChangeCell;
  const handleCell = useCallback((questionId: string, value: CellValue) => {
    onChangeCellRef.current(questionId, value);
    setActiveId(questionId);
  }, []);

  // ---- Phím tắt: 1–5 chọn mức, X/N/K không đủ cơ sở (rồi sang câu kế), ↑/↓ đổi câu, PageUp/PageDown đổi học sinh
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const index = questions.findIndex((item) => item.question_id === activeId);
      const move = (step: number) => {
        const next = questions[Math.min(Math.max(index + step, 0), questions.length - 1)];
        if (next) setActiveId(next.question_id);
      };
      const answer = (value: CellValue) => {
        if (readOnly || index < 0) return;
        event.preventDefault();
        onChangeCellRef.current(questions[index].question_id, value);
        if (value !== '') move(1);
      };

      const key = event.key.toLowerCase();
      if (key.length === 1 && key >= '1' && key <= '5') answer(key as CellValue);
      else if (INSUFFICIENT_KEYS.includes(key)) answer('na');
      else if (event.key === 'Delete' || event.key === 'Backspace') answer('');
      else if (event.key === 'ArrowDown') {
        event.preventDefault();
        move(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        move(-1);
      } else if (event.key === 'PageDown' && onNext) {
        event.preventDefault();
        onNext();
      } else if (event.key === 'PageUp' && onPrevious) {
        event.preventDefault();
        onPrevious();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [questions, activeId, readOnly, onNext, onPrevious]);

  const groups = useMemo(() => {
    const result: { code: string; name: string; items: GridQuestion[] }[] = [];
    for (const item of questions) {
      const last = result[result.length - 1];
      if (last && last.code === item.group_code) last.items.push(item);
      else result.push({ code: item.group_code, name: item.group_name, items: [item] });
    }
    return result;
  }, [questions]);

  return (
    <Modal
      open
      wide
      title={`Chấm điểm – ${student.full_name || 'Học sinh'}${position ? ` (${position.index}/${position.total})` : ''}`}
      onClose={onClose}
      actions={
        <>
          <div className="grade-nav">
            <Button
              type="button"
              variant="outline"
              leftIcon={<ChevronLeft size={16} />}
              aria-keyshortcuts="PageUp"
              onClick={onPrevious ?? undefined}
              disabled={!onPrevious}
            >
              Học sinh trước
            </Button>
            <Button
              type="button"
              variant="outline"
              rightIcon={<ChevronRight size={16} />}
              aria-keyshortcuts="PageDown"
              onClick={onNext ?? undefined}
              disabled={!onNext}
            >
              Học sinh sau
            </Button>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Đóng
          </Button>
        </>
      }
    >
      {student.guardian_pending && (
        <Alert variant="warning">Học sinh dưới 16 tuổi chưa có xác nhận của người giám hộ nên chưa nộp được bảng điểm.</Alert>
      )}
      <div className="admin-badge-list">
        {hasResult && <Badge variant="info">Đã làm bài</Badge>}
      </div>

      <div>
        <ProgressBar value={questions.length === 0 ? null : (filled / questions.length) * 100} label="Tiến độ chấm" />
        <p className="grid-progress-text">
          {filled}/{questions.length} câu
        </p>
      </div>

      <UnderstandingFields
        value={{
          acquaintance_duration: student.acquaintance_duration,
          contact_frequency: student.contact_frequency,
          observation_depth: student.observation_depth,
        }}
        emptyLabel="Theo cả lớp"
        disabled={readOnly}
        onChange={onChangeUnderstanding}
      />

      {groups.map((group) => (
        <section key={group.code} className="grade-group">
          <h3 className="grade-group-title">{`${group.code} · ${group.name}`}</h3>
          {group.items.map((item) => (
            <QuestionRow
              key={item.question_id}
              item={item}
              options={answers.get(item.question_id) ?? []}
              value={values.get(item.question_id) ?? ''}
              disabled={readOnly}
              active={item.question_id === activeId}
              onChange={handleCell}
              onActivate={setActiveId}
            />
          ))}
        </section>
      ))}
    </Modal>
  );
};
