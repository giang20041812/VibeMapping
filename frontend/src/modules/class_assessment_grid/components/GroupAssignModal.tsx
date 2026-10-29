import React, { useEffect, useState } from 'react';
import { Button, Modal, Select } from '../../../components/common';
import type { CellValue, ShortCriteria } from '../class_assessment_grid.types';
import { CELL_OPTIONS } from '../grid.logic';
import './ClassGradeTable.css';

interface GroupAssignModalProps {
  open: boolean;
  /** Số học sinh đã chọn */
  count: number;
  criteria: ShortCriteria[];
  onApply: (values: Map<string, CellValue>) => void;
  onClose: () => void;
}

const KEEP = '';

/** Một bộ điểm cho nhiều học sinh: tiêu chí để trống thì giữ nguyên điểm hiện có */
export const GroupAssignModal: React.FC<GroupAssignModalProps> = ({ open, count, criteria, onApply, onClose }) => {
  const [values, setValues] = useState<Map<string, CellValue>>(new Map());

  useEffect(() => {
    if (open) setValues(new Map());
  }, [open]);

  const filled = [...values.values()].filter((value) => value !== KEEP).length;

  return (
    <Modal
      open={open}
      wide
      title={`Gán điểm cho ${count} học sinh`}
      onClose={onClose}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button type="button" disabled={filled === 0} onClick={() => onApply(values)}>
            Gán điểm
          </Button>
        </>
      }
    >
      <div className="grade-group">
        {criteria.map((item) => (
          <div key={item.id} className="grade-row">
            <span className="grade-row-name">
              <span className="grade-row-code">{item.dimension_code}</span>
              {item.name}
            </span>
            <Select
              aria-label={item.name}
              options={CELL_OPTIONS.filter((option) => option.value !== '')}
              emptyLabel="Giữ nguyên"
              value={values.get(item.id) ?? KEEP}
              onChange={(value) => setValues((current) => new Map(current).set(item.id, value as CellValue))}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
};
