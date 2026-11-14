import { cellText } from '../class_management/roster.logic';
import { GradeSheetError } from './grid.logic';

const MAX_ROWS = 1000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Đọc tệp Excel mẫu chấm điểm thành các dòng chữ (dòng 1 là tiêu đề) */
export async function readGradeSheet(file: File): Promise<string[][]> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new GradeSheetError('Chỉ nhận tệp .xlsx theo mẫu.');
  if (file.size > MAX_FILE_BYTES) throw new GradeSheetError('Tệp quá lớn (tối đa 2 MB).');

  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new GradeSheetError('Không đọc được tệp. Kiểm tra lại định dạng.');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new GradeSheetError('Tệp không có trang tính.');
  if (sheet.rowCount > MAX_ROWS + 1) throw new GradeSheetError(`Tệp có quá ${MAX_ROWS} dòng.`);

  const rows: string[][] = [];
  const columnCount = sheet.columnCount;
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    rows.push(Array.from({ length: columnCount }, (_, index) => cellText(row.getCell(index + 1).value)));
  }
  return rows;
}
