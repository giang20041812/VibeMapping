import { db } from '../../lib/rpc';

export interface ProgramSummary {
  id: string;
  institutionId: string;
  institutionName: string;
  city: string | null;
  majorId: string;
  majorName: string;
  programType: string | null;
  specialization: string | null;
  faculty: string | null;
  /** Phần trong ngoặc của tên ngành mô tả chương trình */
  qualifier: string | null;
  studyYears: number | null;
  tuitionText: string | null;
  tuitionMin: number | null;
  tuitionMax: number | null;
  tuitionYearMin: number | null;
  tuitionYearMax: number | null;
  tuitionTotalMin: number | null;
  tuitionTotalMax: number | null;
  tuitionPerCredit: number | null;
  programCredits: number | null;
  tuitionPerMonth: number | null;
  /** semester = ghi rõ mỗi kỳ; year, total, credit = quy đổi từ năm, tổng khóa hoặc tín chỉ */
  tuitionBasis?: string | null;
  /** amount | free | credit_only | unpublished | unclear */
  tuitionStatus?: string | null;
  tuitionIsEstimate?: boolean;
  researchStatus: string;
}

export interface AdmissionRow {
  year: number;
  method: string;
  subjectCombination: string | null;
  quota: number | null;
  cutoffScore: number | null;
  minimumScore: number | null;
  sourceUrl: string | null;
}

const PROGRAM_SELECT =
  'id, institution_id, major_id, program_type, specialization_name, faculty_name, program_qualifier, study_years, tuition_text, tuition_per_semester_min, tuition_per_semester_max, tuition_per_year_min, tuition_per_year_max, tuition_total_min, tuition_total_max, tuition_per_credit, program_credits, tuition_per_month, tuition_basis, tuition_status, tuition_is_estimate, research_status, institution:institutions(institution_name, city), major:majors(major_name)';

type RawProgram = {
  id: string;
  institution_id: string;
  major_id: string;
  program_type: string | null;
  specialization_name: string | null;
  faculty_name: string | null;
  program_qualifier: string | null;
  study_years: number | null;
  tuition_text: string | null;
  tuition_per_semester_min: number | null;
  tuition_per_semester_max: number | null;
  tuition_per_year_min: number | null;
  tuition_per_year_max: number | null;
  tuition_total_min: number | null;
  tuition_total_max: number | null;
  tuition_per_credit: number | null;
  program_credits: number | null;
  tuition_per_month: number | null;
  tuition_basis: string | null;
  tuition_status: string | null;
  tuition_is_estimate: boolean | null;
  research_status: string;
  institution: { institution_name: string; city: string | null } | null;
  major: { major_name: string } | null;
};

function toProgram(row: RawProgram): ProgramSummary {
  return {
    id: row.id,
    institutionId: row.institution_id,
    institutionName: row.institution?.institution_name ?? '',
    city: row.institution?.city ?? null,
    majorId: row.major_id,
    majorName: row.major?.major_name ?? '',
    programType: row.program_type,
    specialization: row.specialization_name,
    faculty: row.faculty_name,
    qualifier: row.program_qualifier,
    studyYears: row.study_years !== null ? Number(row.study_years) : null,
    tuitionText: row.tuition_text,
    tuitionMin: row.tuition_per_semester_min,
    tuitionMax: row.tuition_per_semester_max,
    tuitionYearMin: row.tuition_per_year_min,
    tuitionYearMax: row.tuition_per_year_max,
    tuitionTotalMin: row.tuition_total_min,
    tuitionTotalMax: row.tuition_total_max,
    tuitionPerCredit: row.tuition_per_credit,
    programCredits: row.program_credits,
    tuitionPerMonth: row.tuition_per_month,
    tuitionBasis: row.tuition_basis,
    tuitionStatus: row.tuition_status,
    tuitionIsEstimate: Boolean(row.tuition_is_estimate),
    researchStatus: row.research_status,
  };
}

export async function listInstitutionOptions(): Promise<{ value: string; label: string; city: string | null }[]> {
  const { data, error } = await db
    .from('institutions')
    .select('id, institution_name, city')
    .neq('institution_type', 'parent_university')
    .order('institution_name', { ascending: true })
    .limit(1000);
  if (error) throw error;
  return ((data ?? []) as { id: string; institution_name: string; city: string | null }[]).map((row) => ({
    value: row.id,
    label: row.institution_name,
    city: row.city,
  }));
}

export async function loadProgramsByInstitution(institutionId: string): Promise<ProgramSummary[]> {
  const { data, error } = await db
    .from('training_programs')
    .select(PROGRAM_SELECT)
    .eq('institution_id', institutionId)
    .eq('is_active', true)
    .limit(500);
  if (error) throw error;
  return ((data ?? []) as unknown as RawProgram[])
    .map(toProgram)
    .sort((a, b) => formatProgramOptionLabel(a).localeCompare(formatProgramOptionLabel(b), 'vi'));
}

export async function loadProgramsByIds(ids: string[]): Promise<ProgramSummary[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db.from('training_programs').select(PROGRAM_SELECT).in('id', ids);
  if (error) throw error;
  return ((data ?? []) as unknown as RawProgram[]).map(toProgram);
}

export function formatProgramOptionLabel(p: Pick<ProgramSummary, 'majorName' | 'specialization' | 'qualifier' | 'programType'>): string {
  const detail = [p.specialization, p.qualifier, p.programType].filter(Boolean).join(' · ');
  return detail ? `${p.majorName} (${detail})` : p.majorName;
}

export async function loadInstitution(id: string) {
  const [{ data: institution, error }, { data: programs, error: programError }] = await Promise.all([
    db
      .from('institutions')
      .select('id, institution_name, institution_type, ownership, city, address, website_url, segment')
      .eq('id', id)
      .maybeSingle(),
    db.from('training_programs').select(PROGRAM_SELECT).eq('institution_id', id).eq('is_active', true).limit(500),
  ]);
  if (error) throw error;
  if (programError) throw programError;
  return {
    institution,
    programs: ((programs ?? []) as unknown as RawProgram[]).map(toProgram).sort((a, b) => a.majorName.localeCompare(b.majorName, 'vi')),
  };
}

export async function loadMajor(id: string) {
  const [{ data: major, error }, { data: programs, error: programError }, { data: links, error: linkError }] = await Promise.all([
    db.from('majors').select('id, major_name').eq('id', id).maybeSingle(),
    db.from('training_programs').select(PROGRAM_SELECT).eq('major_id', id).eq('is_active', true).limit(500),
    db.from('career_major_links').select('career_id, link_level, career:careers(career_name)').eq('major_id', id),
  ]);
  if (error) throw error;
  if (programError) throw programError;
  // Khách chưa đăng nhập không đọc được liên kết nghề (chỉ nghề đã công bố, cần đăng nhập)
  if (linkError) console.warn('Không đọc được nghề liên quan:', linkError.message);
  type RawLink = { career_id: string; link_level: string; career: { career_name: string } | null };
  return {
    major,
    programs: ((programs ?? []) as unknown as RawProgram[]).map(toProgram).sort((a, b) => a.institutionName.localeCompare(b.institutionName, 'vi')),
    careers: ((links ?? []) as unknown as RawLink[])
      .filter((l) => l.career)
      .map((l) => ({ id: l.career_id, name: l.career!.career_name, level: l.link_level })),
  };
}

export async function loadProgram(id: string) {
  const [{ data: program, error }, { data: admissions, error: admissionError }] = await Promise.all([
    db
      .from('training_programs')
      .select(`${PROGRAM_SELECT}, program_summary, study_years, degree_levels, program_url, source_reference, research_note`)
      .eq('id', id)
      .maybeSingle(),
    db
      .from('admission_data')
      .select('admission_year, admission_method, subject_combination, quota, cutoff_score, minimum_score, source_url')
      .eq('training_program_id', id)
      .order('admission_year', { ascending: false }),
  ]);
  if (error) throw error;
  if (admissionError) throw admissionError;
  if (!program) return null;
  const raw = program as unknown as RawProgram & {
    program_summary: string | null;
    study_years: number | null;
    degree_levels: string[] | null;
    program_url: string | null;
    source_reference: string | null;
    research_note: string | null;
  };
  return {
    program: toProgram(raw),
    faculty: raw.faculty_name,
    summary: raw.program_summary,
    studyYears: raw.study_years,
    degreeLevels: raw.degree_levels ?? [],
    url: raw.program_url,
    source: raw.source_reference,
    note: raw.research_note,
    admissions: (admissions ?? []).map((row) => ({
      year: row.admission_year,
      method: row.admission_method,
      subjectCombination: row.subject_combination,
      quota: row.quota,
      cutoffScore: row.cutoff_score === null ? null : Number(row.cutoff_score),
      minimumScore: row.minimum_score === null ? null : Number(row.minimum_score),
      sourceUrl: row.source_url,
    })) as AdmissionRow[],
  };
}

/** F05.02: Nghề → Ngành → Trường (chương trình đào tạo) */
export async function loadCareerMap(careerId: string) {
  const [{ data: career, error }, { data: links, error: linkError }] = await Promise.all([
    db.from('careers').select('id, career_name').eq('id', careerId).maybeSingle(),
    db.from('career_major_links').select('major_id, link_level, is_verified, major:majors(major_name)').eq('career_id', careerId),
  ]);
  if (error) throw error;
  if (linkError) throw linkError;
  type RawLink = { major_id: string; link_level: string; is_verified: boolean; major: { major_name: string } | null };
  const majors = ((links ?? []) as unknown as RawLink[]).map((l) => ({
    id: l.major_id,
    name: l.major?.major_name ?? '',
    level: l.link_level,
    verified: l.is_verified,
  }));
  const majorIds = majors.map((m) => m.id);
  const { data: programs, error: programError } = majorIds.length
    ? await db.from('training_programs').select(PROGRAM_SELECT).in('major_id', majorIds).eq('is_active', true).limit(1000)
    : { data: [], error: null };
  if (programError) throw programError;
  const byMajor = new Map<string, ProgramSummary[]>();
  for (const p of ((programs ?? []) as unknown as RawProgram[]).map(toProgram)) {
    const list = byMajor.get(p.majorId) ?? [];
    list.push(p);
    byMajor.set(p.majorId, list);
  }
  return { career, majors: majors.map((m) => ({ ...m, programs: byMajor.get(m.id) ?? [] })) };
}

export function formatTuition(
  p: Pick<ProgramSummary, 'tuitionMin' | 'tuitionMax' | 'tuitionText' | 'tuitionBasis' | 'tuitionStatus' | 'tuitionPerCredit'>,
): string {
  if (p.tuitionStatus === 'free' || (p.tuitionMin === 0 && (p.tuitionMax === 0 || p.tuitionMax === null))) {
    return 'Miễn học phí';
  }
  const fmt = (v: number) => `${(v / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`;
  const estimate = p.tuitionBasis === 'year' || p.tuitionBasis === 'total' || p.tuitionBasis === 'credit' ? ' (ước tính)' : '';
  if (p.tuitionMin !== null && p.tuitionMax !== null && p.tuitionMin !== p.tuitionMax) return `${fmt(p.tuitionMin)}–${fmt(p.tuitionMax)}/học kỳ${estimate}`;
  if (p.tuitionMin !== null) return `${fmt(p.tuitionMin)}/học kỳ${estimate}`;
  if (p.tuitionStatus === 'credit_only' && p.tuitionPerCredit) {
    return `${(p.tuitionPerCredit / 1_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} nghìn/tín chỉ`;
  }
  if (p.tuitionStatus === 'unpublished') return 'Chưa công bố';
  return p.tuitionText ?? 'Đang cập nhật';
}

export function formatYearlyTuition(
  p: Pick<ProgramSummary, 'tuitionYearMin' | 'tuitionYearMax' | 'tuitionStatus' | 'tuitionBasis' | 'tuitionIsEstimate' | 'tuitionPerCredit'>,
): { label: string; isEstimate: boolean } {
  if (p.tuitionStatus === 'free' || (p.tuitionYearMin === 0 && (p.tuitionYearMax === 0 || p.tuitionYearMax === null))) {
    return { label: 'Miễn học phí', isEstimate: false };
  }
  const fmt = (v: number) => `${(v / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`;
  const isEst = Boolean(p.tuitionIsEstimate || (p.tuitionBasis && p.tuitionBasis !== 'year'));
  if (p.tuitionYearMin !== null && p.tuitionYearMax !== null && p.tuitionYearMin !== p.tuitionYearMax) {
    return { label: `${fmt(p.tuitionYearMin)}–${fmt(p.tuitionYearMax)}/năm`, isEstimate: isEst };
  }
  if (p.tuitionYearMin !== null) {
    return { label: `${fmt(p.tuitionYearMin)}/năm`, isEstimate: isEst };
  }
  if (p.tuitionStatus === 'credit_only' && p.tuitionPerCredit) {
    return { label: `${(p.tuitionPerCredit / 1_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} nghìn/tín chỉ`, isEstimate: false };
  }
  return { label: 'Chưa công bố', isEstimate: false };
}

export function formatTotalTuition(
  p: Pick<ProgramSummary, 'tuitionTotalMin' | 'tuitionTotalMax' | 'tuitionYearMin' | 'tuitionYearMax' | 'studyYears' | 'tuitionStatus'>,
): { label: string; isEstimate: boolean } {
  if (p.tuitionStatus === 'free' || (p.tuitionYearMin === 0 && (p.tuitionYearMax === 0 || p.tuitionYearMax === null))) {
    return { label: 'Miễn học phí', isEstimate: false };
  }
  const fmt = (v: number) => `${(v / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`;
  if (p.tuitionTotalMin !== null) {
    const high = p.tuitionTotalMax ?? p.tuitionTotalMin;
    return {
      label: p.tuitionTotalMin === high ? fmt(p.tuitionTotalMin) : `${fmt(p.tuitionTotalMin)}–${fmt(high)}`,
      isEstimate: false,
    };
  }
  if (p.tuitionYearMin !== null && p.studyYears && p.studyYears > 0) {
    const low = p.tuitionYearMin * p.studyYears;
    const high = (p.tuitionYearMax ?? p.tuitionYearMin) * p.studyYears;
    return {
      label: low === high ? fmt(low) : `${fmt(low)}–${fmt(high)}`,
      isEstimate: true,
    };
  }
  return { label: 'Chưa công bố', isEstimate: false };
}

/** Phần phân biệt các chương trình cùng trường, cùng ngành: chuyên ngành, phần trong ngoặc, khoa */
export function programVariant(p: Pick<ProgramSummary, 'specialization' | 'qualifier' | 'faculty'>): string {
  return [p.specialization, p.qualifier, p.faculty].filter(Boolean).join(' · ');
}
