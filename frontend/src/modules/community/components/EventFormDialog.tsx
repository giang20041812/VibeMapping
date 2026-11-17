import React, { useState } from 'react';
import { Button, Input, Modal, Textarea } from '../../../components/common';
import { EMPTY_EVENT_DRAFT } from '../community.constants';
import type { EventDraft } from '../community.types';

interface Props {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (draft: EventDraft) => Promise<boolean>;
}

/** Đăng sự kiện hướng nghiệp (FR09.01.10): quản trị hệ thống hoặc quản trị trường */
export const EventFormDialog: React.FC<Props> = ({ open, busy, onClose, onSubmit }) => {
  const [draft, setDraft] = useState<EventDraft>(EMPTY_EVENT_DRAFT);
  const patch = (next: Partial<EventDraft>) => setDraft((prev) => ({ ...prev, ...next }));
  const seat = draft.seatLimit.trim();
  const seatError = seat !== '' && (!/^\d+$/.test(seat) || Number(seat) < 1) ? 'Nhập số chỗ từ 1 trở lên.' : undefined;
  const deadlineError = draft.deadline && draft.startsAt && draft.deadline > draft.startsAt ? 'Hạn đăng ký phải trước giờ diễn ra.' : undefined;
  const ready = draft.title.trim().length >= 3 && draft.startsAt !== '' && !seatError && !deadlineError;

  const close = () => {
    setDraft(EMPTY_EVENT_DRAFT);
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Tạo sự kiện hướng nghiệp"
      onClose={close}
      locked={busy}
      wide
      actions={
        <>
          <Button variant="outline" onClick={close} disabled={busy}>Hủy</Button>
          <Button isLoading={busy} disabled={!ready} onClick={() => void onSubmit(draft).then((ok) => ok && close())}>Tạo sự kiện</Button>
        </>
      }
    >
      <div className="cm-dialog cm-event-form">
        <Input label="Tên sự kiện" required value={draft.title} maxLength={150} onChange={(event) => patch({ title: event.target.value })} />
        <Input label="Thời gian" type="datetime-local" required value={draft.startsAt} onChange={(event) => patch({ startsAt: event.target.value })} />
        <Input label="Địa điểm" value={draft.location} maxLength={200} onChange={(event) => patch({ location: event.target.value })} />
        <Input label="Đối tượng" value={draft.audience} maxLength={150} onChange={(event) => patch({ audience: event.target.value })} />
        <Input label="Số chỗ" value={draft.seatLimit} inputMode="numeric" error={seatError} onChange={(event) => patch({ seatLimit: event.target.value })} />
        <Input label="Hạn đăng ký" type="datetime-local" value={draft.deadline} error={deadlineError} onChange={(event) => patch({ deadline: event.target.value })} />
        <Textarea label="Nội dung chính" rows={4} value={draft.description} maxLength={2000} onChange={(event) => patch({ description: event.target.value })} className="cm-span-all" />
      </div>
    </Modal>
  );
};
