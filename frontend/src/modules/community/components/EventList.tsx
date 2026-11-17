import React, { useMemo, useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { Button, Skeleton } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { FilterSearch } from '../../../components/filters/FilterSearch/FilterSearch';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { useDebounce } from '../../../hooks/useDebounce';
import { normalizeSearchText } from '../../../lib/searchText';
import { eventState } from '../community.constants';
import type { CareerEvent } from '../community.types';
import { EventCard } from './EventCard';

interface Props {
  events: CareerEvent[] | null;
  busy: boolean;
  canCreate: boolean;
  onToggle: (event: CareerEvent) => void;
  onCreate: () => void;
}

type Scope = 'all' | 'open' | 'registered';
const SCOPE_OPTIONS = [
  { value: 'all', label: 'Tất cả sự kiện' },
  { value: 'open', label: 'Còn nhận đăng ký' },
  { value: 'registered', label: 'Đã đăng ký' },
];

/** Danh sách sự kiện hướng nghiệp (UI_09-S05) */
export const EventList: React.FC<Props> = ({ events, busy, canCreate, onToggle, onCreate }) => {
  const [keyword, setKeyword] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const query = useDebounce(keyword, 300);

  const filtered = useMemo(() => {
    const key = normalizeSearchText(query);
    return (events ?? []).filter((e) => {
      const state = eventState(e);
      if (scope === 'open' && state !== 'open') return false;
      if (scope === 'registered' && state !== 'registered') return false;
      return !key || normalizeSearchText(`${e.title} ${e.location ?? ''} ${e.organizer} ${e.audience ?? ''}`).includes(key);
    });
  }, [events, scope, query]);

  return (
    <div className="cm-section">
      <div className="cm-toolbar">
        <FilterBar onReset={() => { setKeyword(''); setScope('all'); }} totalResults={filtered.length}>
          <FilterSearch placeholder="Tên sự kiện, địa điểm" value={keyword} onChange={setKeyword} />
          <SearchableSelect label="Hiển thị" options={SCOPE_OPTIONS} value={scope} onChange={(value) => setScope((value || 'all') as Scope)} isSearchable={false} />
        </FilterBar>
        {canCreate && <Button type="button" leftIcon={<Plus size={16} />} onClick={onCreate}>Tạo sự kiện</Button>}
      </div>

      {events === null ? (
        <div className="cm-list">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} shape="block" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="cm-empty">
          <CalendarDays aria-hidden="true" />
          <p>{events.length === 0 ? 'Chưa có sự kiện sắp diễn ra.' : 'Không có sự kiện phù hợp.'}</p>
        </div>
      ) : (
        <ul className="cm-list">
          {filtered.map((event) => <EventCard key={event.id} event={event} busy={busy} onToggle={onToggle} />)}
        </ul>
      )}
    </div>
  );
};
