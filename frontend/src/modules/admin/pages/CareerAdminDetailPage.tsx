import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Breadcrumb, Button, Card, DataTable, Input, Select, Skeleton, Tabs, Textarea } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { setCareerStatus } from '../../career_explorer/career.service';
import {
  AUDIT_ACTION_LABEL,
  CAREER_STATUS_LABEL,
  CAREER_STATUS_OPTIONS,
  CAREER_STATUS_VARIANT,
  CHECKED_KIND_LABEL,
  CHECKED_KIND_OPTIONS,
  HOLLAND_LETTERS,
  VERIFICATION_LABEL,
  formatDate,
} from '../career_admin.constants';
import {
  careerAdminErrorText,
  listCareerFieldOptions,
  listRequirementCriteria,
  loadCareerAdminDetail,
  saveCareerHolland,
  saveCareerInfo,
  saveCareerRequirements,
} from '../career_admin.service';
import type {
  CareerAdminDetail,
  CareerFieldOption,
  CareerInfoInput,
  CheckedKind,
  RequirementCriterion,
  RequirementInput,
  SourceJd,
} from '../career_admin.types';
import './AdminPages.css';

const EMPTY_INFO: CareerInfoInput = {
  career_name: '', career_field_id: '', career_description: '', key_skills: '', salary_range_text: '', career_path_text: '',
  growth_level: '', data_source_note: '', data_checked_at: '', data_checked_kind: 'checked',
};

interface RequirementDraft { required: string; weight: string }
type Message = { tone: 'success' | 'danger'; text: string } | null;

const TAB_ITEMS = [
  { value: 'info', label: 'Thông tin' },
  { value: 'requirements', label: 'Yêu cầu năng lực' },
  { value: 'holland', label: 'Holland' },
  { value: 'jd', label: 'JD nguồn' },
  { value: 'history', label: 'Lịch sử' },
];

const GROUP_ORDER = (code: string) => (code === 'G7' ? 'G7' : 'G1–G5');

export const CareerAdminDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'moi';
  const [detail, setDetail] = useState<CareerAdminDetail | null>(null);
  const [fields, setFields] = useState<CareerFieldOption[]>([]);
  const [criteria, setCriteria] = useState<RequirementCriterion[]>([]);
  const [info, setInfo] = useState<CareerInfoInput>(EMPTY_INFO);
  const [requirements, setRequirements] = useState<Record<string, RequirementDraft>>({});
  const [holland, setHolland] = useState<Record<string, string>>({});
  const [tab, setTab] = useState('info');
  const [isLoading, setIsLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([listCareerFieldOptions(), listRequirementCriteria(), isNew || !id ? Promise.resolve(null) : loadCareerAdminDetail(id)])
      .then(([fieldRows, criteriaRows, loaded]) => {
        if (!active) return;
        setFields(fieldRows);
        setCriteria(criteriaRows);
        if (!loaded) {
          setDetail(null);
          return;
        }
        setDetail(loaded);
        const c = loaded.career;
        setInfo({
          career_name: c.career_name, career_field_id: c.career_field_id, career_description: c.career_description ?? '', key_skills: c.key_skills ?? '',
          salary_range_text: c.salary_range_text ?? '', career_path_text: c.career_path_text ?? '', growth_level: c.growth_level ?? '',
          data_source_note: c.data_source_note ?? '', data_checked_at: c.data_checked_at ?? '', data_checked_kind: c.data_checked_kind ?? 'checked',
        });
        setRequirements(Object.fromEntries(loaded.requirements.map((r) => [r.dimension_code, { required: String(r.required_score), weight: String(r.career_weight) }])));
        setHolland(Object.fromEntries(HOLLAND_LETTERS.map((letter) => [letter, String(loaded.holland.find((h) => h.holland_code === letter)?.strength ?? 0)])));
      })
      .catch(() => active && setMessage({ tone: 'danger', text: 'Không tải được nghề.' }))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [id, isNew, reloadKey]);

  const fieldOptions = useMemo(
    () => fields.map((f) => ({ value: f.id, label: f.parent_field_id ? `${fields.find((p) => p.id === f.parent_field_id)?.field_name ?? ''} › ${f.field_name}` : f.field_name })),
    [fields],
  );

  const run = useCallback(async (action: () => Promise<string | void>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      setMessage({ tone: 'success', text: typeof result === 'string' && result.startsWith('NGHE-') ? `${success} Phiên bản ma trận ${result}.` : success });
      setReloadKey((k) => k + 1);
    } catch (caught) {
      setMessage({ tone: 'danger', text: careerAdminErrorText(caught) });
    } finally {
      setBusy(false);
    }
  }, []);

  const saveInfo = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const savedId = await saveCareerInfo(isNew ? null : (id ?? null), info);
      if (isNew) {
        navigate(`/quan-tri/nghe/${savedId}`, { replace: true });
        return;
      }
      setMessage({ tone: 'success', text: 'Đã lưu thông tin nghề.' });
      setReloadKey((k) => k + 1);
    } catch (caught) {
      setMessage({ tone: 'danger', text: careerAdminErrorText(caught) });
    } finally {
      setBusy(false);
    }
  };

  const weightTotals = useMemo(() => {
    const totals = { main: 0, g7: 0 };
    for (const criterion of criteria) {
      const draft = requirements[criterion.dimension_code];
      const weight = Number(draft?.weight);
      if (!draft || !draft.required || !(weight > 0)) continue;
      if (criterion.group_code === 'G7') totals.g7 += weight; else totals.main += weight;
    }
    return totals;
  }, [criteria, requirements]);

  const requirementPayload = (): RequirementInput[] => criteria
    .filter((c) => requirements[c.dimension_code]?.required && requirements[c.dimension_code]?.weight)
    .map((c) => ({
      dimension_code: c.dimension_code,
      required_score: Number(requirements[c.dimension_code].required),
      career_weight: Number(requirements[c.dimension_code].weight),
    }));

  const setDraft = (code: string, change: Partial<RequirementDraft>) =>
    setRequirements((current) => ({ ...current, [code]: { ...(current[code] ?? { required: '', weight: '' }), ...change } }));

  const hollandTop3 = HOLLAND_LETTERS
    .map((letter, index) => ({ letter, strength: Number(holland[letter]) || 0, index }))
    .filter((item) => item.strength > 0)
    .sort((a, b) => b.strength - a.strength || a.index - b.index)
    .slice(0, 3)
    .map((item) => item.letter)
    .join('');

  const requirementColumns: DataTableColumn<RequirementCriterion>[] = [
    { key: 'criterion', header: 'Tiêu chí', render: (c) => `${c.dimension_code} · ${c.name}` },
    { key: 'group', header: 'Phần', align: 'center', nowrap: true, render: (c) => GROUP_ORDER(c.group_code) },
    {
      key: 'required', header: 'Mức yêu cầu (1–5)', align: 'center',
      render: (c) => <Input label="" aria-label={`Mức yêu cầu ${c.dimension_code}`} inputMode="decimal" value={requirements[c.dimension_code]?.required ?? ''} onChange={(e) => setDraft(c.dimension_code, { required: e.target.value })} />,
    },
    {
      key: 'weight', header: 'Trọng số', align: 'center',
      render: (c) => <Input label="" aria-label={`Trọng số ${c.dimension_code}`} inputMode="decimal" value={requirements[c.dimension_code]?.weight ?? ''} onChange={(e) => setDraft(c.dimension_code, { weight: e.target.value })} />,
    },
    {
      key: 'normalized', header: 'Sau chuẩn hóa', align: 'center', nowrap: true,
      render: (c) => {
        const draft = requirements[c.dimension_code];
        const total = c.group_code === 'G7' ? weightTotals.g7 : weightTotals.main;
        const weight = Number(draft?.weight);
        return draft?.required && weight > 0 && total > 0 ? `${((weight / total) * 100).toFixed(1)}%` : '';
      },
    },
    {
      key: 'level', header: 'Nguồn', align: 'center',
      render: (c) => {
        const saved = detail?.requirements.find((r) => r.dimension_code === c.dimension_code);
        return saved ? `${VERIFICATION_LABEL[saved.verification_level] ?? saved.verification_level} · ${saved.jd_count} JD` : '';
      },
    },
  ];

  const jdColumns: DataTableColumn<SourceJd>[] = [
    { key: 'company', header: 'Công ty', render: (jd) => jd.company_name ?? '' },
    { key: 'title', header: 'Vị trí', render: (jd) => jd.job_title ?? '' },
    { key: 'level', header: 'Cấp độ', render: (jd) => (jd.career_level_raw ?? '').slice(0, 24) },
    { key: 'required', header: 'Required Level', align: 'center', nowrap: true, render: (jd) => jd.required_level ?? '' },
    {
      key: 'date', header: 'Ngày', align: 'center', nowrap: true,
      render: (jd) => (jd.data_checked_at ? `${formatDate(jd.data_checked_at)} · ${CHECKED_KIND_LABEL[jd.data_checked_kind as CheckedKind] ?? ''}` : ''),
    },
    { key: 'link', header: '', render: (jd) => (jd.jd_url ? <a href={jd.jd_url} target="_blank" rel="noopener noreferrer">Mở JD</a> : '') },
  ];

  const career = detail?.career;
  const title = isNew ? 'Thêm nghề' : (career?.career_name ?? 'Nghề');
  const tabs = isNew ? TAB_ITEMS.slice(0, 1) : TAB_ITEMS;
  const mainCount = criteria.filter((c) => c.group_code !== 'G7' && requirements[c.dimension_code]?.required).length;
  const g7Count = criteria.filter((c) => c.group_code === 'G7' && requirements[c.dimension_code]?.required).length;

  if (isLoading) return <Skeleton />;
  if (!isNew && !detail) return <Alert variant="danger">{message?.text ?? 'Không tìm thấy nghề.'}</Alert>;

  return (
    <>
      <Breadcrumb items={[{ label: 'Quản lý nghề', to: '/quan-tri/nghe' }, { label: title }]} />
      <div className="admin-page-header">
        <h1 className="page-title">{title}</h1>
        {career && (
          <div className="module-actions">
            <Badge variant={career.is_standard_complete ? 'success' : 'warning'}>{career.is_standard_complete ? 'Đủ 3 thành phần' : 'Thiếu thành phần'}</Badge>
            <Badge variant={CAREER_STATUS_VARIANT[career.status]}>{CAREER_STATUS_LABEL[career.status]}</Badge>
            {detail?.matrixVersion && <Badge>{detail.matrixVersion}</Badge>}
          </div>
        )}
      </div>

      {message && <div className="admin-alert-slot"><Alert variant={message.tone}>{message.text}</Alert></div>}
      <Tabs label="Thông tin nghề" items={tabs} value={tab} onChange={setTab} />

      {tab === 'info' && (
        <Card>
          <div className="admin-stack">
            <Input label="Tên nghề" value={info.career_name} onChange={(e) => setInfo({ ...info, career_name: e.target.value })} />
            <SearchableSelect label="Lĩnh vực" placeholder="Chọn lĩnh vực" options={fieldOptions} value={info.career_field_id} onChange={(value) => setInfo({ ...info, career_field_id: value })} />
            <Textarea label="Mô tả nghề" rows={4} value={info.career_description} onChange={(e) => setInfo({ ...info, career_description: e.target.value })} />
            <Textarea label="Kỹ năng chính" rows={3} value={info.key_skills} onChange={(e) => setInfo({ ...info, key_skills: e.target.value })} />
            <Input label="Thang lương" value={info.salary_range_text} onChange={(e) => setInfo({ ...info, salary_range_text: e.target.value })} />
            <Textarea label="Lộ trình thăng tiến" rows={3} value={info.career_path_text} onChange={(e) => setInfo({ ...info, career_path_text: e.target.value })} />
            <Input label="Mức tăng trưởng" value={info.growth_level} onChange={(e) => setInfo({ ...info, growth_level: e.target.value })} />
            <Textarea label="Nguồn dữ liệu" rows={2} value={info.data_source_note} onChange={(e) => setInfo({ ...info, data_source_note: e.target.value })} />
            <Input label="Ngày" type="date" value={info.data_checked_at} onChange={(e) => setInfo({ ...info, data_checked_at: e.target.value })} />
            <Select label="Loại ngày" value={info.data_checked_kind} options={CHECKED_KIND_OPTIONS} onChange={(value) => setInfo({ ...info, data_checked_kind: value as CheckedKind })} />
            <div className="module-actions">
              <Button type="button" isLoading={busy} disabled={info.career_name.trim().length < 3 || !info.career_field_id} onClick={() => void saveInfo()}>Lưu</Button>
              {career && (
                <Select label="Trạng thái" value={career.status} options={CAREER_STATUS_OPTIONS}
                  onChange={(status) => void run(() => setCareerStatus(career.id, status).then(() => undefined), 'Đã đổi trạng thái.')} />
              )}
            </div>
          </div>
        </Card>
      )}

      {tab === 'requirements' && career && (
        <Card noPadding>
          <DataTable columns={requirementColumns} rows={criteria} rowKey={(c) => c.id} caption="Yêu cầu năng lực" />
          <div className="module-actions">
            {(mainCount === 0 || g7Count === 0) && <Alert variant="warning">{mainCount === 0 ? 'Chưa có tiêu chí G1–G5.' : 'Chưa có tiêu chí G7.'}</Alert>}
            <Button type="button" isLoading={busy} disabled={mainCount + g7Count === 0}
              onClick={() => void run(() => saveCareerRequirements(career.id, requirementPayload()), 'Đã lưu mức yêu cầu.')}>Lưu</Button>
          </div>
        </Card>
      )}

      {tab === 'holland' && career && (
        <Card>
          <div className="admin-stack">
            {HOLLAND_LETTERS.map((letter) => (
              <Input key={letter} label={letter} inputMode="decimal" value={holland[letter] ?? '0'} onChange={(e) => setHolland({ ...holland, [letter]: e.target.value })} />
            ))}
            <div className="module-actions">
              <Badge variant={hollandTop3 ? 'info' : 'warning'}>{hollandTop3 || 'Chưa có'}</Badge>
              <Button type="button" isLoading={busy}
                onClick={() => void run(() => saveCareerHolland(career.id, Object.fromEntries(HOLLAND_LETTERS.map((l) => [l, Number(holland[l]) || 0]))), 'Đã lưu hồ sơ Holland.')}>Lưu</Button>
            </div>
          </div>
        </Card>
      )}

      {tab === 'jd' && detail && (
        <Card noPadding>
          <DataTable columns={jdColumns} rows={detail.jds} rowKey={(jd) => jd.id} emptyText="Chưa có JD" caption="JD nguồn" />
        </Card>
      )}

      {tab === 'history' && detail && (
        <Card noPadding>
          <DataTable
            columns={[
              { key: 'time', header: 'Thời điểm', nowrap: true, render: (h) => new Date(h.created_at).toLocaleString('vi-VN') },
              { key: 'action', header: 'Thao tác', render: (h) => AUDIT_ACTION_LABEL[h.action] ?? h.action },
            ]}
            rows={detail.history}
            rowKey={(h) => h.id}
            emptyText="Chưa có lịch sử"
            caption="Lịch sử"
          />
        </Card>
      )}
    </>
  );
};
