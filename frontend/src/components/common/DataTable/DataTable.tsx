import React from 'react';
import { Skeleton } from '../Skeleton/Skeleton';
import type { SkeletonWidth } from '../Skeleton/Skeleton';
import './DataTable.css';

export interface DataTableColumn<Row> {
  key: string;
  header: React.ReactNode;
  render: (row: Row) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  /** Không xuống dòng (mã, số, nhãn ngắn) */
  nowrap?: boolean;
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  isLoading?: boolean;
  emptyText?: string;
  onRowClick?: (row: Row) => void;
  caption?: string;
  /** Số dòng giả khi đang tải */
  skeletonRows?: number;
}

const SKELETON_ROWS = 6;
/** Độ dài xen kẽ của các ô giả để dòng chữ không đều tăm tắp như bảng thật */
const TEXT_WIDTHS: SkeletonWidth[] = [80, 55, 70, 45, 65, 85];
const SHORT_WIDTHS: SkeletonWidth[] = [50, 35, 45];

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  emptyText = 'Không có dữ liệu',
  onRowClick,
  caption,
  skeletonRows = SKELETON_ROWS,
}: DataTableProps<Row>): React.ReactElement {
  return (
    <div className="app-table-scroll" aria-busy={isLoading || undefined}>
      <table className="app-table">
        {caption && <caption className="app-table-caption">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={`align-${column.align ?? 'left'}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading &&
            Array.from({ length: skeletonRows }, (_, rowIndex) => (
              <tr key={`skeleton-${rowIndex}`}>
                {columns.map((column, columnIndex) => {
                  const isAction = column.header === '';
                  const widths = column.nowrap || column.align === 'right' ? SHORT_WIDTHS : TEXT_WIDTHS;
                  return (
                    <td key={column.key} className={`align-${column.align ?? 'left'}`}>
                      {isAction ? (
                        <Skeleton shape="button-sm" className="app-table-skeleton-action" />
                      ) : (
                        <Skeleton shape="text" width={widths[(rowIndex + columnIndex) % widths.length]} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          {!isLoading && rows.length === 0 && (
            <tr>
              <td className="app-table-empty" colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          )}
          {!isLoading &&
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? 'is-clickable' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className={`align-${column.align ?? 'left'} ${column.nowrap ? 'is-nowrap' : ''}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
