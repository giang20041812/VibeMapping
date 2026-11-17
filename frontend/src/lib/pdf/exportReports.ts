import { saveExport } from '../exportFiles';
import type { DecisionPrintInput, OrientationPrintInput } from '../printProfile';
import { downloadBlob } from './pdfWriter';
import { buildDecisionPdf, buildOrientationPdf } from './reportPdfs';

export interface ExportOutcome {
  /** Đã lưu một bản vào kho tệp riêng tư */
  saved: boolean;
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** Tải Hồ sơ định hướng (PDF có dấu tiếng Việt) về máy; chủ hồ sơ lưu thêm một bản vào kho tệp */
export async function exportOrientationProfile(input: OrientationPrintInput, options: { saveCopy: boolean }): Promise<ExportOutcome> {
  const blob = await buildOrientationPdf(input);
  const fileName = `ho-so-dinh-huong-${stamp()}.pdf`;
  downloadBlob(blob, fileName);
  if (!options.saveCopy) return { saved: false };
  const saved = await saveExport('orientation_profile', `Hồ sơ định hướng ${new Date().toLocaleDateString('vi-VN')}`, fileName, blob);
  return { saved: saved !== null };
}

/** Tải Báo cáo quyết định (PDF) về máy; người lập lưu thêm một bản vào kho tệp */
export async function exportDecisionReport(input: DecisionPrintInput, options: { saveCopy: boolean }): Promise<ExportOutcome> {
  const blob = await buildDecisionPdf(input);
  const fileName = `bao-cao-quyet-dinh-${stamp()}.pdf`;
  downloadBlob(blob, fileName);
  if (!options.saveCopy) return { saved: false };
  const saved = await saveExport('decision_report', input.title, fileName, blob);
  return { saved: saved !== null };
}
