# Quy chuẩn 03: Hệ thống Thiết kế Đồng bộ & Chuẩn hóa Giao diện (Design System)

## 1. Mục tiêu
Thiết lập một ngôn ngữ thiết kế chung (Unified Design Language) cho toàn bộ ứng dụng. Tất cả các trang, form, bảng biểu, modal, nút bấm và đầu mục đều phải kế thừa từ cùng một bộ Design Tokens (CSS Variables) và các thành phần dùng chung (Shared Components). Tuyệt đối không dùng mã màu tự chế (hardcoded hex), khoảng cách tùy tiện hay giao diện cọc cạch giữa các màn hình.

---

## 2. Hệ thống Tokens quy chuẩn (CSS Variables)

Tất cả stylesheet phải sử dụng các biến CSS được định nghĩa trong `src/styles/tokens.css`:

### 2.1. Màu sắc (Color Palette)
- **Primary / Brand**:
  - `--color-primary`: `#2563eb` (Blue 600)
  - `--color-primary-hover`: `#1d4ed8` (Blue 700)
  - `--color-primary-light`: `#eff6ff` (Blue 50)
- **Neutral / Surface**:
  - `--color-bg-app`: `#f8fafc` (Nền ứng dụng)
  - `--color-bg-surface`: `#ffffff` (Nền card, table, modal)
  - `--color-border`: `#e2e8f0` (Viền ngăn cách)
  - `--color-border-hover`: `#cbd5e1`
- **Text Hierarchy**:
  - `--color-text-main`: `#0f172a` (Tiêu đề, chữ chính - tương phản cao)
  - `--color-text-secondary`: `#475569` (Nhãn trường, phụ đề ngắn)
  - `--color-text-muted`: `#94a3b8` (Placeholder, meta info)
- **Status Semantic**:
  - `--color-success`: `#10b981`, `--color-success-bg`: `#ecfdf5`
  - `--color-warning`: `#f59e0b`, `--color-warning-bg`: `#fffbeb`
  - `--color-danger`: `#ef4444`, `--color-danger-bg`: `#fef2f2`
  - `--color-info`: `#3b82f6`, `--color-info-bg`: `#eff6ff`

### 2.2. Khoảng cách (Spacing Scale)
- `--space-1`: `4px`
- `--space-2`: `8px`
- `--space-3`: `12px`
- `--space-4`: `16px`
- `--space-5`: `20px`
- `--space-6`: `24px`
- `--space-8`: `32px`

### 2.3. Bo góc & Hiệu ứng đổ bóng (Radii & Shadows)
- `--radius-sm`: `6px` (Badge, tag)
- `--radius-md`: `8px` (Input, Button, Dropdown)
- `--radius-lg`: `12px` (Card, Table container)
- `--radius-xl`: `16px` (Modal, Drawer)
- `--shadow-sm`: `0 1px 2px 0 rgba(0, 0, 0, 0.05)`
- `--shadow-md`: `0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)`
- `--shadow-lg`: `0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.03)`

---

## 3. Quy chuẩn Thành phần Giao diện cốt lõi (Core UI Components)

Tất cả các module phải tái sử dụng từ `src/components/common/`:

1. **Button (`<Button />`)**:
   - Biến thể chuẩn: `variant="primary" | "secondary" | "outline" | "danger" | "ghost"`.
   - Chiều cao chuẩn: `size="md"` (38px - 40px), `size="sm"` (32px), `size="lg"` (44px).
   - Luôn hỗ trợ trạng thái `loading` và `disabled` có hiệu ứng mượt mà.
2. **Input & Select (`<Input />`, `<SearchableSelect />`)**:
   - Chiều cao đồng bộ với Button (38px - 40px).
   - Viền chuẩn `--color-border`, khi focus đổi sang `--color-primary` kèm `outline: 2px solid rgba(37,99,235,0.2)`.
   - Bắt buộc có nhãn (label) chuẩn trên đầu, không đặt icon lệch hàng.
3. **Card & Container (`<Card />`)**:
   - Sử dụng `--color-bg-surface`, viền `--color-border`, bo góc `--radius-lg`, đổ bóng `--shadow-sm`.
   - Padding bên trong luôn là `--space-5` hoặc `--space-6`.
4. **Data Table (`<Table />`)**:
   - Header bảng có nền `--color-bg-app` hoặc xám nhẹ, chữ in hoa nhẹ hoặc `font-weight: 600`, căn trái cho text, căn phải cho số tiền/số lượng, căn giữa cho trạng thái/hành động.
   - Các hàng (row) có đường kẻ mỏng `--color-border`, hiệu ứng hover nhẹ `--color-bg-app`.
   - Luôn bọc trong container có thanh cuộn ngang mượt mà (`overflow-x: auto`) để không vỡ layout trên màn hình nhỏ.

---

## 4. Quy tắc cấm tuyệt đối
- ❌ **CẤM** dùng inline styles với màu hoặc khoảng cách tùy tiện (ví dụ: `style={{ color: '#ff2299', margin: '17px' }}`).
- ❌ **CẤM** tạo một nút bấm hay input mới với kích thước hoặc màu sắc dị biệt không nằm trong design system.
- ❌ **CẤM** trộn lẫn nhiều kiểu phông chữ khác nhau trên cùng một ứng dụng (chỉ sử dụng `Inter` hoặc hệ font hệ thống chuẩn).
