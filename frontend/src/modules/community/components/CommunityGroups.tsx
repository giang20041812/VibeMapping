import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageSquareText, Plus, Users } from 'lucide-react';
import { Badge, Button, Skeleton } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { FilterSearch } from '../../../components/filters/FilterSearch/FilterSearch';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { useDebounce } from '../../../hooks/useDebounce';
import { normalizeSearchText } from '../../../lib/searchText';
import type { Community } from '../community.types';

interface Props {
  rows: Community[] | null;
  busy: boolean;
  onJoin: (community: Community) => void;
  onCreate: () => void;
}

type Scope = 'all' | 'joined' | 'mine';
const SCOPE_OPTIONS = [
  { value: 'all', label: 'Tất cả nhóm' },
  { value: 'joined', label: 'Nhóm đã tham gia' },
  { value: 'mine', label: 'Nhóm tôi tạo' },
];

/** Danh sách và tìm cộng đồng (FR09.01.01), tham gia (FR09.01.02) */
export const CommunityGroups: React.FC<Props> = ({ rows, busy, onJoin, onCreate }) => {
  const [keyword, setKeyword] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const query = useDebounce(keyword, 300);

  const filtered = useMemo(() => {
    const key = normalizeSearchText(query);
    return (rows ?? []).filter((c) => {
      if (scope === 'joined' && !c.joined) return false;
      if (scope === 'mine' && !c.is_owner) return false;
      return !key || normalizeSearchText(`${c.name} ${c.description ?? ''} ${c.topics.join(' ')}`).includes(key);
    });
  }, [rows, scope, query]);

  return (
    <div className="cm-section">
      <div className="cm-toolbar">
        <FilterBar onReset={() => { setKeyword(''); setScope('all'); }} totalResults={filtered.length}>
          <FilterSearch placeholder="Tên nhóm, chủ đề" value={keyword} onChange={setKeyword} />
          <SearchableSelect label="Hiển thị" options={SCOPE_OPTIONS} value={scope} onChange={(value) => setScope((value || 'all') as Scope)} isSearchable={false} />
        </FilterBar>
        <Button type="button" leftIcon={<Plus size={16} />} onClick={onCreate}>Tạo nhóm</Button>
      </div>

      {rows === null ? (
        <div className="cm-grid">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} shape="block" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="cm-empty">
          <Users aria-hidden="true" />
          <p>{rows.length === 0 ? 'Chưa có nhóm nào.' : 'Không có nhóm phù hợp.'}</p>
          {rows.length === 0 && <Button type="button" variant="outline" leftIcon={<Plus size={16} />} onClick={onCreate}>Tạo nhóm đầu tiên</Button>}
        </div>
      ) : (
        <ul className="cm-grid">
          {filtered.map((c) => (
            <li key={c.id} className={`cm-group${c.joined ? ' is-joined' : ''}`}>
              <div className="cm-group-head">
                <span className="cm-group-icon" aria-hidden="true"><MessageSquareText /></span>
                <div className="cm-group-title">
                  <h3>{c.name}</h3>
                  <span className="cm-meta">
                    <Users size={14} aria-hidden="true" /> {c.member_count} thành viên
                    {c.joined && <> · {c.posts.length} bài</>}
                  </span>
                </div>
                {c.joined && <Badge size="sm" variant="success">Đã tham gia</Badge>}
              </div>
              {c.description && <p className="cm-group-desc">{c.description}</p>}
              {c.topics.length > 0 && (
                <div className="cm-chips">
                  {c.topics.slice(0, 4).map((t) => <span key={t} className="cm-chip">{t}</span>)}
                  {c.topics.length > 4 && <span className="cm-chip is-more">+{c.topics.length - 4}</span>}
                </div>
              )}
              <div className="cm-group-actions">
                {c.joined ? (
                  <Link to={`/cong-dong/nhom/${c.id}`} className="cm-link-btn">
                    Vào nhóm <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                ) : (
                  <Button type="button" size="sm" disabled={busy} onClick={() => onJoin(c)}>Tham gia</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
