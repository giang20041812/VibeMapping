import React from 'react';
import { Check, Clock, Compass, MapPin, Target, UserRound } from 'lucide-react';
import { Badge, Button, Input, Select, Textarea } from '../../../components/common';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import type { FilterOption } from '../../../types/filter';
import { EDUCATION_LEVELS, schoolYearOptions } from '../roadmap.logic';
import type { SetupErrors, SetupValues } from '../roadmap.types';

export interface CareerChoice {
  id: string;
  name: string;
  from360: boolean;
}

interface Props {
  values: SetupValues;
  errors: SetupErrors;
  choices: CareerChoice[];
  catalog: FilterOption[];
  submitting: boolean;
  submitLabel: string;
  onChange: (patch: Partial<SetupValues>) => void;
  onFillFromProfile: () => void;
  onSubmit: () => void;
  onCancel?: () => void;
}

/** Thiết lập: nghề mục tiêu, điểm xuất phát, thời gian; một nút chính duy nhất */
export const RoadmapSetup: React.FC<Props> = ({
  values,
  errors,
  choices,
  catalog,
  submitting,
  submitLabel,
  onChange,
  onFillFromProfile,
  onSubmit,
  onCancel,
}) => {
  const outsideChoice = values.careerId && !choices.some((c) => c.id === values.careerId);
  return (
    <form
      className="roadmap-setup"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <section className="roadmap-block roadmap-tone-gold">
        <h2 className="roadmap-block-title">
          <span className="roadmap-block-icon" aria-hidden="true"><Target /></span>
          Nghề mục tiêu
        </h2>
        {choices.length > 0 && (
          <div className="roadmap-career-grid" role="radiogroup" aria-label="Nghề gợi ý">
            {choices.map((choice) => {
              const selected = values.careerId === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`roadmap-career-option${selected ? ' is-selected' : ''}`}
                  onClick={() => onChange({ careerId: choice.id })}
                >
                  <span className="roadmap-career-check" aria-hidden="true">{selected && <Check size={14} />}</span>
                  <span className="roadmap-career-name">{choice.name}</span>
                  {choice.from360 && <Badge variant="info" size="sm">Từ kết quả 360°</Badge>}
                </button>
              );
            })}
          </div>
        )}
        <div className="roadmap-field-row">
          <SearchableSelect
            label="Hoặc chọn nghề từ danh sách"
            placeholder="Chọn nghề"
            options={catalog}
            value={outsideChoice ? values.careerId : ''}
            onChange={(value) => onChange({ careerId: value })}
          />
        </div>
        {errors.careerId && <p className="roadmap-field-error" role="alert">{errors.careerId}</p>}
      </section>

      <section className="roadmap-block roadmap-tone-blue">
        <h2 className="roadmap-block-title">
          <span className="roadmap-block-icon" aria-hidden="true"><UserRound /></span>
          Điểm xuất phát
          <Button type="button" size="sm" variant="outline" className="roadmap-block-action" onClick={onFillFromProfile}>
            Lấy từ hồ sơ
          </Button>
        </h2>
        <div className="roadmap-fields">
          <Select
            label="Cấp học"
            required
            emptyLabel="Chọn cấp học"
            options={EDUCATION_LEVELS}
            value={values.educationLevel}
            error={errors.educationLevel}
            onChange={(value) => onChange({ educationLevel: value, schoolYear: '' })}
          />
          <Select
            label="Năm học / Lớp"
            required
            emptyLabel="Chọn năm học hoặc lớp"
            options={schoolYearOptions(values.educationLevel)}
            value={values.schoolYear}
            error={errors.schoolYear}
            disabled={!values.educationLevel}
            onChange={(value) => onChange({ schoolYear: value })}
          />
          <Input
            label="Chứng chỉ hiện có"
            value={values.certificates}
            onChange={(event) => onChange({ certificates: event.target.value })}
          />
          <Textarea
            label="Kỹ năng hiện có"
            rows={3}
            value={values.skills}
            onChange={(event) => onChange({ skills: event.target.value })}
          />
          <Textarea
            label="Hoạt động ngoại khóa hiện có"
            rows={3}
            value={values.extracurricular}
            onChange={(event) => onChange({ extracurricular: event.target.value })}
          />
        </div>
      </section>

      <section className="roadmap-block roadmap-tone-teal">
        <h2 className="roadmap-block-title">
          <span className="roadmap-block-icon" aria-hidden="true"><Clock /></span>
          Mốc thời gian
        </h2>
        <div className="roadmap-fields">
          <Input
            label="Thời hạn đạt mục tiêu"
            required
            placeholder="MM/YYYY"
            inputMode="numeric"
            maxLength={7}
            leftIcon={<MapPin size={16} />}
            value={values.targetMonth}
            error={errors.targetMonth}
            onChange={(event) => onChange({ targetMonth: event.target.value })}
          />
          <Input
            label="Số giờ mỗi tuần có thể đầu tư"
            required
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="giờ/tuần"
            value={values.hoursPerWeek}
            error={errors.hoursPerWeek}
            onChange={(event) => onChange({ hoursPerWeek: event.target.value })}
          />
        </div>
      </section>

      <div className="roadmap-form-actions">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Hủy
          </Button>
        )}
        <Button type="submit" size="lg" isLoading={submitting} leftIcon={<Compass size={18} />}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
