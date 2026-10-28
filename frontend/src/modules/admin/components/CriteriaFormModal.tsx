import React, { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Input, Modal, Select, Textarea } from '../../../components/common';
import { RATER_GROUPS } from '../admin.constants';
import type { Criteria, CriteriaRaterVisibility, HollandCode, RaterGroup } from '../admin.types';
import { saveCriteriaRaterVisibility, updateCriteria } from '../criteria.service';

export interface CriteriaFormModalProps {
  open: boolean;
  criteria: Criteria | null;
  visibility: CriteriaRaterVisibility[];
  hollandCodes: HollandCode[];
  onClose: () => void;
  onSaved: () => void;
}

interface VisibilityState {
  isVisible: boolean;
  scaleMethod: string;
}

type VisibilityMap = Record<RaterGroup, VisibilityState>;

function toVisibilityMap(items: CriteriaRaterVisibility[]): VisibilityMap {
  const map = {} as VisibilityMap;
  for (const group of RATER_GROUPS) {
    const found = items.find((item) => item.rater_group === group.value);
    map[group.value] = { isVisible: found?.is_visible ?? false, scaleMethod: found?.scale_method ?? '' };
  }
  return map;
}

export const CriteriaFormModal: React.FC<CriteriaFormModalProps> = ({
  open,
  criteria,
  visibility,
  hollandCodes,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [definition, setDefinition] = useState('');
  const [behaviorIndicator, setBehaviorIndicator] = useState('');
  const [referenceSource, setReferenceSource] = useState('');
  const [hollandCode, setHollandCode] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [isShortSet, setIsShortSet] = useState(false);
  const [visibilityMap, setVisibilityMap] = useState<VisibilityMap>(() => toVisibilityMap([]));
  const [nameError, setNameError] = useState<string | undefined>();
  const [sortError, setSortError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !criteria) return;
    setName(criteria.name);
    setDefinition(criteria.definition ?? '');
    setBehaviorIndicator(criteria.behavior_indicator ?? '');
    setReferenceSource(criteria.reference_source ?? '');
    setHollandCode(criteria.holland_code ?? '');
    setSortOrder(String(criteria.sort_order));
    setIsActive(criteria.is_active);
    setIsShortSet(criteria.is_short_set);
    setVisibilityMap(toVisibilityMap(visibility.filter((item) => item.criteria_id === criteria.id)));
    setNameError(undefined);
    setSortError(undefined);
    setFormError(null);
  }, [open, criteria, visibility]);

  const updateVisibility = (group: RaterGroup, change: Partial<VisibilityState>) =>
    setVisibilityMap((current) => ({ ...current, [group]: { ...current[group], ...change } }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!criteria) return;
    const order = Number(sortOrder);
    const invalidName = !name.trim();
    const invalidOrder = sortOrder.trim() === '' || !Number.isInteger(order);
    setNameError(invalidName ? 'Nhập tên tiêu chí.' : undefined);
    setSortError(invalidOrder ? 'Thứ tự phải là số nguyên.' : undefined);
    if (invalidName || invalidOrder) return;

    setIsSaving(true);
    setFormError(null);
    try {
      const saveCriteria = () =>
        updateCriteria(criteria.id, {
          name: name.trim(),
          definition: definition.trim() || null,
          behavior_indicator: behaviorIndicator.trim() || null,
          reference_source: referenceSource.trim() || null,
          holland_code: hollandCode || null,
          sort_order: order,
          is_active: isActive,
          is_short_set: isShortSet,
        });
      const saveVisibility = () =>
        saveCriteriaRaterVisibility(
          criteria.id,
          RATER_GROUPS.map((group) => ({
            raterGroup: group.value,
            isVisible: visibilityMap[group.value].isVisible,
            scaleMethod: visibilityMap[group.value].scaleMethod.trim() || null,
          })),
        );
      // Bộ rút gọn chỉ gồm tiêu chí hiển thị với giáo viên: bật rút gọn thì lưu hiển thị trước, tắt thì lưu sau
      if (isShortSet) {
        await saveVisibility();
        await saveCriteria();
      } else {
        await saveCriteria();
        await saveVisibility();
      }
      onSaved();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : typeof cause === 'object' && cause && 'message' in cause ? String((cause as { message: unknown }).message) : '';
      setFormError(
        message.includes('short_set_not_visible_to_teacher')
          ? 'Tiêu chí thuộc bộ câu hỏi rút gọn phải hiển thị với giáo viên.'
          : 'Không lưu được tiêu chí. Thử lại sau.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={criteria ? `Sửa tiêu chí ${criteria.dimension_code}` : 'Sửa tiêu chí'}
      onClose={onClose}
      locked={isSaving}
      wide
      actions={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Hủy
          </Button>
          <Button type="submit" form="criteria-form" isLoading={isSaving}>
            Lưu
          </Button>
        </>
      }
    >
      <form id="criteria-form" className="admin-form" onSubmit={handleSubmit} noValidate>
        {formError && <Alert variant="danger">{formError}</Alert>}

        <div className="admin-form-grid">
          <Input label="Tên tiêu chí" value={name} onChange={(event) => setName(event.target.value)} error={nameError} required />
          <Select
            label="Mã Holland"
            emptyLabel="Không có"
            options={hollandCodes.map((item) => ({ value: item.holland_code, label: `${item.holland_code} · ${item.name}` }))}
            value={hollandCode}
            onChange={setHollandCode}
          />
          <Input
            label="Thứ tự"
            type="number"
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            error={sortError}
          />
          <Input label="Nguồn tham chiếu" value={referenceSource} onChange={(event) => setReferenceSource(event.target.value)} />
        </div>

        <Textarea label="Định nghĩa" rows={3} value={definition} onChange={(event) => setDefinition(event.target.value)} />
        <Textarea
          label="Chỉ báo hành vi"
          rows={3}
          value={behaviorIndicator}
          onChange={(event) => setBehaviorIndicator(event.target.value)}
        />

        <h3 className="admin-form-section-title">Hiển thị theo nhóm người đánh giá</h3>
        {RATER_GROUPS.map((group) => (
          <div key={group.value} className="admin-visibility-row">
            <Checkbox
              label={group.label}
              checked={visibilityMap[group.value].isVisible}
              onChange={(checked) => updateVisibility(group.value, { isVisible: checked })}
            />
            <Input
              aria-label={`Phương pháp thang đo – ${group.label}`}
              placeholder="Phương pháp thang đo"
              value={visibilityMap[group.value].scaleMethod}
              onChange={(event) => updateVisibility(group.value, { scaleMethod: event.target.value })}
            />
          </div>
        ))}

        <Checkbox label="Đang dùng" checked={isActive} onChange={setIsActive} />
        <Checkbox label="Thuộc bộ câu hỏi rút gọn" checked={isShortSet} onChange={setIsShortSet} />
      </form>
    </Modal>
  );
};
