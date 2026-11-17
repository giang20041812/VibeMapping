import React, { useMemo, useState } from 'react';
import { BadgeCheck, CalendarClock, ClipboardList, Layers, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Input, Select, StatTile } from '../../../components/common';
import { normalizeSearchText } from '../../../lib/searchText';
import { MANUAL_SKILL_KINDS, SKILL_KIND_LABEL, SKILL_KIND_ORDER } from '../portfolio.constants';
import type { SkillKind, SkillProfileInput, SkillProfileItem } from '../portfolio.types';
import { LevelPicker } from './LevelPicker';

interface Props {
  items: SkillProfileItem[];
  busy: boolean;
  onAdd: (input: SkillProfileInput) => Promise<boolean>;
  onLevel: (item: SkillProfileItem, level: number) => void;
  onDelete: (item: SkillProfileItem) => void;
  onImport: () => void;
}

const KIND_OPTIONS = MANUAL_SKILL_KINDS.map((value) => ({ value, label: SKILL_KIND_LABEL[value] }));
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN');

/** Hồ sơ năng lực: số liệu tóm tắt, thêm kỹ năng, danh sách theo nhóm có tự chấm 1–5 */
export const SkillProfilePanel: React.FC<Props> = ({ items, busy, onAdd, onLevel, onDelete, onImport }) => {
  const [kind, setKind] = useState<SkillKind>('hard_skill');
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<number | null>(3);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(
    () => SKILL_KIND_ORDER.map((k) => ({ kind: k, rows: items.filter((item) => item.kind === k) })).filter((g) => g.rows.length > 0),
    [items],
  );
  const verified = items.filter((item) => item.verified_360).length;
  const rated = items.filter((item) => item.self_level !== null).length;
  const lastUpdate = items.reduce<string | null>((latest, item) => (!latest || item.updated_at > latest ? item.updated_at : latest), null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = title.trim();
    if (!name) {
      setError('Nhập tên kỹ năng.');
      return;
    }
    if (level === null) {
      setError('Chọn mức tự chấm.');
      return;
    }
    if (items.some((item) => item.kind === kind && normalizeSearchText(item.title) === normalizeSearchText(name))) {
      setError('Kỹ năng này đã có trong hồ sơ.');
      return;
    }
    setError(null);
    if (await onAdd({ kind, title: name, self_level: level })) setTitle('');
  };

  return (
    <div className="pf-profile">
      <div className="pf-stats">
        <StatTile label="Kỹ năng" tone="blue" icon={<Layers />} value={items.length} />
        <StatTile label="Đã xác thực 360°" tone="teal" icon={<BadgeCheck />} value={verified} />
        <StatTile label="Đã tự chấm" tone="violet" icon={<ClipboardList />} value={`${rated}/${items.length}`} />
        <StatTile label="Cập nhật" tone="gold" icon={<CalendarClock />} value={lastUpdate ? formatDate(lastUpdate) : '–'} />
      </div>

      <Card title="Thêm kỹ năng">
        <form className="module-form pf-add-form" onSubmit={(event) => void submit(event)} noValidate>
          <Select label="Loại" value={kind} options={KIND_OPTIONS} onChange={(value) => setKind(value as SkillKind)} />
          <Input
            label="Tên kỹ năng"
            value={title}
            maxLength={120}
            error={error ?? undefined}
            onChange={(event) => {
              setTitle(event.target.value);
              if (error) setError(null);
            }}
          />
          <LevelPicker heading="Tự chấm" value={level} onChange={setLevel} label="Mức tự chấm" />
          <div className="module-actions">
            <Button type="submit" leftIcon={<Plus size={16} />} isLoading={busy}>Thêm</Button>
          </div>
        </form>
      </Card>

      <Card
        title="Kỹ năng và minh chứng"
        action={<Button type="button" size="sm" variant="outline" leftIcon={<Sparkles size={14} />} onClick={onImport} disabled={busy}>Lấy kỹ năng từ kết quả 360°</Button>}
      >
        {groups.length === 0 ? (
          <div className="pf-empty">
            <Layers aria-hidden="true" />
            <p>Chưa có kỹ năng nào trong hồ sơ.</p>
          </div>
        ) : (
          <div className="pf-groups">
            {groups.map((group) => (
              <section key={group.kind} className="pf-group" aria-label={SKILL_KIND_LABEL[group.kind]}>
                <h3 className="pf-group-title">
                  {SKILL_KIND_LABEL[group.kind]}
                  <span className="pf-count">{group.rows.length}</span>
                </h3>
                <ul className="pf-skill-list">
                  {group.rows.map((item) => (
                    <li key={item.id} className="pf-skill-row">
                      <div className="pf-skill-name">
                        <span>{item.title}</span>
                        {item.verified_360 && (
                          <span className="pf-verified" title={`Đã xác thực 360°${item.verified_until ? ` đến ${formatDate(item.verified_until)}` : ''}`}>
                            <Badge size="sm" variant="success">
                              <BadgeCheck size={12} aria-hidden="true" />
                              <span className="sr-only">Đã xác thực</span> 360°
                              {item.verified_until ? ` · đến ${formatDate(item.verified_until)}` : ''}
                            </Badge>
                          </span>
                        )}
                      </div>
                      <LevelPicker value={item.self_level} onChange={(next) => onLevel(item, next)} label={`Mức của ${item.title}`} disabled={busy} />
                      <button type="button" className="pf-icon-btn" aria-label={`Xóa ${item.title}`} title="Xóa" disabled={busy} onClick={() => onDelete(item)}>
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
