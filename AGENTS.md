# AI AGENT RULES & PROJECT SPECIFICATION GUIDELINES

Dự án này là hệ thống **TypeScript Frontend** kết hợp **Supabase Backend**.
Tất cả các AI Agents, Subagents và lập trình viên khi tham gia phát triển trong kho lưu trữ này **BẮT BUỘC** tuân thủ tuyệt đối 7 điều luật cốt lõi dưới đây. Không có ngoại lệ.

---

## 7 NGUYÊN TẮC BẮT BUỘC KHI XÂY DỰNG GIAO DIỆN & TÍNH NĂNG

### 1. Không link số liệu/đầu mục/thông tin từ tài liệu lên trên giao diện
- **TUYỆT ĐỐI KHÔNG** hiển thị số thứ tự mục (ví dụ: `1.`, `1.1.`, `2.4.1`), mã đầu mục đặc tả (`REQ-01`, `US_002`), hay tên tài liệu đặc tả (`SRS v1`, `BRD`) lên bất kỳ thành phần UI nào (tiêu đề trang, thẻ card, tên cột bảng, nhãn input, nút bấm).
- Giao diện phải sạch sẽ, mang ngôn ngữ thực tế của người dùng cuối (ví dụ: `Danh sách khách hàng`, không phải `1.1 Quản lý danh sách khách hàng`).
- Xem chi tiết tại: [.agents/rules/01-no-spec-noise-on-ui.md](file:///d:/VibeMapping/.agents/rules/01-no-spec-noise-on-ui.md)

### 2. Không xây dựng mô tả, giải thích đầu mục
- **KHÔNG** tự ý sinh ra các câu văn giải thích mục đích của form, mô tả chức năng dưới tiêu đề, hay văn bản phụ thừa thãi (ví dụ: *"Khu vực này cho phép bạn xem và chỉnh sửa..."*).
- Tiêu đề và nhãn phải tự giải thích (self-explanatory). Giữ mật độ thông tin cao, giao diện tối giản và chuyên nghiệp.
- Xem chi tiết tại: [.agents/rules/01-no-spec-noise-on-ui.md](file:///d:/VibeMapping/.agents/rules/01-no-spec-noise-on-ui.md)

### 3. Không đặt tên sai module/trường/biến - Bám sát đặc tả để mapping chuẩn xác
- Phải dùng đúng 100% thuật ngữ nghiệp vụ từ đặc tả:
  - Tên URL route, tên Component, tên Form, tên cột Supabase, tên biến state phải ánh xạ 1:1 với đặc tả nghiệp vụ.
  - Tên trường trong form (ví dụ `customer_code`, `tax_id`) phải trùng khớp với schema database và TypeScript interface. Cấm tự ý đổi thành tên đồng nghĩa hoặc viết tắt tùy tiện.
- Cấu trúc module rõ ràng để dễ truy xuất và bảo trì.
- Xem chi tiết tại: [.agents/rules/02-naming-and-spec-mapping.md](file:///d:/VibeMapping/.agents/rules/02-naming-and-spec-mapping.md)

### 4. Không đặt các mô tả, hướng dẫn, ví dụ linh tinh, thừa thãi cho các đầu mục
- **CẤM** đưa các ví dụ vô nghĩa hoặc hướng dẫn hiển nhiên vào nhãn và placeholder (ví dụ: `Họ tên (Ví dụ: Nguyễn Văn A - Nhập đầy đủ cả họ và tên)`).
- Placeholder chỉ mang tính gợi ý ngắn gọn định dạng dữ liệu khi cần thiết (`DD/MM/YYYY`, `0901234567`). Không dùng placeholder để thay thế nhãn trường.
- Xem chi tiết tại: [.agents/rules/01-no-spec-noise-on-ui.md](file:///d:/VibeMapping/.agents/rules/01-no-spec-noise-on-ui.md)

### 5. Bám sát theo 1 quy chuẩn giao diện chung (Design System)
- Toàn bộ giao diện phải sử dụng thống nhất bộ **Design Tokens** (CSS Variables trong `src/styles/tokens.css`): màu sắc, bo góc, khoảng cách, font chữ, độ đổ bóng.
- Tất cả các nút bấm, input, modal, bảng biểu, badge phải dùng chung bộ thành phần tại `src/components/common/`.
- Cấm dùng mã màu hex tự do, cấm inline style tùy tiện, cấm mỗi trang một kiểu bo góc hay kích thước nút.
- Xem chi tiết tại: [.agents/rules/03-design-system-standards.md](file:///d:/VibeMapping/.agents/rules/03-design-system-standards.md)

### 6. Đảm bảo tương thích hoàn hảo: Samsung / Android / PC, các độ phân giải & trình duyệt
- **Android & Samsung**:
  - Không tự phóng to màn hình khi focus vào ô nhập liệu: `font-size: 16px` cho input trên mobile.
  - Kích thước chạm (Touch targets) tối thiểu **44px × 44px**.
  - Hỗ trợ `safe-area-inset` cho tai thỏ và thanh điều hướng ảo của Samsung.
- **PC & Màn hình lớn**:
  - Khung chứa chính phủ toàn bộ chiều ngang (không đặt `max-width`); lề ngang `--page-gutter` và kích thước chữ/khoảng cách (đơn vị `--px`, gốc `html` tăng dần theo màn hình) tự lớn lên trên 2K/4K để ô thông tin không bị bé tí. Nội dung dùng lưới `auto-fit`/`auto-fill` để lấp đầy chiều ngang.
  - Sử dụng `min-width: 0` trên các phần tử flex để chống tràn ngang (No horizontal scroll bug).
  - Bảng dữ liệu dài phải bọc trong vùng cuộn ngang mượt mà (`overflow-x: auto`).
- Hoạt động ổn định trên Google Chrome, Samsung Internet, Firefox, Edge, Safari.
- Xem chi tiết tại: [.agents/rules/04-responsive-cross-device.md](file:///d:/VibeMapping/.agents/rules/04-responsive-cross-device.md)

### 7. Form Filter xử lý cẩn thận: Cùng 1 kiểu UI, giới hạn kích thước, Search Bar trong Dropdown
- **Kiểu dáng thống nhất**: Mọi filter bar đều có Search keyword đầu tiên (có debounce 300ms), các select lọc phụ, nút Reset và Áp dụng.
- **Giới hạn kích thước nghiêm ngặt**:
  - Ô input/select có chiều rộng giới hạn (`min-width: 160px; max-width: 260px`).
  - Menu dropdown bắt buộc có `max-height: 280px` và cuộn nội bộ gọn gàng.
- **Bắt buộc có Search Bar trong Dropdown**: Bất kỳ dropdown nào có từ 7 lựa chọn trở lên hoặc dữ liệu động từ Supabase PHẢI tích hợp thanh tìm kiếm tức thì ở đầu danh sách.
- Trên Mobile, toàn bộ Filter thu gọn vào nút/Drawer để tránh chiếm màn hình.
- Xem chi tiết tại: [.agents/rules/05-filter-forms-standard.md](file:///d:/VibeMapping/.agents/rules/05-filter-forms-standard.md)

---

## CẤU TRÚC THƯ MỤC DỰ ÁN (PROJECT DIRECTORY STRUCTURE)

```
d:/VibeMapping/
├── .agents/
│   └── rules/                          # Các tài liệu quy chuẩn chi tiết
│       ├── 01-no-spec-noise-on-ui.md
│       ├── 02-naming-and-spec-mapping.md
│       ├── 03-design-system-standards.md
│       ├── 04-responsive-cross-device.md
│       ├── 05-filter-forms-standard.md
│       └── 06-supabase-typescript-patterns.md
├── AGENTS.md                           # File quy tắc trung tâm cho AI Agent
├── GEMINI.md                           # File quy tắc tương đương cho Gemini
├── .env.example                        # Mẫu biến môi trường frontend & backend
├── .gitignore                          # Cấu hình bỏ qua tệp tin cho Git
├── package.json                        # Scripts điều phối toàn bộ workspace
├── README.md                           # Tài liệu hướng dẫn sử dụng
├── frontend/                           # Typescript Frontend (React + Vite)
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── assets/                     # Icons, hình ảnh tĩnh
│       ├── components/
│       │   ├── common/                 # Nút bấm, Ô nhập, Thẻ, Modal, Badge chuẩn
│       │   ├── filters/                # SearchableSelect, FilterBar tái sử dụng
│       │   └── layout/                 # Khung trang, TopActions (thông báo + avatar), Navbar ngang dính đầu trang
│       ├── hooks/                      # useDebounce, useResponsive, useFilter
│       ├── lib/                        # Supabase client singleton
│       ├── modules/                    # Phân chia theo module nghiệp vụ (bám sát spec)
│       ├── styles/                     # tokens.css, reset.css, global.css
│       └── types/                      # Database & Domain types
└── supabase/                           # Supabase Backend
    ├── config.toml                     # Cấu hình Supabase CLI
    ├── migrations/                     # File di trú cơ sở dữ liệu Postgres
    ├── functions/                      # Supabase Edge Functions (Deno/TS)
    └── seed.sql                        # Dữ liệu mẫu khởi tạo
```

Mọi tác vụ tạo mới code hoặc sửa đổi đều phải đối chiếu với các nguyên tắc trên.
