import React from 'react';
import { Globe360 } from '../../../components/charts/Globe360/Globe360';
import type { GlobeNode } from '../../../components/charts/Globe360/Globe360';
import './GlobeSwitch.css';

export interface GlobeSwitchProps {
  checked: boolean;
  disabled?: boolean;
  title: string;
  nodes: GlobeNode[];
  onToggle: () => void;
}

/**
 * Công tắc có quả địa cầu: bật thì quả cầu hiện màu và quay, tắt thì đổi sang xám, giảm tốc rồi đứng yên.
 * Cả khối là một ô chọn, bấm vào quả cầu hay công tắc đều gạt được.
 */
export const GlobeSwitch: React.FC<GlobeSwitchProps> = ({ checked, disabled = false, title, nodes, onToggle }) => (
  <label className={`globe-switch ${checked ? 'is-on' : 'is-off'} ${disabled ? 'is-disabled' : ''}`}>
    <input type="checkbox" role="switch" className="globe-switch-input" checked={checked} disabled={disabled} onChange={onToggle} />

    <span className="globe-switch-globe" aria-hidden="true">
      <Globe360 nodes={nodes} active={checked} compact />
    </span>

    <span className="globe-switch-body">
      <span className="globe-switch-title">{title}</span>
      <span className="globe-switch-state">{checked ? 'Đang bật' : 'Đang tắt'}</span>
      <span className="globe-switch-groups" aria-hidden="true">
        {nodes.map((node) => {
          const Icon = node.Icon;
          return (
            <span key={node.key} className={`globe-switch-group globe-switch-tone-${node.tone}`}>
              {Icon && <Icon size={16} />}
              {node.label}
            </span>
          );
        })}
      </span>
    </span>

    <span className="globe-switch-track" aria-hidden="true">
      <span className="globe-switch-thumb" />
    </span>
  </label>
);
