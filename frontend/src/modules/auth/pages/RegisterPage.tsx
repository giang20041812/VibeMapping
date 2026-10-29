import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, MailCheck, Mail, User } from 'lucide-react';
import { Alert, Button, Input, PasswordInput } from '../../../components/common';
import { isLearnerRole, parseVietnameseDate } from '../../profile/profile.logic';
import { describeAuthError, registerWithEmail } from '../auth.service';
import type { LearnerInfo, LearnerInfoErrors, RegisterableRole } from '../auth.types';
import { validateEmail, validateFullName, validateLearnerInfo, validatePassword } from '../auth.validation';
import { LearnerInfoFields } from '../components/LearnerInfoFields';
import { PasswordRules } from '../components/PasswordRules';
import { RoleSelect } from '../components/RoleSelect';
import '../auth-form.css';

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
}

const EMPTY_LEARNER_INFO: LearnerInfo = { date_of_birth: '', display_name: '', school_name: '', grade_or_major: '' };

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RegisterableRole>('student');
  const [learnerInfo, setLearnerInfo] = useState<LearnerInfo>(EMPTY_LEARNER_INFO);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [learnerErrors, setLearnerErrors] = useState<LearnerInfoErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const isLearner = isLearnerRole(role);

  const handleRoleChange = (nextRole: RegisterableRole) => {
    // Danh sách khối lớp của học sinh và sinh viên khác nhau nên lựa chọn cũ không còn hợp lệ
    if (nextRole !== role) setLearnerInfo((current) => ({ ...current, grade_or_major: '' }));
    setLearnerErrors({});
    setRole(nextRole);
  };

  const handleLearnerInfoChange = (field: keyof LearnerInfo, value: string) => {
    setLearnerInfo((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {
      fullName: validateFullName(fullName),
      email: validateEmail(email),
      password: validatePassword(password),
    };
    const nextLearnerErrors: LearnerInfoErrors = isLearner ? validateLearnerInfo(learnerInfo) : {};
    setErrors(nextErrors);
    setLearnerErrors(nextLearnerErrors);
    setFormError(null);
    if (Object.values(nextErrors).some(Boolean) || Object.values(nextLearnerErrors).some(Boolean)) return;

    const dateOfBirth = parseVietnameseDate(learnerInfo.date_of_birth);
    setIsSubmitting(true);
    try {
      const result = await registerWithEmail({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role,
        learnerInfo:
          isLearner && dateOfBirth
            ? {
                date_of_birth: dateOfBirth,
                display_name: learnerInfo.display_name.trim(),
                school_name: learnerInfo.school_name.trim(),
                grade_or_major: learnerInfo.grade_or_major,
              }
            : undefined,
      });
      if (result.session) {
        navigate('/', { replace: true });
      } else {
        setSentTo(email.trim());
      }
    } catch (error) {
      setFormError(describeAuthError(error));
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
    <section className="auth-form-card is-wide">
      <h1 className="auth-form-title">Đăng ký</h1>

      {formError && <Alert variant="danger">{formError}</Alert>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <RoleSelect value={role} onChange={handleRoleChange} />
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
        {isLearner && (
          <LearnerInfoFields role={role} values={learnerInfo} errors={learnerErrors} onChange={handleLearnerInfoChange} />
        )}
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
