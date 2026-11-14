import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bookmark, Briefcase, GitCompare, Search, SearchX, Sparkles, Target } from 'lucide-react';
import { Alert, Button, Input, PageHero, Pagination, SkeletonRegion, StickerCard, StickerCardSkeleton, StickerFact, StickerGrid, stickerToneAt } from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { readCareerCompare, toggleCareerCompare } from '../../../lib/selectionCart';
import { useAuth } from '../../auth/AuthContext';
import { useAdminFilter } from '../../admin/useAdminFilter';
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

export interface CareerFilter {
  keyword: string;
  fieldId: string;
  salary: string;
  growth: string;
  education: string;
  environment: string;
}

export const EMPTY_CAREER_FILTER: CareerFilter = {
  keyword: '',
  fieldId: '',
  salary: '',
  growth: '',
  education: '',
  environment: '',
};

export const CareerListPage: React.FC<{ publicCatalog?: boolean }> = ({ publicCatalog = false }) => {
  const { profile } = useAuth();
  const isLearner = profile?.role === 'student' || profile?.role === 'university_student';
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<'catalog' | 'fit'>('catalog');

  const [initialFilter] = useState<CareerFilter>(() => ({
    ...EMPTY_CAREER_FILTER,
    fieldId: searchParams.get('linh-vuc') ?? searchParams.get('fieldId') ?? '',
    keyword: searchParams.get('q') ?? '',
  }));

  const { draft, applied, patch, apply, reset } = useAdminFilter<CareerFilter>(EMPTY_CAREER_FILTER, initialFilter);
  const [fields, setFields] = useState<CareerFieldNode[]>([]);
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
    setPage(1);
  }, [applied]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const inField = (row: CareerListItem) =>
      !applied.fieldId || fieldAndDescendants(fields, applied.fieldId).has(row.career_field_id);

    (applied.keyword ? searchCareers(applied.keyword) : listPublishedCareers())
      .then(async (list) => {
        const allowed = await careerIdsMatchingFilters({
          salary: applied.salary,
          growth: applied.growth,
          education: applied.education,
          environment: applied.environment,
        });
        return list.filter((row) => inField(row) && (allowed === null || allowed.has(row.id)));
      })
      .then((list) => {
        if (!active) return;
        setRows(list);
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
      <FilterBar
        variant="sticker"
        onReset={reset}
        onSubmit={apply}
        isLoading={loading}
        totalResults={rows.length}
      >
        <div className="filter-item-search">
          <Input
            label="Tìm kiếm"
            placeholder="Tên nghề"
            leftIcon={<Search size={16} />}
            value={draft.keyword}
            onChange={(event) => patch({ keyword: event.target.value })}
          />
        </div>
        <SearchableSelect
          label="Lĩnh vực"
          placeholder="Tất cả lĩnh vực"
          options={fieldOptions}
          value={draft.fieldId}
          onChange={(value) => patch({ fieldId: value })}
        />
        <SearchableSelect
          label="Thang lương"
          placeholder="Tất cả"
          options={toOptions(choices.salaries)}
          value={draft.salary}
          onChange={(value) => patch({ salary: value })}
        />
        <SearchableSelect
          label="Mức tăng trưởng"
          placeholder="Tất cả"
          options={toOptions(choices.growth)}
          value={draft.growth}
          onChange={(value) => patch({ growth: value })}
        />
        <SearchableSelect
          label="Trình độ học vấn"
          placeholder="Tất cả"
          options={toOptions(choices.education)}
          value={draft.education}
          onChange={(value) => patch({ education: value })}
        />
        <SearchableSelect
          label="Môi trường làm việc"
          placeholder="Tất cả"
          options={toOptions(choices.environments)}
          value={draft.environment}
          onChange={(value) => patch({ environment: value })}
        />
      </FilterBar>

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
          <Button variant="outline" onClick={reset}>Đặt lại bộ lọc</Button>
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

  return (
    <div className="module-page career-page">
      <PageHero
        title={view === 'fit' ? 'Nghề phù hợp' : 'Nghề nghiệp'}
        icon={view === 'fit' ? <Sparkles /> : <Briefcase />}
        tone={view === 'fit' ? 'magenta' : 'blue'}
        count={view === 'catalog' && !loading ? rows.length : null}
        countLabel="nghề"
        actions={
          isLearner ? (
            <Button
              variant={view === 'fit' ? 'primary' : 'outline'}
              leftIcon={view === 'fit' ? <Briefcase size={16} /> : <Sparkles size={16} />}
              onClick={() => setView(view === 'fit' ? 'catalog' : 'fit')}
            >
              {view === 'fit' ? 'Tất cả nghề' : 'Nghề phù hợp'}
            </Button>
          ) : undefined
        }
      />
      {notice && <Alert variant="info">{notice}</Alert>}
      {view === 'fit' ? (
        <TopCareers picked={picked} onToggleCompare={toggleCompare} onBrowse={() => setView('catalog')} />
      ) : (
        catalog
      )}
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
      {isLearner && (
        <CompareSidebar picked={picked} open={compareOpen} onOpenChange={setCompareOpen} onRemove={toggleCompare} onClear={clearPicked} />
      )}
    </div>
  );
};
