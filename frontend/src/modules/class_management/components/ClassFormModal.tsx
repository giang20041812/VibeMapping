import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, Modal, Select } from '../../../components/common';
import { GRADE_OPTIONS } from '../class_management.constants';
import { createClass } from '../class_management.service';
import type { School } from '../class_management.types';
import '../ClassManagement.css';

export interface ClassFormModalProps {
  open: boolean;
  schools: School[];
  onClose: () => void;
  onSaved: (classId: string) => void;
}

function currentSchoolYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

export const ClassFormModal: React.FC<ClassFormModalProps> = ({ open, schools, onClose, onSaved }) => {
  const [schoolId, setSchoolId] = useState('');
  const [className, setClassName] = useState('');
  const [grade, setGrade] = useState('');
  const [schoolYear, setSchoolYear] = useState(currentSchoolYear());
  const [nameError, setNameError] = useState<string | undefined>();
  const [yearError, setYearError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const schoolOptions = useMemo(() => schools.map((school) => ({ value: school.id, label: school.school_name })), [schools]);

  useEffect(() => {
    if (!open) return;
    setSchoolId(schools[0]?.id ?? '');
    setClassName('');
    setGrade('');
    setSchoolYear(currentSchoolYear());
    setNameError(undefined);
    setYearError(undefined);
    setFormError(null);
  }, [open, schools]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const invalidName = !className.trim();
    const invalidYear = !/^\d{4}-\d{4}$/.test(schoolYear.trim());
    setNameError(invalidName ? 'Nhập tên lớp.' : undefined);
    setYearError(invalidYear ? 'Năm học dạng 2026-2027.' : undefined);
    if (invalidName || invalidYear || !schoolId) return;

    setIsSaving(true);
    setFormError(null);
    try {
      const classId = await createClass({
        schoolId,
        className: className.trim(),
        grade: grade ? Number(grade) : null,
        schoolYear: schoolYear.trim(),
      });
      onSaved(classId);
    } catch {
      setFormError('Không tạo được lớp. Thử lại sau.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Tạo lớp"
      onClose={onClose}
      locked={isSaving}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Hủy
          </Button>
          <Button type="submit" form="class-form" isLoading={isSaving}>
            Tạo lớp
          </Button>
        </>
      }
    >
      <form id="class-form" className="class-form" onSubmit={handleSubmit} noValidate>
        {formError && <Alert variant="danger">{formError}</Alert>}
        {schools.length > 1 && <Select label="Trường" options={schoolOptions} value={schoolId} onChange={setSchoolId} />}
        <div className="class-form-grid">
          <Input label="Tên lớp" value={className} onChange={(event) => setClassName(event.target.value)} error={nameError} required />
          <Select label="Khối" emptyLabel="Không chọn" options={GRADE_OPTIONS} value={grade} onChange={setGrade} />
          <Input
            label="Năm học"
            placeholder="2026-2027"
            value={schoolYear}
            onChange={(event) => setSchoolYear(event.target.value)}
            error={yearError}
            required
          />
        </div>
      </form>
    </Modal>
  );
};
