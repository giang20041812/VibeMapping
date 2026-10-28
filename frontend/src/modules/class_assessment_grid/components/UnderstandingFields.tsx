import React from 'react';
import { Select } from '../../../components/common';
import { DEPTH_OPTIONS, DURATION_OPTIONS, FREQUENCY_OPTIONS } from '../../guest_assessment/guest.constants';
import type { Understanding } from '../class_assessment_grid.service';
import './ClassGradeTable.css';

const toOptions = (items: { label: string; value: number }[]) =>
  items.map((item) => ({ value: String(item.value), label: item.label }));
const DURATION = toOptions(DURATION_OPTIONS);
const FREQUENCY = toOptions(FREQUENCY_OPTIONS);
const DEPTH = toOptions(DEPTH_OPTIONS);

const toNumber = (value: string) => (value === '' ? null : Number(value));
const fromNumber = (value: number | null) => (value === null ? '' : String(value));

interface UnderstandingFieldsProps {
  value: Understanding;
  emptyLabel: string;
  onChange: (value: Understanding) => void;
}

export const UnderstandingFields: React.FC<UnderstandingFieldsProps> = ({ value, emptyLabel, onChange }) => (
  <div className="grid-understanding">
    <Select
      label="Thời gian quen biết"
      emptyLabel={emptyLabel}
      options={DURATION}
      value={fromNumber(value.acquaintance_duration)}
      onChange={(next) => onChange({ ...value, acquaintance_duration: toNumber(next) })}
    />
    <Select
      label="Tần suất tiếp xúc"
      emptyLabel={emptyLabel}
      options={FREQUENCY}
      value={fromNumber(value.contact_frequency)}
      onChange={(next) => onChange({ ...value, contact_frequency: toNumber(next) })}
    />
    <Select
      label="Mức độ hiểu"
      emptyLabel={emptyLabel}
      options={DEPTH}
      value={fromNumber(value.observation_depth)}
      onChange={(next) => onChange({ ...value, observation_depth: toNumber(next) })}
    />
  </div>
);
