import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Input, Spinner, Textarea, useAskText } from '../../../components/common';
import { callRpc } from '../../../lib/rpc';
import { useAuth } from '../../auth/AuthContext';
import { EventForm } from '../../admin/pages/AdminModulesPages';
import '../../career_explorer/pages/CareerPages.css';

interface Comment { id: string; body: string; author: string }
interface Post { id: string; body: string; created_at: string; author: string; comments: Comment[] }
interface Community { id: string; name: string; description: string | null; joined: boolean; posts: Post[] }
interface Mentor { user_id: string; headline: string; name: string }
interface EventRow { id: string; title: string; description: string | null; location: string | null; starts_at: string; registered: boolean; registrations: number; seat_limit: number | null; registration_deadline: string | null }
interface Connection { id: string; status: string; message: string | null; incoming: boolean; other_name: string }

function errorText(caught: unknown, fallback: string): string {
  const message = String((caught as { message?: string })?.message ?? '');
  if (message.includes('under_guardian_age')) return 'Học sinh dưới 16 tuổi chưa được gửi yêu cầu kết nối 1-1 với người hướng dẫn.';
  if (message.includes('reason_required')) return 'Lý do báo cáo cần ít nhất 8 ký tự.';
  if (message.includes('invalid_name')) return 'Tên nhóm cần ít nhất 3 ký tự.';
  if (message.includes('event_full')) return 'Sự kiện đã hết chỗ.';
  if (message.includes('registration_closed')) return 'Đã quá hạn đăng ký sự kiện.';
  return fallback;
}

export const CommunityPage: React.FC = () => {
  const { profile } = useAuth();
  const { ask, dialog: askDialog } = useAskText();
  const [rows, setRows] = useState<Community[] | null>(null);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [headline, setHeadline] = useState('');
  const [eventDraft, setEventDraft] = useState({ title: '', description: '', location: '', startsAt: '', seatLimit: '', deadline: '' });
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const isLearner = profile?.role === 'student' || profile?.role === 'university_student';

  const reload = useCallback(async () => {
    const [communities, mentorRows, eventRows, connectionRows] = await Promise.all([
      callRpc<Community[]>('list_communities'),
      callRpc<Mentor[]>('list_verified_mentors'),
      callRpc<EventRow[]>('list_career_events'),
      callRpc<Connection[]>('list_my_connection_requests'),
    ]);
    setRows(communities ?? []);
    setMentors(mentorRows ?? []);
    setEvents(eventRows ?? []);
    setConnections(connectionRows ?? []);
  }, []);

  useEffect(() => {
    reload().catch(() => setMessage({ tone: 'danger', text: 'Không tải được cộng đồng.' }));
  }, [reload]);

  const run = async (fn: () => Promise<unknown>, ok: string | null, fail: string) => {
    setMessage(null);
    try {
      await fn();
      if (ok) setMessage({ tone: 'success', text: ok });
      await reload();
    } catch (caught) {
      setMessage({ tone: 'danger', text: errorText(caught, fail) });
    }
  };

  return (
    <div className="module-page">
      <h1>Cộng đồng hướng nghiệp</h1>
      {message && <Alert variant={message.tone}>{message.text}</Alert>}
      {rows === null && <Spinner />}

      <Card title="Sự kiện hướng nghiệp">
        {events.length === 0 ? <p>Chưa có sự kiện sắp diễn ra.</p> : (
          <ul className="module-list">
            {events.map((e) => (
              <li key={e.id}>
                <strong>{e.title}</strong>
                <span>{new Date(e.starts_at).toLocaleString('vi-VN')}</span>
                {e.location && <span>{e.location}</span>}
                <span>{e.registrations}{e.seat_limit ? `/${e.seat_limit}` : ''} người đăng ký</span>
                {e.registration_deadline && <span>Hạn đăng ký {new Date(e.registration_deadline).toLocaleString('vi-VN')}</span>}
                <Button type="button" size="sm" variant={e.registered ? 'outline' : 'primary'}
                  onClick={() => void run(() => callRpc('register_career_event', { p_event_id: e.id, p_register: !e.registered }), null, 'Không đăng ký được.')}>
                  {e.registered ? 'Hủy đăng ký' : 'Đăng ký'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {profile?.role === 'school_admin' && (
        <EventForm value={eventDraft} onChange={setEventDraft} onSubmit={() => void run(async () => {
          await callRpc('create_career_event', {
            p_school_id: null, p_title: eventDraft.title, p_description: eventDraft.description,
            p_location: eventDraft.location, p_starts_at: new Date(eventDraft.startsAt).toISOString(),
            p_seat_limit: eventDraft.seatLimit.trim() ? Number(eventDraft.seatLimit) : null,
            p_registration_deadline: eventDraft.deadline ? new Date(eventDraft.deadline).toISOString() : null,
          });
          setEventDraft({ title: '', description: '', location: '', startsAt: '', seatLimit: '', deadline: '' });
        }, 'Đã tạo sự kiện.', 'Không tạo được sự kiện.')} />
      )}

      <Card title="Tạo nhóm thảo luận">
        <form className="module-form" onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await callRpc('create_community', { p_name: name, p_description: description });
            setName('');
            setDescription('');
          }, 'Đã tạo nhóm.', 'Không tạo được nhóm.');
        }}>
          <Input label="Tên nhóm" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Mô tả" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button type="submit" disabled={name.trim().length < 3}>Tạo</Button>
        </form>
        <p className="explain-note">Bài chứa từ khóa cấm hoặc bị 3 người báo cáo sẽ tự ẩn và chờ quản trị xử lý.</p>
      </Card>

      {(rows ?? []).length === 0 && rows !== null && <p>Chưa có nhóm nào.</p>}
      {(rows ?? []).map((row) => (
        <Card key={row.id} title={row.name}>
          {row.description && <p>{row.description}</p>}
          {!row.joined ? (
            <Button type="button" onClick={() => void run(() => callRpc('join_community', { p_community_id: row.id }), null, 'Không tham gia được.')}>Tham gia</Button>
          ) : (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => void run(() => callRpc('leave_community', { p_community_id: row.id }), 'Đã rời nhóm.', 'Không rời được nhóm.')}>Rời nhóm</Button>
              {row.posts.length === 0 && <p>Chưa có bài viết.</p>}
              {row.posts.map((post) => (
                <div key={post.id} className="decision-option">
                  <div className="top-career-head">
                    <strong>{post.author || 'Thành viên'}</strong>
                    <span className="explain-note">{new Date(post.created_at).toLocaleString('vi-VN')}</span>
                    <button type="button" className="link-button" onClick={async () => {
                      const reason = await ask({ title: 'Báo cáo bài viết', label: 'Lý do báo cáo', confirmLabel: 'Gửi báo cáo', minLength: 8 });
                      if (reason) void run(() => callRpc('report_community_post', { p_post_id: post.id, p_reason: reason }), 'Đã gửi báo cáo.', 'Không gửi được báo cáo.');
                    }}>Báo cáo</button>
                  </div>
                  <Badge>Nội dung thành viên</Badge>
                  <p>{post.body}</p>
                  {post.comments.map((c) => <p key={c.id} className="explain-note"><strong>{c.author}:</strong> {c.body}</p>)}
                  <form className="module-form" onSubmit={(event) => {
                    event.preventDefault();
                    const key = `c-${post.id}`;
                    void run(async () => {
                      await callRpc('add_community_comment', { p_post_id: post.id, p_body: drafts[key] ?? '' });
                      setDrafts((d) => ({ ...d, [key]: '' }));
                    }, null, 'Không gửi được bình luận.');
                  }}>
                    <Input label="Bình luận" value={drafts[`c-${post.id}`] ?? ''} onChange={(e) => setDrafts((d) => ({ ...d, [`c-${post.id}`]: e.target.value }))} />
                    <Button type="submit" size="sm" disabled={!(drafts[`c-${post.id}`] ?? '').trim()}>Gửi</Button>
                  </form>
                </div>
              ))}
              <form className="module-form" onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await callRpc('create_community_post', { p_community_id: row.id, p_body: drafts[row.id] ?? '' });
                  setDrafts((d) => ({ ...d, [row.id]: '' }));
                }, null, 'Không đăng được bài.');
              }}>
                <Textarea label="Bài viết hoặc câu hỏi" value={drafts[row.id] ?? ''} onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))} />
                <Button type="submit" disabled={!(drafts[row.id] ?? '').trim()}>Đăng</Button>
              </form>
            </>
          )}
        </Card>
      ))}

      <Card title="Người hướng dẫn đã xác minh">
        {mentors.length === 0 ? <p>Chưa có người hướng dẫn được xác minh.</p> : (
          <ul className="module-list">
            {mentors.map((m) => (
              <li key={m.user_id}>
                <strong>{m.name || 'Người hướng dẫn'}</strong>
                <span>{m.headline}</span>
                {isLearner && m.user_id !== profile?.id && (
                  <Button type="button" size="sm" variant="outline" onClick={async () => {
                    const note = await ask({ title: 'Kết nối người hướng dẫn', label: 'Lời nhắn' });
                    if (note === null) return;
                    void run(() => callRpc('request_mentor_connection', { p_mentor_id: m.user_id, p_message: note }), 'Đã gửi yêu cầu kết nối.', 'Không gửi được yêu cầu.');
                  }}>Kết nối</Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {profile?.role === 'mentor' && (
          <form className="module-form" onSubmit={(event) => {
            event.preventDefault();
            void run(() => callRpc('save_mentor_profile', { p_headline: headline }), 'Đã lưu hồ sơ. Hồ sơ hiển thị công khai sau khi quản trị xác minh.', 'Giới thiệu cần ít nhất 8 ký tự.');
          }}>
            <Input label="Giới thiệu của bạn" value={headline} onChange={(e) => setHeadline(e.target.value)} />
            <Button type="submit">Lưu hồ sơ người hướng dẫn</Button>
          </form>
        )}
      </Card>

      {connections.length > 0 && (
        <Card title="Yêu cầu kết nối">
          <ul className="module-list">
            {connections.map((c) => (
              <li key={c.id}>
                <span>{c.incoming ? `Từ ${c.other_name}` : `Gửi ${c.other_name}`}</span>
                {c.message && <span>"{c.message}"</span>}
                <Badge variant={c.status === 'accepted' ? 'success' : c.status === 'declined' ? 'danger' : 'default'}>
                  {c.status === 'accepted' ? 'Đã chấp nhận' : c.status === 'declined' ? 'Từ chối' : 'Đang chờ'}
                </Badge>
                {c.incoming && c.status === 'pending' && (
                  <>
                    <Button type="button" size="sm" onClick={() => void run(() => callRpc('respond_connection_request', { p_id: c.id, p_accept: true }), null, 'Không xử lý được.')}>Chấp nhận</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void run(() => callRpc('respond_connection_request', { p_id: c.id, p_accept: false }), null, 'Không xử lý được.')}>Từ chối</Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {askDialog}
    </div>
  );
};
