import { useCallback, useEffect, useState } from 'react';
import { useDebounce } from '../../hooks/useDebounce';

/**
 * Trạng thái bộ lọc kiểu thống nhất: ô tìm kiếm tự áp dụng sau 300 ms, các ô lọc phụ chỉ áp dụng khi bấm Áp dụng.
 * `draft` là giá trị đang nhập, `applied` là giá trị dùng để truy vấn. `initial` là bộ lọc khi mở trang
 * (ví dụ lấy từ đường dẫn); Đặt lại luôn về `empty`.
 */
export function useAdminFilter<T extends { keyword: string }>(empty: T, initial: T = empty) {
  const [draft, setDraft] = useState<T>(initial);
  const [applied, setApplied] = useState<T>(initial);
  const debouncedKeyword = useDebounce(draft.keyword, 300);

  useEffect(() => {
    setApplied((current) => (current.keyword === debouncedKeyword ? current : { ...current, keyword: debouncedKeyword }));
  }, [debouncedKeyword]);

  const patch = useCallback((change: Partial<T>) => setDraft((current) => ({ ...current, ...change })), []);
  const apply = useCallback(() => setApplied(draft), [draft]);
  const reset = useCallback(() => {
    setDraft(empty);
    setApplied(empty);
  }, [empty]);

  return { draft, applied, patch, apply, reset };
}
