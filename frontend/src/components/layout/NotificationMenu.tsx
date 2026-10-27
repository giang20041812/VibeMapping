import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '../../modules/auth/AuthContext';
import {
  countUnreadNotifications,
  getNotificationsEnabled,
  listNotifications,
  markNotificationsRead,
  setNotificationsEnabled,
} from '../../modules/account/account.service';
import type { AppNotification } from '../../modules/account/account.service';

const REFRESH_MS = 60_000;

const formatAgo = (iso: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

/** Icon chuông ở góc phải trên: số chưa đọc, danh sách thông báo và công tắc bật/tắt thông báo */
export const NotificationMenu: React.FC = () => {
  const { session } = useAuth();
  const userId = session?.user.id;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [hasError, setHasError] = useState(false);
  const [busy, setBusy] = useState(false);

  const refreshUnread = useCallback(async () => {
    if (!userId) return;
    try {
      setUnread(await countUnreadNotifications(userId));
    } catch {
      /* giữ số cũ; lỗi đã được ghi ở service */
    }
  }, [userId]);

  useEffect(() => {
    void refreshUnread();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refreshUnread();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refreshUnread]);

  /* Mở menu: tải danh sách và cài đặt mới nhất */
  useEffect(() => {
    if (!open || !userId) return;
    let active = true;
    setHasError(false);
    Promise.all([listNotifications(userId), getNotificationsEnabled(userId)])
      .then(([list, isEnabled]) => {
        if (!active) return;
        setItems(list);
        setEnabled(isEnabled);
        setUnread(list.filter((n) => !n.read).length);
        void refreshUnread();
      })
      .catch(() => {
        if (active) setHasError(true);
      });
    return () => {
      active = false;
    };
  }, [open, userId, refreshUnread]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!userId) return null;

  const readOne = async (item: AppNotification) => {
    if (item.read) return;
    setItems((list) => list?.map((n) => (n.id === item.id ? { ...n, read: true } : n)) ?? null);
    setUnread((count) => Math.max(0, count - 1));
    try {
      await markNotificationsRead(userId, [item.id]);
    } catch {
      void refreshUnread();
    }
  };

  const readAll = async () => {
    setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? null);
    setUnread(0);
    try {
      await markNotificationsRead(userId);
    } catch {
      void refreshUnread();
    }
  };

  const toggleEnabled = async () => {
    if (enabled === null || busy) return;
    const next = !enabled;
    setEnabled(next);
    setBusy(true);
    try {
      await setNotificationsEnabled(userId, next);
    } catch {
      setEnabled(!next);
      setHasError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={rootRef} className="top-popover-root">
      <button
        type="button"
        className="top-icon-button"
        aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && <span className="top-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="top-popover notif-popover" role="dialog" aria-label="Thông báo">
          <div className="notif-head">
            <h2 className="notif-title">Thông báo</h2>
            <label className={`notif-switch ${enabled === null ? 'is-loading' : ''}`}>
              <span className="notif-switch-label">{enabled ? 'Đang bật' : 'Đang tắt'}</span>
              <input
                type="checkbox"
                role="switch"
                className="top-switch-input"
                checked={enabled ?? false}
                disabled={enabled === null || busy}
                onChange={toggleEnabled}
                aria-label="Bật thông báo"
              />
              <span className="top-switch" aria-hidden="true" />
            </label>
          </div>

          {hasError && <p className="top-popover-error">Không tải hoặc không lưu được thông báo</p>}

          {items === null && !hasError && <p className="notif-empty">Đang tải…</p>}
          {items !== null && items.length === 0 && <p className="notif-empty">Chưa có thông báo</p>}

          {items !== null && items.length > 0 && (
            <ul className="notif-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button type="button" className={`notif-item ${item.read ? '' : 'is-unread'}`} onClick={() => readOne(item)}>
                    <span className="notif-item-title">{item.title}</span>
                    {item.body && <span className="notif-item-body">{item.body}</span>}
                    <span className="notif-item-time">{formatAgo(item.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {unread > 0 && (
            <button type="button" className="notif-read-all" onClick={readAll}>
              <CheckCheck size={16} aria-hidden="true" />
              Đánh dấu đã đọc tất cả
            </button>
          )}
        </div>
      )}
    </div>
  );
};
