import React from 'react';
import { Send, Trash2 } from 'lucide-react';
import { Badge, Button } from '../../../components/common';
import type { ClassMember } from '../../class_management/class_management.types';
import type { CellValue, GridStudent, ShortCriteria } from '../class_assessment_grid.types';
import { CELL_OPTIONS } from '../grid.logic';
import './ClassGradeTable.css';

interface GradeRowProps {
  member: ClassMember;
  /** Không có khi học sinh chưa có tài khoản trong lớp */
  student: GridStudent | undefined;
  scores: Map<string, CellValue> | undefined;
  criteria: ShortCriteria[];
  isDirty: boolean;
  isSubmitting: boolean;
  /** Đang gửi một học sinh nào đó: khóa nút Gửi của các dòng còn lại */
  isBusy: boolean;
  onOpen: (gridStudentId: string) => void;
  onChangeCell: (gridStudentId: string, criteriaId: string, value: CellValue) => void;
  onSubmit: (student: GridStudent) => void;
  onRemove: (member: ClassMember) => void;
}

/** Một dòng học sinh; memo để chọn điểm một em không vẽ lại cả bảng */
export const GradeRow = React.memo<GradeRowProps>(function GradeRow({
  member,
  student,
  scores,
  criteria,
  isDirty,
  isSubmitting,
  isBusy,
  onOpen,
  onChangeCell,
  onSubmit,
  onRemove,
}) {
  const isSubmitted = Boolean(student?.submitted_at);
  return (
    <tr>
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
          {student?.guardian_pending && <Badge variant="warning" size="sm">Chờ người giám hộ</Badge>}
          {isSubmitted && !isDirty && <Badge variant="success" size="sm">Đã gửi</Badge>}
          {isDirty && <Badge variant="warning" size="sm">Sửa chưa gửi lại</Badge>}
          {!student && <Badge size="sm">Chưa tham gia</Badge>}
        </div>
      </th>
      {student ? (
        criteria.map((item) => {
          const value = scores?.get(item.id) ?? '';
          return (
            <td key={item.id} className="align-center">
              <select
                className={`grid-cell-select ${value === '' ? 'is-empty' : ''}`}
                aria-label={`${student.full_name} – ${item.name}`}
                value={value}
                onChange={(event) => onChangeCell(student.grid_student_id, item.id, event.target.value as CellValue)}
              >
                {CELL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </td>
          );
        })
      ) : (
        <td colSpan={criteria.length + 1} className="align-center">—</td>
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
          {student && (
            <Button
              type="button"
              size="sm"
              leftIcon={<Send size={14} />}
              onClick={() => onSubmit(student)}
              isLoading={isSubmitting}
              disabled={isBusy || student.guardian_pending || (isSubmitted && !isDirty)}
            >
              {isSubmitted ? 'Gửi lại' : 'Gửi'}
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
