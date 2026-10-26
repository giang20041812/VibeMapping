# Quy chuẩn 04: Tương thích đa thiết bị & Đa trình duyệt (Samsung / Android / PC)

## 1. Mục tiêu
Đảm bảo tất cả các trang và thành phần giao diện hiển thị hoàn hảo, không vỡ layout, không tràn màn hình (horizontal scroll), hoạt động mượt mà trên:
- **Thiết bị di động Android / Samsung** (Samsung Internet, Chrome Mobile, các độ phân giải từ 360px đến 412px và màn hình gập).
- **Máy tính để bàn / Laptop PC** (Độ phân giải từ 1366x768 đến 4K, hỗ trợ cả chuột lẫn cảm ứng).
- **Tất cả các trình duyệt phổ biến**: Google Chrome, Samsung Internet, Mozilla Firefox, Microsoft Edge, Safari.

---

## 2. Các điểm ngắt Responsive chuẩn (Breakpoints)

Sử dụng Mobile-First hoặc thống nhất chuẩn Breakpoints:

| Tên Breakpoint | Kích thước | Thiết bị đại diện |
| :--- | :--- | :--- |
| **Mobile nhỏ** | `< 480px` | Samsung Galaxy S21/S22/S23 (360px - 412px), Android phổ thông |
| **Tablet / Foldable** | `481px - 768px` | Galaxy Z Fold gập/mở, Android Tablets 7-8 inch |
| **Laptop / Small PC**| `769px - 1024px` | Laptop 13-14 inch, iPad Pro ngang |
| **Desktop chuẩn** | `1025px - 1440px`| Màn hình PC văn phòng (Full HD 1920x1080 tỉ lệ 125%/150%) |
| **Large Monitor** | `> 1440px` | Màn hình 2K, 4K (khung phủ hết chiều ngang; chữ và khoảng cách tự lớn theo `--px`, lưới tự thêm cột) |

---

## 3. Quy tắc cốt lõi cho Samsung & Android

### 3.1. Ngăn chặn tự động phóng to trên Input (Auto-zoom Bug)
- Trên Chrome Android và Samsung Internet, nếu `font-size` của `<input>`, `<select>`, `<textarea>` nhỏ hơn `16px`, trình duyệt sẽ tự động phóng to (zoom-in) làm lệch khung nhìn.
- **Quy tắc bắt buộc**: Font size của input trên màn hình mobile luôn tối thiểu là `16px`:
  ```css
  @media (max-width: 768px) {
    input, select, textarea {
      font-size: 16px !important;
    }
  }
  ```

### 3.2. Vùng bấm cảm ứng an toàn (Touch Targets >= 44px)
- Ngón tay thao tác trên điện thoại Samsung/Android cần kích thước tiếp xúc tối thiểu **44px × 44px** (theo chuẩn W3C WCAG).
- Nút bấm, checkbox, radio, icon click trên mobile phải có padding đệm đủ rộng để không bấm nhầm:
  ```css
  .touch-target {
    min-height: 44px;
    min-width: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  ```

### 3.3. Hỗ trợ Safe Area (Notch / Thanh điều hướng ảo của Samsung)
- Các thanh điều hướng dính đáy (bottom bar) hoặc Header phải hỗ trợ `safe-area-inset`:
  ```css
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  padding-top: max(16px, env(safe-area-inset-top));
  ```

---

## 4. Quy tắc chống vỡ layout trên PC & Cross-browser

### 4.1. Chống lỗi co giãn Flexbox (`min-width: 0`)
- Một lỗi phổ biến trên các trình duyệt là phần tử con trong `flex` không chịu co lại khi nội dung dài (text overflow) mà sẽ đẩy vỡ cả layout.
- **Luôn khai báo `min-width: 0`** cho các flex child chứa text hoặc table:
  ```css
  .flex-col-content {
    flex: 1 1 auto;
    min-width: 0;
  }
  ```

### 4.2. Chống tràn ngang ngoài ý muốn (No Horizontal Scrollbar)
- Không bao giờ để `body` hay `html` xuất hiện thanh cuộn ngang do 1 phần tử con bị cố định `width: 1200px`.
- Tất cả các khối cha phải có `max-width: 100%` và `box-sizing: border-box`.
- Khối bảng biểu (`<table>`) **bắt buộc** đặt trong thẻ bọc:
  ```html
  <div class="table-responsive-wrapper">
    <table>...</table>
  </div>
  ```
  ```css
  .table-responsive-wrapper {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch; /* Mượt mà trên mobile touch */
  }
  ```

### 4.3. Màn hình lớn (Ultra-wide screens)
- Không đặt `max-width` cho khung trang: trang phải phủ hết chiều ngang, không để hai dải trống hai bên.
- Để ô thông tin không bé tí trên 2K/4K: gốc `html` tăng dần từ 14px lên 18px, mọi chữ/khoảng cách/ô điều khiển dùng đơn vị `--px` nên lớn theo; lề ngang dùng `--page-gutter`.
- Khung trang:
  ```css
  .app-container {
    width: 100%;
    padding-left: var(--page-gutter);
    padding-right: var(--page-gutter);
  }
  ```

---

## 5. Checklist kiểm tra
- [ ] Mở thử nghiệm ở kích thước `360px` (Samsung Galaxy) -> Không bị tràn ngang, các nút bấm dễ ấn bằng ngón tay cái.
- [ ] Focus vào Input trên thiết bị di động không bị trình duyệt giật màn hình hoặc zoom bất thường.
- [ ] Bảng dữ liệu có thanh cuộn ngang nội bộ mượt mà, không làm vỡ các khối xung quanh.
- [ ] Chạy tốt và hiển thị đồng nhất trên Chrome, Samsung Internet và Edge.
