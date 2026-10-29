import React, { useEffect, useState } from 'react';
import { Button, Modal, Select } from '../../../components/common';
import type { CellValue, GridQuestion } from '../class_assessment_grid.types';
import type { AnswerOption } from '../grid.logic';
import './ClassGradeTable.css';

interface GroupAssignModalProps {
  open: boolean;
  /** Số học sinh đã chọn */
  count: number;
  questions: GridQuestion[];
  /** Đáp án của từng câu hỏi theo mã câu hỏi */
  answers: Map<string, AnswerOption[]>;
  onApply: (values: Map<string, CellValue>) => void;
  onClose: () => void;
}

const KEEP = '';

/** Một bộ đáp án cho nhiều học sinh: câu để trống thì giữ nguyên đáp án hiện có */
export const GroupAssignModal: React.FC<GroupAssignModalProps> = ({ open, count, questions, answers, onApply, onClose }) => {
  const [values, setValues] = useState<Map<string, CellValue>>(new Map());

  useEffect(() => {
    if (open) setValues(new Map());
  }, [open]);

  const filled = [...values.values()].filter((value) => value !== KEEP).length;

  return (
    <Modal
      open={open}
      wide
      title={`Gán đáp án cho ${count} học sinh`}
      onClose={onClose}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button type="button" disabled={filled === 0} onClick={() => onApply(values)}>
            Gán đáp án
          </Button>
        </>
      }
    >
      <div className="grade-group">
        {questions.map((item) => (
          <div key={item.question_id} className="grade-row">
            <span className="grade-row-name">{item.content}</span>
            <Select
              className="grade-row-select"
              aria-label={item.content}
              options={answers.get(item.question_id) ?? []}
              emptyLabel="Giữ nguyên"
              value={values.get(item.question_id) ?? KEEP}
              onChange={(value) => setValues((current) => new Map(current).set(item.question_id, value as CellValue))}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
};
