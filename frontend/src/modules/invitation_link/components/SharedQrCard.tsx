import React, { useEffect, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { Button } from '../../../components/common';
import { sharedInviteUrl } from '../invitation.constants';
import { qrDataUrl } from '../invitation.service';
import type { InviteLink } from '../invitation.service';
import './LinkCard.css';

export interface SharedQrCardProps {
  links: InviteLink[];
  /** Gọn, không khung, để đặt trong thanh */
  inline?: boolean;
}

/** Một mã QR và một đường dẫn chung cho mọi nhóm đang mở */
export const SharedQrCard: React.FC<SharedQrCardProps> = ({ links, inline = false }) => {
  const url = sharedInviteUrl(links.map((l) => l.token));
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const download = () => {
    if (!qr) return;
    const anchor = document.createElement('a');
    anchor.href = qr;
    anchor.download = 'ma-qr-moi-danh-gia.png';
    anchor.click();
  };

  if (inline) {
    return (
      <div className="shared-qr-inline">
        {qr && <img className="shared-qr-inline-img" src={qr} alt="Mã QR mời đánh giá" width={96} height={96} />}
        <div className="shared-qr-inline-side">
          <input className="link-card-url-input" value={url} readOnly aria-label="Đường dẫn mời đánh giá" onFocus={(e) => e.target.select()} />
          <div className="link-card-actions">
            <Button variant={copied ? 'secondary' : 'outline'} size="sm" onClick={copy} leftIcon={copied ? <Check size={16} /> : <Copy size={16} />}>
              {copied ? 'Đã sao chép' : 'Sao chép'}
            </Button>
            <Button variant="ghost" size="sm" onClick={download} disabled={!qr} leftIcon={<Download size={16} />}>
              Tải mã QR
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <article className="link-card">
      <header className="link-card-head">
        <h3 className="link-card-title">Mã QR mời đánh giá</h3>
      </header>
      <div className="link-card-main">
        {qr && (
          <div className="link-card-qr">
            <img src={qr} alt="Mã QR mời đánh giá" width={132} height={132} />
          </div>
        )}
        <div className="link-card-side">
          <div className="link-card-url">
            <input className="link-card-url-input" value={url} readOnly aria-label="Đường dẫn mời đánh giá" onFocus={(e) => e.target.select()} />
            <Button variant={copied ? 'secondary' : 'outline'} size="sm" onClick={copy} leftIcon={copied ? <Check size={16} /> : <Copy size={16} />}>
              {copied ? 'Đã sao chép' : 'Sao chép'}
            </Button>
          </div>
          <div className="link-card-actions">
            <Button variant="ghost" size="sm" onClick={download} disabled={!qr} leftIcon={<Download size={16} />}>
              Tải mã QR
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
};
