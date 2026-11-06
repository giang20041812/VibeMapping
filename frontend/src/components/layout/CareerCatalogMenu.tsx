import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Search } from 'lucide-react';
import { db } from '../../lib/rpc';
import { toSearchKey } from '../../lib/vnSearch';
import { listPublishedCareers, type CareerListItem } from '../../modules/career_explorer/career.service';
import './CareerCatalogMenu.css';

interface FieldRow { id: string; field_name: string; parent_field_id: string | null }

interface CareerCatalogMenuProps {
  label: string;
  onNavigate: () => void;
}

/** Danh mục thả xuống liệt kê nghề đã công bố theo lĩnh vực; dùng được khi chưa đăng nhập */
export const CareerCatalogMenu: React.FC<CareerCatalogMenuProps> = ({ label, onNavigate }) => {
  const [open, setOpen] = useState(false);
  const [careers, setCareers] = useState<CareerListItem[] | null>(null);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || careers) return;
    let active = true;
    Promise.all([listPublishedCareers(), db.from('career_fields').select('id, field_name, parent_field_id').eq('is_active', true).order('field_code')])
      .then(([careerRows, fieldResult]) => {
        if (!active) return;
        setCareers(careerRows);
        setFields((fieldResult.data ?? []) as FieldRow[]);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [open, careers]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(640, window.innerWidth - 16);
      setPosition({ top: rect.bottom, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) });
    };
    place();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('resize', place);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    setTimeout(() => searchRef.current?.focus(), 30);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  const groups = useMemo(() => fields.filter((f) => f.parent_field_id === null), [fields]);
  const parentOf = useMemo(() => new Map(fields.map((f) => [f.id, f.parent_field_id ?? f.id])), [fields]);
  const visible = useMemo(() => {
    const key = toSearchKey(query);
    return (careers ?? []).filter((c) => {
      if (key) return toSearchKey(c.career_name).includes(key);
      return !fieldId || parentOf.get(c.career_field_id) === fieldId;
    });
  }, [careers, query, fieldId, parentOf]);

  return (
    <div className="career-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`topbar-link career-menu-trigger${open ? ' is-open' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && position && (
        <div className="career-menu-panel" style={{ top: position.top, left: position.left }} role="dialog" aria-label="Danh mục nghề">
          <div className="career-menu-search">
            <Search size={16} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder="Tìm nghề"
              aria-label="Tìm nghề"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {failed ? (
            <p className="career-menu-empty">Không tải được danh mục nghề</p>
          ) : !careers ? (
            <p className="career-menu-empty">Đang tải</p>
          ) : (
            <div className="career-menu-body">
              <ul className="career-menu-fields" aria-label="Lĩnh vực">
                <li>
                  <button type="button" className={!fieldId ? 'is-active' : ''} onClick={() => { setFieldId(''); setQuery(''); }}>Tất cả</button>
                </li>
                {groups.map((group) => (
                  <li key={group.id}>
                    <button type="button" className={fieldId === group.id ? 'is-active' : ''} onClick={() => { setFieldId(group.id); setQuery(''); }}>
                      {group.field_name}
                    </button>
                  </li>
                ))}
              </ul>
              <ul className="career-menu-list">
                {visible.length === 0 && <li className="career-menu-empty">Không có nghề phù hợp</li>}
                {visible.map((career) => (
                  <li key={career.id}>
                    <Link to={`/danh-muc-nghe/${career.id}`} onClick={() => { setOpen(false); onNavigate(); }}>{career.career_name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link className="career-menu-all" to="/danh-muc-nghe" onClick={() => { setOpen(false); onNavigate(); }}>Xem tất cả nghề</Link>
        </div>
      )}
    </div>
  );
};
