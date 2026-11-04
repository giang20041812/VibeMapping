import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Checkbox, Input, ProgressBar, Select, Spinner } from '../../../components/common';
import { evaluateRoadmapProgress } from '../../../domain/assessmentRules';
import { generateRoadmapFromLibrary, type ApprovedActivityTemplate } from '../../../domain/roadmapGeneration';
import { callRpc, db } from '../../../lib/rpc';
import { listSavedCareers, loadLearnerProfile } from '../../career_explorer/career.service';
import { useAuth } from '../../auth/AuthContext';
import '../../career_explorer/pages/CareerPages.css';

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
const pillarLabel = (value: string) => PILLARS.find((p) => p.value === value)?.label ?? value;

/** F07.01: lộ trình 3 trụ cột, một lộ trình kích hoạt, cảnh báo chệch hướng (chậm > 20% hoặc trễ cột mốc quan trọng) */
export const RoadmapPage: React.FC = () => {
  const { session } = useAuth();
  const [roadmaps, setRoadmaps] = useState<Roadmap[] | null>(null);
  const [targets, setTargets] = useState<{ career_id: string; career_name: string; kind: string }[]>([]);
  const [params] = useSearchParams();
  const [careerId, setCareerId] = useState(() => params.get('nghe') ?? '');
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [form, setForm] = useState({ pillar: 'knowledge', title: '', due: '', weight: '1', checkpoint: false });
  const [hours, setHours] = useState('8');
  const [origin, setOrigin] = useState({ education: '', year: '', skills: '', certificates: '', extracurricular: '' });
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

  const create = async () => {
    setError(null);
    if (active && !window.confirm('Tạo lộ trình mới sẽ chuyển lộ trình hiện tại vào lịch sử. Tiếp tục?')) return;
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
        p_due_date: form.due || null, p_weight: Number(form.weight) || 1, p_is_checkpoint: form.checkpoint,
      });
      setForm({ ...form, title: '', due: '' });
      await reload();
    } catch {
      setError('Không thêm được hoạt động. Nhập nội dung và trọng số lớn hơn 0.');
    }
  };

  const fillFromLibrary = async () => {
    if (!active) return;
    setError(null);
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
      if (!count) setError('Thư viện chưa sinh được hoạt động.');
    } catch (caught) {
      const text = String((caught as { message?: string })?.message ?? caught);
      if (text.includes('library_incomplete')) setError('Thư viện chưa đủ hoạt động đã duyệt cho cả 3 trụ cột.');
      else if (text.includes('horizon_invalid') || text.includes('hours_per_week')) setError('Cần ngày mục tiêu trong tương lai (không quá 10 năm) và ít nhất 1 giờ/tuần.');
      else setError('Không sinh được lộ trình. Kiểm tra thư viện đã duyệt và ngày mục tiêu.');
    }
  };

  return (
    <div className="module-page">
      <h1>Lộ trình phát triển</h1>
      {error && <Alert variant="danger">{error}</Alert>}
      {roadmaps === null && !error && <Spinner />}

      <Card title={active ? 'Tạo lại lộ trình' : 'Tạo lộ trình'}>
        {targets.filter((t) => t.kind === 'target').length === 0 && (
          <Alert variant="info">Bạn chưa đặt nghề mục tiêu. Có thể đặt tối đa 2 nghề mục tiêu ở trang Nghề nghiệp.</Alert>
        )}
        <div className="module-form">
          <Input label="Tên lộ trình" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Select label="Nghề mục tiêu" emptyLabel="Không gắn nghề" value={careerId}
            options={targets.filter((t) => t.kind === 'target').map((t) => ({ value: t.career_id, label: t.career_name }))} onChange={setCareerId} />
          <Input label="Thời điểm đạt mục tiêu" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          <Input label="Giờ/tuần (khi sinh từ thư viện)" value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" />
          <Input label="Cấp học" value={origin.education} onChange={(e) => setOrigin({ ...origin, education: e.target.value })} placeholder="Trung học phổ thông" />
          <Input label="Năm học / lớp" value={origin.year} onChange={(e) => setOrigin({ ...origin, year: e.target.value })} placeholder="Lớp 11" />
          <Input label="Kỹ năng hiện có" value={origin.skills} onChange={(e) => setOrigin({ ...origin, skills: e.target.value })} />
          <Input label="Chứng chỉ hiện có" value={origin.certificates} onChange={(e) => setOrigin({ ...origin, certificates: e.target.value })} />
          <Input label="Hoạt động ngoại khóa" value={origin.extracurricular} onChange={(e) => setOrigin({ ...origin, extracurricular: e.target.value })} />
          <Button type="button" disabled={!title.trim()} onClick={() => void create()}>Tạo</Button>
        </div>
      </Card>

      {active && progress && (
        <Card title={`${active.title}${active.career_name ? ` · ${active.career_name}` : ''}`}>
          {active.target_date && <p>Mục tiêu: {new Date(active.target_date).toLocaleDateString('vi-VN')}</p>}
          {(active.education_level || active.school_year) && <p>Điểm xuất phát: {[active.education_level, active.school_year].filter(Boolean).join(' · ')}</p>}
          <ProgressBar value={progress.actualPercent} label="Tiến độ hoàn thành" />
          <p>Hoàn thành {progress.actualPercent}% · Kế hoạch đến hôm nay {progress.plannedPercent}% · Chậm {progress.delayPercent}%</p>
          {progress.offTrack && (
            <Alert variant="warning" title="Lộ trình đang chệch hướng">
              {progress.delayPercent > 20 && `Chậm ${progress.delayPercent}% so với phần việc đã đến hạn. `}
              {progress.missedCheckpoints.map((m) => `Trễ cột mốc quan trọng: ${m.title}. `)}
            </Alert>
          )}
          <ul className="module-list">
            {progress.byPillar.map((p) => (
              <li key={p.pillar}><span>{pillarLabel(p.pillar)}</span><span>{p.done}/{p.total} hoạt động</span><strong>{p.percent}%</strong></li>
            ))}
          </ul>

          <div className="module-actions">
            <Button type="button" variant="outline" onClick={() => void fillFromLibrary()}>Sinh hoạt động từ thư viện đã duyệt</Button>
          </div>

          <h3>Bản đồ đường đi</h3>
          {active.milestones.length === 0 ? <p>Chưa có mốc. Sinh từ thư viện để có các giai đoạn theo tháng, rồi theo quý.</p> : (
            <ol className="module-list">
              {[...new Set(active.milestones.map((item) => item.due_date?.slice(0, 7) ?? 'Chưa hạn'))].map((phase) => (
                <li key={phase}>
                  <strong>{phase}</strong>
                  <span>{active.milestones.filter((item) => (item.due_date?.slice(0, 7) ?? 'Chưa hạn') === phase).map((item) => item.title).join(' · ')}</span>
                </li>
              ))}
            </ol>
          )}
          <h3>Thêm hoạt động</h3>
          <div className="module-form">
            <Select label="Trụ cột" value={form.pillar} options={PILLARS} onChange={(v) => setForm({ ...form, pillar: v })} />
            <Input label="Nội dung" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input label="Hạn" type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
            <Input label="Trọng số" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} inputMode="decimal" />
            <Checkbox label="Cột mốc quan trọng" checked={form.checkpoint} onChange={(checked) => setForm({ ...form, checkpoint: checked })} />
            <Button type="button" disabled={!form.title.trim()} onClick={() => void add()}>Thêm</Button>
          </div>

          {active.milestones.length === 0 ? <p>Chưa có hoạt động.</p> : (
            <ul className="module-list">
              {active.milestones.map((m) => (
                <li key={m.id}>
                  <Badge>{pillarLabel(m.pillar)}</Badge>
                  <span>{m.title}</span>
                  {m.due_date && <span>Hạn {new Date(m.due_date).toLocaleDateString('vi-VN')}</span>}
                  {m.is_checkpoint && <Badge variant="warning">Cột mốc</Badge>}
                  <span>Trọng số {m.weight}</span>
                  <Button type="button" size="sm" variant={m.done ? 'primary' : 'outline'}
                    onClick={() => void callRpc('toggle_roadmap_milestone', { p_milestone_id: m.id, p_done: !m.done }).then(reload)}>
                    {m.done ? 'Đã xong' : 'Đánh dấu xong'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {history.length > 0 && (
        <Card title="Lịch sử lộ trình">
          <ul className="module-list">
            {history.map((r) => (
              <li key={r.id}>
                <span>{r.title}</span>
                <span>{new Date(r.created_at).toLocaleDateString('vi-VN')}</span>
                <span>{r.milestones.filter((m) => m.done).length}/{r.milestones.length} hoạt động</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};
