import React from 'react';
import { Trash2 } from 'lucide-react';
import { Badge, Button, Checkbox } from '../../../components/common';
import type { ClassMember } from '../../class_management/class_management.types';
import type { CellValue, GridQuestion, GridStudent } from '../class_assessment_grid.types';
import type { AnswerOption } from '../grid.logic';
import './ClassGradeTable.css';

interface GradeRowProps {
  member: ClassMember;
  /** Không có khi học sinh chưa có tài khoản trong lớp */
  student: GridStudent | undefined;
  scores: Map<string, CellValue> | undefined;
  questions: GridQuestion[];
  /** Đáp án của từng câu hỏi theo mã câu hỏi */
  answers: Map<string, AnswerOption[]>;
  /** Bảng điểm đã nộp: không sửa được */
  readOnly: boolean;
  /** Dòng đang được chọn để gán điểm cho nhóm */
  selected: boolean;
  /** Tô đỏ các ô còn trống sau khi nộp bị chặn */
  highlightMissing: boolean;
  onToggle: (gridStudentId: string) => void;
  onOpen: (gridStudentId: string) => void;
  onChangeCell: (gridStudentId: string, questionId: string, value: CellValue) => void;
  onRemove: (member: ClassMember) => void;
}

/** Một dòng học sinh; memo để chọn điểm một em không vẽ lại cả bảng */
export const GradeRow = React.memo<GradeRowProps>(function GradeRow({
  member,
  student,
  scores,
  questions,
  answers,
  readOnly,
  selected,
  highlightMissing,
  onToggle,
  onOpen,
  onChangeCell,
  onRemove,
}) {
  return (
    <tr>
      <td className="grid-select-col">
        {student && !readOnly && (
          <Checkbox
            aria-label={`Chọn ${member.full_name || 'học sinh'}`}
            checked={selected}
            onChange={() => onToggle(student.grid_student_id)}
          />
        )}
      </td>
      <th scope="row" className="grid-sticky">
        {student ? (
          <button type="button" className="grid-student-link" onClick={() => onOpen(student.grid_student_id)}>
            {member.full_name || '—'}
          </button>
        ) : (
          member.full_name || '—'
        )}
        {member.student_code && <span className="grid-student-code">{member.student_code}</span>}
        <div className="admin-badge-list">
          {member.has_result && <Badge variant="info" size="sm">Đã làm bài</Badge>}
          {student?.guardian_pending && <Badge variant="warning" size="sm">Chờ người giám hộ</Badge>}
          {!student && <Badge size="sm">Chưa tham gia</Badge>}
        </div>
      </th>
      {student ? (
        questions.map((item) => {
          const value = scores?.get(item.question_id) ?? '';
          return (
            <td key={item.question_id} className="align-center">
              <select
                className={`grid-cell-select ${value === '' ? (highlightMissing ? 'is-missing' : 'is-empty') : ''}`}
                data-student={student.grid_student_id}
                data-question={item.question_id}
                aria-label={`${student.full_name} – ${item.content}`}
                value={value}
                disabled={readOnly}
                onChange={(event) => onChangeCell(student.grid_student_id, item.question_id, event.target.value as CellValue)}
              >
                <option value="">—</option>
                {(answers.get(item.question_id) ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </td>
          );
        })
      ) : (
        <td colSpan={questions.length + 1} className="align-center">—</td>
      )}
      {student && (
        <td className="align-center">
          <Button type="button" size="sm" variant="ghost" onClick={() => onOpen(student.grid_student_id)}>
            {student.acquaintance_duration || student.contact_frequency || student.observation_depth ? 'Riêng' : 'Theo lớp'}
          </Button>
        </td>
      )}
      <td className="align-right">
        <div className="class-row-actions">
          <Button type="button" size="sm" variant="ghost" leftIcon={<Trash2 size={14} />} onClick={() => onRemove(member)}>
            Xóa
          </Button>
        </div>
      </td>
    </tr>
  );
});
