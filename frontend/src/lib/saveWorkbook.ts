import type { Workbook } from 'exceljs';

/**
 * Ghi sổ Excel ra tệp tải về. Thẻ tải phải nằm trong trang (Firefox bỏ qua thẻ rời) và đường dẫn tạm
 * chỉ thu hồi sau khi trình duyệt đã bắt đầu tải, nếu thu hồi ngay thì Safari, Firefox tải về rỗng hoặc không tải.
 */
export async function saveWorkbook(workbook: Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
