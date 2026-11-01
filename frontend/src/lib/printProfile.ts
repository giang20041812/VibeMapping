/** Hồ sơ định hướng: mở tài liệu in riêng (INT-005 MVP — file PDF do trình duyệt lưu). */

export interface OrientationPrintInput {
  ownerName: string;
  status: string;
  holland: string | null;
  validity: string;
  versions: string;
  groups: Array<{ code: string; percent: string }>;
  criteria: Array<{ name: string; score: string; coverage: string; confidence: string }>;
  coreValues: string[];
  topCareers: string[];
  notes: string[];
}

function pdfEscape(value: string): string {
  return value.replace(/[()\\]/g, (char) => `\\${char}`);
}

/** Tải file PDF. Font chuẩn không có dấu tiếng Việt nên nội dung trong file được bỏ dấu; bản in vẫn giữ tiếng Việt. */
export function downloadPdf(filename: string, lines: string[]) {
  const plain = lines.map((line) => line.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D'));
  const commands = ['BT', '/F1 11 Tf', '40 800 Td', '14 TL'];
  plain.slice(0, 48).forEach((line, index) => {
    commands.push(`(${pdfEscape(line.slice(0, 110))}) Tj`);
    if (index < plain.length - 1) commands.push('T*');
  });
  commands.push('ET');
  const stream = commands.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += `${object}\n`;
  }
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const blob = new Blob([body], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function printOrientationProfile(input: OrientationPrintInput) {
  const page = window.open('', '_blank', 'noopener,width=900,height=1100');
  if (!page) return;
  const rows = input.criteria.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.score)}</td><td>${esc(c.coverage)}</td><td>${esc(c.confidence)}</td></tr>`).join('');
  page.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Hồ sơ định hướng cá nhân</title>
<style>
  body{font-family:Segoe UI,Arial,sans-serif;color:#122;margin:32px;line-height:1.45}
  h1{font-size:22px;margin:0 0 8px} h2{font-size:16px;margin:20px 0 8px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{border:1px solid #ccd;padding:6px 8px;text-align:left}
  .note{color:#456;font-size:12px}
</style></head><body>
<h1>Hồ sơ định hướng cá nhân</h1>
<p>${esc(input.ownerName)} · ${esc(input.status)}${input.holland ? ` · Holland ${esc(input.holland)}` : ''}</p>
<p class="note">${esc(input.validity)}</p>
<p class="note">${esc(input.versions)}</p>
<h2>Điểm nhóm năng lực</h2>
<ul>${input.groups.map((g) => `<li>${esc(g.code)}: ${esc(g.percent)}</li>`).join('')}</ul>
<h2>Tiêu chí</h2>
<table><thead><tr><th>Tiêu chí</th><th>Điểm</th><th>Độ phủ</th><th>Độ tin cậy</th></tr></thead><tbody>${rows}</tbody></table>
${input.coreValues.length ? `<h2>Giá trị cốt lõi</h2><ol>${input.coreValues.map((v) => `<li>${esc(v)}</li>`).join('')}</ol>` : ''}
${input.topCareers.length ? `<h2>Nghề phù hợp (tham khảo)</h2><ol>${input.topCareers.map((v) => `<li>${esc(v)}</li>`).join('')}</ol>` : ''}
${input.notes.map((n) => `<p class="note">${esc(n)}</p>`).join('')}
<p class="note">Tài liệu này không phải cam kết việc làm hoặc trúng tuyển. G6 (RIASEC) đang ở mức Demo vì công thức R05 chưa chốt.</p>
</body></html>`);
  page.document.close();
  page.focus();
  page.print();
}

export interface DecisionPrintInput {
  title: string;
  ownerName: string;
  budget: string | null;
  rows: Array<{ rank: number; title: string; eligibility: string; score: string; fit: string }>;
  preferred: string | null;
}

/** Bản in báo cáo quyết định bằng trình duyệt để giữ nguyên dấu tiếng Việt (chọn Lưu thành PDF) */
export function printDecisionReport(input: DecisionPrintInput) {
  const page = window.open('', '_blank', 'noopener,width=900,height=1100');
  if (!page) return;
  const rows = input.rows
    .map((r) => `<tr><td>${r.rank}</td><td>${esc(r.title)}</td><td>${esc(r.eligibility)}</td><td>${esc(r.score)}</td><td>${esc(r.fit)}</td></tr>`)
    .join('');
  page.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(input.title)}</title>
<style>
  body{font-family:Segoe UI,Arial,sans-serif;color:#122;margin:32px;line-height:1.45}
  h1{font-size:22px;margin:0 0 8px}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}
  th,td{border:1px solid #ccd;padding:6px 8px;text-align:left}
</style></head><body>
<h1>${esc(input.title)}</h1>
<p>Người lập: ${esc(input.ownerName)}${input.budget ? ` · Ngân sách: ${esc(input.budget)}` : ''}</p>
<table><thead><tr><th>Hạng</th><th>Phương án</th><th>Đầu vào</th><th>Điểm tổng hợp</th><th>Phù hợp nghề</th></tr></thead><tbody>${rows}</tbody></table>
${input.preferred ? `<p>Phương án ưu tiên: ${esc(input.preferred)}</p>` : ''}
</body></html>`);
  page.document.close();
  page.focus();
  page.print();
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch));
}
