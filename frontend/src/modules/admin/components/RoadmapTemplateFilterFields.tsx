import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '../../../components/common';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import type { FilterOption } from '../../../types/filter';
import { ACTIVE_STATE_OPTIONS } from '../admin.constants';
import type { RoadmapTemplateFilter } from '../roadmap_templates_admin.service';
import { BAND_STAGE, GROUP_OPTIONS } from '../../roadmap/roadmap.logic';

export const ROADMAP_CHECK_STATUS_OPTIONS: FilterOption[] = [
  { value: 'Nháp - cần check', label: 'Nháp - cần check' },
  { value: 'Cần sửa', label: 'Cần sửa' },
  { value: 'Đã check', label: 'Đã check' },
  { value: 'Đã duyệt', label: 'Đã duyệt' },
];

export const ROADMAP_STAGE_OPTIONS: FilterOption[] = Object.entries(BAND_STAGE).map(([value, label]) => ({ value, label }));

interface Props {
  draft: RoadmapTemplateFilter;
  onChange: (patch: Partial<RoadmapTemplateFilter>) => void;
  templates: FilterOption[];
}

export const RoadmapTemplateFilterFields: React.FC<Props> = ({ draft, onChange, templates }) => (
  <>
    <div className="filter-item-search">
      <Input
        label="Tìm kiếm"
        placeholder="Mã hoặc tên mục"
        leftIcon={<Search size={16} />}
        value={draft.keyword}
        onChange={(event) => onChange({ keyword: event.target.value })}
      />
    </div>
    <SearchableSelect label="Lộ trình" placeholder="Tất cả" options={templates} value={draft.templateCode} onChange={(value) => onChange({ templateCode: value })} />
    <SearchableSelect label="Nhóm tiêu chí" placeholder="Tất cả" options={GROUP_OPTIONS} value={draft.groupCode} onChange={(value) => onChange({ groupCode: value })} />
    <SearchableSelect label="Giai đoạn" placeholder="Tất cả" options={ROADMAP_STAGE_OPTIONS} value={draft.bandCode} onChange={(value) => onChange({ bandCode: value })} />
    <SearchableSelect label="Kiểm tra" placeholder="Tất cả" options={ROADMAP_CHECK_STATUS_OPTIONS} value={draft.checkStatus} onChange={(value) => onChange({ checkStatus: value })} />
    <SearchableSelect label="Trạng thái" placeholder="Tất cả" options={ACTIVE_STATE_OPTIONS} value={draft.activeState} onChange={(value) => onChange({ activeState: value })} />
  </>
);
