import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail } from 'lucide-react';
import { Alert, Button, Input, PasswordInput } from '../../../components/common';
import { describeAuthError, getEnabledProviders, loginWithEmail, loginWithGoogle } from '../auth.service';
import { validateEmail } from '../auth.validation';
import '../auth-form.css';

interface LocationState {
  from?: string;
}

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as LocationState | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    getEnabledProviders().then((providers) => {
      if (active) setGoogleEnabled(providers.google);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = {
      email: validateEmail(email),
      password: password ? undefined : 'Nhập mật khẩu',
    };
    setErrors(nextErrors);
    setFormError(null);
    if (nextErrors.email || nextErrors.password) return;

    setIsSubmitting(true);
    try {
      await loginWithEmail({ email: email.trim(), password });
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(describeAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setFormError(null);
    try {
      await loginWithGoogle();
    } catch (error) {
      setFormError(describeAuthError(error));
    }
  };

  return (
    <section className="auth-form-card">
      <h1 className="auth-form-title">Đăng nhập</h1>

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
          error={errors.email}
          required
        />
        <PasswordInput
          label="Mật khẩu"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />
        <div className="auth-form-row">
          <span />
          <Link to="/quen-mat-khau" className="auth-link">
            Quên mật khẩu
          </Link>
        </div>
        <Button type="submit" size="lg" block isLoading={isSubmitting} rightIcon={<ArrowRight size={18} />}>
          Đăng nhập
        </Button>
      </form>

      {googleEnabled && (
        <>
          <div className="auth-divider">hoặc</div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            block
            onClick={handleGoogle}
            leftIcon={<span className="auth-google-mark">G</span>}
          >
            Tiếp tục với Google
          </Button>
        </>
      )}

      <p className="auth-switch">
        Chưa có tài khoản?
        <Link to="/dang-ky" className="auth-link">
          Đăng ký
        </Link>
      </p>
    </section>
  );
};
