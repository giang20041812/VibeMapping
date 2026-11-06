import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookMarked, Check, ExternalLink, GraduationCap, Landmark, Layers, MapPin, Plus, Search, Wallet } from 'lucide-react';
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  DataTable,
  Input,
  PageHero,
  Select,
  Skeleton,
  SkeletonRegion,
  StatTile,
  type DataTableColumn,
} from '../../../components/common';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { normalizeSearchText } from '../../../lib/searchText';
import { readProgramCompare } from '../../../lib/selectionCart';
import type { FilterOption } from '../../../types/filter';
import { useAdminFilter } from '../../admin/useAdminFilter';
import { addProgramToDecisionCompare } from '../compareProgram';
import { INSTITUTION_TYPE_LABEL, OWNERSHIP_LABEL } from '../school_explorer.constants';
import { formatTuition, loadCareerMap, loadInstitution, loadMajor, loadProgram, programVariant, type ProgramSummary } from '../education.service';
import '../../career_explorer/pages/CareerPages.css';
import './EducationDetailPages.css';

const RESEARCH_LABEL: Record<string, string> = {
  verified: 'Đã xác minh',
  partially_verified: 'Xác minh một phần',
  supplemented: 'Đã bổ sung',
  needs_supplement: 'Cần bổ sung',
  unverified: 'Chưa xác minh',
};

function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError(null);
    load().then((value) => active && setData(value)).catch(() => active && setError('Không tải được dữ liệu.'));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error };
}

const DetailSkeleton: React.FC = () => (
  <SkeletonRegion>
    <Skeleton shape="title" width={40} />
    <Skeleton shape="block" />
    <Skeleton shape="block" />
  </SkeletonRegion>
);

interface ProgramFilter {
  keyword: string;
  programType: string;
  faculty: string;
  city: string;
  tuitionMax: string;
}

const EMPTY_PROGRAM_FILTER: ProgramFilter = { keyword: '', programType: '', faculty: '', city: '', tuitionMax: '' };
const COMPARE_MAX = 4;

const uniqueOptions = (values: (string | null)[]): FilterOption[] =>
  [...new Set(values.filter((v): v is string => Boolean(v)))]
    .sort((a, b) => a.localeCompare(b, 'vi'))
    .map((value) => ({ value, label: value }));

function matchesProgram(p: ProgramSummary, f: ProgramFilter, show: 'institution' | 'major'): boolean {
  const key = normalizeSearchText(f.keyword);
  const haystack = normalizeSearchText(`${show === 'institution' ? p.institutionName : p.majorName} ${programVariant(p)}`);
  if (key && !haystack.includes(key)) return false;
  if (f.programType && p.programType !== f.programType) return false;
  if (f.faculty && p.faculty !== f.faculty) return false;
  if (f.city && p.city !== f.city) return false;
  const max = Number(f.tuitionMax.replace(',', '.'));
  if (f.tuitionMax.trim() && max > 0 && (p.tuitionMin === null || p.tuitionMin > max * 1_000_000)) return false;
  return true;
}

const ProgramList: React.FC<{ programs: ProgramSummary[]; show: 'institution' | 'major'; careerId?: string }> = ({ programs, show, careerId }) => {
  const { draft, applied, patch, apply, reset } = useAdminFilter<ProgramFilter>(EMPTY_PROGRAM_FILTER);
  const [added, setAdded] = useState<string[]>(() => readProgramCompare().map((item) => item.programId));
  const [notice, setNotice] = useState<string | null>(null);

  const typeOptions = useMemo(() => uniqueOptions(programs.map((p) => p.programType)), [programs]);
  const facultyOptions = useMemo(() => uniqueOptions(programs.map((p) => p.faculty)), [programs]);
  const cityOptions = useMemo(() => uniqueOptions(programs.map((p) => p.city)), [programs]);
  const rows = useMemo(() => programs.filter((p) => matchesProgram(p, applied, show)), [programs, applied, show]);

  const add = (p: ProgramSummary) => {
    const next = addProgramToDecisionCompare(p, { careerId });
    setAdded(next.items.map((item) => item.programId));
    setNotice(next.message ?? null);
  };

  const columns: DataTableColumn<ProgramSummary>[] = [
    {
      key: 'name',
      header: show === 'institution' ? 'Trường' : 'Ngành',
      render: (p) => (
        <>
          <Link to={`/kham-pha-truong/chuong-trinh/${p.id}`}>{show === 'institution' ? p.institutionName : p.majorName}</Link>
          {programVariant(p) && <div className="program-row-sub">{programVariant(p)}</div>}
        </>
      ),
    },
    ...(show === 'institution' ? [{ key: 'city', header: 'Tỉnh/thành', nowrap: true, render: (p: ProgramSummary) => p.city ?? '–' }] : []),
    { key: 'type', header: 'Hệ đào tạo', nowrap: true, render: (p) => p.programType ?? '–' },
    { key: 'tuition', header: 'Học phí', nowrap: true, render: (p) => formatTuition(p) },
    {
      key: 'status',
      header: 'Dữ liệu',
      nowrap: true,
      render: (p) => <Badge variant={p.researchStatus === 'verified' ? 'success' : 'default'}>{RESEARCH_LABEL[p.researchStatus] ?? p.researchStatus}</Badge>,
    },
    {
      key: 'compare',
      header: '',
      nowrap: true,
      render: (p) =>
        added.includes(p.id) ? (
          <Button type="button" size="sm" variant="secondary" disabled leftIcon={<Check size={14} />}>Đã thêm</Button>
        ) : (
          <Button type="button" size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => add(p)}>So sánh</Button>
        ),
    },
  ];

  return (
    <div className="program-list">
      <FilterBar variant="sticker" onReset={reset} onSubmit={apply} totalResults={rows.length}>
        <div className="filter-item-search">
          <Input
            label="Tìm kiếm"
            placeholder={show === 'institution' ? 'Tên trường' : 'Tên ngành'}
            leftIcon={<Search size={16} />}
            value={draft.keyword}
            onChange={(event) => patch({ keyword: event.target.value })}
          />
        </div>
        {typeOptions.length > 1 && <Select label="Hệ đào tạo" emptyLabel="Tất cả" options={typeOptions} value={draft.programType} onChange={(value) => patch({ programType: value })} />}
        {facultyOptions.length > 1 && <SearchableSelect label="Khoa" placeholder="Tất cả" options={facultyOptions} value={draft.faculty} onChange={(value) => patch({ faculty: value })} />}
        {show === 'institution' && cityOptions.length > 1 && <SearchableSelect label="Tỉnh/thành" placeholder="Tất cả" options={cityOptions} value={draft.city} onChange={(value) => patch({ city: value })} />}
        <Input label="Học phí tối đa (triệu/kỳ)" inputMode="decimal" value={draft.tuitionMax} onChange={(event) => patch({ tuitionMax: event.target.value })} />
      </FilterBar>

      {notice && <Alert variant="info">{notice}</Alert>}
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(p) => p.id}
        emptyText={programs.length === 0 ? 'Đang cập nhật chương trình đào tạo' : 'Không có chương trình phù hợp'}
      />

      {added.length > 0 && (
        <div className="program-compare-bar" role="region" aria-label="Phương án so sánh">
          <span><b>{added.length}/{COMPARE_MAX}</b> phương án đã chọn</span>
          <Link className="app-button btn-primary btn-md" to="/so-sanh"><span className="btn-text">Mở so sánh phương án</span></Link>
        </div>
      )}
    </div>
  );
};

const tuitionRange = (programs: ProgramSummary[]): string => {
  const lows = programs.map((p) => p.tuitionMin).filter((v): v is number => v !== null);
  if (lows.length === 0) return 'Đang cập nhật';
  const fmt = (v: number) => (v / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  const low = Math.min(...lows);
  const high = Math.max(...programs.map((p) => p.tuitionMax ?? p.tuitionMin ?? 0));
  return low === high ? `${fmt(low)} triệu` : `${fmt(low)}–${fmt(high)} triệu`;
};

export const InstitutionDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const { data, error } = useLoad(() => loadInstitution(id), [id]);
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!data) return <DetailSkeleton />;
  if (!data.institution) return <Alert variant="info">Không tìm thấy trường.</Alert>;
  const inst = data.institution;
  const majorCount = new Set(data.programs.map((p) => p.majorId)).size;
  const address = [inst.address, inst.city].filter(Boolean).join(', ');
  return (
    <div className="module-page school-detail">
      <Breadcrumb items={[{ label: 'Khám phá trường', to: '/kham-pha-truong' }, { label: inst.institution_name }]} />
      <PageHero
        title={inst.institution_name}
        icon={<Landmark />}
        tone="teal"
        actions={
          inst.website_url ? (
            <a className="app-button btn-outline btn-md" href={inst.website_url} target="_blank" rel="noopener noreferrer">
              <span className="btn-icon-left"><ExternalLink size={16} aria-hidden="true" /></span>
              <span className="btn-text">Website</span>
            </a>
          ) : undefined
        }
      />
      <div className="school-meta">
        <Badge variant="info">{INSTITUTION_TYPE_LABEL[inst.institution_type as keyof typeof INSTITUTION_TYPE_LABEL] ?? inst.institution_type}</Badge>
        {inst.ownership && <Badge>{OWNERSHIP_LABEL[inst.ownership as keyof typeof OWNERSHIP_LABEL] ?? inst.ownership}</Badge>}
        <span className="school-address"><MapPin size={16} aria-hidden="true" />{address || 'Địa chỉ đang cập nhật'}</span>
      </div>
      <div className="school-facts">
        <StatTile label="Chương trình" tone="blue" icon={<Layers />} value={data.programs.length} />
        <StatTile label="Ngành" tone="violet" icon={<BookMarked />} value={majorCount} />
        <StatTile label="Học phí mỗi kỳ" tone="gold" icon={<Wallet />} value={tuitionRange(data.programs)} />
      </div>
      <Card title="Chương trình đào tạo">
        <ProgramList programs={data.programs} show="major" />
      </Card>
    </div>
  );
};

export const MajorDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const { data, error } = useLoad(() => loadMajor(id), [id]);
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!data) return <DetailSkeleton />;
  if (!data.major) return <Alert variant="info">Không tìm thấy ngành.</Alert>;
  return (
    <div className="module-page">
      <Breadcrumb items={[{ label: 'Khám phá trường', to: '/kham-pha-truong' }, { label: data.major.major_name }]} />
      <PageHero title={`Ngành ${data.major.major_name}`} icon={<GraduationCap />} tone="violet" />
      <Card title="Nghề liên quan">
        {data.careers.length === 0 ? <p>Đang cập nhật liên kết nghề.</p> : (
          <ul className="module-list">
            {data.careers.map((c) => (
              <li key={c.id}><Link to={`/nghe/${c.id}`}>{c.name}</Link><Badge>{c.level === 'direct' ? 'Trực tiếp' : 'Gián tiếp'}</Badge></li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Trường đào tạo">
        <ProgramList programs={data.programs} show="institution" />
      </Card>
    </div>
  );
};

export const ProgramDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const { data, error } = useLoad(() => loadProgram(id), [id]);
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (data === undefined) return <DetailSkeleton />;
  if (data === null) return <Alert variant="info">Không tìm thấy chương trình.</Alert>;
  const p = data.program;
  return (
    <div className="module-page">
      <Breadcrumb
        items={[
          { label: 'Khám phá trường', to: '/kham-pha-truong' },
          { label: p.institutionName, to: `/kham-pha-truong/truong/${p.institutionId}` },
          { label: p.majorName },
        ]}
      />
      <PageHero
        title={`${p.majorName}${p.specialization ? ` – ${p.specialization}` : ''}`}
        icon={<GraduationCap />}
        tone="violet"
        actions={
          <Link className="app-button btn-outline btn-md" to={`/kham-pha-truong/nganh/${p.majorId}`}>
            <span className="btn-text">Xem ngành {p.majorName}</span>
          </Link>
        }
      />
      <Card title="Chương trình">
        <ul className="module-list">
          <li><span>Hệ đào tạo</span><span>{p.programType ?? 'Đang cập nhật'}</span></li>
          <li><span>Khoa</span><span>{data.faculty ?? 'Đang cập nhật'}</span></li>
          <li><span>Thời gian</span><span>{data.studyYears ? `${data.studyYears} năm` : 'Đang cập nhật'}</span></li>
          <li><span>Học phí</span><span>{formatTuition(p)}</span></li>
          <li><span>Trạng thái dữ liệu</span><Badge>{RESEARCH_LABEL[p.researchStatus] ?? p.researchStatus}</Badge></li>
        </ul>
        {data.summary && <p>{data.summary}</p>}
        {data.url && <a href={data.url} target="_blank" rel="noopener noreferrer">Trang chương trình <ExternalLink size={14} aria-hidden="true" /></a>}
        {data.source && <p className="explain-note">Nguồn: {data.source}</p>}
        <AddProgramButton program={p} admission={data.admissions} />
      </Card>
      <Card title="Tuyển sinh và điểm chuẩn lịch sử">
        {data.admissions.length === 0 ? (
          <Alert variant="info">Đang cập nhật dữ liệu tuyển sinh. Bộ dữ liệu nghiên cứu hiện có chưa gồm điểm chuẩn và chỉ tiêu.</Alert>
        ) : (
          <div className="explain-table-wrap">
            <table className="explain-table">
              <thead><tr><th>Năm</th><th>Phương thức</th><th>Tổ hợp</th><th>Chỉ tiêu</th><th>Điểm chuẩn</th><th>Ngưỡng đăng ký</th><th>Nguồn</th></tr></thead>
              <tbody>
                {data.admissions.map((a, index) => (
                  <tr key={`${a.year}-${a.method}-${index}`}>
                    <td>{a.year}</td><td>{a.method}</td><td>{a.subjectCombination ?? '–'}</td><td>{a.quota ?? '–'}</td>
                    <td>{a.cutoffScore ?? '–'}</td><td>{a.minimumScore ?? '–'}</td>
                    <td>{a.sourceUrl ? <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer">Xem</a> : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="explain-note">Điểm chuẩn lịch sử chỉ để tham khảo, không cam kết trúng tuyển.</p>
      </Card>
    </div>
  );
};

type MapPick =
  | { kind: 'career'; name: string }
  | { kind: 'major'; id: string; name: string; verified: boolean }
  | { kind: 'program'; program: ProgramSummary };

/** F05.02: bản đồ liên kết; click node xem card tại chỗ; màn hẹp xếp danh mục */
export const CareerEducationMapPage: React.FC = () => {
  const { careerId = '' } = useParams();
  const { data, error } = useLoad(() => loadCareerMap(careerId), [careerId]);
  const [pick, setPick] = useState<MapPick | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!data) return <DetailSkeleton />;
  if (!data.career) return <Alert variant="info">Không tìm thấy nghề hoặc nghề chưa được công bố.</Alert>;
  return (
    <div className="module-page">
      <p><Link to={`/nghe/${careerId}`}>Quay lại nghề</Link></p>
      <h1>Bản đồ Liên kết Trực quan: Nghề – Ngành – Trường</h1>
      {notice && <Alert variant="info">{notice}</Alert>}
      <div className="edu-map">
        <button type="button" className="edu-map-node edu-map-career" onClick={() => setPick({ kind: 'career', name: data.career!.career_name })}>
          {data.career.career_name}
        </button>
        {data.majors.length === 0 && <Alert variant="info">Đang cập nhật ngành đào tạo cho nghề này.</Alert>}
        <ul className="edu-map-majors">
          {data.majors.map((m) => (
            <li key={m.id}>
              <button type="button" className="edu-map-node edu-map-major" onClick={() => setPick({ kind: 'major', id: m.id, name: m.name, verified: m.verified })}>
                {m.name} {!m.verified && <Badge>Chưa xác minh</Badge>}
              </button>
              {m.programs.length === 0 ? <p className="explain-note">Đang cập nhật trường đào tạo.</p> : (
                <ul className="edu-map-schools">
                  {m.programs.slice(0, 12).map((p) => (
                    <li key={p.id}>
                      <button type="button" className="edu-map-node edu-map-school" onClick={() => setPick({ kind: 'program', program: p })}>
                        {p.institutionName}
                      </button>
                    </li>
                  ))}
                  {m.programs.length > 12 && <li><Link to={`/kham-pha-truong/nganh/${m.id}`}>Xem thêm {m.programs.length - 12} trường</Link></li>}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
      {pick && (
        <Card title={pick.kind === 'career' ? pick.name : pick.kind === 'major' ? pick.name : pick.program.institutionName}>
          {pick.kind === 'career' && (
            <p><Link to={`/nghe/${careerId}`}>Mở trang nghề</Link></p>
          )}
          {pick.kind === 'major' && (
            <p>
              {pick.verified ? 'Liên kết đã xác minh.' : 'Chưa xác minh.'}{' '}
              <Link to={`/kham-pha-truong/nganh/${pick.id}`}>Mở trang ngành</Link>
            </p>
          )}
          {pick.kind === 'program' && (
            <>
              <p>{pick.program.majorName} · {formatTuition(pick.program)}</p>
              <div className="module-actions">
                <Link to={`/kham-pha-truong/chuong-trinh/${pick.program.id}`}>Mở chương trình</Link>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const next = addProgramToDecisionCompare(pick.program, { careerId });
                    setNotice(next.message ?? 'Đã thêm vào so sánh phương án.');
                  }}
                >
                  Thêm vào so sánh
                </Button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
};

const AddProgramButton: React.FC<{ program: ProgramSummary; admission?: import('../education.service').AdmissionRow[] }> = ({ program, admission }) => {
  const [text, setText] = useState<string | null>(null);
  return (
    <div className="module-actions">
      <Button
        type="button"
        onClick={() => {
          const next = addProgramToDecisionCompare(program, { admission });
          setText(next.message ?? 'Đã thêm. Mở So sánh phương án để xếp hạng.');
        }}
      >
        Thêm vào so sánh
      </Button>
      <Link to="/so-sanh">Mở so sánh phương án</Link>
      {text && <span className="explain-note">{text}</span>}
    </div>
  );
};
