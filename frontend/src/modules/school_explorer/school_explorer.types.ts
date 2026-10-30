export type InstitutionType = 'university' | 'academy' | 'college';
export type Ownership = 'public' | 'private';

export interface InstitutionFilter {
  keyword: string;
  city: string;
  ownership: '' | Ownership;
  institutionType: '' | InstitutionType;
  fieldId: string;
  majorId: string;
}

export interface InstitutionRow {
  id: string;
  institution_name: string;
  institution_type: InstitutionType;
  ownership: Ownership | null;
  city: string | null;
  website_url: string | null;
  field_name: string | null;
  program_count: number;
}

export interface Paged<T> {
  rows: T[];
  total: number;
}
