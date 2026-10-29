import React from 'react';
import { Send, Trash2 } from 'lucide-react';
import { Badge, Button } from '../../../components/common';
import type { ClassMember } from '../../class_management/class_management.types';
import type { CellValue, GridQuestion, GridStudent } from '../class_assessment_grid.types';
import type { AnswerOption } from '../grid.logic';
import './ClassGradeTable.css';

/** Chữ hiện trong ô: điểm 1–5, "Không đủ cơ sở" viết gọn */
export const CELL_TEXT: Record<string, string> = { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', na: 'KĐ' };

interface GradeRowProps {
  member: ClassMember;
  /** Vị trí dòng trong bảng, để kéo điền biết ô nào nằm giữa */
  rowIndex: number;
  /** Không có khi học sinh chưa có tài khoản trong lớp */
  student: GridStudent | undefined;
  scores: Map<string, CellValue> | undefined;
  questions: GridQuestion[];
  /** Đáp án của từng câu hỏi theo mã câu hỏi */
  answers: Map<string, AnswerOption[]>;
  /** Bảng đã khóa cả bảng hoặc em này đã nộp: không sửa được */
  readOnly: boolean;
  /** Cột của ô đang chọn trong dòng này; -1 là dòng không có ô nào được chọn */
  activeColumn: number;
  /** Tô đỏ các ô còn trống sau khi nộp em này bị chặn */
  highlightMissing: boolean;
  /** Đang nộp điểm em này */
  submitting: boolean;
  onSubmit: (gridStudentId: string) => void;
  onOpen: (gridStudentId: string) => void;
  onRemove: (member: ClassMember) => void;
}

/** Một dòng học sinh; memo để chọn điểm một em không vẽ lại cả bảng */
export const GradeRow = React.memo<GradeRowProps>(function GradeRow({
  member,
  rowIndex,
  student,
  scores,
  questions,
  answers,
  readOnly,
  activeColumn,
  highlightMissing,
  submitting,
  onSubmit,
  onOpen,
  onRemove,
}) {
  return (
    <tr>
      <th scope="row" className="grid-sticky">
        <div className="grid-student">
          {student ? (
            <button type="button" className="grid-student-link" onClick={() => onOpen(student.grid_student_id)}>
              {member.full_name || '—'}
            </button>
          ) : (
            <span className="grid-student-name">{member.full_name || '—'}</span>
          )}
          {member.student_code && <span className="grid-student-code">{member.student_code}</span>}
        </div>
        <div className="admin-badge-list">
          {student?.submitted_at && <Badge variant="success" size="sm">Đã nộp</Badge>}
          {member.has_result && <Badge variant="info" size="sm">Đã làm bài</Badge>}
          {student?.guardian_pending && <Badge variant="warning" size="sm">Chờ người giám hộ</Badge>}
          {!student && <Badge size="sm">Chưa tham gia</Badge>}
        </div>
      </th>
      {student ? (
        questions.map((item, columnIndex) => {
          const value = scores?.get(item.question_id) ?? '';
          const label = answers.get(item.question_id)?.find((option) => option.value === value)?.label;
          const state = value === '' ? (highlightMissing ? 'is-missing' : 'is-empty') : `is-${value}`;
          return (
            <td
              key={item.question_id}
              className={`grid-cell ${state}${readOnly ? ' is-locked' : ''}${columnIndex === activeColumn ? ' is-active' : ''}`}
              data-ri={rowIndex}
              data-ci={columnIndex}
              title={label}
            >
              <span key={value} className="grid-cell-value">{value === '' ? '' : CELL_TEXT[value]}</span>
              {columnIndex === activeColumn && !readOnly && <span className="grid-fill-handle" data-handle="" />}
            </td>
          );
        })
      ) : (
        <td colSpan={questions.length + 1} className="grid-empty">—</td>
      )}
      {student && (
        <td className="grid-extra">
          <Button type="button" size="sm" variant="ghost" onClick={() => onOpen(student.grid_student_id)}>
            {student.acquaintance_duration || student.contact_frequency || student.observation_depth ? 'Riêng' : 'Theo lớp'}
          </Button>
        </td>
      )}
      <td className="grid-actions">
        <div className="class-row-actions">
          {student && !readOnly && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              leftIcon={<Send size={14} />}
              isLoading={submitting}
              disabled={student.guardian_pending}
              onClick={() => onSubmit(student.grid_student_id)}
            >
              Nộp
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" leftIcon={<Trash2 size={14} />} onClick={() => onRemove(member)}>
            Xóa
          </Button>
        </div>
      </td>
    </tr>
  );
});
