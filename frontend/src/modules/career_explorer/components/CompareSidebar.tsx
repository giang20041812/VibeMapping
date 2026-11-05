import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitCompare, Plus, X } from 'lucide-react';
import { Button } from '../../../components/common';
import { careerCompareReady } from '../../../lib/selectionCart';
import { loadCareerNames } from '../career.service';
import '../pages/CareerFit.css';

const SLOTS = 4;

interface Props {
  picked: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export const CompareSidebar: React.FC<Props> = ({ picked, open, onOpenChange, onRemove, onClear }) => {
  const [names, setNames] = useState<Record<string, string>>({});
  const key = picked.join(',');

  useEffect(() => {
    const missing = picked.filter((id) => !names[id]);
    if (missing.length === 0) return;
    let active = true;
    loadCareerNames(missing)
      .then((rows) => {
        if (active) setNames((current) => ({ ...current, ...Object.fromEntries(rows.map((row) => [row.id, row.career_name])) }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (picked.length === 0) return null;
  const ready = careerCompareReady(picked);

  if (!open) {
    return (
      <button type="button" className="compare-side-tab" onClick={() => onOpenChange(true)} aria-label={`So sánh ${picked.length} nghề`}>
        <GitCompare size={18} aria-hidden="true" />
        <span className="compare-side-count">{picked.length}</span>
      </button>
    );
  }

  return (
    <aside className="compare-side" aria-label="So sánh nghề">
      <header className="compare-side-head">
        <span className="compare-side-icon" aria-hidden="true"><GitCompare size={18} /></span>
        <h2>So sánh nghề</h2>
        <span className="compare-side-count">{picked.length}/{SLOTS}</span>
        <button type="button" className="compare-side-close" onClick={() => onOpenChange(false)} aria-label="Thu gọn">
          <X size={18} />
        </button>
      </header>
      <ol className="compare-side-list">
        {picked.map((id, index) => (
          <li key={id} className="compare-side-item">
            <span className="compare-side-index">{index + 1}</span>
            <Link to={`/nghe/${id}`} className="compare-side-name">{names[id] ?? '…'}</Link>
            <button type="button" className="compare-side-remove" onClick={() => onRemove(id)} aria-label={`Bỏ ${names[id] ?? 'nghề'}`}>
              <X size={16} />
            </button>
          </li>
        ))}
        {Array.from({ length: Math.max(0, SLOTS - picked.length) }, (_, i) => (
          <li key={`empty-${i}`} className="compare-side-item is-empty">
            <span className="compare-side-index"><Plus size={14} aria-hidden="true" /></span>
            <span>Chọn thêm nghề</span>
          </li>
        ))}
      </ol>
      <footer className="compare-side-foot">
        <Button variant="ghost" onClick={onClear}>Bỏ chọn</Button>
        <Link
          className="compare-side-go"
          to={ready ? `/nghe/so-sanh?ids=${key}` : '#'}
          aria-disabled={!ready}
          onClick={(event) => {
            if (!ready) event.preventDefault();
          }}
        >
          So sánh ngay
        </Link>
      </footer>
    </aside>
  );
};
