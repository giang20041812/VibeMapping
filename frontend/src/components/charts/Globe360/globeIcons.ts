/* Đường vẽ biểu tượng cho nút nhóm trên quả địa cầu (canvas không dùng được component React).
   Lấy từ bộ biểu tượng lucide (ISC), lưới 24 × 24: house, smile, graduation-cap, compass. */
export const GLOBE_ICON_PATHS: Record<string, string> = {
  parent:
    'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  friend:
    'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M8 14s1.5 2 4 2 4-2 4-2M9 9L9.01 9M15 9L15.01 9',
  teacher:
    'M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0zM22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5',
  mentor:
    'm16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265zM2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0',
};

