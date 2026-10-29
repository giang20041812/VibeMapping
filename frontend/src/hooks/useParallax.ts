import { useEffect, type RefObject } from 'react';
import { useLowPower } from './useLowPower';
import { useReducedMotion } from './useReducedMotion';

/**
 * Ghi vị trí con trỏ trong phần tử vào --parallax-x / --parallax-y (từ -1 đến 1) để các lớp trang trí bên trong
 * xê dịch theo bằng CSS. Không làm gì khi bật giảm chuyển động, máy yếu hoặc màn hình cảm ứng.
 */
export function useParallax(ref: RefObject<HTMLElement | null>) {
  const reducedMotion = useReducedMotion();
  const lowPower = useLowPower();

  useEffect(() => {
    const element = ref.current;
    if (!element || reducedMotion || lowPower) return;

    let frame = 0;
    const setOffset = (x: number, y: number) => {
      element.style.setProperty('--parallax-x', x.toFixed(3));
      element.style.setProperty('--parallax-y', y.toFixed(3));
    };
    const handlePointerMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        setOffset(((event.clientX - rect.left) / rect.width - 0.5) * 2, ((event.clientY - rect.top) / rect.height - 0.5) * 2);
      });
    };
    const handlePointerLeave = () => {
      cancelAnimationFrame(frame);
      setOffset(0, 0);
    };

    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerleave', handlePointerLeave);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerleave', handlePointerLeave);
      element.style.removeProperty('--parallax-x');
      element.style.removeProperty('--parallax-y');
    };
  }, [ref, reducedMotion, lowPower]);
}
