import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Users, UserCheck, AlertCircle } from 'lucide-react';
import { Button } from '../../../components/common/Button/Button';
import { CustomerFilterBar } from '../components/CustomerFilterBar';
import { CustomerTable } from '../components/CustomerTable';
import { fetchCustomers } from '../customer.service';
import { useDebounce } from '../../../hooks/useDebounce';
import type { CustomerItem, CustomerFilterState } from '../customer.types';
import './CustomerListPage.css';

const INITIAL_FILTERS: CustomerFilterState = {
  searchKeyword: '',
  categoryId: '',
  status: '',
  city: '',
};

export const CustomerListPage: React.FC = () => {
  const [filters, setFilters] = useState<CustomerFilterState>(INITIAL_FILTERS);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Debounce search keyword with 300ms delay per Rule 7
  const debouncedKeyword = useDebounce(filters.searchKeyword, 300);

  const loadData = useCallback(async (currentFilters: CustomerFilterState) => {
    setIsLoading(true);
    try {
      const data = await fetchCustomers(currentFilters);
      setCustomers(data);
    } catch (err) {
      console.error('Lỗi tải dữ liệu khách hàng:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Effect to re-query when filters change (using debounced keyword)
  useEffect(() => {
    loadData({
      ...filters,
      searchKeyword: debouncedKeyword,
    });
  }, [debouncedKeyword, filters.categoryId, filters.status, filters.city, loadData]);

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  // Metrics summary
  const activeCount = customers.filter((c) => c.status === 'active').length;
  const pendingCount = customers.filter((c) => c.status === 'pending').length;

  return (
    <div className="customer-list-page">
      {/* Page Header: strictly no spec identifiers or junk descriptions */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Danh sách khách hàng</h1>
        </div>

        <div className="page-actions">
          <Button variant="primary" leftIcon={<Plus size={16} />}>
            Thêm mới
          </Button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="metrics-summary-grid">
        <div className="metric-card">
          <div className="metric-icon-box bg-blue">
            <Users size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-value">{customers.length}</span>
            <span className="metric-label">Tổng khách hàng</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box bg-green">
            <UserCheck size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-value">{activeCount}</span>
            <span className="metric-label">Đang hoạt động</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box bg-amber">
            <AlertCircle size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-value">{pendingCount}</span>
            <span className="metric-label">Chờ kích hoạt</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar (Rule 7) */}
      <CustomerFilterBar
        filters={filters}
        onFilterChange={setFilters}
        onReset={handleResetFilters}
        isLoading={isLoading}
        totalResults={customers.length}
      />

      {/* Main Data Table */}
      <CustomerTable customers={customers} isLoading={isLoading} />
    </div>
  );
};
