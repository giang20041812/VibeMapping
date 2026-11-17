import React, { useCallback, useEffect, useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { Alert, Badge, Button, Card, Checkbox, Input, PageHero, Select, useAskText, useConfirm } from '../../../components/common';
import { communityErrorText } from '../../community/community.constants';
import { createEvent } from '../../community/community.service';
import { EventFormDialog } from '../../community/components/EventFormDialog';
import { SUGGESTION_KIND_LABEL } from '../../portfolio/portfolio.constants';
import { PILLAR_LABEL } from '../../roadmap/roadmap.logic';
import { callRpc, db } from '../../../lib/rpc';
import '../../career_explorer/pages/CareerPages.css';
import './CommunityAdmin.css';

/** M09: kiểm duyệt bài bị ẩn/báo cáo, hạn chế tác giả, xác minh người hướng dẫn, thành viên và chủ đề, tạo sự kiện */
export const CommunityAdminPage: React.FC = () => {
  const { ask, dialog: askDialog } = useAskText();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [posts, setPosts] = useState<ReportedPost[]>([]);
  const [mentors, setMentors] = useState<{ user_id: string; headline: string; verified: boolean; name: string; years_experience: number | null; expertise_topics: string[] | null }[]>([]);
  const [groups, setGroups] = useState<Array<{ id: string; name: string; members: Array<{ user_id: string; name: string; restricted_until: string | null }>; topics: Array<{ id: string; title: string }> }>>([]);
  const [topicTitle, setTopicTitle] = useState<Record<string, string>>({});
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const reload = useCallback(async () => {
    const [p, m, g] = await Promise.all([
      callRpc<ReportedPost[]>('list_reported_posts'),
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

  const run = async (fn: () => Promise<unknown>, ok: string): Promise<boolean> => {
    setBusy(true);
    try {
      await fn();
      setMessage({ tone: 'success', text: ok });
      await reload();
      return true;
    } catch (caught) {
      setMessage({ tone: 'danger', text: communityErrorText(caught, 'Thao tác không thành công.') });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const restrict = async (userId: string, name: string) => {
    const days = await ask({ title: `Hạn chế ${name || 'thành viên'} đăng bài`, label: 'Số ngày (0 là gỡ hạn chế)', confirmLabel: 'Áp dụng', minLength: 1, initialValue: '7' });
    if (days === null) return;
    const n = Number(days);
    if (!Number.isInteger(n) || n < 0 || n > 365) {
      setMessage({ tone: 'danger', text: 'Nhập số ngày từ 0 đến 365.' });
      return;
    }
    await run(() => callRpc('restrict_community_author', { p_user_id: userId, p_days: n, p_community_id: null }),
      n === 0 ? 'Đã gỡ hạn chế.' : `Đã hạn chế đăng bài ${n} ngày.`);
  };

  const removePost = async (post: ReportedPost) => {
    if (!(await confirm({ title: 'Xóa bài này?', message: post.body.slice(0, 160), confirmLabel: 'Xóa', danger: true }))) return;
    await run(() => callRpc('moderate_post', { p_post_id: post.id, p_action: 'remove' }), 'Đã xóa bài.');
  };

  const until = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '');

  return (
    <div className="module-page">
      <PageHero
        title="Kiểm duyệt cộng đồng"
        icon={<ShieldCheck />}
        tone="magenta"
        actions={<Button type="button" leftIcon={<Plus size={16} />} onClick={() => setCreatingEvent(true)}>Tạo sự kiện</Button>}
      />
      {message && <Alert variant={message.tone}>{message.text}</Alert>}
      <Card title={`Bài bị báo cáo hoặc tự ẩn (${posts.length})`}>
        {posts.length === 0 ? <p>Không có bài cần xử lý.</p> : (
          <ul className="module-list">
            {posts.map((p) => (
              <li key={p.id} className="moderation-item">
                <div className="moderation-head">
                  <strong>{p.author || 'Thành viên'}</strong>
                  {p.community_name && <span className="explain-note">trong {p.community_name}</span>}
                  <Badge variant={p.hidden_at ? 'danger' : 'warning'}>{p.hidden_at ? 'Đang ẩn' : 'Đang hiện'} · {p.reports} báo cáo</Badge>
                  {p.author_restricted_until && <Badge>Bị hạn chế đến {until(p.author_restricted_until)}</Badge>}
                </div>
                <p className="moderation-body">{p.body}</p>
                {(p.reasons ?? []).length > 0 && <span className="explain-note">Lý do: {p.reasons!.join('; ')}</span>}
                <div className="module-actions">
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(() => callRpc('moderate_post', { p_post_id: p.id, p_action: 'restore' }), 'Đã khôi phục bài.')}>Khôi phục</Button>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void restrict(p.author_id, p.author)}>Hạn chế tác giả</Button>
                  <Button type="button" size="sm" variant="danger" disabled={busy} onClick={() => void removePost(p)}>Xóa bài</Button>
                </div>
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
                {m.years_experience !== null && <span className="explain-note">{m.years_experience} năm kinh nghiệm</span>}
                {(m.expertise_topics ?? []).map((t) => <Badge key={t}>{t}</Badge>)}
                <Badge variant={m.verified ? 'success' : 'default'}>{m.verified ? 'Đã xác minh' : 'Chưa xác minh'}</Badge>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(() => callRpc('verify_mentor', { p_user_id: m.user_id, p_verified: !m.verified }), 'Đã cập nhật.')}>
                  {m.verified ? 'Gỡ xác minh' : 'Xác minh'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Thành viên và chủ đề">
        {groups.length === 0 ? <p>Chưa có nhóm nào.</p> : groups.map((group) => (
          <div key={group.id} className="moderation-group">
            <strong>{group.name}</strong>
            <ul className="module-list">
              {group.members.map((member) => (
                <li key={member.user_id}>
                  <span>{member.name || 'Thành viên'}</span>
                  {member.restricted_until && <Badge variant="warning">Bị hạn chế đến {until(member.restricted_until)}</Badge>}
                  <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void restrict(member.user_id, member.name)}>
                    {member.restricted_until ? 'Đổi hạn chế' : 'Hạn chế'}
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(() => callRpc('remove_community_member', { p_community_id: group.id, p_user_id: member.user_id }), 'Đã đưa thành viên ra khỏi nhóm.')}>Đưa ra</Button>
                </li>
              ))}
              {group.topics.map((topic) => (
                <li key={topic.id}>
                  <Badge>{topic.title}</Badge>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(() => callRpc('remove_community_topic', { p_topic_id: topic.id }), 'Đã xóa chủ đề.')}>Xóa chủ đề</Button>
                </li>
              ))}
            </ul>
            <form className="module-form" onSubmit={(e) => { e.preventDefault(); void run(() => callRpc('add_community_topic', { p_community_id: group.id, p_title: topicTitle[group.id] ?? '' }), 'Đã thêm chủ đề.').then((ok) => ok && setTopicTitle((current) => ({ ...current, [group.id]: '' }))); }}>
              <Input label="Chủ đề mới" value={topicTitle[group.id] ?? ''} onChange={(e) => setTopicTitle((current) => ({ ...current, [group.id]: e.target.value }))} />
              <Button type="submit" size="sm" disabled={busy || (topicTitle[group.id] ?? '').trim().length < 2}>Thêm chủ đề</Button>
            </form>
          </div>
        ))}
      </Card>
      <EventFormDialog
        open={creatingEvent}
        busy={busy}
        onClose={() => setCreatingEvent(false)}
        onSubmit={(draft) => run(() => createEvent(draft), 'Đã tạo sự kiện.')}
      />
      {askDialog}
      {confirmDialog}
    </div>
  );
};

interface ReportedPost {
  id: string;
  body: string;
  hidden_at: string | null;
  reports: number;
  reasons: string[] | null;
  community_name: string | null;
  author_id: string;
  author: string;
  author_restricted_until: string | null;
}


/** INT-008 / M07–M08: thư viện khóa học và hoạt động lộ trình đã duyệt */
export const ContentLibraryAdminPage: React.FC = () => {
  const { ask, dialog: askDialog } = useAskText();
  const [suggestions, setSuggestions] = useState<Array<{ id: string; kind: string; title: string; provider: string | null; url: string | null; is_partner: boolean; is_active: boolean; skill_keywords: string[] | null }>>([]);
  const [activities, setActivities] = useState<Array<{ id: string; pillar: string; title: string; duration_weeks: number; hours: number; is_active: boolean }>>([]);
  const [suggest, setSuggest] = useState({ kind: 'course', title: '', provider: '', url: '', partner: false, keywords: '' });
  const [activity, setActivity] = useState({ pillar: 'knowledge', title: '', weeks: '2', hours: '6' });
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const reload = useCallback(async () => {
    const [s, a] = await Promise.all([
      db.from('course_project_suggestions').select('id, kind, title, provider, url, is_partner, is_active, skill_keywords').order('title'),
      db.from('approved_roadmap_activities').select('id, pillar, title, duration_weeks, hours, is_active').order('pillar').order('title'),
    ]);
    if (s.error) throw s.error;
    if (a.error) throw a.error;
    setSuggestions((s.data ?? []) as typeof suggestions);
    setActivities((a.data ?? []) as typeof activities);
  }, []);

  useEffect(() => {
    reload().catch(() => setMessage({ tone: 'danger', text: 'Không tải được thư viện.' }));
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
      <Card title="Khóa học, dự án, chứng chỉ">
        <form className="module-form" onSubmit={(e) => { e.preventDefault(); void run(async () => {
          const { error } = await db.from('course_project_suggestions').insert({
            kind: suggest.kind, title: suggest.title.trim(), provider: suggest.provider || null, url: suggest.url || null, is_partner: suggest.partner, is_active: true,
            skill_keywords: splitKeywords(suggest.keywords),
          });
          if (error) throw error;
          setSuggest({ kind: suggest.kind, title: '', provider: '', url: '', partner: false, keywords: '' });
        }, 'Đã thêm gợi ý.'); }}>
          <Select label="Loại" value={suggest.kind} options={[{ value: 'course', label: 'Khóa học' }, { value: 'project', label: 'Dự án' }, { value: 'certificate', label: 'Chứng chỉ' }]} onChange={(v) => setSuggest({ ...suggest, kind: v })} />
          <Input label="Tên" value={suggest.title} onChange={(e) => setSuggest({ ...suggest, title: e.target.value })} />
          <Input label="Đơn vị" value={suggest.provider} onChange={(e) => setSuggest({ ...suggest, provider: e.target.value })} />
          <Input label="Liên kết" value={suggest.url} onChange={(e) => setSuggest({ ...suggest, url: e.target.value })} placeholder="https://" />
          <Input label="Kỹ năng liên quan" value={suggest.keywords} onChange={(e) => setSuggest({ ...suggest, keywords: e.target.value })} placeholder="SQL, Power BI" />
          <Checkbox label="Đối tác" checked={suggest.partner} onChange={(checked) => setSuggest({ ...suggest, partner: checked })} />
          <Button type="submit" disabled={suggest.title.trim().length < 3}>Thêm</Button>
        </form>
        <ul className="module-list">
          {suggestions.map((s) => (
            <li key={s.id}>
              <Badge>{SUGGESTION_KIND_LABEL[s.kind as keyof typeof SUGGESTION_KIND_LABEL] ?? s.kind}</Badge>
              <span>{s.title}</span>
              {s.is_partner && <Badge variant="info">Đối tác</Badge>}
              {!s.is_active && <Badge>Đang ẩn</Badge>}
              {(s.skill_keywords ?? []).map((k) => <Badge key={k} variant="highlight">{k}</Badge>)}
              <Button type="button" size="sm" variant="ghost" onClick={() => void (async () => {
                const next = await ask({ title: 'Kỹ năng liên quan', label: 'Kỹ năng', confirmLabel: 'Lưu', initialValue: (s.skill_keywords ?? []).join(', ') });
                if (next === null) return;
                await run(async () => {
                  const { error } = await db.from('course_project_suggestions').update({ skill_keywords: splitKeywords(next) }).eq('id', s.id);
                  if (error) throw error;
                }, 'Đã cập nhật kỹ năng liên quan.');
              })()}>
                Sửa kỹ năng
              </Button>
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
              <Badge>{PILLAR_LABEL[a.pillar as keyof typeof PILLAR_LABEL] ?? a.pillar}</Badge>
              <span>{a.title}</span>
              <span>{a.duration_weeks} tuần · {a.hours} giờ</span>
            </li>
          ))}
        </ul>
      </Card>
      {askDialog}
    </div>
  );
};

/** "SQL, Power BI" → ['SQL', 'Power BI'], bỏ trùng và ô trống */
function splitKeywords(text: string): string[] {
  return [...new Set(text.split(/[,;\n]/).map((k) => k.trim()).filter(Boolean))];
}
