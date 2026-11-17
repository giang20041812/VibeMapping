import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Briefcase, Send, UserSearch } from 'lucide-react';
import { Alert, Badge, Breadcrumb, Button, Card, Modal, Skeleton, SkeletonRegion, Textarea } from '../../../components/common';
import { useAuth } from '../../auth/AuthContext';
import { CONNECTION_STATUS_LABEL, CONNECTION_STATUS_VARIANT, communityErrorText, initials } from '../community.constants';
import { listMentors, requestConnection } from '../community.service';
import type { Mentor } from '../community.types';
import '../Community.css';

/** Hồ sơ người hướng dẫn và gửi yêu cầu kết nối (UI_09-S08; FR09.01.13, FR09.01.15) */
export const MentorProfilePage: React.FC = () => {
  const { mentorId } = useParams<{ mentorId: string }>();
  const { profile } = useAuth();
  const isLearner = profile?.role === 'student' || profile?.role === 'university_student';
  const [mentor, setMentor] = useState<Mentor | null | undefined>(undefined);
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const reload = useCallback(async () => {
    const rows = await listMentors();
    setMentor(rows.find((m) => m.user_id === mentorId) ?? null);
  }, [mentorId]);

  useEffect(() => {
    reload().catch(() => setMentor(null));
  }, [reload]);

  if (mentor === undefined) {
    return (
      <SkeletonRegion className="module-page cm-page">
        <Skeleton shape="title" />
        <Skeleton shape="block" />
      </SkeletonRegion>
    );
  }

  if (mentor === null) {
    return (
      <div className="module-page cm-page">
        <div className="cm-empty is-large">
          <UserSearch aria-hidden="true" />
          <p>Không tìm thấy người hướng dẫn.</p>
          <Link to="/cong-dong?tab=nguoi-huong-dan" className="cm-link-btn"><ArrowLeft size={16} aria-hidden="true" /> Về danh sách người hướng dẫn</Link>
        </div>
      </div>
    );
  }

  const name = mentor.name || 'Người hướng dẫn';
  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await requestConnection(mentor.user_id, note);
      await reload();
      setComposing(false);
      setNote('');
      setMessage({ tone: 'success', text: 'Đã gửi yêu cầu kết nối.' });
    } catch (caught) {
      setMessage({ tone: 'danger', text: communityErrorText(caught, 'Không gửi được yêu cầu.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-page cm-page">
      <Breadcrumb items={[{ label: 'Cộng đồng', to: '/cong-dong' }, { label: 'Người hướng dẫn', to: '/cong-dong?tab=nguoi-huong-dan' }, { label: name }]} />
      {message && <Alert variant={message.tone}>{message.text}</Alert>}

      <div className="cm-detail-layout">
        <div className="cm-detail-main">
          <header className="cm-profile-head">
            <span className="cm-avatar is-lg" aria-hidden="true">{initials(name)}</span>
            <div className="cm-profile-title">
              <h1>
                {name}
                {mentor.verified && <BadgeCheck size={20} className="cm-verified" aria-label="Đã xác minh" />}
              </h1>
              <p>{mentor.headline}</p>
              {mentor.years_experience !== null && (
                <span className="cm-meta"><Briefcase size={14} aria-hidden="true" /> {mentor.years_experience} năm kinh nghiệm</span>
              )}
            </div>
          </header>

          <Card title="Giới thiệu">
            {mentor.bio ? <p className="cm-prewrap">{mentor.bio}</p> : <p className="cm-meta">Đang cập nhật</p>}
          </Card>

          {(mentor.field_names.length > 0 || mentor.expertise_topics.length > 0) && (
            <Card title="Chuyên môn">
              {mentor.field_names.length > 0 && (
                <div className="cm-profile-group">
                  <h3>Lĩnh vực</h3>
                  <div className="cm-chips">{mentor.field_names.map((f) => <span key={f} className="cm-chip is-field">{f}</span>)}</div>
                </div>
              )}
              {mentor.expertise_topics.length > 0 && (
                <div className="cm-profile-group">
                  <h3>Chủ đề tư vấn</h3>
                  <div className="cm-chips">{mentor.expertise_topics.map((t) => <span key={t} className="cm-chip">{t}</span>)}</div>
                </div>
              )}
            </Card>
          )}
        </div>

        <aside className="cm-detail-side">
          <Card title="Kết nối">
            {mentor.is_me ? (
              <p className="cm-meta">Đây là hồ sơ của bạn.</p>
            ) : mentor.connection_status ? (
              <div className="cm-connect-state">
                <Badge variant={CONNECTION_STATUS_VARIANT[mentor.connection_status]}>{CONNECTION_STATUS_LABEL[mentor.connection_status]}</Badge>
                {mentor.connection_status !== 'accepted' && isLearner && (
                  <Button type="button" variant="outline" block onClick={() => setComposing(true)}>Gửi lại yêu cầu</Button>
                )}
              </div>
            ) : isLearner ? (
              <Button type="button" block size="lg" leftIcon={<Send size={16} />} onClick={() => setComposing(true)}>Gửi yêu cầu kết nối</Button>
            ) : (
              <p className="cm-meta">Học sinh, sinh viên gửi được yêu cầu kết nối.</p>
            )}
          </Card>
        </aside>
      </div>

      <Modal
        open={composing}
        title={`Kết nối với ${name}`}
        onClose={() => setComposing(false)}
        locked={busy}
        actions={
          <>
            <Button variant="outline" onClick={() => setComposing(false)} disabled={busy}>Hủy</Button>
            <Button isLoading={busy} onClick={() => void send()}>Gửi yêu cầu</Button>
          </>
        }
      >
        <Textarea label="Lời nhắn" rows={4} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
      </Modal>
    </div>
  );
};
