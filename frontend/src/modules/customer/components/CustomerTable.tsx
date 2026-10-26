import React from 'react';
import { Badge } from '../../../components/common/Badge/Badge';
import { CUSTOMER_STATUS_CONFIG, type CustomerItem } from '../customer.types';
import './CustomerTable.css';

export interface CustomerTableProps {
  customers: CustomerItem[];
  isLoading?: boolean;
}

export const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="table-loading-container">
        <div className="table-skeleton-row" />
        <div className="table-skeleton-row" />
        <div className="table-skeleton-row" />
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="table-empty-container">
        <p className="empty-title">Không tìm thấy khách hàng phù hợp</p>
        <span className="empty-subtitle">Thử điều chỉnh hoặc đặt lại các tiêu chí trong bộ lọc</span>
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="customer-data-table">
        <thead>
          <tr>
            <th style={{ width: '120px' }}>Mã KH</th>
            <th>Tên khách hàng</th>
            <th>Nhóm</th>
            <th>Điện thoại</th>
            <th>Mã số thuế</th>
            <th>Địa bàn</th>
            <th style={{ width: '140px', textAlign: 'center' }}>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => {
            const statusConfig = CUSTOMER_STATUS_CONFIG[customer.status] || {
              label: customer.status,
              variant: 'default',
            };

            return (
              <tr key={customer.id}>
                <td className="cell-code">
                  <code>{customer.customer_code}</code>
                </td>
                <td className="cell-name">
                  <span className="customer-name-text">{customer.full_name}</span>
                  {customer.email && <span className="customer-email-sub">{customer.email}</span>}
                </td>
                <td>{customer.category_name || '—'}</td>
                <td>{customer.phone || '—'}</td>
                <td>{customer.tax_id || '—'}</td>
                <td>{customer.city || '—'}</td>
                <td style={{ textAlign: 'center' }}>
                  <Badge variant={statusConfig.variant} size="sm">
                    {statusConfig.label}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
