import React from 'react';
import { BookOpen, Compass, Hammer } from 'lucide-react';
import { PILLAR_LABEL } from '../roadmap.logic';
import type { RoadmapPillar } from '../roadmap.types';

const ICON: Record<RoadmapPillar, React.ReactNode> = {
  knowledge: <BookOpen size={14} />,
  experience: <Hammer size={14} />,
  exploration: <Compass size={14} />,
};

/** Nhãn trụ cột: mỗi trụ một sắc và một biểu tượng, không chỉ dựa vào màu */
export const PillarBadge: React.FC<{ pillar: RoadmapPillar }> = ({ pillar }) => (
  <span className={`pillar-badge pillar-${pillar}`}>
    <span aria-hidden="true">{ICON[pillar]}</span>
    {PILLAR_LABEL[pillar]}
  </span>
);
