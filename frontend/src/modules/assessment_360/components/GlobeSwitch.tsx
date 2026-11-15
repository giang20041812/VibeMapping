import React from 'react';
import { Rater360 } from '../../../components/charts/Rater360/Rater360';
import type { RaterNode } from '../../../components/charts/Rater360/Rater360';
import './GlobeSwitch.css';

export interface GlobeSwitchProps {
  checked: boolean;
  disabled?: boolean;
  title: string;
  nodes: RaterNode[];
  onToggle: () => void;
  /** Phần nằm trong thanh, giữa nội dung và công tắc; bấm vào đây không gạt công tắc */
  aside?: React.ReactNode;
}

/**
 * Công tắc có sơ đồ 360°: bật thì sơ đồ có màu và tín hiệu chạy vào tâm, tắt thì chuyển xám và đứng yên.
 * Cả khối là một ô chọn, bấm vào sơ đồ hay công tắc đều gạt được.
 */
export const GlobeSwitch: React.FC<GlobeSwitchProps> = ({ checked, disabled = false, title, nodes, onToggle, aside }) => (
  <label className={`globe-switch ${checked ? 'is-on' : 'is-off'} ${disabled ? 'is-disabled' : ''}`}>
    <input type="checkbox" role="switch" className="globe-switch-input" checked={checked} disabled={disabled} onChange={onToggle} />

    <span className="globe-switch-globe" aria-hidden="true">
      <Rater360 nodes={nodes} active={checked} compact />
    </span>

    <span className="globe-switch-body">
      <span className="globe-switch-title">{title}</span>
      <span className="globe-switch-state">{checked ? 'Đang bật' : 'Đang tắt'}</span>
      <span className="globe-switch-groups" aria-hidden="true">
        {nodes.map((node) => {
          const Icon = node.Icon;
          return (
            <span key={node.key} className="globe-switch-group">
              {Icon && <Icon size={16} />}
              {node.label}
            </span>
          );
        })}
      </span>
    </span>

    {aside && (
      <span className="globe-switch-aside" onClick={(e) => e.preventDefault()}>
        {aside}
      </span>
    )}

    <span className="globe-switch-track" aria-hidden="true">
      <span className="globe-switch-thumb" />
    </span>
  </label>
);
