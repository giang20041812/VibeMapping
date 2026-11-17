import type { DecisionPrintInput, OrientationPrintInput } from '../printProfile';
import { createPdfWriter } from './pdfWriter';

export const PDF_DISCLAIMER = 'Kết quả chỉ mang tính tham khảo định hướng, không phải chẩn đoán tâm lý hay cam kết trúng tuyển.';

const today = () => new Date().toLocaleDateString('vi-VN');

/** Hồ sơ định hướng cá nhân (FR01.03.03) */
export async function buildOrientationPdf(input: OrientationPrintInput): Promise<Blob> {
  const pdf = await createPdfWriter({ title: 'Hồ sơ định hướng cá nhân', author: input.ownerName });
  pdf.title('Hồ sơ định hướng cá nhân');
  pdf.keyValues([
    ['Họ và tên', input.ownerName],
    ['Trạng thái kết quả', input.status],
    ...(input.holland ? [['Mã Holland', input.holland] as [string, string]] : []),
    ['Hiệu lực', input.validity],
    ['Ngày xuất', today()],
  ]);
  if (input.versions) pdf.paragraph(input.versions, { muted: true, size: 9 });

  if (input.groups.length > 0) {
    pdf.heading('Điểm nhóm năng lực');
    pdf.table(
      [{ header: 'Nhóm', weight: 3 }, { header: 'Điểm', weight: 1, align: 'right' }],
      input.groups.map((g) => [g.code, g.percent]),
    );
  }

  if (input.criteria.length > 0) {
    pdf.heading('Tiêu chí');
    pdf.table(
      [
        { header: 'Tiêu chí', weight: 5 },
        { header: 'Điểm', weight: 1.2, align: 'right' },
        { header: 'Độ phủ', weight: 1.2, align: 'right' },
        { header: 'Độ tin cậy', weight: 1.6 },
      ],
      input.criteria.map((c) => [c.name, c.score, c.coverage, c.confidence]),
    );
  }

  if (input.coreValues.length > 0) {
    pdf.heading('Giá trị cốt lõi');
    pdf.bullets(input.coreValues, { numbered: true });
  }

  if (input.topCareers.length > 0) {
    pdf.heading('Nghề phù hợp');
    pdf.bullets(input.topCareers, { numbered: true });
  }

  if (input.notes.length > 0) {
    pdf.spacer();
    input.notes.forEach((note) => pdf.paragraph(note, { muted: true, size: 9.5 }));
  }
  pdf.spacer();
  pdf.paragraph(PDF_DISCLAIMER, { muted: true, size: 9.5 });
  return pdf.toBlob();
}

/** Báo cáo quyết định cho gia đình (FR06.02.03) */
export async function buildDecisionPdf(input: DecisionPrintInput): Promise<Blob> {
  const pdf = await createPdfWriter({ title: input.title, author: input.ownerName });
  pdf.title(input.title);
  pdf.keyValues([
    ['Người lập', input.ownerName],
    ...(input.budget ? [['Ngân sách', input.budget] as [string, string]] : []),
    ...(input.preferred ? [['Phương án ưu tiên', input.preferred] as [string, string]] : []),
    ['Ngày xuất', today()],
  ]);
  pdf.heading('Xếp hạng phương án');
  pdf.table(
    [
      { header: 'Hạng', weight: 0.9, align: 'right' },
      { header: 'Phương án', weight: 3.7 },
      { header: 'Đầu vào', weight: 1.9 },
      { header: 'Điểm tổng hợp', weight: 1.9, align: 'right' },
      { header: 'Phù hợp nghề', weight: 1.6, align: 'right' },
    ],
    input.rows.map((r) => [String(r.rank), r.title, r.eligibility, r.score, r.fit]),
  );
  pdf.paragraph(PDF_DISCLAIMER, { muted: true, size: 9.5 });
  return pdf.toBlob();
}
