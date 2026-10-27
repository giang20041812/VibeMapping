import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Pencil } from 'lucide-react';
import { Alert, Badge, Button, Card, DataTable, Modal } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { useAuth } from '../../auth/AuthContext';
import { formatDateTime } from '../admin.logic';
import type { OperationParameter } from '../admin.types';
import { ParameterFormModal } from '../components/ParameterFormModal';
import { listCurrentParameters, listParameterHistory } from '../operation_parameters.service';
import { formatParameterValue } from '../parameter.logic';
import './AdminPages.css';

export const OperationParametersPage: React.FC = () => {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const [rows, setRows] = useState<OperationParameter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<OperationParameter | null>(null);
  const [historyOf, setHistoryOf] = useState<OperationParameter | null>(null);
  const [history, setHistory] = useState<OperationParameter[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    listCurrentParameters()
      .then((result) => {
        if (!active) return;
        setRows(result);
        setError(null);
      })
      .catch(() => active && setError('Không tải được tham số vận hành.'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const openHistory = useCallback((row: OperationParameter) => {
    setHistoryOf(row);
    setHistory([]);
    setIsHistoryLoading(true);
    listParameterHistory(row.param_code)
      .then(setHistory)
      .catch(() => setError('Không tải được lịch sử tham số.'))
      .finally(() => setIsHistoryLoading(false));
  }, []);

  const columns = useMemo<DataTableColumn<OperationParameter>[]>(
    () => [
      { key: 'param_code', header: 'Mã tham số', nowrap: true, render: (row) => <span className="admin-code">{row.param_code}</span> },
      { key: 'param_name', header: 'Tên tham số', render: (row) => <span className="admin-cell-text">{row.param_name}</span> },
      { key: 'param_value', header: 'Giá trị', render: (row) => <span className="admin-cell-text">{formatParameterValue(row.param_value)}</span> },
      { key: 'effective_from', header: 'Hiệu lực từ', nowrap: true, render: (row) => formatDateTime(row.effective_from) },
      { key: 'changed_by', header: 'Người đổi', nowrap: true, render: (row) => row.changed_by_name ?? '—' },
      {
        key: 'actions',
        header: '',
        align: 'right',
        nowrap: true,
        render: (row) => (
          <div className="admin-row-actions">
            <Button type="button" size="sm" variant="outline" leftIcon={<Pencil size={14} />} onClick={() => setEditing(row)}>
              Sửa
            </Button>
            <Button type="button" size="sm" variant="ghost" leftIcon={<History size={14} />} onClick={() => openHistory(row)}>
              Lịch sử
            </Button>
          </div>
        ),
      },
    ],
    [openHistory],
  );

  const historyColumns = useMemo<DataTableColumn<OperationParameter>[]>(
    () => [
      { key: 'effective_from', header: 'Hiệu lực từ', nowrap: true, render: (row) => formatDateTime(row.effective_from) },
      { key: 'param_value', header: 'Giá trị', render: (row) => <span className="admin-cell-text">{formatParameterValue(row.param_value)}</span> },
      { key: 'changed_by', header: 'Người đổi', nowrap: true, render: (row) => row.changed_by_name ?? '—' },
      {
        key: 'is_current',
        header: 'Trạng thái',
        nowrap: true,
        render: (row) => <Badge variant={row.is_current ? 'success' : 'default'}>{row.is_current ? 'Đang hiệu lực' : 'Đã thay'}</Badge>,
      },
    ],
    [],
  );

  return (
    <>
      <div className="admin-page-header">
        <h1 className="page-title">Tham số vận hành</h1>
      </div>

      {error && (
        <div className="admin-alert-slot">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}
      {notice && (
        <div className="admin-alert-slot">
          <Alert variant="success">{notice}</Alert>
        </div>
      )}

      <Card noPadding>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyText="Chưa có tham số"
          caption="Tham số vận hành"
        />
      </Card>

      <ParameterFormModal
        open={editing !== null}
        parameter={editing}
        userId={userId}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setNotice(`Đã lưu ${editing?.param_name ?? 'tham số'}.`);
          setEditing(null);
          setReloadKey((value) => value + 1);
        }}
      />

      <Modal open={historyOf !== null} title={historyOf ? `Lịch sử: ${historyOf.param_name}` : 'Lịch sử'} wide onClose={() => setHistoryOf(null)}>
        <DataTable
          columns={historyColumns}
          rows={history}
          rowKey={(row) => row.id}
          isLoading={isHistoryLoading}
          emptyText="Chưa có lịch sử"
        />
      </Modal>
    </>
  );
};
