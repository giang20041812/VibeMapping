import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, Checkbox, DataTable, Input, Select, Skeleton, Tabs, Textarea, useConfirm } from '../../../components/common';
import type { DataTableColumn, SelectOption } from '../../../components/common';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import {
  BENEFIT_TIER_LABEL,
  CAREER_LEVEL_NAMES,
  CAREER_LEVELS,
  FRAMEWORK_SECTION_LABEL,
  FRAMEWORK_TIER_LABEL,
  FRAMEWORK_TIERS,
  careerLevelCode,
  salarySpan,
} from '../../career_explorer/careerLevelFramework.constants';
import type { CareerLevelFramework, CareerLevelFrameworkItem, FrameworkSection } from '../../career_explorer/careerLevelFramework.types';
import { listAdminCareers } from '../career_admin.service';
import { buildFrameworkDraft } from '../careerLevelFramework.draft';
import {
  FRAMEWORK_EDITOR_TABS,
  FRAMEWORK_SECTION_SPEC,
  FRAMEWORK_STATUS_LABEL,
  FRAMEWORK_STATUS_VARIANT,
} from '../careerLevelFramework_admin.constants';
import type { FrameworkFieldSpec } from '../careerLevelFramework_admin.constants';
import {
  copyCareerLevelFramework,
  countJdsByLevel,
  deleteCareerLevelFramework,
  frameworkErrorText,
  listCareerLevelFrameworks,
  listFrameworkCopySources,
  listLevelJds,
  saveCareerLevelFramework,
  setCareerLevelFrameworkStatus,
} from '../careerLevelFramework_admin.service';
import type { FrameworkCopySource, FrameworkHeaderInput } from '../careerLevelFramework_admin.service';
import './CareerLevelFrameworksPanel.css';

interface Props {
  careerId: string;
}

type Message = { tone: 'success' | 'danger'; text: string } | null;

interface EditorState {
  frameworkId: string | null;
  status: 'draft' | 'published';
  header: FrameworkHeaderInput;
  items: CareerLevelFrameworkItem[];
}

const LEVEL_OPTIONS: SelectOption[] = CAREER_LEVELS.map((level) => ({ value: String(level), label: `${careerLevelCode(level)} · ${CAREER_LEVEL_NAMES[level]}` }));

let tempKey = 0;
const newKey = () => `tmp-${Date.now()}-${(tempKey += 1)}`;

const emptyHeader = (level: number): FrameworkHeaderInput => ({
  career_level: level, level_name: CAREER_LEVEL_NAMES[level], title_variants: '', reports_to: '', hiring_industries: '',
  experience_text: '', work_mode: '', career_summary: '', position_objectives: '', required_level: '', jd_count: '0', source_note: '',
});

const headerOf = (fw: CareerLevelFramework): FrameworkHeaderInput => ({
  career_level: fw.career_level, level_name: fw.level_name, title_variants: fw.title_variants ?? '', reports_to: fw.reports_to ?? '',
  hiring_industries: fw.hiring_industries ?? '', experience_text: fw.experience_text ?? '', work_mode: fw.work_mode ?? '',
  career_summary: fw.career_summary ?? '', position_objectives: fw.position_objectives ?? '',
  required_level: fw.required_level === null ? '' : String(fw.required_level), jd_count: String(fw.jd_count), source_note: fw.source_note ?? '',
});

const blankItem = (section: FrameworkSection): CareerLevelFrameworkItem => ({
  id: newKey(), section, tier: null, group_label: null, content: '', detail: null, note: null, salary_min: null, salary_max: null,
  target_career_id: null, target_level: null, jd_hits: null, jd_total: null, is_estimate: false, sort_order: 0,
});

const withKeys = (items: CareerLevelFrameworkItem[]) => items.map((item) => ({ ...item, id: item.id ?? newKey() }));

/** Ô số thập phân giữ chữ đang gõ ("2," chưa xong) và chỉ ghi khi đọc được thành số */
const DecimalField: React.FC<{ label: string; value: number | null; onChange: (value: number | null) => void }> = ({ label, value, onChange }) => {
  const [text, setText] = useState(value === null ? '' : String(value).replace('.', ','));
  useEffect(() => {
    setText((current) => (Number(current.replace(',', '.')) === value ? current : value === null ? '' : String(value).replace('.', ',')));
  }, [value]);
  return (
    <Input
      label={label}
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        if (next.trim() === '') onChange(null);
        else if (Number.isFinite(Number(next.replace(',', '.')))) onChange(Number(next.replace(',', '.')));
      }}
    />
  );
};

interface SectionEditorProps {
  section: FrameworkSection;
  items: CareerLevelFrameworkItem[];
  careerOptions: { value: string; label: string }[];
  onChange: (id: string, change: Partial<CareerLevelFrameworkItem>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}

const SectionEditor: React.FC<SectionEditorProps> = ({ section, items, careerOptions, onChange, onAdd, onRemove, onMove }) => {
  const spec = FRAMEWORK_SECTION_SPEC[section];
  const tierLabels = section === 'benefit' ? BENEFIT_TIER_LABEL : FRAMEWORK_TIER_LABEL;
  const tierOptions: SelectOption[] = FRAMEWORK_TIERS.map((tier) => ({ value: tier, label: tierLabels[tier] }));

  const field = (item: CareerLevelFrameworkItem, f: FrameworkFieldSpec) => {
    const key = `${item.id}-${f.key}`;
    if (f.key === 'salary_min' || f.key === 'salary_max') {
      return <DecimalField key={key} label={f.label} value={item[f.key]} onChange={(value) => onChange(item.id!, { [f.key]: value })} />;
    }
    if (f.key === 'target_career_id') {
      return (
        <SearchableSelect key={key} label={f.label} placeholder="Chọn nghề" options={careerOptions} value={item.target_career_id ?? ''}
          onChange={(value) => onChange(item.id!, { target_career_id: value || null })} />
      );
    }
    if (f.key === 'target_level') {
      return (
        <Select key={key} label={f.label} emptyLabel="Chưa chọn" options={LEVEL_OPTIONS} value={item.target_level === null ? '' : String(item.target_level)}
          onChange={(value) => onChange(item.id!, { target_level: value === '' ? null : Number(value) })} />
      );
    }
    const value = (item[f.key] as string | null) ?? '';
    const update = (text: string) => onChange(item.id!, { [f.key]: f.key === 'content' ? text : (text || null) });
    return f.multiline
      ? <Textarea key={key} label={f.label} rows={2} value={value} onChange={(e) => update(e.target.value)} />
      : <Input key={key} label={f.label} value={value} onChange={(e) => update(e.target.value)} />;
  };

  return (
    <section className="lf-section">
      <div className="lf-section-head">
        <h3>{FRAMEWORK_SECTION_LABEL[section]}</h3>
        <Badge>{items.length}</Badge>
      </div>
      {items.map((item, index) => (
        <div key={item.id} className="lf-row">
          <div className="lf-row-fields">
            {spec.tiered && (
              <Select label="Mức" emptyLabel="Chưa xếp mức" options={tierOptions} value={item.tier ?? ''}
                onChange={(value) => onChange(item.id!, { tier: (value || null) as CareerLevelFrameworkItem['tier'] })} />
            )}
            {spec.fields.map((f) => field(item, f))}
          </div>
          <div className="lf-row-actions">
            {item.jd_hits !== null && item.jd_total !== null && <Badge size="sm">{item.jd_hits}/{item.jd_total} tin</Badge>}
            <Checkbox label="Ước tính" checked={item.is_estimate} onChange={(checked) => onChange(item.id!, { is_estimate: checked })} />
            <Button type="button" variant="ghost" size="sm" aria-label="Lên trên" disabled={index === 0} onClick={() => onMove(item.id!, -1)}><ArrowUp size={16} /></Button>
            <Button type="button" variant="ghost" size="sm" aria-label="Xuống dưới" disabled={index === items.length - 1} onClick={() => onMove(item.id!, 1)}><ArrowDown size={16} /></Button>
            <Button type="button" variant="ghost" size="sm" aria-label="Xóa dòng" onClick={() => onRemove(item.id!)}><Trash2 size={16} /></Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" leftIcon={<Plus size={16} />} onClick={onAdd}>Thêm dòng</Button>
    </section>
  );
};

export const CareerLevelFrameworksPanel: React.FC<Props> = ({ careerId }) => {
  const [frameworks, setFrameworks] = useState<CareerLevelFramework[]>([]);
  const [jdCounts, setJdCounts] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);
  const [creatingLevel, setCreatingLevel] = useState<number | null>(null);
  const [copySources, setCopySources] = useState<FrameworkCopySource[] | null>(null);
  const [copySourceId, setCopySourceId] = useState('');
  const [careerOptions, setCareerOptions] = useState<{ value: string; label: string }[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editorTab, setEditorTab] = useState('info');
  const { confirm, dialog: confirmDialog } = useConfirm();

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    Promise.all([listCareerLevelFrameworks(careerId), countJdsByLevel(careerId)])
      .then(([rows, counts]) => {
        if (!active) return;
        setFrameworks(rows);
        setJdCounts(counts);
      })
      .catch(() => active && setMessage({ tone: 'danger', text: 'Không tải được khung theo cấp.' }))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [careerId, reloadKey]);

  // Danh sách nghề cho ô "Nghề đích" chỉ tải khi mở tab hướng phát triển
  useEffect(() => {
    if (editorTab !== 'moves' || careerOptions.length > 0) return;
    listAdminCareers()
      .then((rows) => setCareerOptions(rows.map((c) => ({ value: c.id, label: c.career_name }))))
      .catch(() => setMessage({ tone: 'danger', text: 'Không tải được danh sách nghề.' }));
  }, [editorTab, careerOptions.length]);

  const byLevel = useMemo(() => new Map(frameworks.map((fw) => [fw.career_level, fw])), [frameworks]);

  const leaveEditor = useCallback(async () => {
    if (dirty && !(await confirm({ title: 'Bỏ thay đổi chưa lưu?', confirmLabel: 'Bỏ thay đổi', danger: true }))) return false;
    setEditor(null);
    setDirty(false);
    return true;
  }, [confirm, dirty]);

  const openFramework = async (fw: CareerLevelFramework) => {
    if (editor && !(await leaveEditor())) return;
    setCreatingLevel(null);
    setEditor({ frameworkId: fw.id, status: fw.status, header: headerOf(fw), items: withKeys(fw.items) });
    setEditorTab('info');
    setDirty(false);
  };

  const startCreate = async (level: number) => {
    if (editor && !(await leaveEditor())) return;
    setCreatingLevel(level);
    setCopySourceId('');
    if (copySources === null) {
      listFrameworkCopySources().then(setCopySources).catch(() => setCopySources([]));
    }
  };

  const createBlank = (level: number) => {
    setEditor({ frameworkId: null, status: 'draft', header: emptyHeader(level), items: [] });
    setCreatingLevel(null);
    setEditorTab('info');
    setDirty(true);
  };

  const createFromJds = async (level: number) => {
    setBusy(true);
    setMessage(null);
    try {
      const jds = await listLevelJds(careerId, level);
      const draft = buildFrameworkDraft(jds);
      setEditor({ frameworkId: null, status: 'draft', header: { ...emptyHeader(level), ...draft.header }, items: withKeys(draft.items) });
      setCreatingLevel(null);
      setEditorTab('info');
      setDirty(true);
    } catch (caught) {
      setMessage({ tone: 'danger', text: frameworkErrorText(caught) });
    } finally {
      setBusy(false);
    }
  };

  const createFromCopy = async (level: number) => {
    const source = copySources?.find((s) => s.id === copySourceId);
    if (!source) return;
    setBusy(true);
    setMessage(null);
    try {
      await copyCareerLevelFramework(source.id, careerId, level, CAREER_LEVEL_NAMES[level]);
      const rows = await listCareerLevelFrameworks(careerId);
      setFrameworks(rows);
      const created = rows.find((fw) => fw.career_level === level);
      setCreatingLevel(null);
      if (created) {
        setEditor({ frameworkId: created.id, status: created.status, header: headerOf(created), items: withKeys(created.items) });
        setEditorTab('info');
        setDirty(false);
      }
      setMessage({ tone: 'success', text: 'Đã sao chép khung.' });
    } catch (caught) {
      setMessage({ tone: 'danger', text: frameworkErrorText(caught) });
    } finally {
      setBusy(false);
    }
  };

  const updateHeader = (change: Partial<FrameworkHeaderInput>) => {
    setEditor((current) => (current ? { ...current, header: { ...current.header, ...change } } : current));
    setDirty(true);
  };

  const updateItems = (update: (items: CareerLevelFrameworkItem[]) => CareerLevelFrameworkItem[]) => {
    setEditor((current) => (current ? { ...current, items: update(current.items) } : current));
    setDirty(true);
  };

  const moveItem = (id: string, direction: -1 | 1) => updateItems((items) => {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return items;
    const section = items[index].section;
    const siblings = items.map((item, i) => ({ item, i })).filter(({ item }) => item.section === section);
    const position = siblings.findIndex(({ i }) => i === index);
    const target = siblings[position + direction];
    if (!target) return items;
    const next = [...items];
    [next[index], next[target.i]] = [next[target.i], next[index]];
    return next;
  });

  const save = async () => {
    if (!editor) return;
    setBusy(true);
    setMessage(null);
    try {
      const savedId = await saveCareerLevelFramework(editor.frameworkId, careerId, editor.header, editor.items);
      const rows = await listCareerLevelFrameworks(careerId);
      setFrameworks(rows);
      const saved = rows.find((fw) => fw.id === savedId);
      if (saved) setEditor({ frameworkId: saved.id, status: saved.status, header: headerOf(saved), items: withKeys(saved.items) });
      setDirty(false);
      setMessage({ tone: 'success', text: 'Đã lưu khung.' });
    } catch (caught) {
      setMessage({ tone: 'danger', text: frameworkErrorText(caught) });
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    if (!editor?.frameworkId) return;
    if (dirty) {
      setMessage({ tone: 'danger', text: 'Lưu thay đổi trước khi đổi trạng thái.' });
      return;
    }
    const next = editor.status === 'published' ? 'draft' : 'published';
    setBusy(true);
    setMessage(null);
    try {
      await setCareerLevelFrameworkStatus(editor.frameworkId, next);
      setEditor({ ...editor, status: next });
      setReloadKey((k) => k + 1);
      setMessage({ tone: 'success', text: next === 'published' ? 'Đã công bố khung.' : 'Đã chuyển khung về bản nháp.' });
    } catch (caught) {
      setMessage({ tone: 'danger', text: frameworkErrorText(caught) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editor?.frameworkId) return;
    if (!(await confirm({ title: `Xóa khung ${editor.header.level_name}?`, confirmLabel: 'Xóa', danger: true }))) return;
    setBusy(true);
    setMessage(null);
    try {
      await deleteCareerLevelFramework(editor.frameworkId);
      setEditor(null);
      setDirty(false);
      setReloadKey((k) => k + 1);
      setMessage({ tone: 'success', text: 'Đã xóa khung.' });
    } catch (caught) {
      setMessage({ tone: 'danger', text: frameworkErrorText(caught) });
    } finally {
      setBusy(false);
    }
  };

  const ladderColumns: DataTableColumn<number>[] = [
    { key: 'level', header: 'Bậc', nowrap: true, render: (level) => `${careerLevelCode(level)} · ${CAREER_LEVEL_NAMES[level]}` },
    { key: 'name', header: 'Tên hiển thị', render: (level) => byLevel.get(level)?.level_name ?? '' },
    {
      key: 'status', header: 'Trạng thái', nowrap: true,
      render: (level) => {
        const fw = byLevel.get(level);
        return fw ? <Badge variant={FRAMEWORK_STATUS_VARIANT[fw.status]}>{FRAMEWORK_STATUS_LABEL[fw.status]}</Badge> : <Badge variant="warning">Chưa có khung</Badge>;
      },
    },
    { key: 'salary', header: 'Thu nhập', nowrap: true, render: (level) => salarySpan(byLevel.get(level)?.items ?? []) },
    { key: 'items', header: 'Số dòng', align: 'center', render: (level) => byLevel.get(level)?.items.length ?? '' },
    { key: 'jds', header: 'JD', align: 'center', render: (level) => jdCounts[level] ?? 0 },
    {
      key: 'action', header: '', align: 'center',
      render: (level) => {
        const fw = byLevel.get(level);
        return fw
          ? <Button type="button" variant="outline" size="sm" onClick={() => void openFramework(fw)}>Mở</Button>
          : <Button type="button" variant="ghost" size="sm" leftIcon={<Plus size={16} />} onClick={() => void startCreate(level)}>Tạo</Button>;
      },
    },
  ];

  const copyOptions = useMemo(
    () => (copySources ?? []).map((s) => ({ value: s.id, label: `${s.career_name} · ${careerLevelCode(s.career_level)} ${s.level_name}` })),
    [copySources],
  );

  if (isLoading) return <Skeleton />;

  const activeTab = FRAMEWORK_EDITOR_TABS.find((t) => t.value === editorTab) ?? FRAMEWORK_EDITOR_TABS[0];
  const header = editor?.header;

  return (
    <div className="admin-stack">
      {confirmDialog}
      {message && <Alert variant={message.tone}>{message.text}</Alert>}

      <Card noPadding>
        <DataTable columns={ladderColumns} rows={CAREER_LEVELS} rowKey={(level) => String(level)} caption="Các bậc của nghề" />
      </Card>

      {creatingLevel !== null && (
        <Card>
          <div className="admin-stack">
            <h2 className="lf-title">Tạo khung {careerLevelCode(creatingLevel)} · {CAREER_LEVEL_NAMES[creatingLevel]}</h2>
            <div className="module-actions">
              <Button type="button" variant="outline" onClick={() => createBlank(creatingLevel)}>Khung trống</Button>
              <Button type="button" variant="outline" isLoading={busy} disabled={!jdCounts[creatingLevel]} onClick={() => void createFromJds(creatingLevel)}>
                Dựng từ {jdCounts[creatingLevel] ?? 0} JD
              </Button>
            </div>
            <div className="lf-copy">
              <SearchableSelect label="Sao chép từ khung" placeholder="Chọn khung" options={copyOptions} value={copySourceId} onChange={setCopySourceId} />
              <Button type="button" isLoading={busy} disabled={!copySourceId} onClick={() => void createFromCopy(creatingLevel)}>Sao chép</Button>
            </div>
            <div className="module-actions">
              <Button type="button" variant="ghost" onClick={() => setCreatingLevel(null)}>Hủy</Button>
            </div>
          </div>
        </Card>
      )}

      {editor && header && (
        <Card>
          <div className="admin-stack">
            <div className="lf-editor-head">
              <h2 className="lf-title">{careerLevelCode(header.career_level)} · {header.level_name || CAREER_LEVEL_NAMES[header.career_level]}</h2>
              <div className="module-actions">
                <Badge variant={FRAMEWORK_STATUS_VARIANT[editor.status]}>{FRAMEWORK_STATUS_LABEL[editor.status]}</Badge>
                {dirty && <Badge variant="warning">Chưa lưu</Badge>}
              </div>
            </div>

            <Tabs label="Nội dung khung" items={FRAMEWORK_EDITOR_TABS.map(({ value, label }) => ({ value, label }))} value={editorTab} onChange={setEditorTab} />

            {activeTab.value === 'info' && (
              <div className="lf-grid">
                <Select label="Bậc" options={LEVEL_OPTIONS} value={String(header.career_level)} onChange={(value) => updateHeader({ career_level: Number(value) })} />
                <Input label="Tên hiển thị" value={header.level_name} onChange={(e) => updateHeader({ level_name: e.target.value })} />
                <Input label="Kinh nghiệm" value={header.experience_text} onChange={(e) => updateHeader({ experience_text: e.target.value })} />
                <Input label="Required Level (1–5)" inputMode="decimal" value={header.required_level} onChange={(e) => updateHeader({ required_level: e.target.value })} />
                <Input label="Số tin căn cứ" inputMode="numeric" value={header.jd_count} onChange={(e) => updateHeader({ jd_count: e.target.value.replace(/\D/g, '') })} />
                <Textarea className="lf-wide" label="Chức danh thường gặp" rows={2} value={header.title_variants} onChange={(e) => updateHeader({ title_variants: e.target.value })} />
                <Textarea className="lf-wide" label="Báo cáo cho" rows={2} value={header.reports_to} onChange={(e) => updateHeader({ reports_to: e.target.value })} />
                <Textarea className="lf-wide" label="Ngành tuyển nhiều" rows={2} value={header.hiring_industries} onChange={(e) => updateHeader({ hiring_industries: e.target.value })} />
                <Textarea className="lf-wide" label="Hình thức làm việc" rows={2} value={header.work_mode} onChange={(e) => updateHeader({ work_mode: e.target.value })} />
                <Textarea className="lf-wide" label="Tóm tắt" rows={4} value={header.career_summary} onChange={(e) => updateHeader({ career_summary: e.target.value })} />
                <Textarea className="lf-wide" label="Mục tiêu vị trí" rows={4} value={header.position_objectives} onChange={(e) => updateHeader({ position_objectives: e.target.value })} />
                <Textarea className="lf-wide" label="Nguồn dữ liệu" rows={3} value={header.source_note} onChange={(e) => updateHeader({ source_note: e.target.value })} />
              </div>
            )}

            {activeTab.sections.map((section) => (
              <SectionEditor
                key={section}
                section={section}
                items={editor.items.filter((item) => item.section === section)}
                careerOptions={careerOptions}
                onChange={(id, change) => updateItems((items) => items.map((item) => (item.id === id ? { ...item, ...change } : item)))}
                onAdd={() => updateItems((items) => [...items, blankItem(section)])}
                onRemove={(id) => updateItems((items) => items.filter((item) => item.id !== id))}
                onMove={moveItem}
              />
            ))}

            <div className="module-actions lf-editor-actions">
              <Button type="button" isLoading={busy} disabled={!header.level_name.trim()} onClick={() => void save()}>Lưu</Button>
              {editor.frameworkId && (
                <Button type="button" variant="secondary" isLoading={busy} onClick={() => void toggleStatus()}>
                  {editor.status === 'published' ? 'Về bản nháp' : 'Công bố'}
                </Button>
              )}
              {editor.frameworkId && <Button type="button" variant="danger" disabled={busy} onClick={() => void remove()}>Xóa khung</Button>}
              <Button type="button" variant="ghost" onClick={() => void leaveEditor()}>Đóng</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
