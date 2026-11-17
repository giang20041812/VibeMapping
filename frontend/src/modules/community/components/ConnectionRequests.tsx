import React from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Badge, Button, Card } from '../../../components/common';
import { CONNECTION_STATUS_LABEL, CONNECTION_STATUS_VARIANT, formatRelative } from '../community.constants';
import type { ConnectionRequest } from '../community.types';

interface Props {
  rows: ConnectionRequest[];
  busy: boolean;
  onRespond: (row: ConnectionRequest, accept: boolean) => void;
}

/** Yêu cầu kết nối đã gửi và đã nhận */
export const ConnectionRequests: React.FC<Props> = ({ rows, busy, onRespond }) => {
  if (rows.length === 0) return null;
  const pending = rows.filter((r) => r.incoming && r.status === 'pending').length;
  return (
    <Card title={pending > 0 ? `Yêu cầu kết nối (${pending} chờ trả lời)` : 'Yêu cầu kết nối'}>
      <ul className="cm-requests">
        {rows.map((r) => (
          <li key={r.id}>
            <span className={`cm-request-dir${r.incoming ? ' is-in' : ''}`} aria-hidden="true">
              {r.incoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
            </span>
            <div className="cm-request-body">
              <span className="cm-request-name">{r.incoming ? `Từ ${r.other_name || 'học sinh'}` : `Gửi ${r.other_name || 'người hướng dẫn'}`}</span>
              {r.message && <p className="cm-request-msg">{r.message}</p>}
              <span className="cm-meta">{formatRelative(r.created_at)}</span>
            </div>
            <div className="cm-request-actions">
              {r.incoming && r.status === 'pending' ? (
                <>
                  <Button type="button" size="sm" disabled={busy} onClick={() => onRespond(r, true)}>Chấp nhận</Button>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onRespond(r, false)}>Từ chối</Button>
                </>
              ) : (
                <Badge size="sm" variant={CONNECTION_STATUS_VARIANT[r.status]}>{CONNECTION_STATUS_LABEL[r.status]}</Badge>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
};
