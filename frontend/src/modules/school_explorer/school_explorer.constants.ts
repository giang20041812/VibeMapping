import type { SelectOption } from '../../components/common';
import type { InstitutionType, Ownership } from './school_explorer.types';

export const SCHOOL_PAGE_SIZE = 24;

export const OWNERSHIP_LABEL: Record<Ownership, string> = {
  public: 'Công lập',
  private: 'Tư thục',
};

export const INSTITUTION_TYPE_LABEL: Record<InstitutionType, string> = {
  university: 'Đại học',
  academy: 'Học viện',
  college: 'Cao đẳng',
};

export const OWNERSHIP_OPTIONS: SelectOption[] = (Object.keys(OWNERSHIP_LABEL) as Ownership[]).map((value) => ({
  value,
  label: OWNERSHIP_LABEL[value],
}));

export const INSTITUTION_TYPE_OPTIONS: SelectOption[] = (Object.keys(INSTITUTION_TYPE_LABEL) as InstitutionType[]).map(
  (value) => ({ value, label: INSTITUTION_TYPE_LABEL[value] }),
);
