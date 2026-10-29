import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button, Card } from '../../../components/common';
import { GROUP_LABEL } from '../../invitation_link/invitation.constants';
import type { InviteGroup } from '../../invitation_link/invitation.constants';
import { UNAVAILABLE_TEXT } from '../guest.constants';
import { getInvitation } from '../guest.service';
import { GuestIntroSkeleton } from '../components/GuestIntroSkeleton';
import './GuestAssessmentPage.css';

interface RoleOption {
  token: string;
  group: InviteGroup;
  subjectName: string | null;
}

/** Trang quét mã QR chung: người quét chọn mình là ai rồi vào đúng bài của nhóm đó */
export const GuestRolePickerPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [options, setOptions] = useState<RoleOption[] | null>(null);
  const [failed, setFailed] = useState(false);

  const raw = params.get('t') ?? '';

  useEffect(() => {
    const tokens = raw.split(',').filter(Boolean);
    let active = true;
    Promise.all(tokens.map((token) => getInvitation(token).then((invitation) => ({ token, invitation }))))
      .then((list) => {
        if (!active) return;
        setOptions(
          list
            .filter((item) => item.invitation.state === 'valid' && item.invitation.raterGroup)
            .map((item) => ({
              token: item.token,
              group: item.invitation.raterGroup as InviteGroup,
              subjectName: item.invitation.subjectDisplayName,
            })),
        );
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [raw]);

  if (!options && !failed) return <GuestIntroSkeleton />;

  if (failed || !options || options.length === 0) {
    return (
      <Card className="guest-card guest-card-center">
        <div className="guest-state guest-state-warning">
          <AlertTriangle size={40} aria-hidden="true" />
          <p className="guest-state-text">{UNAVAILABLE_TEXT[failed ? 'error' : 'not_found'] ?? UNAVAILABLE_TEXT.error}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="guest-card">
      <div className="guest-intro">
        <h1 className="guest-title">Đánh giá {options[0].subjectName ?? 'bạn của bạn'}</h1>
        <p className="guest-state-text">Bạn là ai của người này?</p>
        {options.map((option) => (
          <Button key={option.token} size="lg" block variant="outline" onClick={() => navigate(`/moi/${option.token}`)}>
            {GROUP_LABEL[option.group]}
          </Button>
        ))}
      </div>
    </Card>
  );
};
