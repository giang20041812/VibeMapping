import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { normalizeSearchText } from '../../../lib/searchText';
import type { FilterOption } from '../../../types/filter';
import './SearchableSelect.css';

export interface SearchableSelectProps {
  label?: string;
  placeholder?: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  isSearchable?: boolean; // Defaults to true if options >= 7
  disabled?: boolean;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  placeholder = 'Chọn một mục...',
  options,
  value,
  onChange,
  isSearchable,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto enable search bar if >= 7 options
  const shouldShowSearch = isSearchable ?? options.length >= 7;

  // Selected option label
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    if (!query) return options;
    return options.filter((opt) => normalizeSearchText(opt.label).includes(query));
  }, [options, searchQuery]);

  // Handle outside click & escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      // Auto focus search field when opened
      if (shouldShowSearch) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, shouldShowSearch]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  return (
    <div
      ref={containerRef}
      className={`app-searchable-select ${disabled ? 'is-disabled' : ''} ${className}`}
    >
      {label && <label className="select-label">{label}</label>}

      <div
        className={`select-trigger ${isOpen ? 'is-open' : ''} ${selectedOption ? 'has-value' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="select-display-text truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <div className="select-icons">
          {selectedOption && !disabled && (
            <button
              type="button"
              className="select-clear-btn"
              onClick={handleClear}
              title="Xóa lựa chọn"
              aria-label="Xóa lựa chọn"
            >
              <X size={14} />
            </button>
          )}
          <span className="select-chevron-cell">
            <ChevronDown size={16} className={`chevron-icon ${isOpen ? 'rotate' : ''}`} />
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="select-dropdown-menu" role="listbox">
          {shouldShowSearch && (
            <div className="select-search-header">
              <Search size={14} className="search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                className="select-search-input"
                placeholder="Tìm kiếm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="Xóa từ khóa"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          <div className="select-options-list">
            {filteredOptions.length === 0 ? (
              <div className="select-empty-state">Không có kết quả phù hợp</div>
            ) : (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  className={`select-option-item ${opt.value === value ? 'is-selected' : ''} ${
                    opt.disabled ? 'is-disabled' : ''
                  }`}
                  onClick={() => !opt.disabled && handleSelect(opt.value)}
                  role="option"
                  aria-selected={opt.value === value}
                >
                  <span className="truncate">{opt.label}</span>
                  {opt.badge && <span className="option-badge">{opt.badge}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
