import { Router } from 'express';
import { z } from 'zod';
import { HttpError, unwrap, unwrapRows } from '../../lib/errors.js';
import { getAdminClient } from '../../lib/supabase.js';
import { getAuth } from '../../middleware/auth.js';

export const accountRouter = Router();

/** Các loại thông báo trong ứng dụng; hàm push_notification kiểm tra in_app_enabled theo từng loại */
const NOTIFICATION_TYPES = ['new_submission', 'result_changed', 'result_finalized', 'link_expiring', 'class_update'] as const;

const passwordSchema = z.object({ password: z.string().min(8).max(72) });
const notificationsEnabledSchema = z.object({ enabled: z.boolean() });
const markReadSchema = z.object({ ids: z.array(z.string().uuid()).max(200).optional() });
const listLimitSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });

accountRouter.put('/password', async (req, res) => {
  const { userId } = getAuth(req);
  const { password } = passwordSchema.parse(req.body);
  const { error } = await getAdminClient().auth.admin.updateUserById(userId, { password });
  if (error) throw new HttpError(400, 'password_rejected', error.message);
  res.status(204).end();
});

/** Thông báo được coi là bật khi không có loại nào bị tắt */
accountRouter.get('/notification_settings', async (req, res) => {
  const { db, userId } = getAuth(req);
  const rows = unwrapRows(await db.from('notification_settings').select('notification_type, in_app_enabled').eq('user_id', userId));
  res.json({ enabled: !rows.some((row) => row.in_app_enabled === false) });
});

accountRouter.put('/notification_settings', async (req, res) => {
  const { db, userId } = getAuth(req);
  const { enabled } = notificationsEnabledSchema.parse(req.body);
  unwrap(
    await db.from('notification_settings').upsert(
      NOTIFICATION_TYPES.map((type) => ({ user_id: userId, notification_type: type, in_app_enabled: enabled })),
      { onConflict: 'user_id,notification_type' },
    ),
  );
  res.status(204).end();
});

accountRouter.get('/notifications/unread_count', async (req, res) => {
  const { db, userId } = getAuth(req);
  const result = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null);
  unwrap(result);
  res.json({ count: result.count ?? 0 });
});

accountRouter.get('/notifications', async (req, res) => {
  const { db, userId } = getAuth(req);
  const { limit } = listLimitSchema.parse(req.query);
  const rows = unwrapRows(
    await db
      .from('notifications')
      .select('id, title, body, created_at, read_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
  );
  res.json(
    rows.map((row) => ({ id: row.id, title: row.title, body: row.body, createdAt: row.created_at, read: row.read_at !== null })),
  );
});

/** Đánh dấu đã đọc các thông báo trong `ids`; bỏ trống là đánh dấu tất cả thông báo chưa đọc */
accountRouter.post('/notifications/read', async (req, res) => {
  const { db, userId } = getAuth(req);
  const { ids } = markReadSchema.parse(req.body ?? {});
  let query = db.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
  if (ids) query = query.in('id', ids);
  unwrap(await query);
  res.status(204).end();
});
