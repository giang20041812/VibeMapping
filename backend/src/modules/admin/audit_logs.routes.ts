import { Router } from 'express';
import { z } from 'zod';
import { unwrapRows } from '../../lib/errors.js';
import type { Db } from '../../lib/supabase.js';
import { getAuth } from '../../middleware/auth.js';
import { displayPersonName, endOfDayIso, pageRange, sanitizeKeyword, startOfDayIso } from './admin.logic.js';

export const auditLogsRouter = Router();

const AUDIT_COLUMNS =
  'id, action, target_type, target_id, details, created_at, actor:user_profiles!audit_logs_actor_id_fkey(full_name, display_name), subject:user_profiles!audit_logs_subject_user_id_fkey(full_name, display_name)';

type PersonRef = { full_name: string | null; display_name: string | null } | null;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  keyword: z.string().max(200).optional(),
  targetType: z.string().max(100).optional(),
  person: z.string().max(200).optional(),
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
});

/** Tìm người theo tên (người thực hiện hoặc học sinh) để lọc nhật ký */
async function findPersonIds(db: Db, name: string): Promise<string[]> {
  const keyword = sanitizeKeyword(name);
  if (!keyword) return [];
  const rows = unwrapRows(
    await db.from('user_profiles').select('id').or(`full_name.ilike.%${keyword}%,display_name.ilike.%${keyword}%`).limit(100),
  );
  return rows.map((row) => row.id);
}

auditLogsRouter.get('/', async (req, res) => {
  const { db } = getAuth(req);
  const filter = querySchema.parse(req.query);

  let query = db.from('audit_logs').select(AUDIT_COLUMNS, { count: 'exact' });
  const keyword = sanitizeKeyword(filter.keyword ?? '');
  if (keyword) query = query.ilike('action', `%${keyword}%`);
  if (filter.targetType) query = query.eq('target_type', filter.targetType);
  if (filter.dateFrom) query = query.gte('created_at', startOfDayIso(filter.dateFrom));
  if (filter.dateTo) query = query.lte('created_at', endOfDayIso(filter.dateTo));

  if (filter.person?.trim()) {
    const ids = await findPersonIds(db, filter.person);
    if (ids.length === 0) {
      res.json({ rows: [], total: 0 });
      return;
    }
    const list = ids.join(',');
    query = query.or(`actor_id.in.(${list}),subject_user_id.in.(${list})`);
  }

  const [from, to] = pageRange(filter.page);
  const result = await query.order('created_at', { ascending: false }).range(from, to);
  const data = unwrapRows(result);

  const rows = data.map((row) => ({
    id: row.id,
    action: row.action,
    target_type: row.target_type,
    target_id: row.target_id,
    details: row.details,
    created_at: row.created_at,
    actor_name: displayPersonName(row.actor as PersonRef),
    subject_name: displayPersonName(row.subject as PersonRef),
  }));
  res.json({ rows, total: result.count ?? 0 });
});

/** Các loại đối tượng có trong nhật ký, để chọn trong bộ lọc */
auditLogsRouter.get('/target_types', async (req, res) => {
  const { db } = getAuth(req);
  const rows = unwrapRows(await db.from('audit_logs').select('target_type').not('target_type', 'is', null).limit(1000));
  res.json(Array.from(new Set(rows.map((row) => row.target_type as string))).sort());
});
