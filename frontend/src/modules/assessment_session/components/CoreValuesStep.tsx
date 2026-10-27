import React, { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, X } from 'lucide-react';
import { Alert, Button, Card } from '../../../components/common';
import { CORE_VALUE_MAX, CORE_VALUE_MIN } from '../assessmentSession.constants';
import type { CoreValue } from '../assessmentSession.types';
import './CoreValuesStep.css';

export interface CoreValuesStepProps {
  values: CoreValue[];
  selectedIds: string[];
  isSaving: boolean;
  onChange: (ids: string[]) => void;
  onSave: () => void;
}

export const CoreValuesStep: React.FC<CoreValuesStepProps> = ({ values, selectedIds, isSaving, onChange, onSave }) => {
  const [showError, setShowError] = useState(false);
  const byId = new Map(values.map((v) => [v.id, v]));
  const count = selectedIds.length;
  const valid = count >= CORE_VALUE_MIN && count <= CORE_VALUE_MAX;

  const toggle = (id: string) => {
    setShowError(false);
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else if (count < CORE_VALUE_MAX) onChange([...selectedIds, id]);
  };

  const move = (index: number, delta: number) => {
    const next = [...selectedIds];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const handleSave = () => {
    if (!valid) {
      setShowError(true);
      return;
    }
    onSave();
  };

  return (
    <Card title="Giá trị cốt lõi" className="core-values">
      <div className="core-chips" role="group" aria-label="Giá trị nghề nghiệp">
        {values.map((value) => {
          const rank = selectedIds.indexOf(value.id);
          const selected = rank >= 0;
          const blocked = !selected && count >= CORE_VALUE_MAX;
          return (
            <button
              key={value.id}
              type="button"
              className={`core-chip ${selected ? 'is-selected' : ''}`}
              aria-pressed={selected}
              disabled={blocked}
              onClick={() => toggle(value.id)}
            >
              {selected && <span className="core-chip-rank">{rank + 1}</span>}
              {value.name}
            </button>
          );
        })}
      </div>

      <p className={`core-counter ${valid ? 'is-valid' : ''}`}>
        Đã chọn {count}/{CORE_VALUE_MAX} giá trị (cần {CORE_VALUE_MIN}–{CORE_VALUE_MAX})
      </p>

      {count > 0 && (
        <ol className="core-order" aria-label="Thứ tự ưu tiên">
          {selectedIds.map((id, index) => (
            <li key={id} className="core-order-item">
              <span className="core-order-rank">{index + 1}</span>
              <span className="core-order-name">{byId.get(id)?.name}</span>
              <span className="core-order-actions">
                <button type="button" className="core-icon-button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Đưa lên">
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  className="core-icon-button"
                  onClick={() => move(index, 1)}
                  disabled={index === selectedIds.length - 1}
                  aria-label="Đưa xuống"
                >
                  <ArrowDown size={16} />
                </button>
                <button type="button" className="core-icon-button" onClick={() => toggle(id)} aria-label="Bỏ chọn">
                  <X size={16} />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      {showError && <Alert variant="danger">Vui lòng chọn từ 3 đến 5 giá trị.</Alert>}

      <div className="core-actions">
        <Button size="lg" isLoading={isSaving} onClick={handleSave} rightIcon={<ArrowRight size={18} />}>
          Lưu và tiếp tục
        </Button>
      </div>
    </Card>
  );
};
