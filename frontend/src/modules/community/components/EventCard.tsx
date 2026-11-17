import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, MapPin, Users } from 'lucide-react';
import { Badge, Button, ProgressBar } from '../../../components/common';
import { EVENT_STATE_LABEL, EVENT_STATE_VARIANT, eventState, formatDateTime } from '../community.constants';
import type { CareerEvent } from '../community.types';

interface Props {
  event: CareerEvent;
  busy: boolean;
  onToggle: (event: CareerEvent) => void;
}

/** Thẻ sự kiện: ô ngày, thời gian, địa điểm, số chỗ, trạng thái và nút đăng ký */
export const EventCard: React.FC<Props> = ({ event, busy, onToggle }) => {
  const state = eventState(event);
  const start = new Date(event.starts_at);
  const seatsLeft = event.seat_limit !== null ? Math.max(event.seat_limit - event.registrations, 0) : null;

  return (
    <li className={`cm-event is-${state}`}>
      <div className="cm-event-date" aria-hidden="true">
        <span className="cm-event-day">{start.getDate()}</span>
        <span className="cm-event-month">Th{start.getMonth() + 1}</span>
      </div>
      <div className="cm-event-body">
        <div className="cm-event-head">
          <Link to={`/cong-dong/su-kien/${event.id}`} className="cm-event-title">{event.title}</Link>
          <Badge size="sm" variant={EVENT_STATE_VARIANT[state]}>{EVENT_STATE_LABEL[state]}</Badge>
        </div>
        <ul className="cm-facts-inline">
          <li><CalendarClock size={14} aria-hidden="true" />{formatDateTime(event.starts_at)}</li>
          {event.location && <li><MapPin size={14} aria-hidden="true" />{event.location}</li>}
          <li><Users size={14} aria-hidden="true" />{event.organizer}</li>
        </ul>
        {event.seat_limit !== null && (
          <div className="cm-seats">
            <ProgressBar value={(event.registrations / event.seat_limit) * 100} label="Số chỗ đã đăng ký" tone="accent" />
            <span>{seatsLeft === 0 ? 'Hết chỗ' : `Còn ${seatsLeft}/${event.seat_limit} chỗ`}</span>
          </div>
        )}
        {event.registration_deadline && state !== 'past' && (
          <span className="cm-meta">Hạn đăng ký {formatDateTime(event.registration_deadline)}</span>
        )}
      </div>
      <div className="cm-event-actions">
        {state === 'registered' ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onToggle(event)}>Hủy đăng ký</Button>
        ) : (
          <Button type="button" size="sm" disabled={busy || state !== 'open'} onClick={() => onToggle(event)}>Đăng ký</Button>
        )}
        <Link to={`/cong-dong/su-kien/${event.id}`} className="cm-text-link">Xem chi tiết</Link>
      </div>
    </li>
  );
};
