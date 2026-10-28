import React, { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Input, Modal } from '../../../components/common';
import type { CriteriaGroup } from '../admin.types';
import { updateCriteriaGroup } from '../criteria.service';

export interface CriteriaGroupFormModalProps {
  open: boolean;
  group: CriteriaGroup | null;
  onClose: () => void;
  onSaved: () => void;
}

export const CriteriaGroupFormModal: React.FC<CriteriaGroupFormModalProps> = ({ open, group, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [nameError, setNameError] = useState<string | undefined>();
  const [sortError, setSortError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !group) return;
    setName(group.name);
    setSortOrder(String(group.sort_order));
    setIsActive(group.is_active);
    setNameError(undefined);
    setSortError(undefined);
    setFormError(null);
  }, [open, group]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!group) return;
    const order = Number(sortOrder);
    const invalidName = !name.trim();
    const invalidOrder = sortOrder.trim() === '' || !Number.isInteger(order);
    setNameError(invalidName ? 'Nhập tên nhóm.' : undefined);
    setSortError(invalidOrder ? 'Thứ tự phải là số nguyên.' : undefined);
    if (invalidName || invalidOrder) return;

    setIsSaving(true);
    setFormError(null);
    try {
      await updateCriteriaGroup(group.id, { name: name.trim(), sort_order: order, is_active: isActive });
      onSaved();
    } catch {
      setFormError('Không lưu được nhóm tiêu chí. Thử lại sau.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={group ? `Sửa nhóm ${group.group_code}` : 'Sửa nhóm'}
      onClose={onClose}
      locked={isSaving}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Hủy
          </Button>
          <Button type="submit" form="criteria-group-form" isLoading={isSaving}>
            Lưu
          </Button>
        </>
      }
    >
      <form id="criteria-group-form" className="admin-form" onSubmit={handleSubmit} noValidate>
        {formError && <Alert variant="danger">{formError}</Alert>}
        <Input label="Tên nhóm" value={name} onChange={(event) => setName(event.target.value)} error={nameError} required />
        <Input
          label="Thứ tự"
          type="number"
          inputMode="numeric"
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          error={sortError}
        />
        <Checkbox label="Đang dùng" checked={isActive} onChange={setIsActive} />
      </form>
    </Modal>
  );
};
