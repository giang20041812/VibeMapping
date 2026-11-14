import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../Button/Button';
import './Pagination.css';

export interface PaginationProps {
  /** Trang hiện tại, bắt đầu từ 1 */
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({ page, pageSize, total, onChange, disabled = false }) => {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav className="app-pagination" aria-label="Phân trang">
      <span className="pagination-range">
        {from}–{to} / {total}
      </span>
      <div className="pagination-controls">
        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={<ChevronLeft size={16} />}
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Trước
        </Button>
        <span className="pagination-page">
          {page} / {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          rightIcon={<ChevronRight size={16} />}
          disabled={disabled || page >= pageCount}
          onClick={() => onChange(page + 1)}
        >
          Sau
        </Button>
      </div>
    </nav>
  );
};
