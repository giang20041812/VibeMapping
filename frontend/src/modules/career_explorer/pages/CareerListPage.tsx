import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Card, Input, Select, Spinner } from '../../../components/common';
import { careerCompareReady, readCareerCompare, toggleCareerCompare } from '../../../lib/selectionCart';
import { useAuth } from '../../auth/AuthContext';
import {
  careerIdsMatchingFilters,
  fieldAndDescendants,
  listPublishedCareers,
  loadCareerFields,
  loadCareerFilterChoices,
  searchCareers,
  listSavedCareers,
  type CareerFieldNode,
  type CareerListItem,
} from '../career.service';
import { TopCareers } from '../components/TopCareers';
import './CareerPages.css';

export const CareerListPage: React.FC<{ publicCatalog?: boolean }> = ({ publicCatalog = false }) => {
  const { profile } = useAuth();
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [fields, setFields] = useState<CareerFieldNode[]>([]);
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ salary: '', growth: '', education: '', environment: '' });
  const [choices, setChoices] = useState({ salaries: [] as string[], growth: [] as string[], education: [] as string[], environments: [] as string[] });
  const [rows, setRows] = useState<CareerListItem[]>([]);
  const [saved, setSaved] = useState<Array<{ career_id: string; kind: string; career_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>(() => readCareerCompare());
  const [notice, setNotice] = useState<string | null>(null);
  const isLearner = profile?.role === 'student' || profile?.role === 'university_student';

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
    let active = true;
    setLoading(true);
    const careers = (query
      ? searchCareers(query)
      : fieldId
        ? listPublishedCareers().then((all) => all.filter((row) => fieldAndDescendants(fields, fieldId).has(row.career_field_id)))
        : searchCareers('')
    ).then(async (found) => {
      const allowed = await careerIdsMatchingFilters(filters);
      return allowed === null ? found : found.filter((row) => allowed.has(row.id));
    });
    Promise.all([careers, isLearner ? listSavedCareers().catch(() => []) : Promise.resolve([])])
      .then(([found, bookmarks]) => {
        if (!active) return;
        setRows(found);
        setSaved(bookmarks ?? []);
        setError(null);
      })
      .catch(() => active && setError('Không tải được danh sách nghề.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query, fieldId, fields, filters, isLearner]);

  const roots = fields.filter((field) => !field.parent_field_id);
  const children = fields.filter((field) => field.parent_field_id === fieldId);
  const careerHref = (id: string) => (publicCatalog ? `/danh-muc-nghe/${id}` : `/nghe/${id}`);

  return (
    <div className="module-page">
      <h1>Nghề nghiệp</h1>
      {isLearner && <TopCareers />}
      {notice && <Alert variant="info">{notice}</Alert>}
      {isLearner && picked.length > 0 && (
        <Alert variant="info">
          Đã chọn {picked.length}/4 nghề để so sánh.{' '}
          {careerCompareReady(picked) ? <Link to={`/nghe/so-sanh?ids=${picked.join(',')}`}>Mở bảng so sánh</Link> : 'Chọn thêm nghề (cần 2–4 nghề).'}
        </Alert>
      )}
      <Card title="Cây danh mục">
        <div className="module-form">
          {roots.map((field) => (
            <Button key={field.id} type="button" size="sm" variant={fieldId === field.id ? 'primary' : 'outline'} onClick={() => { setFieldId(field.id); setQuery(''); setDraft(''); }}>
              {field.field_name}
            </Button>
          ))}
          {fieldId && (
            <Button type="button" size="sm" variant="outline" onClick={() => setFieldId(null)}>Tất cả lĩnh vực</Button>
          )}
        </div>
        {children.length > 0 && (
          <div className="module-form">
            {children.map((field) => (
              <Button key={field.id} type="button" size="sm" variant="outline" onClick={() => setFieldId(field.id)}>
                {field.field_name}
              </Button>
            ))}
          </div>
        )}
      </Card>
      <Card title="Tìm nghề">
        <form
          className="module-form"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(draft.trim());
          }}
        >
          <Input label="Tên nghề" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Nhập tên nghề" />
          <Button type="submit">Tìm</Button>
          <Select label="Thang lương" value={filters.salary} emptyLabel="Tất cả" options={choices.salaries.map((value) => ({ value, label: value }))} onChange={(value) => setFilters((current) => ({ ...current, salary: value }))} />
          <Select label="Mức tăng trưởng" value={filters.growth} emptyLabel={choices.growth.length ? 'Tất cả' : 'Chưa có dữ liệu'} options={choices.growth.map((value) => ({ value, label: value }))} onChange={(value) => setFilters((current) => ({ ...current, growth: value }))} />
          <Select label="Trình độ học vấn" value={filters.education} emptyLabel="Tất cả" options={choices.education.map((value) => ({ value, label: value }))} onChange={(value) => setFilters((current) => ({ ...current, education: value }))} />
          <Select label="Môi trường làm việc" value={filters.environment} emptyLabel="Tất cả" options={choices.environments.map((value) => ({ value, label: value }))} onChange={(value) => setFilters((current) => ({ ...current, environment: value }))} />
        </form>
        {loading && <Spinner />}
        {error && <Alert variant="danger">{error}</Alert>}
        {!loading && !error && rows.length === 0 && <p>Chưa có nghề đã công bố khớp với từ khóa này.</p>}
        <ul className="module-list">
          {rows.map((row) => (
            <li key={row.id}>
              <Link to={careerHref(row.id)}>{row.career_name}</Link>
              <span>{row.career_code}</span>
              <span>{row.qualifying_jd_count} JD L0–L2</span>
              {row.holland_top3 && <Badge>Holland {row.holland_top3}</Badge>}
              {isLearner && (
                <Button type="button" size="sm" variant={picked.includes(row.id) ? 'primary' : 'outline'} onClick={() => toggleCompare(row.id)}>
                  {picked.includes(row.id) ? 'Bỏ so sánh' : 'So sánh nghề'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {isLearner && (
        <Card title="Nghề đã lưu">
          {saved.length === 0 ? <p>Bạn chưa lưu nghề nào.</p> : (
            <ul className="module-list">
              {saved.map((item) => (
                <li key={`${item.kind}-${item.career_id}`}>
                  <Link to={careerHref(item.career_id)}>{item.career_name}</Link>
                  <Badge variant={item.kind === 'target' ? 'success' : 'default'}>{item.kind === 'target' ? 'Mục tiêu' : 'Quan tâm'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
};
