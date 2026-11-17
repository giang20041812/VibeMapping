/**
 * Công thức nào đã được nối vào hệ thống tính: bản áp dụng ở thư viện công thức có hiệu lực khi tính điểm.
 *  sql: các hàm tính trên cơ sở dữ liệu (nộp bài 360, tính lại kết quả, tiến độ lộ trình)
 *  ts:  các hàm tính trên giao diện (so sánh phương án, tiến độ lộ trình, điểm bổ sung)
 * Công thức không có trong danh sách chỉ lưu phiên bản, chưa ảnh hưởng kết quả.
 * Khi nối thêm một công thức phải thêm vào đây; kiểm tra check:formulas đối chiếu danh sách này với mã nguồn.
 */
export interface LiveBinding {
  sql?: true;
  ts?: true;
}

export const LIVE_BINDINGS: Readonly<Record<string, LiveBinding>> = {
  // Đánh giá cá nhân và 360
  criterion_percent: { sql: true },
  competency_level: { sql: true },
  th_percent: { sql: true },
  ea_percent: { sql: true, ts: true },
  solo_percent: { sql: true, ts: true },
  carkhuff_percent: { sql: true, ts: true },
  supplemental_score: { sql: true, ts: true },
  rater_weight: { sql: true },
  confidence: { sql: true },
  trust_time_ratio: { sql: true },
  trust_dispersion: { sql: true },
  trust_answer_ratio: { sql: true },
  trust_index: { sql: true },
  trust_label: { sql: true },
  // So sánh phương án
  score_gap: { ts: true },
  admission_score: { ts: true },
  finance_score_budget: { ts: true },
  finance_score_relative: { ts: true },
  finance_score: { ts: true },
  location_score: { ts: true },
  option_total_score: { ts: true },
  // Lộ trình
  roadmap_pillar_percent: { ts: true },
  roadmap_actual_percent: { sql: true, ts: true },
  roadmap_planned_percent: { sql: true, ts: true },
  roadmap_delay: { sql: true, ts: true },
  roadmap_off_track: { sql: true, ts: true },
};

export function isFormulaLive(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(LIVE_BINDINGS, code);
}
