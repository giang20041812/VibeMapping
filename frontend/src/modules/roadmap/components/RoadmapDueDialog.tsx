import React, { useState } from 'react';
import { Alert, Button, Input, Modal } from '../../../components/common';
import { formatDate } from '../roadmap.logic';
import type { Milestone } from '../roadmap.types';

interface DueConflict {
  id: string;
  title: string;
  due_date: string;
}

interface Props {
  milestone: Milestone | null;
  busy: boolean;
  onClose: () => void;
  onPreviewDue: (id: string, due: string) => Promise<{ conflicts: DueConflict[] }>;
  onApplyDue: (id: string, due: string) => Promise<void>;
}

/** Đổi hạn một hoạt động; báo các cột mốc bị ảnh hưởng trước khi áp dụng */
export const RoadmapDueDialog: React.FC<Props> = ({ milestone, busy, onClose, onPreviewDue, onApplyDue }) => {
  const [value, setValue] = useState(milestone?.due_date ?? '');
  const [conflicts, setConflicts] = useState<DueConflict[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(false);

  if (!milestone) return null;

  const apply = async () => {
    await onApplyDue(milestone.id, value);
    onClose();
  };

  const submit = async () => {
    setFailed(false);
    if (conflicts) {
      await apply();
      return;
    }
    setChecking(true);
    try {
      const result = await onPreviewDue(milestone.id, value);
      if (result.conflicts.length > 0) setConflicts(result.conflicts);
      else await apply();
    } catch {
      setFailed(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <Modal
      open
      title="Đổi hạn"
      onClose={onClose}
      locked={busy || checking}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button isLoading={busy || checking} disabled={!value || value === milestone.due_date} onClick={() => void submit()}>
            {conflicts ? 'Giữ thay đổi' : 'Lưu hạn'}
          </Button>
        </>
      }
    >
      <div className="roadmap-fields is-single">
        <p><strong>{milestone.title}</strong></p>
        <Input
          label="Hạn mới"
          type="date"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setConflicts(null);
          }}
        />
        {failed && <Alert variant="danger">Không đổi được hạn. Thử lại sau.</Alert>}
        {conflicts && (
          <Alert variant="warning" title="Hạn mới ảnh hưởng cột mốc khác.">
            Cột mốc bị ảnh hưởng: {conflicts.map((c) => `${c.title} (${formatDate(c.due_date)})`).join(', ')}
          </Alert>
        )}
      </div>
    </Modal>
  );
};
