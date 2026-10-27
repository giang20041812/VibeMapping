import { supabase } from '../../lib/supabase';
import { ADMIN_PAGE_SIZE } from './admin.constants';
import { displayPersonName, endOfDayIso, sanitizeKeyword, startOfDayIso } from './admin.logic';
import type { AuditLogFilter, AuditLogRow, Paged } from './admin.types';

export const EMPTY_AUDIT_LOG_FILTER: AuditLogFilter = {
  keyword: '',
  targetType: '',
  person: '',
  dateFrom: '',
  dateTo: '',
};

const AUDIT_COLUMNS =
  'id, action, target_type, target_id, details, created_at, actor:user_profiles!audit_logs_actor_id_fkey(full_name, display_name), subject:user_profiles!audit_logs_subject_user_id_fkey(full_name, display_name)';

type PersonRef = { full_name: string | null; display_name: string | null } | null;

/** Tìm người theo tên (người thực hiện hoặc học sinh) để lọc nhật ký */
async function findPersonIds(name: string): Promise<string[]> {
  const keyword = sanitizeKeyword(name);
  if (!keyword) return [];
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id')
    .or(`full_name.ilike.%${keyword}%,display_name.ilike.%${keyword}%`)
    .limit(100);
  if (error) {
    console.error('Lỗi tìm người dùng:', error.message);
    throw error;
  }
  return (data ?? []).map((row) => row.id);
}

export async function listAuditLogs(filter: AuditLogFilter, page: number): Promise<Paged<AuditLogRow>> {
  let query = supabase.from('audit_logs').select(AUDIT_COLUMNS, { count: 'exact' });

  const keyword = sanitizeKeyword(filter.keyword);
  if (keyword) query = query.ilike('action', `%${keyword}%`);
  if (filter.targetType) query = query.eq('target_type', filter.targetType);
  if (filter.dateFrom) query = query.gte('created_at', startOfDayIso(filter.dateFrom));
  if (filter.dateTo) query = query.lte('created_at', endOfDayIso(filter.dateTo));

  if (filter.person.trim()) {
    const ids = await findPersonIds(filter.person);
    if (ids.length === 0) return { rows: [], total: 0 };
    const list = ids.join(',');
    query = query.or(`actor_id.in.(${list}),subject_user_id.in.(${list})`);
  }

  const from = (page - 1) * ADMIN_PAGE_SIZE;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error) {
    console.error('Lỗi đọc nhật ký:', error.message);
    throw error;
  }

  const rows: AuditLogRow[] = (data ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    target_type: row.target_type,
    target_id: row.target_id,
    details: row.details,
    created_at: row.created_at,
    actor_name: displayPersonName(row.actor as PersonRef),
    subject_name: displayPersonName(row.subject as PersonRef),
  }));
  return { rows, total: count ?? 0 };
}

/** Các loại đối tượng có trong nhật ký, để chọn trong bộ lọc */
export async function listAuditTargetTypes(): Promise<string[]> {
  const { data, error } = await supabase.from('audit_logs').select('target_type').not('target_type', 'is', null).limit(1000);
  if (error) {
    console.error('Lỗi đọc loại đối tượng nhật ký:', error.message);
    throw error;
  }
  return Array.from(new Set((data ?? []).map((row) => row.target_type as string))).sort();
}
