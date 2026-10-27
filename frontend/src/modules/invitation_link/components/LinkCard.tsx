import React from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, ProgressBar } from '../../../components/common';
import { GROUP_LABEL } from '../invitation.constants';
import type { InviteLink } from '../invitation.service';
import './LinkCard.css';

export interface LinkCardProps {
  link: InviteLink;
  disabled: boolean;
  onRevoke: (link: InviteLink) => void;
  onRecreate: (link: InviteLink) => void;
}

const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

export const LinkCard: React.FC<LinkCardProps> = ({ link, disabled, onRevoke, onRecreate }) => {
  const label = GROUP_LABEL[link.group] ?? link.group;

  return (
    <article className={`link-card ${link.expired ? 'is-expired' : ''}`}>
      <header className="link-card-head">
        <h3 className="link-card-title">{label}</h3>
        {link.expired ? (
          <Badge variant="danger">Đã hết hạn</Badge>
        ) : (
          <Badge variant="info">Còn {daysLeft(link.expiresAt)} ngày</Badge>
        )}
      </header>

      {link.expired && (
        <Alert variant="danger">Đường dẫn đã hết hạn. Không thể gia hạn, vui lòng tạo đường dẫn mới.</Alert>
      )}

      <div className="link-card-main">
        <div className="link-card-side">
          <div className="link-card-progress">
            <span>
              Đã nộp {link.submittedCount}/{link.expectedCount}
            </span>
            <ProgressBar value={(link.submittedCount / link.expectedCount) * 100} label={`Bài đã nộp nhóm ${label}`} />
          </div>

          <div className="link-card-actions">
            {link.expired ? (
              <Button size="sm" onClick={() => onRecreate(link)} disabled={disabled} leftIcon={<RefreshCw size={16} />}>
                Tạo đường dẫn mới
              </Button>
            ) : (
              <Button variant="danger" size="sm" onClick={() => onRevoke(link)} disabled={disabled} leftIcon={<Trash2 size={16} />}>
                Thu hồi
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
