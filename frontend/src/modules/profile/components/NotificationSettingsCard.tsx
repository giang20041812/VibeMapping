import React, { useEffect, useState } from 'react';
import { Bell, Mail } from 'lucide-react';
import { Alert, Card, Checkbox, Skeleton, SkeletonRegion } from '../../../components/common';
import {
  NOTIFICATION_TYPE_LABEL,
  loadNotificationPreferences,
  saveNotificationPreference,
  type NotificationPreference,
} from '../../account/account.service';
import './NotificationSettingsCard.css';

/** Bật hoặc tắt từng loại thông báo trong ứng dụng và qua email (FR03.02.04, FR03.02.02) */
export const NotificationSettingsCard: React.FC<{ userId: string }> = ({ userId }) => {
  const [prefs, setPrefs] = useState<NotificationPreference[] | null>(null);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNotificationPreferences(userId).then(setPrefs).catch(() => {
      setPrefs([]);
      setError('Không tải được cài đặt thông báo.');
    });
  }, [userId]);

  const update = async (pref: NotificationPreference, patch: Partial<Pick<NotificationPreference, 'inApp' | 'email'>>) => {
    const next = { ...pref, ...patch };
    setPrefs((list) => list?.map((p) => (p.type === pref.type ? next : p)) ?? null);
    setSavingType(pref.type);
    setError(null);
    try {
      await saveNotificationPreference(userId, next);
    } catch {
      setPrefs((list) => list?.map((p) => (p.type === pref.type ? pref : p)) ?? null);
      setError('Không lưu được cài đặt. Thử lại sau.');
    } finally {
      setSavingType(null);
    }
  };

  return (
    <Card title="Cài đặt thông báo" className="notif-settings">
      {error && <Alert variant="danger">{error}</Alert>}
      {prefs === null ? (
        <SkeletonRegion>
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} shape="text" />)}
        </SkeletonRegion>
      ) : (
        <div className="notif-settings-table" role="table" aria-label="Cài đặt thông báo">
          <div className="notif-settings-row is-head" role="row">
            <span role="columnheader">Loại thông báo</span>
            <span role="columnheader"><Bell size={14} aria-hidden="true" /> Trong ứng dụng</span>
            <span role="columnheader"><Mail size={14} aria-hidden="true" /> Email</span>
          </div>
          {prefs.map((pref) => (
            <div key={pref.type} className="notif-settings-row" role="row">
              <span role="cell" className="notif-settings-name">{NOTIFICATION_TYPE_LABEL[pref.type]}</span>
              <span role="cell">
                <Checkbox
                  label=""
                  aria-label={`${NOTIFICATION_TYPE_LABEL[pref.type]} trong ứng dụng`}
                  checked={pref.inApp}
                  disabled={savingType === pref.type}
                  onChange={(checked) => void update(pref, { inApp: checked })}
                />
              </span>
              <span role="cell">
                {pref.emailAvailable ? (
                  <Checkbox
                    label=""
                    aria-label={`${NOTIFICATION_TYPE_LABEL[pref.type]} qua email`}
                    checked={pref.email}
                    disabled={savingType === pref.type}
                    onChange={(checked) => void update(pref, { email: checked })}
                  />
                ) : (
                  <span className="notif-settings-na" title="Loại này chỉ báo trong ứng dụng">–</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
