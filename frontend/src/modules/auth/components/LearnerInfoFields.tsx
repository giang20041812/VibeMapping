import React from 'react';
import { Calendar, School, Tag } from 'lucide-react';
import { Input, Select } from '../../../components/common';
import { GRADE_OPTIONS } from '../../profile/profile.logic';
import type { LearnerInfo, LearnerInfoErrors, RegisterableRole } from '../auth.types';
import './LearnerInfoFields.css';

export interface LearnerInfoFieldsProps {
  role: RegisterableRole;
  values: LearnerInfo;
  errors: LearnerInfoErrors;
  onChange: (field: keyof LearnerInfo, value: string) => void;
}

export const LearnerInfoFields: React.FC<LearnerInfoFieldsProps> = ({ role, values, errors, onChange }) => {
  const gradeOptions = GRADE_OPTIONS[role === 'university_student' ? 'university_student' : 'student'];

  return (
    <div className="learner-info" role="group" aria-label="Thông tin cá nhân">
      <div className="auth-divider">Thông tin cá nhân</div>
      <div className="auth-grid">
        <Input
          label="Ngày sinh"
          name="date_of_birth"
          placeholder="dd/mm/yyyy"
          inputMode="numeric"
          autoComplete="bday"
          leftIcon={<Calendar size={16} />}
          value={values.date_of_birth}
          onChange={(e) => onChange('date_of_birth', e.target.value)}
          error={errors.date_of_birth}
          required
        />
        <Input
          label="Tên hiển thị"
          name="display_name"
          maxLength={20}
          leftIcon={<Tag size={16} />}
          value={values.display_name}
          onChange={(e) => onChange('display_name', e.target.value)}
          error={errors.display_name}
          required
        />
        <Input
          label="Trường"
          name="school_name"
          autoComplete="organization"
          leftIcon={<School size={16} />}
          value={values.school_name}
          onChange={(e) => onChange('school_name', e.target.value)}
          error={errors.school_name}
          required
        />
        <Select
          label="Khối lớp / Ngành học"
          name="grade_or_major"
          emptyLabel="Chọn"
          options={gradeOptions.map((option) => ({ value: option, label: option }))}
          value={values.grade_or_major}
          onChange={(value) => onChange('grade_or_major', value)}
          error={errors.grade_or_major}
          required
        />
      </div>
    </div>
  );
};
