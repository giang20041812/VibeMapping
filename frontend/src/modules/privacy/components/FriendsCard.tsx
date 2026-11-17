import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, RefreshCw, Send, UserMinus, UserPlus, Users } from 'lucide-react';
import { Alert, Badge, Button, Card, Input, Skeleton, SkeletonRegion, useConfirm } from '../../../components/common';
import {
  FRIEND_INVITE_ERROR,
  FRIEND_REQUEST_ERROR,
  getFriendCode,
  listFriends,
  removeFriend,
  requestFriend,
  respondFriend,
  sendFriendInvite,
  type Friend,
  type FriendList,
} from '../friends.service';
import './FriendsCard.css';

type Notice = { tone: 'success' | 'danger' | 'info'; text: string } | null;

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length === 0 ? '?' : ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '')).toUpperCase();
};
const sentRecently = (iso: string | null) => iso !== null && Date.now() - new Date(iso).getTime() < 86_400_000;

/** Liên kết với bạn bè bằng mã (FR03.01.04) và gửi lời mời đánh giá 360° cho bạn */
export const FriendsCard: React.FC<{ guardianBlocked: boolean }> = ({ guardianBlocked }) => {
  const { confirm, dialog } = useConfirm();
  const [list, setList] = useState<FriendList | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const reload = useCallback(() => listFriends().then(setList), []);
  useEffect(() => {
    reload().catch(() => setList({ friends: [], incoming: [], outgoing: [], has_active_friend_link: false }));
    getFriendCode().then(setCode).catch(() => undefined);
  }, [reload]);

  const run = async (fn: () => Promise<Notice>) => {
    setBusy(true);
    setNotice(null);
    try {
      setNotice(await fn());
      await reload();
    } catch {
      setNotice({ tone: 'danger', text: 'Thao tác không thành công. Thử lại sau.' });
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice({ tone: 'info', text: `Mã của bạn: ${code}` });
    }
  };

  const submitCode = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await requestFriend(input);
      if (!result.ok) return { tone: 'danger', text: FRIEND_REQUEST_ERROR[result.reason] ?? 'Không gửi được lời kết bạn.' };
      setInput('');
      return result.status === 'accepted'
        ? { tone: 'success', text: `Bạn và ${result.name || 'người này'} đã là bạn bè.` }
        : { tone: 'success', text: `Đã gửi lời kết bạn tới ${result.name || 'người này'}.` };
    });
  };

  const invite = (friend: Friend) =>
    void run(async () => {
      const result = await sendFriendInvite(friend.user_id);
      return result.ok
        ? { tone: 'success', text: `Đã gửi lời mời đánh giá tới ${friend.name || 'bạn'}.` }
        : { tone: 'danger', text: FRIEND_INVITE_ERROR[result.reason] ?? 'Không gửi được lời mời.' };
    });

  const unfriend = async (friend: Friend) => {
    if (!(await confirm({ title: `Bỏ kết bạn với ${friend.name || 'người này'}?`, confirmLabel: 'Bỏ kết bạn', danger: true }))) return;
    await run(async () => {
      await removeFriend(friend.user_id);
      return { tone: 'success', text: 'Đã bỏ kết bạn.' };
    });
  };

  return (
    <Card title="Bạn bè">
      <div className="friends">
        {notice && <Alert variant={notice.tone}>{notice.text}</Alert>}

        <div className="friends-connect">
          <div className="friends-code">
            <span className="friends-label">Mã kết bạn của bạn</span>
            <div className="friends-code-row">
              <span className="friends-code-value" aria-live="polite">{code ?? '······'}</span>
              <Button type="button" size="sm" variant="outline" leftIcon={copied ? <Check size={14} /> : <Copy size={14} />} disabled={!code} onClick={() => void copyCode()}>
                {copied ? 'Đã chép' : 'Chép mã'}
              </Button>
              <button
                type="button"
                className="friends-icon-btn"
                title="Đổi mã"
                aria-label="Đổi mã kết bạn"
                disabled={busy}
                onClick={() => void getFriendCode(true).then(setCode).catch(() => setNotice({ tone: 'danger', text: 'Không đổi được mã.' }))}
              >
                <RefreshCw size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <form className="friends-add" onSubmit={submitCode}>
            <Input
              label="Mã của bạn bè"
              value={input}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(event) => setInput(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="ABC234"
            />
            <Button type="submit" leftIcon={<UserPlus size={16} />} isLoading={busy} disabled={input.length !== 6}>Kết bạn</Button>
          </form>
        </div>

        {list === null ? (
          <SkeletonRegion>
            <Skeleton shape="text" />
            <Skeleton shape="text" />
          </SkeletonRegion>
        ) : (
          <>
            {list.incoming.length > 0 && (
              <section className="friends-section" aria-label="Lời kết bạn chờ trả lời">
                <h3 className="friends-section-title">Lời kết bạn chờ trả lời <Badge size="sm" variant="highlight">{list.incoming.length}</Badge></h3>
                <ul className="friends-list">
                  {list.incoming.map((r) => (
                    <li key={r.id}>
                      <span className="friends-avatar" aria-hidden="true">{initials(r.name)}</span>
                      <span className="friends-name">{r.name || 'Học sinh'}</span>
                      <div className="friends-actions">
                        <Button type="button" size="sm" disabled={busy} onClick={() => void run(async () => { await respondFriend(r.id, true); return { tone: 'success', text: 'Đã chấp nhận kết bạn.' }; })}>Chấp nhận</Button>
                        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void run(async () => { await respondFriend(r.id, false); return null; })}>Từ chối</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="friends-section" aria-label="Danh sách bạn bè">
              <h3 className="friends-section-title">Bạn bè <span className="friends-count">{list.friends.length}</span></h3>
              {list.friends.length === 0 ? (
                <div className="friends-empty">
                  <Users aria-hidden="true" />
                  <p>Chưa có bạn bè. Đưa mã của bạn cho bạn bè hoặc nhập mã của họ.</p>
                </div>
              ) : (
                <ul className="friends-list">
                  {list.friends.map((f) => (
                    <li key={f.user_id}>
                      <span className="friends-avatar" aria-hidden="true">{initials(f.name)}</span>
                      <span className="friends-name">
                        {f.name || 'Bạn bè'}
                        {sentRecently(f.invite_sent_at) && <Badge size="sm" variant="success">Đã mời đánh giá</Badge>}
                      </span>
                      <div className="friends-actions">
                        {list.has_active_friend_link && (
                          <Button type="button" size="sm" variant="outline" leftIcon={<Send size={14} />}
                            disabled={busy || guardianBlocked || sentRecently(f.invite_sent_at)} onClick={() => invite(f)}>
                            Mời đánh giá
                          </Button>
                        )}
                        <button type="button" className="friends-icon-btn" title="Bỏ kết bạn" aria-label={`Bỏ kết bạn với ${f.name}`} disabled={busy} onClick={() => void unfriend(f)}>
                          <UserMinus size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {list.friends.length > 0 && !list.has_active_friend_link && (
                <p className="friends-hint">Tạo đường dẫn nhóm Bạn bè ở <Link to="/danh-gia-360">Đánh giá 360°</Link> để mời bạn bè đánh giá.</p>
              )}
            </section>

            {list.outgoing.filter((r) => r.status === 'pending').length > 0 && (
              <section className="friends-section" aria-label="Lời kết bạn đã gửi">
                <h3 className="friends-section-title">Đã gửi, chờ chấp nhận</h3>
                <ul className="friends-list is-compact">
                  {list.outgoing.filter((r) => r.status === 'pending').map((r) => (
                    <li key={r.id}>
                      <span className="friends-avatar" aria-hidden="true">{initials(r.name)}</span>
                      <span className="friends-name">{r.name || 'Học sinh'}</span>
                      <Badge size="sm">Đang chờ</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
      {dialog}
    </Card>
  );
};
