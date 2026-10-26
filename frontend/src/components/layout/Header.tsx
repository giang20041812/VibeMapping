import React from 'react';
import { Database, ShieldCheck, Layers } from 'lucide-react';
import { isSupabaseConfigured } from '../../lib/supabase';
import './Header.css';

export const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="app-container header-container">
        <div className="header-brand">
          <div className="brand-logo-badge">
            <Layers size={20} />
          </div>
          <div className="brand-text">
            <h1 className="brand-title">VibeMapping</h1>
            <span className="brand-subtitle">Enterprise Data Hub</span>
          </div>
        </div>

        <div className="header-right-zone">
          <div
            className={`connection-badge ${isSupabaseConfigured ? 'is-connected' : 'is-local'}`}
            title={
              isSupabaseConfigured
                ? 'Đã kết nối Supabase Cloud/Local'
                : 'Đang chạy chế độ Local Development với Mock Storage'
            }
          >
            <Database size={14} />
            <span className="connection-label">
              {isSupabaseConfigured ? 'Supabase Connected' : 'Supabase (Dev Mode)'}
            </span>
          </div>

          <div className="system-tag">
            <ShieldCheck size={14} />
            <span>AI Rule-Enforced</span>
          </div>
        </div>
      </div>
    </header>
  );
};
