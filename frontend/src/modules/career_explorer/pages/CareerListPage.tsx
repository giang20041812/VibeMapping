import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Briefcase, GitCompare, Compass, SearchX, SlidersHorizontal, Sparkles, Target } from 'lucide-react';
import { Alert, Button, PageHero, Pagination, SkeletonRegion, StickerCard, StickerCardSkeleton, StickerFact, StickerGrid, stickerToneAt } from '../../../components/common';
import { FilterSearch } from '../../../components/filters/FilterSearch/FilterSearch';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { readCareerCompare, toggleCareerCompare } from '../../../lib/selectionCart';
import { useAuth } from '../../auth/AuthContext';
import {
  careerIdsMatchingFilters,
  fieldAndDescendants,
  listPublishedCareers,
  listSavedCareers,
  loadCareerFields,
  removeCareerBookmark,
  loadCareerFilterChoices,
  searchCareers,
  type CareerBookmarkKind,
  type CareerFieldNode,
  type CareerListItem,
  type SavedCareer,
} from '../career.service';
import { interestLabel } from '../careerFit.constants';
import { TopCareers } from '../components/TopCareers';
import { CompareSidebar } from '../components/CompareSidebar';
import './CareerPages.css';
import './CareerFit.css';

const PAGE_SIZE = 24;
const EMPTY_FILTERS = { salary: '', growth: '', education: '', environment: '' };
interface AppliedFilter { query: string; fieldId: string; filters: typeof EMPTY_FILTERS }

export const CareerListPage: React.FC<{ publicCatalog?: boolean }> = ({ publicCatalog = false }) => {
  const { profile } = useAuth();
  const isLearner = profile?.role === 'student' || profile?.role === 'university_student';
  const [view, setView] = useState<'gate' | 'catalog' | 'fit'>('gate');
  const [applied, setApplied] = useState<AppliedFilter | null>(null);
  const [draft, setDraft] = useState('');
  const [fields, setFields] = useState<CareerFieldNode[]>([]);
  const [fieldId, setFieldId] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [choices, setChoices] = useState({ salaries: [] as string[], growth: [] as string[], education: [] as string[], environments: [] as string[] });
  const [rows, setRows] = useState<CareerListItem[]>([]);
  const [saved, setSaved] = useState<SavedCareer[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>(() => readCareerCompare());
  const [notice, setNotice] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const toggleCompare = (id: string) => {
    const next = toggleCareerCompare(id);
    setPicked(next.ids);
    setNotice(next.message ?? null);
    if (next.ids.includes(id)) setCompareOpen(true);
  };

  useEffect(() => {
    let active = true;
    loadCareerFields().then((value) => active && setFields(value)).catch(() => active && setFields([]));
    loadCareerFilterChoices().then((value) => active && setChoices(value)).catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isLearner) return;
    let active = true;
    listSavedCareers().then((value) => active && setSaved(value ?? [])).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isLearner]);

  useEffect(() => {
    if (!applied) return;
    const { query, fieldId, filters } = applied;
    let active = true;
    setLoading(true);
    const inField = (row: CareerListItem) => !fieldId || fieldAndDescendants(fields, fieldId).has(row.career_field_id);
    (query ? searchCareers(query) : fieldId ? listPublishedCareers() : searchCareers(''))
      .then(async (list) => {
        const allowed = await careerIdsMatchingFilters(filters);
        return list.filter((row) => inField(row) && (allowed === null || allowed.has(row.id)));
      })
      .then((list) => {
        if (!active) return;
        setRows(list);
        setPage(1);
        setError(null);
      })
      .catch(() => active && setError('Không tải được danh sách nghề.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [applied, fields]);

  const fieldOptions = useMemo(
    () => [{ value: '', label: 'Tất cả lĩnh vực' }, ...fields.filter((f) => !f.parent_field_id).map((f) => ({ value: f.id, label: f.field_name }))],
    [fields],
  );
  const toOptions = (values: string[]) => [{ value: '', label: 'Tất cả' }, ...values.map((value) => ({ value, label: value }))];
  const resetDraft = () => {
    setDraft('');
    setFieldId('');
    setFilters(EMPTY_FILTERS);
  };
  const applyFilter = () => {
    setApplied({ query: draft.trim(), fieldId, filters });
    setView('catalog');
  };
  const activeCount = applied ? [applied.query, applied.fieldId, ...Object.values(applied.filters)].filter(Boolean).length : 0;
  const careerHref = (id: string) => (publicCatalog ? `/danh-muc-nghe/${id}` : `/nghe/${id}`);
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const targets = saved.filter((item) => item.kind === 'target');
  const interested = saved.filter((item) => item.kind !== 'target');
  const unmark = async (careerId: string, kind: CareerBookmarkKind) => {
    try {
      await removeCareerBookmark(careerId, kind);
      setSaved(await listSavedCareers());
      setNotice(kind === 'target' ? 'Đã bỏ nghề mục tiêu.' : 'Đã bỏ lưu nghề.');
    } catch {
      setNotice('Không cập nhật được nghề đã lưu.');
    }
  };
  const mineList = (items: SavedCareer[], kind: CareerBookmarkKind) => (
    <ul>
      {items.map((item) => (
        <li key={item.career_id} className="career-mine-item">
          <Link to={careerHref(item.career_id)}>{item.career_name}</Link>
          <Button size="sm" variant="ghost" onClick={() => void unmark(item.career_id, kind)}>{kind === 'target' ? 'Bỏ mục tiêu' : 'Bỏ lưu'}</Button>
        </li>
      ))}
    </ul>
  );
  const clearPicked = () => {
    picked.forEach((id) => toggleCareerCompare(id));
    setPicked(readCareerCompare());
  };

  const catalog = (
    <>
      <div className="career-filter-summary">
        <Button variant="outline" leftIcon={<SlidersHorizontal size={16} />} onClick={() => setView('gate')}>
          {activeCount > 0 ? `Bộ lọc (${activeCount})` : 'Bộ lọc'}
        </Button>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {loading ? (
        <SkeletonRegion>
          <StickerGrid>
            {Array.from({ length: 8 }, (_, i) => <StickerCardSkeleton key={i} />)}
          </StickerGrid>
        </SkeletonRegion>
      ) : rows.length === 0 ? (
        <div className="sticker-empty">
          <SearchX size={40} aria-hidden="true" />
          Không có nghề khớp bộ lọc
          <Button variant="outline" onClick={() => setView('gate')}>Đổi bộ lọc</Button>
        </div>
      ) : (
        <>
          <StickerGrid label="Danh sách nghề">
            {visible.map((row, index) => (
              <StickerCard
                key={row.id}
                tone={stickerToneAt(index)}
                icon={<Briefcase size={22} />}
                title={<Link to={careerHref(row.id)}>{row.career_name}</Link>}
                footer={isLearner ? (
                  <Button size="sm" variant={picked.includes(row.id) ? 'primary' : 'outline'} leftIcon={<GitCompare size={14} />} onClick={() => toggleCompare(row.id)}>
                    {picked.includes(row.id) ? 'Bỏ so sánh' : 'So sánh'}
                  </Button>
                ) : undefined}
              >
                {row.holland_top3 && <StickerFact icon={<Sparkles size={14} />} strong>{interestLabel(row.holland_top3)}</StickerFact>}
              </StickerCard>
            ))}
          </StickerGrid>
          <div className="sticker-pagination">
          <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} />
          </div>
        </>
      )}
    </>
  );

  const gate = (
    <div className="career-gate">
      <form className="career-gate-card" onSubmit={(event) => { event.preventDefault(); applyFilter(); }}>
        <div className="career-gate-head">
          <span className="career-gate-icon" aria-hidden="true"><Compass size={28} /></span>
          <h1>Khám phá ngành nghề</h1>
        </div>
        <div className="career-filter-form">
          <FilterSearch placeholder="Tên nghề" value={draft} onChange={setDraft} />
          <SearchableSelect label="Lĩnh vực" options={fieldOptions} value={fieldId} onChange={setFieldId} />
          <SearchableSelect label="Thang lương" options={toOptions(choices.salaries)} value={filters.salary} onChange={(value) => setFilters((c) => ({ ...c, salary: value }))} />
          <SearchableSelect label="Mức tăng trưởng" options={toOptions(choices.growth)} value={filters.growth} onChange={(value) => setFilters((c) => ({ ...c, growth: value }))} />
          <SearchableSelect label="Trình độ học vấn" options={toOptions(choices.education)} value={filters.education} onChange={(value) => setFilters((c) => ({ ...c, education: value }))} />
          <SearchableSelect label="Môi trường làm việc" options={toOptions(choices.environments)} value={filters.environment} onChange={(value) => setFilters((c) => ({ ...c, environment: value }))} />
        </div>
        <div className="career-gate-actions">
          {isLearner && <Button type="button" variant="outline" leftIcon={<Sparkles size={16} />} onClick={() => setView('fit')}>Nghề phù hợp</Button>}
          <Button type="button" variant="ghost" onClick={resetDraft}>Đặt lại</Button>
          <Button type="submit">Áp dụng</Button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="module-page career-page">
      {view === 'gate' ? gate : (
        <>
      <PageHero title="Nghề nghiệp" icon={<Briefcase />} tone="blue" count={view === 'catalog' && !loading ? rows.length : null} countLabel="nghề" />
      {notice && <Alert variant="info">{notice}</Alert>}
      {view === 'fit' ? (
        <>
          <div className="career-filter-summary">
            <Button variant="outline" leftIcon={<SlidersHorizontal size={16} />} onClick={() => setView('gate')}>Bộ lọc</Button>
          </div>
          <TopCareers picked={picked} onToggleCompare={toggleCompare} onBrowse={() => setView('gate')} />
        </>
      ) : catalog}
      {isLearner && (
        <section className="career-mine">
          <h2>Nghề của tôi</h2>
          <div className="career-mine-grid">
            <div className="career-mine-block">
              <h3><Target size={16} aria-hidden="true" /> Nghề mục tiêu</h3>
              {targets.length === 0 ? <p className="career-muted">Chưa chọn nghề mục tiêu</p> : mineList(targets, 'target')}
            </div>
            <div className="career-mine-block">
              <h3><Bookmark size={16} aria-hidden="true" /> Nghề quan tâm</h3>
              {interested.length === 0 ? <p className="career-muted">Chưa lưu nghề nào</p> : mineList(interested, 'saved')}
            </div>
          </div>
        </section>
      )}
        </>
      )}
      {view !== 'gate' && isLearner && (
        <CompareSidebar picked={picked} open={compareOpen} onOpenChange={setCompareOpen} onRemove={toggleCompare} onClear={clearPicked} />
      )}
    </div>
  );
};
