import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../../components/common';
import { describeAuthError, requestPhoneOtp, verifyPhoneOtp } from '../auth.service';
import { AuthHomeLink } from '../components/AuthHomeLink';
import { EMPTY_OTP, OtpDigits } from '../components/OtpDigits';
import { validatePhone } from '../auth.validation';
import '../auth-form.css';

const OTP_SECONDS = 90;

interface LocationState {
  phone?: string;
}

export const OtpVerifyPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const phone = (location.state as LocationState | null)?.phone ?? '';
  const [digits, setDigits] = useState(EMPTY_OTP);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remain, setRemain] = useState(OTP_SECONDS);

  useEffect(() => {
    sessionStorage.removeItem('pending-otp-phone');
  }, []);

  useEffect(() => {
    if (validatePhone(phone)) return;
    const key = `otp-sent:${phone}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    requestPhoneOtp(phone).catch((error) => setFormError(describeAuthError(error)));
  }, [phone]);

  useEffect(() => {
    if (remain <= 0) return;
    const timer = window.setTimeout(() => setRemain((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remain]);

  if (validatePhone(phone)) return <Navigate to="/dang-ky" replace />;

  const code = digits.join('');

  const resend = async () => {
    setFormError(null);
    setIsSubmitting(true);
    try {
      await requestPhoneOtp(phone);
      setDigits(EMPTY_OTP);
      setRemain(OTP_SECONDS);
    } catch (error) {
      setFormError(describeAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length < 6) {
      setFormError('Nhập đủ 6 số');
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      await verifyPhoneOtp(phone, code);
      sessionStorage.removeItem(`otp-sent:${phone}`);
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(describeAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-form-card">
      <AuthHomeLink />
      <h1 className="auth-form-title">Nhập mã OTP</h1>
      <p className="auth-switch">Mã 6 số được gửi tới {phone}</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <OtpDigits
          value={digits}
          onChange={(next) => {
            setDigits(next);
            if (formError) setFormError(null);
          }}
          disabled={isSubmitting}
          error={formError}
        />
        <Button type="submit" size="lg" block isLoading={isSubmitting} disabled={code.length < 6} rightIcon={<ArrowRight size={18} />}>
          Xác nhận
        </Button>
      </form>
      <p className="auth-switch">
        {remain > 0 ? (
          <span>Gửi lại sau {remain} giây</span>
        ) : (
          <button type="button" className="auth-home" onClick={() => void resend()} disabled={isSubmitting}>
            Gửi lại mã
          </button>
        )}
      </p>
    </section>
  );
};
