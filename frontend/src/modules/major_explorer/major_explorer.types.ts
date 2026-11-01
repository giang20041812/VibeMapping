export interface MajorFilter {
  keyword: string;
  /** Lĩnh vực thế mạnh của trường đào tạo ngành */
  fieldId: string;
  /** Tỉnh/thành của trường đào tạo ngành */
  city: string;
}

export interface MajorRow {
  id: string;
  major_name: string;
  program_count: number;
}
