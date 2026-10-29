import React, { useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, Badge, Button, Modal, ProgressBar } from '../../../components/common';
import type { Understanding } from '../class_assessment_grid.service';
import type { CellValue, GridQuestion, GridStudent } from '../class_assessment_grid.types';
import type { AnswerOption } from '../grid.logic';
import { UnderstandingFields } from './UnderstandingFields';
import './ClassGradeTable.css';

interface QuestionRowProps {
  item: GridQuestion;
  options: AnswerOption[];
  value: CellValue;
  disabled: boolean;
  onChange: (questionId: string, value: CellValue) => void;
}

/** Một câu hỏi; memo để chọn đáp án một câu không vẽ lại cả danh sách */
const QuestionRow = React.memo<QuestionRowProps>(function QuestionRow({ item, options, value, disabled, onChange }) {
  return (
    <div className={`grade-row ${value === '' ? 'is-empty' : ''}`}>
      <span className="grade-row-name">{item.content}</span>
      <div className="grade-row-options" role="group" aria-label={item.content}>
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? 'primary' : 'outline'}
            aria-pressed={value === option.value}
            disabled={disabled}
            onClick={() => onChange(item.question_id, value === option.value ? '' : option.value)}
          >
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

  const onChangeCellRef = useRef(onChangeCell);
  onChangeCellRef.current = onChangeCell;
  const handleCell = useCallback((questionId: string, value: CellValue) => onChangeCellRef.current(questionId, value), []);

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
            <Button type="button" variant="outline" leftIcon={<ChevronLeft size={16} />} onClick={onPrevious ?? undefined} disabled={!onPrevious}>
              Trước
            </Button>
            <Button type="button" variant="outline" rightIcon={<ChevronRight size={16} />} onClick={onNext ?? undefined} disabled={!onNext}>
              Sau
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
              onChange={handleCell}
            />
          ))}
        </section>
      ))}
    </Modal>
  );
};
