import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, LogOut, MessagesSquare, Users } from 'lucide-react';
import { Alert, Breadcrumb, Button, Card, Skeleton, SkeletonRegion, Tabs, useAskText, useConfirm } from '../../../components/common';
import { PostCard } from '../components/PostCard';
import { PostComposer } from '../components/PostComposer';
import { communityErrorText, formatDateTime } from '../community.constants';
import { addComment, createPost, joinCommunity, leaveCommunity, listCommunities, reportPost } from '../community.service';
import type { Community, CommunityPost, PostType } from '../community.types';
import '../Community.css';

type Filter = 'all' | PostType;
const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'post', label: 'Bài viết' },
  { value: 'question', label: 'Hỏi đáp' },
];

/** Bảng tin của một nhóm (UI_09-S03): đăng bài, hỏi đáp, bình luận, báo cáo, rời nhóm */
export const CommunityFeedPage: React.FC = () => {
  const { communityId } = useParams<{ communityId: string }>();
  const navigate = useNavigate();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { ask, dialog: askDialog } = useAskText();
  const [community, setCommunity] = useState<Community | null | undefined>(undefined);
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'warning'; text: string } | null>(null);

  const reload = useCallback(async () => {
    const rows = await listCommunities();
    setCommunity(rows.find((c) => c.id === communityId) ?? null);
  }, [communityId]);

  useEffect(() => {
    reload().catch(() => {
      setCommunity(null);
      setMessage({ tone: 'danger', text: 'Không tải được nhóm.' });
    });
  }, [reload]);

  const posts = useMemo(
    () => (community?.posts ?? []).filter((p) => filter === 'all' || p.post_type === filter),
    [community, filter],
  );

  const run = async (fn: () => Promise<unknown>, ok: string | null, fail: string): Promise<boolean> => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      if (ok) setMessage({ tone: 'success', text: ok });
      await reload();
      return true;
    } catch (caught) {
      setMessage({ tone: 'danger', text: communityErrorText(caught, fail) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (community === undefined) {
    return (
      <SkeletonRegion className="module-page cm-page">
        <Skeleton shape="title" />
        <Skeleton shape="block" />
        <Skeleton shape="block" />
      </SkeletonRegion>
    );
  }

  if (community === null) {
    return (
      <div className="module-page cm-page">
        <div className="cm-empty is-large">
          <MessagesSquare aria-hidden="true" />
          <p>Không tìm thấy nhóm.</p>
          <Link to="/cong-dong" className="cm-link-btn"><ArrowLeft size={16} aria-hidden="true" /> Về cộng đồng</Link>
        </div>
      </div>
    );
  }

  const restricted = community.restricted_until !== null;

  const submitPost = (body: string, type: PostType) =>
    run(() => createPost(community.id, body, type), type === 'question' ? 'Đã đăng câu hỏi.' : 'Đã đăng bài.', 'Không đăng được bài.');

  const submitComment = (post: CommunityPost, body: string) => run(() => addComment(post.id, body), null, 'Không gửi được bình luận.');

  const report = async (post: CommunityPost) => {
    const reason = await ask({ title: 'Báo cáo nội dung vi phạm', label: 'Lý do', confirmLabel: 'Gửi báo cáo', minLength: 8 });
    if (reason) void run(() => reportPost(post.id, reason), 'Đã gửi báo cáo. Quản trị sẽ xem xét.', 'Không gửi được báo cáo.');
  };

  const leave = async () => {
    if (!(await confirm({ title: `Rời nhóm "${community.name}"?`, confirmLabel: 'Rời nhóm', danger: true }))) return;
    setBusy(true);
    try {
      await leaveCommunity(community.id);
      navigate('/cong-dong');
    } catch (caught) {
      setMessage({ tone: 'danger', text: communityErrorText(caught, 'Không rời được nhóm.') });
      setBusy(false);
    }
  };

  return (
    <div className="module-page cm-page">
      <Breadcrumb items={[{ label: 'Cộng đồng', to: '/cong-dong' }, { label: community.name }]} />

      <header className="cm-feed-hero">
        <span className="cm-group-icon is-lg" aria-hidden="true"><MessagesSquare /></span>
        <div className="cm-feed-title">
          <h1>{community.name}</h1>
          {community.description && <p>{community.description}</p>}
          <span className="cm-meta"><Users size={14} aria-hidden="true" /> {community.member_count} thành viên</span>
          {community.topics.length > 0 && (
            <div className="cm-chips">{community.topics.map((t) => <span key={t} className="cm-chip">{t}</span>)}</div>
          )}
        </div>
        {community.joined ? (
          <Button type="button" variant="ghost" leftIcon={<LogOut size={16} />} disabled={busy} onClick={() => void leave()}>Rời nhóm</Button>
        ) : (
          <Button type="button" disabled={busy} onClick={() => void run(() => joinCommunity(community.id), null, 'Không tham gia được nhóm.')}>Tham gia</Button>
        )}
      </header>

      {message && <Alert variant={message.tone}>{message.text}</Alert>}

      {!community.joined ? (
        <Card>
          <div className="cm-empty">
            <Users aria-hidden="true" />
            <p>Tham gia nhóm để xem và đăng bài.</p>
          </div>
        </Card>
      ) : (
        <div className="cm-feed">
          {restricted ? (
            <Alert variant="warning">Bạn tạm thời không đăng bài và bình luận trong nhóm này đến {formatDateTime(community.restricted_until!)}.</Alert>
          ) : (
            <Card><PostComposer busy={busy} onSubmit={submitPost} /></Card>
          )}

          <Tabs items={FILTERS} value={filter} onChange={(value) => setFilter(value as Filter)} label="Lọc bài" />

          {posts.length === 0 ? (
            <div className="cm-empty">
              <MessagesSquare aria-hidden="true" />
              <p>{filter === 'question' ? 'Chưa có câu hỏi nào.' : 'Chưa có bài viết.'}</p>
            </div>
          ) : (
            <div className="cm-posts">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} canWrite={!restricted} busy={busy} onComment={submitComment} onReport={(p) => void report(p)} />
              ))}
            </div>
          )}
        </div>
      )}
      {confirmDialog}
      {askDialog}
    </div>
  );
};
