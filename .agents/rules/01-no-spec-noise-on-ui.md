# Quy chuẩn 01: Không đưa số liệu / đầu mục đặc tả & mô tả thừa thãi lên giao diện

## 1. Mục tiêu
Đảm bảo giao diện người dùng (UI) hoàn toàn sạch sẽ, mang tính thương mại và chuyên nghiệp (Production-ready). Tuyệt đối không để lộ các vết tích của tài liệu đặc tả, phân tích nghiệp vụ (BRD/SRS) hoặc các đoạn văn giải thích, ví dụ không cần thiết lên màn hình.

---

## 2. Quy tắc cấm tuyệt đối (NEVER DO)

### 2.1. Cấm hiển thị số thứ tự, mã đầu mục tài liệu trên UI
- **KHÔNG** đưa các ký hiệu đầu mục như: `"1."`, `"1.1."`, `"Mục 2.3"`, `"Phần II"`, `"Đầu mục 4.2"`, `"REQ-001"`, `"US_04"` lên tiêu đề trang, tên form, tên bảng, nhãn trường (labels) hoặc nút bấm.
- **KHÔNG** đặt tiêu đề dạng:
  - ❌ `1.1 Danh sách khách hàng`
  - ❌ `Mục 3: Thông tin hợp đồng`
  - ❌ `Bảng dữ liệu theo SRS v1.2`
  - ✅ `Danh sách khách hàng`
  - ✅ `Thông tin hợp đồng`

### 2.2. Cấm hiển thị mô tả, giải thích đầu mục thừa thãi
- **KHÔNG** tự ý sinh ra các câu mô tả/giải thích chức năng hiển thị dưới tiêu đề hoặc dưới nhãn trường nếu tài liệu/nghiệp vụ không bắt buộc.
- Ví dụ các văn bản cấm sinh ra:
  - ❌ `Mục này cho phép người dùng xem và lọc danh sách khách hàng trong hệ thống.`
  - ❌ `Vui lòng nhập tên của bạn vào ô bên dưới để tiếp tục.`
  - ❌ `Đây là khu vực hiển thị các thông số chi tiết của module.`
- **Nguyên tắc**: Giao diện trực quan tự giải thích (Self-explanatory UI). Nhãn (Label) và vị trí của thành phần phải rõ ràng, không dùng chữ giải thích dài dòng để bù đắp cho thiết kế.

### 2.3. Cấm đặt ví dụ linh tinh, mô tả lan man (Filler / Junk Text)
- **KHÔNG** đặt các ví dụ ngẫu nhiên, hướng dẫn dư thừa vào nhãn hoặc dưới input:
  - ❌ Label: `Họ và tên (Ví dụ: Nguyễn Văn A, dùng để định danh)`
  - ❌ Helper text: `Nhập mã số thuế (ví dụ: 0101234567, nếu không có thì bỏ qua)`
  - ✅ Label: `Họ và tên`, Placeholder: `Nguyễn Văn A` (chỉ dùng placeholder ngắn gọn mang tính gợi ý định dạng khi thực sự cần).
  - ✅ Label: `Mã số thuế` (kèm biểu tượng bắt buộc `*` nếu bắt buộc).
- Chỉ cho phép helper text khi có yêu cầu nghiệp vụ cụ thể về ràng buộc kỹ thuật (ví dụ: *"Mật khẩu tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số"*).

---

## 3. Bảng đối chiếu thực hành

| Vị trí | SAI (Vi phạm quy chuẩn) | ĐÚNG (Chuẩn Production) |
| :--- | :--- | :--- |
| **Tiêu đề trang (Page Title)** | `2.1 Quản lý đơn hàng xuất kho` | `Đơn hàng xuất kho` |
| **Khối bộ lọc (Filter Card)** | `Khu vực bộ lọc tìm kiếm dữ liệu theo mục 3.2` | (Không cần subtitle, chỉ cần tiêu đề `Bộ lọc` hoặc icon Search/Filter) |
| **Tên trường nhập liệu** | `1. Mã định danh khách hàng (ID)` | `Mã khách hàng` |
| **Nút thao tác** | `Click vào đây để lưu dữ liệu mục 4` | `Lưu thay đổi` / `Tạo mới` |
| **Bảng dữ liệu** | `Bảng tổng hợp số liệu báo cáo theo SRS` | `Báo cáo doanh thu` |

---

## 4. Checklist kiểm tra trước khi hoàn thành UI
- [ ] Mọi tiêu đề `h1`, `h2`, `h3`, `card title` không chứa số đánh mục (1.1, 2.0, A, B...).
- [ ] Không có các đoạn văn bản filler `subtitle` mô tả những điều hiển nhiên.
- [ ] Không có placeholder mang tính văn nói hoặc ví dụ lộn xộn.
- [ ] Toàn bộ UI sạch sẽ, gọn gàng và đạt mật độ thông tin (information density) cao.
