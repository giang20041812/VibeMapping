import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, GitCompare, SlidersHorizontal, Sparkles, Target } from 'lucide-react';
import { Alert, Badge, Button, Pagination, Skeleton } from '../../../components/common';
import { FilterSearch } from '../../../components/filters/FilterSearch/FilterSearch';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { careerCompareReady, readCareerCompare, toggleCareerCompare } from '../../../lib/selectionCart';
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

  const toggleCompare = (id: string) => {
    const next = toggleCareerCompare(id);
    setPicked(next.ids);
    setNotice(next.message ?? null);
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
        {!loading && <span className="career-muted">{rows.length} nghề</span>}
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {loading ? (
        <ul className="career-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="career-card">
              <Skeleton shape="title" width={70} />
              <Skeleton shape="chip" width={40} />
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="fit-empty">
          <h2>Không có nghề khớp bộ lọc</h2>
          <Button variant="outline" onClick={() => setView('gate')}>Đổi bộ lọc</Button>
        </div>
      ) : (
        <>
          <ul className="career-grid">
            {visible.map((row) => (
              <li key={row.id} className="career-card">
                <Link to={careerHref(row.id)} className="career-card-title">{row.career_name}</Link>
                <div className="career-card-meta">
                  {row.holland_top3 && <Badge variant="info" size="sm">{interestLabel(row.holland_top3)}</Badge>}
                </div>
                {isLearner && (
                  <Button size="sm" variant={picked.includes(row.id) ? 'primary' : 'outline'} leftIcon={<GitCompare size={14} />} onClick={() => toggleCompare(row.id)}>
                    {picked.includes(row.id) ? 'Bỏ so sánh' : 'So sánh'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} />
        </>
      )}
    </>
  );

  const gate = (
    <div className="career-gate">
      <form className="career-gate-card" onSubmit={(event) => { event.preventDefault(); applyFilter(); }}>
        <h1>Khám phá ngành nghề</h1>
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
      <h1>Nghề nghiệp</h1>
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
      {view !== 'gate' && isLearner && picked.length > 0 && (
        <div className="compare-tray" role="status">
          <span>Đã chọn {picked.length}/4 nghề</span>
          <Button size="sm" variant="ghost" onClick={clearPicked}>Bỏ chọn</Button>
          <Link className="compare-tray-go" to={careerCompareReady(picked) ? `/nghe/so-sanh?ids=${picked.join(',')}` : '#'} aria-disabled={!careerCompareReady(picked)}>
            {careerCompareReady(picked) ? 'So sánh ngay' : 'Chọn thêm nghề'}
          </Link>
        </div>
      )}
    </div>
  );
};
