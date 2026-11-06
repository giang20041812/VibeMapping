import React, { useState } from 'react';
import { Button, Input, Modal, Select, Textarea } from '../../../components/common';
import { PILLAR_LABEL, PILLAR_ORDER } from '../roadmap.logic';
import type { RoadmapPillar } from '../roadmap.types';

const PILLAR_OPTIONS = PILLAR_ORDER.map((value) => ({ value, label: PILLAR_LABEL[value] }));
const KIND_OPTIONS = [
  { value: 'activity', label: 'Hoạt động' },
  { value: 'checkpoint', label: 'Cột mốc' },
];

export interface AddInitial {
  kind: 'activity' | 'checkpoint';
  pillar: RoadmapPillar;
  due: string;
}

export interface AddInput {
  title: string;
  due: string;
  pillar: RoadmapPillar;
  checkpoint: boolean;
  passCriteria: string;
}

interface Props {
  initial: AddInitial | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: AddInput) => Promise<void>;
}

/** Thêm hoạt động hoặc cột mốc riêng vào lộ trình */
export const RoadmapAddDialog: React.FC<Props> = ({ initial, busy, onClose, onSubmit }) => {
  const [form, setForm] = useState<AddInitial & { title: string; passCriteria: string }>({
    kind: initial?.kind ?? 'activity',
    pillar: initial?.pillar ?? 'knowledge',
    due: initial?.due ?? '',
    title: '',
    passCriteria: '',
  });

  if (!initial) return null;
  const checkpoint = form.kind === 'checkpoint';
  const ready = form.title.trim() !== '' && (!checkpoint || form.due !== '');

  return (
    <Modal
      open
      title={checkpoint ? 'Thêm cột mốc' : 'Thêm hoạt động'}
      onClose={onClose}
      locked={busy}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button
            isLoading={busy}
            disabled={!ready}
            onClick={() =>
              void onSubmit({ title: form.title, due: form.due, pillar: form.pillar, checkpoint, passCriteria: form.passCriteria }).then(onClose)
            }
          >
            Thêm
          </Button>
        </>
      }
    >
      <div className="roadmap-fields is-single">
        <Select label="Loại" options={KIND_OPTIONS} value={form.kind} onChange={(value) => setForm({ ...form, kind: value as AddInitial['kind'] })} />
        <Select label="Trụ cột" options={PILLAR_OPTIONS} value={form.pillar} onChange={(value) => setForm({ ...form, pillar: value as RoadmapPillar })} />
        <Input label={checkpoint ? 'Tên cột mốc' : 'Nội dung'} required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        <Input label="Hạn" type="date" required={checkpoint} value={form.due} onChange={(event) => setForm({ ...form, due: event.target.value })} />
        {checkpoint && (
          <Textarea label="Tiêu chí đạt" rows={3} value={form.passCriteria} onChange={(event) => setForm({ ...form, passCriteria: event.target.value })} />
        )}
      </div>
    </Modal>
  );
};
