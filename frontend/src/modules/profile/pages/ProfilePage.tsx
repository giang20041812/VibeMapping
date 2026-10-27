import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, GraduationCap, School, Tag, User } from 'lucide-react';
import { Alert, Badge, Button, Card, Input } from '../../../components/common';
import { useAuth } from '../../auth/AuthContext';
import { ProfileSkeleton } from '../components/ProfileSkeleton';
import {
  GRADE_OPTIONS,
  ageOf,
  formatVietnameseDate,
  groupLabel,
  isLearnerRole,
  isProfileComplete,
  parseVietnameseDate,
  validateDisplayName,
  GUARDIAN_AGE,
} from '../profile.logic';
import { updateMyProfile } from '../profile.service';
import './ProfilePage.css';

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
    setFullName(profile.full_name ?? '');
    setDateOfBirth(formatVietnameseDate(profile.date_of_birth));
    setDisplayName(profile.display_name ?? '');
    setSchoolName(profile.school_name ?? '');
    setGrade(profile.grade_or_major ?? '');
  }, [profile]);

  const isoDate = parseVietnameseDate(dateOfBirth);
  const age = ageOf(isoDate);
  const needsGuardian = learner && age !== null && age < GUARDIAN_AGE && !profile?.guardian_consent_confirmed;
  const gradeOptions = profile?.role === 'university_student' ? GRADE_OPTIONS.university_student : GRADE_OPTIONS.student;

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
          {learner && (
            <div className="profile-group">
              <Badge variant="info">Nhóm: {groupLabel(profile.role)}</Badge>
            </div>
          )}

          {needsGuardian && (
            <Alert variant="warning">
              Bạn dưới 16 tuổi: cần người giám hộ xác nhận trước khi mời người khác đánh giá.
            </Alert>
          )}
          {saved && <Alert variant="success">Đã lưu hồ sơ.</Alert>}
          {formError && <Alert variant="danger">{formError}</Alert>}

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
    </>
  );
};
