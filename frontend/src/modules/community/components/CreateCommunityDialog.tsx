import React, { useState } from 'react';
import { Button, Input, Modal, Textarea } from '../../../components/common';

interface Props {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string) => Promise<boolean>;
}

/** Tạo cộng đồng mới (FR09.01.16) */
export const CreateCommunityDialog: React.FC<Props> = ({ open, busy, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const ready = name.trim().length >= 3;

  const close = () => {
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Tạo nhóm thảo luận"
      onClose={close}
      locked={busy}
      actions={
        <>
          <Button variant="outline" onClick={close} disabled={busy}>Hủy</Button>
          <Button
            isLoading={busy}
            disabled={!ready}
            onClick={() => void onSubmit(name, description).then((ok) => ok && close())}
          >
            Tạo nhóm
          </Button>
        </>
      }
    >
      <div className="cm-dialog">
        <Input label="Tên nhóm" required value={name} maxLength={80} onChange={(event) => setName(event.target.value)}
          error={name.length > 0 && !ready ? 'Tên nhóm cần ít nhất 3 ký tự.' : undefined} />
        <Textarea label="Mô tả" rows={3} value={description} maxLength={300} onChange={(event) => setDescription(event.target.value)} />
      </div>
    </Modal>
  );
};
