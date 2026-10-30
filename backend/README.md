# VibeMapping API (Node.js)

Express 5 + TypeScript, đứng giữa frontend và Supabase.

- Người dùng đăng nhập bằng Supabase Auth ở frontend, gửi `Authorization: Bearer <access_token>` tới API.
- API xác minh token rồi gọi Supabase **bằng chính JWT đó**, nên RLS và kiểm quyền trong hàm RPC vẫn áp dụng như cũ.
- `SUPABASE_SERVICE_ROLE_KEY` chỉ dùng cho tác vụ cần quyền cao (tạo tài khoản roster, đổi mật khẩu), sau khi đã kiểm quyền người gọi.

## Chạy

```bash
cd backend
cp .env.example .env   # điền SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev            # http://localhost:3000/api
```

Từ thư mục gốc: `npm run dev:api`, `npm run build:api`, `npm run start:api`, `npm run typecheck:api`.
Sau khi đổi schema: `npm run supabase:types` rồi `npm --prefix backend run sync:types`.

## Endpoint (tiền tố `/api`)

| Module | Route |
| --- | --- |
| health | `GET /health` (không cần token) |
| profile | `GET /profile`, `PUT /profile`, `PUT /profile/learner_role` |
| account | `PUT /account/password`, `GET/PUT /account/notification_settings`, `GET /account/notifications`, `GET /account/notifications/unread_count`, `POST /account/notifications/read` |
| admin | `/admin/criteria_groups`, `/admin/criteria`, `/admin/criteria/:id/rater_visibility`, `/admin/criteria_rater_visibility`, `/admin/holland_codes`, `/admin/questions`, `/admin/operation_parameters`, `/admin/audit_logs`, `/admin/package_assignments` |
| class_management | `POST /class_management/classes/:classId/roster_accounts` (thay Edge Function `create-roster-accounts`) |

Lỗi trả dạng `{ "error": "<mã>" }` với mã HTTP tương ứng (400, 401, 403, 404, 409, 503…).

## Chưa chuyển sang API

Các module còn lại vẫn được frontend gọi thẳng Supabase: assessment_session, assessment_result, guest_assessment, invitation_link, submission_review, class_assessment_grid, class_management (trừ roster_accounts), home. Chuyển dần theo cùng khuôn: `modules/<tên>/<tên>.routes.ts`, gắn vào `src/app.ts`.
