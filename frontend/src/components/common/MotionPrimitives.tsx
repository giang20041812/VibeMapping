import React, { useEffect, useRef } from 'react';
import { useInView } from '../../hooks/useInView';

export const trackPointer = (e: React.PointerEvent<HTMLElement>) => {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - r.left}px`);
  el.style.setProperty('--my', `${e.clientY - r.top}px`);
};

/**
 * ScrollProgress: Thanh biểu thị độ vuốt của màn hình ở trên đầu (kế thừa từ HTDNSK).
 * Nội suy bằng lò xo (spring) trên requestAnimationFrame để chuyển động đầm và mượt.
 */
export const ScrollProgress: React.FC = () => {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    let target = 0;
    let current = 0;
    let velocity = 0;
    let raf = 0;

    const computeTarget = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      target = max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)) : 0;
    };

    const tick = () => {
      const force = (target - current) * 0.18;
      velocity = (velocity + force) * 0.72;
      current += velocity;

      if (Math.abs(target - current) < 0.0005 && Math.abs(velocity) < 0.0005) {
        current = target;
        bar.style.transform = `scaleX(${current.toFixed(4)})`;
        raf = 0;
        return;
      }

      bar.style.transform = `scaleX(${current.toFixed(4)})`;
      raf = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      computeTarget();
      if (!raf) raf = requestAnimationFrame(tick);
    };

    computeTarget();
    current = target;
    bar.style.transform = `scaleX(${current.toFixed(4)})`;

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="scroll-progress-track" aria-hidden="true">
      <div ref={barRef} className="scroll-progress-bar" />
    </div>
  );
};

/**
 * Magnetic: Nút hơi "hút" theo con trỏ chuột với chuyển động lò xo mượt (kế thừa từ HTDNSK).
 */
export const Magnetic: React.FC<{
  children: React.ReactNode;
  strength?: number;
  className?: string;
}> = ({ children, strength = 0.18, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ tx: 0, ty: 0, cx: 0, cy: 0, vx: 0, vy: 0, raf: 0 });

  useEffect(() => {
    const s = stateRef.current;
    return () => cancelAnimationFrame(s.raf);
  }, []);

  const startLoop = () => {
    const el = ref.current;
    const s = stateRef.current;
    if (!el || s.raf) return;

    const step = () => {
      s.vx = (s.vx + (s.tx - s.cx) * 0.2) * 0.72;
      s.vy = (s.vy + (s.ty - s.cy) * 0.2) * 0.72;
      s.cx += s.vx;
      s.cy += s.vy;

      if (Math.abs(s.tx - s.cx) < 0.05 && Math.abs(s.ty - s.cy) < 0.05 && Math.abs(s.vx) < 0.05 && Math.abs(s.vy) < 0.05) {
        s.cx = s.tx;
        s.cy = s.ty;
        el.style.transform = s.cx === 0 && s.cy === 0 ? '' : `translate3d(${s.cx.toFixed(2)}px, ${s.cy.toFixed(2)}px, 0)`;
        s.raf = 0;
        return;
      }

      el.style.transform = `translate3d(${s.cx.toFixed(2)}px, ${s.cy.toFixed(2)}px, 0)`;
      s.raf = requestAnimationFrame(step);
    };

    s.raf = requestAnimationFrame(step);
  };

  return (
    <div
      ref={ref}
      className={className}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        stateRef.current.tx = (e.clientX - (r.left + r.width / 2)) * strength;
        stateRef.current.ty = (e.clientY - (r.top + r.height / 2)) * strength;
        startLoop();
      }}
      onPointerLeave={() => {
        stateRef.current.tx = 0;
        stateRef.current.ty = 0;
        startLoop();
      }}
    >
      {children}
    </div>
  );
};

/**
 * RollText: Chữ cuộn dọc khi di chuột qua nút hoặc liên kết (kế thừa từ HTDNSK).
 */
export const RollText: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => (
  <span className={`roll ${className}`}>
    <span className="roll-inner" data-text={text}>
      {text}
    </span>
  </span>
);

/**
 * SplitText: Từng từ trồi lên khỏi mặt nạ (kiểu keynote / HTDNSK).
 */
export const SplitText: React.FC<{
  text: string;
  className?: string;
  delayMs?: number;
  staggerMs?: number;
}> = ({ text, className = '', delayMs = 0, staggerMs = 65 }) => {
  const { ref, seen } = useInView<HTMLSpanElement>(0.15);
  const words = text.split(' ');

  return (
    <span ref={ref} className={`split-line ${seen ? 'is-visible' : ''} ${className}`} aria-label={text}>
      {words.map((word, index) => (
        <React.Fragment key={`${word}-${index}`}>
          <span className="split-word-mask" aria-hidden="true">
            <span
              className="split-word"
              style={{ '--word-delay': `${delayMs + index * staggerMs}ms` } as React.CSSProperties}
            >
              {word}
            </span>
          </span>
          {index < words.length - 1 && ' '}
        </React.Fragment>
      ))}
    </span>
  );
};

/**
 * Reveal: Phần tử trượt lên mượt khi cuộn tới vùng nhìn (kế thừa từ HTDNSK).
 */
export const Reveal: React.FC<{
  children: React.ReactNode;
  delayMs?: number;
  y?: number;
  x?: number;
  className?: string;
}> = ({ children, delayMs = 0, y = 28, x = 0, className = '' }) => {
  const { ref, seen } = useInView<HTMLDivElement>(0.12);
  return (
    <div
      ref={ref}
      className={`reveal-block ${seen ? 'is-visible' : ''} ${className}`}
      style={
        {
          '--reveal-delay': `${delayMs}ms`,
          '--reveal-y': `${y}px`,
          '--reveal-x': `${x}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
};

/** Số bản sao nội dung trong dải chữ chạy: đủ để lấp kín khung khi dịch đi một bản */
const MARQUEE_COPIES = [0, 1, 2, 3];

/**
 * VelocityMarquee: Dải chữ chạy vô hạn, tăng tốc và đổi chiều theo tốc độ cuộn trang (kế thừa từ HTDNSK).
 * `baseVelocity` tính bằng % bề rộng dải mỗi giây; số âm chạy sang trái. Chỉ chạy khi dải nằm trong khung nhìn.
 */
export const VelocityMarquee: React.FC<{
  children: React.ReactNode;
  baseVelocity?: number;
  className?: string;
}> = ({ children, baseVelocity = -1.6, className = '' }) => {
  const { ref, inView } = useInView<HTMLDivElement>(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(-25);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !inView) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let direction = 1;
    let boost = 0;
    let lastScroll = window.scrollY;
    let lastTime = performance.now();
    let raf = 0;

    const step = (now: number) => {
      const delta = Math.min(64, now - lastTime);
      lastTime = now;
      const scroll = window.scrollY;
      const scrollSpeed = delta > 0 ? ((scroll - lastScroll) / delta) * 1000 : 0;
      lastScroll = scroll;

      /* 1000px/giây cuộn thì dải chạy nhanh gấp 5; lực cuộn được làm mượt để không giật */
      boost += (scrollSpeed / 250 - boost) * 0.1;
      if (boost < -0.02) direction = -1;
      else if (boost > 0.02) direction = 1;

      const next = offsetRef.current + direction * baseVelocity * (delta / 1000) * (1 + Math.abs(boost));
      /* Giữ vị trí trong đoạn (-50%, -25%]: dịch đúng một bản sao thì hình lặp lại y hệt */
      offsetRef.current = ((((next + 25) % 25) - 25) % 25) - 25;
      track.style.transform = `translate3d(${offsetRef.current.toFixed(3)}%, 0, 0)`;
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, baseVelocity]);

  return (
    <div ref={ref} className={`marquee ${className}`}>
      <div ref={trackRef} className="marquee-track">
        {MARQUEE_COPIES.map((copy) => (
          <span key={copy} className="marquee-copy">
            {children}
          </span>
        ))}
      </div>
    </div>
  );
};

/**
 * SpotlightCard: Thẻ có viền sáng & quầng sáng đi theo con trỏ chuột (kế thừa từ HTDNSK).
 */
export const SpotlightCard: React.FC<React.HTMLAttributes<HTMLDivElement> & { light?: boolean }> = ({
  className = '',
  light = false,
  children,
  onPointerMove,
  ...rest
}) => (
  <div
    {...rest}
    className={`spotlight ${light ? 'spotlight-light' : ''} ${className}`}
    onPointerMove={(e) => {
      trackPointer(e);
      onPointerMove?.(e);
    }}
  >
    {children}
  </div>
);
