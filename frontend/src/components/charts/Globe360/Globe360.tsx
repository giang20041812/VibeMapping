import React, { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useInView } from '../../../hooks/useInView';
import { useLowPower } from '../../../hooks/useLowPower';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { createGlobeScene } from './globeScene';
import type { GlobeScene, SceneNode } from './globeScene';
import './Globe360.css';

export type { GlobeTone } from './globeScene';
/** Nhóm quanh quả cầu; Icon hiển thị ở nhãn bên dưới, icon (đường vẽ) hiển thị trong nút trên canvas */
export interface GlobeNode extends SceneNode {
  Icon?: LucideIcon;
}

export interface Globe360Props {
  /** Nhóm người đánh giá quay quanh quả cầu */
  nodes: GlobeNode[];
  /** Bật: quay và có màu. Tắt: giảm tốc rồi đứng yên, chuyển sang màu xám */
  active?: boolean;
  /** Bản thu gọn dùng làm nút gạt: không có nhóm chọn, không tương tác riêng */
  compact?: boolean;
  /** Tạm dừng vòng vẽ (giữ nguyên khung hình cuối), ví dụ khi quả cầu chưa tới lượt bay vào trang */
  paused?: boolean;
  /** Đang bay vào trang: vẫn quay nhưng vẽ nhẹ hơn (ít khung hình, không đổi chất lượng giữa chừng) để chuyến bay mượt */
  lite?: boolean;
  className?: string;
}

const TOUR_INTERVAL_MS = 3200;
/** Khoảng cách tối thiểu giữa hai khung (ms) khi đang bay vào: khoảng 30 khung/giây */
const LITE_FRAME_MS = 30;
const CLICK_SLOP_PX = 5;
/** Thời gian vẽ trung bình mỗi khung (ms) vượt ngưỡng này thì hạ một mức chất lượng */
const FRAME_BUDGET_MS = [6, 5, 99];
const ADJUST_AFTER_FRAMES = 40;
const MIN_FRAME_MS = [0, 0, 30];

interface Control {
  start: () => void;
  stop: () => void;
  redraw: () => void;
}

/**
 * Quả địa cầu 3D xoay vòng: kéo để xoay, rê vào nút để dừng lại và xem nhãn,
 * tự lần lượt làm nổi từng nhóm khi chưa ai tương tác. Vòng lặp vẽ tự dừng khi quả cầu đứng yên
 * hoặc ra khỏi màn hình, và tự hạ chất lượng nếu máy vẽ chậm.
 */
export const Globe360: React.FC<Globe360Props> = ({ nodes, active = true, compact = false, paused = false, lite = false, className = '' }) => {
  const reduced = useReducedMotion();
  const lowPower = useLowPower();
  const { ref: figureRef, inView, seen } = useInView<HTMLElement>(0.2);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<GlobeScene | null>(null);
  const controlRef = useRef<Control | null>(null);
  const activeKeyRef = useRef<string | null>(null);
  const interactingRef = useRef(false);
  const overStageRef = useRef(false);
  const inViewRef = useRef(false);
  const liteRef = useRef(lite);
  const activeRef = useRef(active);
  const dragRef = useRef<{ id: number; x: number; y: number; startX: number; startY: number; time: number; moved: boolean } | null>(null);

  const [canvasKey, setCanvasKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [tourIndex, setTourIndex] = useState(0);
  const [grabbing, setGrabbing] = useState(false);

  const interacting = canvasKey !== null || pinnedKey !== null;
  const activeKey = compact ? null : (canvasKey ?? pinnedKey ?? nodes[tourIndex % Math.max(nodes.length, 1)]?.key ?? null);

  useEffect(() => {
    activeKeyRef.current = activeKey;
    interactingRef.current = interacting;
    controlRef.current?.redraw();
  }, [activeKey, interacting]);

  const focusKey = pinnedKey;
  useEffect(() => {
    sceneRef.current?.focus(focusKey, reduced);
    if (focusKey !== null) controlRef.current?.start();
    controlRef.current?.redraw();
  }, [focusKey, reduced]);

  useEffect(() => {
    activeRef.current = active;
    sceneRef.current?.setActive(active);
    controlRef.current?.start();
    controlRef.current?.redraw();
  }, [active]);

  /* Đang bay vào thì quả cầu còn nằm ngoài khung nhìn hoặc đang thu nhỏ, nhưng vẫn phải quay */
  useEffect(() => {
    liteRef.current = lite;
    const running = (inView || lite) && !paused;
    inViewRef.current = running;
    if (running) controlRef.current?.start();
    else controlRef.current?.stop();
  }, [inView, paused, lite]);

  useEffect(() => {
    if (compact || interacting || reduced || !inView || paused || lite || nodes.length === 0) return;
    const timer = window.setInterval(() => setTourIndex((i) => (i + 1) % nodes.length), TOUR_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [compact, interacting, reduced, inView, paused, lite, nodes.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const scene = createGlobeScene(canvas, nodes, lowPower ? 1 : 0);
    if (!scene) return;
    scene.setActive(activeRef.current);
    sceneRef.current = scene;

    let raf = 0;
    let last = 0;
    let averageCost = 0;
    let framesSinceAdjust = 0;
    const draw = (now: number) => scene.render(reduced ? 0 : now, activeKeyRef.current);

    const frame = (now: number) => {
      const level = scene.getQuality();
      const lightweight = liteRef.current;
      if (now - last < (lightweight ? Math.max(MIN_FRAME_MS[level], LITE_FRAME_MS) : MIN_FRAME_MS[level])) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      scene.step(dt, overStageRef.current || interactingRef.current);

      const started = performance.now();
      draw(now);
      averageCost = averageCost * 0.9 + (performance.now() - started) * 0.1;
      /* Đổi chất lượng phải dựng lại canvas nên không làm giữa chuyến bay; chi phí đo lúc đó cũng bị trang đang bận làm lệch */
      framesSinceAdjust = lightweight ? 0 : framesSinceAdjust + 1;
      if (framesSinceAdjust >= ADJUST_AFTER_FRAMES && averageCost > FRAME_BUDGET_MS[level]) {
        scene.setQuality(level + 1);
        averageCost = 0;
        framesSinceAdjust = 0;
      }

      raf = scene.isIdle() ? 0 : requestAnimationFrame(frame);
    };
    const start = () => {
      if (reduced || raf || document.hidden || !inViewRef.current) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const redraw = () => {
      if (!raf) requestAnimationFrame((now) => draw(reduced ? 0 : now));
    };
    controlRef.current = { start, stop, redraw };

    const resize = () => {
      const width = Math.round(stage.getBoundingClientRect().width);
      if (width <= 0) return;
      scene.resize(width, window.devicePixelRatio || 1);
      draw(performance.now());
    };
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    start();

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      controlRef.current = null;
      sceneRef.current = null;
    };
  }, [nodes, reduced, lowPower]);

  const localPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      time: performance.now(),
      moved: false,
    };
    sceneRef.current?.grab();
    controlRef.current?.start();
    setGrabbing(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const drag = dragRef.current;
    if (drag && drag.id === event.pointerId) {
      const now = performance.now();
      scene.dragBy(event.clientX - drag.x, event.clientY - drag.y, (now - drag.time) / 1000);
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > CLICK_SLOP_PX) drag.moved = true;
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.time = now;
      controlRef.current?.redraw();
      return;
    }
    const point = localPoint(event);
    setCanvasKey(scene.nodeAt(point.x, point.y));
  };

  const endDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    sceneRef.current?.release();
    controlRef.current?.start();
    setGrabbing(false);
    if (!drag.moved && sceneRef.current) {
      const point = localPoint(event);
      const key = sceneRef.current.nodeAt(point.x, point.y);
      if (key) setPinnedKey((current) => (current === key ? null : key));
    }
  };

  const onPointerLeave = () => {
    overStageRef.current = false;
    if (!dragRef.current) setCanvasKey(null);
  };


  return (
    <figure ref={figureRef} className={`globe360 ${compact ? 'is-compact' : ''} ${seen ? 'is-visible' : ''} ${className}`}>
      <div
        ref={stageRef}
        className="globe360-stage"
        onPointerEnter={() => {
          overStageRef.current = true;
        }}
        onPointerLeave={onPointerLeave}
      >
        <canvas
          ref={canvasRef}
          className={`globe360-canvas ${active ? '' : 'is-off'} ${grabbing ? 'is-grabbing' : ''} ${canvasKey ? 'is-pointer' : ''}`}
          aria-hidden="true"
          onPointerDown={compact ? undefined : onPointerDown}
          onPointerMove={compact ? undefined : onPointerMove}
          onPointerUp={compact ? undefined : endDrag}
          onPointerCancel={compact ? undefined : endDrag}
        />
      </div>

      {!compact && (
        <figcaption className="sr-only">Quả địa cầu 3D với các nhóm người đánh giá quay quanh</figcaption>
      )}
    </figure>
  );
};
