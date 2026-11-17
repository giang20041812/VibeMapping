import React, { useCallback, useEffect, useState } from 'react';
import { Download, FileJson, FileText, FolderOpen, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, Skeleton, SkeletonRegion, useConfirm } from '../../../components/common';
import { EXPORT_KIND_LABEL, deleteExport, exportDownloadUrl, formatFileSize, listExports, type ExportedFile } from '../../../lib/exportFiles';
import './ExportedFilesCard.css';

/** Tệp đã lưu trên kho riêng tư: Hồ sơ định hướng, Báo cáo quyết định, dữ liệu cá nhân (INT-005) */
export const ExportedFilesCard: React.FC<{ refreshKey?: number }> = ({ refreshKey = 0 }) => {
  const { confirm, dialog } = useConfirm();
  const [files, setFiles] = useState<ExportedFile[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => listExports().then(setFiles), []);
  useEffect(() => {
    reload().catch(() => setFiles([]));
  }, [reload, refreshKey]);

  const download = async (file: ExportedFile) => {
    setBusyId(file.id);
    setError(null);
    try {
      window.location.assign(await exportDownloadUrl(file));
    } catch {
      setError('Không tải được tệp. Thử lại sau.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (file: ExportedFile) => {
    if (!(await confirm({ title: `Xóa tệp "${file.title}"?`, confirmLabel: 'Xóa', danger: true }))) return;
    setBusyId(file.id);
    setError(null);
    try {
      await deleteExport(file);
      await reload();
    } catch {
      setError('Không xóa được tệp.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card title="Tệp đã lưu">
      {error && <Alert variant="danger">{error}</Alert>}
      {files === null ? (
        <SkeletonRegion>
          <Skeleton shape="text" />
          <Skeleton shape="text" />
        </SkeletonRegion>
      ) : files.length === 0 ? (
        <div className="exports-empty">
          <FolderOpen aria-hidden="true" />
          <p>Chưa có tệp nào. Hồ sơ định hướng và báo cáo quyết định tải về sẽ được lưu tại đây.</p>
        </div>
      ) : (
        <ul className="exports-list">
          {files.map((file) => (
            <li key={file.id}>
              <span className="exports-icon" aria-hidden="true">
                {file.mime_type === 'application/json' ? <FileJson size={18} /> : <FileText size={18} />}
              </span>
              <div className="exports-body">
                <span className="exports-title">{file.title}</span>
                <span className="exports-meta">
                  <Badge size="sm">{EXPORT_KIND_LABEL[file.kind]}</Badge>
                  {new Date(file.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })} · {formatFileSize(file.size_bytes)}
                </span>
              </div>
              <div className="exports-actions">
                <Button type="button" size="sm" variant="outline" leftIcon={<Download size={14} />} isLoading={busyId === file.id} onClick={() => void download(file)}>
                  Tải
                </Button>
                <button type="button" className="exports-icon-btn" aria-label={`Xóa ${file.title}`} title="Xóa" disabled={busyId === file.id} onClick={() => void remove(file)}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {dialog}
    </Card>
  );
};
