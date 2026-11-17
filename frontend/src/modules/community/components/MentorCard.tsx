import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Briefcase } from 'lucide-react';
import { Badge } from '../../../components/common';
import { CONNECTION_STATUS_LABEL, CONNECTION_STATUS_VARIANT, initials } from '../community.constants';
import type { Mentor } from '../community.types';

/** Thẻ người hướng dẫn trong danh bạ, bấm để mở hồ sơ */
export const MentorCard: React.FC<{ mentor: Mentor }> = ({ mentor }) => (
  <li>
    <Link to={`/cong-dong/nguoi-huong-dan/${mentor.user_id}`} className="cm-mentor">
      <span className="cm-avatar" aria-hidden="true">{initials(mentor.name || 'Người hướng dẫn')}</span>
      <span className="cm-mentor-body">
        <span className="cm-mentor-name">
          {mentor.name || 'Người hướng dẫn'}
          {mentor.verified && <BadgeCheck size={16} className="cm-verified" aria-label="Đã xác minh" />}
        </span>
        <span className="cm-mentor-headline">{mentor.headline}</span>
        {mentor.years_experience !== null && (
          <span className="cm-meta"><Briefcase size={14} aria-hidden="true" /> {mentor.years_experience} năm kinh nghiệm</span>
        )}
        {(mentor.field_names.length > 0 || mentor.expertise_topics.length > 0) && (
          <span className="cm-chips">
            {mentor.field_names.map((f) => <span key={f} className="cm-chip is-field">{f}</span>)}
            {mentor.expertise_topics.slice(0, 3).map((t) => <span key={t} className="cm-chip">{t}</span>)}
          </span>
        )}
      </span>
      {mentor.is_me ? (
        <Badge size="sm" variant={mentor.verified ? 'success' : 'warning'}>{mentor.verified ? 'Hồ sơ của bạn' : 'Chờ xác minh'}</Badge>
      ) : mentor.connection_status ? (
        <Badge size="sm" variant={CONNECTION_STATUS_VARIANT[mentor.connection_status]}>{CONNECTION_STATUS_LABEL[mentor.connection_status]}</Badge>
      ) : null}
    </Link>
  </li>
);
