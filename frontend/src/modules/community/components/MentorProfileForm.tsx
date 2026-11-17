import React, { useEffect, useState } from 'react';
import { Button, Card, Input, Textarea } from '../../../components/common';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import type { CareerFieldOption, Mentor, MentorProfileInput } from '../community.types';

interface Props {
  mine: Mentor | null;
  fields: CareerFieldOption[];
  busy: boolean;
  onSave: (input: MentorProfileInput) => Promise<void>;
}

const splitTopics = (text: string) => [...new Set(text.split(/[,;\n]/).map((t) => t.trim()).filter(Boolean))];

/** Hồ sơ của người hướng dẫn: giới thiệu, lĩnh vực, chủ đề, số năm kinh nghiệm */
export const MentorProfileForm: React.FC<Props> = ({ mine, fields, busy, onSave }) => {
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [topics, setTopics] = useState('');
  const [fieldIds, setFieldIds] = useState<string[]>([]);
  const [years, setYears] = useState('');

  useEffect(() => {
    setHeadline(mine?.headline ?? '');
    setBio(mine?.bio ?? '');
    setTopics((mine?.expertise_topics ?? []).join(', '));
    setFieldIds(mine?.field_ids ?? []);
    setYears(mine?.years_experience !== null && mine?.years_experience !== undefined ? String(mine.years_experience) : '');
  }, [mine]);

  const headlineError = headline.length > 0 && headline.trim().length < 8 ? 'Cần ít nhất 8 ký tự.' : undefined;
  const yearsError = years.trim() !== '' && (!/^\d+$/.test(years.trim()) || Number(years) > 60) ? 'Nhập số năm từ 0 đến 60.' : undefined;
  const fieldOptions = fields.filter((f) => !fieldIds.includes(f.id)).map((f) => ({ value: f.id, label: f.field_name }));
  const fieldName = (id: string) => fields.find((f) => f.id === id)?.field_name ?? '';

  return (
    <Card title={mine ? 'Hồ sơ người hướng dẫn của tôi' : 'Tạo hồ sơ người hướng dẫn'}>
      <form
        className="cm-mentor-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({
            headline: headline.trim(),
            bio: bio.trim(),
            expertiseTopics: splitTopics(topics),
            fieldIds,
            yearsExperience: years.trim() === '' ? null : Number(years),
          });
        }}
      >
        <Input label="Giới thiệu ngắn" required value={headline} maxLength={120} error={headlineError} onChange={(e) => setHeadline(e.target.value)} />
        <Input label="Số năm kinh nghiệm" value={years} inputMode="numeric" error={yearsError} onChange={(e) => setYears(e.target.value)} />
        <div className="cm-field-picker">
          <SearchableSelect label="Lĩnh vực" placeholder="Thêm lĩnh vực" options={fieldOptions} value="" onChange={(id) => id && setFieldIds((prev) => [...prev, id])} />
          {fieldIds.length > 0 && (
            <div className="cm-chips">
              {fieldIds.map((id) => (
                <button key={id} type="button" className="cm-chip is-field is-removable" onClick={() => setFieldIds((prev) => prev.filter((x) => x !== id))} aria-label={`Bỏ ${fieldName(id)}`}>
                  {fieldName(id)} <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Input label="Chủ đề tư vấn" value={topics} maxLength={300} onChange={(e) => setTopics(e.target.value)} placeholder="Chọn ngành, Phỏng vấn, CV" />
        <Textarea label="Giới thiệu chi tiết" rows={4} value={bio} maxLength={1500} onChange={(e) => setBio(e.target.value)} className="cm-span-all" />
        <div className="cm-form-actions cm-span-all">
          {mine && !mine.verified && <span className="cm-meta">Hồ sơ hiển thị với học sinh sau khi được xác minh.</span>}
          <Button type="submit" isLoading={busy} disabled={headline.trim().length < 8 || Boolean(yearsError)}>Lưu hồ sơ</Button>
        </div>
      </form>
    </Card>
  );
};
