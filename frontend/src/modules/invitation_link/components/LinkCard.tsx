import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, RefreshCw, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, ProgressBar } from '../../../components/common';
import { GROUP_LABEL, inviteUrl } from '../invitation.constants';
import { qrDataUrl } from '../invitation.service';
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
  const url = inviteUrl(link.token);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const label = GROUP_LABEL[link.group] ?? link.group;

  useEffect(() => {
    let active = true;
    qrDataUrl(url)
      .then((value) => {
        if (active) setQr(value);
      })
      .catch(() => {
        if (active) setQr(null);
      });
    return () => {
      active = false;
    };
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const downloadQr = () => {
    if (!qr) return;
    const anchor = document.createElement('a');
    anchor.href = qr;
    anchor.download = `ma-qr-${link.group}.png`;
    anchor.click();
  };

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
        {qr && (
          <div className="link-card-qr">
            <img src={qr} alt={`Mã QR mời nhóm ${label}`} width={132} height={132} />
          </div>
        )}
        <div className="link-card-side">
          <div className="link-card-url">
            <input className="link-card-url-input" value={url} readOnly aria-label={`Đường dẫn mời nhóm ${label}`} onFocus={(e) => e.target.select()} />
            <Button variant={copied ? 'secondary' : 'outline'} size="sm" onClick={copy} disabled={link.expired} leftIcon={copied ? <Check size={16} /> : <Copy size={16} />}>
              {copied ? 'Đã sao chép' : 'Sao chép'}
            </Button>
          </div>

          <div className="link-card-progress">
            <span>
              Đã nộp {link.submittedCount}/{link.expectedCount}
            </span>
            <ProgressBar value={(link.submittedCount / link.expectedCount) * 100} label={`Bài đã nộp nhóm ${label}`} />
          </div>

          <div className="link-card-actions">
            <Button variant="ghost" size="sm" onClick={downloadQr} disabled={!qr || link.expired} leftIcon={<Download size={16} />}>
              Tải mã QR
            </Button>
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
