import React from 'react';
import { Link2 } from 'lucide-react';
import { Button, Card } from '../../../components/common';
import { INVITE_GROUPS, MAX_EXPECTED_PER_GROUP } from '../invitation.constants';
import type { InviteGroup } from '../invitation.constants';
import './GroupPicker.css';

export interface GroupSelection {
  checked: boolean;
  count: string;
}

export interface GroupPickerProps {
  /** Nhóm đã có đường dẫn đang mở (không chọn lại) */
  takenGroups: InviteGroup[];
  selections: Record<InviteGroup, GroupSelection>;
  isSaving: boolean;
  error: string | null;
  onChange: (group: InviteGroup, value: GroupSelection) => void;
  onCreate: () => void;
}

export const GroupPicker: React.FC<GroupPickerProps> = ({ takenGroups, selections, isSaving, error, onChange, onCreate }) => {
  const available = INVITE_GROUPS.filter((g) => !takenGroups.includes(g.key));
  if (available.length === 0) return null;
  const anyChecked = available.some((g) => selections[g.key].checked);

  return (
    <Card title="Chọn nhóm cần mời" className="group-picker">
      <ul className="group-picker-list">
        {available.map((group) => {
          const value = selections[group.key];
          return (
            <li key={group.key} className={`group-picker-row ${value.checked ? 'is-checked' : ''}`}>
              <label className="group-picker-check">
                <input
                  type="checkbox"
                  checked={value.checked}
                  onChange={(e) => onChange(group.key, { checked: e.target.checked, count: value.count || '1' })}
                  className="group-picker-input"
                />
                <span className="group-picker-box" aria-hidden="true" />
                <span className="group-picker-name">{group.label}</span>
              </label>
              <label className="group-picker-count">
                <span className="group-picker-count-label">Số người dự kiến</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_EXPECTED_PER_GROUP}
                  value={value.count}
                  disabled={!value.checked}
                  onChange={(e) => onChange(group.key, { checked: true, count: e.target.value })}
                  aria-label={`Số người dự kiến nhóm ${group.label}`}
                  className="group-picker-number"
                />
              </label>
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="group-picker-error" role="alert">
          {error}
        </p>
      )}
      <div className="group-picker-actions">
        <Button size="lg" onClick={onCreate} isLoading={isSaving} disabled={!anyChecked} leftIcon={<Link2 size={18} />}>
          Tạo đường dẫn mời
        </Button>
      </div>
    </Card>
  );
};
