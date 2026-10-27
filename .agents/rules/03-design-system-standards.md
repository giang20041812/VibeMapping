# Quy chuẩn 03: Hệ thống Thiết kế Đồng bộ & Chuẩn hóa Giao diện (Design System)

## 1. Mục tiêu
Thiết lập một ngôn ngữ thiết kế chung (Unified Design Language) cho toàn bộ ứng dụng. Tất cả các trang, form, bảng biểu, modal, nút bấm và đầu mục đều phải kế thừa từ cùng một bộ Design Tokens (CSS Variables) và các thành phần dùng chung (Shared Components). Tuyệt đối không dùng mã màu tự chế (hardcoded hex), khoảng cách tùy tiện hay giao diện cọc cạch giữa các màn hình.

---

## 2. Hệ thống Tokens quy chuẩn (CSS Variables)

Tất cả stylesheet phải sử dụng các biến CSS được định nghĩa trong `src/styles/tokens.css`:

### 2.1. Màu sắc (Color Palette)
Tông chủ đạo **xanh – trắng**, lấy từ tài liệu đặt tên hệ thống (navy `#031964`, xanh nhạt `#C7E3FE`, kem `#FFFCF0`, các dải xanh dương). Logo dùng đúng màu hệ thống; chỉ tua mũ cử nhân dùng vàng nhấn (`--brand-gold`).
- **Thang thương hiệu** (khai báo ở `tokens.css`): `--brand-navy`, `--brand-deep`, `--brand-azure`, `--brand-blue`, `--brand-sky`, `--brand-light`, `--brand-soft`, `--brand-pale`, `--brand-mist`, `--brand-ice`, `--brand-cream`, `--brand-gold`.
- **Primary**: `--color-primary` (= `--brand-deep`), `--color-primary-hover`, `--color-primary-active`, `--color-primary-light`, `--color-accent` (= `--brand-sky`, dùng cho điểm nhấn, focus, biểu đồ).
- **Neutral / Surface**: `--color-bg-app`, `--color-bg-surface`, `--color-bg-subtle`, `--color-border`, `--color-border-hover`.
- **Text**: `--color-text-main` (navy), `--color-text-secondary`, `--color-text-muted`, `--color-text-brand`.
- **Status**: `--color-success|warning|danger|info` kèm `-bg`, `-border`, `-text`. Trạng thái luôn kèm biểu tượng và chữ mô tả, không chỉ dựa vào màu.
- **Màu nhấn trực quan hóa**: `--accent-cyan`, `--accent-violet`, `--accent-magenta`, `--accent-teal` cùng ánh sáng `--glow-*`, nền tối `--gradient-stage`, `--stage-*` và dải `--gradient-spectrum`. Chỉ dùng cho hình minh họa (biểu đồ ngũ giác, quả địa cầu, nền trang chủ), không dùng cho nút bấm, chữ nội dung hay trạng thái.
- **Gradient / chuyển động**: `--gradient-brand`, `--gradient-brand-deep`, `--gradient-soft`; `--ease-out`, `--ease-spring`, `--transition-fast|normal|slow`. Mọi animation phải tắt được khi người dùng bật `prefers-reduced-motion` (tokens đã xử lý).

### 2.2. Khoảng cách (Spacing Scale)
- `--space-1`: `4px`
- `--space-2`: `8px`
- `--space-3`: `12px`
- `--space-4`: `16px`
- `--space-5`: `20px`
- `--space-6`: `24px`
- `--space-8`: `32px`

### 2.3. Bo góc & Hiệu ứng đổ bóng (Radii & Shadows)
- Góc vuông vắn, chỉ bo rất nhẹ: `--radius-sm` `2px` (Badge, tag, chip), `--radius-md` `4px` (Input, Button, Dropdown), `--radius-lg` `4px` (Alert, ô danh sách), `--radius-xl` `6px` (Card, Modal), `--radius-2xl` `8px` (khung minh họa).
- `--radius-full` chỉ dành cho hình tròn thật (chấm, vòng tròn); **không** dùng cho chip, tab, thanh tiến độ, công tắc hay nút bấm.
- Khoảng cách, cỡ chữ, chiều cao ô điều khiển dùng đơn vị co giãn `--px` (1/14 rem) để tự lớn theo màn hình; vùng chạm `--touch-target` giữ `44px` cố định.
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
