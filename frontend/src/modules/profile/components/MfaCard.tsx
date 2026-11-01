import React, { useState } from 'react';
import { Alert, Button, Card, Input } from '../../../components/common';
import { supabase } from '../../../lib/supabase';

/** MFA TOTP cho quản trị hệ thống. Cần bật MFA trên Supabase Auth. */
export const MfaCard: React.FC = () => {
  const [uri, setUri] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const enroll = async () => {
    setMessage(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'VibeMapping' });
    if (error || !data) {
      setMessage(error?.message.includes('already exists') ? 'Tài khoản đã có MFA.' : 'Chưa bật MFA trên máy chủ Auth.');
      return;
    }
    setFactorId(data.id);
    setUri(data.totp.qr_code || data.totp.uri);
  };

  const verify = async () => {
    if (!factorId) return;
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data) {
      setMessage('Không tạo được thử thách MFA.');
      return;
    }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code: code.trim() });
    setMessage(error ? 'Mã không đúng.' : 'Đã bật xác thực hai lớp.');
  };

  return (
    <Card title="Xác thực hai lớp (quản trị)">
      {message && <Alert variant={message.includes('Đã bật') ? 'success' : 'info'}>{message}</Alert>}
      <p className="explain-note">Tài khoản quản trị nên bật TOTP. Mã hết hạn theo chu kỳ 30 giây của ứng dụng xác thực.</p>
      {!uri ? (
        <Button type="button" variant="outline" onClick={() => void enroll()}>Bắt đầu thiết lập MFA</Button>
      ) : (
        <div className="module-form">
          <img src={uri} alt="Mã QR MFA" width={160} height={160} />
          <Input label="Mã 6 số" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button type="button" onClick={() => void verify()} disabled={code.trim().length < 6}>Xác minh</Button>
        </div>
      )}
    </Card>
  );
};
