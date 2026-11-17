import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, School, Tag, User } from 'lucide-react';
import { Alert, Button, Card, DateInput, Input } from '../../../components/common';
import { useAuth } from '../../auth/AuthContext';
import type { RegisterableRole } from '../../auth/auth.types';
import { RoleSelect } from '../../auth/components/RoleSelect';
import { ProfileSkeleton } from '../components/ProfileSkeleton';
import {
  GRADE_OPTIONS,
  ageOf,
  formatVietnameseDate,
  isLearnerRole,
  isProfileComplete,
  parseVietnameseDate,
  validateDisplayName,
  GUARDIAN_AGE,
} from '../profile.logic';
import { setMyLearnerRole, updateMyProfile } from '../profile.service';
import { MfaCard } from '../components/MfaCard';
import { NotificationSettingsCard } from '../components/NotificationSettingsCard';
import './ProfilePage.css';

type LearnerGroup = Extract<RegisterableRole, 'student' | 'university_student'>;

const LEARNER_GROUPS: LearnerGroup[] = ['student', 'university_student'];

interface FieldErrors {
  fullName?: string;
  dateOfBirth?: string;
  displayName?: string;
  schoolName?: string;
  grade?: string;
}

export const ProfilePage: React.FC = () => {
  const { session, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const wasComplete = isProfileComplete(profile);
  const learner = isLearnerRole(profile?.role);

  const [group, setGroup] = useState<LearnerGroup>('student');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [grade, setGrade] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setGroup(profile.role === 'university_student' ? 'university_student' : 'student');
    setFullName(profile.full_name ?? '');
    setDateOfBirth(formatVietnameseDate(profile.date_of_birth));
    setDisplayName(profile.display_name ?? '');
    setSchoolName(profile.school_name ?? '');
    setGrade(profile.grade_or_major ?? '');
  }, [profile]);

  const isoDate = parseVietnameseDate(dateOfBirth);
  const age = ageOf(isoDate);
  const needsGuardian = learner && age !== null && age < GUARDIAN_AGE && !profile?.guardian_consent_confirmed;
  const gradeOptions = GRADE_OPTIONS[group];

  const handleGroupChange = (next: RegisterableRole) => {
    if (next !== 'student' && next !== 'university_student') return;
    // Danh sách khối lớp của học sinh và sinh viên khác nhau nên lựa chọn cũ không còn hợp lệ
    if (next !== group) setGrade('');
    setGroup(next);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session) return;
    const next: FieldErrors = {
      fullName: fullName.trim() ? undefined : 'Nhập họ và tên',
      dateOfBirth: !dateOfBirth.trim() ? 'Vui lòng nhập ngày sinh.' : isoDate ? undefined : 'Ngày sinh không hợp lệ',
      displayName: validateDisplayName(displayName),
      schoolName: schoolName.trim() ? undefined : 'Nhập trường',
      grade: grade ? undefined : 'Chọn khối lớp hoặc ngành học',
    };
    setErrors(next);
    setFormError(null);
    setSaved(false);
    if (Object.values(next).some(Boolean) || !isoDate) return;

    setIsSaving(true);
    try {
      // Đổi nhóm thì khối lớp cũ bị xóa, ghi lại ngay bên dưới
      if (learner && group !== profile?.role) await setMyLearnerRole(group);
      await updateMyProfile(session.user.id, {
        full_name: fullName.trim(),
        date_of_birth: isoDate,
        display_name: displayName.trim(),
        school_name: schoolName.trim(),
        grade_or_major: grade,
      });
      await refreshProfile();
      setSaved(true);
      if (!wasComplete) navigate('/', { replace: true });
    } catch {
      setFormError('Không lưu được hồ sơ, vui lòng thử lại');
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) return <ProfileSkeleton />;

  return (
    <>
      <h1 className="page-title">Hồ sơ cá nhân</h1>

      <Card className="profile-card">
        <form className="profile-form" onSubmit={handleSubmit} noValidate>
          {needsGuardian && (
            <Alert variant="warning">
              Bạn dưới 16 tuổi: cần người giám hộ xác nhận trước khi mời người khác đánh giá.
            </Alert>
          )}
          {saved && <Alert variant="success">Đã lưu hồ sơ.</Alert>}
          {formError && <Alert variant="danger">{formError}</Alert>}

          {learner && <RoleSelect value={group} onChange={handleGroupChange} roles={LEARNER_GROUPS} legend="Nhóm" />}

          <div className="profile-grid">
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
            <Input
              label="Email"
              type="email"
              value={session?.user.email ?? ''}
              leftIcon={<User size={16} />}
              readOnly
              disabled
            />
            {learner && (
              <>
                <DateInput
                  label="Ngày sinh"
                  name="date_of_birth"
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
                  leftIcon={<School size={16} />}
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  error={errors.schoolName}
                  required
                />
                <div className={`profile-select ${errors.grade ? 'has-error' : ''}`}>
                  <label htmlFor="grade_or_major" className="input-label">
                    Khối lớp / Ngành học<span className="input-required" aria-hidden="true"> *</span>
                  </label>
                  <div className="profile-select-wrapper">
                    <GraduationCap size={16} className="profile-select-icon" aria-hidden="true" />
                    <select
                      id="grade_or_major"
                      className="profile-select-field"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      aria-invalid={errors.grade ? true : undefined}
                    >
                      <option value="">Chọn</option>
                      {gradeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.grade && <span className="input-error-msg" role="alert">{errors.grade}</span>}
                </div>
              </>
            )}
          </div>

          <div className="profile-actions">
            <Button type="submit" size="lg" isLoading={isSaving}>
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Card>
      <NotificationSettingsCard userId={profile.id} />
      {(profile.role === 'system_admin' || profile.role === 'school_admin') && <MfaCard />}
    </>
  );
};
