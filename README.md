# VibeMapping Workspace

Dự án chuẩn hóa **TypeScript Frontend** và **Supabase Backend** với hệ thống quy tắc (AI Ruleset) nghiêm ngặt dành cho Agent và lập trình viên.

---

## 📌 7 Điều luật cốt lõi dành cho AI Agent (Ruleset Summary)

Mọi thay đổi code hoặc sinh giao diện trong dự án đều phải tuân thủ nghiêm ngặt 7 điều luật:
1. **Không link số liệu/đầu mục/thông tin từ tài liệu lên trên giao diện**: Tuyệt đối không hiển thị "1.1", "Mục 2", "Theo SRS v1..." lên UI.
2. **Không xây dựng mô tả, giải thích đầu mục**: Không sinh các câu văn giải thích, mô tả chức năng hiển nhiên dưới tiêu đề hay nhãn trường.
3. **Không đặt tên sai module/trường/biến**: Ánh xạ 1:1 chuẩn xác với đặc tả nghiệp vụ, tên bảng Postgres và interface TypeScript.
4. **Không đặt các mô tả, hướng dẫn, ví dụ linh tinh, thừa thãi**: Nhãn và placeholder súc tích, chuyên nghiệp.
5. **Bám sát theo 1 quy chuẩn giao diện chung**: Sử dụng thống nhất Design Tokens (`src/styles/tokens.css`) và các components tại `src/components/common/`.
6. **Tương thích đa thiết bị (Samsung / Android / PC) & đa trình duyệt**: Không zoom input trên mobile (font size >= 16px), touch target >= 44px, safe area, chống tràn ngang flex/grid (`min-width: 0`).
7. **Form filter xử lý cẩn thận**: Cùng một kiểu dáng UI, giới hạn chiều dài/rộng, bắt buộc có Search Bar tích hợp trong Dropdown khi có từ 7 lựa chọn trở lên.

Chi tiết xem tại:
- [AGENTS.md](file:///d:/VibeMapping/AGENTS.md)
- [GEMINI.md](file:///d:/VibeMapping/GEMINI.md)
- Thư mục [.agents/rules/](file:///d:/VibeMapping/.agents/rules/)

---

## 📂 Cấu trúc thư mục (Directory Structure)

```
d:/VibeMapping/
├── .agents/
│   └── rules/                          # Các tài liệu quy chuẩn chi tiết
│       ├── 01-no-spec-noise-on-ui.md   # Quy chuẩn 1, 2, 4 (Zero spec noise)
│       ├── 02-naming-and-spec-mapping.md# Quy chuẩn 3 (Naming & mapping)
│       ├── 03-design-system-standards.md# Quy chuẩn 5 (Design system & tokens)
│       ├── 04-responsive-cross-device.md# Quy chuẩn 6 (Samsung/Android/PC)
│       ├── 05-filter-forms-standard.md  # Quy chuẩn 7 (Filter & SearchableSelect)
│       └── 06-supabase-typescript-patterns.md # Supabase & Type safety
├── AGENTS.md                           # Master Rule file cho Antigravity/AI
├── GEMINI.md                           # Master Rule file đồng bộ
├── .env.example                        # Mẫu cấu hình môi trường
├── .gitignore                          # Cấu hình bỏ qua tệp Git
├── package.json                        # Root package scripts
├── frontend/                           # TypeScript Frontend (Vite + React)
│   ├── index.html                      # HTML5 semantic, viewport tối ưu mobile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── components/
│       │   ├── common/                 # Button, Input, Card, Badge
│       │   ├── filters/                # SearchableSelect, FilterBar
│       │   └── layout/                 # Header, AppLayout
│       ├── hooks/                      # useDebounce, useResponsive
│       ├── lib/                        # Supabase client singleton
│       ├── modules/
│       │   └── customer/               # Module khách hàng thực tế demo đầy đủ 7 rules
│       ├── styles/
│       │   ├── tokens.css              # Hệ thống tokens màu sắc, khoảng cách, bo góc
│       │   ├── reset.css               # Reset tối ưu mobile/Samsung Internet
│       │   └── global.css              # Tiện ích chung & thanh cuộn
│       └── types/
│           ├── supabase.ts             # Kiểu dữ liệu database type-safe
│           └── filter.ts               # Định nghĩa kiểu cho bộ lọc
└── supabase/                           # Supabase Backend
    ├── config.toml                     # Cấu hình Supabase CLI
    ├── migrations/                     # Script di trú Postgres
    │   └── 20261026000000_init_schema.sql
    ├── functions/                      # Edge functions
    └── seed.sql                        # Dữ liệu mẫu khởi tạo
```

---

## 🚀 Hướng dẫn Cài đặt & Chạy dự án

### 1. Cài đặt Dependencies
Tại thư mục gốc dự án:
```bash
cd frontend
npm install
```

### 2. Thiết lập Biến môi trường
Sao chép `.env.example` thành `.env`:
```bash
cp .env.example .env
cp .env.example frontend/.env
```

### 3. Chạy môi trường Phát triển (Development)
Tại thư mục gốc:
```bash
npm run dev
```
Hoặc trong thư mục `frontend`:
```bash
npm run dev
```
Truy cập: `http://localhost:5173`

### 4. Supabase Local Development (Tùy chọn)
Nếu đã cài đặt [Supabase CLI](https://supabase.com/docs/guides/cli):
```bash
supabase start
supabase db reset
```
Sinh lại kiểu TypeScript từ cơ sở dữ liệu thực tế:
```bash
npm run supabase:types
```

### 5. Khách làm bài test không cần đăng nhập
Khách vào `/lam-bai` được tạo tài khoản **ẩn danh** của Supabase Auth để lưu bài; làm xong thì điền thông tin ở `/hoan-tat-ho-so` và email, mật khẩu được gắn vào chính tài khoản đó nên kết quả không mất.

- **Local**: đã bật sẵn bằng `enable_anonymous_sign_ins = true` trong `supabase/config.toml`.
- **Supabase đã deploy (cloud hoặc tự host)**: bật tay **Authentication → Sign In / Providers → Allow anonymous sign-ins**, chạy migration `20261029000400_phase1_guest_test_account.sql`. Nên bật CAPTCHA cho đăng nhập ẩn danh để chống tạo hàng loạt.
- Nếu dự án bật **Confirm email**, khách bấm liên kết trong email mới thành tài khoản thật; kết quả vẫn nằm sẵn trong tài khoản đó.
- Tài khoản ẩn danh bỏ dở (không bao giờ gắn email) nằm lại trong `auth.users`; nên dọn định kỳ những tài khoản `is_anonymous` quá cũ.
