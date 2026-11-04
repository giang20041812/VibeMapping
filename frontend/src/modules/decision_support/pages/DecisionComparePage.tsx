import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Card, Input, Select } from '../../../components/common';
import { compareDecisionOptions, type DecisionOptionInput, type RankedDecisionOption } from '../../../domain/assessmentRules';
import { callRpc, db } from '../../../lib/rpc';
import { clearProgramCompare, readProgramCompare } from '../../../lib/selectionCart';
import { useAuth } from '../../auth/AuthContext';
import { recommendCareers, searchCareers, type CareerListItem } from '../../career_explorer/career.service';
import '../../career_explorer/pages/CareerPages.css';

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

const ELIGIBILITY_LABEL = { MET: 'Đáp ứng', NOT_MET: 'Chưa đáp ứng', UNKNOWN: 'Chưa đủ dữ liệu' } as const;
const ELIGIBILITY_VARIANT = { MET: 'success', NOT_MET: 'danger', UNKNOWN: 'default' } as const;

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
  const [careers, setCareers] = useState<CareerListItem[]>([]);
  const [fitByCareer, setFitByCareer] = useState<Map<string, number>>(new Map());
  const [options, setOptions] = useState<OptionDraft[]>([blank(0), blank(1)]);
  const [learnerScore, setLearnerScore] = useState('');
  const [budget, setBudget] = useState('');
  const [weights, setWeights] = useState({ careerFit: '40', admission: '30', finance: '20', location: '10' });
  const [title, setTitle] = useState('');
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [parents, setParents] = useState<{ user_id: string; name: string }[]>([]);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);

  const reload = useCallback(async () => {
    const [list, connections] = await Promise.all([
      callRpc<SavedPlan[]>('list_my_comparison_plans'),
      callRpc<{ parents: { user_id: string; name: string }[] }>('list_my_connections'),
    ]);
    setPlans(list ?? []);
    setParents(connections?.parents ?? []);
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
      options.length >= 2
        ? compareDecisionOptions(
            inputs,
            { careerFit: num(weights.careerFit) ?? 0, admission: num(weights.admission) ?? 0, finance: num(weights.finance) ?? 0, location: num(weights.location) ?? 0 },
            num(budget),
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(inputs), weights, budget, options.length],
  );
  const [admissionNotes, setAdmissionNotes] = useState<Record<string, string>>({});
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const backups = ranked.filter((r) => r.eligibility !== 'NOT_MET' && !r.overBudget).slice(1, 4);
  const needBackup = ranked.length > 0 && (ranked[0].eligibility === 'NOT_MET' || ranked[0].overBudget || ranked.some((r) => r.eligibility === 'NOT_MET' || r.overBudget));

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
          if (!latest) notes[id] = 'Chưa đủ dữ liệu: chưa có điều kiện theo năm và phương thức.';
          else if (score === null || latest.cutoff_score === null) notes[id] = `Chưa đủ dữ liệu để kết luận. Bản ghi năm ${latest.admission_year ?? '–'}, phương thức ${latest.admission_method ?? 'không ghi'}.`;
          else if (score >= Number(latest.cutoff_score)) notes[id] = `Đáp ứng: điểm ${score} đạt điểm chuẩn ${latest.cutoff_score} năm ${latest.admission_year}, phương thức ${latest.admission_method ?? 'không ghi'}.`;
          else notes[id] = `Chưa đáp ứng: điểm ${score} thấp hơn điểm chuẩn ${latest.cutoff_score} năm ${latest.admission_year}, phương thức ${latest.admission_method ?? 'không ghi'}.`;
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
        setAlternatives(['Không tìm được nhóm ngành của phương án ưu tiên.']);
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
        return `${school ?? 'Trường'} – ${major ?? 'ngành'}${row.specialization_name ? ` (${row.specialization_name})` : ''}: cùng nhóm ngành, cần đối chiếu điểm chuẩn và học phí trước khi chọn.`;
      });
      setAlternatives(lines.length > 0 ? lines : ['Không có phương án cùng nhóm ngành trong danh mục.']);
    });
    return () => {
      active = false;
    };
  }, [ranked]);

  const patch = (id: string, change: Partial<OptionDraft>) => setOptions((list) => list.map((o) => (o.id === id ? { ...o, ...change } : o)));

  const save = async () => {
    setMessage(null);
    try {
      await callRpc('save_decision_plan', {
        p_title: title,
        p_career_ids: options.map((o) => o.careerId).filter(Boolean),
        p_options: inputs,
        p_weights: weights,
        p_budget: num(budget),
        p_learner_score: num(learnerScore),
        p_ranking: ranked,
      });
      setTitle('');
      setMessage({ tone: 'success', text: 'Đã lưu phương án.' });
      await reload();
    } catch {
      setMessage({ tone: 'danger', text: 'Chưa lưu được. Cần 2–4 phương án và tên phương án.' });
    }
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

  return (
    <div className="module-page">
      <h1>So sánh phương án</h1>
      {message && <Alert variant={message.tone}>{message.text}</Alert>}
      <Card title="Thông tin học tập và ngân sách">
        <div className="module-form">
          <Input label="Điểm xét tuyển của bạn" value={learnerScore} onChange={(e) => setLearnerScore(e.target.value)} inputMode="decimal" />
          <Input label="Ngân sách học phí mỗi năm (triệu đồng)" value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" />
          <Button
            type="button"
            variant="outline"
            onClick={() => void callRpc('save_my_study_finance', {
              p_latest_score: num(learnerScore),
              p_subject_combination: null,
              p_admission_method: null,
              p_recorded_year: null,
              p_budget_per_year: num(budget),
              p_budget_note: null,
            }).then(() => setMessage({ tone: 'success', text: 'Đã lưu hồ sơ học tập và ngân sách.' })).catch(() => setMessage({ tone: 'danger', text: 'Chưa lưu được hồ sơ. Chạy migration Phase 4 nếu chưa có bảng.' }))}
          >
            Lưu vào hồ sơ
          </Button>
        </div>
        <p className="explain-note">Bỏ trống ngân sách thì tiêu chí tài chính được loại khỏi phép tính, không tính 0 điểm. Học phí chương trình thêm từ M05 là ước tính 2 học kỳ.</p>
        {readProgramCompare().length > 0 && (
          <Button type="button" variant="ghost" onClick={() => { clearProgramCompare(); setMessage({ tone: 'info', text: 'Đã xóa giỏ chương trình.' }); }}>
            Xóa chương trình vừa thêm từ trang trường
          </Button>
        )}
      </Card>

      <Card title="Mức quan trọng của tiêu chí">
        <div className="module-form">
          <Input label="Phù hợp nghề" value={weights.careerFit} onChange={(e) => setWeights({ ...weights, careerFit: e.target.value })} />
          <Input label="Đáp ứng đầu vào" value={weights.admission} onChange={(e) => setWeights({ ...weights, admission: e.target.value })} />
          <Input label="Tài chính" value={weights.finance} onChange={(e) => setWeights({ ...weights, finance: e.target.value })} />
          <Input label="Địa điểm" value={weights.location} onChange={(e) => setWeights({ ...weights, location: e.target.value })} />
        </div>
      </Card>

      <Card title={`Phương án (${options.length}/4)`}>
        {options.map((o, index) => (
          <div key={o.id} className="decision-option">
            <strong>Phương án {index + 1}</strong>
            <div className="module-form">
              <Input label="Tên (trường – ngành)" value={o.title} onChange={(e) => patch(o.id, { title: e.target.value })} />
              <Select label="Nghề hướng tới" emptyLabel="Chưa chọn" value={o.careerId} options={careers.map((c) => ({ value: c.id, label: c.career_name }))} onChange={(v) => patch(o.id, { careerId: v })} />
              <Input label="Ngưỡng điểm bắt buộc" value={o.admissionFloor} onChange={(e) => patch(o.id, { admissionFloor: e.target.value })} inputMode="decimal" />
              <Input label="Học phí/năm (triệu)" value={o.tuitionPerYear} onChange={(e) => patch(o.id, { tuitionPerYear: e.target.value })} inputMode="decimal" />
              <Input label="Điểm địa điểm (0–100)" value={o.locationScore} onChange={(e) => patch(o.id, { locationScore: e.target.value })} inputMode="decimal" />
              {options.length > 2 && <Button type="button" variant="ghost" onClick={() => setOptions((list) => list.filter((x) => x.id !== o.id))}>Bỏ</Button>}
            </div>
            {admissionNotes[o.id] && <p className="explain-note">{admissionNotes[o.id]}</p>}
          </div>
        ))}
        <Button type="button" variant="outline" disabled={options.length >= 4} onClick={() => setOptions((list) => [...list, blank(list.length)])}>
          Thêm phương án
        </Button>
      </Card>

      <Card title="Xếp hạng">
        <ol className="top-careers">
          {ranked.map((r) => (
            <li key={r.id}>
              <div className="top-career-head">
                <strong>{r.title}</strong>
                <Badge variant={ELIGIBILITY_VARIANT[r.eligibility]}>{ELIGIBILITY_LABEL[r.eligibility]}</Badge>
                {r.overBudget && <Badge variant="warning">Vượt ngân sách</Badge>}
                <span>Điểm tổng hợp: {r.totalScore ?? 'Chưa đủ dữ liệu'}</span>
              </div>
              <p className="explain-note">
                Phù hợp nghề {r.careerFitPercent === null ? 'chưa có' : `${r.careerFitPercent.toFixed(1)}%`}
                {r.scoreGap !== null && r.scoreGap > 0 ? ` · thiếu ${r.scoreGap} điểm so với ngưỡng` : ''}
                {r.missingCriteria.length > 0 ? ` · thiếu dữ liệu: ${r.missingCriteria.join(', ')} (loại khỏi mẫu số)` : ''}
              </p>
            </li>
          ))}
        </ol>
        <p className="explain-note">Phương án chưa đáp ứng điều kiện bắt buộc không bao giờ xếp trên phương án đáp ứng (BR-019). Công thức trọng số do bạn chọn, chưa được hội đồng chuyên môn phê duyệt.</p>
        {needBackup && (
          <Alert variant="info" title="Phương án dự phòng">
            {backups.length > 0 ? `Trong các phương án đã nhập: ${backups.map((b) => b.title).join(', ')}.` : 'Trong các phương án đã nhập chưa có phương án vừa đạt điều kiện vừa trong ngân sách.'}
            {alternatives.length > 0 && <ul>{alternatives.map((line) => <li key={line}>{line}</li>)}</ul>}
          </Alert>
        )}
        <form className="module-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <Input label="Tên bộ phương án" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Button type="submit" disabled={!title.trim()}>Lưu phương án</Button>
        </form>
      </Card>

      <Card title="Phương án đã lưu và báo cáo gia đình">
        {plans.length === 0 ? <p>Chưa có phương án nào.</p> : plans.map((plan) => (
          <div key={plan.id} className="decision-option">
            <div className="top-career-head">
              <strong>{plan.title}</strong>
              <span className="explain-note">{new Date(plan.created_at).toLocaleDateString('vi-VN')}</span>
            </div>
            <div className="module-actions">
              {plan.ranking.map((r) => (
                <Button key={r.id} type="button" size="sm" variant={plan.preferred_option_id === r.id ? 'primary' : 'outline'}
                  onClick={() => {
                    const reason = window.prompt('Lý do chọn phương án ưu tiên') ?? '';
                    void act(() => callRpc('set_preferred_option', { p_plan_id: plan.id, p_option_id: r.id, p_reason: reason }), 'Đã đánh dấu phương án ưu tiên.');
                  }}>
                  {plan.preferred_option_id === r.id ? 'Ưu tiên: ' : ''}{r.title}
                </Button>
              ))}
            </div>
            {!plan.report ? (
              <div className="module-actions">
                <Button type="button" size="sm" onClick={() => void act(() => callRpc('create_decision_report', { p_plan_id: plan.id, p_include_finance: false }), 'Đã tạo báo cáo (ẩn tài chính).')}>Tạo báo cáo (ẩn tài chính)</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void act(() => callRpc('create_decision_report', { p_plan_id: plan.id, p_include_finance: true }), 'Đã tạo báo cáo (hiện tài chính).')}>Tạo báo cáo (hiện tài chính)</Button>
              </div>
            ) : (
              <div className="module-actions">
                <Link to={`/bao-cao-quyet-dinh/${plan.report.id}`}>Xem báo cáo</Link>
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
                {parents.length === 0 && <span className="explain-note">Chưa liên kết phụ huynh. <Link to="/quyen-rieng-tu">Liên kết</Link></span>}
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
};
