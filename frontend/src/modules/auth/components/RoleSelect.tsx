import React from 'react';
import { BookOpen, Compass, GraduationCap, Presentation, Users } from 'lucide-react';
import type { RegisterableRole } from '../auth.types';
import './RoleSelect.css';

const ROLES: { value: RegisterableRole; label: string; icon: React.ReactNode }[] = [
  { value: 'student', label: 'Học sinh', icon: <BookOpen size={20} /> },
  { value: 'university_student', label: 'Sinh viên', icon: <GraduationCap size={20} /> },
  { value: 'parent', label: 'Phụ huynh', icon: <Users size={20} /> },
  { value: 'teacher', label: 'Giáo viên', icon: <Presentation size={20} /> },
  { value: 'mentor', label: 'Người hướng dẫn', icon: <Compass size={20} /> },
];

export interface RoleSelectProps {
  value: RegisterableRole;
  onChange: (role: RegisterableRole) => void;
}

export const RoleSelect: React.FC<RoleSelectProps> = ({ value, onChange }) => (
  <fieldset className="role-select">
    <legend className="role-select-legend">Vai trò</legend>
    <div className="role-select-grid">
      {ROLES.map((role) => (
        <label key={role.value} className={`role-option ${value === role.value ? 'is-selected' : ''}`}>
          <input
            type="radio"
            name="role"
            value={role.value}
            checked={value === role.value}
            onChange={() => onChange(role.value)}
            className="role-option-input"
          />
          <span className="role-option-icon">{role.icon}</span>
          <span className="role-option-label">{role.label}</span>
        </label>
      ))}
    </div>
  </fieldset>
);
