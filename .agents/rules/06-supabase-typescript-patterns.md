# Quy chuẩn 06: Kiến trúc Supabase Backend & TypeScript Type-Safety

## 1. Mục tiêu
Thiết lập chuẩn giao tiếp an toàn, bảo mật và đồng bộ kiểu dữ liệu (Strict Type-Safety) giữa cơ sở dữ liệu Supabase (PostgreSQL) và mã nguồn TypeScript ở Frontend.

---

## 2. Quản trị Supabase Client

### 2.1. Khởi tạo Client duy nhất (Singleton Pattern)
- Supabase client chỉ được khởi tạo một lần duy nhất tại `src/lib/supabase.ts` và export ra để toàn bộ ứng dụng sử dụng.
- Client phải nhận vào kiểu dữ liệu Database Type được sinh tự động từ schema:
  ```typescript
  import { createClient } from '@supabase/supabase-js';
  import type { Database } from '../types/supabase';

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables in .env');
  }

  export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  ```

### 2.2. Bảo mật khóa truy cập (Security Rules)
- **Frontend**: CHỈ ĐƯỢC PHÉP sử dụng `VITE_SUPABASE_ANON_KEY`.
- **Tuyệt đối KHÔNG** đưa `SUPABASE_SERVICE_ROLE_KEY` vào mã nguồn Frontend hoặc các biến có tiền tố `VITE_`. Service Role Key có quyền bỏ qua RLS và chỉ được dùng trong Supabase Edge Functions hoặc các script bảo trì máy chủ nội bộ.

---

## 3. Quản lý Migrations & Database Schema

### 3.1. Cấu trúc thư mục Supabase
- Mọi thay đổi bảng, cột, indexes, triggers, và RLS Policies phải được lưu thành file migration tại `supabase/migrations/[YYYYMMDDHHMMSS]_[ten_migration].sql`.
- File migration phải có khả năng thực thi lại an toàn (Idempotent với `IF NOT EXISTS` hoặc `CREATE OR REPLACE`).

### 3.2. Tiêu chuẩn đặt tên Database (Postgres Conventions)
- Tên bảng: Số nhiều, chữ thường, cách nhau bằng gạch dưới (`snake_case`): ví dụ `users`, `customers`, `insurance_contracts`.
- Tên cột: Chữ thường `snake_case`: `id`, `full_name`, `created_at`, `updated_at`.
- Khóa chính: Luôn là `id uuid DEFAULT gen_random_uuid() PRIMARY KEY`.
- Timestamp: Luôn có `created_at timestamptz DEFAULT now() NOT NULL` và `updated_at timestamptz DEFAULT now() NOT NULL`.

### 3.3. Bắt buộc kích hoạt Row Level Security (RLS)
Mọi bảng được tạo mới đều **BẮT BUỘC** bật RLS:
```sql
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Policy mẫu cho người dùng đã đăng nhập
CREATE POLICY "Authenticated users can select customers"
ON public.customers
FOR SELECT
TO authenticated
USING (true);
```

---

## 4. Xử lý lỗi & Kiểu trả về (Error Handling & Return Types)
- Không bao giờ để câu lệnh gọi Supabase crash mà không bắt lỗi.
- Đóng gói logic gọi Supabase trong các Service functions (ví dụ: `customer.service.ts`):
```typescript
export async function getCustomers(filter: CustomerFilterParams) {
  let query = supabase.from('customers').select('*');
  
  if (filter.searchKeyword) {
    query = query.ilike('full_name', `%${filter.searchKeyword}%`);
  }
  
  const { data, error } = await query;
  if (error) {
    console.error('Lỗi truy vấn Supabase:', error.message);
    throw error;
  }
  return data;
}
```
