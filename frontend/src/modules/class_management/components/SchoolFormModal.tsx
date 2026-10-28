import React, { useEffect, useState } from 'react';
import { Alert, Button, Input, Modal } from '../../../components/common';
import { createSchool } from '../class_management.service';
import '../ClassManagement.css';

export interface SchoolFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const SchoolFormModal: React.FC<SchoolFormModalProps> = ({ open, onClose, onSaved }) => {
  const [schoolName, setSchoolName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSchoolName('');
    setAddress('');
    setCity('');
    setNameError(undefined);
    setFormError(null);
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schoolName.trim()) {
      setNameError('Nhập tên trường.');
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      await createSchool({ school_name: schoolName.trim(), address: address.trim() || null, city: city.trim() || null });
      onSaved();
    } catch {
      setFormError('Không tạo được trường. Thử lại sau.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Thêm trường"
      onClose={onClose}
      locked={isSaving}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Hủy
          </Button>
          <Button type="submit" form="school-form" isLoading={isSaving}>
            Lưu
          </Button>
        </>
      }
    >
      <form id="school-form" className="class-form" onSubmit={handleSubmit} noValidate>
        {formError && <Alert variant="danger">{formError}</Alert>}
        <Input label="Tên trường" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} error={nameError} required />
        <div className="class-form-grid">
          <Input label="Địa chỉ" value={address} onChange={(event) => setAddress(event.target.value)} />
          <Input label="Tỉnh/Thành phố" value={city} onChange={(event) => setCity(event.target.value)} />
        </div>
      </form>
    </Modal>
  );
};
