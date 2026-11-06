import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clock, Flag, History, ListChecks, Map as MapIcon, Pencil, Route, ShieldCheck, Target } from 'lucide-react';
import {
  Alert,
  Button,
  Input,
  Modal,
  PageHero,
  Select,
  Skeleton,
  SkeletonRegion,
  StatTile,
  Tabs,
  type TabItem,
} from '../../../components/common';
import { daysUntil } from '../../../domain/assessmentRules';
import { generateRoadmapFromLibrary, type ApprovedActivityTemplate } from '../../../domain/roadmapGeneration';
import { callRpc, db } from '../../../lib/rpc';
import { listPublishedCareers, loadLearnerProfile, recommendCareers, listSavedCareers } from '../../career_explorer/career.service';
import { useAuth } from '../../auth/AuthContext';
import type { FilterOption } from '../../../types/filter';
import { RoadmapAlerts } from '../components/RoadmapAlerts';
import { RoadmapCheckpoints } from '../components/RoadmapCheckpoints';
import { RoadmapMap } from '../components/RoadmapMap';
import { RoadmapProgress } from '../components/RoadmapProgress';
import { RoadmapSetup, type CareerChoice } from '../components/RoadmapSetup';
import {
  EMPTY_SETUP,
  PILLAR_LABEL,
  PILLAR_ORDER,
  buildStages,
  currentStage,
  monthEndFromInput,
  monthsLeft,
  originFromProfile,
  progressOf,
  validateSetup,
} from '../roadmap.logic';
import type { Roadmap, RoadmapPillar, SetupErrors, SetupValues, SoftSkill, Stage } from '../roadmap.types';
import './RoadmapPage.css';

type TabKey = 'thiet-lap' | 'lo-trinh' | 'cot-moc' | 'tien-do' | 'canh-bao';
const TAB_KEYS: TabKey[] = ['thiet-lap', 'lo-trinh', 'cot-moc', 'tien-do', 'canh-bao'];

const PILLAR_OPTIONS = PILLAR_ORDER.map((value) => ({ value, label: PILLAR_LABEL[value] }));

function generationError(caught: unknown): string {
  const text = String((caught as { message?: string })?.message ?? caught);
  if (text.includes('library_incomplete')) return 'Chưa có đủ hoạt động gợi ý cho cả ba trụ cột.';
  if (text.includes('horizon_invalid') || text.includes('hours_per_week')) return 'Thời hạn phải ở tương lai (tối đa 10 năm) và số giờ mỗi tuần lớn hơn 0.';
  return 'Không gợi ý được hoạt động. Thử lại sau.';
}

const RoadmapSkeleton: React.FC = () => (
  <SkeletonRegion className="roadmap-skeleton">
    <Skeleton shape="title" width={40} />
    <div className="roadmap-stats">
      {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} shape="block" />)}
    </div>
    <Skeleton shape="button-lg" width={60} />
    <Skeleton shape="block" />
  </SkeletonRegion>
);

/** Lộ trình phát triển: thiết lập, bản đồ đường đi, cột mốc, tiến độ, cảnh báo chệch hướng */
export const RoadmapPage: React.FC = () => {
  const { session, profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [programId] = useState(() => {
    const raw = params.get('chuong-trinh') ?? '';
    return /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
  });
  const [roadmaps, setRoadmaps] = useState<Roadmap[] | null>(null);
  const [choices, setChoices] = useState<CareerChoice[]>([]);
  const [catalog, setCatalog] = useState<FilterOption[]>([]);
  const [values, setValues] = useState<SetupValues>(() => ({ ...EMPTY_SETUP, careerIds: params.get('nghe') ? [params.get('nghe') as string] : [] }));
  const [errors, setErrors] = useState<SetupErrors>({});
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [hours, setHours] = useState('8');
  const [softSkills, setSoftSkills] = useState<SoftSkill[]>([]);
  const [adding, setAdding] = useState<{ stage: Stage; pillar: RoadmapPillar; title: string } | null>(null);

  const reload = useCallback(async () => {
    const value = await callRpc<Roadmap[]>('list_my_roadmaps');
    setRoadmaps(value ?? []);
    return value ?? [];
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      reload(),
      listSavedCareers().catch(() => []),
      recommendCareers().catch(() => null),
      listPublishedCareers().catch(() => []),
      callRpc<SoftSkill[]>('get_roadmap_soft_skills').catch(() => []),
    ])
      .then(([, saved, recs, all, skills]) => {
        if (!alive) return;
        setSoftSkills(skills ?? []);
        const map = new Map<string, CareerChoice>();
        for (const item of recs?.items.slice(0, 5) ?? []) map.set(item.careerId, { id: item.careerId, name: item.careerName, from360: true });
        for (const t of saved.filter((s) => s.kind === 'target')) {
          if (!map.has(t.career_id)) map.set(t.career_id, { id: t.career_id, name: t.career_name, from360: false });
        }
        const wanted = params.get('nghe');
        if (wanted && !map.has(wanted)) {
          const found = all.find((c) => c.id === wanted);
          if (found) map.set(wanted, { id: found.id, name: found.career_name, from360: false });
        }
        setChoices([...map.values()].slice(0, 6));
        setCatalog(all.map((c) => ({ value: c.id, label: c.career_name })));
      })
      .catch(() => alive && setError('Không tải được lộ trình.'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  const active = roadmaps?.find((r) => r.is_active) ?? null;
  const history = useMemo(() => roadmaps?.filter((r) => !r.is_active) ?? [], [roadmaps]);
  const viewing = viewingId ? roadmaps?.find((r) => r.id === viewingId) ?? null : null;
  const shown = viewing ?? active;
  const readOnly = Boolean(viewing);

  const requested = params.get('tab') as TabKey | null;
  const tab: TabKey = !active ? 'thiet-lap' : requested && TAB_KEYS.includes(requested) ? requested : 'lo-trinh';
  const setTab = (next: string) => {
    setNotice(null);
    setParams((prev) => {
      const copy = new URLSearchParams(prev);
      copy.set('tab', next);
      copy.delete('nghe');
      return copy;
    }, { replace: true });
  };

  const stages = useMemo(() => (shown ? buildStages(shown.milestones) : []), [shown]);
  const progress = useMemo(() => (shown ? progressOf(shown) : null), [shown]);
  const focus = currentStage(stages);
  const checkpoints = useMemo(() => shown?.milestones.filter((m) => m.is_checkpoint) ?? [], [shown]);

  const careerName = useCallback(
    (id: string) => choices.find((c) => c.id === id)?.name ?? catalog.find((c) => c.value === id)?.label ?? '',
    [choices, catalog],
  );

  /** Mở màn thiết lập: điền sẵn từ lộ trình hiện tại khi tạo lại */
  const openSetup = () => {
    if (active) {
      setValues({
        careerIds: active.careers.length > 0 ? active.careers.map((c) => c.id) : active.career_id ? [active.career_id] : [],
        reason: '',
        educationLevel: active.education_level ?? '',
        schoolYear: active.school_year ?? '',
        skills: active.current_skills ?? '',
        certificates: active.certificates ?? '',
        extracurricular: active.extracurricular ?? '',
        targetMonth: '',
        hoursPerWeek: String(active.hours_per_week ?? hours),
      });
    }
    setErrors({});
    setViewingId(null);
    setTab('thiet-lap');
  };

  const fillFromProfile = () => {
    const origin = originFromProfile(profile?.role, profile?.grade_or_major);
    setValues((prev) => ({ ...prev, ...origin }));
  };

  const generateInto = async (roadmapId: string, targetDate: string, hoursPerWeek: number) => {
    const { data, error: loadError } = await db.from('approved_roadmap_activities').select('*').eq('is_active', true);
    if (loadError) throw loadError;
    const templates: ApprovedActivityTemplate[] = ((data ?? []) as Array<{
      id: string; pillar: ApprovedActivityTemplate['pillar']; title: string;
      duration_weeks: number; hours: number; criteria_id: string | null; repeatable: boolean;
      activity_type: ApprovedActivityTemplate['activityType']; is_partner: boolean; expected_result: string | null;
    }>).map((row) => ({
      id: row.id,
      pillar: row.pillar,
      title: row.title,
      durationWeeks: Number(row.duration_weeks),
      hours: Number(row.hours),
      criteriaId: row.criteria_id,
      repeatable: row.repeatable,
      activityType: row.activity_type,
      isPartner: row.is_partner,
      expectedResult: row.expected_result,
    }));
    const learner = session?.user.id ? await loadLearnerProfile(session.user.id).catch(() => null) : null;
    const generated = generateRoadmapFromLibrary({
      startDay: new Date().toISOString().slice(0, 10),
      targetDate,
      hoursPerWeek,
      templates,
      scoresByCriterionId: learner ? Object.fromEntries(learner.scoreByCriterionId) : undefined,
    });
    await callRpc<number>('add_roadmap_milestones_bulk', {
      p_roadmap_id: roadmapId,
      p_items: generated.map((item) => ({
        pillar: item.pillar,
        title: item.title,
        due_date: item.dueDate,
        weight: item.weight,
        is_checkpoint: item.isCheckpoint,
        activity_type: item.activityType,
        is_partner: item.isPartner,
        expected_result: item.expectedResult,
        pass_criteria: item.isCheckpoint ? 'Hoàn thành mọi hoạt động của giai đoạn' : null,
        fail_criteria: item.isCheckpoint ? 'Còn hoạt động chưa xong khi đến hạn' : null,
      })),
    });
  };

  const submitSetup = async () => {
    const found = validateSetup(values, Boolean(active));
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (active && !confirmOpen) {
      setConfirmOpen(true);
      return;
    }
    setConfirmOpen(false);
    setSubmitting(true);
    setError(null);
    const targetDate = monthEndFromInput(values.targetMonth)!;
    let createdId: string | null = null;
    try {
      createdId = await callRpc<string>('create_roadmap', {
        p_career_id: values.careerIds[0],
        p_title: `${values.careerIds.map(careerName).join(' + ')} · ${values.targetMonth.trim()}`,
        p_target_date: targetDate,
        p_hours_per_week: Number(values.hoursPerWeek),
        p_reason: active ? values.reason : null,
      });
      if (values.careerIds.length > 1) await callRpc('set_roadmap_careers', { p_roadmap_id: createdId, p_career_ids: values.careerIds });
      if (programId) await callRpc('set_roadmap_program', { p_roadmap_id: createdId, p_training_program_id: programId });
      await callRpc('save_roadmap_origin', {
        p_roadmap_id: createdId,
        p_education_level: values.educationLevel,
        p_school_year: values.schoolYear,
        p_skills: values.skills,
        p_certificates: values.certificates,
        p_extracurricular: values.extracurricular,
      });
      setHours(values.hoursPerWeek);
      await generateInto(createdId, targetDate, Number(values.hoursPerWeek));
      setNotice('Đã tạo lộ trình mới. Lộ trình cũ được lưu vào lịch sử.');
    } catch (caught) {
      setError(createdId ? generationError(caught) : 'Không tạo được lộ trình. Thử lại sau.');
    } finally {
      await reload().catch(() => undefined);
      setViewingId(null);
      setSubmitting(false);
      if (createdId) setTab('lo-trinh');
    }
  };

  const suggest = async () => {
    if (!active?.target_date) return;
    setBusy(true);
    setError(null);
    try {
      await generateInto(active.id, active.target_date, Number(hours));
      await reload();
      setSuggestOpen(false);
    } catch (caught) {
      setError(generationError(caught));
      setSuggestOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const run = async (action: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  const saveProgress = (changes: Record<string, { done?: boolean; note?: string }>) =>
    run(
      () => callRpc('save_roadmap_progress', { p_items: Object.entries(changes).map(([id, change]) => ({ id, ...change })) }),
      'Không lưu được cập nhật. Thử lại sau.',
    );

  const previewDue = (id: string, due: string) =>
    callRpc<{ conflicts: { id: string; title: string; due_date: string }[] }>('update_roadmap_milestone_due', {
      p_milestone_id: id,
      p_due_date: due,
      p_apply: false,
    });

  const applyDue = (id: string, due: string) =>
    run(() => callRpc('update_roadmap_milestone_due', { p_milestone_id: id, p_due_date: due, p_apply: true }), 'Không đổi được hạn. Thử lại sau.');

  const addMilestone = (input: { title: string; due: string; pillar: RoadmapPillar; checkpoint: boolean; passCriteria?: string }) =>
    active
      ? run(
          () =>
            callRpc('add_roadmap_milestone', {
              p_roadmap_id: active.id,
              p_pillar: input.pillar,
              p_title: input.title,
              p_due_date: input.due || null,
              p_weight: 1,
              p_is_checkpoint: input.checkpoint,
              p_pass_criteria: input.passCriteria || null,
            }),
          'Không thêm được. Nhập nội dung và hạn.',
        )
      : Promise.resolve();

  const tabs: TabItem[] = [
    { value: 'thiet-lap', label: 'Thiết lập', icon: <Pencil /> },
    { value: 'lo-trinh', label: 'Lộ trình', icon: <Route /> },
    { value: 'cot-moc', label: 'Cột mốc', icon: <Flag /> },
    { value: 'tien-do', label: 'Tiến độ', icon: <ListChecks /> },
    { value: 'canh-bao', label: 'Cảnh báo', icon: <ShieldCheck />, alert: Boolean(progress?.offTrack) && !readOnly },
  ];

  if (roadmaps === null) {
    return error ? (
      <Alert variant="danger">{error}</Alert>
    ) : (
      <RoadmapSkeleton />
    );
  }

  const left = shown ? monthsLeft(shown.target_date) : null;
  const dayLeft = shown?.target_date ? daysUntil(shown.target_date) : null;

  return (
    <div className="roadmap-page">
      <PageHero
        title="Lộ trình"
        icon={<MapIcon />}
        tone="teal"
        actions={
          viewing ? (
            <Button variant="outline" leftIcon={<ArrowLeft size={16} />} onClick={() => setViewingId(null)}>
              Về lộ trình hiện tại
            </Button>
          ) : active && tab !== 'thiet-lap' ? (
            <Button variant="outline" leftIcon={<Pencil size={16} />} onClick={openSetup}>
              Chỉnh thiết lập
            </Button>
          ) : undefined
        }
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      {viewing && <Alert variant="info">Đang xem lộ trình đã lưu trữ: {viewing.title}</Alert>}

      {active && shown && progress && (
        <>
          <div className="roadmap-stats">
            <StatTile label="Hoàn thành" tone="teal" icon={<ListChecks />} value={Math.round(progress.actualPercent)} unit="%" />
            <StatTile label="Kế hoạch đến hôm nay" tone="blue" icon={<Target />} value={Math.round(progress.plannedPercent)} unit="%" />
            <StatTile
              label="Còn lại"
              tone="violet"
              icon={<Clock />}
              value={dayLeft !== null && dayLeft < 0 ? 'Quá hạn' : left ?? '—'}
              unit={dayLeft !== null && dayLeft >= 0 ? 'tháng' : undefined}
            />
            <StatTile
              label="Trạng thái"
              tone={progress.offTrack ? 'coral' : 'gold'}
              icon={<History />}
              value={progress.offTrack ? 'Chệch hướng' : 'Đúng hướng'}
            />
          </div>
          <Tabs items={tabs} value={tab} onChange={setTab} label="Các mục của lộ trình" />
        </>
      )}

      {tab === 'thiet-lap' && (
        <RoadmapSetup
          values={values}
          errors={errors}
          choices={choices}
          catalog={catalog}
          submitting={submitting}
          submitLabel={active ? 'Tạo lại lộ trình' : 'Tạo lộ trình'}
          askReason={Boolean(active)}
          nameOf={careerName}
          onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
          onFillFromProfile={fillFromProfile}
          onSubmit={() => void submitSetup()}
          onCancel={active ? () => setTab('lo-trinh') : undefined}
        />
      )}

      {shown && tab === 'lo-trinh' && (
        <RoadmapMap
          roadmap={shown}
          stages={stages}
          readOnly={readOnly}
          softSkills={softSkills}
          onSuggest={() => setSuggestOpen(true)}
          onAddToStage={(stage, pillar) => setAdding({ stage, pillar, title: '' })}
        />
      )}

      {shown && tab === 'cot-moc' && (
        <RoadmapCheckpoints
          checkpoints={checkpoints}
          readOnly={readOnly}
          busy={busy}
          activities={shown.milestones}
          onPreviewDue={previewDue}
          onApplyDue={applyDue}
          onAdd={(input) => addMilestone({ ...input, checkpoint: true })}
        />
      )}

      {shown && tab === 'tien-do' && (
        <RoadmapProgress
          key={shown.id}
          roadmap={shown}
          stages={stages}
          focusKey={focus?.key ?? stages[0]?.key ?? ''}
          readOnly={readOnly}
          busy={busy}
          onSave={saveProgress}
        />
      )}

      {active && progress && tab === 'canh-bao' && (
        <RoadmapAlerts
          roadmap={active}
          history={history}
          progress={progressOf(active)}
          viewingId={viewingId}
          onRegenerate={openSetup}
          onView={(id) => {
            setViewingId(id);
            setTab('lo-trinh');
          }}
          onBackToActive={() => setViewingId(null)}
        />
      )}

      <Modal
        open={confirmOpen}
        title="Tạo lại lộ trình"
        onClose={() => setConfirmOpen(false)}
        locked={submitting}
        actions={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Giữ lộ trình hiện tại</Button>
            <Button isLoading={submitting} onClick={() => void submitSetup()}>Tạo lại lộ trình</Button>
          </>
        }
      >
        <p>Lộ trình cũ sẽ được lưu vào lịch sử. Chỉ có một lộ trình đang thực hiện tại một thời điểm.</p>
      </Modal>

      <Modal
        open={suggestOpen}
        title="Gợi ý hoạt động"
        onClose={() => setSuggestOpen(false)}
        locked={busy}
        actions={
          <>
            <Button variant="outline" onClick={() => setSuggestOpen(false)}>Hủy</Button>
            <Button isLoading={busy} disabled={!(Number(hours) >= 1)} onClick={() => void suggest()}>Gợi ý</Button>
          </>
        }
      >
        <Input
          label="Số giờ mỗi tuần có thể đầu tư"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={hours}
          onChange={(event) => setHours(event.target.value)}
        />
      </Modal>

      <Modal
        open={Boolean(adding)}
        title="Thêm hoạt động"
        onClose={() => setAdding(null)}
        locked={busy}
        actions={
          <>
            <Button variant="outline" onClick={() => setAdding(null)}>Hủy</Button>
            <Button
              isLoading={busy}
              disabled={!adding?.title.trim()}
              onClick={() => {
                if (!adding) return;
                void addMilestone({
                  title: adding.title,
                  due: adding.stage.endIso ?? '',
                  pillar: adding.pillar,
                  checkpoint: false,
                }).then(() => setAdding(null));
              }}
            >
              Thêm
            </Button>
          </>
        }
      >
        {adding && (
          <div className="roadmap-fields is-single">
            <Select
              label="Trụ cột"
              options={PILLAR_OPTIONS}
              value={adding.pillar}
              onChange={(value) => setAdding({ ...adding, pillar: value as RoadmapPillar })}
            />
            <Input label="Nội dung" value={adding.title} onChange={(event) => setAdding({ ...adding, title: event.target.value })} />
          </div>
        )}
      </Modal>
    </div>
  );
};
