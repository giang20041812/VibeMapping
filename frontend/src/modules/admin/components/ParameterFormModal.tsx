import React, { useEffect, useState } from 'react';
import { Alert, Button, Input, Modal } from '../../../components/common';
import type { OperationParameter } from '../admin.types';
import { buildParameter, flattenParameter, validateParameter } from '../parameter.logic';
import { saveParameter } from '../operation_parameters.service';

export interface ParameterFormModalProps {
  open: boolean;
  parameter: OperationParameter | null;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Ô nhập giữ nguyên chuỗi người dùng gõ; rỗng nghĩa là chưa đặt (null) */
function toNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

export const ParameterFormModal: React.FC<ParameterFormModalProps> = ({ open, parameter, userId, onClose, onSaved }) => {
  const [texts, setTexts] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !parameter) return;
    setTexts(flattenParameter(parameter.param_value).map((leaf) => (leaf.value === null ? '' : String(leaf.value))));
    setFormError(null);
  }, [open, parameter]);

  const leaves = parameter ? flattenParameter(parameter.param_value) : [];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!parameter) return;
    const next = leaves.map((leaf, index) => ({ path: leaf.path, value: toNumber(texts[index] ?? '') }));
    const message = validateParameter(parameter.param_code, next);
    if (message) {
      setFormError(message);
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      await saveParameter(parameter.param_code, parameter.param_name, buildParameter(parameter.param_value, next), userId);
      onSaved();
    } catch {
      setFormError('Không lưu được tham số. Thử lại sau.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={parameter ? parameter.param_name : 'Sửa tham số'}
      onClose={onClose}
      locked={isSaving}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Hủy
          </Button>
          <Button type="submit" form="parameter-form" isLoading={isSaving}>
            Lưu
          </Button>
        </>
      }
    >
      <form id="parameter-form" className="admin-form" onSubmit={handleSubmit} noValidate>
        {formError && <Alert variant="danger">{formError}</Alert>}
        {leaves.map((leaf, index) => (
          <Input
            key={leaf.path.join('.') || 'value'}
            label={leaf.path.length > 0 ? leaf.path.join(' › ') : 'Giá trị'}
            inputMode="decimal"
            value={texts[index] ?? ''}
            onChange={(event) => setTexts((current) => current.map((item, position) => (position === index ? event.target.value : item)))}
          />
        ))}
      </form>
    </Modal>
  );
};
