import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, Map as MapIcon, Plus, RefreshCw, Sparkles } from 'lucide-react';
import {
  Alert, Badge, Button, Card, Checkbox, Input, Modal, PageHero, ProgressBar, Select, Skeleton, StickerCard, StickerFact, StickerGrid, stickerToneAt,
} from '../../../components/common';
import { evaluateRoadmapProgress } from '../../../domain/assessmentRules';
import { generateRoadmapFromLibrary, type ApprovedActivityTemplate } from '../../../domain/roadmapGeneration';
import { callRpc, db } from '../../../lib/rpc';
import { listSavedCareers, loadLearnerProfile } from '../../career_explorer/career.service';
import { useAuth } from '../../auth/AuthContext';
import '../../career_explorer/pages/CareerPages.css';
import './RoadmapPage.css';

interface Milestone {
  id: string;
  pillar: 'knowledge' | 'experience' | 'exploration';
  title: string;
  done: boolean;
  due_date: string | null;
  weight: number;
  is_checkpoint: boolean;
}
interface Roadmap {
  id: string;
  title: string;
  career_name: string | null;
  is_active: boolean;
  target_date: string | null;
  created_at: string;
  education_level: string | null;
  school_year: string | null;
  current_skills: string | null;
  certificates: string | null;
  extracurricular: string | null;
  milestones: Milestone[];
}

const PILLARS = [
  { value: 'knowledge', label: 'Kiến thức' },
  { value: 'experience', label: 'Kinh nghiệm' },
  { value: 'exploration', label: 'Trải nghiệm' },
];
const EDUCATION_LEVELS = [
  { value: 'Trung học cơ sở', label: 'Trung học cơ sở' },
  { value: 'Trung học phổ thông', label: 'Trung học phổ thông' },
  { value: 'Cao đẳng', label: 'Cao đẳng' },
  { value: 'Đại học', label: 'Đại học' },
];
const NO_DUE = 'none';
const pillarLabel = (value: string) => PILLARS.find((p) => p.value === value)?.label ?? value;
const phaseLabel = (key: string) => (key === NO_DUE ? 'Chưa có hạn' : `Tháng ${key.slice(5, 7)}/${key.slice(0, 4)}`);
const phaseKey = (m: Milestone) => m.due_date?.slice(0, 7) ?? NO_DUE;

type Dialog = 'create' | 'add' | 'suggest' | null;

/** Lộ trình 3 trụ cột, một lộ trình kích hoạt, cảnh báo chệch hướng (chậm > 20% hoặc trễ cột mốc quan trọng) */
export const RoadmapPage: React.FC = () => {
  const { session } = useAuth();
  const [roadmaps, setRoadmaps] = useState<Roadmap[] | null>(null);
  const [targets, setTargets] = useState<{ career_id: string; career_name: string; kind: string }[]>([]);
  const [params] = useSearchParams();
  const [careerId, setCareerId] = useState(() => params.get('nghe') ?? '');
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [form, setForm] = useState({ pillar: 'knowledge', title: '', due: '', checkpoint: false });
  const [hours, setHours] = useState('8');
  const [origin, setOrigin] = useState({ education: '', year: '', skills: '', certificates: '', extracurricular: '' });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => callRpc<Roadmap[]>('list_my_roadmaps').then((value) => setRoadmaps(value ?? [])), []);

  useEffect(() => {
    Promise.all([reload(), listSavedCareers().then(setTargets)]).catch(() => setError('Không tải được lộ trình.'));
  }, [reload]);

  const active = roadmaps?.find((r) => r.is_active) ?? null;
  const history = roadmaps?.filter((r) => !r.is_active) ?? [];
  const progress = active ? evaluateRoadmapProgress(active.milestones.map((m) => ({
    id: m.id, pillar: m.pillar, title: m.title, done: m.done, weight: Number(m.weight), dueDate: m.due_date, isCheckpoint: m.is_checkpoint,
  }))) : null;
  const phases = useMemo(() => {
    if (!active) return [];
    const keys = [...new Set(active.milestones.map(phaseKey))].sort((a, b) => (a === NO_DUE ? 1 : b === NO_DUE ? -1 : a.localeCompare(b)));
    return keys.map((key) => ({ key, items: active.milestones.filter((m) => phaseKey(m) === key) }));
  }, [active]);
  const targetCareers = targets.filter((t) => t.kind === 'target');
  const showCreateInline = roadmaps !== null && !active;

  const create = async () => {
    setError(null);
    try {
      const id = await callRpc<string>('create_roadmap', { p_career_id: careerId || null, p_title: title, p_target_date: targetDate || null });
      await callRpc('save_roadmap_origin', {
        p_roadmap_id: id,
        p_education_level: origin.education,
        p_school_year: origin.year,
        p_skills: origin.skills,
        p_certificates: origin.certificates,
        p_extracurricular: origin.extracurricular,
      });
      setTitle('');
      setDialog(null);
      await reload();
    } catch {
      setError('Cần đặt tên lộ trình.');
    }
  };

  const add = async () => {
    if (!active) return;
    setError(null);
    try {
      await callRpc('add_roadmap_milestone', {
        p_roadmap_id: active.id, p_pillar: form.pillar, p_title: form.title,
        p_due_date: form.due || null, p_weight: 1, p_is_checkpoint: form.checkpoint,
      });
      setForm({ ...form, title: '', due: '' });
      setDialog(null);
      await reload();
    } catch {
      setError('Không thêm được hoạt động. Nhập nội dung hoạt động.');
    }
  };

  const fillFromLibrary = async () => {
    if (!active) return;
    setError(null);
    setDialog(null);
    try {
      const { data, error: loadError } = await db.from('approved_roadmap_activities').select('*').eq('is_active', true);
      if (loadError) throw loadError;
      const templates = ((data ?? []) as Array<{
        id: string; pillar: ApprovedActivityTemplate['pillar']; title: string;
        duration_weeks: number; hours: number; criteria_id: string | null; repeatable: boolean;
      }>).map((row) => ({
        id: row.id,
        pillar: row.pillar,
        title: row.title,
        durationWeeks: Number(row.duration_weeks),
        hours: Number(row.hours),
        criteriaId: row.criteria_id,
        repeatable: row.repeatable,
      }));
      const learner = session?.user.id ? await loadLearnerProfile(session.user.id).catch(() => null) : null;
      const generated = generateRoadmapFromLibrary({
        startDay: new Date().toISOString().slice(0, 10),
        targetDate: active.target_date ?? targetDate,
        hoursPerWeek: Number(hours) || 8,
        templates,
        scoresByCriterionId: learner ? Object.fromEntries(learner.scoreByCriterionId) : undefined,
      });
      const count = await callRpc<number>('add_roadmap_milestones_bulk', {
        p_roadmap_id: active.id,
        p_items: generated.map((item) => ({
          pillar: item.pillar,
          title: item.title,
          due_date: item.dueDate,
          weight: item.weight,
          is_checkpoint: item.isCheckpoint,
        })),
      });
      await reload();
      if (!count) setError('Chưa gợi ý được hoạt động.');
    } catch (caught) {
      const text = String((caught as { message?: string })?.message ?? caught);
      if (text.includes('library_incomplete')) setError('Chưa đủ hoạt động đã duyệt cho cả 3 trụ cột.');
      else if (text.includes('horizon_invalid') || text.includes('hours_per_week')) setError('Cần ngày mục tiêu trong tương lai (không quá 10 năm) và ít nhất 1 giờ mỗi tuần.');
      else setError('Chưa gợi ý được hoạt động.');
    }
  };

  const toggle = (m: Milestone) => {
    callRpc('toggle_roadmap_milestone', { p_milestone_id: m.id, p_done: !m.done }).then(reload).catch(() => setError('Chưa cập nhật được hoạt động.'));
  };

  const createForm = (
    <div className="module-form">
      <Input label="Tên lộ trình" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Select label="Nghề mục tiêu" emptyLabel="Không gắn nghề" value={careerId}
        options={targetCareers.map((t) => ({ value: t.career_id, label: t.career_name }))} onChange={setCareerId} />
      <Input label="Thời điểm đạt mục tiêu" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
      <Select label="Cấp học" emptyLabel="Chưa chọn" value={origin.education} options={EDUCATION_LEVELS} onChange={(v) => setOrigin({ ...origin, education: v })} />
      <Input label="Năm học / lớp" value={origin.year} onChange={(e) => setOrigin({ ...origin, year: e.target.value })} />
      <Input label="Kỹ năng hiện có" value={origin.skills} onChange={(e) => setOrigin({ ...origin, skills: e.target.value })} />
      <Input label="Chứng chỉ hiện có" value={origin.certificates} onChange={(e) => setOrigin({ ...origin, certificates: e.target.value })} />
      <Input label="Hoạt động ngoại khóa" value={origin.extracurricular} onChange={(e) => setOrigin({ ...origin, extracurricular: e.target.value })} />
    </div>
  );

  return (
    <div className="module-page">
      <PageHero
        title="Lộ trình phát triển"
        icon={<MapIcon />}
        tone="teal"
        actions={active && (
          <>
            <Button type="button" variant="outline" leftIcon={<Plus size={16} />} onClick={() => setDialog('add')}>Thêm hoạt động</Button>
            <Button type="button" variant="outline" leftIcon={<Sparkles size={16} />} onClick={() => setDialog('suggest')}>Gợi ý hoạt động</Button>
            <Button type="button" variant="outline" leftIcon={<RefreshCw size={16} />} onClick={() => setDialog('create')}>Tạo lại lộ trình</Button>
          </>
        )}
      />
      {error && <Alert variant="danger">{error}</Alert>}
      {roadmaps === null && !error && <Skeleton />}

      {showCreateInline && (
        <Card title="Tạo lộ trình">
          {targetCareers.length === 0 && <Alert variant="info">Bạn chưa đặt nghề mục tiêu. Đặt tối đa 2 nghề mục tiêu ở trang Nghề nghiệp.</Alert>}
          {createForm}
          <div className="module-actions roadmap-submit">
            <Button type="button" disabled={!title.trim()} onClick={() => void create()}>Tạo</Button>
          </div>
        </Card>
      )}

      {active && progress && (
        <>
          <Card title={active.title}>
            <div className="roadmap-meta">
              {active.career_name && <StickerFact>{active.career_name}</StickerFact>}
              {active.target_date && <StickerFact icon={<CalendarClock size={14} />}>Mục tiêu {new Date(active.target_date).toLocaleDateString('vi-VN')}</StickerFact>}
              {(active.education_level || active.school_year) && <StickerFact>{[active.education_level, active.school_year].filter(Boolean).join(' · ')}</StickerFact>}
            </div>
            <ProgressBar value={progress.actualPercent} label="Tiến độ hoàn thành" />
            <p className="explain-note">Hoàn thành {progress.actualPercent}% · Kế hoạch đến hôm nay {progress.plannedPercent}% · Chậm {progress.delayPercent}%</p>
            {progress.offTrack && (
              <Alert variant="warning" title="Lộ trình đang chệch hướng">
                {progress.delayPercent > 20 && `Chậm ${progress.delayPercent}% so với phần việc đã đến hạn. `}
                {progress.missedCheckpoints.map((m) => `Trễ cột mốc quan trọng: ${m.title}. `)}
              </Alert>
            )}
          </Card>

          <StickerGrid label="Tiến độ theo trụ cột">
            {progress.byPillar.map((p, index) => (
              <StickerCard key={p.pillar} tone={stickerToneAt(index)} title={pillarLabel(p.pillar)} corner={<strong>{p.percent}%</strong>}>
                <ProgressBar value={p.percent} label={pillarLabel(p.pillar)} />
                <StickerFact strong>{p.done}/{p.total} hoạt động</StickerFact>
              </StickerCard>
            ))}
          </StickerGrid>

          {phases.length === 0 ? (
            <Card title="Các mốc">
              <div className="module-actions">
                <Button type="button" leftIcon={<Sparkles size={16} />} onClick={() => setDialog('suggest')}>Gợi ý hoạt động</Button>
                <Button type="button" variant="outline" leftIcon={<Plus size={16} />} onClick={() => setDialog('add')}>Thêm hoạt động</Button>
              </div>
            </Card>
          ) : (
            <ol className="roadmap-timeline" aria-label="Các mốc theo tháng">
              {phases.map((phase) => (
                <li key={phase.key} className="roadmap-phase">
                  <h2 className="roadmap-phase-title">{phaseLabel(phase.key)}</h2>
                  <ul className="roadmap-items">
                    {phase.items.map((m) => (
                      <li key={m.id} className={m.done ? 'is-done' : undefined}>
                        <Checkbox label={m.title} checked={m.done} onChange={() => toggle(m)} />
                        <div className="roadmap-item-tags">
                          <Badge>{pillarLabel(m.pillar)}</Badge>
                          {m.is_checkpoint && <Badge variant="warning">Cột mốc</Badge>}
                          {m.due_date && <span className="explain-note">Hạn {new Date(m.due_date).toLocaleDateString('vi-VN')}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      {history.length > 0 && (
        <Card title="Lịch sử lộ trình">
          <ul className="module-list">
            {history.map((r) => (
              <li key={r.id}>
                <span>{r.title}</span>
                <span>{new Date(r.created_at).toLocaleDateString('vi-VN')} · {r.milestones.filter((m) => m.done).length}/{r.milestones.length} hoạt động</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={dialog === 'create'}
        title="Tạo lại lộ trình"
        wide
        onClose={() => setDialog(null)}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>Hủy</Button>
            <Button type="button" disabled={!title.trim()} onClick={() => void create()}>Tạo</Button>
          </>
        }
      >
        <Alert variant="warning">Lộ trình hiện tại sẽ chuyển vào lịch sử.</Alert>
        {createForm}
      </Modal>

      <Modal
        open={dialog === 'add'}
        title="Thêm hoạt động"
        onClose={() => setDialog(null)}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>Hủy</Button>
            <Button type="button" disabled={!form.title.trim()} onClick={() => void add()}>Thêm</Button>
          </>
        }
      >
        <div className="career-filter-form">
          <Select label="Trụ cột" value={form.pillar} options={PILLARS} onChange={(v) => setForm({ ...form, pillar: v })} />
          <Input label="Nội dung" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="Hạn" type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
          <Checkbox label="Cột mốc quan trọng" checked={form.checkpoint} onChange={(checked) => setForm({ ...form, checkpoint: checked })} />
        </div>
      </Modal>

      <Modal
        open={dialog === 'suggest'}
        title="Gợi ý hoạt động"
        onClose={() => setDialog(null)}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>Hủy</Button>
            <Button type="button" onClick={() => void fillFromLibrary()}>Gợi ý</Button>
          </>
        }
      >
        <div className="career-filter-form">
          <Input label="Giờ mỗi tuần" value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" />
        </div>
      </Modal>
    </div>
  );
};
