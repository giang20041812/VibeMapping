import React from 'react';
import { Search, X } from 'lucide-react';
import { FilterBar } from '../../../components/filters/FilterBar/FilterBar';
import { SearchableSelect } from '../../../components/filters/SearchableSelect/SearchableSelect';
import { Input } from '../../../components/common/Input/Input';
import {
  CATEGORY_OPTIONS,
  CITY_OPTIONS,
  STATUS_OPTIONS,
} from '../customer.service';
import type { CustomerFilterState } from '../customer.types';

export interface CustomerFilterBarProps {
  filters: CustomerFilterState;
  onFilterChange: (filters: CustomerFilterState) => void;
  onReset: () => void;
  isLoading?: boolean;
  totalResults: number;
}

export const CustomerFilterBar: React.FC<CustomerFilterBarProps> = ({
  filters,
  onFilterChange,
  onReset,
  isLoading = false,
  totalResults,
}) => {
  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filters,
      searchKeyword: e.target.value,
    });
  };

  const handleClearKeyword = () => {
    onFilterChange({
      ...filters,
      searchKeyword: '',
    });
  };

  const handleCategoryChange = (categoryId: string) => {
    onFilterChange({
      ...filters,
      categoryId,
    });
  };

  const handleStatusChange = (status: string) => {
    onFilterChange({
      ...filters,
      status,
    });
  };

  const handleCityChange = (city: string) => {
    onFilterChange({
      ...filters,
      city,
    });
  };

  return (
    <FilterBar onReset={onReset} isLoading={isLoading} totalResults={totalResults}>
      {/* 1. Keyword Search (bounded width, clear button, search icon) */}
      <div className="filter-item-search">
        <Input
          label="Tìm kiếm"
          placeholder="Mã, tên, số điện thoại..."
          value={filters.searchKeyword}
          onChange={handleKeywordChange}
          leftIcon={<Search size={16} />}
          rightAction={
            filters.searchKeyword ? (
              <button
                type="button"
                onClick={handleClearKeyword}
                style={{ cursor: 'pointer', color: 'var(--color-text-muted)' }}
                aria-label="Xóa từ khóa"
              >
                <X size={14} />
              </button>
            ) : null
          }
        />
      </div>

      {/* 2. Customer Category (bounded width) */}
      <div className="filter-item">
        <SearchableSelect
          label="Nhóm khách hàng"
          placeholder="Tất cả nhóm khách"
          options={CATEGORY_OPTIONS}
          value={filters.categoryId}
          onChange={handleCategoryChange}
          isSearchable={false}
        />
      </div>

      {/* 3. City Selection (> 7 items: Auto Search Bar per Rule 7) */}
      <div className="filter-item">
        <SearchableSelect
          label="Tỉnh / Thành phố"
          placeholder="Tất cả địa bàn"
          options={CITY_OPTIONS}
          value={filters.city}
          onChange={handleCityChange}
          isSearchable={true}
        />
      </div>

      {/* 4. Status Filter (bounded width) */}
      <div className="filter-item">
        <SearchableSelect
          label="Trạng thái"
          placeholder="Tất cả trạng thái"
          options={STATUS_OPTIONS}
          value={filters.status}
          onChange={handleStatusChange}
          isSearchable={false}
        />
      </div>
    </FilterBar>
  );
};
