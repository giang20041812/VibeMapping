import React, { useState } from 'react';
import { Alert, Button, Modal, PasswordInput } from '../../../components/common';
import { describeAuthError } from '../../auth/auth.service';
import { validatePassword } from '../../auth/auth.validation';
import { PasswordRules } from '../../auth/components/PasswordRules';
import { updatePassword } from '../account.service';
import './ChangePasswordModal.css';

const FORM_ID = 'change-password-form';

export const ChangePasswordModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const close = () => {
    if (isSaving) return;
    setPassword('');
    setConfirm('');
    setErrors({});
    setFormError(null);
    setDone(false);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next = {
      password: validatePassword(password),
      confirm: confirm !== password ? 'Mật khẩu nhập lại không khớp' : undefined,
    };
    setErrors(next);
    if (next.password || next.confirm) return;

    setIsSaving(true);
    setFormError(null);
    try {
      await updatePassword(password);
      setDone(true);
      setPassword('');
      setConfirm('');
    } catch (error) {
      setFormError(describeAuthError(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Đổi mật khẩu"
      onClose={close}
      locked={isSaving}
      actions={
        done ? (
          <Button onClick={close}>Đóng</Button>
        ) : (
          <>
            <Button variant="outline" onClick={close} disabled={isSaving}>
              Hủy
            </Button>
            <Button type="submit" form={FORM_ID} isLoading={isSaving}>
              Lưu mật khẩu
            </Button>
          </>
        )
      }
    >
      {done ? (
        <Alert variant="success">Đã đổi mật khẩu.</Alert>
      ) : (
        <form id={FORM_ID} className="change-password-form" onSubmit={handleSubmit} noValidate>
          {formError && <Alert variant="danger">{formError}</Alert>}
          <PasswordInput
            label="Mật khẩu mới"
            name="new_password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            required
          />
          <PasswordRules value={password} />
          <PasswordInput
            label="Nhập lại mật khẩu mới"
            name="confirm_password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm}
            required
          />
        </form>
      )}
    </Modal>
  );
};
