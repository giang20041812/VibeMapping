import React, { useEffect, useState } from 'react';
import { Alert, Button, Input, Modal, Select } from '../../../components/common';
import type { SelectOption } from '../../../components/common';
import '../ClassManagement.css';

export interface EmailRoleModalProps {
  open: boolean;
  title: string;
  roleLabel: string;
  roleOptions: SelectOption[];
  /** Trả về mã lỗi nghiệp vụ (đã dịch) hoặc null khi thành công */
  onSubmit: (email: string, role: string) => Promise<string | null>;
  onClose: () => void;
  onSaved: () => void;
}

/** Thêm người vào trường hoặc lớp theo email tài khoản và vai trò */
export const EmailRoleModal: React.FC<EmailRoleModalProps> = ({
  open,
  title,
  roleLabel,
  roleOptions,
  onSubmit,
  onClose,
  onSaved,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(roleOptions[0]?.value ?? '');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setRole(roleOptions[0]?.value ?? '');
    setEmailError(undefined);
    setFormError(null);
  }, [open, roleOptions]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setEmailError('Email không hợp lệ.');
      return;
    }
    setEmailError(undefined);
    setIsSaving(true);
    setFormError(null);
    try {
      const message = await onSubmit(email, role);
      if (message) setFormError(message);
      else onSaved();
    } catch {
      setFormError('Không lưu được. Thử lại sau.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      locked={isSaving}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Hủy
          </Button>
          <Button type="submit" form="email-role-form" isLoading={isSaving}>
            Thêm
          </Button>
        </>
      }
    >
      <form id="email-role-form" className="class-form" onSubmit={handleSubmit} noValidate>
        {formError && <Alert variant="danger">{formError}</Alert>}
        <Input
          label="Email tài khoản"
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
          required
        />
        <Select label={roleLabel} options={roleOptions} value={role} onChange={setRole} />
      </form>
    </Modal>
  );
};
