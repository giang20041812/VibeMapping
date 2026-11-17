import React, { useEffect, useState } from 'react';
import { Button, Modal } from '../../../components/common';
import { FRAMEWORK_SECTION_LABEL } from '../../career_explorer/careerLevelFramework.constants';
import type { GapRow } from '../portfolio.types';
import { formatLevel } from '../skillGap.logic';
import { LevelPicker } from './LevelPicker';

interface Props {
  row: GapRow | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (row: GapRow, level: number) => Promise<void>;
}

/** Thêm nhanh một kỹ năng JD vào hồ sơ, hoặc sửa mức tự chấm của kỹ năng đã có */
export const SkillLevelDialog: React.FC<Props> = ({ row, busy, onClose, onSubmit }) => {
  const [level, setLevel] = useState<number | null>(null);

  useEffect(() => setLevel(row?.current_level !== null && row?.current_level !== undefined ? Math.round(row.current_level) : null), [row]);

  if (!row) return null;
  const editing = row.profile_item_id !== null;

  return (
    <Modal
      open
      title={editing ? 'Sửa mức tự chấm' : 'Thêm vào hồ sơ'}
      onClose={onClose}
      locked={busy}
      actions={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>Hủy</Button>
          <Button isLoading={busy} disabled={level === null} onClick={() => level !== null && void onSubmit(row, level)}>
            {editing ? 'Lưu' : 'Thêm vào hồ sơ'}
          </Button>
        </>
      }
    >
      <div className="pf-dialog">
        <dl className="pf-facts">
          <div><dt>Kỹ năng</dt><dd>{row.content}</dd></div>
          <div><dt>Loại</dt><dd>{FRAMEWORK_SECTION_LABEL[row.section]}</dd></div>
          <div><dt>Mức JD yêu cầu</dt><dd>{formatLevel(row.required_level)}</dd></div>
        </dl>
        {row.verified_360 && editing && <p className="pf-muted">Tự sửa mức sẽ gỡ nhãn Đã xác thực 360°.</p>}
        <LevelPicker heading="Mức của bạn" value={level} onChange={setLevel} label="Mức của bạn" />
      </div>
    </Modal>
  );
};
