import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Card, Input, Select, Spinner, Textarea } from '../../../components/common';
import { callRpc, db } from '../../../lib/rpc';
import { setCareerStatus } from '../../career_explorer/career.service';
import '../../career_explorer/pages/CareerPages.css';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Bản nháp' },
  { value: 'review', label: 'Đang rà soát' },
  { value: 'published', label: 'Đã công bố' },
  { value: 'hidden', label: 'Đã ẩn' },
];

/** R16: quản trị duyệt / công bố / ẩn nghề; người dùng chỉ đọc nghề đã công bố */
export const CareerAdminPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<{ id: string; career_code: string; career_name: string; status: string; is_standard_complete: boolean; qualifying_jd_count: number; holland_top3: string | null; data_checked_at: string | null }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    let request = db.from('careers').select('id, career_code, career_name, status, is_standard_complete, qualifying_jd_count, holland_top3, data_checked_at').order('career_code').limit(200);
    if (query.trim()) request = request.ilike('career_name', `%${query.trim()}%`);
    if (status) request = request.eq('status', status);
    const { data, error: e } = await request;
    if (e) throw e;
    setRows(data ?? []);
  }, [query, status]);

  useEffect(() => {
    reload().catch(() => setError('Không tải được danh sách nghề.'));
  }, [reload]);

  return (
    <div className="module-page">
      <h1>Quản lý nghề</h1>
      {error && <Alert variant="danger">{error}</Alert>}
      <Card title="Lọc">
        <div className="module-form">
          <Input label="Tên nghề" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select label="Trạng thái" emptyLabel="Tất cả" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        </div>
        <p className="explain-note">Nghề đủ 3 thành phần (G1–G5, G7 có CW &gt; 0 và Holland) được công bố tự động ở mức kiểm định theo dữ liệu JD. Hạn rà soát dữ liệu nghề 6 tháng (P20).</p>
      </Card>
      {rows === null ? <Spinner /> : (
        <Card title={`${rows.length} nghề`}>
          <ul className="module-list">
            {rows.map((r) => {
              const stale = r.data_checked_at && Date.now() - new Date(r.data_checked_at).getTime() > 183 * 86400000;
              return (
                <li key={r.id}>
                  <Link to={`/nghe/${r.id}`}>{r.career_code} · {r.career_name}</Link>
                  <span>{r.qualifying_jd_count} JD</span>
                  {r.holland_top3 && <Badge>{r.holland_top3}</Badge>}
                  <Badge variant={r.is_standard_complete ? 'success' : 'warning'}>{r.is_standard_complete ? 'Đủ 3 thành phần' : 'Thiếu thành phần'}</Badge>
                  {stale && <Badge variant="danger">Quá hạn rà soát</Badge>}
                  <Select label="Trạng thái" value={r.status} options={STATUS_OPTIONS}
                    onChange={(v) => void setCareerStatus(r.id, v).then(reload).catch(() => setError('Không đổi được trạng thái.'))} />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
};

/** M09: kiểm duyệt bài bị ẩn/báo cáo, xác minh người hướng dẫn, tạo sự kiện */
export const CommunityAdminPage: React.FC = () => {
  const [posts, setPosts] = useState<{ id: string; body: string; hidden_at: string | null; reports: number; reasons: string[] | null }[]>([]);
  const [mentors, setMentors] = useState<{ user_id: string; headline: string; verified: boolean; name: string }[]>([]);
  const [event, setEvent] = useState({ title: '', description: '', location: '', startsAt: '', seatLimit: '', deadline: '' });
  const [groups, setGroups] = useState<Array<{ id: string; name: string; members: Array<{ user_id: string; name: string }>; topics: Array<{ id: string; title: string }> }>>([]);
  const [topicTitle, setTopicTitle] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const reload = useCallback(async () => {
    const [p, m, g] = await Promise.all([
      callRpc<typeof posts>('list_reported_posts'),
      callRpc<typeof mentors>('list_mentor_profiles_admin'),
      callRpc<typeof groups>('list_community_admin'),
    ]);
    setPosts(p ?? []);
    setMentors(m ?? []);
    setGroups(g ?? []);
  }, []);
  useEffect(() => {
    reload().catch(() => setMessage({ tone: 'danger', text: 'Không tải được dữ liệu kiểm duyệt.' }));
  }, [reload]);

  const run = (fn: () => Promise<unknown>, ok: string) =>
    fn().then(() => { setMessage({ tone: 'success', text: ok }); return reload(); }).catch(() => setMessage({ tone: 'danger', text: 'Thao tác không thành công.' }));

  return (
    <div className="module-page">
      <h1>Kiểm duyệt cộng đồng</h1>
      {message && <Alert variant={message.tone}>{message.text}</Alert>}
      <Card title="Bài bị báo cáo hoặc tự ẩn">
        {posts.length === 0 ? <p>Không có bài cần xử lý.</p> : (
          <ul className="module-list">
            {posts.map((p) => (
              <li key={p.id}>
                <span>{p.body}</span>
                <Badge variant={p.hidden_at ? 'danger' : 'warning'}>{p.hidden_at ? 'Đang ẩn' : 'Đang hiện'} · {p.reports} báo cáo</Badge>
                {(p.reasons ?? []).length > 0 && <span className="explain-note">{p.reasons!.join('; ')}</span>}
                <Button type="button" size="sm" variant="outline" onClick={() => void run(() => callRpc('moderate_post', { p_post_id: p.id, p_action: 'restore' }), 'Đã khôi phục bài.')}>Khôi phục</Button>
                <Button type="button" size="sm" variant="danger" onClick={() => void run(() => callRpc('moderate_post', { p_post_id: p.id, p_action: 'remove' }), 'Đã xóa bài.')}>Xóa</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Xác minh người hướng dẫn">
        {mentors.length === 0 ? <p>Chưa có hồ sơ người hướng dẫn.</p> : (
          <ul className="module-list">
            {mentors.map((m) => (
              <li key={m.user_id}>
                <strong>{m.name || 'Người hướng dẫn'}</strong>
                <span>{m.headline}</span>
                <Badge variant={m.verified ? 'success' : 'default'}>{m.verified ? 'Đã xác minh' : 'Chưa xác minh'}</Badge>
                <Button type="button" size="sm" variant="outline" onClick={() => void run(() => callRpc('verify_mentor', { p_user_id: m.user_id, p_verified: !m.verified }), 'Đã cập nhật.')}>
                  {m.verified ? 'Gỡ xác minh' : 'Xác minh'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Thành viên và chủ đề">
        {groups.map((group) => (
          <div key={group.id}>
            <strong>{group.name}</strong>
            <ul className="module-list">
              {group.members.map((member) => (
                <li key={member.user_id}>
                  <span>{member.name || member.user_id}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => void run(() => callRpc('remove_community_member', { p_community_id: group.id, p_user_id: member.user_id }), 'Đã đưa thành viên ra khỏi nhóm.')}>Đưa ra</Button>
                </li>
              ))}
              {group.topics.map((topic) => (
                <li key={topic.id}>
                  <Badge>{topic.title}</Badge>
                  <Button type="button" size="sm" variant="outline" onClick={() => void run(() => callRpc('remove_community_topic', { p_topic_id: topic.id }), 'Đã xóa chủ đề.')}>Xóa chủ đề</Button>
                </li>
              ))}
            </ul>
            <form className="module-form" onSubmit={(e) => { e.preventDefault(); void run(() => callRpc('add_community_topic', { p_community_id: group.id, p_title: topicTitle[group.id] ?? '' }), 'Đã thêm chủ đề.'); }}>
              <Input label="Chủ đề mới" value={topicTitle[group.id] ?? ''} onChange={(e) => setTopicTitle((current) => ({ ...current, [group.id]: e.target.value }))} />
              <Button type="submit" size="sm">Thêm chủ đề</Button>
            </form>
          </div>
        ))}
      </Card>
      <EventForm value={event} onChange={setEvent} onSubmit={() => void run(async () => {
        await callRpc('create_career_event', {
          p_school_id: null, p_title: event.title, p_description: event.description, p_location: event.location,
          p_starts_at: new Date(event.startsAt).toISOString(),
          p_seat_limit: event.seatLimit.trim() ? Number(event.seatLimit) : null,
          p_registration_deadline: event.deadline ? new Date(event.deadline).toISOString() : null,
        });
        setEvent({ title: '', description: '', location: '', startsAt: '', seatLimit: '', deadline: '' });
      }, 'Đã tạo sự kiện.')} />
    </div>
  );
};

interface EventDraft { title: string; description: string; location: string; startsAt: string; seatLimit: string; deadline: string }

/** INT-008 / M07–M08: thư viện khóa học và hoạt động lộ trình đã duyệt */
export const ContentLibraryAdminPage: React.FC = () => {
  const [suggestions, setSuggestions] = useState<Array<{ id: string; kind: string; title: string; provider: string | null; url: string | null; is_partner: boolean; is_active: boolean }>>([]);
  const [activities, setActivities] = useState<Array<{ id: string; pillar: string; title: string; duration_weeks: number; hours: number; is_active: boolean }>>([]);
  const [suggest, setSuggest] = useState({ kind: 'course', title: '', provider: '', url: '', partner: false });
  const [activity, setActivity] = useState({ pillar: 'knowledge', title: '', weeks: '2', hours: '6' });
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const reload = useCallback(async () => {
    const [s, a] = await Promise.all([
      db.from('course_project_suggestions').select('id, kind, title, provider, url, is_partner, is_active').order('title'),
      db.from('approved_roadmap_activities').select('id, pillar, title, duration_weeks, hours, is_active').order('pillar').order('title'),
    ]);
    if (s.error) throw s.error;
    if (a.error) throw a.error;
    setSuggestions((s.data ?? []) as typeof suggestions);
    setActivities((a.data ?? []) as typeof activities);
  }, []);

  useEffect(() => {
    reload().catch(() => setMessage({ tone: 'danger', text: 'Không tải được thư viện. Chạy migration Phase 4 nếu chưa có bảng.' }));
  }, [reload]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMessage({ tone: 'success', text: ok });
      await reload();
    } catch {
      setMessage({ tone: 'danger', text: 'Không lưu được.' });
    }
  };

  return (
    <div className="module-page">
      <h1>Thư viện gợi ý và hoạt động</h1>
      {message && <Alert variant={message.tone}>{message.text}</Alert>}
      <Card title="Khóa học, dự án, chứng chỉ (INT-008)">
        <form className="module-form" onSubmit={(e) => { e.preventDefault(); void run(async () => {
          const { error } = await db.from('course_project_suggestions').insert({
            kind: suggest.kind, title: suggest.title.trim(), provider: suggest.provider || null, url: suggest.url || null, is_partner: suggest.partner, is_active: true,
          });
          if (error) throw error;
        }, 'Đã thêm gợi ý.'); }}>
          <Select label="Loại" value={suggest.kind} options={[{ value: 'course', label: 'Khóa học' }, { value: 'project', label: 'Dự án' }, { value: 'certificate', label: 'Chứng chỉ' }]} onChange={(v) => setSuggest({ ...suggest, kind: v })} />
          <Input label="Tên" value={suggest.title} onChange={(e) => setSuggest({ ...suggest, title: e.target.value })} />
          <Input label="Đơn vị" value={suggest.provider} onChange={(e) => setSuggest({ ...suggest, provider: e.target.value })} />
          <Input label="Liên kết" value={suggest.url} onChange={(e) => setSuggest({ ...suggest, url: e.target.value })} />
          <Button type="submit" disabled={suggest.title.trim().length < 3}>Thêm</Button>
        </form>
        <ul className="module-list">
          {suggestions.map((s) => (
            <li key={s.id}>
              <Badge>{s.kind}</Badge>
              <span>{s.title}</span>
              {s.is_partner && <Badge variant="info">Đối tác</Badge>}
              <Button type="button" size="sm" variant="ghost" onClick={() => void run(async () => {
                const { error } = await db.from('course_project_suggestions').update({ is_active: !s.is_active }).eq('id', s.id);
                if (error) throw error;
              }, 'Đã cập nhật.')}>
                {s.is_active ? 'Ẩn' : 'Hiện'}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Hoạt động lộ trình đã duyệt">
        <form className="module-form" onSubmit={(e) => { e.preventDefault(); void run(async () => {
          const { error } = await db.from('approved_roadmap_activities').insert({
            pillar: activity.pillar, title: activity.title.trim(), duration_weeks: Number(activity.weeks) || 2, hours: Number(activity.hours) || 6,
          });
          if (error) throw error;
        }, 'Đã thêm hoạt động.'); }}>
          <Select label="Trụ" value={activity.pillar} options={[{ value: 'knowledge', label: 'Kiến thức' }, { value: 'experience', label: 'Kinh nghiệm' }, { value: 'exploration', label: 'Trải nghiệm' }]} onChange={(v) => setActivity({ ...activity, pillar: v })} />
          <Input label="Tên" value={activity.title} onChange={(e) => setActivity({ ...activity, title: e.target.value })} />
          <Input label="Số tuần" value={activity.weeks} onChange={(e) => setActivity({ ...activity, weeks: e.target.value })} />
          <Input label="Giờ" value={activity.hours} onChange={(e) => setActivity({ ...activity, hours: e.target.value })} />
          <Button type="submit" disabled={activity.title.trim().length < 3}>Thêm</Button>
        </form>
        <ul className="module-list">
          {activities.map((a) => (
            <li key={a.id}>
              <Badge>{a.pillar}</Badge>
              <span>{a.title}</span>
              <span>{a.duration_weeks} tuần · {a.hours} giờ</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

export const EventForm: React.FC<{ value: EventDraft; onChange: (v: EventDraft) => void; onSubmit: () => void }> = ({ value, onChange, onSubmit }) => (
  <Card title="Tạo sự kiện hướng nghiệp">
    <form className="module-form" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <Input label="Tên sự kiện" value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
      <Input label="Thời gian" type="datetime-local" value={value.startsAt} onChange={(e) => onChange({ ...value, startsAt: e.target.value })} />
      <Input label="Địa điểm" value={value.location} onChange={(e) => onChange({ ...value, location: e.target.value })} />
      <Input label="Số chỗ" value={value.seatLimit} onChange={(e) => onChange({ ...value, seatLimit: e.target.value })} inputMode="numeric" />
      <Input label="Hạn đăng ký" type="datetime-local" value={value.deadline} onChange={(e) => onChange({ ...value, deadline: e.target.value })} />
      <Textarea label="Mô tả" value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      <Button type="submit" disabled={value.title.trim().length < 3 || !value.startsAt}>Tạo</Button>
    </form>
  </Card>
);
