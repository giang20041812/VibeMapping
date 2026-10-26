import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { CustomerItem, CustomerFilterState } from './customer.types';
import type { FilterOption } from '../../types/filter';

// Initial Mock data matching supabase/seed.sql for offline / local dev
const MOCK_CUSTOMERS: CustomerItem[] = [
  {
    id: 'c1',
    customer_code: 'KH-0001',
    full_name: 'Công ty Cổ phần Công nghệ Toàn Cầu',
    category_id: 'cat-2',
    category_name: 'Doanh nghiệp lớn',
    email: 'contact@toancau.vn',
    phone: '02438889999',
    tax_id: '0102938475',
    address: 'Số 12 Duy Tân, Cầu Giấy',
    city: 'Hà Nội',
    status: 'active',
    created_at: '2026-01-10T08:00:00Z',
    updated_at: '2026-01-10T08:00:00Z',
  },
  {
    id: 'c2',
    customer_code: 'KH-0002',
    full_name: 'Tập đoàn Đầu tư & Phát triển Phương Nam',
    category_id: 'cat-1',
    category_name: 'Khách hàng VIP',
    email: 'info@phuongnamgroup.com',
    phone: '02837778888',
    tax_id: '0304958671',
    address: 'Tầng 15, Bitexco, Q.1',
    city: 'Hồ Chí Minh',
    status: 'active',
    created_at: '2026-02-14T09:30:00Z',
    updated_at: '2026-02-14T09:30:00Z',
  },
  {
    id: 'c3',
    customer_code: 'KH-0003',
    full_name: 'Công ty TNHH Giải pháp Phần mềm Sáng Tạo',
    category_id: 'cat-3',
    category_name: 'Doanh nghiệp vừa và nhỏ',
    email: 'admin@sangtao.io',
    phone: '0912345678',
    tax_id: '0109988776',
    address: 'Khu công nghệ cao FPT',
    city: 'Đà Nẵng',
    status: 'pending',
    created_at: '2026-03-01T11:20:00Z',
    updated_at: '2026-03-01T11:20:00Z',
  },
  {
    id: 'c4',
    customer_code: 'KH-0004',
    full_name: 'Nguyễn Thị Minh Hạnh',
    category_id: 'cat-4',
    category_name: 'Khách hàng cá nhân',
    email: 'minhhanh.nguyen@gmail.com',
    phone: '0987654321',
    tax_id: null,
    address: 'Số 45 Lê Lợi',
    city: 'Hà Nội',
    status: 'active',
    created_at: '2026-03-15T14:10:00Z',
    updated_at: '2026-03-15T14:10:00Z',
  },
  {
    id: 'c5',
    customer_code: 'KH-0005',
    full_name: 'Công ty Cổ phần Vận tải & Logistics Biển Đông',
    category_id: 'cat-2',
    category_name: 'Doanh nghiệp lớn',
    email: 'support@biendonglogistics.vn',
    phone: '02253888777',
    tax_id: '0203948576',
    address: 'Khu công nghiệp Đình Vũ',
    city: 'Hải Phòng',
    status: 'locked',
    created_at: '2026-04-02T16:00:00Z',
    updated_at: '2026-04-02T16:00:00Z',
  },
  {
    id: 'c6',
    customer_code: 'KH-0006',
    full_name: 'Trần Đình Trọng',
    category_id: 'cat-4',
    category_name: 'Khách hàng cá nhân',
    email: 'trong.td@outlook.com',
    phone: '0903456789',
    tax_id: null,
    address: 'Số 108 30 Tháng 4, Ninh Kiều',
    city: 'Cần Thơ',
    status: 'inactive',
    created_at: '2026-04-18T10:00:00Z',
    updated_at: '2026-04-18T10:00:00Z',
  },
  {
    id: 'c7',
    customer_code: 'KH-0007',
    full_name: 'Công ty TNHH May Mặc & Xuất Khẩu Thịnh Phát',
    category_id: 'cat-3',
    category_name: 'Doanh nghiệp vừa và nhỏ',
    email: 'thinhphat@textile.com',
    phone: '02743889911',
    tax_id: '3702112233',
    address: 'KCN VSIP 1, Thuận An',
    city: 'Bình Dương',
    status: 'active',
    created_at: '2026-05-01T08:30:00Z',
    updated_at: '2026-05-01T08:30:00Z',
  },
  {
    id: 'c8',
    customer_code: 'KH-0008',
    full_name: 'Tập đoàn Khoáng sản & Năng lượng Đông Bắc',
    category_id: 'cat-1',
    category_name: 'Khách hàng VIP',
    email: 'dongbac.corp@energy.vn',
    phone: '02033789123',
    tax_id: '5700123456',
    address: 'Đường Trần Hưng Đạo, Hạ Long',
    city: 'Quảng Ninh',
    status: 'active',
    created_at: '2026-05-12T13:45:00Z',
    updated_at: '2026-05-12T13:45:00Z',
  },
];

export const CATEGORY_OPTIONS: FilterOption[] = [
  { value: '', label: 'Tất cả nhóm khách' },
  { value: 'cat-1', label: 'Khách hàng VIP', badge: 'VIP' },
  { value: 'cat-2', label: 'Doanh nghiệp lớn', badge: 'ENT' },
  { value: 'cat-3', label: 'Doanh nghiệp vừa và nhỏ', badge: 'SME' },
  { value: 'cat-4', label: 'Khách hàng cá nhân', badge: 'RETAIL' },
  { value: 'cat-5', label: 'Đối tác liên kết', badge: 'PARTNER' },
];

// Many cities (> 7 items) to trigger Search Bar in Dropdown per Rule 7
export const CITY_OPTIONS: FilterOption[] = [
  { value: '', label: 'Tất cả tỉnh / thành' },
  { value: 'Hà Nội', label: 'Hà Nội' },
  { value: 'Hồ Chí Minh', label: 'Hồ Chí Minh' },
  { value: 'Đà Nẵng', label: 'Đà Nẵng' },
  { value: 'Hải Phòng', label: 'Hải Phòng' },
  { value: 'Cần Thơ', label: 'Cần Thơ' },
  { value: 'Bình Dương', label: 'Bình Dương' },
  { value: 'Đồng Nai', label: 'Đồng Nai' },
  { value: 'Quảng Ninh', label: 'Quảng Ninh' },
  { value: 'Bắc Ninh', label: 'Bắc Ninh' },
  { value: 'Khánh Hòa', label: 'Khánh Hòa' },
  { value: 'Bà Rịa - Vũng Tàu', label: 'Bà Rịa - Vũng Tàu' },
];

export const STATUS_OPTIONS: FilterOption[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'pending', label: 'Chờ kích hoạt' },
  { value: 'locked', label: 'Đã khóa' },
  { value: 'inactive', label: 'Ngừng hoạt động' },
];

export async function fetchCustomers(filters: CustomerFilterState): Promise<CustomerItem[]> {
  // If Supabase is configured with active keys, perform live query
  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('customers').select('*');

      if (filters.status) {
        query = query.eq('status', filters.status as any);
      }
      if (filters.city) {
        query = query.eq('city', filters.city);
      }
      if (filters.searchKeyword.trim()) {
        const kw = `%${filters.searchKeyword.trim()}%`;
        query = query.or(`full_name.ilike.${kw},customer_code.ilike.${kw},phone.ilike.${kw}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CustomerItem[];
    } catch (err) {
      console.warn('Fallback to local data store due to Supabase connection:', err);
    }
  }

  // Local filtered data processing
  return new Promise((resolve) => {
    setTimeout(() => {
      let results = [...MOCK_CUSTOMERS];

      if (filters.searchKeyword.trim()) {
        const query = filters.searchKeyword.toLowerCase().trim();
        results = results.filter(
          (c) =>
            c.full_name.toLowerCase().includes(query) ||
            c.customer_code.toLowerCase().includes(query) ||
            (c.phone && c.phone.includes(query)) ||
            (c.email && c.email.toLowerCase().includes(query))
        );
      }

      if (filters.categoryId) {
        results = results.filter((c) => c.category_id === filters.categoryId);
      }

      if (filters.status) {
        results = results.filter((c) => c.status === filters.status);
      }

      if (filters.city) {
        results = results.filter((c) => c.city === filters.city);
      }

      resolve(results);
    }, 100);
  });
}
