import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, UserRound } from 'lucide-react';
import { useAuth } from '../../modules/auth/AuthContext';
import { ChangePasswordModal } from '../../modules/account/components/ChangePasswordModal';

/** Avatar ở góc phải trên; bấm vào để mở hồ sơ, đổi mật khẩu, đăng xuất */
export const AccountMenu: React.FC = () => {
  const { session, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const email = session?.user.email ?? '';
  const displayName = profile?.display_name || profile?.full_name || email;
  const initial = displayName.trim().charAt(0).toUpperCase();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

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

  if (!session) return null;

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div ref={rootRef} className="top-popover-root">
      <button
        type="button"
        className="top-avatar"
        aria-label="Tài khoản"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {initial || <UserRound size={18} aria-hidden="true" />}
      </button>

      {open && (
        <div className="top-popover account-popover" role="menu">
          <div className="account-menu-head">
            <span className="account-menu-name truncate">{displayName}</span>
            {email && displayName !== email && <span className="account-menu-email truncate">{email}</span>}
          </div>

          <Link to="/ho-so" role="menuitem" className="top-item">
            <UserRound size={18} aria-hidden="true" />
            Hồ sơ cá nhân
          </Link>

          <button
            type="button"
            role="menuitem"
            className="top-item"
            onClick={() => {
              setOpen(false);
              setPasswordOpen(true);
            }}
          >
            <KeyRound size={18} aria-hidden="true" />
            Đổi mật khẩu
          </button>

          <div className="top-divider" />

          <button type="button" role="menuitem" className="top-item top-item-danger" onClick={handleSignOut}>
            <LogOut size={18} aria-hidden="true" />
            Đăng xuất
          </button>
        </div>
      )}

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
};
