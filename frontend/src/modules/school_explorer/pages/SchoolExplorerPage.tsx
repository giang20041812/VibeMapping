import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, ExternalLink, Landmark, Layers, MapPin, School, Search, SearchX, Shapes } from 'lucide-react';
import {
  Alert,
  Badge,
  Input,
  PageHero,
  Pagination,
  Select,
  SkeletonRegion,
  StickerCard,
  StickerCardSkeleton,
  StickerFact,
  StickerGrid,
  stickerToneAt,
} from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import type { FilterOption } from '../../../types/filter';
import { useAdminFilter } from '../../admin/useAdminFilter';
import {
  DEGREE_OPTIONS,
  INSTITUTION_TYPE_LABEL,
  INSTITUTION_TYPE_OPTIONS,
  OWNERSHIP_LABEL,
  OWNERSHIP_OPTIONS,
  SCHOOL_PAGE_SIZE,
} from '../school_explorer.constants';
import {
  EMPTY_INSTITUTION_FILTER,
  listCityOptions,
  listFieldOptions,
  listInstitutions,
  listMajorOptions,
} from '../school_explorer.service';
import type { InstitutionFilter, InstitutionRow } from '../school_explorer.types';
import './SchoolExplorerPage.css';

export const SchoolExplorerPage: React.FC = () => {
  // Mở từ trang Ngành nghề: lọc sẵn theo ngành trong đường dẫn (?nganh=)
  const [searchParams] = useSearchParams();
  const [initialFilter] = useState<InstitutionFilter>(() => ({ ...EMPTY_INSTITUTION_FILTER, majorId: searchParams.get('nganh') ?? '' }));
  const { draft, applied, patch, apply, reset } = useAdminFilter<InstitutionFilter>(EMPTY_INSTITUTION_FILTER, initialFilter);
  const [cities, setCities] = useState<FilterOption[]>([]);
  const [fields, setFields] = useState<FilterOption[]>([]);
  const [majors, setMajors] = useState<FilterOption[]>([]);
  const [rows, setRows] = useState<InstitutionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listCityOptions(), listFieldOptions(), listMajorOptions()])
      .then(([cityOptions, fieldOptions, majorOptions]) => {
        setCities(cityOptions);
        setFields(fieldOptions);
        setMajors(majorOptions);
      })
      .catch(() => setError('Không tải được các mục lọc.'));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [applied]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    listInstitutions(applied, page)
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
        setError(null);
      })
      .catch(() => active && setError('Không tải được danh sách trường.'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [applied, page]);

  return (
    <>
      <PageHero title="Khám phá trường" icon={<School />} tone="teal" count={isLoading ? null : total} countLabel="trường" />

      {error && (
        <div className="school-explorer-alert">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      <FilterBar variant="sticker" onReset={reset} onSubmit={apply} isLoading={isLoading} totalResults={total}>
        <div className="filter-item-search">
          <Input
            label="Tìm kiếm"
            placeholder="Tên trường"
            leftIcon={<Search size={16} />}
            value={draft.keyword}
            onChange={(event) => patch({ keyword: event.target.value })}
          />
        </div>
        <SearchableSelect label="Ngành" placeholder="Tất cả" options={majors} value={draft.majorId} onChange={(value) => patch({ majorId: value })} />
        <SearchableSelect label="Tỉnh/thành" placeholder="Tất cả" options={cities} value={draft.city} onChange={(value) => patch({ city: value })} />
        <SearchableSelect label="Lĩnh vực" placeholder="Tất cả" options={fields} value={draft.fieldId} onChange={(value) => patch({ fieldId: value })} />
        <Select
          label="Loại hình"
          emptyLabel="Tất cả"
          options={OWNERSHIP_OPTIONS}
          value={draft.ownership}
          onChange={(value) => patch({ ownership: value as InstitutionFilter['ownership'] })}
        />
        <Select
          label="Loại cơ sở"
          emptyLabel="Tất cả"
          options={INSTITUTION_TYPE_OPTIONS}
          value={draft.institutionType}
          onChange={(value) => patch({ institutionType: value as InstitutionFilter['institutionType'] })}
        />
        <Select
          label="Bậc đào tạo"
          emptyLabel="Tất cả"
          options={DEGREE_OPTIONS}
          value={draft.degreeLevel}
          onChange={(value) => patch({ degreeLevel: value as InstitutionFilter['degreeLevel'] })}
        />
        <Input
          label="Học phí từ (triệu/kỳ)"
          inputMode="decimal"
          value={draft.tuitionMin}
          onChange={(event) => patch({ tuitionMin: event.target.value })}
        />
        <Input
          label="Học phí đến (triệu/kỳ)"
          inputMode="decimal"
          value={draft.tuitionMax}
          onChange={(event) => patch({ tuitionMax: event.target.value })}
        />
      </FilterBar>

      {isLoading ? (
        <SkeletonRegion>
          <StickerGrid>
            {Array.from({ length: 8 }, (_, i) => <StickerCardSkeleton key={i} />)}
          </StickerGrid>
        </SkeletonRegion>
      ) : rows.length === 0 ? (
        <div className="sticker-empty">
          <SearchX size={40} aria-hidden="true" />
          Không có trường phù hợp
        </div>
      ) : (
        <StickerGrid label="Danh sách trường">
          {rows.map((row, index) => (
            <StickerCard
              key={row.id}
              tone={stickerToneAt(index)}
              icon={<Landmark size={22} />}
              title={<Link to={`/kham-pha-truong/truong/${row.id}`}>{row.institution_name}</Link>}
              corner={
                row.website_url && (
                  <a className="school-explorer-web" href={row.website_url} target="_blank" rel="noopener noreferrer" aria-label={`Website ${row.institution_name}`}>
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                )
              }
              footer={
                <>
                  <StickerFact icon={<Layers size={14} />} strong>
                    {row.program_count} chương trình
                  </StickerFact>
                  {row.ownership && <Badge variant={row.ownership === 'public' ? 'info' : 'default'}>{OWNERSHIP_LABEL[row.ownership]}</Badge>}
                </>
              }
            >
              <StickerFact icon={<Building2 size={14} />}>{INSTITUTION_TYPE_LABEL[row.institution_type]}</StickerFact>
              {row.city && <StickerFact icon={<MapPin size={14} />}>{row.city}</StickerFact>}
              {row.field_name && <StickerFact icon={<Shapes size={14} />}>{row.field_name}</StickerFact>}
            </StickerCard>
          ))}
        </StickerGrid>
      )}

      {total > 0 && (
        <div className="sticker-pagination">
          <Pagination page={page} pageSize={SCHOOL_PAGE_SIZE} total={total} onChange={setPage} disabled={isLoading} />
        </div>
      )}
    </>
  );
};
