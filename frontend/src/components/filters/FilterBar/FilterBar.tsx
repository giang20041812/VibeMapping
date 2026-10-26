import React, { useState } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { Button } from '../../common/Button/Button';
import './FilterBar.css';

export interface FilterBarProps {
  children: React.ReactNode;
  onReset: () => void;
  onSubmit?: (e: React.FormEvent) => void;
  isLoading?: boolean;
  totalResults?: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  children,
  onReset,
  onSubmit,
  isLoading = false,
  totalResults,
}) => {
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(e);
    }
  };

  return (
    <form className="app-filter-bar" onSubmit={handleSubmit}>
      <div className="filter-bar-header-mobile">
        <div className="filter-summary">
          {totalResults !== undefined && (
            <span className="filter-count-badge">Tổng số: {totalResults}</span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={<Filter size={14} />}
          onClick={() => setIsMobileExpanded(!isMobileExpanded)}
          className="mobile-filter-toggle"
        >
          {isMobileExpanded ? 'Ẩn bộ lọc' : 'Bộ lọc'}
        </Button>
      </div>

      <div className={`filter-bar-content ${isMobileExpanded ? 'is-expanded-mobile' : ''}`}>
        <div className="filter-fields-row">{children}</div>

        <div className="filter-actions-group">
          <Button
            type="button"
            variant="ghost"
            size="md"
            leftIcon={<RotateCcw size={14} />}
            onClick={onReset}
            disabled={isLoading}
            className="btn-filter-reset"
          >
            Đặt lại
          </Button>
          {onSubmit && (
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="btn-filter-apply"
            >
              Áp dụng
            </Button>
          )}
        </div>
      </div>
    </form>
  );
};
