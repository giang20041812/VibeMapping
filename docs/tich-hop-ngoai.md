# Gắn dịch vụ ngoài: email, SMS, kho tệp

Tính năng đã có sẵn trong mã. Phần dưới là việc cấu hình trên Supabase để bật từng dịch vụ.
Chưa cấu hình thì ứng dụng vẫn chạy bình thường, chỉ phần tương ứng chưa hoạt động.

## 0. Áp migration mới

```bash
supabase db push
```

Gồm các migration `20261117000100` → `20261117000500`:

| Migration | Nội dung |
|---|---|
| `000100_skill_gap_jd` | Phân tích khoảng cách kỹ năng theo JD |
| `000200_community_m09` | Cộng đồng: loại bài, hạn chế đăng bài, hồ sơ người hướng dẫn, sự kiện theo đối tượng |
| `000300_friend_links` | Mã kết bạn, lời kết bạn, mời bạn đánh giá 360° |
| `000400_email_outbox` | Hàng đợi email thông báo |
| `000500_exported_files` | Bảng `exported_files` và bucket riêng tư `exports` |

## 1. Email thông báo

**Luồng:** thông báo trong ứng dụng → trigger `queue_notification_email` xếp thư vào `email_outbox`
→ Edge Function `send-notification-emails` lấy thư và gửi qua nhà cung cấp → cập nhật trạng thái.

Thư chỉ được xếp khi đủ ba điều kiện:

- Loại thông báo nằm trong tham số `email_notification_types`.
- Người dùng chưa tắt email cho loại đó (Hồ sơ cá nhân → Cài đặt thông báo).
- Tài khoản có email thật: không phải tài khoản ẩn danh, không phải email nội bộ `*.vibemapping.local`.

**Chưa gắn nhà cung cấp:** hàm trả về `provider_not_configured` và không lấy thư.
Thư nằm chờ, quá `email_max_age_hours` (mặc định 48 giờ) thì chuyển "Hết hạn", nên khi gắn nhà cung cấp sẽ không gửi dồn thư cũ.

### Bước gắn (Resend)

1. Tạo tài khoản Resend, xác minh tên miền gửi, lấy API key.
2. Khai báo secrets:

   ```bash
   supabase secrets set EMAIL_PROVIDER=resend \
     RESEND_API_KEY=re_xxx \
     EMAIL_FROM="VibeMapping <thongbao@ten-mien.vn>" \
     APP_URL=https://ten-mien.vn \
     CRON_SECRET=<chuoi-ngau-nhien>
   ```

3. Triển khai hàm:

   ```bash
   supabase functions deploy send-notification-emails
   ```

4. Đặt lịch chạy mỗi phút (SQL Editor, cần bật extension `pg_cron` và `pg_net`):

   ```sql
   select cron.schedule(
     'send-notification-emails',
     '* * * * *',
     $$
     select net.http_post(
       url     := 'https://<project-ref>.supabase.co/functions/v1/send-notification-emails',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer <anon-key>',
         'x-cron-secret', '<CRON_SECRET>'
       ),
       body    := '{}'::jsonb
     );
     $$
   );
   ```

   Nên lưu khóa và `CRON_SECRET` trong Supabase Vault rồi đọc ra trong lệnh, thay vì ghi thẳng vào lịch.

5. Kiểm tra: Quản trị → Tham số vận hành → thẻ **Email thông báo**.
   Thẻ hiện số thư theo trạng thái, các thư lỗi hoặc đang chờ, và nút **Gửi lại thư lỗi**.
   Nếu có thư chờ quá 15 phút, thẻ cảnh báo kiểm tra khóa và lịch chạy.

### Đổi nhà cung cấp

Trong `supabase/functions/send-notification-emails/index.ts`, thêm một hàm gửi vào `PROVIDERS` (cùng kiểu `Sender`),
rồi đặt `EMAIL_PROVIDER` bằng tên hàm đó. Phần hàng đợi và giao diện không cần sửa.

### Tham số liên quan

| Mã | Mặc định | Ý nghĩa |
|---|---|---|
| `email_notification_types` | danh sách loại quan trọng | Loại thông báo được gửi email |
| `email_max_age_hours` | 48 | Thư chờ quá hạn thì bỏ |
| `email_max_attempts` | 3 | Số lần thử trước khi đánh dấu lỗi |

## 2. Đăng nhập bằng số điện thoại (SMS OTP)

1. Supabase → Authentication → Providers → **Phone**: bật, chọn nhà cung cấp SMS (Twilio, Vonage, MessageBird, Textlocal) và nhập khóa.
2. Không cần sửa mã: trang Đăng nhập tự hiện tab **Số điện thoại** khi Supabase báo đã bật Phone.

## 3. Đăng nhập Google

Supabase → Authentication → Providers → **Google**: nhập Client ID và Client Secret từ Google Cloud Console,
thêm `https://<project-ref>.supabase.co/auth/v1/callback` vào Authorized redirect URIs.
Nút Google ở trang Đăng nhập và Đăng ký tự hiện khi đã bật.

## 4. Kho tệp PDF (bucket `exports`)

- Migration `000500` tạo bucket riêng tư `exports` (giới hạn 10 MB, chỉ PDF và JSON) cùng chính sách truy cập:
  mỗi người chỉ đọc, ghi, xóa trong thư mục `<user_id>/`.
- Nếu bucket chưa có sau khi áp migration (ví dụ môi trường không bật Storage), tạo tay bucket `exports`
  ở chế độ **Private** rồi chạy lại migration.
- Tệp được lưu khi:
  - Chủ hồ sơ tải **Hồ sơ định hướng** PDF.
  - Người lập tải **Báo cáo quyết định** PDF.
  - Người dùng xuất **dữ liệu cá nhân** (JSON) ở trang Quyền riêng tư.
- Người dùng xem, tải, xóa tệp ở Quyền riêng tư → **Tệp đã lưu**. Đường dẫn tải có hiệu lực 10 phút.

**Còn để sau:** khi xóa tài khoản, dòng `exported_files` bị xóa theo nhưng tệp trong bucket vẫn còn.
Cần một tác vụ dọn tệp mồ côi (Edge Function chạy định kỳ, xóa thư mục của tài khoản đã xóa).

## 5. Phông chữ PDF

PDF dựng ngay trên trình duyệt bằng `pdf-lib`, nhúng phông **Be Vietnam Pro** (giấy phép SIL OFL, kèm `frontend/src/assets/fonts/OFL.txt`)
nên giữ đủ dấu tiếng Việt. Không cần dịch vụ ngoài.
