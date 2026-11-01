import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Input, useConfirm } from '../../../components/common';
import { callRpc } from '../../../lib/rpc';
import { useAuth } from '../../auth/AuthContext';
import { ageOf, GUARDIAN_AGE } from '../../profile/profile.logic';
import '../../career_explorer/pages/CareerPages.css';

interface Person {
  user_id: string;
  name: string;
  role?: string;
  can_view_result?: boolean;
}
interface Connections {
  shares: Person[];
  parents: Person[];
  children: Person[];
  shared_with_me: Person[];
  deletion_requested_at: string | null;
}

function errorText(caught: unknown, fallback: string): string {
  const message = String((caught as { message?: string })?.message ?? '');
  if (message.includes('guardian_consent_required')) return 'Bạn cần xác nhận của người giám hộ trước khi chia sẻ.';
  return fallback;
}

export const PrivacyPage: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [connections, setConnections] = useState<Connections | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [parentCode, setParentCode] = useState<string | null>(null);
  const [acceptCode, setAcceptCode] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [message, setMessage] = useState<{ tone: 'info' | 'danger' | 'success'; text: string } | null>(null);
  const isLearner = profile?.role === 'student' || profile?.role === 'university_student';
  const age = ageOf(profile?.date_of_birth ?? null);
  const needsGuardian = isLearner && age !== null && age < GUARDIAN_AGE && !profile?.guardian_consent_confirmed;

  const reload = useCallback(() => callRpc<Connections>('list_my_connections').then(setConnections), []);
  useEffect(() => {
    reload().catch(() => setMessage({ tone: 'danger', text: 'Không tải được thông tin liên kết.' }));
  }, [reload]);

  const run = async (action: () => Promise<unknown>, ok: string, fail: string) => {
    setMessage(null);
    try {
      await action();
      setMessage({ tone: 'success', text: ok });
      await reload();
    } catch (caught) {
      setMessage({ tone: 'danger', text: errorText(caught, fail) });
    }
  };

  const exportData = async () => {
    try {
      const data = await callRpc<unknown>('export_my_data');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `du-lieu-ca-nhan-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage({ tone: 'danger', text: 'Không xuất được dữ liệu.' });
    }
  };

  return (
    <div className="module-page">
      <h1>Quyền riêng tư và liên kết</h1>
      {message && <Alert variant={message.tone}>{message.text}</Alert>}

      {isLearner && (
        <Card title="Xác nhận của người giám hộ">
          <p>{profile?.guardian_consent_confirmed ? 'Đã có xác nhận của người giám hộ.' : 'Chưa có xác nhận của người giám hộ.'}</p>
          {needsGuardian && (
            <Alert variant="warning">Bạn dưới 16 tuổi: mời đánh giá 360°, chia sẻ kết quả và nộp điểm của giáo viên đang bị khóa cho đến khi có xác nhận.</Alert>
          )}
          {!profile?.guardian_consent_confirmed && (
            <>
              <Button type="button" onClick={() => void callRpc<string>('create_guardian_consent_token').then(setToken).catch(() => setMessage({ tone: 'danger', text: 'Không tạo được liên kết.' }))}>
                Tạo liên kết xác nhận (hạn 15 phút)
              </Button>
              {token && <p className="share-link">{`${window.location.origin}/giam-ho/${token}`}</p>}
              <Button type="button" variant="ghost" onClick={() => void refreshProfile()}>Kiểm tra lại trạng thái</Button>
            </>
          )}
        </Card>
      )}

      {isLearner && (
        <Card title="Liên kết phụ huynh">
          <p>Đưa mã này cho phụ huynh. Phụ huynh nhập mã trong trang Quyền riêng tư của họ. Mã có hạn 24 giờ.</p>
          <Button type="button" onClick={() => void callRpc<string>('create_parent_link_code').then(setParentCode).catch(() => setMessage({ tone: 'danger', text: 'Không tạo được mã.' }))}>
            Tạo mã liên kết
          </Button>
          {parentCode && <p className="share-code">{parentCode}</p>}
          {(connections?.parents.length ?? 0) > 0 && (
            <ul className="module-list">
              {connections!.parents.map((p) => {
                const shared = connections!.shares.some((s) => s.user_id === p.user_id);
                return (
                  <li key={p.user_id}>
                    <span>{p.name || 'Phụ huynh'}</span>
                    {shared ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => void run(() => callRpc('revoke_result_share', { p_user_id: p.user_id }), 'Đã thu hồi chia sẻ.', 'Không thu hồi được.')}>
                        Thu hồi chia sẻ kết quả
                      </Button>
                    ) : (
                      <Button type="button" size="sm" disabled={needsGuardian} onClick={() => void run(() => callRpc('share_result_with', { p_user_id: p.user_id }), 'Đã chia sẻ kết quả.', 'Không chia sẻ được.')}>
                        Chia sẻ kết quả
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {isLearner && (
        <Card title="Đang chia sẻ kết quả với">
          {(connections?.shares.length ?? 0) === 0 ? <p>Bạn chưa chia sẻ kết quả với ai.</p> : (
            <ul className="module-list">
              {connections!.shares.map((s) => (
                <li key={s.user_id}>
                  <span>{s.name || 'Người dùng'}</span>
                  <Badge>{s.role}</Badge>
                  <Button type="button" size="sm" variant="outline" onClick={() => void run(() => callRpc('revoke_result_share', { p_user_id: s.user_id }), 'Đã thu hồi.', 'Không thu hồi được.')}>
                    Thu hồi
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <form className="module-form" onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const result = await callRpc<{ ok: boolean }>('share_result_with_email', { p_email: shareEmail });
              if (!result.ok) throw new Error('user_not_found');
              setShareEmail('');
            }, 'Đã chia sẻ kết quả.', 'Không tìm thấy tài khoản phụ huynh, giáo viên hoặc người hướng dẫn với email này.');
          }}>
            <Input label="Email giáo viên / người hướng dẫn / phụ huynh" type="email" value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} />
            <Button type="submit" disabled={needsGuardian || !shareEmail.trim()}>Chia sẻ</Button>
          </form>
          <p className="explain-note">Người được chia sẻ chỉ thấy điểm tổng hợp, không thấy điểm của từng người chấm.</p>
        </Card>
      )}

      {profile?.role === 'parent' && (
        <Card title="Liên kết với con">
          <form className="module-form" onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const result = await callRpc<{ ok: boolean }>('accept_parent_link', { p_code: acceptCode });
              if (!result.ok) throw new Error('code_invalid');
              setAcceptCode('');
            }, 'Đã liên kết. Kết quả của con chỉ hiện khi con bật chia sẻ.', 'Mã không đúng hoặc đã hết hạn.');
          }}>
            <Input label="Mã liên kết của con" value={acceptCode} onChange={(event) => setAcceptCode(event.target.value)} />
            <Button type="submit" disabled={!acceptCode.trim()}>Liên kết</Button>
          </form>
          {(connections?.children.length ?? 0) > 0 && (
            <ul className="module-list">
              {connections!.children.map((c) => (
                <li key={c.user_id}>
                  <span>{c.name || 'Con'}</span>
                  {c.can_view_result ? <Link to={`/bao-cao-con/${c.user_id}`}>Xem kết quả</Link> : <Badge>Con chưa chia sẻ kết quả</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {!isLearner && profile?.role !== 'parent' && (connections?.shared_with_me.length ?? 0) > 0 && (
        <Card title="Kết quả được chia sẻ với bạn">
          <ul className="module-list">
            {connections!.shared_with_me.map((c) => (
              <li key={c.user_id}><span>{c.name}</span><Link to={`/bao-cao-con/${c.user_id}`}>Xem kết quả</Link></li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Dữ liệu của bạn">
        <div className="module-actions">
          <Button type="button" variant="outline" onClick={() => void exportData()}>Tải dữ liệu cá nhân (JSON)</Button>
          {connections?.deletion_requested_at ? (
            <Button type="button" variant="outline" onClick={() => void run(() => callRpc('request_account_deletion', { p_cancel: true }), 'Đã hủy yêu cầu xóa tài khoản.', 'Không hủy được.')}>
              Hủy yêu cầu xóa tài khoản
            </Button>
          ) : (
            <Button type="button" variant="danger" onClick={async () => {
              if (!(await confirm({ title: 'Yêu cầu xóa tài khoản?', message: 'Tài khoản sẽ bị xóa sau 14 ngày. Bạn có thể hủy trong thời gian này.', confirmLabel: 'Yêu cầu xóa', danger: true }))) return;
              void run(() => callRpc('request_account_deletion', { p_cancel: false }), 'Đã ghi nhận yêu cầu xóa. Tài khoản sẽ bị xóa sau 14 ngày.', 'Không gửi được yêu cầu.');
            }}>
              Yêu cầu xóa tài khoản
            </Button>
          )}
        </div>
        {connections?.deletion_requested_at && (
          <Alert variant="warning">Đã yêu cầu xóa lúc {new Date(connections.deletion_requested_at).toLocaleString('vi-VN')}.</Alert>
        )}
      </Card>
      {confirmDialog}
    </div>
  );
};

export const GuardianConfirmPage: React.FC = () => {
  const { token = '' } = useParams();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="module-page">
      <h1>Xác nhận của người giám hộ</h1>
      <Card title="Cho phép học sinh tham gia đánh giá">
        <p>Bạn xác nhận cho phép học sinh dưới 16 tuổi tham gia đánh giá 360°, chia sẻ kết quả và nhận đánh giá của giáo viên. Học sinh không thể tự xác nhận cho mình.</p>
        <Button type="button" isLoading={busy} onClick={async () => {
          setBusy(true);
          try {
            const result = await callRpc<{ ok: boolean; reason?: string }>('confirm_guardian_consent', { p_token: token });
            setMessage(result.ok
              ? { tone: 'success', text: 'Đã xác nhận.' }
              : { tone: 'danger', text: result.reason === 'subject_cannot_self_confirm' ? 'Bạn đang đăng nhập bằng tài khoản của chính học sinh.' : 'Liên kết đã hết hạn hoặc đã được dùng.' });
          } catch {
            setMessage({ tone: 'danger', text: 'Không xác nhận được.' });
          } finally {
            setBusy(false);
          }
        }}>
          Xác nhận
        </Button>
        {message && <Alert variant={message.tone}>{message.text}</Alert>}
      </Card>
    </div>
  );
};
