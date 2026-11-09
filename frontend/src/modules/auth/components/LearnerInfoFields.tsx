import React from 'react';
import { School } from 'lucide-react';
import { DateInput, Input, Select } from '../../../components/common';
import { GRADE_OPTIONS } from '../../profile/profile.logic';
import type { LearnerInfo, LearnerInfoErrors, RegisterableRole } from '../auth.types';
import './LearnerInfoFields.css';

export interface LearnerInfoFieldsProps {
  role: RegisterableRole;
  values: LearnerInfo;
  errors: LearnerInfoErrors;
  onChange: (field: keyof LearnerInfo, value: string) => void;
}

/** Các ô nằm trong lưới của trang đăng ký: ngày sinh, trường, khối lớp. */
export const LearnerInfoFields: React.FC<LearnerInfoFieldsProps> = ({ role, values, errors, onChange }) => {
  const gradeOptions = GRADE_OPTIONS[role === 'university_student' ? 'university_student' : 'student'];

  return (
    <>
      <DateInput
        label="Ngày sinh"
        name="date_of_birth"
        value={values.date_of_birth}
        onChange={(e) => onChange('date_of_birth', e.target.value)}
        error={errors.date_of_birth}
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
        label="Khối lớp"
        name="grade_or_major"
        emptyLabel="Chọn"
        options={gradeOptions.map((option) => ({ value: option, label: option }))}
        value={values.grade_or_major}
        onChange={(value) => onChange('grade_or_major', value)}
        error={errors.grade_or_major}
        required
      />
    </>
  );
};
