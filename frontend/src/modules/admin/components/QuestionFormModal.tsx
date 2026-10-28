import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Input, Modal, Select, Textarea } from '../../../components/common';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import type { FilterOption } from '../../../types/filter';
import {
  ANSWER_OPTION_COUNT,
  ASSESSMENT_PART_OPTIONS,
  DETAIL_LEVEL_OPTIONS,
  RATER_GROUP_OPTIONS,
  RESPONDENT_SEGMENT_OPTIONS,
} from '../admin.constants';
import type { Criteria, QuestionInput, QuestionRow, RaterGroup } from '../admin.types';
import { createQuestion, isDuplicateQuestionCode, updateQuestion } from '../questions.service';

export interface QuestionFormModalProps {
  open: boolean;
  /** Câu hỏi đang sửa; bỏ trống là thêm mới */
  question: QuestionRow | null;
  criteria: Criteria[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  question_code: string;
  criteria_id: string;
  rater_group: string;
  respondent_segment: string;
  question_type: string;
  content: string;
  answer_options: string[];
  assessment_part: string;
  detail_level: string;
  is_active: boolean;
}

type FormErrors = Partial<Record<'question_code' | 'criteria_id' | 'content', string>>;

const EMPTY_FORM: FormState = {
  question_code: '',
  criteria_id: '',
  rater_group: 'self',
  respondent_segment: 'all',
  question_type: '',
  content: '',
  answer_options: Array.from({ length: ANSWER_OPTION_COUNT }, () => ''),
  assessment_part: '',
  detail_level: '',
  is_active: true,
};

function toForm(question: QuestionRow | null): FormState {
  if (!question) return EMPTY_FORM;
  return {
    question_code: question.question_code,
    criteria_id: question.criteria_id,
    rater_group: question.rater_group,
    respondent_segment: question.respondent_segment,
    question_type: question.question_type ?? '',
    content: question.content,
    answer_options: question.answer_options,
    assessment_part: question.assessment_part ? String(question.assessment_part) : '',
    detail_level: question.detail_level ?? '',
    is_active: question.is_active,
  };
}

export const QuestionFormModal: React.FC<QuestionFormModalProps> = ({ open, question, criteria, onClose, onSaved }) => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(toForm(question));
    setErrors({});
    setFormError(null);
  }, [open, question]);

  const criteriaOptions = useMemo<FilterOption[]>(
    () => criteria.map((item) => ({ value: item.id, label: `${item.dimension_code} · ${item.name}` })),
    [criteria],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const setAnswerOption = (index: number, value: string) =>
    setForm((current) => ({
      ...current,
      answer_options: current.answer_options.map((item, position) => (position === index ? value : item)),
    }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    if (!form.question_code.trim()) nextErrors.question_code = 'Nhập mã câu hỏi.';
    if (!form.criteria_id) nextErrors.criteria_id = 'Chọn tiêu chí.';
    if (!form.content.trim()) nextErrors.content = 'Nhập nội dung câu hỏi.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const filledOptions = form.answer_options.map((item) => item.trim());
    const input: QuestionInput = {
      question_code: form.question_code.trim(),
      criteria_id: form.criteria_id,
      rater_group: form.rater_group as RaterGroup,
      respondent_segment: form.respondent_segment,
      question_type: form.question_type.trim() || null,
      content: form.content.trim(),
      answer_options: filledOptions.every((item) => item === '') ? [] : filledOptions,
      assessment_part: form.assessment_part ? Number(form.assessment_part) : null,
      detail_level: form.detail_level || null,
      is_active: form.is_active,
    };

    setIsSaving(true);
    setFormError(null);
    try {
      if (question) await updateQuestion(question.id, input);
      else await createQuestion(input);
      onSaved();
    } catch (caught) {
      if (isDuplicateQuestionCode(caught)) setErrors({ question_code: 'Mã câu hỏi đã tồn tại.' });
      else setFormError('Không lưu được câu hỏi. Thử lại sau.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={question ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}
      onClose={onClose}
      locked={isSaving}
      wide
      actions={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Hủy
          </Button>
          <Button type="submit" form="question-form" isLoading={isSaving}>
            Lưu
          </Button>
        </>
      }
    >
      <form id="question-form" className="admin-form" onSubmit={handleSubmit} noValidate>
        {formError && <Alert variant="danger">{formError}</Alert>}

        <div className="admin-form-grid">
          <Input
            label="Mã câu hỏi"
            value={form.question_code}
            onChange={(event) => set('question_code', event.target.value)}
            error={errors.question_code}
            readOnly={question !== null}
            required
          />
          <div>
            <SearchableSelect
              label="Tiêu chí"
              placeholder="Chọn tiêu chí"
              options={criteriaOptions}
              value={form.criteria_id}
              onChange={(value) => set('criteria_id', value)}
            />
            {errors.criteria_id && (
              <span className="input-error-msg" role="alert">
                {errors.criteria_id}
              </span>
            )}
          </div>
          <Select label="Góc nhìn" options={RATER_GROUP_OPTIONS} value={form.rater_group} onChange={(value) => set('rater_group', value)} />
          <Select
            label="Đối tượng trả lời"
            options={RESPONDENT_SEGMENT_OPTIONS}
            value={form.respondent_segment}
            onChange={(value) => set('respondent_segment', value)}
          />
          <Select
            label="Phần"
            emptyLabel="Chưa gắn"
            options={ASSESSMENT_PART_OPTIONS}
            value={form.assessment_part}
            onChange={(value) => set('assessment_part', value)}
          />
          <Select
            label="Mức chi tiết"
            emptyLabel="Chưa gắn"
            options={DETAIL_LEVEL_OPTIONS}
            value={form.detail_level}
            onChange={(value) => set('detail_level', value)}
          />
          <Input label="Loại câu hỏi" value={form.question_type} onChange={(event) => set('question_type', event.target.value)} />
        </div>

        <Textarea
          label="Nội dung"
          rows={3}
          value={form.content}
          onChange={(event) => set('content', event.target.value)}
          error={errors.content}
        />

        <h3 className="admin-form-section-title">Nhãn đáp án</h3>
        <div className="admin-form-grid">
          {form.answer_options.map((option, index) => (
            <Input
              key={index}
              label={`Mức ${index + 1}`}
              value={option}
              onChange={(event) => setAnswerOption(index, event.target.value)}
            />
          ))}
        </div>

        <Checkbox label="Đang dùng" checked={form.is_active} onChange={(checked) => set('is_active', checked)} />
      </form>
    </Modal>
  );
};
