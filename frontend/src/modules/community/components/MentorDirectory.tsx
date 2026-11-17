import React, { useMemo, useState } from 'react';
import { UserSearch } from 'lucide-react';
import { Skeleton } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { FilterSearch } from '../../../components/filters/FilterSearch/FilterSearch';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { useDebounce } from '../../../hooks/useDebounce';
import { normalizeSearchText } from '../../../lib/searchText';
import type { CareerFieldOption, Mentor } from '../community.types';
import { MentorCard } from './MentorCard';

interface Props {
  mentors: Mentor[] | null;
  fields: CareerFieldOption[];
}

/** Tìm người hướng dẫn theo lĩnh vực nghề nghiệp hoặc chủ đề (FR09.01.14) */
export const MentorDirectory: React.FC<Props> = ({ mentors, fields }) => {
  const [keyword, setKeyword] = useState('');
  const [fieldId, setFieldId] = useState('');
  const query = useDebounce(keyword, 300);
  const fieldOptions = useMemo(() => fields.map((f) => ({ value: f.id, label: f.field_name })), [fields]);

  const filtered = useMemo(() => {
    const key = normalizeSearchText(query);
    return (mentors ?? []).filter((m) => {
      if (m.is_me) return false;
      if (fieldId && !m.field_ids.includes(fieldId)) return false;
      return !key || normalizeSearchText(`${m.name} ${m.headline} ${m.bio ?? ''} ${m.expertise_topics.join(' ')} ${m.field_names.join(' ')}`).includes(key);
    });
  }, [mentors, fieldId, query]);

  return (
    <div className="cm-section">
      <FilterBar onReset={() => { setKeyword(''); setFieldId(''); }} totalResults={filtered.length}>
        <FilterSearch placeholder="Tên, chủ đề tư vấn" value={keyword} onChange={setKeyword} />
        <SearchableSelect label="Lĩnh vực" placeholder="Tất cả lĩnh vực" options={fieldOptions} value={fieldId} onChange={setFieldId} />
      </FilterBar>

      {mentors === null ? (
        <div className="cm-grid">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} shape="block" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="cm-empty">
          <UserSearch aria-hidden="true" />
          <p>{mentors.filter((m) => !m.is_me).length === 0 ? 'Chưa có người hướng dẫn được xác minh.' : 'Không có người hướng dẫn phù hợp.'}</p>
        </div>
      ) : (
        <ul className="cm-grid">
          {filtered.map((m) => <MentorCard key={m.user_id} mentor={m} />)}
        </ul>
      )}
    </div>
  );
};
