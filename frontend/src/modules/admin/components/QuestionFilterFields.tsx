import React, { useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../../../components/common';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import type { FilterOption } from '../../../types/filter';
import {
  ACTIVE_STATE_OPTIONS,
  ASSESSMENT_PART_OPTIONS,
  DETAIL_LEVEL_OPTIONS,
  RATER_GROUPS,
} from '../admin.constants';
import type { Criteria, CriteriaGroup, QuestionFilter } from '../admin.types';

export interface QuestionFilterFieldsProps {
  draft: QuestionFilter;
  onChange: (patch: Partial<QuestionFilter>) => void;
  groups: CriteriaGroup[];
  criteria: Criteria[];
  /** Ẩn ô góc nhìn khi danh sách đã cố định theo góc nhìn bản thân */
  showRaterGroup?: boolean;
}

export const QuestionFilterFields: React.FC<QuestionFilterFieldsProps> = ({
  draft,
  onChange,
  groups,
  criteria,
  showRaterGroup = true,
}) => {
  const groupOptions = useMemo<FilterOption[]>(
    () => groups.map((group) => ({ value: group.id, label: `${group.group_code} · ${group.name}` })),
    [groups],
  );
  const criteriaOptions = useMemo<FilterOption[]>(
    () =>
      criteria
        .filter((item) => !draft.groupId || item.group_id === draft.groupId)
        .map((item) => ({ value: item.id, label: `${item.dimension_code} · ${item.name}` })),
    [criteria, draft.groupId],
  );
  const raterOptions = useMemo<FilterOption[]>(() => RATER_GROUPS.map((group) => ({ ...group })), []);

  return (
    <>
      <div className="filter-item-search">
        <Input
          label="Tìm kiếm"
          placeholder="Mã hoặc nội dung câu hỏi"
          leftIcon={<Search size={16} />}
          value={draft.keyword}
          onChange={(event) => onChange({ keyword: event.target.value })}
        />
      </div>
      <SearchableSelect
        label="Nhóm tiêu chí"
        placeholder="Tất cả"
        options={groupOptions}
        value={draft.groupId}
        onChange={(value) => onChange({ groupId: value, criteriaId: '' })}
      />
      <SearchableSelect
        label="Tiêu chí"
        placeholder="Tất cả"
        options={criteriaOptions}
        value={draft.criteriaId}
        onChange={(value) => onChange({ criteriaId: value })}
      />
      {showRaterGroup && (
        <SearchableSelect
          label="Góc nhìn"
          placeholder="Tất cả"
          options={raterOptions}
          value={draft.raterGroup}
          onChange={(value) => onChange({ raterGroup: value })}
        />
      )}
      <SearchableSelect
        label="Phần"
        placeholder="Tất cả"
        options={ASSESSMENT_PART_OPTIONS}
        value={draft.assessmentPart}
        onChange={(value) => onChange({ assessmentPart: value })}
      />
      <SearchableSelect
        label="Mức chi tiết"
        placeholder="Tất cả"
        options={DETAIL_LEVEL_OPTIONS}
        value={draft.detailLevel}
        onChange={(value) => onChange({ detailLevel: value })}
      />
      <SearchableSelect
        label="Trạng thái"
        placeholder="Tất cả"
        options={ACTIVE_STATE_OPTIONS}
        value={draft.activeState}
        onChange={(value) => onChange({ activeState: value })}
      />
    </>
  );
};
