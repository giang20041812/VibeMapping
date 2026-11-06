import { callRpc, db } from '../../lib/rpc';
import type {
  AdminCareerFull,
  AdminCareerRow,
  CareerAdminDetail,
  CareerAuditEntry,
  CareerFieldOption,
  CareerInfoInput,
  HollandRow,
  RequirementCriterion,
  RequirementInput,
  RequirementRow,
  SourceJd,
} from './career_admin.types';

const LIST_COLUMNS = 'id, career_code, career_name, career_field_id, status, qualifying_jd_count, holland_top3, is_standard_complete, data_checked_at, data_checked_kind';
const FULL_COLUMNS = `${LIST_COLUMNS}, source_group_id, growth_level, career_description, key_skills, salary_range_text, career_path_text, data_source_note`;
const PAGE = 1000;

/** Toàn bộ nghề (khoảng hai nghìn dòng, vài cột) để lọc và phân trang ngay trên máy */
export async function listAdminCareers(): Promise<AdminCareerRow[]> {
  const rows: AdminCareerRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('careers').select(LIST_COLUMNS).order('career_code').range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as AdminCareerRow[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function listCareerFieldOptions(): Promise<CareerFieldOption[]> {
  const { data, error } = await db.from('career_fields').select('id, field_code, field_name, parent_field_id').eq('is_active', true).order('field_code');
  if (error) throw error;
  return (data ?? []) as CareerFieldOption[];
}

export async function listRequirementCriteria(): Promise<RequirementCriterion[]> {
  const { data, error } = await db
    .from('criteria')
    .select('id, dimension_code, name, sort_order, group:criteria_groups(group_code)')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{ id: string; dimension_code: string; name: string; group: { group_code: string } | { group_code: string }[] | null }>)
    .map((row) => ({
      id: row.id,
      dimension_code: row.dimension_code,
      name: row.name,
      group_code: (Array.isArray(row.group) ? row.group[0]?.group_code : row.group?.group_code) ?? '',
    }))
    .filter((row) => row.group_code !== 'G6' && row.group_code !== '')
    .sort((a, b) => a.dimension_code.localeCompare(b.dimension_code, 'en', { numeric: true }));
}

export async function loadCareerAdminDetail(careerId: string): Promise<CareerAdminDetail | null> {
  const { data: career, error } = await db.from('careers').select(FULL_COLUMNS).eq('id', careerId).maybeSingle();
  if (error) throw error;
  if (!career) return null;
  const { data: version } = await db.from('career_matrix_versions').select('id, version_code').eq('is_current', true).maybeSingle();
  const [requirements, holland, jds, history] = await Promise.all([
    version
      ? db.from('career_requirements').select('required_score, career_weight, jd_count, verification_level, criteria:criteria(dimension_code)')
        .eq('career_id', careerId).eq('matrix_version_id', version.id)
      : Promise.resolve({ data: [], error: null }),
    db.from('career_holland_profiles').select('holland_code, strength, jd_count, verification_level').eq('career_id', careerId),
    db.from('career_job_descriptions')
      .select('id, company_name, job_title, career_level_raw, required_level, data_checked_at, data_checked_kind, jd_url')
      .eq('career_id', careerId).order('source_id').limit(200),
    db.from('audit_logs').select('id, action, created_at, details').eq('target_id', careerId).order('created_at', { ascending: false }).limit(50),
  ]);
  for (const result of [requirements, holland, jds]) if (result.error) throw result.error;
  const requirementRows = ((requirements.data ?? []) as unknown as Array<{
    required_score: number | string; career_weight: number | string; jd_count: number; verification_level: string;
    criteria: { dimension_code: string } | { dimension_code: string }[] | null;
  }>).map((row) => ({
    dimension_code: (Array.isArray(row.criteria) ? row.criteria[0]?.dimension_code : row.criteria?.dimension_code) ?? '',
    required_score: Number(row.required_score),
    career_weight: Number(row.career_weight),
    jd_count: row.jd_count,
    verification_level: row.verification_level,
  })) as RequirementRow[];
  return {
    career: career as AdminCareerFull,
    requirements: requirementRows,
    holland: ((holland.data ?? []) as Array<HollandRow & { strength: number | string }>).map((row) => ({ ...row, strength: Number(row.strength) })),
    jds: (jds.data ?? []) as SourceJd[],
    history: (history.data ?? []) as CareerAuditEntry[],
    matrixVersion: version?.version_code ?? null,
  };
}

const nullable = (text: string) => (text.trim() === '' ? null : text.trim());

export function saveCareerInfo(careerId: string | null, input: CareerInfoInput): Promise<string> {
  return callRpc<string>('admin_save_career', {
    p_career_id: careerId,
    p_payload: {
      career_name: input.career_name.trim(),
      career_field_id: input.career_field_id,
      career_description: nullable(input.career_description),
      key_skills: nullable(input.key_skills),
      salary_range_text: nullable(input.salary_range_text),
      career_path_text: nullable(input.career_path_text),
      growth_level: nullable(input.growth_level),
      data_source_note: nullable(input.data_source_note),
      data_checked_at: nullable(input.data_checked_at),
      data_checked_kind: input.data_checked_kind,
    },
  });
}

export function saveCareerRequirements(careerId: string, rows: RequirementInput[]): Promise<string> {
  return callRpc<string>('admin_save_career_requirements', { p_career_id: careerId, p_rows: rows });
}

export function saveCareerHolland(careerId: string, profile: Record<string, number>): Promise<void> {
  return callRpc<void>('admin_save_career_holland', { p_career_id: careerId, p_profile: profile });
}

const ERROR_TEXT: Record<string, string> = {
  forbidden: 'Bạn không có quyền thực hiện thao tác này.',
  invalid_career: 'Cần tên nghề từ 3 ký tự và chọn lĩnh vực.',
  invalid_checked_date: 'Ngày kiểm tra không được sau hôm nay.',
  dimension_not_allowed: 'Chỉ nhập mức yêu cầu cho tiêu chí G1–G5 và G7.',
  invalid_required_score: 'Mức yêu cầu phải nằm trong khoảng 1–5.',
  invalid_career_weight: 'Trọng số phải lớn hơn 0.',
  duplicate_dimension: 'Một tiêu chí chỉ được nhập một lần.',
  unknown_dimension: 'Có tiêu chí không tồn tại.',
  invalid_holland_strength: 'Cường độ Holland phải nằm trong khoảng 0–1.',
  career_standard_incomplete: 'Nghề chưa đủ chuẩn: cần mức yêu cầu G1–G5, G7 và hồ sơ Holland.',
  career_jd_below_minimum: 'Nghề chưa đủ số JD tối thiểu.',
};

export function careerAdminErrorText(caught: unknown): string {
  const message = String((caught as { message?: string })?.message ?? '');
  const key = Object.keys(ERROR_TEXT).find((code) => message.includes(code));
  return key ? ERROR_TEXT[key] : 'Thao tác không thành công.';
}
