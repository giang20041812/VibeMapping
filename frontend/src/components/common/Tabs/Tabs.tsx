import React from 'react';
import './Tabs.css';

export interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  /** Chấm báo có việc cần chú ý */
  alert?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}

/** Thanh tab kiểu hình dán; cuộn ngang trên màn nhỏ */
export const Tabs: React.FC<TabsProps> = ({ items, value, onChange, label }) => (
  <div className="app-tabs" role="tablist" aria-label={label}>
    {items.map((item) => (
      <button
        key={item.value}
        type="button"
        role="tab"
        aria-selected={item.value === value}
        className={`app-tab${item.value === value ? ' is-active' : ''}`}
        onClick={() => onChange(item.value)}
      >
        {item.icon && (
          <span className="app-tab-icon" aria-hidden="true">
            {item.icon}
          </span>
        )}
        {item.label}
        {item.alert && <span className="app-tab-dot" role="img" aria-label="Cần chú ý" />}
      </button>
    ))}
  </div>
);
