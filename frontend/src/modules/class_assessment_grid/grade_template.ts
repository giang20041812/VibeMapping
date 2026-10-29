import { answerOptions, GRADE_SHEET_HEADERS } from './grid.logic';
import type { GridQuestion } from './class_assessment_grid.types';

export interface TemplateStudent {
  student_code: string | null;
  full_name: string;
}

/**
 * Tải tệp mẫu chấm điểm: mỗi dòng một học sinh, mỗi cột một câu hỏi của gói (ghi chú ở tiêu đề là nội dung câu và đáp án).
 * Ô nhập điểm của đáp án 1–5 hoặc na. Dòng khớp học sinh theo mã học sinh hoặc họ tên, cột khớp câu hỏi theo mã.
 */
export async function downloadGradeTemplate(students: TemplateStudent[], questions: GridQuestion[]): Promise<void> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Chấm điểm');
  sheet.addRow([...GRADE_SHEET_HEADERS, ...questions.map((item) => item.question_code)]);
  sheet.getRow(1).font = { bold: true };
  questions.forEach((item, index) => {
    const answers = answerOptions(item)
      .map((option) => `${option.value} = ${option.label}`)
      .join('\n');
    sheet.getCell(1, GRADE_SHEET_HEADERS.length + index + 1).note = `${item.content}\n\n${answers}`;
  });

  students.forEach((student) => {
    const row = sheet.addRow([student.student_code ?? '', student.full_name]);
    for (let column = GRADE_SHEET_HEADERS.length + 1; column <= GRADE_SHEET_HEADERS.length + questions.length; column += 1) {
      const cell = row.getCell(column);
      cell.alignment = { horizontal: 'center' };
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"1,2,3,4,5,na"'],
        showErrorMessage: true,
        errorTitle: 'Giá trị không hợp lệ',
        error: 'Nhập 1–5 hoặc na (không đủ cơ sở).',
      };
    }
  });

  sheet.columns = [{ width: 16 }, { width: 32 }, ...questions.map(() => ({ width: 14 }))];
  sheet.views = [{ state: 'frozen', xSplit: GRADE_SHEET_HEADERS.length, ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mau-cham-diem.xlsx';
  link.click();
  URL.revokeObjectURL(url);
}
