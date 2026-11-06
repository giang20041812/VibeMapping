import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Scale, Search, SearchX, Settings2, Trash2 } from 'lucide-react';
import {
  Alert, Badge, Button, Card, Input, Modal, PageHero, Select, StickerCard, StickerFact, StickerGrid, Textarea, stickerToneAt,
} from '../../../components/common';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { compareDecisionOptions, type DecisionOptionInput, type RankedDecisionOption } from '../../../domain/assessmentRules';
import { callRpc, db } from '../../../lib/rpc';
import { clearProgramCompare, readProgramCompare } from '../../../lib/selectionCart';
import { useAuth } from '../../auth/AuthContext';
import { recommendCareers, searchCareers, type CareerListItem } from '../../career_explorer/career.service';
import '../../career_explorer/pages/CareerPages.css';
import './DecisionPages.css';

interface OptionDraft {
  id: string;
  title: string;
  careerId: string;
  admissionFloor: string;
  tuitionPerYear: string;
  locationScore: string;
}

interface SavedPlan {
  id: string;
  title: string;
  ranking: RankedDecisionOption[];
  preferred_option_id: string | null;
  preferred_reason: string | null;
  created_at: string;
  report: { id: string; include_finance: boolean; owner_confirmed_at: string | null; shares: { user_id: string; consensus_at: string | null; comment: string | null }[] } | null;
}

interface HistoryEntry { plan_id: string; action: string; note: string | null; created_at: string }

const ELIGIBILITY_LABEL = { MET: 'Đáp ứng', NOT_MET: 'Chưa đáp ứng', UNKNOWN: 'Chưa đủ dữ liệu' } as const;
const ELIGIBILITY_VARIANT = { MET: 'success', NOT_MET: 'danger', UNKNOWN: 'default' } as const;

const LOCATION_OPTIONS = [
  { value: '100', label: 'Rất thuận tiện' },
  { value: '80', label: 'Thuận tiện' },
  { value: '60', label: 'Bình thường' },
  { value: '40', label: 'Hơi bất tiện' },
  { value: '20', label: 'Bất tiện' },
];
const LEVEL_OPTIONS = [
  { value: '1', label: 'Thấp' },
  { value: '2', label: 'Vừa' },
  { value: '3', label: 'Cao' },
];
const WEIGHT_FIELDS = [
  { key: 'careerFit', label: 'Phù hợp nghề' },
  { key: 'admission', label: 'Đáp ứng đầu vào' },
  { key: 'finance', label: 'Tài chính' },
  { key: 'location', label: 'Địa điểm' },
] as const;
const MAX_OPTIONS = 4;
const MIN_OPTIONS = 2;

const blank = (index: number): OptionDraft => ({
  id: `opt-${Date.now()}-${index}`,
  title: '',
  careerId: '',
  admissionFloor: '',
  tuitionPerYear: '',
  locationScore: '',
});

const num = (value: string): number | null => {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export const DecisionComparePage: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [careers, setCareers] = useState<CareerListItem[]>([]);
  const [fitByCareer, setFitByCareer] = useState<Map<string, number>>(new Map());
  const [options, setOptions] = useState<OptionDraft[]>([blank(0), blank(1)]);
  const [learnerScore, setLearnerScore] = useState('');
  const [budget, setBudget] = useState('');
  const [weights, setWeights] = useState({ careerFit: '3', admission: '3', finance: '2', location: '1' });
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [parents, setParents] = useState<{ user_id: string; name: string }[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyPlanId, setHistoryPlanId] = useState<string | null>(null);
  const [preferring, setPreferring] = useState<{ planId: string; optionId: string; reason: string } | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [hasCart, setHasCart] = useState(() => readProgramCompare().length > 0);

  const reload = useCallback(async () => {
    const [list, connections] = await Promise.all([
      callRpc<SavedPlan[]>('list_my_comparison_plans'),
      callRpc<{ parents: { user_id: string; name: string }[] }>('list_my_connections'),
    ]);
    setPlans(list ?? []);
    setParents(connections?.parents ?? []);
    const { data: entries } = await db.from('decision_history').select('plan_id, action, note, created_at').order('created_at', { ascending: false });
    setHistory((entries ?? []) as HistoryEntry[]);
  }, []);

  useEffect(() => {
    searchCareers('').then(setCareers).catch(() => undefined);
    reload().catch(() => setMessage({ tone: 'danger', text: 'Không tải được phương án đã lưu.' }));
    if (session?.user.id) {
      recommendCareers()
        .then((r) => setFitByCareer(new Map(r.items.map((i) => [i.careerId, i.fitPercent]))))
        .catch(() => undefined);
      callRpc<{ latest_score: number | null; budget_per_year: number | null }>('get_my_study_finance')
        .then((row) => {
          if (row?.latest_score != null) setLearnerScore(String(row.latest_score));
          if (row?.budget_per_year != null) setBudget(String(row.budget_per_year));
        })
        .catch(() => undefined);
    }
    const cart = readProgramCompare();
    if (cart.length >= 1) {
      const drafts = cart.map((item) => ({
        id: item.programId,
        title: item.title,
        careerId: item.careerId,
        admissionFloor: item.admissionFloor,
        tuitionPerYear: item.tuitionPerYear,
        locationScore: '',
      }));
      setOptions(drafts.length === 1 ? [...drafts, blank(1)] : drafts);
    }
  }, [reload, session?.user.id]);

  const inputs: DecisionOptionInput[] = options.map((o) => ({
    id: o.id,
    title: o.title || careers.find((c) => c.id === o.careerId)?.career_name || 'Phương án',
    admissionFloor: num(o.admissionFloor),
    learnerScore: num(learnerScore),
    tuitionPerYear: num(o.tuitionPerYear),
    careerFitPercent: o.careerId ? fitByCareer.get(o.careerId) ?? null : null,
    locationScore: num(o.locationScore),
  }));
  const ranked = useMemo(
    () =>
      options.length >= MIN_OPTIONS
        ? compareDecisionOptions(
            inputs,
            { careerFit: num(weights.careerFit) ?? 0, admission: num(weights.admission) ?? 0, finance: num(weights.finance) ?? 0, location: num(weights.location) ?? 0 },
            num(budget),
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(inputs), weights, budget, options.length],
  );
  const rankedById = useMemo(() => new Map(ranked.map((r) => [r.id, r])), [ranked]);
  const [admissionNotes, setAdmissionNotes] = useState<Record<string, string>>({});
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const backups = ranked.filter((r) => r.eligibility !== 'NOT_MET' && !r.overBudget).slice(1, 4);
  const needBackup = ranked.length > 0 && ranked.some((r) => r.eligibility === 'NOT_MET' || r.overBudget);

  useEffect(() => {
    const ids = options.map((option) => option.id).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    if (ids.length === 0) {
      setAdmissionNotes({});
      return;
    }
    let active = true;
    db.from('admission_data')
      .select('training_program_id, admission_year, admission_method, cutoff_score')
      .in('training_program_id', ids)
      .order('admission_year', { ascending: false })
      .then(({ data }) => {
        if (!active) return;
        const notes: Record<string, string> = {};
        const score = num(learnerScore);
        for (const id of ids) {
          const rows = (data ?? []).filter((row) => row.training_program_id === id);
          const latest = rows.find((row) => row.cutoff_score !== null) ?? rows[0];
          if (!latest) notes[id] = 'Chưa có điểm chuẩn theo năm và phương thức.';
          else if (score === null || latest.cutoff_score === null) notes[id] = `Năm ${latest.admission_year ?? '–'}, ${latest.admission_method ?? 'chưa ghi phương thức'}.`;
          else if (score >= Number(latest.cutoff_score)) notes[id] = `Điểm ${score} đạt điểm chuẩn ${latest.cutoff_score} (năm ${latest.admission_year}, ${latest.admission_method ?? 'chưa ghi phương thức'}).`;
          else notes[id] = `Điểm ${score} thấp hơn điểm chuẩn ${latest.cutoff_score} (năm ${latest.admission_year}, ${latest.admission_method ?? 'chưa ghi phương thức'}).`;
        }
        setAdmissionNotes(notes);
      });
    return () => {
      active = false;
    };
  }, [options, learnerScore]);

  useEffect(() => {
    const lead = ranked[0];
    if (!lead || (lead.eligibility !== 'NOT_MET' && !lead.overBudget) || !/^[0-9a-f-]{36}$/i.test(lead.id)) {
      setAlternatives([]);
      return;
    }
    let active = true;
    db.from('training_programs').select('major_id').eq('id', lead.id).maybeSingle().then(async ({ data }) => {
      if (!active) return;
      if (!data?.major_id) {
        setAlternatives([]);
        return;
      }
      const { data: peers } = await db
        .from('training_programs')
        .select('id, specialization_name, institution:institutions(institution_name), major:majors(major_name)')
        .eq('major_id', data.major_id)
        .neq('id', lead.id)
        .limit(3);
      if (!active) return;
      const lines = (peers ?? []).map((peer) => {
        const row = peer as {
          specialization_name: string | null;
          institution: { institution_name: string } | { institution_name: string }[] | null;
          major: { major_name: string } | { major_name: string }[] | null;
        };
        const school = Array.isArray(row.institution) ? row.institution[0]?.institution_name : row.institution?.institution_name;
        const major = Array.isArray(row.major) ? row.major[0]?.major_name : row.major?.major_name;
        return `${school ?? 'Trường'} – ${major ?? 'ngành'}${row.specialization_name ? ` (${row.specialization_name})` : ''}`;
      });
      setAlternatives(lines);
    });
    return () => {
      active = false;
    };
  }, [ranked]);

  const patch = (id: string, change: Partial<OptionDraft>) => setOptions((list) => list.map((o) => (o.id === id ? { ...o, ...change } : o)));
  const careerOptions = useMemo(() => careers.map((c) => ({ value: c.id, label: c.career_name })), [careers]);

  const save = async () => {
    setMessage(null);
    try {
      await callRpc('save_decision_plan', {
        p_title: title,
        p_career_ids: options.map((o) => o.careerId).filter(Boolean),
        p_options: inputs.map((input, index) => ({ ...input, careerId: options[index]?.careerId || null })),
        p_weights: weights,
        p_budget: num(budget),
        p_learner_score: num(learnerScore),
        p_ranking: ranked,
      });
      setTitle('');
      setMessage({ tone: 'success', text: 'Đã lưu phương án.' });
      await reload();
    } catch {
      setMessage({ tone: 'danger', text: 'Chưa lưu được. Cần 2–4 phương án và tên bộ phương án.' });
    }
  };

  const setGoal = async (planId: string) => {
    setMessage(null);
    try {
      const careerId = await callRpc<string>('set_decision_goal', { p_plan_id: planId });
      const plan = plans.find((p) => p.id === planId);
      const program = plan?.preferred_option_id && /^[0-9a-f-]{36}$/i.test(plan.preferred_option_id) ? `&chuong-trinh=${plan.preferred_option_id}` : '';
      navigate(`/lo-trinh?nghe=${careerId}${program}`);
    } catch (caught) {
      const text = String((caught as { message?: string })?.message ?? '');
      const known: Record<string, string> = {
        no_preferred_option: 'Chọn phương án ưu tiên trước.',
        option_without_career: 'Phương án ưu tiên chưa gắn nghề.',
        consensus_required: 'Cần phụ huynh đồng thuận trước khi chốt mục tiêu.',
        target_career_limit: 'Chỉ đặt được tối đa 2 nghề mục tiêu.',
      };
      const key = Object.keys(known).find((code) => text.includes(code));
      setMessage({ tone: 'danger', text: key ? known[key] : 'Chưa đặt được mục tiêu.' });
    }
  };

  const historyLabel = (entry: HistoryEntry, plan: SavedPlan | undefined): string => {
    if (entry.action === 'created') return 'Tạo bộ phương án';
    if (entry.action.startsWith('preferred:')) {
      const title = plan?.ranking.find((r) => r.id === entry.action.slice('preferred:'.length))?.title;
      return `Chọn phương án ưu tiên${title ? `: ${title}` : ''}${entry.note ? ` (${entry.note})` : ''}`;
    }
    if (entry.action === 'report_created') return 'Tạo báo cáo';
    if (entry.action === 'consensus_confirmed') return `Phụ huynh đồng thuận${entry.note ? `: ${entry.note}` : ''}`;
    if (entry.action === 'goal_set') return `Đặt nghề mục tiêu${entry.note ? `: ${entry.note}` : ''}`;
    return entry.action;
  };

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setMessage(null);
    try {
      await fn();
      setMessage({ tone: 'success', text: ok });
      await reload();
    } catch (caught) {
      const text = String((caught as { message?: string })?.message ?? '');
      setMessage({
        tone: 'danger',
        text: text.includes('guardian_consent_required')
          ? 'Bạn cần xác nhận của người giám hộ trước khi chia sẻ.'
          : text.includes('parent_not_linked') ? 'Phụ huynh chưa liên kết với bạn.' : 'Thao tác không thành công.',
      });
    }
  };

  const saveFinance = () =>
    callRpc('save_my_study_finance', {
      p_latest_score: num(learnerScore),
      p_subject_combination: null,
      p_admission_method: null,
      p_recorded_year: null,
      p_budget_per_year: num(budget),
      p_budget_note: null,
    })
      .then(() => setMessage({ tone: 'success', text: 'Đã lưu điểm và ngân sách vào hồ sơ.' }))
      .catch(() => setMessage({ tone: 'danger', text: 'Chưa lưu được vào hồ sơ.' }));

  const confirmPreferred = () => {
    if (!preferring) return;
    const current = preferring;
    setPreferring(null);
    void act(
      () => callRpc('set_preferred_option', { p_plan_id: current.planId, p_option_id: current.optionId, p_reason: current.reason }),
      'Đã đánh dấu phương án ưu tiên.',
    );
  };
  const preferringPlan = plans.find((p) => p.id === preferring?.planId);

  return (
    <div className="module-page">
      <PageHero
        title="So sánh phương án"
        icon={<Scale />}
        tone="violet"
        count={options.length}
        countLabel={`/ ${MAX_OPTIONS} phương án`}
        actions={
          <>
            <Button type="button" variant="outline" leftIcon={<Settings2 size={16} />} onClick={() => setWeightsOpen(true)}>Mức quan trọng</Button>
            <Button type="button" variant="outline" leftIcon={<Search size={16} />} onClick={() => navigate('/kham-pha-truong')}>Chọn chương trình</Button>
          </>
        }
      />
      {message && <Alert variant={message.tone}>{message.text}</Alert>}

      <Card title="Điểm và ngân sách">
        <div className="module-form">
          <Input label="Điểm xét tuyển của bạn" value={learnerScore} onChange={(e) => setLearnerScore(e.target.value)} inputMode="decimal" />
          <Input label="Ngân sách học phí mỗi năm (triệu đồng)" value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" />
          <div className="module-actions">
            <Button type="button" variant="outline" onClick={() => void saveFinance()}>Lưu vào hồ sơ</Button>
            {hasCart && (
              <Button type="button" variant="ghost" leftIcon={<Trash2 size={16} />} onClick={() => { clearProgramCompare(); setHasCart(false); setMessage({ tone: 'info', text: 'Đã xóa danh sách chương trình đã chọn.' }); }}>
                Xóa chương trình đã chọn
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="decision-layout">
        <section className="decision-main" aria-label="Bảng so sánh phương án">
          <div className="explain-table-wrap">
            <table className="explain-table compare-table decision-table">
              <thead>
                <tr>
                  <th scope="col">Tiêu chí</th>
                  {options.map((o, index) => (
                    <th key={o.id} scope="col">
                      <div className="decision-col-head">
                        <span>Phương án {index + 1}</span>
                        {options.length > MIN_OPTIONS && (
                          <Button type="button" size="sm" variant="ghost" aria-label={`Bỏ phương án ${index + 1}`} onClick={() => setOptions((list) => list.filter((x) => x.id !== o.id))}>
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Trường – ngành</th>
                  {options.map((o) => (
                    <td key={o.id}><Input aria-label="Trường – ngành" value={o.title} onChange={(e) => patch(o.id, { title: e.target.value })} /></td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Nghề hướng tới</th>
                  {options.map((o) => (
                    <td key={o.id}>
                      <SearchableSelect placeholder="Chưa chọn" options={careerOptions} value={o.careerId} onChange={(v) => patch(o.id, { careerId: v })} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Ngưỡng điểm</th>
                  {options.map((o) => (
                    <td key={o.id}><Input aria-label="Ngưỡng điểm" value={o.admissionFloor} onChange={(e) => patch(o.id, { admissionFloor: e.target.value })} inputMode="decimal" /></td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Học phí mỗi năm (triệu)</th>
                  {options.map((o) => (
                    <td key={o.id}><Input aria-label="Học phí mỗi năm" value={o.tuitionPerYear} onChange={(e) => patch(o.id, { tuitionPerYear: e.target.value })} inputMode="decimal" /></td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Địa điểm</th>
                  {options.map((o) => (
                    <td key={o.id}>
                      <Select aria-label="Địa điểm" emptyLabel="Chưa đánh giá" value={o.locationScore} options={LOCATION_OPTIONS} onChange={(v) => patch(o.id, { locationScore: v })} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Đầu vào</th>
                  {options.map((o) => {
                    const r = rankedById.get(o.id);
                    return (
                      <td key={o.id}>
                        {r && <Badge variant={ELIGIBILITY_VARIANT[r.eligibility]}>{ELIGIBILITY_LABEL[r.eligibility]}</Badge>}
                        {r && r.scoreGap !== null && r.scoreGap > 0 && <p className="explain-note">Thiếu {r.scoreGap} điểm</p>}
                        {admissionNotes[o.id] && <p className="explain-note">{admissionNotes[o.id]}</p>}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <th scope="row">Điểm tổng hợp</th>
                  {options.map((o) => {
                    const r = rankedById.get(o.id);
                    return (
                      <td key={o.id} className={r?.rank === 1 ? 'is-fit' : undefined}>
                        {r ? (r.totalScore ?? <span className="is-missing">Chưa đủ dữ liệu</span>) : null}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="module-actions">
            <Button type="button" variant="outline" leftIcon={<Plus size={16} />} disabled={options.length >= MAX_OPTIONS} onClick={() => setOptions((list) => [...list, blank(list.length)])}>
              Thêm phương án
            </Button>
          </div>
        </section>

        <aside className="decision-rank" aria-label="Xếp hạng">
          <Card title="Xếp hạng">
            <ol className="decision-rank-list">
              {ranked.map((r) => (
                <li key={r.id} className={r.rank === 1 ? 'is-first' : undefined}>
                  <span className="decision-rank-no" aria-hidden="true">{r.rank}</span>
                  <div className="decision-rank-body">
                    <strong>{r.title}</strong>
                    <div className="top-career-head">
                      <Badge variant={ELIGIBILITY_VARIANT[r.eligibility]}>{ELIGIBILITY_LABEL[r.eligibility]}</Badge>
                      {r.overBudget && <Badge variant="warning">Vượt ngân sách</Badge>}
                    </div>
                    <span className="explain-note">
                      Điểm {r.totalScore ?? '–'} · Phù hợp nghề {r.careerFitPercent === null ? 'chưa có' : `${r.careerFitPercent.toFixed(1)}%`}
                      {r.missingCriteria.length > 0 ? ` · Thiếu: ${r.missingCriteria.join(', ')}` : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            {needBackup && (
              <Alert variant="info" title="Phương án dự phòng">
                {backups.length > 0 ? backups.map((b) => b.title).join(', ') : 'Chưa có phương án vừa đạt điều kiện vừa trong ngân sách.'}
                {alternatives.length > 0 && <ul>{alternatives.map((line) => <li key={line}>{line}</li>)}</ul>}
              </Alert>
            )}
            <form className="decision-save" onSubmit={(e) => { e.preventDefault(); void save(); }}>
              <Input label="Tên bộ phương án" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Button type="submit" disabled={!title.trim()}>Lưu phương án</Button>
            </form>
          </Card>
        </aside>
      </div>

      <h2 className="decision-heading">Phương án đã lưu</h2>
      {plans.length === 0 ? (
        <div className="sticker-empty">
          <SearchX size={40} aria-hidden="true" />
          Chưa có phương án nào
        </div>
      ) : (
        <StickerGrid label="Phương án đã lưu">
          {plans.map((plan, index) => (
            <StickerCard
              key={plan.id}
              tone={stickerToneAt(index)}
              icon={<Scale size={22} />}
              title={plan.title}
              corner={<span className="explain-note">{new Date(plan.created_at).toLocaleDateString('vi-VN')}</span>}
              footer={
                !plan.report ? (
                  <>
                    <Button type="button" size="sm" onClick={() => void act(() => callRpc('create_decision_report', { p_plan_id: plan.id, p_include_finance: false }), 'Đã tạo báo cáo, ẩn tài chính.')}>Báo cáo ẩn tài chính</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void act(() => callRpc('create_decision_report', { p_plan_id: plan.id, p_include_finance: true }), 'Đã tạo báo cáo, hiện tài chính.')}>Báo cáo hiện tài chính</Button>
                  </>
                ) : (
                  <>
                    <Link className="sticker-link" to={`/bao-cao-quyet-dinh/${plan.report.id}`}>Xem báo cáo</Link>
                    {parents.map((p) => {
                      const share = plan.report!.shares.find((s) => s.user_id === p.user_id);
                      return share ? (
                        <Badge key={p.user_id} variant={share.consensus_at ? 'success' : 'default'}>
                          {p.name}: {share.consensus_at ? 'đã đồng thuận' : 'đã chia sẻ'}
                        </Badge>
                      ) : (
                        <Button key={p.user_id} type="button" size="sm" variant="outline"
                          onClick={() => void act(() => callRpc('share_decision_report', { p_report_id: plan.report!.id, p_parent_id: p.user_id }), 'Đã chia sẻ cho phụ huynh.')}>
                          Chia sẻ cho {p.name || 'phụ huynh'}
                        </Button>
                      );
                    })}
                    {parents.length === 0 && <Link className="sticker-link" to="/quyen-rieng-tu">Liên kết phụ huynh</Link>}
                  </>
                )
              }
            >
              {plan.ranking.map((r) => (
                <StickerFact key={r.id} strong={plan.preferred_option_id === r.id}>
                  {plan.preferred_option_id === r.id ? 'Ưu tiên: ' : ''}{r.title}
                </StickerFact>
              ))}
              {plan.preferred_option_id && /^[0-9a-f-]{36}$/i.test(plan.preferred_option_id) && (
                <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/lo-trinh?chuong-trinh=${plan.preferred_option_id}`)}>
                  Lập lộ trình
                </Button>
              )}
              {plan.preferred_option_id && (
                <Button type="button" size="sm" variant="outline" onClick={() => void setGoal(plan.id)}>
                  Đặt làm mục tiêu
                </Button>
              )}
              <Button type="button" size="sm" variant="ghost" onClick={() => setHistoryPlanId(plan.id)}>
                Lịch sử
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPreferring({ planId: plan.id, optionId: plan.preferred_option_id ?? plan.ranking[0]?.id ?? '', reason: plan.preferred_reason ?? '' })}>
                Chọn phương án ưu tiên
              </Button>
            </StickerCard>
          ))}
        </StickerGrid>
      )}

      <Modal
        open={weightsOpen}
        title="Mức quan trọng"
        onClose={() => setWeightsOpen(false)}
        actions={<Button type="button" onClick={() => setWeightsOpen(false)}>Xong</Button>}
      >
        <div className="career-filter-form">
          {WEIGHT_FIELDS.map((field) => (
            <Select key={field.key} label={field.label} options={LEVEL_OPTIONS} value={weights[field.key]} onChange={(v) => setWeights({ ...weights, [field.key]: v })} />
          ))}
        </div>
      </Modal>

      <Modal
        open={preferring !== null}
        title="Phương án ưu tiên"
        onClose={() => setPreferring(null)}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={() => setPreferring(null)}>Hủy</Button>
            <Button type="button" disabled={!preferring?.optionId} onClick={confirmPreferred}>Lưu</Button>
          </>
        }
      >
        {preferring && preferringPlan && (
          <div className="career-filter-form">
            <Select
              label="Phương án"
              options={preferringPlan.ranking.map((r) => ({ value: r.id, label: r.title }))}
              value={preferring.optionId}
              onChange={(v) => setPreferring({ ...preferring, optionId: v })}
            />
            <Textarea label="Lý do" value={preferring.reason} onChange={(e) => setPreferring({ ...preferring, reason: e.target.value })} />
          </div>
        )}
      </Modal>

      <Modal
        open={historyPlanId !== null}
        title="Lịch sử quyết định"
        onClose={() => setHistoryPlanId(null)}
        actions={<Button type="button" onClick={() => setHistoryPlanId(null)}>Đóng</Button>}
      >
        {history.filter((entry) => entry.plan_id === historyPlanId).length === 0 ? (
          <p className="career-muted">Chưa có thay đổi</p>
        ) : (
          <ul className="module-list">
            {history.filter((entry) => entry.plan_id === historyPlanId).map((entry) => (
              <li key={`${entry.created_at}-${entry.action}`}>
                <span>{new Date(entry.created_at).toLocaleString('vi-VN')}</span>
                <span>{historyLabel(entry, plans.find((p) => p.id === historyPlanId))}</span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
};
