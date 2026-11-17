import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Briefcase, ClipboardList, Layers, ScanSearch, Target } from 'lucide-react';
import { Badge, Button, Card, Skeleton } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { FilterSearch } from '../../../components/filters/FilterSearch/FilterSearch';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { useDebounce } from '../../../hooks/useDebounce';
import { normalizeSearchText } from '../../../lib/searchText';
import { CAREER_LEVEL_NAMES } from '../../career_explorer/careerLevelFramework.constants';
import type { SavedCareer } from '../../career_explorer/career.service';
import { GAP_STATUS_LABEL, GAP_STATUS_VARIANT, gapStatusHint } from '../portfolio.constants';
import type { GapHistoryEntry, GapParams, GapPosition, GapStatus, SkillProfileItem } from '../portfolio.types';

interface Props {
  positions: GapPosition[] | null;
  saved: SavedCareer[];
  items: SkillProfileItem[];
  params: GapParams;
  history: GapHistoryEntry[];
  selectedId: string | null;
  analysing: boolean;
  onSelect: (frameworkId: string) => void;
  onAnalyse: () => void;
  onOpenProfile: () => void;
}

type Scope = 'target' | 'saved' | 'all';
const SCOPE_OPTIONS = [
  { value: 'target', label: 'Nghề mục tiêu của tôi' },
  { value: 'saved', label: 'Nghề yêu thích' },
  { value: 'all', label: 'Tất cả nghề' },
];
const LEVEL_OPTIONS = CAREER_LEVEL_NAMES.map((name, level) => ({ value: String(level), label: name }));
const PAGE_SIZE = 24;
const STATUSES: GapStatus[] = ['met', 'near', 'unmet'];

/** Bước 1: chọn vị trí công việc (bậc JD của một nghề) để đối chiếu */
export const GapPositionStep: React.FC<Props> = ({ positions, saved, items, params, history, selectedId, analysing, onSelect, onAnalyse, onOpenProfile }) => {
  const targetIds = useMemo(() => new Set(saved.filter((s) => s.kind === 'target').map((s) => s.career_id)), [saved]);
  const savedIds = useMemo(() => new Set(saved.filter((s) => s.kind === 'saved').map((s) => s.career_id)), [saved]);
  const defaultScope: Scope = targetIds.size > 0 ? 'target' : 'all';
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [keyword, setKeyword] = useState('');
  const [level, setLevel] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);
  const query = useDebounce(keyword, 300);

  useEffect(() => setScope(defaultScope), [defaultScope]);
  useEffect(() => setShown(PAGE_SIZE), [scope, query, level]);

  const filtered = useMemo(() => {
    const key = normalizeSearchText(query);
    return (positions ?? []).filter((p) => {
      if (scope === 'target' && !targetIds.has(p.career_id)) return false;
      if (scope === 'saved' && !savedIds.has(p.career_id) && !targetIds.has(p.career_id)) return false;
      if (level !== '' && p.career_level !== Number(level)) return false;
      return !key || normalizeSearchText(`${p.career_name} ${p.level_name}`).includes(key);
    });
  }, [positions, scope, query, level, targetIds, savedIds]);

  const reset = () => {
    setScope(defaultScope);
    setKeyword('');
    setLevel('');
  };

  const verified = items.filter((item) => item.verified_360).length;
  const rated = items.filter((item) => item.self_level !== null).length;
  const selected = positions?.find((p) => p.framework_id === selectedId) ?? null;

  if (items.length === 0) {
    return (
      <Card>
        <div className="pf-empty is-large">
          <ClipboardList aria-hidden="true" />
          <p>Bạn chưa có hồ sơ năng lực để so sánh.</p>
          <Button type="button" onClick={onOpenProfile}>Tạo hồ sơ năng lực</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="pf-step-layout">
      <div className="pf-step-main">
        <FilterBar onReset={reset} totalResults={filtered.length}>
          <FilterSearch placeholder="Tên vị trí hoặc nghề" value={keyword} onChange={setKeyword} />
          <SearchableSelect label="Nghề" options={SCOPE_OPTIONS} value={scope} onChange={(value) => setScope((value || 'all') as Scope)} isSearchable={false} />
          <SearchableSelect label="Cấp bậc" options={LEVEL_OPTIONS} value={level} onChange={setLevel} placeholder="Tất cả cấp bậc" />
        </FilterBar>

        {positions === null ? (
          <div className="pf-position-grid">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} shape="block" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="pf-empty">
            <Briefcase aria-hidden="true" />
            <p>{scope === 'all' ? 'Không có vị trí phù hợp.' : 'Không có vị trí phù hợp trong nhóm nghề này.'}</p>
            {scope !== 'all' && <Button type="button" variant="outline" size="sm" onClick={() => setScope('all')}>Xem tất cả nghề</Button>}
          </div>
        ) : (
          <>
            <div className="pf-position-grid" role="radiogroup" aria-label="Vị trí công việc">
              {filtered.slice(0, shown).map((p) => {
                const active = p.framework_id === selectedId;
                return (
                  <button
                    key={p.framework_id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`pf-position${active ? ' is-active' : ''}`}
                    onClick={() => onSelect(p.framework_id)}
                  >
                    <span className="pf-position-radio" aria-hidden="true" />
                    <span className="pf-position-body">
                      <span className="pf-position-title">{p.career_name}</span>
                      <span className="pf-position-tags">
                        <Badge size="sm" variant="info">{p.level_name}</Badge>
                        {targetIds.has(p.career_id) && <Badge size="sm" variant="highlight"><Target size={12} aria-hidden="true" /> Nghề mục tiêu</Badge>}
                      </span>
                      <span className="pf-position-meta">
                        {p.skill_count} kỹ năng yêu cầu · Cập nhật {new Date(p.updated_at).toLocaleDateString('vi-VN')}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {filtered.length > shown && (
              <div className="pf-more">
                <Button type="button" variant="outline" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                  Xem thêm ({filtered.length - shown})
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <aside className="pf-step-side">
        <Card title="Hồ sơ dùng để so sánh">
          <dl className="pf-facts">
            <div><dt><Layers size={16} aria-hidden="true" />Kỹ năng</dt><dd>{items.length}</dd></div>
            <div><dt><BadgeCheck size={16} aria-hidden="true" />Đã xác thực 360°</dt><dd>{verified}</dd></div>
            <div><dt><ClipboardList size={16} aria-hidden="true" />Đã tự chấm</dt><dd>{rated}</dd></div>
          </dl>
          <Button type="button" variant="outline" size="sm" block onClick={onOpenProfile}>Cập nhật hồ sơ năng lực</Button>
        </Card>

        {history.length > 0 && (
          <Card title="Lần phân tích gần đây">
            <ul className="pf-history">
              {history.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={`pf-history-item${entry.framework_id === selectedId ? ' is-active' : ''}`}
                    disabled={!entry.framework_id || !positions?.some((p) => p.framework_id === entry.framework_id)}
                    onClick={() => entry.framework_id && onSelect(entry.framework_id)}
                  >
                    <span className="pf-history-name">{entry.position_name}</span>
                    <span className="pf-history-meta">
                      <strong>{entry.overall_percent.toLocaleString('vi-VN')}%</strong>
                      {' · '}{new Date(entry.created_at).toLocaleDateString('vi-VN')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title="Cách đọc kết quả">
          <ul className="pf-legend">
            {STATUSES.map((status) => (
              <li key={status}>
                <Badge size="sm" variant={GAP_STATUS_VARIANT[status]}>{GAP_STATUS_LABEL[status]}</Badge>
                <span>{gapStatusHint(status, params.largeGapLevel)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="pf-analyse-bar">
          {selected && <span className="pf-analyse-target">{selected.career_name} · {selected.level_name}</span>}
          <Button type="button" size="lg" block leftIcon={<ScanSearch size={18} />} disabled={!selected} isLoading={analysing} onClick={onAnalyse}>
            Phân tích khoảng cách
          </Button>
        </div>
      </aside>
    </div>
  );
};
