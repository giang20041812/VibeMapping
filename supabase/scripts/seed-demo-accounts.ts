/**
 * Tạo bộ tài khoản mẫu cho luồng trường học: quản trị trường -> giáo viên -> lớp học -> học sinh.
 *
 *   npm run seed:demo            tạo mới (idempotent: chạy lại không tạo trùng)
 *   npm run seed:demo:dry        chỉ in kế hoạch, không ghi DB
 *
 * Tạo:
 *   - 1 trường (Trường Demo VibeMapping, dùng lại nếu đã có)
 *   - 1 quản trị trường (school_staff.status = 'active', bỏ qua bước xác nhận lời mời)
 *   - 2 giáo viên: 1 chủ nhiệm, 1 bộ môn của lớp mẫu
 *   - 1 lớp học (kèm mã lớp để học sinh khác tham gia thử)
 *   - 10 học sinh đã vào lớp, từ 16 tuổi trở lên nên không bị chặn bởi xác nhận người giám hộ
 *
 * Mật khẩu chung của mọi tài khoản mẫu: 12345678. Chỉ dùng cho môi trường phát triển/thử nghiệm.
 * Cần SUPABASE_URL (hoặc VITE_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY trong .env gốc.
 * Service role key chỉ dùng ở script này, không bao giờ đưa vào frontend.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, 'frontend', '.env') });

const PASSWORD = '12345678';
const EMAIL_DOMAIN = 'vibemapping.test';
const SCHOOL_NAME = 'Trường Demo VibeMapping';
const CLASS_NAME = '11A1';
const GRADE = 11;
const SCHOOL_YEAR = '2026-2027';
const STUDENT_COUNT = 10;

type DemoRole = 'school_admin' | 'teacher' | 'student';

interface DemoAccount {
  email: string;
  role: DemoRole;
  full_name: string;
  date_of_birth?: string;
  /** Chỉ dùng cho giáo viên: vai trò trong lớp mẫu */
  class_role?: 'homeroom_teacher' | 'subject_teacher';
}

const accounts: DemoAccount[] = [
  { email: `quantri.truong@${EMAIL_DOMAIN}`, role: 'school_admin', full_name: 'Nguyễn Quản Trị' },
  { email: `giaovien.chunhiem@${EMAIL_DOMAIN}`, role: 'teacher', full_name: 'Trần Thị Chủ Nhiệm', class_role: 'homeroom_teacher' },
  { email: `giaovien.bomon@${EMAIL_DOMAIN}`, role: 'teacher', full_name: 'Lê Văn Bộ Môn', class_role: 'subject_teacher' },
  ...Array.from({ length: STUDENT_COUNT }, (_, index): DemoAccount => {
    const n = String(index + 1).padStart(2, '0');
    return {
      email: `hocsinh${n}@${EMAIL_DOMAIN}`,
      role: 'student',
      full_name: `Học Sinh ${n}`,
      date_of_birth: '2008-05-20',
    };
  }),
];

/** Tìm user theo email (listUsers phân trang, chỉ lọc client-side) */
async function findUserId(supabase: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found.id;
    if (data.users.length < 200) return null;
  }
}

async function ensureAccount(supabase: SupabaseClient, account: DemoAccount): Promise<string> {
  let userId = await findUserId(supabase, account.email);
  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role: account.role, full_name: account.full_name },
    });
    if (error) throw error;
    userId = data.user.id;
  } else {
    // Đặt lại mật khẩu để chạy lại script luôn cho kết quả giống nhau
    const { error } = await supabase.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true });
    if (error) throw error;
  }

  // Trigger handle_new_auth_user hạ quản trị trường về học sinh; service role đặt lại đúng vai trò
  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({
      role: account.role,
      full_name: account.full_name,
      school_name: SCHOOL_NAME,
      grade_or_major: account.role === 'student' ? `${GRADE}` : null,
      date_of_birth: account.date_of_birth ?? null,
    })
    .eq('id', userId);
  if (profileError) throw profileError;
  return userId;
}

async function ensureSchool(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.from('schools').select('id').eq('school_name', SCHOOL_NAME).limit(1);
  if (error) throw error;
  if (data && data.length > 0) return data[0].id;
  const { data: created, error: insertError } = await supabase
    .from('schools')
    .insert({ school_name: SCHOOL_NAME, city: 'Hà Nội' })
    .select('id')
    .single();
  if (insertError) throw insertError;
  return created.id;
}

async function ensureClass(supabase: SupabaseClient, schoolId: string, createdBy: string): Promise<{ id: string; class_code: string }> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, class_code')
    .eq('school_id', schoolId)
    .eq('class_name', CLASS_NAME)
    .eq('school_year', SCHOOL_YEAR)
    .limit(1);
  if (error) throw error;
  if (data && data.length > 0) return data[0];
  const { data: created, error: insertError } = await supabase
    .from('classes')
    .insert({ school_id: schoolId, class_name: CLASS_NAME, grade: GRADE, school_year: SCHOOL_YEAR, created_by: createdBy })
    .select('id, class_code')
    .single();
  if (insertError) throw insertError;
  return created;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`Trường: ${SCHOOL_NAME}`);
  console.log(`Lớp: ${CLASS_NAME} (${SCHOOL_YEAR})`);
  for (const account of accounts) console.log(`  ${account.role.padEnd(13)} ${account.email}  ${account.full_name}`);
  if (dryRun) {
    console.log('\nDry-run: không ghi vào cơ sở dữ liệu.');
    return;
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || serviceKey.includes('your_service_role_key')) {
    throw new Error('Thiếu SUPABASE_URL (hoặc VITE_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY trong .env');
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1. Tài khoản
  const ids = new Map<string, string>();
  for (const account of accounts) ids.set(account.email, await ensureAccount(supabase, account));
  console.log(`\nĐã chuẩn bị ${accounts.length} tài khoản.`);

  // 2. Trường và nhân sự
  const schoolId = await ensureSchool(supabase);
  const staffRows = accounts
    .filter((account) => account.role !== 'student')
    .map((account) => ({
      school_id: schoolId,
      user_id: ids.get(account.email) as string,
      staff_role: account.role as 'school_admin' | 'teacher',
      status: 'active',
    }));
  const { error: staffError } = await supabase.from('school_staff').upsert(staffRows, { onConflict: 'school_id,user_id' });
  if (staffError) throw staffError;

  // 3. Lớp học
  const adminId = ids.get(accounts[0].email) as string;
  const classRow = await ensureClass(supabase, schoolId, adminId);

  // 4. Thành viên lớp: giáo viên và học sinh
  const now = new Date().toISOString();
  const memberRows = accounts
    .filter((account) => account.role !== 'school_admin')
    .map((account) => ({
      class_id: classRow.id,
      user_id: ids.get(account.email) as string,
      member_role: account.role === 'student' ? 'student' : (account.class_role as string),
      status: 'joined',
      joined_via: 'manual',
      joined_at: now,
    }));
  // Chỉ chèn thành viên chưa có (ràng buộc unique là chỉ mục từng phần nên không dùng upsert)
  const { data: existingMembers, error: membersError } = await supabase
    .from('class_members')
    .select('user_id')
    .eq('class_id', classRow.id)
    .not('user_id', 'is', null);
  if (membersError) throw membersError;
  const joined = new Set((existingMembers ?? []).map((row) => row.user_id));
  const pendingMembers = memberRows.filter((row) => !joined.has(row.user_id));
  if (pendingMembers.length > 0) {
    const { error } = await supabase.from('class_members').insert(pendingMembers);
    if (error) throw error;
  }

  // 5. Đồng ý tham gia lớp của học sinh (giống khi vào lớp bằng mã lớp)
  const studentIds = accounts.filter((account) => account.role === 'student').map((account) => ids.get(account.email) as string);
  const { data: consented, error: consentReadError } = await supabase
    .from('consent_records')
    .select('user_id')
    .eq('consent_type', 'class_participation')
    .in('user_id', studentIds);
  if (consentReadError) throw consentReadError;
  const consentedIds = new Set((consented ?? []).map((row) => row.user_id));
  const consentRows = studentIds
    .filter((id) => !consentedIds.has(id))
    .map((id) => ({
      user_id: id,
      consent_type: 'class_participation',
      displayed_content: `Tham gia lớp ${CLASS_NAME} (${SCHOOL_YEAR}) đồng nghĩa với đồng ý để giáo viên của lớp đánh giá.`,
    }));
  if (consentRows.length > 0) {
    const { error } = await supabase.from('consent_records').insert(consentRows);
    if (error) throw error;
  }

  console.log(`Lớp ${CLASS_NAME}: mã lớp ${classRow.class_code}, thêm mới ${pendingMembers.length} thành viên.`);
  console.log(`\nĐăng nhập bằng email ở trên, mật khẩu: ${PASSWORD}`);
}

main().catch((error) => {
  console.error('Lỗi tạo tài khoản mẫu:', error instanceof Error ? error.message : error);
  process.exit(1);
});
