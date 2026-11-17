import React, { useState } from 'react';
import { Flag, HelpCircle, MessageCircle, Send } from 'lucide-react';
import { Badge, Button, Input } from '../../../components/common';
import { POST_TYPE_LABEL, formatRelative, initials } from '../community.constants';
import type { CommunityPost } from '../community.types';

interface Props {
  post: CommunityPost;
  canWrite: boolean;
  busy: boolean;
  onComment: (post: CommunityPost, body: string) => Promise<boolean>;
  onReport: (post: CommunityPost) => void;
}

const COLLAPSED_COMMENTS = 2;

/** Một bài trong bảng tin: nhãn Nội dung thành viên, bình luận, báo cáo vi phạm */
export const PostCard: React.FC<Props> = ({ post, canWrite, busy, onComment, onReport }) => {
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const hidden = post.comments.length - COLLAPSED_COMMENTS;
  const comments = expanded || hidden <= 0 ? post.comments : post.comments.slice(-COLLAPSED_COMMENTS);
  const author = post.author || 'Thành viên';

  return (
    <article className={`cm-post${post.post_type === 'question' ? ' is-question' : ''}`}>
      <header className="cm-post-head">
        <span className="cm-avatar is-sm" aria-hidden="true">{initials(author)}</span>
        <div className="cm-post-author">
          <strong>{author}</strong>
          <span className="cm-meta">{formatRelative(post.created_at)}</span>
        </div>
        <div className="cm-post-tags">
          {post.post_type === 'question' && <Badge size="sm" variant="highlight"><HelpCircle size={12} aria-hidden="true" /> {POST_TYPE_LABEL.question}</Badge>}
          <Badge size="sm">Nội dung thành viên</Badge>
        </div>
      </header>

      <p className="cm-post-body">{post.body}</p>

      <footer className="cm-post-foot">
        <span className="cm-meta"><MessageCircle size={14} aria-hidden="true" /> {post.comments.length} {post.post_type === 'question' ? 'trả lời' : 'bình luận'}</span>
        {!post.is_mine && (
          <button type="button" className="cm-text-btn" onClick={() => onReport(post)}>
            <Flag size={14} aria-hidden="true" /> Báo cáo
          </button>
        )}
      </footer>

      {post.comments.length > 0 && (
        <div className="cm-comments">
          {hidden > 0 && !expanded && (
            <button type="button" className="cm-text-btn" onClick={() => setExpanded(true)}>Xem thêm {hidden} {post.post_type === 'question' ? 'trả lời' : 'bình luận'}</button>
          )}
          <ul>
            {comments.map((c) => (
              <li key={c.id}>
                <span className="cm-avatar is-xs" aria-hidden="true">{initials(c.author || 'Thành viên')}</span>
                <div className="cm-comment-body">
                  <span><strong>{c.author || 'Thành viên'}</strong> <span className="cm-meta">{formatRelative(c.created_at)}</span></span>
                  <p>{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canWrite && (
        <form
          className="cm-comment-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onComment(post, draft).then((ok) => ok && setDraft(''));
          }}
        >
          <Input
            className="cm-comment-input"
            value={draft}
            maxLength={1000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={post.post_type === 'question' ? 'Viết câu trả lời' : 'Viết bình luận'}
            aria-label={post.post_type === 'question' ? 'Câu trả lời' : 'Bình luận'}
          />
          <Button type="submit" size="sm" variant="ghost" disabled={busy || !draft.trim()} aria-label="Gửi">
            <Send size={16} aria-hidden="true" />
          </Button>
        </form>
      )}
    </article>
  );
};
