import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import { Alert, Button, Input } from '../../../components/common';
import { describeAuthError, requestPasswordReset } from '../auth.service';
import { validateEmail } from '../auth.validation';
import '../auth-form.css';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const emailError = validateEmail(email);
    setError(emailError);
    setFormError(null);
    if (emailError) return;

    setIsSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSentTo(email.trim());
    } catch (err) {
      setFormError(describeAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sentTo) {
    return (
      <section className="auth-success">
        <span className="auth-success-badge">
          <MailCheck size={40} aria-hidden="true" />
        </span>
        <h1 className="auth-success-title">Kiểm tra email</h1>
        <p className="auth-success-email">{sentTo}</p>
        <Link to="/dang-nhap" className="auth-link">
          Về trang đăng nhập
        </Link>
      </section>
    );
  }

  return (
    <section className="auth-form-card">
      <h1 className="auth-form-title">Quên mật khẩu</h1>

      {formError && <Alert variant="danger">{formError}</Alert>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="ten@email.com"
          leftIcon={<Mail size={16} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
          required
        />
        <Button type="submit" size="lg" block isLoading={isSubmitting}>
          Gửi email khôi phục
        </Button>
      </form>

      <Link to="/dang-nhap" className="auth-link">
        <ArrowLeft size={16} aria-hidden="true" />
        &nbsp;Đăng nhập
      </Link>
    </section>
  );
};
