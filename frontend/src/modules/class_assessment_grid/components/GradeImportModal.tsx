import React, { useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Alert, Button, Modal } from '../../../components/common';
import type { GridQuestion } from '../class_assessment_grid.types';
import { readGradeSheet } from '../grade_import';
import { GradeSheetError, parseGradeRows, type GradeSheetResult, type GradeSheetStudent } from '../grid.logic';
import '../../class_management/ClassManagement.css';

interface GradeImportModalProps {
  open: boolean;
  students: GradeSheetStudent[];
  questions: GridQuestion[];
  onDownloadTemplate: () => void;
  /** Ghi các điểm đọc được vào bảng */
  onApply: (changes: GradeSheetResult['changes']) => Promise<void>;
  onClose: () => void;
}

export const GradeImportModal: React.FC<GradeImportModalProps> = ({ open, students, questions, onDownloadTemplate, onApply, onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GradeSheetResult | null>(null);

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
      const parsed = parseGradeRows(await readGradeSheet(file), students, questions);
      await onApply(parsed.changes);
      setResult(parsed);
    } catch (cause) {
      setError(cause instanceof GradeSheetError ? cause.message : 'Không nhập được điểm. Thử lại sau.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Nhập điểm từ Excel"
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
          <Button type="button" variant="outline" leftIcon={<Download size={16} />} onClick={onDownloadTemplate}>
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
            <Alert variant={result.changes.length > 0 ? 'success' : 'warning'}>
              Đã nhập {result.changes.length} ô cho {result.studentCount} học sinh
              {result.invalid > 0 ? `, bỏ qua ${result.invalid} ô sai giá trị` : ''}
              {result.unmatchedRows.length > 0 ? `, ${result.unmatchedRows.length} dòng không khớp học sinh nào` : ''}.
            </Alert>
            {result.unmatchedRows.length > 0 && (
              <ul className="class-import-errors">
                {result.unmatchedRows.map((row) => (
                  <li key={row}>Dòng {row}: không tìm thấy học sinh theo mã hoặc họ tên</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
