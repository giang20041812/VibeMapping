/** Chạy: npm --prefix supabase/scripts run check:tuition */
import assert from 'node:assert/strict';
import { parseTuition } from './tuition-parser';

const M = 1_000_000;
let count = 0;
function check(name: string, text: string | null, studyYears: number | null, expected: Record<string, unknown>) {
  const result = parseTuition(text, studyYears) as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(result[key], value, `${name}: ${key} = ${JSON.stringify(result[key])}`);
  count += 1;
}

check('mỗi kỳ + tổng khóa', '- Học phí 1 kỳ học: ≈29,5 triệu đồng\n- Tổng học phí 3 năm: ≈177 triệu đồng\nMức 2026-2027: 59 triệu đồng/năm (SV Việt Nam); 78 triệu đồng/năm (SV quốc tế)', 3, {
  status: 'amount', basis: 'semester', isEstimate: false, perSemester: [29.5 * M, 29.5 * M], perYear: [59 * M, 59 * M], total: [177 * M, 177 * M],
});
check('khoảng triệu', '- Học phí 1 kỳ học: 38,5 – 40 triệu đồng', null, { status: 'amount', perSemester: [38.5 * M, 40 * M], perYear: [77 * M, 80 * M] });
check('đồng có chấm nghìn', '- Học phí 1 kỳ học: 9.250.000 VNĐ (ước tính 02 kỳ/năm).', null, { perSemester: [9_250_000, 9_250_000], perYear: [18_500_000, 18_500_000], semestersPerYear: 2 });
check('khoảng đồng, đơn vị ở số sau', 'Học phí 1 kỳ học: Khoảng 8.000.000–9.000.000 đ (CT tiếng Việt, năm học 2025-2026)', null, { perSemester: [8 * M, 9 * M], perYear: [16 * M, 18 * M] });
check('hai khoảng VNĐ', '- Học phí 1 kỳ học: 9.500.000 VNĐ – 11.000.000 VNĐ (ước tính 02 kỳ/năm).', null, { perSemester: [9.5 * M, 11 * M] });
check('3 kỳ/năm', '- Học phí 1 kỳ học: 12.180.000 đồng (3 kỳ/năm)', null, { perYear: [36_540_000, 36_540_000], semestersPerYear: 3 });
check('mức năm, nhãn Mức', 'Mức năm học 2026-2027: 73.5 triệu đồng/năm (nhóm ngành)', null, { status: 'amount', basis: 'year', isEstimate: false, perYear: [73.5 * M, 73.5 * M], perSemester: [36_750_000, 36_750_000] });
check('1 năm học', 'Học phí 1 năm học (khóa 2026): 27,38 triệu đồng', null, { basis: 'year', perYear: [27.38 * M, 27.38 * M] });
check('khoảng /năm', '- Học phí ≈80 – 88 triệu đồng/năm', null, { basis: 'year', perYear: [80 * M, 88 * M] });
check('chỉ tổng khóa', '- Tổng học phí 4 năm: 308 – 320 triệu đồng', null, { basis: 'total', isEstimate: true, perYear: [77 * M, 80 * M] });
check('tổng khóa không ghi số năm, lấy từ chương trình', '- Tổng học phí toàn khóa: 74.000.000 VNĐ (ước tính theo thời gian đào tạo 4 năm).', null, { basis: 'total', isEstimate: true, perYear: [18.5 * M, 18.5 * M] });
check('tổng khóa thiếu số năm', '- Tổng học phí toàn khóa: 110 – 120 triệu đồng', null, { status: 'unclear', perYear: null, total: [110 * M, 120 * M] });
check('tổng khóa dùng số năm chương trình', '- Tổng học phí toàn khóa: 120 triệu đồng', 2, { status: 'amount', perYear: [60 * M, 60 * M] });
check('tháng có số năm trong ngoặc', 'Mức 2026-2027: 8 triệu đồng/tháng (≈80 triệu/năm, 10 tháng)', null, { status: 'amount', basis: 'year', perYear: [80 * M, 80 * M], perMonth: [8 * M, 8 * M] });
check('chỉ có tháng', '- Học phí 1 kỳ học: 2.400.000 – 2.560.000 đ/tháng (quy ra 1 kỳ: Cần đối chiếu số tháng/kỳ)', null, { status: 'unclear', perYear: null, perMonth: [2_400_000, 2_560_000] });
check('chỉ có tín chỉ', 'Học phí 1 kỳ học: Chưa có dữ liệu\nĐơn giá 2026-2027: 565.000 đ/tín chỉ (chưa có khung CTĐT để tính tổng)', 4, { status: 'credit_only', perYear: null, perCredit: [565_000, 565_000] });
check('tín chỉ × khung', 'Đơn giá 2026-2027: 500.000 đ/tín chỉ; khung CTĐT 140 TC', 4, { status: 'amount', basis: 'credit', isEstimate: true, perYear: [17.5 * M, 17.5 * M], credits: 140 });
check('nhiều khối ngành tín chỉ', '- Đơn giá năm học 2026-2027: khối kinh doanh 590.000 đ/tín chỉ; khối CNTT 650.000 đ/tín chỉ.', null, { perCredit: [590_000, 650_000] });
check('miễn học phí', '- Học phí 1 kỳ học: 0 VNĐ. Có hỗ trợ sinh hoạt phí theo NĐ 116/2020/NĐ-CP.\n- Trường cam kết không tăng học phí quá %: Không áp dụng', null, { status: 'free', perYear: [0, 0], perSemester: [0, 0] });
check('miễn quân sự, dân sự có số', '- Học phí 1 kỳ học: Miễn học phí (Hệ Quân sự); ≈15 - 18 triệu đồng/kỳ (Hệ Dân sự)', null, { status: 'amount', perSemester: [15 * M, 18 * M] });
check('chưa công bố', '- Học phí 1 kỳ học: Chưa công bố\n- Tổng học phí toàn khóa: Chưa công bố\n- Trường cam kết không tăng học phí quá %: Chưa công bố tỷ lệ', null, { status: 'unpublished', perYear: null });
check('chỉ có số cũ trong ngoặc', 'Học phí 1 kỳ học: Chưa có số liệu 2026-2027 (2023-2024: 15.410.000 đ/năm, nguồn thứ cấp)', null, { status: 'unpublished', perYear: null });
check('trống', null, null, { status: 'unpublished' });
check('phí khác không tính', '- Học phí khóa: 80.000.000 đồng\n- Học phí bổ sung kiến thức: 1.200.000 đồng/học phần\n- Lệ phí: xét tuyển 500.000 đồng', 2, { status: 'amount', perYear: [40 * M, 40 * M] });
check('phí xét tuyển không phải học phí', '- Tổng học phí toàn khóa: Cần đối chiếu\n- Phí xét tuyển hồ sơ: 2.000.000 đ/hồ sơ', 2, { status: 'unpublished', perYear: null });
check('ngoài khoảng hợp lý bị loại', 'Học phí 1 kỳ học: 900 triệu đồng', null, { status: 'unclear', perYear: null });
check('lệch giữa kỳ và tổng khóa', '- Học phí 1 kỳ học: 10 triệu đồng\n- Tổng học phí 4 năm: 400 triệu đồng', 4, { status: 'amount', basis: 'semester', perYear: [20 * M, 20 * M] });
assert.ok(parseTuition('- Học phí 1 kỳ học: 10 triệu đồng\n- Tổng học phí 4 năm: 400 triệu đồng', 4).warnings.some((w) => w.startsWith('conflict')), 'báo lệch');
check('ghi chú tăng 2026 trong ngoặc không bị loại', '- Học phí 1 kỳ học: ≈19,965 triệu đồng (ước tính theo 1,331 triệu/tín chỉ ≈ 39,93 triệu/năm, thông báo 74/2025; chưa cộng tăng 2026)', 4, {
  status: 'amount', basis: 'semester', perSemester: [19_965_000, 19_965_000], perYear: [39_930_000, 39_930_000],
});
check('trọn khóa N năm', '- Học phí trọn khóa 2 năm: 52.800.000 đồng (đã bao gồm lệ phí đầu vào và đầu ra)', null, {
  status: 'amount', basis: 'total', isEstimate: true, perYear: [26.4 * M, 26.4 * M], total: [52.8 * M, 52.8 * M],
});
check('chưa có dữ liệu ngắn gọn', 'Chưa có dữ liệu', 4, { status: 'unpublished', perYear: null });

console.log(`tuition-parser: ${count} ca đạt`);
