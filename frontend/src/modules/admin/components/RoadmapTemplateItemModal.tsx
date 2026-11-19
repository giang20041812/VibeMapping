import React, { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Input, Modal, NumberInput, Select, Tabs, Textarea } from '../../../components/common';
import {
  listSamplePlans,
  updateRoadmapTemplateItem,
  updateSamplePlan,
  type RoadmapTemplateItemRow,
  type SamplePlanRow,
} from '../roadmap_templates_admin.service';
import { ROADMAP_CHECK_STATUS_OPTIONS } from './RoadmapTemplateFilterFields';

interface Props {
  item: RoadmapTemplateItemRow | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  title: string;
  how_to: string;
  skills_gained: string;
  completion_evidence: string;
  pass_criteria: string;
  duration_weeks: string;
  level_1: string;
  level_2: string;
  level_3: string;
  prerequisite_codes: string;
  prerequisite_required: boolean;
  reference_source: string;
  check_status: string;
  check_note: string;
  level_guide: string;
  prior_knowledge: string;
  experience_task: string;
  extra_hours_text: string;
  fallback_options: string;
  group_boundary: string;
  is_active: boolean;
}

const text = (value: string | null | undefined) => value ?? '';
const nullable = (value: string) => (value.trim() ? value.trim() : null);

function toForm(item: RoadmapTemplateItemRow): FormState {
  return {
    title: item.title,
    how_to: text(item.how_to),
    skills_gained: text(item.skills_gained),
    completion_evidence: text(item.completion_evidence),
    pass_criteria: text(item.pass_criteria),
    duration_weeks: String(item.duration_weeks),
    level_1: item.level_duration_weeks?.['1'] ? String(item.level_duration_weeks['1']) : '',
    level_2: item.level_duration_weeks?.['2'] ? String(item.level_duration_weeks['2']) : '',
    level_3: item.level_duration_weeks?.['3'] ? String(item.level_duration_weeks['3']) : '',
    prerequisite_codes: item.prerequisite_codes.join(', '),
    prerequisite_required: item.prerequisite_required,
    reference_source: text(item.reference_source),
    check_status: text(item.check_status),
    check_note: text(item.check_note),
    level_guide: text(item.level_guide),
    prior_knowledge: text(item.prior_knowledge),
    experience_task: text(item.experience_task),
    extra_hours_text: text(item.extra_hours_text),
    fallback_options: text(item.fallback_options),
    group_boundary: text(item.group_boundary),
    is_active: item.is_active,
  };
}

type Tab = 'noi-dung' | 'cap-va-ke-hoach';

/** Sửa một mục của lộ trình mẫu; mục nhóm Lãnh đạo & Tổ chức có thêm cấp, phần bổ sung và kế hoạch mẫu */
export const RoadmapTemplateItemModal: React.FC<Props> = ({ item, onClose, onSaved }) => {
  const [form, setForm] = useState<FormState | null>(item ? toForm(item) : null);
  const [plans, setPlans] = useState<SamplePlanRow[]>([]);
  const [tab, setTab] = useState<Tab>('noi-dung');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leveled = item?.group_code === 'G5' || Boolean(item?.level_duration_weeks);

  useEffect(() => {
    if (!item || !leveled) return;
    listSamplePlans(item.item_code).then(setPlans).catch(() => setError('Không tải được kế hoạch mẫu.'));
  }, [item, leveled]);

  if (!item || !form) return null;
  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch });
  const setPlan = (id: string, patch: Partial<SamplePlanRow>) =>
    setPlans((current) => current.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)));

  const weeks = Number(form.duration_weeks);
  const levels = { '1': Number(form.level_1), '2': Number(form.level_2), '3': Number(form.level_3) };
  const levelsFilled = Object.values(levels).filter((v) => v > 0).length;
  const invalid =
    !form.title.trim() ? 'Nhập tên mục.' :
    !(Number.isInteger(weeks) && weeks > 0) ? 'Thời lượng phải là số tuần lớn hơn 0.' :
    levelsFilled > 0 && levelsFilled < 3 ? 'Nhập đủ số tuần của cả 3 cấp hoặc bỏ trống cả 3.' :
    plans.some((plan) => !plan.title.trim()) ? 'Kế hoạch mẫu phải có tên.' : null;

  const save = async () => {
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateRoadmapTemplateItem(item.id, {
        title: form.title.trim(),
        how_to: nullable(form.how_to),
        skills_gained: nullable(form.skills_gained),
        completion_evidence: nullable(form.completion_evidence),
        pass_criteria: nullable(form.pass_criteria),
        duration_weeks: weeks,
        level_duration_weeks: levelsFilled === 3 ? levels : null,
        prerequisite_codes: form.prerequisite_codes.split(/[,;\s]+/).map((code) => code.trim().toUpperCase()).filter(Boolean),
        prerequisite_required: form.prerequisite_required,
        reference_source: nullable(form.reference_source),
        check_status: nullable(form.check_status),
        check_note: nullable(form.check_note),
        level_guide: nullable(form.level_guide),
        prior_knowledge: nullable(form.prior_knowledge),
        experience_task: nullable(form.experience_task),
        extra_hours_text: nullable(form.extra_hours_text),
        fallback_options: nullable(form.fallback_options),
        group_boundary: nullable(form.group_boundary),
        is_active: form.is_active,
      });
      await Promise.all(
        plans.map((plan) =>
          updateSamplePlan(plan.id, {
            title: plan.title.trim(),
            fit_when: nullable(text(plan.fit_when)),
            schedule_level_1: nullable(text(plan.schedule_level_1)),
            schedule_level_2: nullable(text(plan.schedule_level_2)),
            schedule_level_3: nullable(text(plan.schedule_level_3)),
            suggested_output: nullable(text(plan.suggested_output)),
            is_active: plan.is_active,
          }),
        ),
      );
      onSaved();
    } catch {
      setError('Không lưu được mục. Thử lại sau.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      wide
      title={`${item.item_code} · ${item.stage_name}`}
      onClose={onClose}
      locked={busy}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button isLoading={busy} onClick={() => void save()}>Lưu</Button>
        </>
      }
    >
      <div className="admin-form">
        {error && <Alert variant="danger">{error}</Alert>}
        {leveled && (
          <Tabs
            label="Phần của mục"
            value={tab}
            onChange={(value) => setTab(value as Tab)}
            items={[
              { value: 'noi-dung', label: 'Nội dung' },
              { value: 'cap-va-ke-hoach', label: 'Cấp và kế hoạch mẫu' },
            ]}
          />
        )}

        {tab === 'noi-dung' && (
          <>
            <Input label="Tên mục" required value={form.title} onChange={(e) => set({ title: e.target.value })} />
            <Textarea label="Cách làm" rows={8} value={form.how_to} onChange={(e) => set({ how_to: e.target.value })} />
            <div className="admin-form-grid">
              <Textarea label="Bằng chứng hoàn thành" rows={4} value={form.completion_evidence} onChange={(e) => set({ completion_evidence: e.target.value })} />
              <Textarea label="Tiêu chí đạt" rows={4} value={form.pass_criteria} onChange={(e) => set({ pass_criteria: e.target.value })} />
            </div>
            <div className="admin-form-grid">
              <Input label="Kỹ năng đạt được" value={form.skills_gained} onChange={(e) => set({ skills_gained: e.target.value })} />
              <NumberInput
                label="Thời lượng (tuần)"
                required
                allowDecimals={false}
                allowNegative={false}
                min={1}
                value={form.duration_weeks}
                onChange={(e) => set({ duration_weeks: e.target.value })}
              />
              <Input label="Mục tiên quyết" placeholder="RM1-TD-B1-01, RM1-TD-B1-02" value={form.prerequisite_codes} onChange={(e) => set({ prerequisite_codes: e.target.value })} />
            </div>
            <Checkbox
              label="Phải làm xong mục tiên quyết trước"
              checked={form.prerequisite_required}
              onChange={(value) => set({ prerequisite_required: value })}
            />
            <Textarea label="Căn cứ" rows={2} value={form.reference_source} onChange={(e) => set({ reference_source: e.target.value })} />
            <div className="admin-form-grid">
              <Select label="Trạng thái kiểm tra" emptyLabel="Chưa đặt" options={ROADMAP_CHECK_STATUS_OPTIONS} value={form.check_status} onChange={(value) => set({ check_status: value })} />
              <Input label="Ghi chú kiểm tra" value={form.check_note} onChange={(e) => set({ check_note: e.target.value })} />
            </div>
            <Checkbox label="Đang dùng để gợi ý" checked={form.is_active} onChange={(value) => set({ is_active: value })} />
          </>
        )}

        {tab === 'cap-va-ke-hoach' && (
          <>
            <div className="admin-form-grid">
              {(['1', '2', '3'] as const).map((key) => (
                <NumberInput
                  key={key}
                  label={`Cấp ${key} (tuần)`}
                  allowDecimals={false}
                  allowNegative={false}
                  min={1}
                  value={form[`level_${key}`]}
                  onChange={(e) => set({ [`level_${key}`]: e.target.value } as Partial<FormState>)}
                />
              ))}
            </div>
            <Textarea label="Gợi ý chọn cấp" rows={3} value={form.level_guide} onChange={(e) => set({ level_guide: e.target.value })} />
            <div className="admin-form-grid">
              <Textarea label="Cần biết trước" rows={4} value={form.prior_knowledge} onChange={(e) => set({ prior_knowledge: e.target.value })} />
              <Textarea label="Trải nghiệm" rows={4} value={form.experience_task} onChange={(e) => set({ experience_task: e.target.value })} />
              <Textarea label="Giờ phụ thêm" rows={3} value={form.extra_hours_text} onChange={(e) => set({ extra_hours_text: e.target.value })} />
              <Textarea label="Đường lui & linh hoạt" rows={3} value={form.fallback_options} onChange={(e) => set({ fallback_options: e.target.value })} />
            </div>
            <Textarea label="Ranh giới với nhóm khác" rows={2} value={form.group_boundary} onChange={(e) => set({ group_boundary: e.target.value })} />

            {plans.map((plan) => (
              <fieldset key={plan.id} className="admin-form admin-fieldset">
                <legend className="admin-form-section-title">{plan.plan_code}</legend>
                <div className="admin-form-grid">
                  <Input label="Tên kế hoạch" required value={plan.title} onChange={(e) => setPlan(plan.id, { title: e.target.value })} />
                  <Input label="Hợp khi" value={text(plan.fit_when)} onChange={(e) => setPlan(plan.id, { fit_when: e.target.value })} />
                </div>
                <div className="admin-form-grid">
                  <Textarea label="Lịch cấp 1" rows={2} value={text(plan.schedule_level_1)} onChange={(e) => setPlan(plan.id, { schedule_level_1: e.target.value })} />
                  <Textarea label="Lịch cấp 2" rows={2} value={text(plan.schedule_level_2)} onChange={(e) => setPlan(plan.id, { schedule_level_2: e.target.value })} />
                  <Textarea label="Lịch cấp 3" rows={2} value={text(plan.schedule_level_3)} onChange={(e) => setPlan(plan.id, { schedule_level_3: e.target.value })} />
                </div>
                <Input label="Đầu ra gợi ý" value={text(plan.suggested_output)} onChange={(e) => setPlan(plan.id, { suggested_output: e.target.value })} />
                <Checkbox label="Đang dùng" checked={plan.is_active} onChange={(value) => setPlan(plan.id, { is_active: value })} />
              </fieldset>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
};
