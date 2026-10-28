import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, Badge, Button, Modal, ProgressBar } from '../../../components/common';
import type { Understanding } from '../class_assessment_grid.service';
import type { CellValue, GridStudent, ShortCriteria } from '../class_assessment_grid.types';
import { UnderstandingFields } from './UnderstandingFields';
import './ClassGradeTable.css';

const SCORES: CellValue[] = ['1', '2', '3', '4', '5'];

interface CriterionRowProps {
  item: ShortCriteria;
  value: CellValue;
  onChange: (criteriaId: string, value: CellValue) => void;
}

/** Một tiêu chí; memo để chọn điểm một tiêu chí không vẽ lại cả danh sách */
const CriterionRow = React.memo<CriterionRowProps>(function CriterionRow({ item, value, onChange }) {
  return (
    <div className={`grade-row ${value === '' ? 'is-empty' : ''}`}>
      <span className="grade-row-name">
        <span className="grade-row-code">{item.dimension_code}</span>
        {item.name}
      </span>
      <div className="grade-row-options" role="group" aria-label={item.name}>
        {SCORES.map((score) => (
          <Button
            key={score}
            type="button"
            size="sm"
            variant={value === score ? 'primary' : 'outline'}
            aria-pressed={value === score}
            onClick={() => onChange(item.id, value === score ? '' : score)}
          >
            {score}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={value === 'na' ? 'primary' : 'outline'}
          aria-pressed={value === 'na'}
          onClick={() => onChange(item.id, value === 'na' ? '' : 'na')}
        >
          Không đủ cơ sở
        </Button>
      </div>
    </div>
  );
});

interface GradeStudentModalProps {
  student: GridStudent;
  /** Toàn bộ tiêu chí của bộ rút gọn */
  criteria: ShortCriteria[];
  /** Điểm hiện có của em này, theo mã tiêu chí */
  values: Map<string, CellValue>;
  /** Vị trí trong danh sách đang hiển thị */
  position: { index: number; total: number } | null;
  isDirty: boolean;
  isSubmitting: boolean;
  onChangeCell: (criteriaId: string, value: CellValue) => void;
  onChangeUnderstanding: (value: Understanding) => void;
  /** Trả về thông báo lỗi nếu chưa gửi được, null nếu đã gửi */
  onSubmit: () => Promise<string | null>;
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
}

export const GradeStudentModal: React.FC<GradeStudentModalProps> = ({
  student,
  criteria,
  values,
  position,
  isDirty,
  isSubmitting,
  onChangeCell,
  onChangeUnderstanding,
  onSubmit,
  onPrevious,
  onNext,
  onClose,
}) => {
  // Lỗi gắn với học sinh đã gửi lỗi, chuyển sang em khác thì tự ẩn
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const isSubmitted = student.submitted_at !== null;
  const filled = criteria.filter((item) => values.get(item.id)).length;
  const visibleError = error && error.id === student.grid_student_id ? error.message : null;

  const onChangeCellRef = useRef(onChangeCell);
  onChangeCellRef.current = onChangeCell;
  const handleCell = useCallback((criteriaId: string, value: CellValue) => onChangeCellRef.current(criteriaId, value), []);

  const groups = useMemo(() => {
    const result: { code: string; name: string; items: ShortCriteria[] }[] = [];
    for (const item of criteria) {
      const last = result[result.length - 1];
      if (last && last.code === item.group_code) last.items.push(item);
      else result.push({ code: item.group_code, name: item.group_name, items: [item] });
    }
    return result;
  }, [criteria]);

  const handleSubmit = async () => {
    setError(null);
    const message = await onSubmit();
    if (message) setError({ id: student.grid_student_id, message });
    else if (onNext) onNext();
    else onClose();
  };

  return (
    <Modal
      open
      wide
      locked={isSubmitting}
      title={`Chấm điểm – ${student.full_name || 'Học sinh'}${position ? ` (${position.index}/${position.total})` : ''}`}
      onClose={onClose}
      actions={
        <>
          <div className="grade-nav">
            <Button type="button" variant="outline" leftIcon={<ChevronLeft size={16} />} onClick={onPrevious ?? undefined} disabled={!onPrevious || isSubmitting}>
              Trước
            </Button>
            <Button type="button" variant="outline" rightIcon={<ChevronRight size={16} />} onClick={onNext ?? undefined} disabled={!onNext || isSubmitting}>
              Sau
            </Button>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Đóng
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            isLoading={isSubmitting}
            disabled={isSubmitting || student.guardian_pending || (isSubmitted && !isDirty)}
          >
            {isSubmitted ? 'Gửi lại' : onNext ? 'Gửi và tiếp' : 'Gửi'}
          </Button>
        </>
      }
    >
      {visibleError && <Alert variant="danger">{visibleError}</Alert>}
      {student.guardian_pending && (
        <Alert variant="warning">Học sinh dưới 16 tuổi chưa có xác nhận của người giám hộ nên chưa gửi được điểm.</Alert>
      )}
      {isSubmitted && !isDirty && <Badge variant="success">Đã gửi</Badge>}
      {isDirty && <Badge variant="warning">Sửa chưa gửi lại</Badge>}

      <div>
        <ProgressBar value={criteria.length === 0 ? null : (filled / criteria.length) * 100} label="Tiến độ chấm" />
        <p className="grid-progress-text">
          {filled}/{criteria.length} tiêu chí
        </p>
      </div>

      <UnderstandingFields
        value={{
          acquaintance_duration: student.acquaintance_duration,
          contact_frequency: student.contact_frequency,
          observation_depth: student.observation_depth,
        }}
        emptyLabel="Theo cả lớp"
        onChange={onChangeUnderstanding}
      />

      {groups.map((group) => (
        <section key={group.code} className="grade-group">
          <h3 className="grade-group-title">{`${group.code} · ${group.name}`}</h3>
          {group.items.map((item) => (
            <CriterionRow key={item.id} item={item} value={values.get(item.id) ?? ''} onChange={handleCell} />
          ))}
        </section>
      ))}
    </Modal>
  );
};
