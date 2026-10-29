// Tạo tài khoản đăng nhập cho học sinh nhập từ danh sách Excel nhưng chưa có tài khoản.
//
// Gọi bởi giáo viên của lớp hoặc nhân sự trường (quyền kiểm bằng hàm list_roster_pending, chạy với JWT của người gọi).
// Mẫu Excel không có email nên mỗi học sinh nhận email nội bộ <mã học sinh>@<mã trường>.vibemapping.local
// và một mật khẩu tạm ngẫu nhiên. Mật khẩu chỉ trả về một lần trong kết quả; không lưu ở đâu khác.
// Học sinh đã có tài khoản (cùng email nội bộ, ví dụ học ở nhiều lớp của một trường) thì được gắn vào lớp, không đổi mật khẩu.
//
// Cần biến môi trường SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (Supabase tự cấp cho Edge Function).
import { createClient } from 'npm:@supabase/supabase-js@2';

const EMAIL_DOMAIN = 'vibemapping.local';
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const PASSWORD_LENGTH = 10;
/** Số tài khoản tạo song song; vừa đủ nhanh mà không dồn tải lên dịch vụ đăng nhập */
const BATCH_SIZE = 10;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
  const bytes = new Uint8Array(PASSWORD_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => PASSWORD_CHARS[byte % PASSWORD_CHARS.length]).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401);

  let classId: unknown;
  try {
    classId = (await req.json())?.class_id;
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (typeof classId !== 'string' || classId === '') return json({ error: 'invalid_body' }, 400);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'server_not_configured' }, 500);

  // Quyền của người gọi do database kiểm: giáo viên của lớp hoặc nhân sự trường
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await asCaller.rpc('list_roster_pending', { p_class_id: classId });
  if (error) {
    if (error.message.includes('forbidden')) return json({ error: 'forbidden' }, 403);
    if (error.message.includes('class_not_found')) return json({ error: 'class_not_found' }, 404);
    return json({ error: 'lookup_failed' }, 500);
  }
  const pending = data as unknown as PendingList;

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const domain = `${pending.school_id.slice(0, 8)}.${EMAIL_DOMAIN}`;
  const usedEmails = new Set<string>();

  async function processRow(row: PendingRow, email: string): Promise<AccountResult> {
    const base = { student_code: row.student_code, full_name: row.full_name, email };
    const password = randomPassword();

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
      const found = await admin.rpc('find_auth_user_id', { p_email: email });
      if (found.error || !found.data) return { ...base, password: null, outcome: 'error', reason: 'create_failed' };
      userId = found.data as string;
      isNew = false;
    }

    const linked = await admin.rpc('link_roster_member', { p_member_id: row.member_id, p_user_id: userId, p_is_new_user: isNew });
    const result = linked.data as { ok?: boolean; reason?: string } | null;
    if (linked.error || !result?.ok) {
      // Không để lại tài khoản mới mà giáo viên không có mật khẩu để phát
      if (isNew) await admin.auth.admin.deleteUser(userId);
      return { ...base, password: null, outcome: 'error', reason: result?.reason ?? 'link_failed' };
    }
    return isNew
      ? { ...base, password, outcome: 'created' }
      : { ...base, password: null, outcome: 'linked_existing' };
  }

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
    accounts.push(...(await Promise.all(batch.map((item) => processRow(item.row, item.email)))));
  }

  return json({ accounts });
});
