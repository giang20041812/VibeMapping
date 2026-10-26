/**
 * Filter and Selection Type Definitions
 * Adheres strictly to Rule 7 (Filter form standards)
 */

export interface FilterOption {
  value: string;
  label: string;
  badge?: string | number;
  disabled?: boolean;
}

export interface CustomerFilterParams {
  searchKeyword: string;
  categoryId: string;
  status: string;
  city: string;
}

export const INITIAL_CUSTOMER_FILTERS: CustomerFilterParams = {
  searchKeyword: '',
  categoryId: '',
  status: '',
  city: '',
};
