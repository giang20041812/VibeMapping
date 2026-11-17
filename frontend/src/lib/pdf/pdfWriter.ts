/**
 * Dựng file PDF có dấu tiếng Việt: nhúng font Be Vietnam Pro (giấy phép OFL, src/assets/fonts/OFL.txt).
 * pdf-lib và font chỉ tải khi người dùng bấm tải PDF, không làm nặng trang.
 * Tự xuống dòng theo bề rộng chữ thật, tự sang trang, chân trang có số trang.
 */
import type { PDFFont, PDFPage, RGB } from 'pdf-lib';
import regularFontUrl from '../../assets/fonts/BeVietnamPro-Regular.ttf?url';
import boldFontUrl from '../../assets/fonts/BeVietnamPro-SemiBold.ttf?url';

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_SPACE = 36;

export interface PdfTableColumn {
  header: string;
  /** Tỷ lệ bề rộng so với các cột khác */
  weight: number;
  align?: 'left' | 'right';
}

export interface PdfWriter {
  title: (text: string) => void;
  heading: (text: string) => void;
  paragraph: (text: string, options?: { muted?: boolean; size?: number }) => void;
  bullets: (items: string[], options?: { numbered?: boolean }) => void;
  keyValues: (rows: Array<[string, string]>) => void;
  table: (columns: PdfTableColumn[], rows: string[][]) => void;
  spacer: (height?: number) => void;
  toBlob: () => Promise<Blob>;
}

interface Palette {
  ink: RGB;
  muted: RGB;
  line: RGB;
  brand: RGB;
  headerFill: RGB;
}

async function loadFont(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('font_load_failed');
  return response.arrayBuffer();
}

/** Cắt một đoạn thành các dòng vừa bề rộng; từ quá dài thì cắt theo ký tự */
function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) <= width) {
        current = word;
        continue;
      }
      let piece = '';
      for (const char of word) {
        if (font.widthOfTextAtSize(piece + char, size) > width && piece) {
          lines.push(piece);
          piece = char;
        } else {
          piece += char;
        }
      }
      current = piece;
    }
    if (current) lines.push(current);
  }
  return lines;
}

export async function createPdfWriter(meta: { title: string; author?: string }): Promise<PdfWriter> {
  const [{ PDFDocument, rgb }, fontkitModule, regularBytes, boldBytes] = await Promise.all([
    import('pdf-lib'),
    import('@pdf-lib/fontkit'),
    loadFont(regularFontUrl),
    loadFont(boldFontUrl),
  ]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkitModule.default ?? fontkitModule);
  doc.setTitle(meta.title);
  doc.setLanguage('vi-VN');
  doc.setCreator('VibeMapping');
  if (meta.author) doc.setAuthor(meta.author);
  const regular = await doc.embedFont(regularBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });
  const color: Palette = {
    ink: rgb(0.07, 0.11, 0.2),
    muted: rgb(0.35, 0.4, 0.48),
    line: rgb(0.84, 0.87, 0.91),
    brand: rgb(0.11, 0.31, 0.85),
    headerFill: rgb(0.95, 0.96, 0.98),
  };

  let page: PDFPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensure = (height: number) => {
    if (y - height < MARGIN + FOOTER_SPACE) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const drawLines = (lines: string[], font: PDFFont, size: number, ink: RGB, x = MARGIN, lineGap = 1.45) => {
    const lineHeight = size * lineGap;
    for (const line of lines) {
      ensure(lineHeight);
      page.drawText(line, { x, y: y - size, size, font, color: ink });
      y -= lineHeight;
    }
  };

  const writer: PdfWriter = {
    title(text) {
      drawLines(wrapText(text, bold, 20, CONTENT_WIDTH), bold, 20, color.ink, MARGIN, 1.3);
      page.drawRectangle({ x: MARGIN, y: y - 4, width: 56, height: 3, color: color.brand });
      y -= 16;
    },
    heading(text) {
      ensure(40);
      y -= 10;
      drawLines(wrapText(text, bold, 13, CONTENT_WIDTH), bold, 13, color.ink, MARGIN, 1.4);
      y -= 2;
    },
    paragraph(text, options = {}) {
      const size = options.size ?? 10.5;
      drawLines(wrapText(text, regular, size, CONTENT_WIDTH), regular, size, options.muted ? color.muted : color.ink);
      y -= 4;
    },
    bullets(items, options = {}) {
      items.forEach((item, index) => {
        const marker = options.numbered ? `${index + 1}.` : '•';
        const lines = wrapText(item, regular, 10.5, CONTENT_WIDTH - 18);
        ensure(15);
        page.drawText(marker, { x: MARGIN, y: y - 10.5, size: 10.5, font: regular, color: color.muted });
        drawLines(lines, regular, 10.5, color.ink, MARGIN + 18);
      });
      y -= 4;
    },
    keyValues(rows) {
      const keyWidth = 150;
      for (const [key, value] of rows) {
        const valueLines = wrapText(value, regular, 10.5, CONTENT_WIDTH - keyWidth);
        ensure(15 * Math.max(valueLines.length, 1));
        const top = y;
        page.drawText(key, { x: MARGIN, y: y - 10.5, size: 10.5, font: bold, color: color.muted });
        drawLines(valueLines, regular, 10.5, color.ink, MARGIN + keyWidth);
        if (y === top) y -= 15;
      }
      y -= 4;
    },
    table(columns, rows) {
      const totalWeight = columns.reduce((sum, c) => sum + c.weight, 0);
      const widths = columns.map((c) => (c.weight / totalWeight) * CONTENT_WIDTH);
      const pad = 5;
      const size = 9.5;
      const lineHeight = size * 1.4;
      const drawRow = (cells: string[], font: PDFFont, fill?: RGB) => {
        const wrapped = cells.map((cell, i) => wrapText(cell, font, size, widths[i] - pad * 2));
        const height = Math.max(...wrapped.map((lines) => lines.length), 1) * lineHeight + pad * 2;
        ensure(height);
        if (fill) page.drawRectangle({ x: MARGIN, y: y - height, width: CONTENT_WIDTH, height, color: fill });
        let x = MARGIN;
        wrapped.forEach((lines, i) => {
          lines.forEach((line, li) => {
            const textWidth = font.widthOfTextAtSize(line, size);
            const tx = columns[i].align === 'right' ? x + widths[i] - pad - textWidth : x + pad;
            page.drawText(line, { x: tx, y: y - pad - size - li * lineHeight, size, font, color: color.ink });
          });
          x += widths[i];
        });
        page.drawLine({ start: { x: MARGIN, y: y - height }, end: { x: MARGIN + CONTENT_WIDTH, y: y - height }, thickness: 0.6, color: color.line });
        y -= height;
      };
      drawRow(columns.map((c) => c.header), bold, color.headerFill);
      rows.forEach((row) => drawRow(row, regular));
      y -= 8;
    },
    spacer(height = 8) {
      y -= height;
    },
    async toBlob() {
      const pages = doc.getPages();
      pages.forEach((p, index) => {
        const label = `${meta.title} · Trang ${index + 1}/${pages.length}`;
        p.drawText(label, { x: MARGIN, y: MARGIN / 2, size: 8, font: regular, color: color.muted });
      });
      const bytes = await doc.save();
      return new Blob([bytes as BlobPart], { type: 'application/pdf' });
    },
  };
  return writer;
}

/** Lưu Blob thành tệp trên máy người dùng */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
