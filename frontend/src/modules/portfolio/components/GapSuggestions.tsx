import React from 'react';
import { ExternalLink, Route, X } from 'lucide-react';
import { Badge, Button, Card } from '../../../components/common';
import { GAP_STATUS_LABEL, GAP_STATUS_VARIANT, SUGGESTION_KIND_LABEL } from '../portfolio.constants';
import type { CourseSuggestion, GapRow } from '../portfolio.types';
import { suggestionsForSkill } from '../skillGap.logic';

interface Props {
  rows: GapRow[];
  suggestions: CourseSuggestion[];
  onAddToRoadmap: (title: string) => void;
  onClose: () => void;
}

/** Gợi ý dự án, khóa học, chứng chỉ cho từng kỹ năng đã chọn (FR08.03.01); thêm gợi ý vào lộ trình (FR08.03.02) */
export const GapSuggestions: React.FC<Props> = ({ rows, suggestions, onAddToRoadmap, onClose }) => (
  <Card
    title="Gợi ý dự án, khóa học, chứng chỉ"
    action={<button type="button" className="pf-icon-btn" aria-label="Đóng gợi ý" onClick={onClose}><X size={16} aria-hidden="true" /></button>}
  >
    <div className="pf-suggest-grid">
      {rows.map((row) => {
        const matches = suggestionsForSkill(row, suggestions);
        return (
          <section key={`${row.section}-${row.content}`} className="pf-suggest-skill" aria-label={row.content}>
            <header className="pf-suggest-head">
              <h3>{row.content}</h3>
              <Badge size="sm" variant={GAP_STATUS_VARIANT[row.status]}>{GAP_STATUS_LABEL[row.status]}</Badge>
            </header>
            {matches.length === 0 ? (
              <p className="pf-muted">Đang cập nhật</p>
            ) : (
              <ul className="pf-suggest-list">
                {matches.map((s) => (
                  <li key={s.id}>
                    <div className="pf-suggest-body">
                      <span className="pf-suggest-tags">
                        <Badge size="sm">{SUGGESTION_KIND_LABEL[s.kind]}</Badge>
                        {s.is_partner && <Badge size="sm" variant="highlight">Đối tác</Badge>}
                      </span>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="pf-suggest-link">
                          {s.title}
                          <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="pf-suggest-link">{s.title}</span>
                      )}
                      {s.provider && <small>{s.provider}</small>}
                    </div>
                    <Button type="button" size="sm" variant="outline" leftIcon={<Route size={14} />} onClick={() => onAddToRoadmap(s.title)}>
                      Thêm vào lộ trình
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button type="button" size="sm" variant="ghost" leftIcon={<Route size={14} />} onClick={() => onAddToRoadmap(`Rèn kỹ năng ${row.content}`)}>
              Đưa kỹ năng vào lộ trình
            </Button>
          </section>
        );
      })}
    </div>
  </Card>
);
