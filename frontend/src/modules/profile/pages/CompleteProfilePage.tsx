import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, Mail, MailCheck, School, Tag, User } from 'lucide-react';
import { Alert, Button, Card, Input, PasswordInput, Select } from '../../../components/common';
import { PageSkeleton } from '../../../components/layout/PageSkeleton';
import { useAuth } from '../../auth/AuthContext';
import type { RegisterableRole } from '../../auth/auth.types';
import { validateEmail, validateFullName, validatePassword } from '../../auth/auth.validation';
import { PasswordRules } from '../../auth/components/PasswordRules';
import { RoleSelect } from '../../auth/components/RoleSelect';
import { describeGuestError, upgradeGuestAccount } from '../../auth/guestAccount.service';
import {
  GRADE_OPTIONS,
  formatVietnameseDate,
  isLearnerRole,
  isProfileComplete,
  parseVietnameseDate,
  validateDisplayName,
} from '../profile.logic';
import { setMyLearnerRole, updateMyProfile } from '../profile.service';
import './CompleteProfilePage.css';

type LearnerGroup = Extract<RegisterableRole, 'student' | 'university_student'>;

const LEARNER_GROUPS: LearnerGroup[] = ['student', 'university_student'];

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  dateOfBirth?: string;
  displayName?: string;
  schoolName?: string;
  grade?: string;
}

/**
 * Khai báo thông tin sau khi làm xong bài test.
 * Khách (tài khoản ẩn danh): điền thông tin rồi gắn email, mật khẩu để thành tài khoản thật, giữ nguyên kết quả vừa làm.
 * Người đã có tài khoản nhưng hồ sơ còn thiếu: chỉ bổ sung phần còn thiếu.
 */
export const CompleteProfilePage: React.FC = () => {
  const { session, profile, isGuest, isLoading, isProfileLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  /** Trang bị chặn vì hồ sơ còn thiếu; khai báo xong thì quay lại đó */
  const from = (location.state as { from?: string } | null)?.from;

  const [group, setGroup] = useState<LearnerGroup>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [grade, setGrade] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  /* Điền sẵn phần đã có trong hồ sơ, chỉ một lần để không ghi đè lúc đang nhập */
  const prefilled = useRef(false);
  useEffect(() => {
    if (!profile || prefilled.current) return;
    prefilled.current = true;
    setGroup(profile.role === 'university_student' ? 'university_student' : 'student');
    setFullName(profile.full_name ?? '');
    setDateOfBirth(formatVietnameseDate(profile.date_of_birth));
    setDisplayName(profile.display_name ?? '');
    setSchoolName(profile.school_name ?? '');
    setGrade(profile.grade_or_major ?? '');
  }, [profile]);

  if (isLoading || (session && isProfileLoading)) return <PageSkeleton />;
  if (!session) return <Navigate to="/lam-bai" replace />;

  if (sentTo) {
    return (
      <section className="complete-success">
        <span className="complete-success-badge">
          <MailCheck size={40} aria-hidden="true" />
        </span>
        <h1 className="complete-success-title">Kiểm tra email</h1>
        <p className="complete-success-email">{sentTo}</p>
        <Link to="/" className="complete-success-link">
          Về trang chủ
        </Link>
      </section>
    );
  }

  if (!isGuest) {
    if (!profile) return <Alert variant="danger">Không tải được hồ sơ</Alert>;
    if (!isLearnerRole(profile.role)) return <Navigate to="/ho-so" replace />;
    if (isProfileComplete(profile)) {
      return from ? <Navigate to={from} replace /> : <Navigate to="/danh-gia-ca-nhan" replace state={location.state} />;
    }
  }

  const activeGroup: LearnerGroup = isGuest ? group : profile?.role === 'university_student' ? 'university_student' : 'student';
  const isoDate = parseVietnameseDate(dateOfBirth);

  const handleGroupChange = (next: RegisterableRole) => {
    if (next !== 'student' && next !== 'university_student') return;
    // Danh sách khối lớp của học sinh và sinh viên khác nhau nên lựa chọn cũ không còn hợp lệ
    if (next !== group) setGrade('');
    setGroup(next);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: FieldErrors = {
      fullName: validateFullName(fullName),
      email: isGuest ? validateEmail(email) : undefined,
      password: isGuest ? validatePassword(password) : undefined,
      dateOfBirth: !dateOfBirth.trim() ? 'Nhập ngày sinh' : isoDate ? undefined : 'Ngày sinh không hợp lệ',
      displayName: validateDisplayName(displayName),
      schoolName: schoolName.trim() ? undefined : 'Nhập trường',
      grade: grade ? undefined : 'Chọn khối lớp hoặc ngành học',
    };
    setErrors(next);
    setFormError(null);
    if (Object.values(next).some(Boolean) || !isoDate) return;

    setIsSubmitting(true);
    try {
      // Lưu hồ sơ trước, gắn email sau: email trùng thì chỉ cần sửa email và gửi lại, phần đã lưu không phải nhập lại
      if (isGuest && group !== profile?.role) await setMyLearnerRole(group);
      await updateMyProfile(session.user.id, {
        full_name: fullName.trim(),
        date_of_birth: isoDate,
        display_name: displayName.trim(),
        school_name: schoolName.trim(),
        grade_or_major: grade,
      });
      if (isGuest) {
        const { needsEmailConfirmation } = await upgradeGuestAccount({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
        });
        if (needsEmailConfirmation) {
          setSentTo(email.trim());
          return;
        }
      }
      await refreshProfile();
      if (from) navigate(from, { replace: true });
      else navigate('/danh-gia-ca-nhan', { replace: true, state: { justCompleted: true } });
    } catch (error) {
      setFormError(isGuest ? describeGuestError(error) : 'Không lưu được hồ sơ, vui lòng thử lại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <h1 className="page-title">Thông tin cá nhân</h1>

      <Card className="complete-card">
        <form className="complete-form" onSubmit={handleSubmit} noValidate>
          {formError && <Alert variant="danger">{formError}</Alert>}

          {isGuest && <RoleSelect value={group} onChange={handleGroupChange} roles={LEARNER_GROUPS} legend="Nhóm" />}

          <div className="complete-grid">
            <Input
              label="Họ và tên"
              name="full_name"
              autoComplete="name"
              leftIcon={<User size={16} />}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={errors.fullName}
              required
            />
            {isGuest && (
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
            )}
            {isGuest && (
              <div className="complete-stack complete-grid-full">
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
            )}
            <Input
              label="Ngày sinh"
              name="date_of_birth"
              placeholder="dd/mm/yyyy"
              inputMode="numeric"
              autoComplete="bday"
              leftIcon={<Calendar size={16} />}
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              error={errors.dateOfBirth}
              required
            />
            <Input
              label="Tên hiển thị"
              name="display_name"
              maxLength={20}
              leftIcon={<Tag size={16} />}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              error={errors.displayName}
              required
            />
            <Input
              label="Trường"
              name="school_name"
              autoComplete="organization"
              leftIcon={<School size={16} />}
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              error={errors.schoolName}
              required
            />
            <Select
              label="Khối lớp / Ngành học"
              name="grade_or_major"
              emptyLabel="Chọn"
              options={GRADE_OPTIONS[activeGroup].map((option) => ({ value: option, label: option }))}
              value={grade}
              onChange={setGrade}
              error={errors.grade}
              required
            />
          </div>

          <div className="complete-actions">
            <Button type="submit" size="lg" isLoading={isSubmitting} rightIcon={<ArrowRight size={18} />}>
              {isGuest ? 'Tạo tài khoản và xem kết quả' : from ? 'Lưu và tiếp tục' : 'Lưu và xem kết quả'}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
};
