import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Card, Input, Select, Spinner, useConfirm } from '../../../components/common';
import { callRpc, db } from '../../../lib/rpc';
import { useAuth } from '../../auth/AuthContext';
import { loadCareerDetail, listSavedCareers, type CareerDetail } from '../../career_explorer/career.service';
import '../../career_explorer/pages/CareerPages.css';

interface SkillItem {
  id: string;
  kind: string;
  title: string;
  criteria_id: string | null;
  self_level: number | null;
  verified_360: boolean;
  verified_until: string | null;
}
interface Suggestion {
  id: string;
  criteria_id: string | null;
  kind: string;
  title: string;
  provider: string | null;
  url: string | null;
  is_partner: boolean;
}

const KIND_LABEL: Record<string, string> = {
  soft_skill: 'Kỹ năng mềm',
  hard_skill: 'Kỹ năng chuyên môn',
  certificate: 'Chứng chỉ',
  project: 'Dự án',
  experience: 'Kinh nghiệm',
};
/** BR-030: Đạt (Gap = 0), Gần đạt (0 < Gap < 1 mức – P42), Chưa đạt (Gap ≥ 1 mức) */
const gapStatus = (gap: number) => (gap <= 0 ? 'Đạt' : gap < 1 ? 'Gần đạt' : 'Chưa đạt');

/** M08: hồ sơ năng lực của sinh viên, nhãn Đã xác thực 360°, khoảng cách với yêu cầu JD, gợi ý khóa học/dự án */
export const PortfolioPage: React.FC = () => {
  const { session } = useAuth();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [items, setItems] = useState<SkillItem[] | null>(null);
  const [targets, setTargets] = useState<{ career_id: string; career_name: string }[]>([]);
  const [careerId, setCareerId] = useState('');
  const [detail, setDetail] = useState<CareerDetail | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [criteriaIdByCode, setCriteriaIdByCode] = useState<Map<string, string>>(new Map());
  const [form, setForm] = useState({ kind: 'hard_skill', title: '', level: '3' });
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);

  const reload = useCallback(async () => {
    const { data, error } = await db.from('skill_profile_items').select('*').order('kind').order('title');
    if (error) throw error;
    setItems(data as SkillItem[]);
  }, []);

  useEffect(() => {
    reload().catch(() => setMessage({ tone: 'danger', text: 'Không tải được hồ sơ năng lực.' }));
    listSavedCareers().then(setTargets).catch(() => undefined);
    db.from('course_project_suggestions').select('*').eq('is_active', true)
      .then(({ data }) => setSuggestions((data ?? []) as Suggestion[]));
    db.from('criteria').select('id, dimension_code')
      .then(({ data }) => setCriteriaIdByCode(new Map(((data ?? []) as { id: string; dimension_code: string }[]).map((c) => [c.dimension_code, c.id]))));
  }, [reload]);

  useEffect(() => {
    if (!careerId || !session?.user.id) {
      setDetail(null);
      return;
    }
    loadCareerDetail(careerId).then(setDetail).catch(() => setMessage({ tone: 'danger', text: 'Không phân tích được khoảng cách.' }));
  }, [careerId, session?.user.id]);

  const importVerified = async () => {
    setMessage(null);
    try {
      const count = await callRpc<number>('import_verified_soft_skills');
      setMessage({ tone: 'success', text: `Đã lấy ${count} kỹ năng từ kết quả Cuối cùng 360°.` });
      await reload();
    } catch (caught) {
      const text = String((caught as { message?: string })?.message ?? '');
      setMessage({ tone: 'danger', text: text.includes('no_final_360') ? 'Bạn chưa có kết quả Cuối cùng 360°.' : 'Không lấy được kỹ năng.' });
    }
  };

  const addItem = async () => {
    const { error } = await db.from('skill_profile_items').insert({
      owner_id: session?.user.id, kind: form.kind, title: form.title.trim(), self_level: Number(form.level),
    });
    if (error) {
      setMessage({ tone: 'danger', text: 'Không thêm được mục.' });
      return;
    }
    setForm({ ...form, title: '' });
    await reload();
  };

  const updateLevel = async (item: SkillItem, level: number) => {
    if (item.verified_360 && !(await confirm({ title: 'Tự sửa mức sẽ gỡ nhãn Đã xác thực 360°. Tiếp tục?', confirmLabel: 'Tiếp tục' }))) return;
    await db.from('skill_profile_items').update({ self_level: level }).eq('id', item.id);
    await reload();
  };

  const addToRoadmap = async (title: string) => {
    const roadmaps = await callRpc<{ id: string; is_active: boolean }[]>('list_my_roadmaps');
    const active = roadmaps.find((r) => r.is_active);
    if (!active) {
      setMessage({ tone: 'info', text: 'Bạn chưa có lộ trình. Tạo lộ trình trước rồi thêm gợi ý.' });
      return;
    }
    await callRpc('add_roadmap_milestone', { p_roadmap_id: active.id, p_pillar: 'knowledge', p_title: title });
    setMessage({ tone: 'success', text: 'Đã thêm vào lộ trình.' });
  };

  const gaps = (detail?.components.criteriaEvaluations ?? [])
    .filter((c) => c.gap !== null && c.gap > 0)
    .sort((a, b) => (b.gap ?? 0) * b.careerWeight - (a.gap ?? 0) * a.careerWeight);
  const metCount = (detail?.components.criteriaEvaluations ?? []).filter((c) => c.gap === 0).length;
  return (
    <div className="module-page">
      <h1>Hồ sơ năng lực</h1>
      {message && <Alert variant={message.tone}>{message.text}</Alert>}

      <Card title="Kỹ năng và minh chứng" action={<Button type="button" size="sm" onClick={() => void importVerified()}>Lấy kỹ năng từ kết quả 360°</Button>}>
        {items === null ? <Spinner /> : items.length === 0 ? <p>Chưa có mục nào.</p> : (
          <ul className="module-list">
            {items.map((item) => (
              <li key={item.id}>
                <Badge>{KIND_LABEL[item.kind] ?? item.kind}</Badge>
                <span>{item.title}</span>
                {item.verified_360 && <Badge variant="success">Đã xác thực 360° đến {item.verified_until ? new Date(item.verified_until).toLocaleDateString('vi-VN') : ''}</Badge>}
                <Select label="Mức" value={String(item.self_level ?? '')} emptyLabel="–"
                  options={[1, 2, 3, 4, 5].map((v) => ({ value: String(v), label: String(v) }))}
                  onChange={(v) => void updateLevel(item, Number(v))} />
                <Button type="button" size="sm" variant="ghost" onClick={() => void db.from('skill_profile_items').delete().eq('id', item.id).then(reload)}>Xóa</Button>
              </li>
            ))}
          </ul>
        )}
        <div className="module-form">
          <Select label="Loại" value={form.kind} options={Object.entries(KIND_LABEL).filter(([k]) => k !== 'soft_skill').map(([value, label]) => ({ value, label }))} onChange={(v) => setForm({ ...form, kind: v })} />
          <Input label="Tên" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Select label="Tự chấm (1–5)" value={form.level} options={[1, 2, 3, 4, 5].map((v) => ({ value: String(v), label: String(v) }))} onChange={(v) => setForm({ ...form, level: v })} />
          <Button type="button" disabled={!form.title.trim()} onClick={() => void addItem()}>Thêm</Button>
        </div>
      </Card>

      <Card title="Khoảng cách với yêu cầu nghề">
        <Select label="Nghề đối chiếu" emptyLabel="Chọn nghề đã lưu" value={careerId}
          options={targets.map((t) => ({ value: t.career_id, label: t.career_name }))} onChange={setCareerId} />
        {targets.length === 0 && <p>Bạn chưa lưu nghề nào. <Link to="/nghe">Khám phá nghề</Link></p>}
        {detail && !detail.hasUserScores && <Alert variant="warning">Bạn chưa có kết quả đánh giá nên chưa tính được khoảng cách.</Alert>}
        {detail && detail.hasUserScores && (
          <>
            <p>Đạt {metCount}/{detail.components.criteriaEvaluations.length} tiêu chí của nghề.</p>
            {gaps.length === 0 ? <p>Không còn khoảng cách nào.</p> : (
              <ol className="top-careers">
                {gaps.map((g) => {
                  const related = suggestions.filter((s) => s.criteria_id !== null && s.criteria_id === criteriaIdByCode.get(g.dimensionCode));
                  return (
                    <li key={g.dimensionCode}>
                      <div className="top-career-head">
                        <strong>{g.dimensionCode} · {g.name}</strong>
                        <Badge variant={gapStatus(g.gap!) === 'Chưa đạt' ? 'danger' : 'warning'}>{gapStatus(g.gap!)}</Badge>
                        <span>Thiếu {g.gap} điểm · ưu tiên {g.priority}</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => void addToRoadmap(`Cải thiện ${g.name ?? g.dimensionCode}`)}>Thêm vào lộ trình</Button>
                      </div>
                      {related.length > 0 && (
                        <ul className="module-list">
                          {related.map((s) => (
                            <li key={s.id}>
                              {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> : <span>{s.title}</span>}
                              {s.provider && <span>{s.provider}</span>}
                              {s.is_partner && <Badge variant="info">Đối tác</Badge>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </Card>

      <Card title="Khóa học, dự án, chứng chỉ gợi ý">
        {suggestions.length === 0 ? <p>Thư viện gợi ý chưa có nội dung. Quản trị hệ thống bổ sung trong bảng gợi ý khóa học/dự án.</p> : (
          <ul className="module-list">
            {suggestions.map((s) => (
              <li key={s.id}>
                <Badge>{s.kind === 'course' ? 'Khóa học' : s.kind === 'project' ? 'Dự án' : 'Chứng chỉ'}</Badge>
                {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> : <span>{s.title}</span>}
                {s.is_partner && <Badge variant="info">Đối tác</Badge>}
                <Button type="button" size="sm" variant="outline" onClick={() => void addToRoadmap(s.title)}>Thêm vào lộ trình</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {confirmDialog}
    </div>
  );
};
