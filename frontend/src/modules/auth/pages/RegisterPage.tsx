import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Phone, User } from 'lucide-react';
import { Alert, Button, Input, PasswordInput, Select } from '../../../components/common';
import { isLearnerRole, parseVietnameseDate } from '../../profile/profile.logic';
import { describeAuthError, registerWithEmail } from '../auth.service';
import type { LearnerInfo, LearnerInfoErrors, RegisterableRole } from '../auth.types';
import { validateEmail, validateFullName, validateLearnerInfo, validatePassword, validatePhone } from '../auth.validation';
import { AuthHomeLink } from '../components/AuthHomeLink';
import { LearnerInfoFields } from '../components/LearnerInfoFields';
import { PasswordRules } from '../components/PasswordRules';
import '../auth-form.css';

interface FieldErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
}

const ROLE_OPTIONS: { value: RegisterableRole; label: string }[] = [
  { value: 'student', label: 'Học sinh' },
  { value: 'university_student', label: 'Sinh viên' },
  { value: 'parent', label: 'Phụ huynh' },
  { value: 'teacher', label: 'Giáo viên' },
  { value: 'mentor', label: 'Người hướng dẫn' },
];
const EMPTY_LEARNER_INFO: LearnerInfo = { date_of_birth: '', display_name: '', school_name: '', grade_or_major: '' };

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<RegisterableRole>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [learnerInfo, setLearnerInfo] = useState<LearnerInfo>(EMPTY_LEARNER_INFO);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [learnerErrors, setLearnerErrors] = useState<LearnerInfoErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLearnerInfoChange = (field: keyof LearnerInfo, value: string) => {
    setLearnerInfo((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {
      fullName: validateFullName(fullName),
      email: validateEmail(email),
      phone: validatePhone(phone),
      password: validatePassword(password),
    };
    const nextLearnerErrors: LearnerInfoErrors = isLearnerRole(role) ? validateLearnerInfo(learnerInfo) : {};
    setErrors(nextErrors);
    setLearnerErrors(nextLearnerErrors);
    setFormError(null);
    if (Object.values(nextErrors).some(Boolean) || Object.values(nextLearnerErrors).some(Boolean)) return;

    const dateOfBirth = isLearnerRole(role) ? parseVietnameseDate(learnerInfo.date_of_birth) : null;
    setIsSubmitting(true);
    sessionStorage.setItem('pending-otp-phone', phone.trim());
    try {
      const result = await registerWithEmail({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role,
        learnerInfo:
          dateOfBirth
            ? {
                date_of_birth: dateOfBirth,
                display_name: fullName.trim(),
                school_name: learnerInfo.school_name.trim(),
                grade_or_major: learnerInfo.grade_or_major,
              }
            : undefined,
      });
      if (result.user) sessionStorage.removeItem(`otp-sent:${phone.trim()}`);
      navigate('/xac-minh-otp', { replace: true, state: { phone: phone.trim() } });
    } catch (error) {
      sessionStorage.removeItem('pending-otp-phone');
      setFormError(describeAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-form-card is-wide">
      <AuthHomeLink />
      <h1 className="auth-form-title">Đăng ký</h1>

      {formError && <Alert variant="danger">{formError}</Alert>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-divider">Thông tin cá nhân</div>
        <div className="auth-grid">
          <Input
            label="Họ và tên"
            name="full_name"
            autoComplete="name"
            placeholder="Nguyễn Văn A"
            leftIcon={<User size={16} />}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.fullName}
            required
          />
          <Select label="Vai trò" name="role" options={ROLE_OPTIONS} value={role} onChange={(value) => setRole(value as RegisterableRole)} required />
          {isLearnerRole(role) && (
            <LearnerInfoFields role={role} values={learnerInfo} errors={learnerErrors} onChange={handleLearnerInfoChange} />
          )}
        </div>
        <div className="auth-divider">Tài khoản</div>
        <div className="auth-grid">
          <Input
            label="Số điện thoại"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            placeholder="0901234567"
            leftIcon={<Phone size={16} />}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
            required
          />
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
          <div className="auth-form auth-grid-full">
            <PasswordInput
              label="Mật khẩu"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              required
            />
            <PasswordRules value={password} />
          </div>
        </div>
        <Button type="submit" size="lg" block isLoading={isSubmitting} rightIcon={<ArrowRight size={18} />}>
          Tạo tài khoản
        </Button>
      </form>

      <p className="auth-switch">
        Đã có tài khoản?
        <Link to="/dang-nhap" className="auth-link">
          Đăng nhập
        </Link>
      </p>
    </section>
  );
};
