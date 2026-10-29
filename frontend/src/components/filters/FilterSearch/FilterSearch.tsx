import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '../../common/Input/Input';

export interface FilterSearchProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

/** Ô tìm kiếm từ khóa đứng đầu mọi thanh lọc: kính lúp bên trái, nút xóa nhanh khi có chữ */
export const FilterSearch: React.FC<FilterSearchProps> = ({ placeholder, value, onChange }) => (
  <div className="filter-item-search">
    <Input
      label="Tìm kiếm"
      placeholder={placeholder}
      leftIcon={<Search size={16} />}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rightAction={
        value ? (
          <button type="button" className="filter-search-clear" onClick={() => onChange('')} aria-label="Xóa từ khóa">
            <X size={14} />
          </button>
        ) : undefined
      }
    />
  </div>
);
