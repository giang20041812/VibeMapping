# Quy chuẩn 05: Chuẩn hóa Form Bộ lọc (Filter Form Standard)

## 1. Mục tiêu
Bộ lọc (Filter Form) là trung tâm tương tác của ứng dụng quản trị dữ liệu. Quy chuẩn này đảm bảo tất cả các form filter trên toàn hệ thống đều:
1. **Cùng 1 kiểu dáng UI** (Thống nhất màu sắc, chiều cao, icon, nút bấm).
2. **Giới hạn kích thước nghiêm ngặt** (Không cho dropdown dài vượt màn hình, giới hạn chiều rộng input).
3. **Bắt buộc có thanh tìm kiếm (Search Bar) bên trong Dropdown** khi danh sách có từ 7 lựa chọn trở lên hoặc dữ liệu động từ Supabase.

---

## 2. Kiến trúc & Cấu trúc một Filter Bar chuẩn

Mọi thanh lọc dữ liệu đều phải tuân theo cấu trúc chuẩn:
```
+-----------------------------------------------------------------------------------------------+
| [🔍 Tìm kiếm từ khóa... (flex-grow: 2)] [Chọn trạng thái ▾] [Chọn danh mục ▾] [📅 Ngày ▾]     |
|                                                                    [Đặt lại] [Áp dụng bộ lọc] |
+-----------------------------------------------------------------------------------------------+
```

### 2.1. Thành phần của Filter Bar:
- **Keyword Search Input**: Chiếm vị trí đầu tiên, có biểu tượng kính lúp `🔍` bên trái và nút xóa nhanh `✕` bên phải khi có chữ. Có cơ chế Debounce `300ms` khi gõ.
- **Filter Selects / DateRange**: Các ô chọn điều kiện phụ.
- **Nút hành động (Actions)**:
  - Nút `Đặt lại` (Reset): variant="ghost" hoặc "secondary", xóa toàn bộ bộ lọc về mặc định.
  - Nút `Áp dụng` (hoặc tự động lọc theo debounce): variant="primary".
- **Responsive Drawer trên Mobile**: Trên màn hình điện thoại (< 768px), form filter có nút bật mở ngăn kéo (Filter Drawer/Modal) để không chiếm hết không gian màn hình chính.

---

## 3. Quy chuẩn Giới hạn Kích thước (Bounded Dimensions)

### 3.1. Giới hạn chiều rộng (Width Constraints)
- Các ô input/select trong filter bar **không được phép co quá bé** hoặc **kéo giãn quá to**:
  ```css
  .filter-item {
    flex: 1 1 200px;
    min-width: 160px;
    max-width: 260px;
  }
  .filter-search-main {
    flex: 2 1 280px;
    min-width: 220px;
    max-width: 400px;
  }
  ```

### 3.2. Giới hạn chiều cao Dropdown Menu (Max Height)
- Tuyệt đối cấm danh sách dropdown hiển thị hàng chục items tràn khỏi màn hình người dùng.
- Chiều cao menu dropdown bắt buộc có `max-height` kèm cuộn:
  ```css
  .dropdown-menu-list {
    max-height: 280px;
    overflow-y: auto;
    overscroll-behavior: contain;
    /* Custom thanh cuộn gọn gàng */
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }
  ```

---

## 4. Bắt buộc Search Bar trong Dropdown (Searchable Dropdown)

### 4.1. Điều kiện kích hoạt
- Khi số lượng option **từ 7 mục trở lên**, hoặc:
- Khi danh mục được nạp động từ Supabase (khách hàng, nhân viên, sản phẩm, đối tác, tỉnh/thành phố).

### 4.2. Yêu cầu giao diện Searchable Dropdown
1. **Search Input dính trên cùng (Sticky Search)**:
   - Nằm ngay đầu menu popover, tự động autofocus khi mở dropdown.
   - Placeholder ngắn gọn: `Tìm kiếm...` (không viết văn hoa).
2. **Lọc tức thì (Real-time Filter)**:
   - Tự động filter danh sách theo từ khóa tiếng Việt không dấu và có dấu.
3. **Trạng thái rỗng (Empty State)**:
   - Khi không tìm thấy: Hiển thị thông báo súc tích `Không có kết quả phù hợp`.
4. **Hiển thị số lượng đã chọn**:
   - Nếu là multi-select: Hiển thị badge số lượng (ví dụ: `Đã chọn: 3`) hoặc pill tags có nút xóa.

---

## 5. Mẫu Component chuẩn (`SearchableSelect.tsx`)
Mọi dropdown cần dùng component chuẩn `SearchableSelect` từ `src/components/filters/SearchableSelect.tsx`:

```tsx
<SearchableSelect
  label="Khách hàng"
  placeholder="Tất cả khách hàng"
  options={customerOptions}
  value={selectedCustomer}
  onChange={setSelectedCustomer}
  isSearchable={customerOptions.length >= 7}
/>
```

---

## 6. Checklist kiểm tra
- [ ] Dropdown có nhiều hơn 7 phần tử có thanh tìm kiếm tích hợp hay chưa?
- [ ] Mở dropdown trên màn hình nhỏ có bị tràn ra ngoài khung nhìn (viewport) không?
- [ ] Menu cuộn có mượt mà, `max-height` không vượt quá `280px` không?
- [ ] Nút "Đặt lại" xóa sạch toàn bộ các ô lọc về trạng thái ban đầu chính xác không?
