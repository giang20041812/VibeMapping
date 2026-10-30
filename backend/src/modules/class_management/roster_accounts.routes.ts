// Tạo tài khoản đăng nhập cho học sinh nhập từ danh sách Excel nhưng chưa có tài khoản.
//
// Gọi bởi giáo viên của lớp hoặc nhân sự trường (quyền kiểm bằng hàm list_roster_pending, chạy với JWT của người gọi).
// Mẫu Excel không có email nên mỗi học sinh nhận email nội bộ <mã học sinh>@<mã trường>.vibemapping.local
// và một mật khẩu tạm ngẫu nhiên. Mật khẩu chỉ trả về một lần trong kết quả; không lưu ở đâu khác.
// Học sinh đã có tài khoản (cùng email nội bộ, ví dụ học ở nhiều lớp của một trường) thì được gắn vào lớp, không đổi mật khẩu.
import { randomInt } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { HttpError, fromDbError } from '../../lib/errors.js';
import { getAdminClient, type Db } from '../../lib/supabase.js';
import { getAuth } from '../../middleware/auth.js';

export const rosterAccountsRouter = Router();

const EMAIL_DOMAIN = 'vibemapping.local';
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const PASSWORD_LENGTH = 10;
/** Số tài khoản tạo song song; vừa đủ nhanh mà không dồn tải lên dịch vụ đăng nhập */
const BATCH_SIZE = 10;

const paramsSchema = z.object({ classId: z.string().uuid() });

interface PendingRow {
  member_id: string;
  student_code: string;
  full_name: string;
  date_of_birth: string | null;
}

interface PendingList {
  school_id: string;
  rows: PendingRow[];
}

type Outcome = 'created' | 'linked_existing' | 'error';

interface AccountResult {
  student_code: string;
  full_name: string;
  email: string;
  /** Chỉ có khi vừa tạo tài khoản mới */
  password: string | null;
  outcome: Outcome;
  reason?: string;
}

/** Hai hàm này chỉ service role được gọi (đã khóa quyền thực thi), nên không có trong kiểu sinh tự động */
interface AdminRpc {
  rpc(name: 'find_auth_user_id', args: { p_email: string }): PromiseLike<{ data: string | null; error: unknown }>;
  rpc(
    name: 'link_roster_member',
    args: { p_member_id: string; p_user_id: string; p_is_new_user: boolean },
  ): PromiseLike<{ data: { ok?: boolean; reason?: string } | null; error: unknown }>;
}

/** Mã học sinh thành phần trước @ của email: bỏ dấu, chữ thường, chỉ giữ a-z 0-9 . _ - */
function emailLocalPart(studentCode: string): string {
  return studentCode
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 60);
}

function randomPassword(): string {
  return Array.from({ length: PASSWORD_LENGTH }, () => PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)]).join('');
}

async function processRow(admin: Db, row: PendingRow, email: string): Promise<AccountResult> {
  const base = { student_code: row.student_code, full_name: row.full_name, email };
  const password = randomPassword();
  const rpc = admin as unknown as AdminRpc;

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'student', full_name: row.full_name },
  });

  let userId: string | null = created.data.user?.id ?? null;
  let isNew = userId !== null;
  if (!userId) {
    // Email đã có tài khoản: học ở nhiều lớp của cùng trường
    const found = await rpc.rpc('find_auth_user_id', { p_email: email });
    if (found.error || !found.data) return { ...base, password: null, outcome: 'error', reason: 'create_failed' };
    userId = found.data;
    isNew = false;
  }

  const linked = await rpc.rpc('link_roster_member', { p_member_id: row.member_id, p_user_id: userId, p_is_new_user: isNew });
  if (linked.error || !linked.data?.ok) {
    // Không để lại tài khoản mới mà giáo viên không có mật khẩu để phát
    if (isNew) await admin.auth.admin.deleteUser(userId);
    return { ...base, password: null, outcome: 'error', reason: linked.data?.reason ?? 'link_failed' };
  }
  return isNew ? { ...base, password, outcome: 'created' } : { ...base, password: null, outcome: 'linked_existing' };
}

rosterAccountsRouter.post('/:classId/roster_accounts', async (req, res) => {
  const { db } = getAuth(req);
  const { classId } = paramsSchema.parse(req.params);

  // Quyền của người gọi do database kiểm: giáo viên của lớp hoặc nhân sự trường
  const { data, error } = await db.rpc('list_roster_pending', { p_class_id: classId });
  if (error) {
    if (error.message.includes('class_not_found')) throw new HttpError(404, 'class_not_found');
    throw fromDbError(error);
  }
  const pending = data as unknown as PendingList;

  const admin = getAdminClient();
  const domain = `${pending.school_id.slice(0, 8)}.${EMAIL_DOMAIN}`;
  const usedEmails = new Set<string>();

  const accounts: AccountResult[] = [];
  const queue: { row: PendingRow; email: string }[] = [];
  for (const row of pending.rows) {
    const local = emailLocalPart(row.student_code);
    const email = `${local}@${domain}`;
    if (local === '') {
      accounts.push({ student_code: row.student_code, full_name: row.full_name, email: '', password: null, outcome: 'error', reason: 'invalid_student_code' });
    } else if (usedEmails.has(email)) {
      // Hai mã khác nhau cho cùng một email sau khi bỏ ký tự đặc biệt
      accounts.push({ student_code: row.student_code, full_name: row.full_name, email, password: null, outcome: 'error', reason: 'duplicate_email' });
    } else {
      usedEmails.add(email);
      queue.push({ row, email });
    }
  }

  for (let index = 0; index < queue.length; index += BATCH_SIZE) {
    const batch = queue.slice(index, index + BATCH_SIZE);
    accounts.push(...(await Promise.all(batch.map((item) => processRow(admin, item.row, item.email)))));
  }

  res.set('Cache-Control', 'no-store').json({ accounts });
});
