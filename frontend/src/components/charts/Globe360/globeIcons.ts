/* Đường vẽ biểu tượng cho nút nhóm trên quả địa cầu (canvas không dùng được component React).
   Lấy từ bộ biểu tượng lucide (ISC), lưới 24 × 24: users-round, handshake, presentation, user-round-check. */
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const GLOBE_ICON_PATHS: Record<string, string> = {
  parent: `M18 21a8 8 0 0 0-16 0${circle(10, 8, 5)}M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3`,
  friend:
    'm11 17 2 2a1 1 0 1 0 3-3M14 14l2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4M21 3l1 11h-2M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3M3 4h8',
  teacher: 'M2 3h20M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3M7 21l5-5 5 5',
  mentor: `M2 21a8 8 0 0 1 13.292-6${circle(10, 8, 5)}m16 19 2 2 4-4`,
};
