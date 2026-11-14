import React, { useEffect, useRef, useState } from 'react';
import { Download, Upload, UserPlus } from 'lucide-react';
import { Alert, Button, Modal } from '../../../components/common';
import { ACCOUNT_ERROR_TEXT, ROSTER_ERROR_TEXT } from '../class_management.constants';
import { createRosterAccounts, importClassRoster } from '../class_management.service';
import type { RosterAccount, RosterImportResult, RosterRow } from '../class_management.types';
import { downloadAccountsFile, downloadRosterTemplate, parseRosterFile, RosterFileError } from '../roster.logic';
import '../ClassManagement.css';

export interface RosterImportModalProps {
  open: boolean;
  classId: string;
  onClose: () => void;
  onImported: () => void;
}

export const RosterImportModal: React.FC<RosterImportModalProps> = ({ open, classId, onClose, onImported }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Dòng đã đọc từ tệp, chờ xác nhận nhập */
  const [pendingRows, setPendingRows] = useState<RosterRow[] | null>(null);
  /** Kết quả kiểm tra trước, chưa ghi gì vào lớp */
  const [preview, setPreview] = useState<RosterImportResult | null>(null);
  const [result, setResult] = useState<RosterImportResult | null>(null);
  const [accounts, setAccounts] = useState<RosterAccount[] | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPendingRows(null);
    setPreview(null);
    setResult(null);
    setAccounts(null);
    setAccountError(null);
  }, [open]);

  /** Tạo tài khoản cho mọi dòng chưa có tài khoản; chạy lại được, dòng đã có tài khoản không bị tạo lại */
  const createAccounts = async () => {
    setIsCreating(true);
    setAccountError(null);
    try {
      const created = await createRosterAccounts(classId);
      setAccounts((current) => [...(current ?? []), ...created]);
      if (created.length > 0) onImported();
    } catch {
      setAccountError('Không tạo được tài khoản. Thử lại sau.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsBusy(true);
    setError(null);
    setPendingRows(null);
    setPreview(null);
    setResult(null);
    try {
      const rows = await parseRosterFile(file);
      setPreview(await importClassRoster(classId, rows, true));
      setPendingRows(rows);
    } catch (cause) {
      setError(cause instanceof RosterFileError ? cause.message : 'Không kiểm tra được tệp. Thử lại sau.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancelPreview = () => {
    setPendingRows(null);
    setPreview(null);
  };

  const handleConfirm = async () => {
    if (!pendingRows) return;
    setIsBusy(true);
    setError(null);
    try {
      const imported = await importClassRoster(classId, pendingRows);
      setResult(imported);
      setPendingRows(null);
      setPreview(null);
      if (imported.imported > 0) {
        onImported();
        void createAccounts();
      }
    } catch {
      setError('Không nhập được danh sách. Thử lại sau.');
    } finally {
      setIsBusy(false);
    }
  };

  const isLocked = isBusy || isCreating;

  return (
    <Modal
      open={open}
      title="Nhập danh sách học sinh"
      onClose={onClose}
      locked={isLocked}
      actions={
        <Button type="button" variant="ghost" onClick={onClose} disabled={isLocked}>
          Đóng
        </Button>
      }
    >
      <div className="class-form">
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="class-header-actions">
          <Button type="button" variant="outline" leftIcon={<Download size={16} />} onClick={() => void downloadRosterTemplate()}>
            Tải tệp mẫu
          </Button>
          <Button type="button" leftIcon={<Upload size={16} />} isLoading={isBusy && !preview} disabled={isLocked} onClick={() => inputRef.current?.click()}>
            Chọn tệp Excel
          </Button>
          <Button type="button" variant="outline" leftIcon={<UserPlus size={16} />} isLoading={isCreating} disabled={isBusy} onClick={() => void createAccounts()}>
            Tạo tài khoản học sinh
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={handleFile}
          />
        </div>

        {preview && (
          <>
            <Alert variant={preview.errors.length > 0 ? 'warning' : 'success'}>
              Hợp lệ: {preview.imported} dòng · Lỗi: {preview.errors.length} dòng
            </Alert>
            {preview.errors.length > 0 && (
              <ul className="class-import-errors">
                {preview.errors.map((item) => (
                  <li key={`${item.row}-${item.reason}`}>
                    Dòng {item.row}: {ROSTER_ERROR_TEXT[item.reason] ?? 'Dòng không hợp lệ'}
                    {item.student_code ? ` (${item.student_code})` : ''}
                  </li>
                ))}
              </ul>
            )}
            <div className="class-header-actions">
              <Button type="button" variant="ghost" onClick={handleCancelPreview} disabled={isLocked}>
                Hủy bỏ
              </Button>
              <Button type="button" onClick={() => void handleConfirm()} isLoading={isBusy} disabled={preview.imported === 0 || isLocked}>
                Xác nhận nhập danh sách
              </Button>
            </div>
          </>
        )}

        {result && (
          <Alert variant={result.imported > 0 ? 'success' : 'warning'}>
            Đã nhập {result.imported} học sinh{result.errors.length > 0 ? `, bỏ qua ${result.errors.length} dòng lỗi.` : '.'}
          </Alert>
        )}

        {accountError && <Alert variant="danger">{accountError}</Alert>}
        {accounts && accounts.length > 0 && (
          <>
            <Alert variant={accounts.some((item) => item.outcome === 'error') ? 'warning' : 'success'}>
              Đã tạo {accounts.filter((item) => item.outcome === 'created').length} tài khoản
              {accounts.some((item) => item.outcome === 'linked_existing')
                ? `, ${accounts.filter((item) => item.outcome === 'linked_existing').length} dùng tài khoản có sẵn`
                : ''}
              {accounts.some((item) => item.outcome === 'error')
                ? `, ${accounts.filter((item) => item.outcome === 'error').length} lỗi`
                : ''}
              .
            </Alert>
            {accounts.some((item) => item.outcome === 'created') && (
              <>
                <Alert variant="warning">Mật khẩu tạm chỉ hiện một lần. Tải tệp trước khi đóng.</Alert>
                <div className="class-header-actions">
                  <Button type="button" leftIcon={<Download size={16} />} onClick={() => void downloadAccountsFile(accounts)}>
                    Tải tài khoản đã tạo
                  </Button>
                </div>
              </>
            )}
            {accounts.some((item) => item.outcome === 'error') && (
              <ul className="class-import-errors">
                {accounts
                  .filter((item) => item.outcome === 'error')
                  .map((item) => (
                    <li key={item.student_code}>
                      {item.student_code}: {ACCOUNT_ERROR_TEXT[item.reason ?? ''] ?? 'Không tạo được tài khoản'}
                    </li>
                  ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
