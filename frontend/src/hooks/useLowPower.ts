import { useSyncExternalStore } from 'react';

/** Máy yếu theo cấu hình: ít nhân CPU, ít RAM hoặc con trỏ thô (cảm ứng) */
function detectWeakDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  return cores <= 4 || memory <= 4 || window.matchMedia('(pointer: coarse)').matches;
}

const weakDevice = detectWeakDevice();
let slowFrames = false;
let probeStarted = false;
const listeners = new Set<() => void>();

/**
 * Đo tốc độ khung hình thực tế một lần sau khi trang ổn định; nếu dưới ngưỡng thì chuyển sang chế độ nhẹ
 * cho đến hết phiên. Bỏ qua phép đo khi tab bị ẩn để không kết luận nhầm.
 */
function startProbe() {
  if (probeStarted || typeof window === 'undefined') return;
  probeStarted = true;
  window.setTimeout(() => {
    let frames = 0;
    let aborted = document.hidden;
    const started = performance.now();
    const onVisibility = () => {
      if (document.hidden) aborted = true;
    };
    document.addEventListener('visibilitychange', onVisibility);
    const tick = (now: number) => {
      frames += 1;
      if (now - started < 1500) {
        requestAnimationFrame(tick);
        return;
      }
      document.removeEventListener('visibilitychange', onVisibility);
      if (!aborted && (frames * 1000) / (now - started) < 40) {
        slowFrames = true;
        listeners.forEach((listener) => listener());
      }
    };
    requestAnimationFrame(tick);
  }, 2500);
}

function subscribe(listener: () => void) {
  startProbe();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => weakDevice || slowFrames;

/** true khi cần giảm hiệu ứng trang trí: máy yếu theo cấu hình hoặc khung hình đo được quá chậm */
export function useLowPower(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
