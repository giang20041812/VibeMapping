import React from 'react';
import { GROUP_ICONS } from '../../assessment_result/assessmentResult.constants';
import { GROUP_LABEL } from '../roadmap.logic';
import type { CriteriaGroupCode, Milestone } from '../roadmap.types';
import { PillarBadge } from './PillarBadge';

/** Nhãn nhóm tiêu chí: mỗi nhóm một sắc và biểu tượng riêng như trên biểu đồ năng lực */
export const GroupBadge: React.FC<{ group: CriteriaGroupCode }> = ({ group }) => {
  const Icon = GROUP_ICONS[group];
  return (
    <span className={`pillar-badge group-${group.toLowerCase()}`}>
      <span aria-hidden="true">{Icon && <Icon size={14} />}</span>
      {GROUP_LABEL[group]}
    </span>
  );
};

/** Nhãn của hoạt động: nhóm tiêu chí nếu có, hoạt động cũ thì trụ cột */
export const TrackBadge: React.FC<{ item: Pick<Milestone, 'criteria_group' | 'pillar'> }> = ({ item }) =>
  item.criteria_group ? <GroupBadge group={item.criteria_group} /> : item.pillar ? <PillarBadge pillar={item.pillar} /> : null;
