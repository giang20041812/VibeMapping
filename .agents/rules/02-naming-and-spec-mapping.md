# Quy chuẩn 02: Đặt tên chuẩn xác & Ánh xạ 1:1 với đặc tả (Naming & Spec Mapping)

## 1. Mục tiêu
Đảm bảo tính nhất quán tuyệt đối giữa tài liệu đặc tả nghiệp vụ (Specification / Schema) với mã nguồn UI, form, state, biến, route và module. Lập trình viên và AI khi nhìn vào code có thể ngay lập tức ánh xạ (mapping) chính xác thành phần đó tương ứng với mục nào trong nghiệp vụ.

---

## 2. Nguyên tắc đặt tên (Naming Conventions)

### 2.1. Tên Module & Đường dẫn trang (Routes / Pages)
- Phải dùng đúng thuật ngữ nghiệp vụ trong đặc tả, viết theo định dạng kebab-case cho URLs và PascalCase cho Components.
- Ví dụ nếu đặc tả có module: `Quản lý hợp đồng bảo hiểm` (`insurance_contract`):
  - URL Route: `/insurance-contracts`, `/insurance-contracts/create`, `/insurance-contracts/:id`
  - Page Component: `InsuranceContractListPage.tsx`, `InsuranceContractCreatePage.tsx`, `InsuranceContractDetailPage.tsx`
  - Thư mục Module: `src/modules/insurance-contract/` (hoặc `src/pages/insurance-contract/`)
  - ❌ Cấm tự sáng tác tên lệch nghĩa như: `ContractPage.tsx`, `BaoHiemList.tsx`, `ManageData.tsx`.

### 2.2. Tên Form và Thành phần (Components & Forms)
- Form phải được đặt tên rõ ràng theo cấu trúc: `[ModuleName][Action]Form.tsx`:
  - `CustomerFilterForm.tsx` (Form bộ lọc)
  - `CustomerCreateForm.tsx` (Form tạo mới)
  - `CustomerEditModal.tsx` (Modal chỉnh sửa)
  - `CustomerTable.tsx` (Bảng dữ liệu)
- ❌ Cấm đặt tên chung chung như: `Form.tsx`, `MyForm.tsx`, `Filter.tsx`, `CustomComponent.tsx`.

### 2.3. Tên trường dữ liệu (Field Names & DB Columns)
- **BẮT BUỘC** trùng khớp với tên cột trong Supabase Database và khóa trong Model Types:
  - Nếu Supabase schema dùng: `customer_code`, `tax_id`, `issue_date`, `status`
  - Interface TypeScript:
    ```typescript
    export interface Customer {
      id: string;
      customer_code: string;
      full_name: string;
      tax_id: string | null;
      issue_date: string;
      status: CustomerStatus;
      created_at: string;
    }
    ```
  - Trong Form / State / Payload: Sử dụng trực tiếp `customer_code`, `tax_id`... Tuyệt đối KHÔNG tự ý đổi thành `code`, `taxNumber`, `maKhachHang`, `cid`.

### 2.4. Tên Biến State & Event Handlers
- State Boolean: Phải có tiền tố `is`, `has`, `should` (ví dụ: `isLoading`, `isOpen`, `hasError`, `isSubmitting`).
- Handler Functions: Phải có tiền tố `handle` cho nội bộ và `on` cho Props:
  - Prop: `onFilterChange: (filters: CustomerFilterParams) => void`
  - Handler nội bộ: `handleFilterSubmit = (e: React.FormEvent) => { ... }`
  - Handler thay đổi giá trị: `handleSearchChange = (query: string) => { ... }`

---

## 3. Bản đồ cấu trúc thư mục chuẩn theo Module (Module Mapping Pattern)

Mỗi module nghiệp vụ nên được đóng gói có cấu trúc tương tự nhau để dễ tìm kiếm:

```
src/
├── modules/
│   └── [module-name]/           # Ví dụ: customer, sales-order, inventory
│       ├── components/          # Các components dành riêng cho module này
│       │   ├── [Module]FilterBar.tsx
│       │   ├── [Module]Table.tsx
│       │   └── [Module]FormModal.tsx
│       ├── hooks/               # Custom hooks quản lý logic (fetch, filter, mutate)
│       │   ├── use[Module]List.ts
│       │   └── use[Module]Mutations.ts
│       ├── services/            # Tương tác trực tiếp Supabase Client
│       │   └── [module].service.ts
│       ├── types/               # Kiểu dữ liệu TypeScript khớp với Supabase Schema
│       │   └── [module].types.ts
│       └── pages/               # Trang hiển thị
│           ├── [Module]ListPage.tsx
│           └── [Module]DetailPage.tsx
```

---

## 4. Checklist kiểm tra
- [ ] Tên trường trong Input `name="tax_id"` khớp 100% với tên thuộc tính trong TypeScript interface và Supabase column.
- [ ] Không có biến viết tắt tùy tiện hoặc viết hoa không nhất quán.
- [ ] Tên module và component phản ánh chính xác ngôn ngữ nghiệp vụ trong đặc tả.
