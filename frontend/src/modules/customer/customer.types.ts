import type { CustomerRow, CustomerStatus } from '../../types/supabase';

export interface CustomerItem extends CustomerRow {
  category_name?: string;
}

export interface CustomerFilterState {
  searchKeyword: string;
  categoryId: string;
  status: string;
  city: string;
}

export const CUSTOMER_STATUS_CONFIG: Record<
  CustomerStatus,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }
> = {
  active: { label: 'Đang hoạt động', variant: 'success' },
  pending: { label: 'Chờ kích hoạt', variant: 'warning' },
  locked: { label: 'Đã khóa', variant: 'danger' },
  inactive: { label: 'Ngừng hoạt động', variant: 'default' },
};
