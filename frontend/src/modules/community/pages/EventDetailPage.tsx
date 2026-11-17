import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, CalendarClock, CalendarDays, Hourglass, MapPin, Users } from 'lucide-react';
import { Alert, Badge, Breadcrumb, Button, Card, ProgressBar, Skeleton, SkeletonRegion } from '../../../components/common';
import { EVENT_STATE_LABEL, EVENT_STATE_VARIANT, communityErrorText, eventState, formatDateTime } from '../community.constants';
import { getEvent, registerEvent } from '../community.service';
import type { CareerEvent } from '../community.types';
import '../Community.css';

/** Chi tiết sự kiện và đăng ký (UI_09-S06; FR09.01.11, FR09.01.12) */
export const EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<CareerEvent | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const reload = useCallback(async () => {
    if (!eventId) return;
    setEvent(await getEvent(eventId));
  }, [eventId]);

  useEffect(() => {
    reload().catch(() => setEvent(null));
  }, [reload]);

  if (event === undefined) {
    return (
      <SkeletonRegion className="module-page cm-page">
        <Skeleton shape="title" />
        <Skeleton shape="block" />
      </SkeletonRegion>
    );
  }

  if (event === null) {
    return (
      <div className="module-page cm-page">
        <div className="cm-empty is-large">
          <CalendarDays aria-hidden="true" />
          <p>Không tìm thấy sự kiện.</p>
          <Link to="/cong-dong?tab=su-kien" className="cm-link-btn"><ArrowLeft size={16} aria-hidden="true" /> Về danh sách sự kiện</Link>
        </div>
      </div>
    );
  }

  const state = eventState(event);
  const seatsLeft = event.seat_limit !== null ? Math.max(event.seat_limit - event.registrations, 0) : null;

  const toggle = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await registerEvent(event.id, !event.registered);
      await reload();
      setMessage({ tone: 'success', text: event.registered ? 'Đã hủy đăng ký.' : 'Đã đăng ký sự kiện.' });
    } catch (caught) {
      setMessage({ tone: 'danger', text: communityErrorText(caught, 'Không đăng ký được.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-page cm-page">
      <Breadcrumb items={[{ label: 'Cộng đồng', to: '/cong-dong' }, { label: 'Sự kiện', to: '/cong-dong?tab=su-kien' }, { label: event.title }]} />

      <div className="cm-detail-layout">
        <div className="cm-detail-main">
          <header className="cm-detail-head">
            <Badge variant={EVENT_STATE_VARIANT[state]}>{EVENT_STATE_LABEL[state]}</Badge>
            <h1>{event.title}</h1>
          </header>
          {message && <Alert variant={message.tone}>{message.text}</Alert>}
          <Card title="Nội dung chính">
            {event.description ? <p className="cm-prewrap">{event.description}</p> : <p className="cm-meta">Đang cập nhật</p>}
          </Card>
        </div>

        <aside className="cm-detail-side">
          <Card>
            <dl className="cm-facts">
              <div><dt><CalendarClock size={16} aria-hidden="true" />Thời gian</dt><dd>{formatDateTime(event.starts_at)}</dd></div>
              {event.location && <div><dt><MapPin size={16} aria-hidden="true" />Địa điểm</dt><dd>{event.location}</dd></div>}
              {event.audience && <div><dt><Users size={16} aria-hidden="true" />Đối tượng</dt><dd>{event.audience}</dd></div>}
              <div><dt><Building2 size={16} aria-hidden="true" />Đơn vị tổ chức</dt><dd>{event.organizer}</dd></div>
              {event.registration_deadline && (
                <div><dt><Hourglass size={16} aria-hidden="true" />Hạn đăng ký</dt><dd>{formatDateTime(event.registration_deadline)}</dd></div>
              )}
            </dl>
            {event.seat_limit !== null ? (
              <div className="cm-seats is-block">
                <ProgressBar value={(event.registrations / event.seat_limit) * 100} label="Số chỗ đã đăng ký" tone="accent" />
                <span>{seatsLeft === 0 ? 'Hết chỗ' : `Còn ${seatsLeft}/${event.seat_limit} chỗ`}</span>
              </div>
            ) : (
              <p className="cm-meta">{event.registrations} người đã đăng ký</p>
            )}
            {state === 'registered' ? (
              <Button type="button" variant="outline" block size="lg" isLoading={busy} onClick={() => void toggle()}>Hủy đăng ký</Button>
            ) : (
              <Button type="button" block size="lg" isLoading={busy} disabled={state !== 'open'} onClick={() => void toggle()}>
                {state === 'open' ? 'Đăng ký tham gia' : EVENT_STATE_LABEL[state]}
              </Button>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
};
