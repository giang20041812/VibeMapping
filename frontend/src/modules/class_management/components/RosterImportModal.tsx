import React, { useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Alert, Button, Modal } from '../../../components/common';
import { ROSTER_ERROR_TEXT } from '../class_management.constants';
import { importClassRoster } from '../class_management.service';
import type { RosterImportResult } from '../class_management.types';
import { downloadRosterTemplate, parseRosterFile, RosterFileError } from '../roster.logic';
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
  const [result, setResult] = useState<RosterImportResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult(null);
  }, [open]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsBusy(true);
    setError(null);
    setResult(null);
    try {
      const rows = await parseRosterFile(file);
      const imported = await importClassRoster(classId, rows);
      setResult(imported);
      if (imported.imported > 0) onImported();
    } catch (cause) {
      setError(cause instanceof RosterFileError ? cause.message : 'Không nhập được danh sách. Thử lại sau.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Nhập danh sách học sinh"
      onClose={onClose}
      locked={isBusy}
      actions={
        <Button type="button" variant="ghost" onClick={onClose} disabled={isBusy}>
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
          <Button type="button" leftIcon={<Upload size={16} />} isLoading={isBusy} onClick={() => inputRef.current?.click()}>
            Chọn tệp Excel
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={handleFile}
          />
        </div>

        {result && (
          <>
            <Alert variant={result.imported > 0 ? 'success' : 'warning'}>
              Đã nhập {result.imported} học sinh{result.errors.length > 0 ? `, bỏ qua ${result.errors.length} dòng lỗi.` : '.'}
            </Alert>
            {result.errors.length > 0 && (
              <ul className="class-import-errors">
                {result.errors.map((item) => (
                  <li key={`${item.row}-${item.reason}`}>
                    Dòng {item.row}: {ROSTER_ERROR_TEXT[item.reason] ?? 'Dòng không hợp lệ'}
                    {item.student_code ? ` (${item.student_code})` : ''}
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
