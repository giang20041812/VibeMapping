import { useEffect, useSyncExternalStore } from 'react';
import { setFormulaOverrides, type FormulaOverridePayload } from '../../domain/formula/runtime';
import { callRpc } from '../../lib/rpc';

let version = 0;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(payload: FormulaOverridePayload | null): void {
  setFormulaOverrides(payload);
  version += 1;
  listeners.forEach((listener) => listener());
}

/** Tải một lần các công thức bị thay; lỗi mạng hoặc quyền thì giữ nguyên kết quả sẵn có */
export function loadFormulaOverrides(force = false): Promise<void> {
  if (loading && !force) return loading;
  loading = callRpc<FormulaOverridePayload>('get_formula_overrides')
    .then((payload) => publish(payload))
    .catch((error: unknown) => {
      console.warn('Không tải được công thức bị thay, dùng kết quả sẵn có:', error);
      loading = null;
    });
  return loading;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Trả số phiên bản của danh sách công thức bị thay; đổi số này thì cần tính lại kết quả */
export function useFormulaOverrides(): number {
  useEffect(() => {
    void loadFormulaOverrides();
  }, []);
  return useSyncExternalStore(subscribe, () => version, () => 0);
}
